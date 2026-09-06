from datetime import datetime
import enum
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ProctorEventType(str, enum.Enum):
    FACE_ABSENT = "FACE_ABSENT"
    MULTIPLE_FACES = "MULTIPLE_FACES"
    GAZE_AWAY = "GAZE_AWAY"
    TAB_SWITCH = "TAB_SWITCH"
    WINDOW_BLUR = "WINDOW_BLUR"

class ProctorSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class ProctorEventCreate(BaseModel):
    event_type: ProctorEventType = Field(..., description="Type of proctoring indicator event")
    metadata_json: Optional[Dict[str, Any]] = Field(default=None, description="Diagnostic client metadata")
    webcam_snapshot_url: Optional[str] = Field(default=None, description="Optional safe reference to evidence snapshot")

    model_config = ConfigDict(extra="ignore")


class ProctorEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    session_id: int
    event_type: str
    timestamp: datetime
    severity: str
    suspicion_increment: int
    metadata_json: Optional[Dict[str, Any]] = None
    webcam_snapshot_url: Optional[str] = None


class SnapshotUploadResponse(BaseModel):
    snapshot_url: str
    filename: str
    size_bytes: int
    content_type: str


class ProctorHeartbeatRequest(BaseModel):
    timestamp: Optional[datetime] = None

    model_config = ConfigDict(extra="ignore")


class ProctorHeartbeatResponse(BaseModel):
    status: str
    server_time: datetime
    session_status: str
    current_suspicion_level: str = "nominal"
    active_warnings: int = 0
