import io
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image

from app.models.session import ExamSession, SessionStatus
from app.models.proctor import ProctorEvent
from app.services.proctor_service import (
    process_proctor_event,
    save_evidence_snapshot,
    is_debounced,
    is_rate_limited
)

async def get_auth_headers(client: AsyncClient, email: str, password: str) -> dict:
    res = await client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

async def setup_proctored_session(client: AsyncClient) -> dict:
    examiner_headers = await get_auth_headers(client, "examiner@example.com", "Examiner@123")
    student_headers = await get_auth_headers(client, "student@example.com", "Student@123")
    now = datetime.now(timezone.utc)

    # 1. Question
    q_res = await client.post("/api/questions", headers=examiner_headers, json={
        "subject": "Proctoring Test",
        "question_type": "MCQ",
        "difficulty": "easy",
        "marks": 5.0,
        "negative_marks": 0.0,
        "question_text": f"Sample Question {now.timestamp()}",
        "options": [{"option_text": "A", "is_correct": True}, {"option_text": "B", "is_correct": False}]
    })
    qid = q_res.json()["id"]

    # 2. Exam with proctoring enabled
    exam_res = await client.post("/api/exams", headers=examiner_headers, json={
        "title": f"Proctor Test Exam {now.timestamp()}",
        "subject": "Proctoring Test",
        "duration": 60,
        "question_count": 1,
        "start_time": (now - timedelta(minutes=5)).isoformat(),
        "end_time": (now + timedelta(hours=2)).isoformat(),
        "proctoring_enabled": True,
        "gaze_sensitivity": "medium",
        "max_tab_switch_warnings": 3
    })
    exam_id = exam_res.json()["id"]
    await client.post(f"/api/exams/{exam_id}/questions", headers=examiner_headers, json={"question_ids": [qid]})

    # 3. Enter session
    tok_res = await client.post(f"/api/exams/{exam_id}/token", headers=student_headers)
    token = tok_res.json()["access_token"]

    enter_res = await client.post("/api/exam-sessions/enter", headers=student_headers, json={
        "exam_id": exam_id,
        "exam_token": token
    })
    session_id = enter_res.json()["id"]

    return {
        "exam_id": exam_id,
        "session_id": session_id,
        "token": token,
        "student_headers": student_headers,
    }

def create_sample_image_bytes(format="JPEG") -> bytes:
    img = Image.new("RGB", (160, 120), color="red")
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()


@pytest.mark.asyncio
async def test_01_valid_face_absent_event_accepted(client: AsyncClient):
    """Test 1: FACE_ABSENT event is processed with medium severity and correct increment."""
    data = await setup_proctored_session(client)
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "FACE_ABSENT", "metadata_json": {"duration_seconds": 3}}
    )
    assert res.status_code == 200
    ev = res.json()
    assert ev["event_type"] == "FACE_ABSENT"
    assert ev["severity"] == "medium"
    assert ev["suspicion_increment"] == 10


@pytest.mark.asyncio
async def test_02_valid_multiple_faces_event_accepted(client: AsyncClient):
    """Test 2: MULTIPLE_FACES event is processed with high severity and correct increment."""
    data = await setup_proctored_session(client)
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "MULTIPLE_FACES", "metadata_json": {"face_count": 2}}
    )
    assert res.status_code == 200
    ev = res.json()
    assert ev["event_type"] == "MULTIPLE_FACES"
    assert ev["severity"] == "high"
    assert ev["suspicion_increment"] == 25


@pytest.mark.asyncio
async def test_03_valid_gaze_away_event_accepted(client: AsyncClient):
    """Test 3: GAZE_AWAY event is processed with low severity and correct increment."""
    data = await setup_proctored_session(client)
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "GAZE_AWAY", "metadata_json": {"direction": "left"}}
    )
    assert res.status_code == 200
    ev = res.json()
    assert ev["event_type"] == "GAZE_AWAY"
    assert ev["severity"] == "low"
    assert ev["suspicion_increment"] == 5


@pytest.mark.asyncio
async def test_04_valid_tab_switch_event_accepted(client: AsyncClient):
    """Test 4: TAB_SWITCH event is recorded with medium severity."""
    data = await setup_proctored_session(client)
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "TAB_SWITCH", "metadata_json": {"warning_count": 1}}
    )
    assert res.status_code == 200
    ev = res.json()
    assert ev["event_type"] == "TAB_SWITCH"
    assert ev["severity"] == "medium"
    assert ev["suspicion_increment"] == 10


@pytest.mark.asyncio
async def test_05_valid_window_blur_event_accepted(client: AsyncClient):
    """Test 5: WINDOW_BLUR event is recorded with low severity."""
    data = await setup_proctored_session(client)
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "WINDOW_BLUR"}
    )
    assert res.status_code == 200
    ev = res.json()
    assert ev["event_type"] == "WINDOW_BLUR"
    assert ev["severity"] == "low"
    assert ev["suspicion_increment"] == 5


@pytest.mark.asyncio
async def test_06_invalid_event_type_rejected(client: AsyncClient):
    """Test 6: Unknown or arbitrary event types are rejected with HTTP 400 or 422."""
    data = await setup_proctored_session(client)
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "HACKING_ATTEMPT"}
    )
    assert res.status_code in (400, 422)


