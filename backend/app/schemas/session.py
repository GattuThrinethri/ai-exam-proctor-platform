from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict
from app.models.question import QuestionType
from app.models.session import SessionStatus

class StudentOptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    option_text: str

class StudentQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    question_text: str
    question_type: QuestionType
    difficulty: str
    marks: float
    options: List[StudentOptionResponse] = []
    image_url: Optional[str] = None

class StudentExamPaperResponse(BaseModel):
    session_id: int
    exam_id: int
    title: str
    subject: str
    description: Optional[str] = None
    duration_minutes: int
    started_at: datetime
    server_time: datetime
    remaining_seconds: int
    proctoring_enabled: bool = True
    questions: List[StudentQuestionResponse]

class ExamEnterRequest(BaseModel):
    exam_id: int
    exam_token: Optional[str] = None

class ExamSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    exam_id: int
    student_id: int
    session_token: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    status: SessionStatus
    duration_minutes: int
    server_time: datetime
    remaining_seconds: int
    is_timed_out: bool = False

class ExamTokenResponse(BaseModel):
    exam_id: int
    student_id: int
    access_token: str
    expires_at: datetime
