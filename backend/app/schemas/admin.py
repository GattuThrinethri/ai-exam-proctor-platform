from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, EmailStr


class AdminPlatformStats(BaseModel):
    total_users: int
    total_students: int
    total_examiners: int
    total_admins: int
    total_exams: int
    active_exams: int
    total_sessions: int
    completed_sessions: int
    flagged_sessions: int
    average_score: float


class AdminUserItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: str
    approval_status: str = "approved"
    is_active: bool
    created_at: datetime
    session_count: int = 0


class AdminUserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"


class AdminUserRoleUpdate(BaseModel):
    role: str


class AdminUserStatusUpdate(BaseModel):
    is_active: bool


class AdminExamItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subject: str
    duration: int
    question_count: int
    creator_id: int
    creator_name: str
    creator_email: str
    start_time: datetime
    end_time: datetime
    proctoring_enabled: bool
    candidate_count: int
    is_active: bool


class AdminAuditLogItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    user_role: Optional[str] = None
    action: str
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime
