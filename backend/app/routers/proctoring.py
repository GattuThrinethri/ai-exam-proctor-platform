import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User, UserRole
from app.models.session import ExamSession, SessionStatus
from app.models.proctor import ProctorEvent
from app.schemas.proctor import (
    ProctorEventCreate,
    ProctorEventResponse,
    SnapshotUploadResponse,
    ProctorHeartbeatRequest,
    ProctorHeartbeatResponse
)
from app.services.proctor_service import (
    process_proctor_event,
    save_evidence_snapshot,
    validate_session_for_proctoring
)

logger = logging.getLogger("proctor_router")

router = APIRouter(prefix="/exam-sessions", tags=["proctoring"])


@router.post(
    "/{session_id}/proctor-events",
    response_model=Optional[ProctorEventResponse],
    status_code=status.HTTP_200_OK,
    summary="Record a derived proctoring telemetry event"
)
async def record_proctor_event_endpoint(
    session_id: int,
    payload: ProctorEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Records an indicator event (e.g. FACE_ABSENT, TAB_SWITCH, WINDOW_BLUR, GAZE_AWAY, MULTIPLE_FACES).
    Backend determines authoritative severity and suspicion increment.
    """
    event = await process_proctor_event(
        session_id=session_id,
        current_user=current_user,
        event_type_str=payload.event_type.value,
        metadata_json=payload.metadata_json,
        webcam_snapshot_url=payload.webcam_snapshot_url,
        db=db
    )
    return event


@router.get(
    "/{session_id}/proctor-events",
    response_model=List[ProctorEventResponse],
    summary="Retrieve proctoring event log for audit"
)
async def get_proctor_events(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves all proctoring events logged for a session.
    """
    stmt = select(ExamSession).where(ExamSession.id == session_id)
    res = await db.execute(stmt)
    session = res.scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Session {session_id} not found")

    if current_user.role == UserRole.STUDENT and session.student_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized")

    event_stmt = (
        select(ProctorEvent)
        .where(ProctorEvent.session_id == session_id)
        .order_by(ProctorEvent.timestamp.asc())
    )
    ev_res = await db.execute(event_stmt)
    return ev_res.scalars().all()


@router.post(
    "/{session_id}/proctor-snapshot",
    response_model=SnapshotUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload occasional webcam evidence snapshot"
)
async def upload_evidence_snapshot(
    session_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stores an occasional webcam snapshot as evidence for proctoring review.
    Validates file content and size (max 5MB), prevents path traversal.
    """
    await validate_session_for_proctoring(session_id, current_user, db)

    file_bytes = await file.read()
    filename = file.filename or "snapshot.jpg"

    abs_path, rel_url = save_evidence_snapshot(
        file_bytes=file_bytes,
        filename=filename,
        session_id=session_id,
        content_type=file.content_type
    )

    return SnapshotUploadResponse(
        snapshot_url=rel_url,
        filename=filename,
        size_bytes=len(file_bytes),
        content_type=file.content_type or "image/jpeg"
    )


@router.post(
    "/{session_id}/heartbeat",
    response_model=ProctorHeartbeatResponse,
    summary="HTTP Heartbeat ping for proctoring liveness"
)
async def proctor_heartbeat(
    session_id: int,
    payload: Optional[ProctorHeartbeatRequest] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Heartbeat ping confirming active client session.
    Server provides authoritative timestamp and status.
    """
    session = await validate_session_for_proctoring(session_id, current_user, db)

    server_now = datetime.now(timezone.utc)
    return ProctorHeartbeatResponse(
        status="active",
        server_time=server_now,
        session_status=session.status.value,
        current_suspicion_level="nominal" if (session.suspicion_score or 0) < 50 else "elevated",
        active_warnings=0
    )
