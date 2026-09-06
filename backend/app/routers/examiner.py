from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.question import QuestionBank
from app.models.exam import Exam
from app.models.session import ExamSession, SessionStatus
from app.models.result import Result
from app.models.proctor import ProctorEvent
from app.models.answer import Answer
from app.schemas.examiner import (
    ExaminerDashboardStats,
    ExaminerResultItem,
    ExaminerProctoringSessionItem,
)
from app.auth.dependencies import require_role

router = APIRouter(prefix="/examiner", tags=["Examiner Portal"])


@router.get(
    "/dashboard-stats",
    response_model=ExaminerDashboardStats,
    summary="Get aggregated statistics for examiner dashboard"
)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Computes real-time statistics from PostgreSQL for the examiner overview dashboard."""
    now = datetime.now(timezone.utc)

    # 1. Total questions
    q_count_res = await db.execute(select(func.count(QuestionBank.id)))
    total_questions = q_count_res.scalar() or 0

    # 2. Total exams
    exam_count_res = await db.execute(select(func.count(Exam.id)))
    total_exams = exam_count_res.scalar() or 0

    # 3. Active exams (availability window open)
    active_exams_res = await db.execute(
        select(func.count(Exam.id)).where(Exam.start_time <= now, now <= Exam.end_time)
    )
    active_exams = active_exams_res.scalar() or 0

    # 4. Completed exams (availability window closed)
    completed_exams_res = await db.execute(
        select(func.count(Exam.id)).where(now > Exam.end_time)
    )
    completed_exams = completed_exams_res.scalar() or 0

    # 5. Pending subjective evaluations (completed sessions not yet evaluated)
    pending_evals_res = await db.execute(
        select(func.count(ExamSession.id))
        .where(
            ExamSession.status.in_([SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT]),
            ~ExamSession.id.in_(select(Result.session_id))
        )
    )
    pending_evaluations = pending_evals_res.scalar() or 0

    # 6. Flagged proctored sessions (suspicion score >= 20 or recorded proctor events)
    flagged_res = await db.execute(
        select(func.count(ExamSession.id))
        .where(
            or_(
                ExamSession.suspicion_score >= 20,
                ExamSession.id.in_(select(ProctorEvent.session_id))
            )
        )
    )
    flagged_sessions = flagged_res.scalar() or 0

    return ExaminerDashboardStats(
        total_questions=total_questions,
        total_exams=total_exams,
        active_exams=active_exams,
        completed_exams=completed_exams,
        pending_evaluations=pending_evaluations,
        flagged_sessions=flagged_sessions,
    )


@router.get(
    "/results",
    response_model=List[ExaminerResultItem],
    summary="List student exam results for examiner review"
)
async def list_examiner_results(
    exam_id: Optional[int] = Query(None, description="Filter results by exam ID"),
    search: Optional[str] = Query(None, description="Search by student name or email"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Retrieves all student results with score breakdowns and session status."""
    stmt = (
        select(Result, ExamSession, Exam, User)
        .join(ExamSession, Result.session_id == ExamSession.id)
        .join(Exam, ExamSession.exam_id == Exam.id)
        .join(User, ExamSession.student_id == User.id)
        .order_by(Result.generated_at.desc())
    )

    if exam_id is not None:
        stmt = stmt.where(Exam.id == exam_id)

    if search:
        pattern = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(User.name).like(pattern),
                func.lower(User.email).like(pattern),
                func.lower(Exam.title).like(pattern)
            )
        )

    res = await db.execute(stmt)
    rows = res.all()

    items: List[ExaminerResultItem] = []
    for result_obj, session_obj, exam_obj, student_obj in rows:
        items.append(
            ExaminerResultItem(
                id=result_obj.id,
                session_id=session_obj.id,
                exam_id=exam_obj.id,
                exam_title=exam_obj.title,
                student_id=student_obj.id,
                student_name=student_obj.name,
                student_email=student_obj.email,
                total_score=result_obj.total_score,
                objective_score=result_obj.objective_score,
                subjective_score=result_obj.subjective_score,
                status=session_obj.status.value if hasattr(session_obj.status, "value") else str(session_obj.status),
                suspicion_score=session_obj.suspicion_score or 0,
                submitted_at=session_obj.submitted_at,
                generated_at=result_obj.generated_at,
            )
        )

    return items


@router.get(
    "/proctoring-sessions",
    response_model=List[ExaminerProctoringSessionItem],
    summary="List proctored exam sessions for examiner proctoring review"
)
async def list_proctoring_sessions(
    exam_id: Optional[int] = Query(None, description="Filter by exam ID"),
    min_suspicion: Optional[int] = Query(None, ge=0, le=100, description="Minimum suspicion score"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """
    Retrieves all exam sessions with suspicion score, event count, and evidence snapshot indicators.
    """
    # Subquery for event count and snapshot availability per session
    events_subq = (
        select(
            ProctorEvent.session_id,
            func.count(ProctorEvent.id).label("event_count"),
            func.count(ProctorEvent.webcam_snapshot_url).label("snapshot_count")
        )
        .group_by(ProctorEvent.session_id)
        .subquery()
    )

    stmt = (
        select(
            ExamSession,
            Exam,
            User,
            func.coalesce(events_subq.c.event_count, 0).label("event_count"),
            func.coalesce(events_subq.c.snapshot_count, 0).label("snapshot_count")
        )
        .join(Exam, ExamSession.exam_id == Exam.id)
        .join(User, ExamSession.student_id == User.id)
        .outerjoin(events_subq, ExamSession.id == events_subq.c.session_id)
        .where(Exam.proctoring_enabled == True)
        .order_by(ExamSession.suspicion_score.desc(), ExamSession.started_at.desc())
    )

    if exam_id is not None:
        stmt = stmt.where(Exam.id == exam_id)

    if min_suspicion is not None:
        stmt = stmt.where(ExamSession.suspicion_score >= min_suspicion)

    res = await db.execute(stmt)
    rows = res.all()

    items: List[ExaminerProctoringSessionItem] = []
    for session_obj, exam_obj, student_obj, event_count, snapshot_count in rows:
        items.append(
            ExaminerProctoringSessionItem(
                session_id=session_obj.id,
                exam_id=exam_obj.id,
                exam_title=exam_obj.title,
                student_id=student_obj.id,
                student_name=student_obj.name,
                student_email=student_obj.email,
                suspicion_score=session_obj.suspicion_score or 0,
                event_count=int(event_count),
                status=session_obj.status.value if hasattr(session_obj.status, "value") else str(session_obj.status),
                started_at=session_obj.started_at,
                submitted_at=session_obj.submitted_at,
                has_evidence_snapshot=bool(snapshot_count > 0),
            )
        )

    return items
