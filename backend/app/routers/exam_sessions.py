import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.exam import Exam, ExamQuestion
from app.models.question import QuestionBank
from app.models.session import ExamSession, SessionStatus
from app.schemas.session import (
    ExamEnterRequest,
    ExamSessionResponse,
    StudentExamPaperResponse,
)
from app.auth.dependencies import get_current_user
from app.auth.security import decode_exam_access_token
from app.services.paper_generator import generate_student_paper
from app.services.timer_service import calculate_remaining_seconds, is_session_expired

router = APIRouter(prefix="/exam-sessions", tags=["Exam Sessions"])

@router.post(
    "/enter",
    response_model=ExamSessionResponse,
    status_code=status.HTTP_200_OK,
    summary="Enter exam and initialize or resume student exam session"
)
async def enter_exam(
    enter_in: ExamEnterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate exam window, authenticate student, check for existing sessions,
    and create or resume the single active exam session.
    """
    now = datetime.now(timezone.utc)

    # 1. Validate Exam exists
    stmt_exam = select(Exam).where(Exam.id == enter_in.exam_id)
    res_exam = await db.execute(stmt_exam)
    exam = res_exam.scalar_one_or_none()
    if not exam:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam with ID {enter_in.exam_id} not found"
        )

    # 2. Validate token if supplied
    if enter_in.exam_token:
        try:
            token_payload = decode_exam_access_token(enter_in.exam_token)
            token_student_id = int(token_payload["sub"])
            token_exam_id = int(token_payload["exam_id"])

            if token_exam_id != exam.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Exam token does not match this exam"
                )
            if token_student_id != current_user.id and current_user.role == UserRole.STUDENT:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Exam token belongs to a different student"
                )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid exam token: {e}"
            )

    # 3. Authoritative server-side window validation
    if now < exam.start_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam has not started yet."
        )
    if now > exam.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam window has expired."
        )

    # 4. Check for existing session (Single Active Session rule)
    stmt_sess = select(ExamSession).where(
        ExamSession.exam_id == exam.id,
        ExamSession.student_id == current_user.id
    )
    res_sess = await db.execute(stmt_sess)
    existing_session = res_sess.scalar_one_or_none()

    if existing_session:
        # Check if already submitted or timed out
        if existing_session.status in (SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This exam has already been completed or submitted."
            )

        # Check server timer on active session
        rem_seconds = calculate_remaining_seconds(existing_session, exam.duration, now)
        if rem_seconds <= 0:
            existing_session.status = SessionStatus.TIMED_OUT
            existing_session.submitted_at = now
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exam session duration has expired."
            )

        # Safely resume active session
        return ExamSessionResponse(
            id=existing_session.id,
            exam_id=existing_session.exam_id,
            student_id=existing_session.student_id,
            session_token=existing_session.session_token,
            started_at=existing_session.started_at,
            submitted_at=existing_session.submitted_at,
            status=existing_session.status,
            duration_minutes=exam.duration,
            server_time=now,
            remaining_seconds=rem_seconds,
            is_timed_out=False,
        )

    # 5. Create new ExamSession
    new_session = ExamSession(
        exam_id=exam.id,
        student_id=current_user.id,
        session_token=uuid.uuid4().hex,
        started_at=now,
        status=SessionStatus.IN_PROGRESS,
        suspicion_score=0,
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)

    rem_seconds = calculate_remaining_seconds(new_session, exam.duration, now)
    return ExamSessionResponse(
        id=new_session.id,
        exam_id=new_session.exam_id,
        student_id=new_session.student_id,
        session_token=new_session.session_token,
        started_at=new_session.started_at,
        submitted_at=new_session.submitted_at,
        status=new_session.status,
        duration_minutes=exam.duration,
        server_time=now,
        remaining_seconds=rem_seconds,
        is_timed_out=False,
    )

@router.get(
    "/{session_id}",
    response_model=ExamSessionResponse,
    summary="Get exam session status and server-authoritative remaining time"
)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve session state with server-authoritative timer calculation."""
    stmt = (
        select(ExamSession)
        .options(selectinload(ExamSession.exam))
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam session with ID {session_id} not found"
        )

    if current_user.role == UserRole.STUDENT and session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access another student's exam session"
        )

    now = datetime.now(timezone.utc)
    duration = session.exam.duration if session.exam else 60
    rem_seconds = calculate_remaining_seconds(session, duration, now)

    # Check for timeout transition
    if rem_seconds <= 0 and session.status == SessionStatus.IN_PROGRESS:
        session.status = SessionStatus.TIMED_OUT
        session.submitted_at = now
        await db.commit()
        from app.services.evaluation_service import evaluate_session
        try:
            await evaluate_session(session.id, db)
        except Exception as eval_err:
            logger.error(f"Error evaluating timed-out session {session.id}: {eval_err}")

    return ExamSessionResponse(
        id=session.id,
        exam_id=session.exam_id,
        student_id=session.student_id,
        session_token=session.session_token,
        started_at=session.started_at,
        submitted_at=session.submitted_at,
        status=session.status,
        duration_minutes=duration,
        server_time=now,
        remaining_seconds=rem_seconds,
        is_timed_out=(session.status == SessionStatus.TIMED_OUT),
    )

