import json
import logging
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.auth.security import decode_access_token
from app.models.user import User, UserRole
from app.models.session import ExamSession, SessionStatus
from app.services.proctor_service import process_proctor_event

logger = logging.getLogger("proctor_websocket")

router = APIRouter(tags=["proctoring_websocket"])


async def authenticate_ws_user(token: Optional[str], db: AsyncSession) -> Optional[User]:
    """Decodes JWT and retrieves User model instance."""
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        sub = payload.get("sub")
        if not sub:
            return None
        try:
            user_id = int(sub)
            stmt = select(User).where(User.id == user_id)
        except ValueError:
            stmt = select(User).where(User.email == sub)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {e}")
        return None


@router.websocket("/ws/proctor/{session_id}")
async def proctor_websocket_endpoint(
    websocket: WebSocket,
    session_id: int,
):
    """
    Real-time bidirectional WebSocket channel for proctoring heartbeat & telemetry signals.
    Enforces student authorization, session validation, and backend-authoritative suspicion scoring.
    """
    # 1. Check initial token from query parameters
    token = websocket.query_params.get("token")

    async with AsyncSessionLocal() as db:
        user = await authenticate_ws_user(token, db)

        if not user:
            await websocket.accept()
            logger.warning(f"Unauthenticated WebSocket connection attempt on session {session_id}")
            await websocket.send_json({"type": "error", "message": "Authentication failed"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await websocket.accept()

        # 2. Validate Session
        stmt = select(ExamSession).where(ExamSession.id == session_id)
        res = await db.execute(stmt)
        session = res.scalar_one_or_none()

        if not session:
            logger.warning(f"WebSocket connection for non-existent session {session_id}")
            await websocket.send_json({"type": "error", "message": f"Session {session_id} not found"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        if user.role == UserRole.STUDENT and session.student_id != user.id:
            logger.warning(f"Unauthorized student {user.id} attempted to access session {session_id}")
            await websocket.send_json({"type": "error", "message": "Unauthorized session access"})
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        if session.status != SessionStatus.IN_PROGRESS:
            logger.info(f"WebSocket rejected for session {session_id}: status is {session.status.value}")
            await websocket.send_json({"type": "error", "message": f"Session is {session.status.value}"})
            await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
            return

    # 3. Connection Established
    server_now = datetime.now(timezone.utc).isoformat()
    await websocket.send_json({
        "type": "connected",
        "session_id": session_id,
        "server_time": server_now,
        "status": "proctoring_active"
    })
    logger.info(f"Proctoring WebSocket established for Student {user.id} on Session {session_id}")

    # 4. Message Loop
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
                continue

            msg_type = data.get("type")
            now_iso = datetime.now(timezone.utc).isoformat()

            # Heartbeat message
            if msg_type == "heartbeat":
                await websocket.send_json({
                    "type": "heartbeat_ack",
                    "server_time": now_iso,
                    "status": "nominal"
                })

            # Proctoring event telemetry
            elif msg_type == "event":
                event_type_str = data.get("event_type")
                metadata_json = data.get("metadata")
                snapshot_url = data.get("webcam_snapshot_url")

                async with AsyncSessionLocal() as db:
                    try:
                        event = await process_proctor_event(
                            session_id=session_id,
                            current_user=user,
                            event_type_str=event_type_str,
                            metadata_json=metadata_json,
                            webcam_snapshot_url=snapshot_url,
                            db=db
                        )
                        await websocket.send_json({
                            "type": "event_ack",
                            "event_type": event_type_str,
                            "recorded": (event is not None),
                            "server_time": now_iso
                        })
                    except Exception as err:
                        logger.error(f"Error processing proctor event over WS: {err}")
                        await websocket.send_json({
                            "type": "error",
                            "message": str(err)
                        })

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type '{msg_type}'"
                })

    except WebSocketDisconnect:
        logger.info(f"Student {user.id} disconnected gracefully from proctoring session {session_id}")
    except Exception as exc:
        logger.warning(f"Proctoring WebSocket closed unexpectedly for session {session_id}: {exc}")
