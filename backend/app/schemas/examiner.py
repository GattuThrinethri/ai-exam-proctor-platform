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
    published: bool = False
    requires_evaluation: bool = False
    submitted_at: Optional[datetime] = None
    generated_at: datetime


class QuestionScoreInput(BaseModel):
    question_id: int
    marks_awarded: float
    feedback: Optional[str] = None


class ExaminerFinalizeEvaluationRequest(BaseModel):
    evaluations: List[QuestionScoreInput]
    publish_result: bool = True


class ExaminerQuestionEvaluationItem(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    difficulty: str
    marks: float
    student_answer_text: Optional[str] = None
    student_selected_option_ids: Optional[List[int]] = None
    student_image_url: Optional[str] = None
    ocr_extracted_text: Optional[str] = None
    options: Optional[List[dict]] = None
    expected_answer: Optional[str] = None
    model_answer: Optional[str] = None
    auto_score: Optional[float] = None
    ai_score: Optional[float] = None
    examiner_score: Optional[float] = None
    examiner_feedback: Optional[str] = None


class ExaminerEvaluationSessionResponse(BaseModel):
    session_id: int
    exam_id: int
    exam_title: str
    subject: str
    duration_minutes: int
    student_id: int
    student_name: str
    student_email: str
    status: str
    published: bool
    submitted_at: Optional[datetime] = None
    total_score: float
    objective_score: float
    subjective_score: float
    max_score: float
    questions: List[ExaminerQuestionEvaluationItem]


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
