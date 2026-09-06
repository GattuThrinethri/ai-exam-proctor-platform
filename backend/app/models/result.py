from datetime import datetime, timezone
from sqlalchemy import Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    total_score: Mapped[float] = mapped_column(Float, nullable=False)
    objective_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    subjective_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    percentile: Mapped[float | None] = mapped_column(Float, nullable=True)
    published: Mapped[bool] = mapped_column(Boolean, default=False, index=True, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="result")
