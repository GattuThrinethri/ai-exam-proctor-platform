import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.result import Result
from app.models.session import ExamSession, SessionStatus
from app.models.answer import Answer
from app.services.evaluation_service import evaluate_session

async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

async def setup_pipeline_exam(client: AsyncClient):
    examiner_headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    now = datetime.now(timezone.utc)

    # 1. MCQ: 3 marks, 1 negative mark
    q_mcq_res = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Operating Systems",
        "question_type": "MCQ",
        "difficulty": "medium",
        "marks": 3.0,
        "negative_marks": 1.0,
        "question_text": f"Which scheduling algorithm is non-preemptive? {now.timestamp()}",
        "options": [
            {"option_text": "FCFS", "is_correct": True},
            {"option_text": "Round Robin", "is_correct": False},
            {"option_text": "SRTF", "is_correct": False}
        ]
    })
    assert q_mcq_res.status_code == 201
    mcq_q = q_mcq_res.json()

    # 2. Long Answer: 5 marks
    q_long_res = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Operating Systems",
        "question_type": "long_answer",
        "difficulty": "hard",
        "marks": 5.0,
        "question_text": f"Explain paging and virtual memory concepts. {now.timestamp()}",
        "model_answer": "Paging is a memory management scheme that eliminates the need for contiguous physical memory allocation using page tables."
    })
    assert q_long_res.status_code == 201
    long_q = q_long_res.json()

    # 3. Create Exam
    exam_res = await client.post("/api/exams", headers=examiner_headers, json={
        "title": f"OS Comprehensive Exam {now.timestamp()}",
        "subject": "Operating Systems",
        "duration": 60,
        "question_count": 2,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
        "randomization_enabled": False,
        "negative_marking_enabled": True
    })
    assert exam_res.status_code == 201
    exam_id = exam_res.json()["id"]

    # 4. Attach questions
    attach_res = await client.post(f"/api/exams/{exam_id}/questions", headers=examiner_headers, json={
        "question_ids": [mcq_q["id"], long_q["id"]]
    })
    assert attach_res.status_code == 200

    # 5. Student enters session
    tok_res = await client.post(f"/api/exams/{exam_id}/token", headers=student_headers)
    assert tok_res.status_code == 200
    token = tok_res.json()["access_token"]

    enter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={
        "exam_id": exam_id,
        "exam_token": token
    })
    assert enter_res.status_code == 200
    session_id = enter_res.json()["id"]

    return {
        "exam_id": exam_id,
        "session_id": session_id,
        "mcq": mcq_q,
        "long": long_q,
        "student_headers": student_headers,
    }


@pytest.mark.asyncio
async def test_27_submitted_answers_are_evaluated(client: AsyncClient, db_session: AsyncSession):
    """Test 27: Submitted answers have their scores calculated upon submission."""
    data = await setup_pipeline_exam(client)
    session_id = data["session_id"]
    student_headers = data["student_headers"]

    # Submit correct MCQ
    mcq_correct_id = data["mcq"]["options"][0]["id"]
    await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=student_headers,
        json={"question_id": data["mcq"]["id"], "selected_option_ids": [mcq_correct_id]}
    )

    # Submit Long answer
    await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=student_headers,
        json={
            "question_id": data["long"]["id"],
            "answer_text": "Paging is a memory management scheme eliminating contiguous physical memory with page tables."
        }
    )

    # Submit exam session
    sub_res = await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)
    assert sub_res.status_code == 200

    # Verify answers have scores stored in DB
    stmt = select(Answer).where(Answer.session_id == session_id)
    res = await db_session.execute(stmt)
    answers = res.scalars().all()
    assert len(answers) == 2

    mcq_ans = next(a for a in answers if a.question_id == data["mcq"]["id"])
    assert mcq_ans.auto_score == 3.0

    long_ans = next(a for a in answers if a.question_id == data["long"]["id"])
    assert long_ans.ai_score is not None
    assert long_ans.ai_score > 0.0