@router.get(
    "/{session_id}/paper",
    response_model=StudentExamPaperResponse,
    summary="Get sanitized, student-safe randomized exam paper"
)
async def get_exam_paper(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate and return sanitized question paper.
    Excludes model answers and correct option indicators.
    """
    stmt = (
        select(ExamSession)
        .options(
            selectinload(ExamSession.exam)
            .selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options)
        )
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )

    if current_user.role == UserRole.STUDENT and session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access another student's exam paper"
        )

    now = datetime.now(timezone.utc)
    duration = session.exam.duration
    rem_seconds = calculate_remaining_seconds(session, duration, now)

    if rem_seconds <= 0 and session.status == SessionStatus.IN_PROGRESS:
        session.status = SessionStatus.TIMED_OUT
        session.submitted_at = now
        await db.commit()
        from app.services.evaluation_service import evaluate_session
        try:
            await evaluate_session(session.id, db)
        except Exception as eval_err:
            logger.error(f"Error evaluating timed-out session {session.id}: {eval_err}")

    if session.status in (SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Exam session is {session.status.value}. Paper cannot be accessed."
        )

    # Extract questions ordered by exam_questions
    raw_questions = [
        eq.question
        for eq in sorted(session.exam.exam_questions, key=lambda x: x.order)
        if eq.question
    ]

    # Generate deterministic randomized student paper
    safe_questions = generate_student_paper(
        exam=session.exam,
        questions=raw_questions,
        student_id=session.student_id,
    )

    return StudentExamPaperResponse(
        session_id=session.id,
        exam_id=session.exam.id,
        title=session.exam.title,
        subject=session.exam.subject,
        description=session.exam.description,
        duration_minutes=duration,
        started_at=session.started_at,
        server_time=now,
        remaining_seconds=rem_seconds,
        proctoring_enabled=session.exam.proctoring_enabled,
        questions=safe_questions,
    )

@router.post(
    "/{session_id}/start",
    response_model=ExamSessionResponse,
    summary="Confirm session start"
)
async def start_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve session status upon exam start."""
    return await get_session(session_id, db, current_user)

@router.post(
    "/{session_id}/submit",
    response_model=ExamSessionResponse,
    summary="Final submission of exam session"
)
async def submit_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Finalize student exam submission. Disallows further updates."""
    stmt = (
        select(ExamSession)
        .options(selectinload(ExamSession.exam))
        .where(ExamSession.id == session_id)
    )
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session with ID {session_id} not found"
        )

    if current_user.role == UserRole.STUDENT and session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot submit another student's exam session"
        )

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit session: status is already '{session.status.value}'"
        )

    now = datetime.now(timezone.utc)
    session.status = SessionStatus.SUBMITTED
    session.submitted_at = now
    await db.commit()

    # Trigger evaluation pipeline to compute objective and subjective scores
    from app.services.evaluation_service import evaluate_session
    try:
        await evaluate_session(session.id, db)
    except Exception as eval_err:
        logger.error(f"Error evaluating session {session.id} upon submission: {eval_err}")

    duration = session.exam.duration if session.exam else 60
    return ExamSessionResponse(
        id=session.id,
        exam_id=session.exam_id,
        student_id=session.student_id,
        session_token=session.session_token,
        started_at=session.started_at,
        submitted_at=session.submitted_at,
        status=session.status,
        duration_minutes=duration,
        server_time=now,
        remaining_seconds=0,
        is_timed_out=False,
    )
