from pydantic import BaseModel, Field
from typing import Optional, Literal
from enum import Enum

class TaskMode(str, Enum):
    VISUAL = "visual"
    BACKGROUND = "background"

class TaskStatusEnum(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"

class TaskComplexity(str, Enum):
    SIMPLE = "simple"
    COMPLEX = "complex"

class TaskRequest(BaseModel):
    task: str = Field(..., description="Description of the automation task to perform", min_length=1)
    mode: TaskMode = Field(default=TaskMode.VISUAL, description="Execution mode: visual or background")
    
    class Config:
        json_schema_extra = {
            "example": {
                "task": "Create a pivot table from data in Sheet1 and format it with blue theme",
                "mode": "visual"
            }
        }

class TaskResponse(BaseModel):
    task_id: str = Field(..., description="Unique identifier for the task")
    status: TaskStatusEnum = Field(..., description="Current status of the task")
    message: str = Field(default="", description="Status message or description")
    progress: Optional[int] = Field(default=None, description="Progress percentage (0-100)", ge=0, le=100)
    result: Optional[str] = Field(default=None, description="Task result or output")
    error: Optional[str] = Field(default=None, description="Error message if task failed")
    complexity: Optional[TaskComplexity] = Field(default=None, description="Task complexity level")
    
    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "task_123456789",
                "status": "completed",
                "message": "Pivot table created successfully",
                "progress": 100,
                "result": "Pivot table created in Sheet2 with blue theme applied",
                "error": None,
                "complexity": "simple"
            }
        }

class TaskStatus(BaseModel):
    task_id: str
    status: TaskStatusEnum
    message: str = ""
    progress: Optional[int] = None
    result: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    updated_at: str
    complexity: TaskComplexity = TaskComplexity.SIMPLE