from datetime import datetime, timezone
import logging
from typing import Optional, List, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.user import User, UserRole
from app.models.exam import Exam, ExamQuestion
from app.models.question import QuestionBank, QuestionType
from app.models.session import ExamSession, SessionStatus
from app.models.answer import Answer
from app.services.timer_service import calculate_remaining_seconds
from app.services.ocr_service import (
    validate_image_file,
    save_uploaded_answer_image,
    get_ocr_service
)

logger = logging.getLogger("answer_service")


async def validate_session_for_answer(
    session_id: int,
    current_user: User,
    db: AsyncSession
) -> Tuple[ExamSession, Exam]:
    """
    Ensures that:
    1. Session exists.
    2. Session belongs to the current user (if student).
    3. Session is in IN_PROGRESS status.
    4. Session has not expired on the server clock.
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
            detail=f"Exam session with ID {session_id} not found"
        )

    # Ownership check
    if current_user.role == UserRole.STUDENT and session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot submit answers for another student's exam session"
        )

    # Status check
    if session.status in (SessionStatus.SUBMITTED, SessionStatus.TIMED_OUT):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit or modify answers for an exam session that is {session.status.value}"
        )

    # Server timer check
    now = datetime.now(timezone.utc)
    duration = session.exam.duration if session.exam else 60
    rem_seconds = calculate_remaining_seconds(session, duration, now)

    if rem_seconds <= 0:
        session.status = SessionStatus.TIMED_OUT
        session.submitted_at = now
        await db.commit()
        # Trigger evaluation on timeout
        from app.services.evaluation_service import evaluate_session
        await evaluate_session(session.id, db)

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exam time has expired. The session is now timed out."
        )

    return session, session.exam


async def save_or_update_answer(
    session_id: int,
    current_user: User,
    question_id: int,
    selected_option_ids: Optional[List[int]] = None,
    answer_text: Optional[str] = None,
    image_url: Optional[str] = None,
    db: AsyncSession = None
) -> Answer:
    """
    Validates, sanitizes, and persists an answer for a specific question within a session.
    Protects question authoritative fields against client tampering.
    """
    session, exam = await validate_session_for_answer(session_id, current_user, db)

    # Verify question is part of this exam
    eq_match = next((eq for eq in exam.exam_questions if eq.question_id == question_id), None)
    if not eq_match or not eq_match.question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Question ID {question_id} is not part of Exam {exam.id}"
        )

    question = eq_match.question
    valid_option_ids = {opt.id for opt in question.options}

    # Validate option selections
    sanitized_option_ids = None
    if selected_option_ids is not None:
        # Check invalid option IDs
        for opt_id in selected_option_ids:
            if opt_id not in valid_option_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Option ID {opt_id} is not valid for question {question_id}"
                )
        if question.question_type == QuestionType.MCQ:
            if len(selected_option_ids) > 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="MCQ questions accept only a single selected option"
                )
            sanitized_option_ids = selected_option_ids[:1]
        elif question.question_type == QuestionType.MULTI_SELECT:
            # Deduplicate preserves order
            sanitized_option_ids = list(dict.fromkeys(selected_option_ids))
        else:
            sanitized_option_ids = selected_option_ids

    # Calculate word count for text answers
    word_count = None
    if answer_text:
        word_count = len(answer_text.strip().split())

    # Find existing answer record
    stmt = select(Answer).where(
        Answer.session_id == session_id,
        Answer.question_id == question_id
    )
    res = await db.execute(stmt)
    existing_answer = res.scalar_one_or_none()

    now = datetime.now(timezone.utc)

    if existing_answer:
        if sanitized_option_ids is not None:
            existing_answer.selected_option_ids = sanitized_option_ids
        if answer_text is not None:
            existing_answer.answer_text = answer_text
            existing_answer.word_count = word_count
        if image_url is not None:
            existing_answer.image_url = image_url
        existing_answer.submitted_at = now
        answer_record = existing_answer
    else:
        answer_record = Answer(
            session_id=session_id,
            question_id=question_id,
            selected_option_ids=sanitized_option_ids,
            answer_text=answer_text,
            image_url=image_url,
            word_count=word_count,
            submitted_at=now,
        )
        db.add(answer_record)

    await db.commit()
    await db.refresh(answer_record)
    return answer_record


async def save_uploaded_image_answer(
    session_id: int,
    question_id: int,
    current_user: User,
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str],
    db: AsyncSession
) -> Tuple[Answer, str, str]:
    """
    Validates uploaded file, writes to disk, runs OCR extraction, and updates Answer.
    Returns: (Answer, relative_url, ocr_text)
    """
    session, exam = await validate_session_for_answer(session_id, current_user, db)

    # Verify question is part of exam
    eq_match = next((eq for eq in exam.exam_questions if eq.question_id == question_id), None)
    if not eq_match or not eq_match.question:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Question ID {question_id} is not part of Exam {exam.id}"
        )

    # Validate image
    is_valid, err_msg, ext = validate_image_file(file_bytes, filename, content_type)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_msg
        )

    # Save image to safe location
    abs_path, rel_url = save_uploaded_answer_image(file_bytes, session_id, question_id, ext)

    # Run OCR (safe fallback if tesseract not installed)
    ocr_service = get_ocr_service()
    extracted_text = ocr_service.extract_text(abs_path)

    # Persist in Answer record
    stmt = select(Answer).where(
        Answer.session_id == session_id,
        Answer.question_id == question_id
    )
    res = await db.execute(stmt)
    existing_answer = res.scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if existing_answer:
        existing_answer.image_url = rel_url
        existing_answer.ocr_text = extracted_text
        existing_answer.submitted_at = now
        answer_record = existing_answer
    else:
        answer_record = Answer(
            session_id=session_id,
            question_id=question_id,
            image_url=rel_url,
            ocr_text=extracted_text,
            submitted_at=now,
        )
        db.add(answer_record)

    await db.commit()
    await db.refresh(answer_record)
    return answer_record, rel_url, extracted_text
