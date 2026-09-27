from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict


class StudentResultSummaryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    exam_id: int
    exam_title: str
    subject: str
    total_score: Optional[float] = None
    max_score: float
    objective_score: Optional[float] = None
    subjective_score: Optional[float] = None
    percentage: Optional[float] = None
    percentile: Optional[float] = None
    status: str
    published: bool
    requires_manual_evaluation: Optional[bool] = False
    submitted_at: Optional[datetime] = None
    generated_at: datetime


class QuestionReviewItem(BaseModel):
    question_id: int
    question_text: str
    question_type: str
    difficulty: str
    marks: float
    awarded_score: Optional[float] = None
    student_selected_option_ids: Optional[List[int]] = None
    student_answer_text: Optional[str] = None
    student_image_url: Optional[str] = None
    ocr_extracted_text: Optional[str] = None
    options: Optional[List[dict]] = None
    # Secure solution review fields (populated when published or examiner/admin)
    correct_option_ids: Optional[List[int]] = None
    correct_options_text: Optional[List[str]] = None
    model_answer: Optional[str] = None
    ai_justification: Optional[str] = None
    ai_feedback: Optional[Any] = None


class StudentResultDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    exam_id: int
    exam_title: str
    subject: str
    total_score: Optional[float] = None
    max_score: float
    objective_score: Optional[float] = None
    subjective_score: Optional[float] = None
    percentage: Optional[float] = None
    percentile: Optional[float] = None
    suspicion_score: int
    status: str
    published: bool
    requires_manual_evaluation: Optional[bool] = False
    submitted_at: Optional[datetime] = None
    generated_at: datetime
    question_reviews: List[QuestionReviewItem]


class ResultPublishRequest(BaseModel):
    published: bool
