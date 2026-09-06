import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole, ApprovalStatus
from app.models.exam import Exam
from app.models.session import ExamSession, SessionStatus
from app.models.result import Result
from app.models.proctor import ProctorEvent
from app.models.audit import AuditLog
from app.schemas.admin import (
    AdminPlatformStats,
    AdminUserItem,
    AdminUserCreate,
    AdminUserRoleUpdate,
    AdminUserStatusUpdate,
    AdminExamItem,
    AdminAuditLogItem,
)
from app.auth.dependencies import require_role
from app.auth.security import hash_password

logger = logging.getLogger("admin_router")

router = APIRouter(prefix="/admin", tags=["Admin Platform Governance"])


@router.get(
    "/stats",
    response_model=AdminPlatformStats,
    summary="Get aggregated platform-wide governance metrics"
)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Platform health and participation statistics for administrators."""
    # User counts
    total_users_res = await db.execute(select(func.count(User.id)))
    total_users = total_users_res.scalar() or 0

    students_res = await db.execute(select(func.count(User.id)).where(User.role == UserRole.STUDENT))
    total_students = students_res.scalar() or 0

    examiners_res = await db.execute(select(func.count(User.id)).where(User.role == UserRole.EXAMINER))
    total_examiners = examiners_res.scalar() or 0

    admins_res = await db.execute(select(func.count(User.id)).where(User.role == UserRole.ADMIN))
    total_admins = admins_res.scalar() or 0

    # Exam counts
    now = datetime.now(timezone.utc)
    total_exams_res = await db.execute(select(func.count(Exam.id)))
    total_exams = total_exams_res.scalar() or 0

    active_exams_res = await db.execute(
        select(func.count(Exam.id)).where(Exam.start_time <= now, now <= Exam.end_time)
    )
    active_exams = active_exams_res.scalar() or 0

    # Session counts
    total_sess_res = await db.execute(select(func.count(ExamSession.id)))
    total_sessions = total_sess_res.scalar() or 0

    completed_sess_res = await db.execute(
        select(func.count(ExamSession.id)).where(
            ExamSession.status.in_([SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT])
        )
    )
    completed_sessions = completed_sess_res.scalar() or 0

    flagged_res = await db.execute(
        select(func.count(ExamSession.id)).where(ExamSession.suspicion_score >= 20)
    )
    flagged_sessions = flagged_res.scalar() or 0

    # Average score
    avg_res = await db.execute(select(func.coalesce(func.avg(Result.total_score), 0.0)))
    average_score = round(float(avg_res.scalar() or 0.0), 2)

    return AdminPlatformStats(
        total_users=total_users,
        total_students=total_students,
        total_examiners=total_examiners,
        total_admins=total_admins,
        total_exams=total_exams,
        active_exams=active_exams,
        total_sessions=total_sessions,
        completed_sessions=completed_sessions,
        flagged_sessions=flagged_sessions,
        average_score=average_score,
    )


@router.get(
    "/users",
    response_model=List[AdminUserItem],
    summary="List users with filtering and participation metrics"
)
async def list_users(
    role: Optional[str] = Query(None, description="Filter by role"),
    search: Optional[str] = Query(None, description="Search by name or email"),
    is_active: Optional[bool] = Query(None, description="Filter active status"),
    approval_status: Optional[str] = Query(None, description="Filter approval status (pending, approved, rejected)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Lists registered platform users with session participation stats."""
    # Subquery for student session counts
    sess_subq = (
        select(ExamSession.student_id, func.count(ExamSession.id).label("sess_count"))
        .group_by(ExamSession.student_id)
        .subquery()
    )

    stmt = (
        select(User, func.coalesce(sess_subq.c.sess_count, 0).label("sess_count"))
        .outerjoin(sess_subq, User.id == sess_subq.c.student_id)
        .order_by(User.created_at.desc())
    )

    if role:
        stmt = stmt.where(User.role == role.lower())

    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    if approval_status:
        stmt = stmt.where(User.approval_status == approval_status.lower())

    if search:
        pat = f"%{search.strip().lower()}%"
        stmt = stmt.where(or_(func.lower(User.name).like(pat), func.lower(User.email).like(pat)))

    res = await db.execute(stmt)
    rows = res.all()

    items: List[AdminUserItem] = []
    for user_obj, count in rows:
        items.append(
            AdminUserItem(
                id=user_obj.id,
                name=user_obj.name,
                email=user_obj.email,
                role=user_obj.role.value if hasattr(user_obj.role, "value") else str(user_obj.role),
                approval_status=user_obj.approval_status.value if hasattr(user_obj.approval_status, "value") else str(user_obj.approval_status),
                is_active=user_obj.is_active,
                created_at=user_obj.created_at,
                session_count=int(count),
            )
        )

    return items


