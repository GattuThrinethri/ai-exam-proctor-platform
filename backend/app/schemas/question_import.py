from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class ImportedOption(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    option_text: str = Field(..., min_length=1, max_length=1000)
    is_correct: bool = False

class ExtractedQuestion(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    temp_id: str
    question_text: str = Field(..., min_length=1)
    question_type: str = Field(default="MCQ")
    options: List[ImportedOption] = Field(default_factory=list)
    correct_answer: Optional[str] = None
    subject: Optional[str] = None
    difficulty: str = Field(default="medium")
    marks: float = Field(default=1.0, gt=0)
    negative_marks: float = Field(default=0.0, ge=0)
    model_answer: Optional[str] = None
    expected_answer: Optional[str] = None
    is_duplicate: bool = False
    duplicate_reason: Optional[str] = None

class ImportPreviewResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    filename: str
    file_type: str
    file_size: int
    detected_subject: Optional[str] = None
    total_extracted: int
    duplicate_count: int
    questions: List[ExtractedQuestion]

class ImportConfirmItem(BaseModel):
    question_text: str = Field(..., min_length=1)
    question_type: str = Field(default="MCQ")
    options: Optional[List[ImportedOption]] = None
    correct_answer: Optional[str] = None
    subject: Optional[str] = None
    difficulty: str = Field(default="medium")
    marks: float = Field(default=1.0, gt=0)
    negative_marks: float = Field(default=0.0, ge=0)
    model_answer: Optional[str] = None
    expected_answer: Optional[str] = None

class ImportConfirmRequest(BaseModel):
    questions: List[ImportConfirmItem] = Field(..., min_length=1)
    default_subject: Optional[str] = None

class ImportConfirmResponse(BaseModel):
    imported_count: int
    skipped_count: int
    question_ids: List[int]
