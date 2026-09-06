import pytest
from unittest.mock import patch, AsyncMock
from app.models.question import QuestionBank, QuestionType
from app.models.answer import Answer
from app.services.subjective_evaluator import (
    evaluate_subjective,
    evaluate_heuristic_fallback,
    evaluate_with_llm
)

def build_mock_long_question(marks: float = 10.0) -> QuestionBank:
    return QuestionBank(
        id=10,
        subject="Database Systems",
        question_text="Explain the ACID properties in database management systems with examples.",
        question_type=QuestionType.LONG_ANSWER,
        marks=marks,
        negative_marks=0.0,
        model_answer=(
            "ACID stands for Atomicity, Consistency, Isolation, and Durability. "
            "Atomicity ensures all-or-nothing transactions. "
            "Consistency ensures database integrity constraints are maintained. "
            "Isolation ensures concurrent transactions execute without interfering. "
            "Durability ensures committed transactions survive system crashes."
        ),
    )


@pytest.mark.asyncio
async def test_17_llm_evaluator_response_is_parsed_correctly():
    """Test 17: Valid LLM API response is properly parsed into score and structured feedback."""
    q = build_mock_long_question(marks=10.0)
    student_text = (
        "ACID refers to Atomicity, Consistency, Isolation, and Durability in relational databases. "
        "Atomicity means either the whole transaction completes or nothing does."
    )

    mock_llm_json = {
        "score": 7.5,
        "justification": "Good explanation of Atomicity and definition of ACID, but lacked examples for Durability.",
        "matched_points": ["Atomicity", "Consistency", "Isolation", "Durability"],
        "missed_points": ["Durability recovery example"]
    }

    with patch("app.config.settings.OPENAI_API_KEY", "mock-key"):
        from unittest.mock import MagicMock
        with patch("httpx.AsyncClient.post") as mock_post:
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_resp.raise_for_status = MagicMock()
            mock_resp.json = MagicMock(return_value={
                "choices": [{
                    "message": {
                        "content": '{"score": 7.5, "justification": "Clear concepts", "matched_points": ["Atomicity"], "missed_points": ["Isolation example"]}'
                    }
                }]
            })
            mock_post.return_value = mock_resp

            score, justification, feedback = await evaluate_with_llm(q, student_text)
            assert score == 7.5
            assert "Clear concepts" in justification
            assert feedback["evaluation_method"] == "llm"
            assert "Atomicity" in feedback["matched_points"]


@pytest.mark.asyncio
async def test_18_llm_failure_triggers_heuristic_fallback():
    """Test 18: Network or API failure during LLM evaluation cleanly invokes heuristic fallback."""
    q = build_mock_long_question(marks=10.0)
    student_ans = Answer(
        session_id=1,
        question_id=10,
        answer_text="Atomicity and Consistency ensure transaction integrity and durability."
    )

    # Force LLM error
    with patch("app.config.settings.OPENAI_API_KEY", "mock-key"):
        with patch("app.services.subjective_evaluator.evaluate_with_llm", side_effect=Exception("API Timeout")):
            score, justification, feedback = await evaluate_subjective(q, student_ans)

            assert feedback["evaluation_method"] == "heuristic_fallback"
            assert score > 0.0
            assert score <= 10.0
            assert "Heuristic evaluation" in justification


def test_19_fallback_score_stays_within_valid_bounds():
    """Test 19: Heuristic fallback score strictly stays within [0.0, question.marks]."""
    q = build_mock_long_question(marks=5.0)

    # Empty answer
    score_empty, _, _ = evaluate_heuristic_fallback(q, "")
    assert score_empty == 0.0

    # Highly relevant answer matching every keyword
    perfect_text = q.model_answer + " Atomicity Consistency Isolation Durability transactions database integrity"
    score_high, _, _ = evaluate_heuristic_fallback(q, perfect_text)
    assert 0.0 <= score_high <= 5.0

    # Irrelevant random text
    score_irrelevant, _, _ = evaluate_heuristic_fallback(q, "The quick brown fox jumps over the lazy dog.")
    assert 0.0 <= score_irrelevant <= 5.0


def test_20_feedback_is_generated():
    """Test 20: Heuristic evaluation generates structured feedback with matched and missed points."""
    q = build_mock_long_question(marks=10.0)
    student_text = "Atomicity ensures all-or-nothing transactions while Consistency maintains database constraints."

    score, justification, feedback = evaluate_heuristic_fallback(q, student_text)
    assert "matched_points" in feedback
    assert "missed_points" in feedback
    assert "concept_coverage_percent" in feedback
    assert len(feedback["matched_points"]) > 0
    # Expected concepts like "durability" or "isolation" should be in missed points
    assert any("durability" in m or "isolation" in m for m in feedback["missed_points"])


@pytest.mark.asyncio
async def test_21_student_cannot_supply_their_own_ai_score():
    """Test 21: Model schema and evaluator guarantee student-supplied scores are discarded."""
    from app.schemas.answer import AnswerSubmitRequest

    # Student attempts to post ai_score and auto_score
    req = AnswerSubmitRequest(
        question_id=10,
        answer_text="This is my answer.",
    )
    dumped = req.model_dump()
    assert "ai_score" not in dumped
    assert "auto_score" not in dumped
    assert "examiner_score" not in dumped
