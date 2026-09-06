from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.question import QuestionBank, QuestionOption, QuestionType
from app.models.exam import ExamQuestion
from app.schemas.question import (
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionListResponse,
)
from app.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/questions", tags=["Question Bank"])

@router.post(
    "",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new question in the question bank"
)
async def create_question(
    question_in: QuestionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Create a new question. Accessible only by Examiners and Admins."""
    question = QuestionBank(
        subject=question_in.subject.strip(),
        question_text=question_in.question_text.strip(),
        question_type=question_in.question_type,
        difficulty=question_in.difficulty.strip().lower(),
        marks=question_in.marks,
        negative_marks=question_in.negative_marks,
        model_answer=question_in.model_answer.strip() if question_in.model_answer else None,
        expected_answer=question_in.expected_answer.strip() if question_in.expected_answer else None,
        image_url=question_in.image_url.strip() if question_in.image_url else None,
        created_by=current_user.id,
    )
    db.add(question)
    await db.flush()  # Flush to obtain question.id

    if question_in.options and question_in.question_type in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
        for opt_in in question_in.options:
            option = QuestionOption(
                question_id=question.id,
                option_text=opt_in.option_text.strip(),
                is_correct=opt_in.is_correct,
            )
            db.add(option)

    await db.commit()

    # Re-fetch with options eager-loaded
    stmt = (
        select(QuestionBank)
        .options(selectinload(QuestionBank.options))
        .where(QuestionBank.id == question.id)
    )
    res = await db.execute(stmt)
    created_question = res.scalar_one()
    return created_question

@router.get(
    "",
    response_model=QuestionListResponse,
    summary="List questions with optional subject, difficulty, and type filters"
)
async def list_questions(
    subject: Optional[str] = Query(None, description="Filter by subject"),
    difficulty: Optional[str] = Query(None, description="Filter by difficulty (easy, medium, hard)"),
    question_type: Optional[QuestionType] = Query(None, description="Filter by question type"),
    skip: int = Query(0, ge=0, description="Items to skip for pagination"),
    limit: int = Query(50, ge=1, le=100, description="Max items to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """List questions with combined filtering. Examiner/Admin role required."""
    query = select(QuestionBank)
    count_query = select(func.count(QuestionBank.id))

    if subject:
        query = query.where(func.lower(QuestionBank.subject) == subject.strip().lower())
        count_query = count_query.where(func.lower(QuestionBank.subject) == subject.strip().lower())

    if difficulty:
        query = query.where(func.lower(QuestionBank.difficulty) == difficulty.strip().lower())
        count_query = count_query.where(func.lower(QuestionBank.difficulty) == difficulty.strip().lower())

    if question_type:
        query = query.where(QuestionBank.question_type == question_type)
        count_query = count_query.where(QuestionBank.question_type == question_type)

    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = (
        query
        .options(selectinload(QuestionBank.options))
        .order_by(QuestionBank.id.desc())
        .offset(skip)
        .limit(limit)
    )
    items_res = await db.execute(query)
    items = items_res.scalars().all()

    return QuestionListResponse(
        total=total,
        items=list(items),
        skip=skip,
        limit=limit,
    )

@router.get(
    "/{question_id}",
    response_model=QuestionResponse,
    summary="Retrieve a specific question by ID"
)
async def get_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Get question details including options and model answers."""
    stmt = (
        select(QuestionBank)
        .options(selectinload(QuestionBank.options))
        .where(QuestionBank.id == question_id)
    )
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question with ID {question_id} not found"
        )
    return question

@router.put(
    "/{question_id}",
    response_model=QuestionResponse,
    summary="Update an existing question"
)
async def update_question(
    question_id: int,
    question_in: QuestionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Update a question and optionally its options."""
    stmt = (
        select(QuestionBank)
        .options(selectinload(QuestionBank.options))
        .where(QuestionBank.id == question_id)
    )
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question with ID {question_id} not found"
        )

    # Determine resulting question_type
    target_q_type = question_in.question_type if question_in.question_type is not None else question.question_type

    # Update simple fields
    if question_in.subject is not None:
        question.subject = question_in.subject.strip()
    if question_in.question_text is not None:
        question.question_text = question_in.question_text.strip()
    if question_in.difficulty is not None:
        question.difficulty = question_in.difficulty.strip().lower()
    if question_in.marks is not None:
        question.marks = question_in.marks
    if question_in.negative_marks is not None:
        question.negative_marks = question_in.negative_marks
    if question_in.model_answer is not None:
        question.model_answer = question_in.model_answer.strip()
    if question_in.expected_answer is not None:
        question.expected_answer = question_in.expected_answer.strip()
    if question_in.image_url is not None:
        question.image_url = question_in.image_url.strip()
    question.question_type = target_q_type

    # Handle options update
    if question_in.options is not None:
        # Clear existing options
        question.options.clear()
        await db.flush()

        if target_q_type in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
            # Validate options against rules
            opts = question_in.options
            if len(opts) < 2:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Objective questions must have at least 2 options"
                )
            seen = set()
            for o in opts:
                txt = o.option_text.strip().lower()
                if txt in seen:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Duplicate option text: '{o.option_text}'"
                    )
                seen.add(txt)

            correct_count = sum(1 for o in opts if o.is_correct)
            if target_q_type == QuestionType.MCQ and correct_count != 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"MCQ must have exactly 1 correct option (found {correct_count})"
                )
            elif target_q_type == QuestionType.MULTI_SELECT and correct_count < 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Multi-select must have at least 1 correct option"
                )

            for opt_in in opts:
                question.options.append(
                    QuestionOption(
                        option_text=opt_in.option_text.strip(),
                        is_correct=opt_in.is_correct,
                    )
                )
    elif target_q_type not in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
        # Switched to subjective or image question; clear options
        question.options.clear()

    await db.commit()

    # Re-fetch updated question
    stmt_updated = (
        select(QuestionBank)
        .execution_options(populate_existing=True)
        .options(selectinload(QuestionBank.options))
        .where(QuestionBank.id == question_id)
    )
    res_updated = await db.execute(stmt_updated)
    return res_updated.scalar_one()

@router.delete(
    "/{question_id}",
    summary="Delete a question from the question bank"
)
async def delete_question(
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """Delete question if not assigned to any existing exam."""
    stmt = select(QuestionBank).where(QuestionBank.id == question_id)
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()

    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Question with ID {question_id} not found"
        )

    # Check if question is referenced in any exam
    exam_ref_stmt = select(ExamQuestion).where(ExamQuestion.question_id == question_id)
    exam_ref_res = await db.execute(exam_ref_stmt)
    if exam_ref_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete question: it is currently assigned to one or more exams."
        )

    await db.delete(question)
    await db.commit()

    return {
        "message": "Question deleted successfully",
        "id": question_id
    }
