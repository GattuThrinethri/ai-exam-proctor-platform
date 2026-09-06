import re
import logging
from typing import Optional, Tuple, Dict, Any, List, Set
from app.models.question import QuestionBank, QuestionType
from app.models.answer import Answer

logger = logging.getLogger("objective_evaluator")

def normalize_text(text: Optional[str]) -> str:
    """Normalize text for deterministic matching by lowercasing, stripping punctuation, and collapsing whitespace."""
    if not text:
        return ""
    # Strip punctuation, lowercase, collapse whitespace
    cleaned = re.sub(r"[^\w\s]", " ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()

def evaluate_objective(
    question: QuestionBank,
    answer: Optional[Answer],
    negative_marking_enabled: bool = False,
) -> Tuple[float, Dict[str, Any]]:
    """
    Evaluates an objective question (MCQ, multi_select, or exact-match short_answer).
    
    Returns:
        (score: float, details: dict)
        
    Scoring rules:
    - MCQ:
      - Correct: +question.marks
      - Incorrect: -question.negative_marks if negative_marking_enabled else 0.0
      - Unanswered: 0.0
    - MULTI_SELECT:
      - Correct: +question.marks ONLY when set(selected) == set(correct)
      - Incorrect: -question.negative_marks if negative_marking_enabled else 0.0
      - Unanswered: 0.0
    - SHORT_ANSWER:
      - Deterministic exact normalized match: +question.marks
      - Otherwise: handled by subjective evaluation pipeline.
    """
    marks = float(question.marks)
    negative_marks = float(question.negative_marks) if negative_marking_enabled else 0.0

    # 1. Check if unanswered
    if answer is None:
        return 0.0, {
            "status": "unanswered",
            "is_correct": False,
            "earned_score": 0.0,
            "max_marks": marks,
        }

    # 2. MCQ Evaluation
    if question.question_type == QuestionType.MCQ:
        selected = answer.selected_option_ids or []
        if not selected:
            return 0.0, {
                "status": "unanswered",
                "is_correct": False,
                "earned_score": 0.0,
                "max_marks": marks,
            }
        
        # Authoritative correct option from DB
        correct_opt = next((opt for opt in question.options if opt.is_correct), None)
        if correct_opt is None:
            logger.error(f"Question ID {question.id} has no correct option configured.")
            return 0.0, {"status": "error", "message": "No correct option configured"}

        user_choice = selected[0]
        if user_choice == correct_opt.id:
            return marks, {
                "status": "correct",
                "is_correct": True,
                "earned_score": marks,
                "max_marks": marks,
            }
        else:
            penalty = -negative_marks if negative_marking_enabled else 0.0
            return penalty, {
                "status": "incorrect",
                "is_correct": False,
                "earned_score": penalty,
                "penalty": negative_marks if negative_marking_enabled else 0.0,
                "max_marks": marks,
            }

    # 3. MULTI_SELECT Evaluation
    elif question.question_type == QuestionType.MULTI_SELECT:
        selected_raw = answer.selected_option_ids or []
        # Deduplicate option IDs so duplicates cannot manipulate score
        selected_set: Set[int] = set(selected_raw)

        if not selected_set:
            return 0.0, {
                "status": "unanswered",
                "is_correct": False,
                "earned_score": 0.0,
                "max_marks": marks,
            }

        correct_set: Set[int] = {opt.id for opt in question.options if opt.is_correct}

        # Exact match required
        if selected_set == correct_set:
            return marks, {
                "status": "correct",
                "is_correct": True,
                "earned_score": marks,
                "max_marks": marks,
            }
        else:
            penalty = -negative_marks if negative_marking_enabled else 0.0
            return penalty, {
                "status": "incorrect",
                "is_correct": False,
                "earned_score": penalty,
                "penalty": negative_marks if negative_marking_enabled else 0.0,
                "max_marks": marks,
            }

    # 4. SHORT_ANSWER (Deterministic exact match if expected_answer is defined)
    elif question.question_type == QuestionType.SHORT_ANSWER:
        student_text = answer.answer_text or ""
        norm_student = normalize_text(student_text)

        if not norm_student:
            return 0.0, {
                "status": "unanswered",
                "is_correct": False,
                "earned_score": 0.0,
                "max_marks": marks,
            }

        # Check against expected_answer and model_answer
        targets = []
        if question.expected_answer:
            targets.append(normalize_text(question.expected_answer))
        if question.model_answer:
            targets.append(normalize_text(question.model_answer))

        if any(norm_student == target for target in targets if target):
            return marks, {
                "status": "correct",
                "is_correct": True,
                "earned_score": marks,
                "max_marks": marks,
                "method": "exact_normalized_match"
            }

        # Not an exact match: returns None as score indicator to signal subjective evaluator
        return 0.0, {
            "status": "non_exact",
            "is_correct": False,
            "requires_subjective": True,
            "max_marks": marks,
        }

    return 0.0, {"status": "unsupported_question_type", "is_correct": False}