@pytest.mark.asyncio
async def test_28_result_is_created(client: AsyncClient, db_session: AsyncSession):
    """Test 28: A Result record is created in the database when session is submitted."""
    data = await setup_pipeline_exam(client)
    session_id = data["session_id"]
    student_headers = data["student_headers"]

    # Submit session
    sub_res = await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)
    assert sub_res.status_code == 200

    stmt = select(Result).where(Result.session_id == session_id)
    res = await db_session.execute(stmt)
    result = res.scalar_one_or_none()
    assert result is not None
    assert result.session_id == session_id
    assert result.published is False


@pytest.mark.asyncio
async def test_29_objective_and_subjective_scores_are_aggregated(client: AsyncClient, db_session: AsyncSession):
    """Test 29: Total score equals objective_score + subjective_score."""
    data = await setup_pipeline_exam(client)
    session_id = data["session_id"]
    student_headers = data["student_headers"]

    # Submit correct MCQ (3.0)
    mcq_correct_id = data["mcq"]["options"][0]["id"]
    await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=student_headers,
        json={"question_id": data["mcq"]["id"], "selected_option_ids": [mcq_correct_id]}
    )

    # Submit partial Long answer
    await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=student_headers,
        json={
            "question_id": data["long"]["id"],
            "answer_text": "Virtual memory uses page tables to manage address spaces."
        }
    )

    # Submit session
    await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)

    stmt = select(Result).where(Result.session_id == session_id)
    res = await db_session.execute(stmt)
    result = res.scalar_one()

    assert result.objective_score == 3.0
    assert result.subjective_score > 0.0
    expected_total = round(result.objective_score + result.subjective_score, 2)
    assert result.total_score == expected_total


@pytest.mark.asyncio
async def test_30_duplicate_evaluation_is_prevented(client: AsyncClient, db_session: AsyncSession):
    """Test 30: Calling evaluate_session multiple times returns existing Result without recomputing."""
    data = await setup_pipeline_exam(client)
    session_id = data["session_id"]

    result1 = await evaluate_session(session_id, db_session)
    orig_id = result1.id
    orig_score = result1.total_score

    # Second evaluation call
    result2 = await evaluate_session(session_id, db_session)
    assert result2.id == orig_id
    assert result2.total_score == orig_score


@pytest.mark.asyncio
async def test_31_timed_out_session_is_evaluated(client: AsyncClient, db_session: AsyncSession):
    """Test 31: An expired session is transitioned to timed_out and evaluated."""
    data = await setup_pipeline_exam(client)
    session_id = data["session_id"]

    # Artificially set started_at in the past
    stmt = select(ExamSession).where(ExamSession.id == session_id)
    res = await db_session.execute(stmt)
    sess = res.scalar_one()
    sess.started_at = datetime.now(timezone.utc) - timedelta(hours=5)
    await db_session.commit()

    # Querying session triggers timeout and evaluation
    res = await client.get(f"/api/exam-sessions/{session_id}", headers=data["student_headers"])
    assert res.status_code == 200
    assert res.json()["status"] == "timed_out"

    # Verify result was created
    stmt = select(Result).where(Result.session_id == session_id)
    r_res = await db_session.execute(stmt)
    result = r_res.scalar_one_or_none()
    assert result is not None
    assert result.session_id == session_id


@pytest.mark.asyncio
async def test_32_completed_session_cannot_receive_additional_answers(client: AsyncClient):
    """Test 32: After completion, answer modification is completely locked."""
    data = await setup_pipeline_exam(client)
    session_id = data["session_id"]
    student_headers = data["student_headers"]

    # Submit session
    await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)

    # Attempt to post answer
    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=student_headers,
        json={"question_id": data["mcq"]["id"], "selected_option_ids": [data["mcq"]["options"][0]["id"]]}
    )
    assert res.status_code == 400
    assert "submitted" in res.text.lower()
