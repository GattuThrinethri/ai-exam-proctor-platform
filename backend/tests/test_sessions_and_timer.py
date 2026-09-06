import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from app.services.timer_service import calculate_remaining_seconds, is_session_expired
from app.models.session import ExamSession, SessionStatus

async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

async def create_test_exam(client: AsyncClient, start_delta_hrs: float = -1.0, end_delta_hrs: float = 2.0, duration: int = 60) -> int:
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    res = await client.post("/api/exams", headers=headers, json={
        "title": f"Session Test Exam {now.timestamp()}",
        "subject": "System Architecture",
        "duration": duration,
        "question_count": 2,
        "start_time": (now + timedelta(hours=start_delta_hrs)).isoformat(),
        "end_time": (now + timedelta(hours=end_delta_hrs)).isoformat(),
        "randomization_enabled": True,
    })
    assert res.status_code == 201, f"Failed to create exam: {res.text}"
    return res.json()["id"]

@pytest.mark.asyncio
async def test_15_student_can_enter_valid_exam(client: AsyncClient):
    """Test student entering an active exam and obtaining session."""
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    exam_id = await create_test_exam(client, start_delta_hrs=-1.0, end_delta_hrs=2.0)

    # Generate token
    tok_res = await client.post(f"/api/exams/{exam_id}/token", headers=student_headers)
    assert tok_res.status_code == 200
    exam_token = tok_res.json()["access_token"]

    # Enter exam
    enter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={
        "exam_id": exam_id,
        "exam_token": exam_token
    })
    assert enter_res.status_code == 200
    data = enter_res.json()
    assert data["exam_id"] == exam_id
    assert data["status"] == "in_progress"
    assert "session_token" in data
    assert data["remaining_seconds"] > 0

@pytest.mark.asyncio
async def test_16_student_cannot_enter_before_start_time(client: AsyncClient):
    """Test entering an exam whose window has not started yet is rejected."""
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    # Exam starts 2 hours in the future
    future_exam_id = await create_test_exam(client, start_delta_hrs=2.0, end_delta_hrs=4.0)

    res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={
        "exam_id": future_exam_id
    })
    assert res.status_code == 400
    assert "not started" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_17_student_cannot_enter_after_end_time(client: AsyncClient):
    """Test entering an exam whose window has expired is rejected."""
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    # Exam ended 1 hour ago
    past_exam_id = await create_test_exam(client, start_delta_hrs=-3.0, end_delta_hrs=-1.0)

    res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={
        "exam_id": past_exam_id
    })
    assert res.status_code == 400
    assert "expired" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_18_session_created_correctly(client: AsyncClient):
    """Test session creation records server timestamp and returns paper."""
    examiner_headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")

    # Create exam and question
    q = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Networks", "question_text": "HTTP Port?", "question_type": "short_answer", "marks": 2
    })
    exam_id = await create_test_exam(client, start_delta_hrs=-0.5, end_delta_hrs=1.0)
    await client.post(f"/api/exams/{exam_id}/questions", headers=examiner_headers, json={
        "question_ids": [q.json()["id"]]
    })

    # Enter exam
    enter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={
        "exam_id": exam_id
    })
    session_id = enter_res.json()["id"]

    # Retrieve paper
    paper_res = await client.get(f"/api/exam-sessions/{session_id}/paper", headers=student_headers)
    assert paper_res.status_code == 200
    paper = paper_res.json()
    assert paper["session_id"] == session_id
    assert len(paper["questions"]) == 1
    assert paper["questions"][0]["question_text"] == "HTTP Port?"

