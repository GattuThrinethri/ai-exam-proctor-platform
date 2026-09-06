import pytest
from app.models.question import QuestionBank, QuestionOption, QuestionType
from app.models.answer import Answer
from app.services.objective_evaluator import evaluate_objective, normalize_text

def build_mock_mcq(marks: float = 4.0, negative_marks: float = 1.0) -> QuestionBank:
    q = QuestionBank(
        id=1,
        subject="Physics",
        question_text="What is the unit of force?",
        question_type=QuestionType.MCQ,
        marks=marks,
        negative_marks=negative_marks,
    )
    opt1 = QuestionOption(id=101, question_id=1, option_text="Newton", is_correct=True)
    opt2 = QuestionOption(id=102, question_id=1, option_text="Joule", is_correct=False)
    opt3 = QuestionOption(id=103, question_id=1, option_text="Watt", is_correct=False)
    q.options = [opt1, opt2, opt3]
    return q

def build_mock_multi_select(marks: float = 5.0, negative_marks: float = 2.0) -> QuestionBank:
    q = QuestionBank(
        id=2,
        subject="Chemistry",
        question_text="Which are noble gases?",
        question_type=QuestionType.MULTI_SELECT,
        marks=marks,
        negative_marks=negative_marks,
    )
    opt1 = QuestionOption(id=201, question_id=2, option_text="Helium", is_correct=True)
    opt2 = QuestionOption(id=202, question_id=2, option_text="Neon", is_correct=True)
    opt3 = QuestionOption(id=203, question_id=2, option_text="Argon", is_correct=True)
    opt4 = QuestionOption(id=204, question_id=2, option_text="Oxygen", is_correct=False)
    q.options = [opt1, opt2, opt3, opt4]
    return q

def build_mock_short_answer(marks: float = 3.0) -> QuestionBank:
    q = QuestionBank(
        id=3,
        subject="Biology",
        question_text="What is the powerhouse of the cell?",
        question_type=QuestionType.SHORT_ANSWER,
        marks=marks,
        negative_marks=0.0,
        expected_answer="Mitochondria",
        model_answer="The mitochondrion is the powerhouse of the cell."
    )
    q.options = []
    return q


def test_09_correct_mcq_receives_full_marks():
    """Test 9: Correct MCQ option earns +question.marks."""
    q = build_mock_mcq(marks=4.0, negative_marks=1.0)
    ans = Answer(session_id=1, question_id=1, selected_option_ids=[101])

    score, details = evaluate_objective(q, ans, negative_marking_enabled=True)
    assert score == 4.0
    assert details["is_correct"] is True
    assert details["status"] == "correct"


def test_10_incorrect_mcq_receives_negative_marks_when_enabled():
    """Test 10: Incorrect MCQ option receives -negative_marks when negative marking is on."""
    q = build_mock_mcq(marks=4.0, negative_marks=1.5)
    ans = Answer(session_id=1, question_id=1, selected_option_ids=[102])  # wrong option

    score, details = evaluate_objective(q, ans, negative_marking_enabled=True)
    assert score == -1.5
    assert details["is_correct"] is False
    assert details["penalty"] == 1.5


def test_11_incorrect_mcq_receives_zero_when_negative_marking_disabled():
    """Test 11: Incorrect MCQ option receives 0.0 when negative marking is off."""
    q = build_mock_mcq(marks=4.0, negative_marks=1.5)
    ans = Answer(session_id=1, question_id=1, selected_option_ids=[102])  # wrong option

    score, details = evaluate_objective(q, ans, negative_marking_enabled=False)
    assert score == 0.0
    assert details["is_correct"] is False
    assert details["penalty"] == 0.0


def test_12_unanswered_question_receives_zero():
    """Test 12: Unanswered objective question receives 0.0 without penalty."""
    q = build_mock_mcq(marks=4.0, negative_marks=1.5)

    # None answer
    score, details = evaluate_objective(q, None, negative_marking_enabled=True)
    assert score == 0.0
    assert details["status"] == "unanswered"

    # Empty selected_option_ids
    empty_ans = Answer(session_id=1, question_id=1, selected_option_ids=[])
    score2, details2 = evaluate_objective(q, empty_ans, negative_marking_enabled=True)
    assert score2 == 0.0
    assert details2["status"] == "unanswered"


def test_13_multi_select_exact_match_is_correct():
    """Test 13: Multi-select exact set match earns full marks."""
    q = build_mock_multi_select(marks=5.0, negative_marks=2.0)
    ans = Answer(session_id=1, question_id=2, selected_option_ids=[201, 202, 203])

    score, details = evaluate_objective(q, ans, negative_marking_enabled=True)
    assert score == 5.0
    assert details["is_correct"] is True


def test_14_multi_select_partial_or_wrong_selection_is_handled():
    """Test 14: Partial or wrong multi-select selection is penalized if enabled, or 0 if disabled."""
    q = build_mock_multi_select(marks=5.0, negative_marks=2.0)

    # Partial selection (missing 203) with negative marking enabled
    ans_partial = Answer(session_id=1, question_id=2, selected_option_ids=[201, 202])
    score_p, details_p = evaluate_objective(q, ans_partial, negative_marking_enabled=True)
    assert score_p == -2.0
    assert details_p["is_correct"] is False

    # Selection including an incorrect option (204) with negative marking disabled
    ans_wrong = Answer(session_id=1, question_id=2, selected_option_ids=[201, 202, 204])
    score_w, details_w = evaluate_objective(q, ans_wrong, negative_marking_enabled=False)
    assert score_w == 0.0
    assert details_w["is_correct"] is False


def test_15_duplicate_selections_cannot_manipulate_score():
    """Test 15: Duplicate option IDs in multi-select do not artificially alter evaluation."""
    q = build_mock_multi_select(marks=5.0, negative_marks=2.0)

    # Duplicate IDs for exact set
    ans_dupes = Answer(session_id=1, question_id=2, selected_option_ids=[201, 201, 202, 203, 203])
    score, details = evaluate_objective(q, ans_dupes, negative_marking_enabled=True)
    assert score == 5.0
    assert details["is_correct"] is True


def test_16_short_answer_matching_works():
    """Test 16: Deterministic normalized matching for short answers."""
    q = build_mock_short_answer(marks=3.0)

    # Case insensitive, punctuation stripped match
    ans_match = Answer(session_id=1, question_id=3, answer_text="  mitochondria!  ")
    score, details = evaluate_objective(q, ans_match)
    assert score == 3.0
    assert details["is_correct"] is True

    # Non-matching short answer indicates subjective evaluation required
    ans_nomatch = Answer(session_id=1, question_id=3, answer_text="It is an organelle generating ATP.")
    score_nm, details_nm = evaluate_objective(q, ans_nomatch)
    assert details_nm["requires_subjective"] is True
