import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from app.models.session import SessionStatus

async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

async def setup_exam_and_session(client: AsyncClient):
    examiner_headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    now = datetime.now(timezone.utc)

    # 1. Create MCQ question
    q_mcq_res = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Computer Networks",
        "question_type": "MCQ",
        "difficulty": "easy",
        "marks": 2.0,
        "negative_marks": 0.5,
        "question_text": f"What is the port for HTTP? {now.timestamp()}",
        "options": [
            {"option_text": "80", "is_correct": True},
            {"option_text": "443", "is_correct": False},
            {"option_text": "22", "is_correct": False}
        ]
    })
    assert q_mcq_res.status_code == 201
    mcq_q = q_mcq_res.json()

    # 2. Create Multi-Select question
    q_ms_res = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Computer Networks",
        "question_type": "multi_select",
        "difficulty": "medium",
        "marks": 4.0,
        "negative_marks": 1.0,
        "question_text": f"Which are transport layer protocols? {now.timestamp()}",
        "options": [
            {"option_text": "TCP", "is_correct": True},
            {"option_text": "UDP", "is_correct": True},
            {"option_text": "IP", "is_correct": False},
            {"option_text": "HTTP", "is_correct": False}
        ]
    })
    assert q_ms_res.status_code == 201
    ms_q = q_ms_res.json()

    # 3. Create Short Answer question
    q_sa_res = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Computer Networks",
        "question_type": "short_answer",
        "difficulty": "easy",
        "marks": 3.0,
        "question_text": f"What does DNS stand for? {now.timestamp()}",
        "expected_answer": "Domain Name System",
        "model_answer": "Domain Name System resolves domain names to IP addresses."
    })
    assert q_sa_res.status_code == 201
    sa_q = q_sa_res.json()

    # 4. Create Exam
    exam_res = await client.post("/api/exams", headers=examiner_headers, json={
        "title": f"Network Protocols Exam {now.timestamp()}",
        "subject": "Computer Networks",
        "duration": 60,
        "question_count": 3,
        "start_time": (now - timedelta(minutes=10)).isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
        "randomization_enabled": False,
        "negative_marking_enabled": True
    })
    assert exam_res.status_code == 201
    exam_id = exam_res.json()["id"]

    # 5. Attach questions
    attach_res = await client.post(f"/api/exams/{exam_id}/questions", headers=examiner_headers, json={
        "question_ids": [mcq_q["id"], ms_q["id"], sa_q["id"]]
    })
    assert attach_res.status_code == 200

    # 6. Student gets token and enters session
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
        "multi_select": ms_q,
        "short_answer": sa_q,
        "student_headers": student_headers,
        "examiner_headers": examiner_headers,
    }


@pytest.mark.asyncio
async def test_01_student_can_submit_mcq_answer(client: AsyncClient):
    """Test 1: Student can submit MCQ answer with selected option."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    mcq_q = data["mcq"]
    selected_opt = mcq_q["options"][0]["id"]

    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": mcq_q["id"],
            "selected_option_ids": [selected_opt]
        }
    )
    assert res.status_code == 200
    ans = res.json()
    assert ans["question_id"] == mcq_q["id"]
    assert ans["selected_option_ids"] == [selected_opt]


@pytest.mark.asyncio
async def test_02_student_can_submit_multi_select_answer(client: AsyncClient):
    """Test 2: Student can submit multi-select answer with multiple options."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    ms_q = data["multi_select"]
    opts = [ms_q["options"][0]["id"], ms_q["options"][1]["id"]]

    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": ms_q["id"],
            "selected_option_ids": opts
        }
    )
    assert res.status_code == 200
    ans = res.json()
    assert set(ans["selected_option_ids"]) == set(opts)


