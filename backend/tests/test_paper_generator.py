import pytest
from datetime import datetime, timezone
from app.models.exam import Exam
from app.models.question import QuestionBank, QuestionOption, QuestionType
from app.services.paper_generator import generate_student_paper

def create_mock_exam_and_questions():
    """Create in-memory exam and question objects for randomization verification."""
    now = datetime.now(timezone.utc)
    exam = Exam(
        id=101,
        title="Test Randomization Exam",
        subject="Computer Science",
        duration=60,
        question_count=4,
        start_time=now,
        end_time=now,
        randomization_enabled=True,
        negative_marking_enabled=False,
        proctoring_enabled=True,
        gaze_sensitivity="medium",
        max_tab_switch_warnings=3,
        created_by=1,
    )

    q1 = QuestionBank(
        id=1, subject="CS", question_text="Question One", question_type=QuestionType.MCQ,
        difficulty="easy", marks=2.0, model_answer="Secret Model 1", expected_answer="Expected 1",
        created_by=1
    )
    q1.options = [
        QuestionOption(id=11, question_id=1, option_text="Opt 1A", is_correct=False),
        QuestionOption(id=12, question_id=1, option_text="Opt 1B", is_correct=True),
        QuestionOption(id=13, question_id=1, option_text="Opt 1C", is_correct=False),
    ]

    q2 = QuestionBank(
        id=2, subject="CS", question_text="Question Two", question_type=QuestionType.MCQ,
        difficulty="medium", marks=3.0, model_answer="Secret Model 2", expected_answer="Expected 2",
        created_by=1
    )
    q2.options = [
        QuestionOption(id=21, question_id=2, option_text="Opt 2A", is_correct=True),
        QuestionOption(id=22, question_id=2, option_text="Opt 2B", is_correct=False),
    ]

    q3 = QuestionBank(
        id=3, subject="CS", question_text="Question Three", question_type=QuestionType.SHORT_ANSWER,
        difficulty="hard", marks=5.0, model_answer="Secret Model 3", expected_answer="Expected 3",
        created_by=1
    )
    q3.options = []

    q4 = QuestionBank(
        id=4, subject="CS", question_text="Question Four", question_type=QuestionType.LONG_ANSWER,
        difficulty="hard", marks=10.0, model_answer="Secret Model 4", expected_answer="Expected 4",
        created_by=1
    )
    q4.options = []

    return exam, [q1, q2, q3, q4]

def test_11_same_student_same_exam_produces_identical_paper():
    """Test deterministic randomization: same student and same exam yield identical question ordering."""
    exam, questions = create_mock_exam_and_questions()
    student_id = 42

    paper_run_1 = generate_student_paper(exam, questions, student_id)
    paper_run_2 = generate_student_paper(exam, questions, student_id)

    order_1 = [q.id for q in paper_run_1]
    order_2 = [q.id for q in paper_run_2]
    assert order_1 == order_2, "Deterministic paper generation must produce identical question order"

    # Option order must also be identical
    options_1 = [opt.id for q in paper_run_1 for opt in q.options]
    options_2 = [opt.id for q in paper_run_2 for opt in q.options]
    assert options_1 == options_2

def test_12_different_students_receive_different_order():
    """Test that two different students receive different question/option orderings."""
    exam, questions = create_mock_exam_and_questions()

    paper_student_a = generate_student_paper(exam, questions, student_id=1)
    paper_student_b = generate_student_paper(exam, questions, student_id=999)

    order_a = [q.id for q in paper_student_a]
    order_b = [q.id for q in paper_student_b]
    # In a 4-item list, at least one of question order or option order will differ across seeds
    opts_a = [opt.id for q in paper_student_a for opt in q.options]
    opts_b = [opt.id for q in paper_student_b for opt in q.options]

    assert (order_a != order_b) or (opts_a != opts_b), "Different students should receive randomized papers"

def test_13_student_paper_never_contains_correct_answers():
    """Verify is_correct is stripped from student paper."""
    exam, questions = create_mock_exam_and_questions()
    paper = generate_student_paper(exam, questions, student_id=5)

    for q in paper:
        for opt in q.options:
            opt_dict = opt.model_dump()
            assert "is_correct" not in opt_dict, "is_correct must never be exposed to students"

def test_14_student_paper_never_contains_model_answers():
    """Verify model_answer and expected_answer are stripped from student paper."""
    exam, questions = create_mock_exam_and_questions()
    paper = generate_student_paper(exam, questions, student_id=5)

    for q in paper:
        q_dict = q.model_dump()
        assert "model_answer" not in q_dict, "model_answer must never be exposed to students"
        assert "expected_answer" not in q_dict, "expected_answer must never be exposed to students"
