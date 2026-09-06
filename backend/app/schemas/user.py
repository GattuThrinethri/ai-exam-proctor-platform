from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional
from app.models.user import UserRole, ApprovalStatus

class UserBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, examples=["John Doe"])
    email: EmailStr = Field(..., examples=["student@example.com"])
    role: UserRole = Field(default=UserRole.STUDENT, examples=["student"])

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=100, examples=["SecurePass123!"])

class UserUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    role: UserRole
    approval_status: ApprovalStatus = ApprovalStatus.APPROVED
    is_active: bool
    created_at: datetime
