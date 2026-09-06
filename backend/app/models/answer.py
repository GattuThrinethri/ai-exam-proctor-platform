from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, Float, DateTime, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (
        UniqueConstraint("session_id", "question_id", name="uq_session_question_answer"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exam_sessions.id", ondelete="CASCADE"), index=True, nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("question_bank.id", ondelete="CASCADE"), index=True, nullable=False
    )
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    selected_option_ids: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ocr_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )
    auto_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_justification: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    examiner_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    examiner_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    annotations: Mapped[dict | list | None] = mapped_column(JSON, nullable=True)

    # Relationships
    session: Mapped["ExamSession"] = relationship("ExamSession", back_populates="answers")
    question: Mapped["QuestionBank"] = relationship("QuestionBank", back_populates="answers", lazy="selectin")
