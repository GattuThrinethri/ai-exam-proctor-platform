import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.session import ExamSession
from app.models.answer import Answer
from app.schemas.answer import (
    AnswerSubmitRequest,
    AnswerUpdateRequest,
    StudentAnswerResponse,
    ImageUploadResponse
)
from app.services.answer_service import (
    save_or_update_answer,
    save_uploaded_image_answer,
    validate_session_for_answer
)

logger = logging.getLogger("answers_router")

router = APIRouter(prefix="/exam-sessions", tags=["answers"])


@router.post(
    "/{session_id}/answers",
    response_model=StudentAnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Submit or save an answer for a question in an active exam session"
)
async def submit_answer(
    session_id: int,
    payload: AnswerSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submits or updates a question answer for an active exam session.
    Protects question marks and answers from client-side tampering.
    """
    answer = await save_or_update_answer(
        session_id=session_id,
        current_user=current_user,
        question_id=payload.question_id,
        selected_option_ids=payload.selected_option_ids,
        answer_text=payload.answer_text,
        image_url=payload.image_url,
        db=db
    )
    return answer


@router.put(
    "/{session_id}/answers/{question_id}",
    response_model=StudentAnswerResponse,
    status_code=status.HTTP_200_OK,
    summary="Update an existing answer for a question in an active exam session"
)
async def update_answer(
    session_id: int,
    question_id: int,
    payload: AnswerUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates an existing answer for the specified question in an active exam session.
    """
    answer = await save_or_update_answer(
        session_id=session_id,
        current_user=current_user,
        question_id=question_id,
        selected_option_ids=payload.selected_option_ids,
        answer_text=payload.answer_text,
        image_url=payload.image_url,
        db=db
    )
    return answer


@router.get(
    "/{session_id}/answers",
    response_model=List[StudentAnswerResponse],
    summary="Retrieve all answers submitted by the student for an exam session"
)
async def get_session_answers(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns all answers currently saved for this session.
    Students can only access answers for their own sessions.
    """
    stmt = select(ExamSession).where(ExamSession.id == session_id)
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
            detail="You cannot access another student's exam answers"
        )

    ans_stmt = (
        select(Answer)
        .where(Answer.session_id == session_id)
        .order_by(Answer.id)
    )
    ans_res = await db.execute(ans_stmt)
    return ans_res.scalars().all()


@router.post(
    "/{session_id}/answers/{question_id}/image",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload image for handwritten answer with automatic OCR extraction"
)
async def upload_answer_image(
    session_id: int,
    question_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validates uploaded image file, stores it safely on disk, extracts OCR text,
    and associates the image with the student's answer.
    """
    file_bytes = await file.read()
    filename = file.filename or "upload.jpg"
    content_type = file.content_type

    answer, rel_url, ocr_text = await save_uploaded_image_answer(
        session_id=session_id,
        question_id=question_id,
        current_user=current_user,
        file_bytes=file_bytes,
        filename=filename,
        content_type=content_type,
        db=db
    )

    return ImageUploadResponse(
        image_url=rel_url,
        filename=filename,
        size_bytes=len(file_bytes),
        content_type=content_type or "application/octet-stream",
        ocr_text=ocr_text
    )
