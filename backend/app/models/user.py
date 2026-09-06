import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class UserRole(str, enum.Enum):
    STUDENT = "student"
    EXAMINER = "examiner"
    ADMIN = "admin"

class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum", native_enum=True),
        default=UserRole.STUDENT,
        nullable=False,
        index=True
    )
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus, name="approval_status_enum", native_enum=True, values_callable=lambda x: [e.value for e in x]),
        default=ApprovalStatus.APPROVED,
        server_default="approved",
        nullable=False,
        index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False
    )

    # Relationships
    questions: Mapped[list["QuestionBank"]] = relationship(
        "QuestionBank", back_populates="creator", cascade="all, delete-orphan"
    )
    created_exams: Mapped[list["Exam"]] = relationship(
        "Exam", back_populates="creator", cascade="all, delete-orphan"
    )
    sessions: Mapped[list["ExamSession"]] = relationship(
        "ExamSession", back_populates="student", cascade="all, delete-orphan"
    )
