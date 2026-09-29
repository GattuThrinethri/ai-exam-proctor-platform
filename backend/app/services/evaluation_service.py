import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.exam import Exam, ExamQuestion
from app.models.question import QuestionBank, QuestionType
from app.models.session import ExamSession, SessionStatus
from app.models.answer import Answer
from app.models.result import Result
from app.services.objective_evaluator import evaluate_objective
from app.services.subjective_evaluator import evaluate_subjective

logger = logging.getLogger("evaluation_service")


async def evaluate_session(session_id: int, db: AsyncSession) -> Result:
    """
    Complete evaluation pipeline for an exam session.
    1. Prevents duplicate evaluation if Result already exists.
    2. Evaluates all objective questions (MCQ, multi_select, exact short_answer).
    3. Evaluates all subjective questions via LLM with deterministic heuristic fallback.
    4. Aggregates objective_score, subjective_score, and total_score.
    5. Saves Answer grades and persists Result record.
    """
    # 1. Check for existing result to guarantee idempotency
    existing_result_stmt = select(Result).where(Result.session_id == session_id)
    res = await db.execute(existing_result_stmt)
    existing_result = res.scalar_one_or_none()
    if existing_result:
        logger.info(f"Session {session_id} has already been evaluated. Returning existing result.")
        return existing_result

    # 2. Load session with complete exam hierarchy and submitted answers
    session_stmt = (
        select(ExamSession)
        .options(
            selectinload(ExamSession.exam)
            .selectinload(Exam.exam_questions)
            .selectinload(ExamQuestion.question)
            .selectinload(QuestionBank.options),
            selectinload(ExamSession.answers)
        )
        .where(ExamSession.id == session_id)
    )
    s_res = await db.execute(session_stmt)
    session = s_res.scalar_one_or_none()

    if not session:
        raise ValueError(f"ExamSession {session_id} not found")

    exam = session.exam
    if not exam:
        raise ValueError(f"Exam not attached to session {session_id}")

    negative_marking_enabled = exam.negative_marking_enabled
    answers_by_qid: Dict[int, Answer] = {ans.question_id: ans for ans in session.answers}

    total_objective_score = 0.0
    total_subjective_score = 0.0
    now = datetime.now(timezone.utc)

    # 3. Process every question assigned to the exam
    for eq in sorted(exam.exam_questions, key=lambda x: x.order):
        question = eq.question
        if not question:
            continue

        answer = answers_by_qid.get(question.id)

        # Handle MCQ and MULTI_SELECT
        if question.question_type in (QuestionType.MCQ, QuestionType.MULTI_SELECT):
            score, details = evaluate_objective(
                question=question,
                answer=answer,
                negative_marking_enabled=negative_marking_enabled
            )
            if answer:
                answer.auto_score = score
            else:
                # Record unanswered entry
                answer = Answer(
                    session_id=session.id,
                    question_id=question.id,
                    auto_score=0.0,
                    submitted_at=now
                )
                db.add(answer)
            total_objective_score += score

        # Handle SHORT_ANSWER (deterministic match first, then subjective)
        elif question.question_type == QuestionType.SHORT_ANSWER:
            obj_score, obj_details = evaluate_objective(
                question=question,
                answer=answer,
                negative_marking_enabled=False
            )
            if obj_details.get("is_correct") is True:
                if answer:
                    answer.auto_score = obj_score
                else:
                    answer = Answer(
                        session_id=session.id,
                        question_id=question.id,
                        auto_score=obj_score,
                        submitted_at=now
                    )
                    db.add(answer)
                total_objective_score += obj_score
            else:
                # Evaluate subjectively
                subj_score, justification, feedback = await evaluate_subjective(
                    question=question,
                    answer=answer
                )
                if answer:
                    answer.ai_score = subj_score
                    answer.ai_justification = justification
                    answer.ai_feedback = feedback
                else:
                    answer = Answer(
                        session_id=session.id,
                        question_id=question.id,
                        ai_score=0.0,
                        ai_justification=justification,
                        ai_feedback=feedback,
                        submitted_at=now
                    )
                    db.add(answer)
                total_subjective_score += subj_score

        # Handle LONG_ANSWER and IMAGE_UPLOAD
        elif question.question_type in (QuestionType.LONG_ANSWER, QuestionType.IMAGE_UPLOAD):
            subj_score, justification, feedback = await evaluate_subjective(
                question=question,
                answer=answer
            )
            if answer:
                answer.ai_score = subj_score
                answer.ai_justification = justification
                answer.ai_feedback = feedback
            else:
                answer = Answer(
                    session_id=session.id,
                    question_id=question.id,
                    ai_score=0.0,
                    ai_justification=justification,
                    ai_feedback=feedback,
                    submitted_at=now
                )
                db.add(answer)
            total_subjective_score += subj_score

    # 4. Total aggregate score (bounded to not drop below 0 if negative marking was heavy)
    total_calculated = round(total_objective_score + total_subjective_score, 2)
    final_total_score = max(0.0, total_calculated)

    # All submitted exams start with published=False until examiner evaluates and finalizes/publishes
    is_published = False

    # 5. Persist Result
    result = Result(
        session_id=session.id,
        total_score=final_total_score,
        objective_score=round(total_objective_score, 2),
        subjective_score=round(total_subjective_score, 2),
        published=is_published,
        generated_at=now
    )
    db.add(result)
    await db.commit()
    await db.refresh(result)

    # Calculate authoritative percentile ranks for all candidates in this exam
    from app.services.percentile_service import calculate_exam_percentiles
    try:
        await calculate_exam_percentiles(exam.id, db)
        await db.refresh(result)
    except Exception as pct_err:
        logger.error(f"Error calculating percentiles for exam {exam.id}: {pct_err}")

    logger.info(
        f"Evaluation completed for Session {session.id}: "
        f"Objective={result.objective_score}, Subjective={result.subjective_score}, Total={result.total_score}, Percentile={result.percentile}"
    )
    return result