@pytest.mark.asyncio
async def test_07_student_cannot_send_events_for_another_student_session(client: AsyncClient):
    """Test 7: A student cannot post proctoring events to another student's session."""
    data = await setup_proctored_session(client)

    # Register other student
    other_email = f"other_{datetime.now(timezone.utc).timestamp()}@example.com"
    await client.post("/api/auth/register", json={
        "name": "Other Student", "email": other_email, "password": "Password@123", "role": "student"
    })
    other_headers = await get_auth_headers(client, other_email, "Password@123")

    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=other_headers,
        json={"event_type": "TAB_SWITCH"}
    )
    assert res.status_code == 403


@pytest.mark.asyncio
async def test_09_submitted_session_rejects_new_events(client: AsyncClient):
    """Test 9: Completed exam sessions reject new proctoring events."""
    data = await setup_proctored_session(client)

    # Submit session
    await client.post(f"/api/exam-sessions/{data['session_id']}/submit", headers=data["student_headers"])

    # Attempt to post event
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "TAB_SWITCH"}
    )
    assert res.status_code == 400
    assert "submitted" in res.text.lower()


@pytest.mark.asyncio
async def test_10_timed_out_session_rejects_new_events(client: AsyncClient, db_session: AsyncSession):
    """Test 10: Timed-out sessions reject new proctoring events."""
    data = await setup_proctored_session(client)
    sess_id = data["session_id"]

    # Mark timed out in DB
    sess = await db_session.get(ExamSession, sess_id)
    sess.status = SessionStatus.TIMED_OUT
    await db_session.commit()

    res = await client.post(
        f"/api/exam-sessions/{sess_id}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "TAB_SWITCH"}
    )
    assert res.status_code == 400
    assert "timed_out" in res.text.lower()


@pytest.mark.asyncio
async def test_11_and_12_backend_determines_suspicion_increment(client: AsyncClient):
    """Test 11 & 12: Client cannot supply suspicion_increment or manipulate severity."""
    data = await setup_proctored_session(client)

    # Client tries to send custom suspicion_increment and severity
    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={
            "event_type": "GAZE_AWAY",
            "suspicion_increment": 100,  # spoof attempt
            "severity": "critical"       # spoof attempt
        }
    )
    assert res.status_code == 200
    ev = res.json()
    assert ev["suspicion_increment"] == 5   # Authoritative backend value!
    assert ev["severity"] == "low"          # Authoritative backend value!


@pytest.mark.asyncio
async def test_13_event_timestamp_uses_server_authority(client: AsyncClient):
    """Test 13: Backend records current server time, ignoring any spoofed client timestamps."""
    data = await setup_proctored_session(client)
    old_time = "2020-01-01T00:00:00Z"

    res = await client.post(
        f"/api/exam-sessions/{data['session_id']}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "TAB_SWITCH", "timestamp": old_time}
    )
    assert res.status_code == 200
    ev = res.json()
    ev_time = datetime.fromisoformat(ev["timestamp"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    # Server time should be within 5 seconds of now, not 2020
    assert abs((now - ev_time).total_seconds()) < 5.0


def test_14_and_15_duplicate_events_are_debounced_and_rate_limited():
    """Test 14 & 15: Debouncing and rate limiting functions prevent event flooding."""
    # Debounce test
    assert is_debounced(999, "FACE_ABSENT", 5.0) is False  # First call allowed
    assert is_debounced(999, "FACE_ABSENT", 5.0) is True   # Immediate repeat debounced!

    # Rate limiting test
    from app.services.proctor_service import record_event_timestamp
    for _ in range(35):
        record_event_timestamp(888)
    assert is_rate_limited(888) is True


def test_16_17_18_evidence_snapshot_validation():
    """Test 16, 17, 18: Snapshot accepts valid images, rejects invalid types and oversized files."""
    from fastapi import HTTPException
    # Valid image
    img_bytes = create_sample_image_bytes("JPEG")
    abs_path, rel_url = save_evidence_snapshot(img_bytes, "snap.jpg", 101)
    assert "/uploads/snapshots/" in rel_url

    # Invalid extension
    with pytest.raises(HTTPException) as exc1:
        save_evidence_snapshot(b"dummy", "snap.exe", 101)
    assert exc1.value.status_code == 400

    # Oversized image
    oversized = b"0" * (6 * 1024 * 1024)
    with pytest.raises(HTTPException) as exc2:
        save_evidence_snapshot(oversized, "big.jpg", 101)
    assert exc2.value.status_code == 400


@pytest.mark.asyncio
async def test_19_suspicion_score_remains_within_valid_bounds(client: AsyncClient, db_session: AsyncSession):
    """Test 19: Repeated events cap the session suspicion_score at MAX_SUSPICION_SCORE (100)."""
    data = await setup_proctored_session(client)
    sess_id = data["session_id"]

    # Pre-set suspicion score to 90
    sess = await db_session.get(ExamSession, sess_id)
    sess.suspicion_score = 90
    await db_session.commit()

    # Trigger MULTIPLE_FACES (+25)
    res = await client.post(
        f"/api/exam-sessions/{sess_id}/proctor-events",
        headers=data["student_headers"],
        json={"event_type": "MULTIPLE_FACES"}
    )
    assert res.status_code == 200

    # Check updated score in DB is capped at 100
    await db_session.refresh(sess)
    assert sess.suspicion_score == 100
