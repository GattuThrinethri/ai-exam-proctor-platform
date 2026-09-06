from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam, ExamQuestion
from app.models.question import QuestionBank
from app.schemas.exam import (
    ExamCreate,
    ExamUpdate,
    ExamDetailResponse,
    ExamListItemResponse,
    ExamQuestionAttach,
)
from app.schemas.session import ExamTokenResponse
from app.schemas.question import QuestionResponse
from app.auth.dependencies import get_current_user, require_role
from app.auth.security import create_exam_access_token

router = APIRouter(prefix="/exams", tags=["Exams"])

@router.post(
    "",
    response_model=ExamDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new exam (Examiner/Admin only)"
)
async def create_exam(
    exam_in: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Create exam configuration and optionally attach questions."""
    exam = Exam(
        title=exam_in.title.strip(),
        subject=exam_in.subject.strip(),
        description=exam_in.description.strip() if exam_in.description else None,
        duration=exam_in.duration,
        question_count=exam_in.question_count,
        start_time=exam_in.start_time,
        end_time=exam_in.end_time,
        randomization_enabled=exam_in.randomization_enabled,
        negative_marking_enabled=exam_in.negative_marking_enabled,
        proctoring_enabled=exam_in.proctoring_enabled,
        gaze_sensitivity=exam_in.gaze_sensitivity.lower(),
        max_tab_switch_warnings=exam_in.max_tab_switch_warnings,
        created_by=current_user.id,
    )
    db.add(exam)
    await db.flush()

    if exam_in.question_ids:
        # Validate all questions exist
        stmt = (
            select(QuestionBank)
            .options(selectinload(QuestionBank.options))
            .where(QuestionBank.id.in_(exam_in.question_ids))
        )
        res = await db.execute(stmt)
        found_questions = {q.id: q for q in res.scalars().all()}

        missing_ids = set(exam_in.question_ids) - set(found_questions.keys())
        if missing_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Questions with IDs {list(missing_ids)} not found"
            )

        for order, q_id in enumerate(exam_in.question_ids, start=1):
            exam_q = ExamQuestion(
                exam_id=exam.id,
                question_id=q_id,
                order=order,
            )
            db.add(exam_q)

    await db.commit()

    # Re-fetch complete exam with ordered questions and options
    stmt_full = (
        select(Exam)
        .options(
            selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(Exam.id == exam.id)
    )
    res_full = await db.execute(stmt_full)
    created_exam = res_full.scalar_one()

    # Build response with attached questions
    questions = [
        QuestionResponse.model_validate(eq.question)
        for eq in created_exam.exam_questions
        if eq.question
    ]
    detail = ExamDetailResponse.model_validate(created_exam)
    detail.questions = questions
    return detail

@router.get(
    "",
    response_model=List[ExamListItemResponse],
    summary="List exams"
)
async def list_exams(
    subject: Optional[str] = Query(None, description="Filter by subject"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve list of exams. Active availability window is computed from server time."""
    now = datetime.now(timezone.utc)
    query = select(Exam)

    if subject:
        query = query.where(func.lower(Exam.subject) == subject.strip().lower())

    query = query.order_by(Exam.start_time.desc())
    res = await db.execute(query)
    exams = res.scalars().all()

    items: List[ExamListItemResponse] = []
    for ex in exams:
        is_active = (ex.start_time <= now <= ex.end_time)
        item = ExamListItemResponse(
            id=ex.id,
            title=ex.title,
            subject=ex.subject,
            description=ex.description,
            duration=ex.duration,
            question_count=ex.question_count,
            start_time=ex.start_time,
            end_time=ex.end_time,
            randomization_enabled=ex.randomization_enabled,
            negative_marking_enabled=ex.negative_marking_enabled,
            proctoring_enabled=ex.proctoring_enabled,
            is_active_window=is_active,
        )
        items.append(item)
    return items

@router.get(
    "/{exam_id}",
    response_model=ExamDetailResponse,
    summary="Get full exam details (Examiner/Admin view)"
)
async def get_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Retrieve full exam details including question bank questions, model answers, and options."""
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(Exam.id == exam_id)
    )
    res = await db.execute(stmt)
    exam = res.scalar_one_or_none()

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )

    questions = [
        QuestionResponse.model_validate(eq.question)
        for eq in sorted(exam.exam_questions, key=lambda x: x.order)
        if eq.question
    ]
    detail = ExamDetailResponse.model_validate(exam)
    detail.questions = questions
    return detail

@router.put(
    "/{exam_id}",
    response_model=ExamDetailResponse,
    summary="Update exam configuration"
)
async def update_exam(
    exam_id: int,
    exam_in: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Update exam configuration and question selection."""
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(Exam.id == exam_id)
    )
    res = await db.execute(stmt)
    exam = res.scalar_one_or_none()

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )

    if exam_in.title is not None:
        exam.title = exam_in.title.strip()
    if exam_in.subject is not None:
        exam.subject = exam_in.subject.strip()
    if exam_in.description is not None:
        exam.description = exam_in.description.strip()
    if exam_in.duration is not None:
        exam.duration = exam_in.duration
    if exam_in.question_count is not None:
        exam.question_count = exam_in.question_count
    if exam_in.start_time is not None:
        exam.start_time = exam_in.start_time
    if exam_in.end_time is not None:
        exam.end_time = exam_in.end_time
    if exam_in.randomization_enabled is not None:
        exam.randomization_enabled = exam_in.randomization_enabled
    if exam_in.negative_marking_enabled is not None:
        exam.negative_marking_enabled = exam_in.negative_marking_enabled
    if exam_in.proctoring_enabled is not None:
        exam.proctoring_enabled = exam_in.proctoring_enabled
    if exam_in.gaze_sensitivity is not None:
        exam.gaze_sensitivity = exam_in.gaze_sensitivity.lower()
    if exam_in.max_tab_switch_warnings is not None:
        exam.max_tab_switch_warnings = exam_in.max_tab_switch_warnings

    if exam.start_time >= exam.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam start_time must be before end_time"
        )

    if exam_in.question_ids is not None:
        # Check questions exist
        stmt_q = (
            select(QuestionBank)
            .options(selectinload(QuestionBank.options))
            .where(QuestionBank.id.in_(exam_in.question_ids))
        )
        res_q = await db.execute(stmt_q)
        found_questions = {q.id: q for q in res_q.scalars().all()}
        missing = set(exam_in.question_ids) - set(found_questions.keys())
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question IDs {list(missing)} not found"
            )

        # Clear existing associations
        exam.exam_questions.clear()
        await db.flush()

        for order, q_id in enumerate(exam_in.question_ids, start=1):
            exam.exam_questions.append(
                ExamQuestion(
                    exam_id=exam.id,
                    question_id=q_id,
                    order=order,
                )
            )

    await db.commit()

    # Re-fetch
    stmt_updated = (
        select(Exam)
        .execution_options(populate_existing=True)
        .options(
            selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(Exam.id == exam_id)
    )
    res_updated = await db.execute(stmt_updated)
    updated_exam = res_updated.scalar_one()

    questions = [
        QuestionResponse.model_validate(eq.question)
        for eq in sorted(updated_exam.exam_questions, key=lambda x: x.order)
        if eq.question
    ]
    detail = ExamDetailResponse.model_validate(updated_exam)
    detail.questions = questions
    return detail

@router.delete(
    "/{exam_id}",
    summary="Delete an exam"
)
async def delete_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Delete an exam."""
    stmt = select(Exam).where(Exam.id == exam_id)
    res = await db.execute(stmt)
    exam = res.scalar_one_or_none()

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )

    await db.delete(exam)
    await db.commit()
    return {"message": "Exam deleted successfully", "id": exam_id}

@router.post(
    "/{exam_id}/questions",
    response_model=ExamDetailResponse,
    summary="Attach questions to an exam"
)
async def attach_questions(
    exam_id: int,
    attach_in: ExamQuestionAttach,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Attach question list to an exam, ensuring no duplicates."""
    stmt = (
        select(Exam)
        .options(
            selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(Exam.id == exam_id)
    )
    res = await db.execute(stmt)
    exam = res.scalar_one_or_none()

    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )

    # Check for duplicate IDs in request
    if len(attach_in.question_ids) != len(set(attach_in.question_ids)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate question IDs in attachment list"
        )

    # Validate questions exist
    stmt_q = (
        select(QuestionBank)
        .options(selectinload(QuestionBank.options))
        .where(QuestionBank.id.in_(attach_in.question_ids))
    )
    res_q = await db.execute(stmt_q)
    found_q = {q.id: q for q in res_q.scalars().all()}
    missing = set(attach_in.question_ids) - set(found_q.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Questions with IDs {list(missing)} not found"
        )

    # Replace existing question associations
    exam.exam_questions.clear()
    await db.flush()

    for order, q_id in enumerate(attach_in.question_ids, start=1):
        exam.exam_questions.append(
            ExamQuestion(
                exam_id=exam.id,
                question_id=q_id,
                order=order,
            )
        )

    await db.commit()

    # Re-fetch
    stmt_updated = (
        select(Exam)
        .execution_options(populate_existing=True)
        .options(
            selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(Exam.id == exam_id)
    )
    res_updated = await db.execute(stmt_updated)
    updated_exam = res_updated.scalar_one()

    questions = [
        QuestionResponse.model_validate(eq.question)
        for eq in sorted(updated_exam.exam_questions, key=lambda x: x.order)
        if eq.question
    ]
    detail = ExamDetailResponse.model_validate(updated_exam)
    detail.questions = questions
    return detail

@router.post(
    "/{exam_id}/token",
    response_model=ExamTokenResponse,
    summary="Generate a secure exam access token for a student"
)
async def generate_token(
    exam_id: int,
    student_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a cryptographic exam access token bound to (student_id + exam_id).
    Students can generate a token for themselves; Examiners/Admins can generate for any student.
    """
    target_student_id = current_user.id
    if current_user.role in (UserRole.EXAMINER, UserRole.ADMIN) and student_id:
        target_student_id = student_id
    elif current_user.role == UserRole.STUDENT and student_id and student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students can only generate tokens for themselves"
        )

    stmt = select(Exam).where(Exam.id == exam_id)
    res = await db.execute(stmt)
    exam = res.scalar_one_or_none()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {exam_id} not found"
        )

    token_str = create_exam_access_token(
        student_id=target_student_id,
        exam_id=exam.id
    )
    return ExamTokenResponse(
        exam_id=exam.id,
        student_id=target_student_id,
        access_token=token_str,
        expires_at=exam.end_time,
    )
