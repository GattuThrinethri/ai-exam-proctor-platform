from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator
from app.schemas.question import QuestionResponse

class ExamBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=255, examples=["DBMS Midterm Examination"])
    subject: str = Field(..., min_length=1, max_length=100, examples=["DBMS"])
    description: Optional[str] = Field(None, max_length=2000)
    duration: int = Field(..., gt=0, examples=[60], description="Exam duration in minutes")
    question_count: int = Field(..., gt=0, examples=[10], description="Expected number of questions")
    start_time: datetime = Field(..., description="Start of exam availability window")
    end_time: datetime = Field(..., description="End of exam availability window")
    randomization_enabled: bool = Field(default=True, description="Shuffle question order per student")
    negative_marking_enabled: bool = Field(default=False)
    proctoring_enabled: bool = Field(default=True)
    gaze_sensitivity: str = Field(default="medium", examples=["low", "medium", "high"])
    max_tab_switch_warnings: int = Field(default=3, ge=0)

    @model_validator(mode="after")
    def validate_exam_window_and_settings(self):
        if self.start_time >= self.end_time:
            raise ValueError("Exam start_time must be strictly before end_time")
        if self.gaze_sensitivity.lower() not in ("low", "medium", "high"):
            raise ValueError("gaze_sensitivity must be one of: 'low', 'medium', 'high'")
        return self

class ExamCreate(ExamBase):
    question_ids: Optional[List[int]] = Field(default=None, description="Optional initial list of question IDs to attach")

class ExamUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    duration: Optional[int] = Field(None, gt=0)
    question_count: Optional[int] = Field(None, gt=0)
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    randomization_enabled: Optional[bool] = None
    negative_marking_enabled: Optional[bool] = None
    proctoring_enabled: Optional[bool] = None
    gaze_sensitivity: Optional[str] = None
    max_tab_switch_warnings: Optional[int] = Field(None, ge=0)
    question_ids: Optional[List[int]] = None

    @model_validator(mode="after")
    def validate_update(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("Exam start_time must be strictly before end_time")
        if self.gaze_sensitivity and self.gaze_sensitivity.lower() not in ("low", "medium", "high"):
            raise ValueError("gaze_sensitivity must be one of: 'low', 'medium', 'high'")
        return self

class ExamQuestionAttach(BaseModel):
    question_ids: List[int] = Field(..., min_length=1, description="List of question IDs to assign to exam")

class ExamDetailResponse(ExamBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    created_at: datetime
    questions: List[QuestionResponse] = []

class ExamListItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    subject: str
    description: Optional[str] = None
    duration: int
    question_count: int
    start_time: datetime
    end_time: datetime
    randomization_enabled: bool
    negative_marking_enabled: bool
    proctoring_enabled: bool
    is_active_window: bool = False
