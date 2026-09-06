import hashlib
import random
from typing import List, Sequence
from app.models.exam import Exam
from app.models.question import QuestionBank
from app.schemas.session import StudentQuestionResponse, StudentOptionResponse

def get_deterministic_seed(student_id: int, exam_id: int) -> int:
    """Derive a reproducible integer seed from student_id and exam_id."""
    seed_str = f"{student_id}:{exam_id}"
    return int(hashlib.sha256(seed_str.encode("utf-8")).hexdigest()[:12], 16)

def generate_student_paper(
    exam: Exam,
    questions: Sequence[QuestionBank],
    student_id: int,
) -> List[StudentQuestionResponse]:
    """
    Generate a sanitized, student-safe question paper.
    If randomization_enabled is True, question and option orders are deterministically
    shuffled based on (student_id + exam_id).
    Strictly removes all answer keys and model answers.
    """
    question_list = list(questions)

    if exam.randomization_enabled:
        seed = get_deterministic_seed(student_id, exam.id)
        rng = random.Random(seed)
        # Deterministically shuffle questions
        question_list = rng.sample(question_list, len(question_list))

    student_questions: List[StudentQuestionResponse] = []

    for q in question_list:
        options = list(q.options) if q.options else []
        if exam.randomization_enabled and options:
            # Deterministically shuffle options using question-specific sub-seed
            q_seed = get_deterministic_seed(student_id, q.id)
            opt_rng = random.Random(q_seed)
            options = opt_rng.sample(options, len(options))

        safe_options = [
            StudentOptionResponse(
                id=opt.id,
                option_text=opt.option_text,
            )
            for opt in options
        ]

        safe_q = StudentQuestionResponse(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type,
            difficulty=q.difficulty,
            marks=q.marks,
            options=safe_options,
            image_url=q.image_url,
        )
        student_questions.append(safe_q)

    return student_questions
