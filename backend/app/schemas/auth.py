from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from app.schemas.user import UserResponse
from app.models.user import UserRole

class LoginRequest(BaseModel):
    email: EmailStr = Field(..., examples=["student@example.com"])
    password: str = Field(..., examples=["Student@123"])

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user: UserResponse

class TokenPayload(BaseModel):
    sub: str
    role: UserRole
    exp: Optional[int] = None
