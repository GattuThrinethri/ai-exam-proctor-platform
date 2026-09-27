from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.question import QuestionBank, QuestionOption, QuestionType
from app.models.exam import ExamQuestion
from app.models.audit import AuditLog
from app.schemas.question import (
    QuestionCreate,
    QuestionUpdate,
    QuestionResponse,
    QuestionListResponse,
)
from app.schemas.question_import import (
    ImportPreviewResponse,
    ImportConfirmRequest,
    ImportConfirmResponse,
    ExtractedQuestion,
    ImportedOption,
)
from app.services.document_parser import document_parser
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

@router.post(
    "/import",
    response_model=ImportPreviewResponse,
    summary="Upload and parse document into preview questions"
)
async def import_questions_preview(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """
    Accepts an uploaded document (PDF, DOCX, PPTX, TXT, CSV, XLSX, Images),
    extracts candidate questions, detects question types, options, answers, marks, and subject,
    identifies possible duplicates against existing questions in the database,
    and returns a preview without saving to the database.
    """
    if not file.filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No file provided")

    file_bytes = await file.read()
    valid, err_msg, ext = document_parser.validate_file(file.filename, file_bytes, file.content_type)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    try:
        raw_text, tabular_records = document_parser.extract_raw_text(file_bytes, ext, file.filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process document: {str(e)}"
        )

    detected_subject = document_parser.detect_subject(raw_text, tabular_records)

    if tabular_records:
        questions = document_parser.parse_tabular_records(tabular_records, detected_subject)
    else:
        questions = document_parser.parse_text_into_questions(raw_text, detected_subject)

    if not questions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No questions could be extracted from the uploaded document. Please check the format."
        )

    # Duplicate detection against existing questions in DB
    existing_stmt = select(QuestionBank.id, QuestionBank.question_text)
    existing_res = await db.execute(existing_stmt)
    existing_questions = [(row[0], row[1]) for row in existing_res.all()]
    dup_count = document_parser.detect_duplicates(questions, existing_questions)

    return ImportPreviewResponse(
        filename=file.filename,
        file_type=ext.lstrip("."),
        file_size=len(file_bytes),
        detected_subject=detected_subject,
        total_extracted=len(questions),
        duplicate_count=dup_count,
        questions=questions,
    )

@router.post(
    "/import/confirm",
    response_model=ImportConfirmResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Confirm and insert approved questions into Question Bank"
)
async def confirm_import_questions(
    request: Request,
    import_req: ImportConfirmRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.EXAMINER, UserRole.ADMIN)),
):
    """
    Inserts examiner-selected and edited questions into the QuestionBank and QuestionOption tables.
    Logs an audit event and commits in a single transaction.
    """
    if not import_req.questions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions selected for import.")

    created_ids: List[int] = []
    skipped_count = 0

    for item in import_req.questions:
        q_text = item.question_text.strip()
        if not q_text:
            skipped_count += 1
            continue

        subj = (item.subject or import_req.default_subject or "General").strip()
        diff = (item.difficulty or "medium").strip().lower()
        if diff not in ("easy", "medium", "hard"):
            diff = "medium"

        # Normalize question type
        raw_type = item.question_type.upper() if item.question_type else "MCQ"
        if "MCQ" in raw_type or "TRUE" in raw_type:
            q_type = QuestionType.MCQ
        elif "MULTI" in raw_type:
            q_type = QuestionType.MULTI_SELECT
        elif "SHORT" in raw_type:
            q_type = QuestionType.SHORT_ANSWER
        elif "LONG" in raw_type or "DESCRIPTIVE" in raw_type:
            q_type = QuestionType.LONG_ANSWER
        elif "IMAGE" in raw_type:
            q_type = QuestionType.IMAGE_UPLOAD
        else:
            q_type = QuestionType.MCQ if (item.options and len(item.options) >= 2) else QuestionType.SHORT_ANSWER

        question = QuestionBank(
            subject=subj,
            question_text=q_text,
            question_type=q_type,
            difficulty=diff,
            marks=max(0.5, float(item.marks or 1.0)),
            negative_marks=max(0.0, float(item.negative_marks or 0.0)),
            model_answer=item.model_answer.strip() if item.model_answer else None,
            expected_answer=item.expected_answer.strip() if item.expected_answer else None,
            created_by=current_user.id,
        )
        db.add(question)
        await db.flush()

        if item.options and q_type in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
            for opt in item.options:
                opt_text = opt.option_text.strip()
                if not opt_text:
                    continue
                db.add(QuestionOption(
                    question_id=question.id,
                    option_text=opt_text,
                    is_correct=bool(opt.is_correct),
                ))

        created_ids.append(question.id)

    # Log audit entry
    audit = AuditLog(
        user_id=current_user.id,
        action="IMPORT_QUESTIONS",
        details=f"Bulk imported {len(created_ids)} questions into Question Bank. Subject: {import_req.default_subject or 'Various'}.",
        ip_address=request.client.host if request.client else None
    )
    db.add(audit)
    await db.commit()

    return ImportConfirmResponse(
        imported_count=len(created_ids),
        skipped_count=skipped_count,
        question_ids=created_ids
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