@pytest.mark.asyncio
async def test_03_student_can_submit_text_answer(client: AsyncClient):
    """Test 3: Student can submit text answer with word count calculated."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    sa_q = data["short_answer"]
    text = "Domain Name System"

    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": sa_q["id"],
            "answer_text": text
        }
    )
    assert res.status_code == 200
    ans = res.json()
    assert ans["answer_text"] == text
    assert ans["word_count"] == 3


@pytest.mark.asyncio
async def test_04_student_cannot_submit_for_another_student_session(client: AsyncClient):
    """Test 4: Student cannot submit answers to another student's session."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    mcq_q = data["mcq"]

    # Register another student
    other_email = f"other_{datetime.now(timezone.utc).timestamp()}@example.com"
    reg_res = await client.post("/api/auth/register", json={
        "name": "Other Student",
        "email": other_email,
        "password": "Password@123",
        "role": "student"
    })
    assert reg_res.status_code == 201
    other_headers = await get_auth_headers(client, other_email, "Password@123")

    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=other_headers,
        json={
            "question_id": mcq_q["id"],
            "selected_option_ids": [mcq_q["options"][0]["id"]]
        }
    )
    assert res.status_code == 403
    assert "another student" in res.text.lower()


@pytest.mark.asyncio
async def test_05_student_cannot_modify_submitted_session(client: AsyncClient):
    """Test 5: Student cannot submit or modify answers after session submission."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    mcq_q = data["mcq"]

    # Submit session
    sub_res = await client.post(f"/api/exam-sessions/{session_id}/submit", headers=data["student_headers"])
    assert sub_res.status_code == 200

    # Try modifying answer
    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": mcq_q["id"],
            "selected_option_ids": [mcq_q["options"][0]["id"]]
        }
    )
    assert res.status_code == 400
    assert "submitted" in res.text.lower()


@pytest.mark.asyncio
async def test_06_student_cannot_modify_timed_out_session(client: AsyncClient, db_session):
    """Test 6: Student cannot submit or modify answers after session timed out."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    mcq_q = data["mcq"]

    # Set started_at to 3 hours ago to trigger timeout
    from app.models.session import ExamSession
    from sqlalchemy import select

    stmt = select(ExamSession).where(ExamSession.id == session_id)
    res = await db_session.execute(stmt)
    sess = res.scalar_one()
    sess.started_at = datetime.now(timezone.utc) - timedelta(hours=3)
    await db_session.commit()

    # Attempt to submit answer
    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": mcq_q["id"],
            "selected_option_ids": [mcq_q["options"][0]["id"]]
        }
    )
    assert res.status_code == 400
    assert "timed out" in res.text.lower() or "expired" in res.text.lower()


@pytest.mark.asyncio
async def test_07_invalid_option_ids_are_rejected(client: AsyncClient):
    """Test 7: Option IDs not belonging to the question are rejected."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    mcq_q = data["mcq"]

    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": mcq_q["id"],
            "selected_option_ids": [999999]  # Invalid non-existent option
        }
    )
    assert res.status_code == 400
    assert "not valid" in res.text.lower()


@pytest.mark.asyncio
async def test_08_answer_cannot_modify_authoritative_question_data(client: AsyncClient, db_session):
    """Test 8: Client cannot manipulate marks, scoring, or question attributes."""
    data = await setup_exam_and_session(client)
    session_id = data["session_id"]
    mcq_q = data["mcq"]

    # Student sends spoofed marks and auto_score in payload
    res = await client.post(
        f"/api/exam-sessions/{session_id}/answers",
        headers=data["student_headers"],
        json={
            "question_id": mcq_q["id"],
            "selected_option_ids": [mcq_q["options"][0]["id"]],
            "auto_score": 100.0,
            "marks": 50.0,
            "is_correct": True
        }
    )
    assert res.status_code == 200
    ans = res.json()
    # Student answer response schema does not expose scores
    assert "auto_score" not in ans
    assert "marks" not in ans

    # Verify in DB that authoritative question was not modified
    from app.models.question import QuestionBank

    q_db = await db_session.get(QuestionBank, mcq_q["id"])
    assert q_db.marks == 2.0  # Unmodified!
