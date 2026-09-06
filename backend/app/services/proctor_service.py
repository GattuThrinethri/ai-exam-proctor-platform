import os
import time
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.models.session import ExamSession, SessionStatus
from app.models.proctor import ProctorEvent
from app.models.user import User, UserRole
from app.schemas.proctor import ProctorEventType, ProctorSeverity

logger = logging.getLogger("proctor_service")

# Event default severity and score mapping
EVENT_METRICS = {
    ProctorEventType.FACE_ABSENT: (ProctorSeverity.MEDIUM, settings.FACE_ABSENT_SCORE, 5.0),    # cooldown 5s
    ProctorEventType.MULTIPLE_FACES: (ProctorSeverity.HIGH, settings.MULTIPLE_FACES_SCORE, 5.0), # cooldown 5s
    ProctorEventType.GAZE_AWAY: (ProctorSeverity.LOW, settings.GAZE_AWAY_SCORE, 4.0),           # cooldown 4s
    ProctorEventType.TAB_SWITCH: (ProctorSeverity.MEDIUM, settings.TAB_SWITCH_SCORE, 3.0),      # cooldown 3s
    ProctorEventType.WINDOW_BLUR: (ProctorSeverity.LOW, settings.WINDOW_BLUR_SCORE, 4.0),       # cooldown 4s
}

# In-memory debounce tracker: (session_id, event_type) -> last_event_unix_time
_last_event_timestamps: Dict[Tuple[int, str], float] = {}

# Rate limit tracker: session_id -> list of event timestamps in last 60 seconds
_session_event_history: Dict[int, list[float]] = {}
MAX_EVENTS_PER_MINUTE = 30


def is_rate_limited(session_id: int) -> bool:
    """Limits events to MAX_EVENTS_PER_MINUTE per session."""
    now = time.time()
    history = _session_event_history.get(session_id, [])
    # Keep only events within last 60s
    recent = [t for t in history if now - t < 60.0]
    _session_event_history[session_id] = recent
    return len(recent) >= MAX_EVENTS_PER_MINUTE


def record_event_timestamp(session_id: int):
    now = time.time()
    history = _session_event_history.get(session_id, [])
    history.append(now)
    _session_event_history[session_id] = history


def is_debounced(session_id: int, event_type: str, cooldown_seconds: float) -> bool:
    """Checks if the same event type occurred within the cooldown window for this session."""
    now = time.time()
    key = (session_id, event_type)
    last_time = _last_event_timestamps.get(key)
    if last_time and (now - last_time < cooldown_seconds):
        return True
    _last_event_timestamps[key] = now
    return False


async def validate_session_for_proctoring(
    session_id: int,
    current_user: User,
    db: AsyncSession
) -> ExamSession:
    """
    Validates that:
    1. Session exists.
    2. Student owns the session.
    3. Session is IN_PROGRESS (not submitted or timed out).
    """
    stmt = select(ExamSession).where(ExamSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Exam session {session_id} not found"
        )

    if current_user.role == UserRole.STUDENT and session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Cannot submit proctoring events for another student's session"
        )

    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record proctoring events: session is already {session.status.value}"
        )

    return session


async def process_proctor_event(
    session_id: int,
    current_user: User,
    event_type_str: str,
    metadata_json: Optional[Dict[str, Any]] = None,
    webcam_snapshot_url: Optional[str] = None,
    db: AsyncSession = None,
) -> Optional[ProctorEvent]:
    """
    Processes, validates, and persists a proctoring event.
    Authoritatively determines severity and suspicion increment.
    Enforces rate-limits, debouncing, and score bounds.
    """
    # 1. Validate session
    session = await validate_session_for_proctoring(session_id, current_user, db)

    # 2. Validate event type
    try:
        event_type = ProctorEventType(event_type_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid proctoring event type: '{event_type_str}'. Allowed: {[e.value for e in ProctorEventType]}"
        )

    # 3. Check rate limits
    if is_rate_limited(session_id):
        logger.warning(f"Rate limit exceeded for proctor events on session {session_id}")
        return None

    # 4. Debounce check
    severity, increment, cooldown = EVENT_METRICS[event_type]
    if is_debounced(session_id, event_type.value, cooldown):
        logger.debug(f"Debounced duplicate {event_type.value} event on session {session_id}")
        return None

    # 5. Authoritative backend values
    record_event_timestamp(session_id)
    server_now = datetime.now(timezone.utc)

    # 6. Create ProctorEvent record
    event = ProctorEvent(
        session_id=session_id,
        event_type=event_type.value,
        timestamp=server_now,
        severity=severity.value,
        suspicion_increment=increment,
        metadata_json=metadata_json,
        webcam_snapshot_url=webcam_snapshot_url,
    )
    db.add(event)

    # 7. Update Session suspicion score (bounded to MAX_SUSPICION_SCORE)
    current_score = session.suspicion_score or 0
    new_score = min(settings.MAX_SUSPICION_SCORE, current_score + increment)
    session.suspicion_score = new_score

    await db.commit()
    await db.refresh(event)

    logger.info(
        f"ProctorEvent logged: Session {session_id} | Type={event_type.value} | "
        f"Severity={severity.value} | Increment=+{increment} | TotalSuspicion={session.suspicion_score}"
    )
    return event


def save_evidence_snapshot(
    file_bytes: bytes,
    filename: str,
    session_id: int,
    content_type: Optional[str] = None
) -> Tuple[str, str]:
    """
    Validates and stores an occasional webcam evidence snapshot under uploads/snapshots/.
    Returns: (absolute_path, relative_url)
    """
    MAX_SNAPSHOT_SIZE = 5 * 1024 * 1024  # 5MB

    if len(file_bytes) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Evidence snapshot is empty")
    if len(file_bytes) > MAX_SNAPSHOT_SIZE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Evidence snapshot exceeds 5MB limit")

    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported image extension '{ext}'")

    import io
    try:
        with Image.open(io.BytesIO(file_bytes)) as img:
            img.verify()
    except (UnidentifiedImageError, Exception):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Corrupted or invalid snapshot image")

    upload_base = Path(settings.UPLOAD_DIR).resolve()
    snapshots_dir = upload_base / "snapshots"
    snapshots_dir.mkdir(parents=True, exist_ok=True)

    safe_filename = f"snap_{session_id}_{uuid.uuid4().hex[:12]}{ext}"
    target_path = snapshots_dir / safe_filename

    with open(target_path, "wb") as f:
        f.write(file_bytes)

    return str(target_path), f"/uploads/snapshots/{safe_filename}"
