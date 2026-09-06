import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

@pytest.mark.asyncio
async def test_01_examiner_can_create_exam(client: AsyncClient):
    """Test examiner can create a valid exam."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Computer Networks Final",
        "subject": "Networks",
        "description": "Comprehensive networking examination",
        "duration": 90,
        "question_count": 5,
        "start_time": (now - timedelta(hours=1)).isoformat(),
        "end_time": (now + timedelta(hours=5)).isoformat(),
        "randomization_enabled": True,
        "negative_marking_enabled": True,
        "proctoring_enabled": True,
        "gaze_sensitivity": "medium",
        "max_tab_switch_warnings": 3
    }
    res = await client.post("/api/exams", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Computer Networks Final"
    assert data["duration"] == 90
    assert data["randomization_enabled"] is True
    assert "id" in data

@pytest.mark.asyncio
async def test_02_student_cannot_create_exam(client: AsyncClient):
    """Test student role is forbidden from creating exams."""
    headers = await get_auth_headers(client, "student@example.com", "Student@123")
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Unauthorized Student Exam",
        "subject": "Math",
        "duration": 60,
        "question_count": 5,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
    }
    res = await client.post("/api/exams", json=payload, headers=headers)
    assert res.status_code == 403

@pytest.mark.asyncio
async def test_03_invalid_duration_rejected(client: AsyncClient):
    """Test duration <= 0 is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Invalid Duration Exam",
        "subject": "Math",
        "duration": 0,
        "question_count": 5,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
    }
    res = await client.post("/api/exams", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_04_invalid_question_count_rejected(client: AsyncClient):
    """Test question_count <= 0 is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Invalid Question Count Exam",
        "subject": "Math",
        "duration": 60,
        "question_count": 0,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
    }
    res = await client.post("/api/exams", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_05_invalid_exam_window_rejected(client: AsyncClient):
    """Test start_time >= end_time is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    payload = {
        "title": "Invalid Window Exam",
        "subject": "Math",
        "duration": 60,
        "question_count": 5,
        "start_time": (now + timedelta(hours=2)).isoformat(),
        "end_time": now.isoformat(),  # end_time before start_time
    }
    res = await client.post("/api/exams", json=payload, headers=headers)
    assert res.status_code in (400, 422)

@pytest.mark.asyncio
async def test_06_examiner_can_update_exam(client: AsyncClient):
    """Test examiner updating an exam's title, duration, and proctoring settings."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    create_res = await client.post("/api/exams", headers=headers, json={
        "title": "Pre-Update Exam",
        "subject": "Algorithms",
        "duration": 45,
        "question_count": 10,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
    })
    exam_id = create_res.json()["id"]

    update_res = await client.put(f"/api/exams/{exam_id}", headers=headers, json={
        "title": "Post-Update Exam",
        "duration": 60,
        "gaze_sensitivity": "high"
    })
    assert update_res.status_code == 200
    data = update_res.json()
    assert data["title"] == "Post-Update Exam"
    assert data["duration"] == 60
    assert data["gaze_sensitivity"] == "high"

@pytest.mark.asyncio
async def test_07_examiner_can_retrieve_exam(client: AsyncClient):
    """Test examiner retrieving full exam details."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    create_res = await client.post("/api/exams", headers=headers, json={
        "title": "Retrievable Exam",
        "subject": "Cloud",
        "duration": 30,
        "question_count": 5,
        "start_time": now.isoformat(),
        "end_time": (now + timedelta(hours=1)).isoformat(),
    })
    exam_id = create_res.json()["id"]

    get_res = await client.get(f"/api/exams/{exam_id}", headers=headers)
    assert get_res.status_code == 200
    assert get_res.json()["id"] == exam_id

@pytest.mark.asyncio
async def test_08_questions_can_be_associated_with_exam(client: AsyncClient):
    """Test attaching questions from question bank to an exam."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    # Create two questions
    q1 = await client.post("/api/questions", headers=headers, json={
        "subject": "OS", "question_text": "Q1 OS", "question_type": "short_answer", "marks": 2
    })
    q2 = await client.post("/api/questions", headers=headers, json={
        "subject": "OS", "question_text": "Q2 OS", "question_type": "short_answer", "marks": 3
    })
    q_ids = [q1.json()["id"], q2.json()["id"]]

    # Create exam
    ex = await client.post("/api/exams", headers=headers, json={
        "title": "OS Midterm", "subject": "OS", "duration": 45, "question_count": 2,
        "start_time": now.isoformat(), "end_time": (now + timedelta(hours=2)).isoformat()
    })
    exam_id = ex.json()["id"]

    # Attach questions
    attach_res = await client.post(f"/api/exams/{exam_id}/questions", headers=headers, json={
        "question_ids": q_ids
    })
    assert attach_res.status_code == 200
    assert len(attach_res.json()["questions"]) == 2

@pytest.mark.asyncio
async def test_09_invalid_question_ids_rejected(client: AsyncClient):
    """Test attaching non-existent question IDs is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    ex = await client.post("/api/exams", headers=headers, json={
        "title": "Ghost Question Exam", "subject": "AI", "duration": 30, "question_count": 1,
        "start_time": now.isoformat(), "end_time": (now + timedelta(hours=1)).isoformat()
    })
    exam_id = ex.json()["id"]

    res = await client.post(f"/api/exams/{exam_id}/questions", headers=headers, json={
        "question_ids": [99999999]
    })
    assert res.status_code == 400

@pytest.mark.asyncio
async def test_10_duplicate_questions_handled(client: AsyncClient):
    """Test submitting duplicate question IDs in attachment is rejected."""
    headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    now = datetime.now(timezone.utc)
    q = await client.post("/api/questions", headers=headers, json={
        "subject": "DB", "question_text": "Unique Q", "question_type": "short_answer", "marks": 2
    })
    q_id = q.json()["id"]

    ex = await client.post("/api/exams", headers=headers, json={
        "title": "Duplicate Q Test", "subject": "DB", "duration": 30, "question_count": 2,
        "start_time": now.isoformat(), "end_time": (now + timedelta(hours=1)).isoformat()
    })
    exam_id = ex.json()["id"]

    res = await client.post(f"/api/exams/{exam_id}/questions", headers=headers, json={
        "question_ids": [q_id, q_id]
    })
    assert res.status_code == 400
    assert "duplicate" in res.json()["detail"].lower()
