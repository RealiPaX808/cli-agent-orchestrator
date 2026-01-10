from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SessionStatus(str, Enum):
    ACTIVE = "active"
    DETACHED = "detached"
    TERMINATED = "terminated"


class Session(BaseModel):
    model_config = ConfigDict(use_enum_values=True)

    id: str = Field(..., description="Unique session identifier")
    name: str = Field(..., description="Human-readable session name")
    status: SessionStatus = Field(..., description="Current session status")
    workflow_id: Optional[str] = Field(None, description="Assigned workflow ID")
    execution_state: Optional[dict] = Field(
        None, description="Workflow execution state"
    )
