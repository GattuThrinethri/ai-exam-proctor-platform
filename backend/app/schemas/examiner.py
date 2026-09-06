from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class ExaminerDashboardStats(BaseModel):
    total_questions: int
    total_exams: int
    active_exams: int
    completed_exams: int
    pending_evaluations: int
    flagged_sessions: int


class ExaminerResultItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    exam_id: int
    exam_title: str
    student_id: int
    student_name: str
    student_email: str
    total_score: float
    objective_score: float
    subjective_score: float
    status: str
    suspicion_score: int
    submitted_at: Optional[datetime] = None
    generated_at: datetime


class ExaminerProctoringSessionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: int
    exam_id: int
    exam_title: str
    student_id: int
    student_name: str
    student_email: str
    suspicion_score: int
    event_count: int
    status: str
    started_at: datetime
    submitted_at: Optional[datetime] = None
    has_evidence_snapshot: bool