@router.get(
    "/users/pending-examiners",
    response_model=List[AdminUserItem],
    summary="List all pending examiner registration requests"
)
async def list_pending_examiners(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Retrieve examiner accounts awaiting administrator approval."""
    stmt = (
        select(User)
        .where(User.role == UserRole.EXAMINER, User.approval_status == ApprovalStatus.PENDING)
        .order_by(User.created_at.asc())
    )
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [
        AdminUserItem(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            approval_status=u.approval_status.value if hasattr(u.approval_status, "value") else str(u.approval_status),
            is_active=u.is_active,
            created_at=u.created_at,
            session_count=0,
        )
        for u in users
    ]


@router.post(
    "/users/{user_id}/approve",
    response_model=AdminUserItem,
    summary="Approve an examiner registration request"
)
async def approve_examiner(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Approve a pending examiner account and activate it."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )

    user.approval_status = ApprovalStatus.APPROVED
    user.is_active = True

    audit = AuditLog(
        user_id=current_user.id,
        action="ADMIN_APPROVED_EXAMINER",
        details=f"Admin {current_user.email} approved examiner {user.email}",
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    return AdminUserItem(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        approval_status=user.approval_status.value if hasattr(user.approval_status, "value") else str(user.approval_status),
        is_active=user.is_active,
        created_at=user.created_at,
        session_count=0,
    )


@router.post(
    "/users/{user_id}/reject",
    response_model=AdminUserItem,
    summary="Reject an examiner registration request"
)
async def reject_examiner(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Reject an examiner registration request."""
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )

    user.approval_status = ApprovalStatus.REJECTED

    audit = AuditLog(
        user_id=current_user.id,
        action="ADMIN_REJECTED_EXAMINER",
        details=f"Admin {current_user.email} rejected examiner {user.email}",
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    return AdminUserItem(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        approval_status=user.approval_status.value if hasattr(user.approval_status, "value") else str(user.approval_status),
        is_active=user.is_active,
        created_at=user.created_at,
        session_count=0,
    )


@router.post(
    "/users",
    response_model=AdminUserItem,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user account (Admin Provisioning)"
)
async def create_user(
    payload: AdminUserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Direct administrative provisioning of users."""
    existing_stmt = select(User).where(User.email == payload.email.lower().strip())
    res = await db.execute(existing_stmt)
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email '{payload.email}' already exists."
        )

    try:
        assigned_role = UserRole(payload.role.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: student, examiner, admin."
        )

    new_user = User(
        name=payload.name.strip(),
        email=payload.email.lower().strip(),
        password_hash=hash_password(payload.password),
        role=assigned_role,
        approval_status=ApprovalStatus.APPROVED,
        is_active=True,
    )
    db.add(new_user)
    await db.flush()

    # Log audit entry
    action_type = "ADMIN_ASSIGNED_ADMIN_ROLE" if assigned_role == UserRole.ADMIN else "ADMIN_CREATED_USER"
    audit = AuditLog(
        user_id=current_user.id,
        action=action_type,
        details=f"Admin {current_user.email} provisioned user {new_user.email} with role {new_user.role.value}",
    )
    db.add(audit)
    await db.commit()
    await db.refresh(new_user)

    return AdminUserItem(
        id=new_user.id,
        name=new_user.name,
        email=new_user.email,
        role=new_user.role.value,
        approval_status=new_user.approval_status.value,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        session_count=0,
    )


@router.put(
    "/users/{user_id}/role",
    summary="Update user role with last-admin protection"
)
async def update_user_role(
    user_id: int,
    payload: AdminUserRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Updates user role. Enforces critical security constraint:
    Never allow demotion of the last active administrator.
    """
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )

    try:
        new_role = UserRole(payload.role.lower())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role '{payload.role}'. Must be one of: student, examiner, admin."
        )

    # LAST-ADMIN PROTECTION CHECK
    if target_user.role == UserRole.ADMIN and new_role != UserRole.ADMIN:
        active_admins_stmt = select(func.count(User.id)).where(
            User.role == UserRole.ADMIN,
            User.is_active == True
        )
        a_res = await db.execute(active_admins_stmt)
        active_admin_count = a_res.scalar() or 0
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Cannot demote the last active administrator on the platform."
            )

    old_role_val = target_user.role.value if hasattr(target_user.role, "value") else str(target_user.role)
    target_user.role = new_role

    audit = AuditLog(
        user_id=current_user.id,
        action="ROLE_CHANGE",
        details=f"Admin {current_user.email} changed role of {target_user.email} from {old_role_val} to {new_role.value}",
    )
    db.add(audit)
    await db.commit()

    return {
        "id": target_user.id,
        "email": target_user.email,
        "role": target_user.role.value,
        "message": f"Role updated to {target_user.role.value} successfully."
    }