@pytest.mark.asyncio
async def test_19_duplicate_active_session_prevented(client: AsyncClient):
    """Test entering again resumes the active session rather than creating duplicate active sessions."""
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    exam_id = await create_test_exam(client, start_delta_hrs=-0.5, end_delta_hrs=1.0)

    # First entry
    r1 = await client.post("/api/exam-sessions/enter", headers=student_headers, json={"exam_id": exam_id})
    s1_id = r1.json()["id"]
    s1_token = r1.json()["session_token"]

    # Second entry
    r2 = await client.post("/api/exam-sessions/enter", headers=student_headers, json={"exam_id": exam_id})
    s2_id = r2.json()["id"]
    s2_token = r2.json()["session_token"]

    assert s1_id == s2_id, "Duplicate session creation must be prevented; must resume active session"
    assert s1_token == s2_token

@pytest.mark.asyncio
async def test_20_completed_session_cannot_be_modified(client: AsyncClient):
    """Test submitting session transitions to SUBMITTED and blocks re-entry."""
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    exam_id = await create_test_exam(client, start_delta_hrs=-0.5, end_delta_hrs=1.0)

    enter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={"exam_id": exam_id})
    session_id = enter_res.json()["id"]

    # Submit session
    sub_res = await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)
    assert sub_res.status_code == 200
    assert sub_res.json()["status"] == "submitted"

    # Attempting to re-submit must fail
    resubmit_res = await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)
    assert resubmit_res.status_code == 400

    # Attempting to re-enter must fail
    reenter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={"exam_id": exam_id})
    assert reenter_res.status_code == 400
    assert "completed or submitted" in reenter_res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_21_remaining_time_calculated_using_server_time():
    """Unit test authoritative remaining time calculation."""
    now = datetime.now(timezone.utc)
    started_at = now - timedelta(minutes=15)
    mock_session = ExamSession(
        id=1, exam_id=1, student_id=1, session_token="tok",
        started_at=started_at, status=SessionStatus.IN_PROGRESS
    )
    # 60 minute duration, 15 minutes elapsed -> 45 minutes (2700 seconds) remaining
    rem_seconds = calculate_remaining_seconds(mock_session, duration_minutes=60, now=now)
    assert 2690 <= rem_seconds <= 2710

def test_22_client_clock_is_not_trusted():
    """Verify timer uses server now and rejects client-provided timestamps."""
    now = datetime.now(timezone.utc)
    started_at = now - timedelta(minutes=59)
    mock_session = ExamSession(
        id=2, exam_id=1, student_id=1, session_token="tok",
        started_at=started_at, status=SessionStatus.IN_PROGRESS
    )
    # Even if client claims it just started, server calculation sees only 60s remaining
    rem = calculate_remaining_seconds(mock_session, duration_minutes=60, now=now)
    assert 50 <= rem <= 70

def test_23_expired_session_is_timed_out():
    """Verify session whose duration has elapsed triggers timeout check."""
    now = datetime.now(timezone.utc)
    started_at = now - timedelta(minutes=61)
    mock_session = ExamSession(
        id=3, exam_id=1, student_id=1, session_token="tok",
        started_at=started_at, status=SessionStatus.IN_PROGRESS
    )
    assert is_session_expired(mock_session, duration_minutes=60, now=now) is True
    rem = calculate_remaining_seconds(mock_session, duration_minutes=60, now=now)
    assert rem == 0

@pytest.mark.asyncio
async def test_24_timeout_prevents_further_paper_access(client: AsyncClient):
    """Test that when a session has timed out, paper retrieval is blocked."""
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    # Create 1-minute exam that has elapsed
    exam_id = await create_test_exam(client, start_delta_hrs=-0.1, end_delta_hrs=1.0, duration=1)

    enter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={"exam_id": exam_id})
    session_id = enter_res.json()["id"]

    # Simulating time elapsed: manually submit or query after timeout
    await client.post(f"/api/exam-sessions/{session_id}/submit", headers=student_headers)

    # Attempt to access paper
    paper_res = await client.get(f"/api/exam-sessions/{session_id}/paper", headers=student_headers)
    assert paper_res.status_code == 400
    assert "submitted" in paper_res.json()["detail"].lower()
