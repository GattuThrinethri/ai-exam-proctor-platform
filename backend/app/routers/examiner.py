from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.question import QuestionBank, QuestionType
from app.models.exam import Exam, ExamQuestion
from app.models.session import ExamSession, SessionStatus
from app.models.result import Result
from app.models.proctor import ProctorEvent
from app.models.answer import Answer
from app.models.audit import AuditLog
from app.schemas.examiner import (
    ExaminerDashboardStats,
    ExaminerResultItem,
    ExaminerProctoringSessionItem,
    ExaminerEvaluationSessionResponse,
    ExaminerQuestionEvaluationItem,
    ExaminerFinalizeEvaluationRequest,
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
                published=result_obj.published,
                requires_evaluation=not result_obj.published,
                submitted_at=session_obj.submitted_at,
                generated_at=result_obj.generated_at,
            )
        )

    return items


@router.get(
    "/evaluations/{session_id}",
    response_model=ExaminerEvaluationSessionResponse,
    summary="Get candidate submission details for examiner manual grading"
)
async def get_evaluation_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """
    Returns complete exam paper, student answers, and expected rubrics
    for examiner manual review and scoring.
    """
    stmt = (
        select(ExamSession)
        .options(
            selectinload(ExamSession.exam)
            .selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options),
            selectinload(ExamSession.student),
            selectinload(ExamSession.result),
            selectinload(ExamSession.answers),
        )
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam session {session_id} not found."
        )

    exam = session.exam
    student = session.student
    result = session.result
    answers_by_qid = {ans.question_id: ans for ans in session.answers}

    q_items: List[ExaminerQuestionEvaluationItem] = []
    max_score = 0.0

    for eq in sorted(exam.exam_questions, key=lambda x: x.order):
        q = eq.question
        if not q:
            continue
        max_score += float(q.marks)
        ans = answers_by_qid.get(q.id)

        opts_data = None
        if q.options:
            opts_data = [
                {
                    "id": opt.id,
                    "option_text": opt.option_text,
                    "is_correct": opt.is_correct,
                }
                for opt in q.options
            ]

        q_items.append(
            ExaminerQuestionEvaluationItem(
                question_id=q.id,
                question_text=q.question_text,
                question_type=q.question_type.value if hasattr(q.question_type, "value") else str(q.question_type),
                difficulty=q.difficulty,
                marks=q.marks,
                student_answer_text=ans.answer_text if ans else None,
                student_selected_option_ids=ans.selected_option_ids if ans else None,
                student_image_url=ans.image_url if ans else None,
                ocr_extracted_text=ans.ocr_text if ans else None,
                options=opts_data,
                expected_answer=q.expected_answer,
                model_answer=q.model_answer,
                auto_score=ans.auto_score if ans else None,
                ai_score=ans.ai_score if ans else None,
                examiner_score=ans.examiner_score if ans else None,
                examiner_feedback=ans.examiner_feedback if ans else None,
            )
        )

    return ExaminerEvaluationSessionResponse(
        session_id=session.id,
        exam_id=exam.id,
        exam_title=exam.title,
        subject=exam.subject,
        duration_minutes=exam.duration,
        student_id=student.id,
        student_name=student.name,
        student_email=student.email,
        status=session.status.value if hasattr(session.status, "value") else str(session.status),
        published=result.published if result else False,
        submitted_at=session.submitted_at,
        total_score=result.total_score if result else 0.0,
        objective_score=result.objective_score if result else 0.0,
        subjective_score=result.subjective_score if result else 0.0,
        max_score=round(max_score, 2),
        questions=q_items,
    )


@router.post(
    "/evaluations/{session_id}/finalize",
    summary="Finalize candidate subjective evaluation and publish result"
)
async def finalize_evaluation(
    session_id: int,
    payload: ExaminerFinalizeEvaluationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """
    Submits manual marks awarded by examiner for subjective answers,
    updates totals, recalculates percentiles, sets published=True, and logs audit.
    """
    stmt = (
        select(ExamSession)
        .options(
            selectinload(ExamSession.exam)
            .selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question),
            selectinload(ExamSession.answers),
            selectinload(ExamSession.result),
            selectinload(ExamSession.student),
        )
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam session {session_id} not found."
        )

    questions_by_id = {eq.question.id: eq.question for eq in session.exam.exam_questions if eq.question}
    answers_by_qid = {ans.question_id: ans for ans in session.answers}
    now = datetime.now(timezone.utc)

    # Validate awarded marks
    for item in payload.evaluations:
        q = questions_by_id.get(item.question_id)
        if not q:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Question ID {item.question_id} does not belong to this exam."
            )
        if item.marks_awarded < 0 or item.marks_awarded > q.marks:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Marks awarded for Question {item.question_id} ({item.marks_awarded}) must be between 0 and {q.marks}."
            )

    # Apply manual scores & feedback
    for item in payload.evaluations:
        ans = answers_by_qid.get(item.question_id)
        if not ans:
            ans = Answer(
                session_id=session.id,
                question_id=item.question_id,
                submitted_at=now,
            )
            db.add(ans)
            answers_by_qid[item.question_id] = ans

        ans.examiner_score = round(item.marks_awarded, 2)
        if item.feedback is not None:
            ans.examiner_feedback = item.feedback

    # Recalculate total objective and subjective scores
    total_objective = 0.0
    total_subjective = 0.0

    for eq in session.exam.exam_questions:
        q = eq.question
        if not q:
            continue
        ans = answers_by_qid.get(q.id)
        if not ans:
            continue

        if q.question_type in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
            total_objective += (ans.auto_score or 0.0)
        else:
            if ans.examiner_score is not None:
                total_subjective += ans.examiner_score
            else:
                total_subjective += (ans.ai_score or 0.0)

    final_total = max(0.0, round(total_objective + total_subjective, 2))

    # Update or create Result
    if session.result:
        session.result.objective_score = round(total_objective, 2)
        session.result.subjective_score = round(total_subjective, 2)
        session.result.total_score = final_total
        session.result.published = payload.publish_result
    else:
        new_result = Result(
            session_id=session.id,
            total_score=final_total,
            objective_score=round(total_objective, 2),
            subjective_score=round(total_subjective_score, 2),
            published=payload.publish_result,
            generated_at=now,
        )
        db.add(new_result)
        session.result = new_result

    # Record AuditLog
    audit_entry = AuditLog(
        user_id=current_user.id,
        action="EVALUATION_FINALIZED",
        details=f"Evaluation finalized for session {session.id} (Candidate: {session.student.email}, Total: {final_total}) by {current_user.email}",
    )
    db.add(audit_entry)

    await db.commit()
    await db.refresh(session.result)

    # Recompute percentiles for all candidates in this exam
    from app.services.percentile_service import calculate_exam_percentiles
    try:
        await calculate_exam_percentiles(session.exam_id, db)
        await db.refresh(session.result)
    except Exception as pct_err:
        logger.error(f"Error calculating percentiles after evaluation: {pct_err}")

    return {
        "success": True,
        "session_id": session.id,
        "published": session.result.published,
        "total_score": session.result.total_score,
        "objective_score": session.result.objective_score,
        "subjective_score": session.result.subjective_score,
        "percentile": session.result.percentile,
        "message": "Evaluation successfully finalized and result published to candidate."
    }


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