@router.put(
    "/users/{user_id}/status",
    summary="Toggle user active status with last-admin protection"
)
async def update_user_status(
    user_id: int,
    payload: AdminUserStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """
    Activates or deactivates user accounts.
    Enforces critical security constraint:
    Never allow deactivation of the last active administrator.
    """
    stmt = select(User).where(User.id == user_id)
    res = await db.execute(stmt)
    target_user = res.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found."
        )

    # LAST-ADMIN PROTECTION CHECK
    if target_user.role == UserRole.ADMIN and payload.is_active is False:
        active_admins_stmt = select(func.count(User.id)).where(
            User.role == UserRole.ADMIN,
            User.is_active == True
        )
        a_res = await db.execute(active_admins_stmt)
        active_admin_count = a_res.scalar() or 0
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Security violation: Cannot deactivate the last active administrator on the platform."
            )

    target_user.is_active = payload.is_active

    audit = AuditLog(
        user_id=current_user.id,
        action="STATUS_CHANGE",
        details=f"Admin {current_user.email} set active status of {target_user.email} to {payload.is_active}",
    )
    db.add(audit)
    await db.commit()

    return {
        "id": target_user.id,
        "email": target_user.email,
        "is_active": target_user.is_active,
        "message": f"User active status updated to {target_user.is_active}."
    }


@router.get(
    "/exams",
    response_model=List[AdminExamItem],
    summary="Global exam oversight across all examiners"
)
async def list_global_exams(
    subject: Optional[str] = Query(None, description="Filter by subject"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Lists all configured exams with creator info and candidate counts."""
    # Subquery for session counts per exam
    cand_subq = (
        select(ExamSession.exam_id, func.count(ExamSession.id).label("cand_count"))
        .group_by(ExamSession.exam_id)
        .subquery()
    )

    now = datetime.now(timezone.utc)
    stmt = (
        select(Exam, User, func.coalesce(cand_subq.c.cand_count, 0).label("cand_count"))
        .join(User, Exam.created_by == User.id)
        .outerjoin(cand_subq, Exam.id == cand_subq.c.exam_id)
        .order_by(Exam.created_at.desc())
    )

    if subject:
        stmt = stmt.where(func.lower(Exam.subject) == subject.strip().lower())

    res = await db.execute(stmt)
    rows = res.all()

    items: List[AdminExamItem] = []
    for exam_obj, creator_obj, cand_count in rows:
        is_active = (exam_obj.start_time <= now <= exam_obj.end_time)
        items.append(
            AdminExamItem(
                id=exam_obj.id,
                title=exam_obj.title,
                subject=exam_obj.subject,
                duration=exam_obj.duration,
                question_count=exam_obj.question_count,
                creator_id=creator_obj.id,
                creator_name=creator_obj.name,
                creator_email=creator_obj.email,
                start_time=exam_obj.start_time,
                end_time=exam_obj.end_time,
                proctoring_enabled=exam_obj.proctoring_enabled,
                candidate_count=int(cand_count),
                is_active=is_active,
            )
        )

    return items


@router.delete(
    "/exams/{exam_id}",
    summary="Administratively remove an exam"
)
async def admin_delete_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Admin deletion of an exam with cascade and audit logging."""
    stmt = select(Exam).where(Exam.id == exam_id)
    res = await db.execute(stmt)
    exam_obj = res.scalar_one_or_none()

    if not exam_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found."
        )

    exam_title = exam_obj.title
    await db.delete(exam_obj)

    audit = AuditLog(
        user_id=current_user.id,
        action="EXAM_DELETED",
        details=f"Admin {current_user.email} deleted exam ID {exam_id} ('{exam_title}')",
    )
    db.add(audit)
    await db.commit()

    return {"message": f"Exam '{exam_title}' (ID {exam_id}) deleted successfully."}


@router.get(
    "/audit-logs",
    response_model=List[AdminAuditLogItem],
    summary="Retrieve system governance and security audit logs"
)
async def list_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    action: Optional[str] = Query(None, description="Filter by action type"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
):
    """Chronological governance audit stream."""
    stmt = (
        select(AuditLog, User)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )

    if action:
        stmt = stmt.where(AuditLog.action == action.upper())

    res = await db.execute(stmt)
    rows = res.all()

    items: List[AdminAuditLogItem] = []
    for audit_obj, user_obj in rows:
        items.append(
            AdminAuditLogItem(
                id=audit_obj.id,
                user_id=audit_obj.user_id,
                user_name=user_obj.name if user_obj else "System",
                user_email=user_obj.email if user_obj else None,
                user_role=user_obj.role.value if (user_obj and hasattr(user_obj.role, "value")) else None,
                action=audit_obj.action,
                details=audit_obj.details,
                ip_address=audit_obj.ip_address,
                created_at=audit_obj.created_at,
            )
        )

    return items
