import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam, ExamQuestion
from app.models.question import QuestionBank, QuestionOption
from app.models.session import ExamSession, SessionStatus
from app.models.answer import Answer
from app.models.result import Result
from app.models.audit import AuditLog
from app.schemas.result import (
    StudentResultSummaryItem,
    StudentResultDetailResponse,
    QuestionReviewItem,
    ResultPublishRequest,
)
from app.auth.dependencies import get_current_user, require_role
from app.services.percentile_service import calculate_exam_percentiles

logger = logging.getLogger("results_router")

router = APIRouter(prefix="/results", tags=["Results & Candidate Analytics"])


@router.get(
    "/my-results",
    response_model=List[StudentResultSummaryItem],
    summary="Retrieve completed exam results for current student"
)
async def get_my_results(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all evaluated exam results for the authenticated student.
    Ensures percentile rank is calculated authoritatively.
    """
    stmt = (
        select(Result, ExamSession, Exam)
        .join(ExamSession, Result.session_id == ExamSession.id)
        .join(Exam, ExamSession.exam_id == Exam.id)
        .where(ExamSession.student_id == current_user.id)
        .order_by(Result.generated_at.desc())
    )
    res = await db.execute(stmt)
    rows = res.all()

    items: List[StudentResultSummaryItem] = []
    for result_obj, session_obj, exam_obj in rows:
        # Recompute percentile if missing
        if result_obj.percentile is None:
            await calculate_exam_percentiles(exam_obj.id, db)
            await db.refresh(result_obj)

        # Compute max marks for the exam
        marks_stmt = (
            select(func.coalesce(func.sum(QuestionBank.marks), 0.0))
            .join(ExamQuestion, QuestionBank.id == ExamQuestion.question_id)
            .where(ExamQuestion.exam_id == exam_obj.id)
        )
        m_res = await db.execute(marks_stmt)
        max_marks = float(m_res.scalar() or 0.0)

        percentage = round((result_obj.total_score / max_marks) * 100.0, 2) if max_marks > 0 else 0.0

        items.append(
            StudentResultSummaryItem(
                id=result_obj.id,
                session_id=session_obj.id,
                exam_id=exam_obj.id,
                exam_title=exam_obj.title,
                subject=exam_obj.subject,
                total_score=result_obj.total_score,
                max_score=max_marks,
                objective_score=result_obj.objective_score,
                subjective_score=result_obj.subjective_score,
                percentage=percentage,
                percentile=result_obj.percentile,
                status=session_obj.status.value if hasattr(session_obj.status, "value") else str(session_obj.status),
                published=result_obj.published,
                submitted_at=session_obj.submitted_at,
                generated_at=result_obj.generated_at,
            )
        )

    return items


@router.get(
    "/session/{session_id}",
    response_model=StudentResultDetailResponse,
    summary="Get detailed candidate performance analysis for an exam session"
)
async def get_session_result(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Comprehensive result breakdown.
    Enforces result privacy:
    - Students can only view their own results.
    - If result is NOT published and user is a student, solution reviews/AI feedback are masked.
    - Authoritative percentile calculation and objective vs subjective breakdown.
    """
    stmt = (
        select(Result, ExamSession, Exam)
        .join(ExamSession, Result.session_id == ExamSession.id)
        .join(Exam, ExamSession.exam_id == Exam.id)
        .where(Result.session_id == session_id)
    )
    res = await db.execute(stmt)
    row = res.first()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Result for session {session_id} not found or not yet evaluated."
        )

    result_obj, session_obj, exam_obj = row

    # Privacy check: students can only access their own results
    if current_user.role == UserRole.STUDENT and session_obj.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: You cannot view another student's exam results."
        )

    # Ensure percentile is calculated
    if result_obj.percentile is None:
        await calculate_exam_percentiles(exam_obj.id, db)
        await db.refresh(result_obj)

    # Compute max marks
    marks_stmt = (
        select(func.coalesce(func.sum(QuestionBank.marks), 0.0))
        .join(ExamQuestion, QuestionBank.id == ExamQuestion.question_id)
        .where(ExamQuestion.exam_id == exam_obj.id)
    )
    m_res = await db.execute(marks_stmt)
    max_marks = float(m_res.scalar() or 0.0)
    percentage = round((result_obj.total_score / max_marks) * 100.0, 2) if max_marks > 0 else 0.0

    # Load questions and answers for detailed review
    q_stmt = (
        select(ExamQuestion)
        .options(
            selectinload(ExamQuestion.question).selectinload(QuestionBank.options)
        )
        .where(ExamQuestion.exam_id == exam_obj.id)
        .order_by(ExamQuestion.order)
    )
    q_res = await db.execute(q_stmt)
    exam_questions = q_res.scalars().all()

    ans_stmt = select(Answer).where(Answer.session_id == session_id)
    ans_res = await db.execute(ans_stmt)
    answers_by_qid = {ans.question_id: ans for ans in ans_res.scalars().all()}

    is_privileged = current_user.role in (UserRole.EXAMINER, UserRole.ADMIN)
    can_view_solutions = result_obj.published or is_privileged

    reviews: List[QuestionReviewItem] = []
    for eq in exam_questions:
        q = eq.question
        if not q:
            continue
        ans = answers_by_qid.get(q.id)

        # Awarded marks
        awarded = 0.0
        if ans:
            awarded = (ans.auto_score or 0.0) + (ans.ai_score or 0.0)

        # Options list sanitized for student
        options_data = None
        if q.options:
            options_data = [
                {
                    "id": opt.id,
                    "option_text": opt.option_text,
                    "is_correct": opt.is_correct if can_view_solutions else None
                }
                for opt in q.options
            ]

        # Extract correct options
        correct_ids = None
        correct_texts = None
        if can_view_solutions and q.options:
            correct_opts = [opt for opt in q.options if opt.is_correct]
            correct_ids = [opt.id for opt in correct_opts]
            correct_texts = [opt.option_text for opt in correct_opts]

        reviews.append(
            QuestionReviewItem(
                question_id=q.id,
                question_text=q.question_text,
                question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                difficulty=q.difficulty,
                marks=q.marks,
                awarded_score=round(awarded, 2),
                student_selected_option_ids=ans.selected_option_ids if ans else None,
                student_answer_text=ans.answer_text if ans else None,
                student_image_url=ans.image_url if ans else None,
                ocr_extracted_text=ans.ocr_text if ans else None,
                options=options_data,
                correct_option_ids=correct_ids,
                correct_options_text=correct_texts,
                model_answer=q.model_answer if can_view_solutions else None,
                ai_justification=ans.ai_justification if (can_view_solutions and ans) else None,
                ai_feedback=ans.ai_feedback if (can_view_solutions and ans) else None,
            )
        )

    return StudentResultDetailResponse(
        id=result_obj.id,
        session_id=session_obj.id,
        exam_id=exam_obj.id,
        exam_title=exam_obj.title,
        subject=exam_obj.subject,
        total_score=result_obj.total_score,
        max_score=max_marks,
        objective_score=result_obj.objective_score,
        subjective_score=result_obj.subjective_score,
        percentage=percentage,
        percentile=result_obj.percentile,
        suspicion_score=session_obj.suspicion_score or 0,
        status=session_obj.status.value if hasattr(session_obj.status, "value") else str(session_obj.status),
        published=result_obj.published,
        submitted_at=session_obj.submitted_at,
        generated_at=result_obj.generated_at,
        question_reviews=reviews,
    )


@router.put(
    "/{result_id}/publish",
    summary="Publish or unpublish student exam result (Examiner/Admin only)"
)
async def publish_result(
    result_id: int,
    payload: ResultPublishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Allows examiners or administrators to publish exam results."""
    stmt = select(Result).where(Result.id == result_id)
    res = await db.execute(stmt)
    result_obj = res.scalar_one_or_none()

    if not result_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Result with ID {result_id} not found."
        )

    result_obj.published = payload.published

    # Record audit log
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="RESULT_PUBLISHED" if payload.published else "RESULT_UNPUBLISHED",
        details=f"Result {result_id} published status set to {payload.published} by {current_user.email}",
    )
    db.add(audit_entry)
    await db.commit()

    return {
        "id": result_obj.id,
        "session_id": result_obj.session_id,
        "published": result_obj.published,
        "message": f"Result publication status updated to {result_obj.published}"
    }
