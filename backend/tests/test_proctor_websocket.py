import pytest
from datetime import datetime, timedelta, timezone
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from app.main import app
from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.session import ExamSession, SessionStatus
from app.auth.security import create_access_token

async def create_test_session_for_ws(db: AsyncSession) -> tuple[str, int, int]:
    """Creates user, exam, and session in DB, returns (jwt_token, student_id, session_id)."""
    now = datetime.now(timezone.utc)
    # Create student
    student = User(
        email=f"ws_student_{now.timestamp()}@example.com",
        password_hash="hash",
        name="WS Student",
        role=UserRole.STUDENT,
        is_active=True
    )
    db.add(student)
    await db.flush()

    # Create exam
    exam = Exam(
        title="WS Exam",
        subject="Networks",
        duration=60,
        question_count=1,
        start_time=now - timedelta(minutes=5),
        end_time=now + timedelta(hours=2),
        proctoring_enabled=True,
        created_by=student.id
    )
    db.add(exam)
    await db.flush()

    # Create session
    session = ExamSession(
        exam_id=exam.id,
        student_id=student.id,
        session_token=f"tok_{now.timestamp()}",
        started_at=now,
        status=SessionStatus.IN_PROGRESS
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    await db.refresh(student)

    token = create_access_token({"sub": student.email, "role": "student"})
    return token, student.id, session.id


@pytest.mark.asyncio
async def test_08_unauthenticated_websocket_connection_rejected():
    """Test 8: Connecting without token or with invalid token rejects with policy violation."""
    client = TestClient(app)
    with client.websocket_connect("/api/ws/proctor/99999?token=invalid_jwt") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert "auth" in msg["message"].lower()
        with pytest.raises(WebSocketDisconnect) as exc:
            ws.receive_json()
        assert exc.value.code == 1008


@pytest.mark.asyncio
async def test_20_websocket_heartbeat_and_event_ack(db_session: AsyncSession):
    """Test 20: WebSocket connection receives heartbeat_ack and event_ack."""
    token, student_id, session_id = await create_test_session_for_ws(db_session)
    client = TestClient(app)

    with client.websocket_connect(f"/api/ws/proctor/{session_id}?token={token}") as ws:
        # 1. Receive initial welcome
        welcome = ws.receive_json()
        assert welcome["type"] == "connected"
        assert welcome["session_id"] == session_id

        # 2. Send heartbeat
        ws.send_json({"type": "heartbeat"})
        ack = ws.receive_json()
        assert ack["type"] == "heartbeat_ack"
        assert ack["status"] == "nominal"

        # 3. Send proctor telemetry event
        ws.send_json({
            "type": "event",
            "event_type": "TAB_SWITCH",
            "metadata": {"warning_count": 1}
        })
        ev_ack = ws.receive_json()
        assert ev_ack["type"] == "event_ack"
        assert ev_ack["event_type"] == "TAB_SWITCH"
        assert ev_ack["recorded"] is True


@pytest.mark.asyncio
async def test_21_websocket_disconnect_handled_gracefully(db_session: AsyncSession):
    """Test 21: Client disconnect does not raise unhandled server exceptions."""
    token, student_id, session_id = await create_test_session_for_ws(db_session)
    client = TestClient(app)

    # Open connection and immediately close
    with client.websocket_connect(f"/api/ws/proctor/{session_id}?token={token}") as ws:
        ws.send_json({"type": "heartbeat"})
        ws.receive_json()
        # Closes cleanly on exit of context manager
