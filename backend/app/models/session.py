import enum
from datetime import datetime, timezone
from sqlalchemy import String, Integer, DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class SessionStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    TIMED_OUT = "timed_out"

class ExamSession(Base):
    __tablename__ = "exam_sessions"
    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_exam_student_session"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exams.id", ondelete="CASCADE"), index=True, nullable=False
    )
    student_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    session_token: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status_enum", native_enum=True),
        default=SessionStatus.IN_PROGRESS,
        nullable=False,
        index=True
    )
    suspicion_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam", back_populates="sessions")
    student: Mapped["User"] = relationship("User", back_populates="sessions")
    answers: Mapped[list["Answer"]] = relationship(
        "Answer", back_populates="session", cascade="all, delete-orphan"
    )
    result: Mapped["Result | None"] = relationship(
        "Result", back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    proctor_events: Mapped[list["ProctorEvent"]] = relationship(
        "ProctorEvent", back_populates="session", cascade="all, delete-orphan"
    )
