import logging
from datetime import datetime, timezone
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import AsyncSessionLocal
from app.models.session import ExamSession, SessionStatus
from app.models.exam import Exam

logger = logging.getLogger("timer_service")

scheduler = AsyncIOScheduler()

def calculate_remaining_seconds(
    session: ExamSession,
    duration_minutes: int,
    now: Optional[datetime] = None
) -> int:
    """
    Calculate authoritative server-side remaining time in seconds.
    Never trusts client clocks.
    """
    current_time = now or datetime.now(timezone.utc)
    # Ensure started_at is timezone-aware
    started = session.started_at
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    
    elapsed_seconds = (current_time - started).total_seconds()
    total_allowed_seconds = duration_minutes * 60
    remaining = int(total_allowed_seconds - elapsed_seconds)
    return max(0, remaining)

def is_session_expired(
    session: ExamSession,
    duration_minutes: int,
    now: Optional[datetime] = None
) -> bool:
    """Check if session duration has elapsed according to server time."""
    return calculate_remaining_seconds(session, duration_minutes, now) <= 0

async def check_and_expire_sessions():
    """Background task running via APScheduler to automatically transition timed-out sessions."""
    try:
        now = datetime.now(timezone.utc)
        async with AsyncSessionLocal() as db:
            stmt = (
                select(ExamSession)
                .options(selectinload(ExamSession.exam))
                .where(ExamSession.status == SessionStatus.IN_PROGRESS)
            )
            res = await db.execute(stmt)
            active_sessions = res.scalars().all()

            expired_sessions = []
            for session in active_sessions:
                if session.exam and is_session_expired(session, session.exam.duration, now):
                    session.status = SessionStatus.TIMED_OUT
                    session.submitted_at = now
                    expired_sessions.append(session.id)

            if expired_sessions:
                await db.commit()
                logger.info(f"APScheduler: Auto-submitted {len(expired_sessions)} timed-out exam sessions.")
                from app.services.evaluation_service import evaluate_session
                for sess_id in expired_sessions:
                    try:
                        await evaluate_session(sess_id, db)
                    except Exception as eval_err:
                        logger.error(f"Error evaluating timed out session {sess_id}: {eval_err}")
    except Exception as e:
        logger.error(f"Error checking timed-out exam sessions in APScheduler: {e}")

def start_scheduler():
    """Start background scheduler if not already running."""
    if not scheduler.running:
        scheduler.add_job(
            check_and_expire_sessions,
            "interval",
            seconds=10,
            id="session_timeout_checker",
            replace_existing=True
        )
        scheduler.start()
        logger.info("Exam timeout background scheduler started.")

def shutdown_scheduler():
    """Shutdown background scheduler gracefully."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Exam timeout background scheduler stopped.")
