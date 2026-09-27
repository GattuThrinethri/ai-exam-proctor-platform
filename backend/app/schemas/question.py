from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator
from app.models.question import QuestionType

class QuestionOptionBase(BaseModel):
    option_text: str = Field(..., min_length=1, max_length=1000)
    is_correct: bool = False

class QuestionOptionCreate(QuestionOptionBase):
    pass

class QuestionOptionResponse(QuestionOptionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int

class QuestionBase(BaseModel):
    subject: str = Field(..., min_length=1, max_length=100)
    question_text: str = Field(..., min_length=1)
    question_type: QuestionType
    difficulty: str = Field(default="medium", min_length=1, max_length=50)
    marks: float = Field(..., gt=0)
    negative_marks: float = Field(default=0.0, ge=0)
    model_answer: Optional[str] = None
    expected_answer: Optional[str] = None
    image_url: Optional[str] = None

    @field_validator("question_type", mode="before")
    @classmethod
    def normalize_question_type(cls, v):
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.upper() == "MCQ":
                return QuestionType.MCQ
            for qt in QuestionType:
                if qt.value.lower() == v_clean.lower() or qt.name.lower() == v_clean.lower():
                    return qt
        return v

class QuestionCreate(QuestionBase):
    options: Optional[List[QuestionOptionCreate]] = None

    @model_validator(mode="after")
    def validate_question_rules(self):
        q_type = self.question_type
        options = self.options or []

        if q_type == QuestionType.MCQ:
            if len(options) < 2:
                raise ValueError("MCQ must have at least 2 options")
            
            # Check duplicate options (case-insensitive stripped)
            seen_texts = set()
            for opt in options:
                clean_txt = opt.option_text.strip().lower()
                if clean_txt in seen_texts:
                    raise ValueError(f"Duplicate option text detected: '{opt.option_text}'")
                seen_texts.add(clean_txt)

            correct_count = sum(1 for o in options if o.is_correct)
            if correct_count != 1:
                raise ValueError(f"MCQ must have exactly 1 correct option (found {correct_count})")

        elif q_type == QuestionType.MULTI_SELECT:
            if len(options) < 2:
                raise ValueError("Multi-select must have at least 2 options")
            
            seen_texts = set()
            for opt in options:
                clean_txt = opt.option_text.strip().lower()
                if clean_txt in seen_texts:
                    raise ValueError(f"Duplicate option text detected: '{opt.option_text}'")
                seen_texts.add(clean_txt)

            correct_count = sum(1 for o in options if o.is_correct)
            if correct_count < 1:
                raise ValueError("Multi-select must have at least 1 correct option")

        elif q_type in (QuestionType.SHORT_ANSWER, QuestionType.LONG_ANSWER, QuestionType.IMAGE_UPLOAD):
            if self.marks <= 0:
                raise ValueError("Subjective/image questions must have marks > 0")

        return self

class QuestionUpdate(BaseModel):
    subject: Optional[str] = Field(None, min_length=1, max_length=100)
    question_text: Optional[str] = Field(None, min_length=1)
    question_type: Optional[QuestionType] = None
    difficulty: Optional[str] = Field(None, min_length=1, max_length=50)
    marks: Optional[float] = Field(None, gt=0)
    negative_marks: Optional[float] = Field(None, ge=0)
    model_answer: Optional[str] = None
    expected_answer: Optional[str] = None
    image_url: Optional[str] = None
    options: Optional[List[QuestionOptionCreate]] = None

    @field_validator("question_type", mode="before")
    @classmethod
    def normalize_question_type(cls, v):
        if isinstance(v, str):
            v_clean = v.strip()
            if v_clean.upper() == "MCQ":
                return QuestionType.MCQ
            for qt in QuestionType:
                if qt.value.lower() == v_clean.lower() or qt.name.lower() == v_clean.lower():
                    return qt
        return v

    @model_validator(mode="after")
    def validate_update_rules(self):
        if self.marks is not None and self.marks <= 0:
            raise ValueError("Marks must be greater than 0")
        if self.negative_marks is not None and self.negative_marks < 0:
            raise ValueError("Negative marks must be greater than or equal to 0")

        # If question_type and options are provided, validate their consistency
        if self.question_type is not None and self.options is not None:
            options = self.options
            if self.question_type == QuestionType.MCQ:
                if len(options) < 2:
                    raise ValueError("MCQ must have at least 2 options")
                seen = set()
                for opt in options:
                    t = opt.option_text.strip().lower()
                    if t in seen:
                        raise ValueError(f"Duplicate option text: '{opt.option_text}'")
                    seen.add(t)
                correct_count = sum(1 for o in options if o.is_correct)
                if correct_count != 1:
                    raise ValueError(f"MCQ must have exactly 1 correct option (found {correct_count})")
            elif self.question_type == QuestionType.MULTI_SELECT:
                if len(options) < 2:
                    raise ValueError("Multi-select must have at least 2 options")
                seen = set()
                for opt in options:
                    t = opt.option_text.strip().lower()
                    if t in seen:
                        raise ValueError(f"Duplicate option text: '{opt.option_text}'")
                    seen.add(t)
                correct_count = sum(1 for o in options if o.is_correct)
                if correct_count < 1:
                    raise ValueError("Multi-select must have at least 1 correct option")
        return self

class QuestionResponse(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: int
    created_at: datetime
    options: List[QuestionOptionResponse] = []

class QuestionListResponse(BaseModel):
    total: int
    items: List[QuestionResponse]
    skip: int
    limit: int
