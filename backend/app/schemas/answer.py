from datetime import datetime
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, ConfigDict

class AnswerSubmitRequest(BaseModel):
    question_id: int = Field(..., description="Target question ID from exam paper")
    selected_option_ids: Optional[List[int]] = Field(
        default=None,
        description="List of selected option IDs (1 for MCQ, multiple for multi_select)"
    )
    answer_text: Optional[str] = Field(
        default=None,
        description="Text content for short_answer or long_answer questions"
    )
    image_url: Optional[str] = Field(
        default=None,
        description="Relative safe path/URL to uploaded answer image"
    )

    model_config = ConfigDict(extra="ignore")


class AnswerUpdateRequest(BaseModel):
    selected_option_ids: Optional[List[int]] = Field(default=None)
    answer_text: Optional[str] = Field(default=None)
    image_url: Optional[str] = Field(default=None)

    model_config = ConfigDict(extra="ignore")


class StudentAnswerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    question_id: int
    selected_option_ids: Optional[List[int]] = None
    answer_text: Optional[str] = None
    image_url: Optional[str] = None
    ocr_text: Optional[str] = None
    word_count: Optional[int] = None
    submitted_at: datetime


class AnswerDetailResponse(StudentAnswerResponse):
    auto_score: Optional[float] = None
    ai_score: Optional[float] = None
    ai_justification: Optional[str] = None
    ai_feedback: Optional[Dict[str, Any]] = None
    examiner_score: Optional[float] = None
    examiner_feedback: Optional[str] = None
    annotations: Optional[Any] = None


class ImageUploadResponse(BaseModel):
    image_url: str
    filename: str
    size_bytes: int
    content_type: str
    ocr_text: Optional[str] = None
