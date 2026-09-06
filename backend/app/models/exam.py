from datetime import datetime, timezone
from sqlalchemy import String, Text, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(100), index=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)  # Duration in minutes
    question_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    randomization_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    negative_marking_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    proctoring_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    gaze_sensitivity: Mapped[str] = mapped_column(String(50), default="medium", nullable=False)
    max_tab_switch_warnings: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    creator: Mapped["User"] = relationship("User", back_populates="created_exams")
    exam_questions: Mapped[list["ExamQuestion"]] = relationship(
        "ExamQuestion", back_populates="exam", cascade="all, delete-orphan", order_by="ExamQuestion.order"
    )
    sessions: Mapped[list["ExamSession"]] = relationship(
        "ExamSession", back_populates="exam", cascade="all, delete-orphan"
    )

class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    exam_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("exams.id", ondelete="CASCADE"), index=True, nullable=False
    )
    question_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("question_bank.id", ondelete="CASCADE"), index=True, nullable=False
    )
    order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    exam: Mapped["Exam"] = relationship("Exam", back_populates="exam_questions")
    question: Mapped["QuestionBank"] = relationship("QuestionBank", back_populates="exam_questions", lazy="selectin")
