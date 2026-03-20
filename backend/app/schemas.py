from pydantic import BaseModel, EmailStr, Field, ConfigDict
from datetime import datetime, date, time
from typing import List, Optional, Dict, Any
import uuid

class TimestampSchema(BaseModel):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

# --- AUTH ---

class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str
    display_name: Optional[str] = None
    timezone: str = "UTC"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRead(TimestampSchema):
    email: EmailStr
    username: str
    display_name: Optional[str]
    timezone: str
    preferences: Dict[str, Any]
    is_active: bool

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int

# --- HABITS ---

class HabitBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "custom"
    tracking_type: str = "boolean"
    target_value: Optional[float] = None
    target_unit: Optional[str] = None
    scoring_weight: float = 1.0
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: bool = True
    display_order: int = 0
    metadata_: Dict[str, Any] = Field(default_factory=dict)

class HabitCreate(HabitBase):
    pass

class HabitUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    tracking_type: Optional[str] = None
    target_value: Optional[float] = None
    target_unit: Optional[str] = None
    scoring_weight: Optional[float] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    metadata_: Optional[Dict[str, Any]] = Field(default=None)

class HabitRead(HabitBase, TimestampSchema):
    user_id: uuid.UUID

class HabitStats(BaseModel):
    habit_id: uuid.UUID
    name: str
    total_logs: int
    completion_rate: float
    current_streak: int
    longest_streak: int
    last_7_days: List[Dict[str, Any]]

# --- TASKS ---

class TaskTemplateBase(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    priority_level: int = 3
    scoring_weight: float = 1.0
    estimated_mins: Optional[int] = None
    tags: List[str] = []
    metadata_: Dict[str, Any] = Field(default_factory=dict)

class TaskTemplateCreate(TaskTemplateBase):
    pass

class TaskTemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority_level: Optional[int] = None
    scoring_weight: Optional[float] = None
    estimated_mins: Optional[int] = None
    tags: Optional[List[str]] = None
    metadata_: Optional[Dict[str, Any]] = Field(default=None)

class TaskTemplateRead(TaskTemplateBase, TimestampSchema):
    user_id: uuid.UUID

# --- DAILY PLANS ---

class PlannedTaskCreate(BaseModel):
    title: str
    priority_rank: int = 0
    scheduled_time: Optional[time] = None
    estimated_mins: Optional[int] = None
    scoring_weight: float = 1.0
    task_template_id: Optional[uuid.UUID] = None
    timer_enabled: bool = False

class PlannedTaskRead(TimestampSchema):
    title: str
    priority_rank: int
    scheduled_time: Optional[time]
    estimated_mins: Optional[int]
    scoring_weight: float
    timer_enabled: bool = False
    completed: bool = False
    actual_mins: Optional[int] = None
    total_seconds: int = 0
    is_running: bool = False
    started_at: Optional[datetime] = None
    completion_note: Optional[str] = None

class DailyPlanCreate(BaseModel):
    morning_intention: Optional[str] = None
    notes: Optional[str] = None
    tasks: List[PlannedTaskCreate] = []

class DailyPlanRead(TimestampSchema):
    plan_date: date
    morning_intention: Optional[str]
    notes: Optional[str]
    tasks: List[PlannedTaskRead]

# --- TRACKING ---

class HabitLogCreate(BaseModel):
    habit_id: uuid.UUID
    completed: Optional[bool] = None
    numeric_value: Optional[float] = None
    duration_secs: Optional[int] = None
    notes: Optional[str] = None

class HabitLogRead(TimestampSchema):
    habit_id: uuid.UUID
    log_date: date
    completed: Optional[bool]
    numeric_value: Optional[float]
    duration_secs: Optional[int]
    target_value: Optional[float]
    completion_ratio: float
    notes: Optional[str]

class TaskLogCreate(BaseModel):
    planned_task_id: uuid.UUID
    completed: bool
    actual_mins: Optional[int] = None
    completion_note: Optional[str] = None

class TrackingDayRead(BaseModel):
    date: date
    habits: List[Dict[str, Any]]
    tasks: List[Dict[str, Any]]
    has_reflection: bool
    discipline_score: Optional[float]

# --- REFLECTIONS ---

class ReflectionQuestion(BaseModel):
    id: Optional[str] = None
    text: str
    type: str # text, multiline, rating
    order: int

class ReflectionTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    questions: List[ReflectionQuestion]

class ReflectionTemplateRead(TimestampSchema):
    user_id: uuid.UUID
    name: str
    description: Optional[str]
    is_default: bool
    questions: List[Dict[str, Any]]

class ReflectionEntryCreate(BaseModel):
    template_id: Optional[uuid.UUID] = None
    answers: Dict[str, Any]
    mood_score: Optional[int] = None
    energy_score: Optional[int] = None

class ReflectionEntryRead(TimestampSchema):
    template_id: Optional[uuid.UUID]
    entry_date: date
    answers: Dict[str, Any]
    mood_score: Optional[int]
    energy_score: Optional[int]

# --- SCORING & ANALYTICS ---

class ScoringRuleBase(BaseModel):
    name: str
    habit_weight: float = 0.5
    task_weight: float = 0.4
    reflection_weight: float = 0.1
    formula_config: Dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True

class ScoringRuleCreate(ScoringRuleBase):
    pass

class ScoringRuleUpdate(BaseModel):
    name: Optional[str] = None
    habit_weight: Optional[float] = None
    task_weight: Optional[float] = None
    reflection_weight: Optional[float] = None
    formula_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class ScoringRuleSchema(ScoringRuleBase, TimestampSchema):
    user_id: uuid.UUID

class DisciplineScoreRead(TimestampSchema):
    user_id: uuid.UUID
    score_date: date
    period_type: str
    period_key: str
    raw_score: float
    habit_score: float
    task_score: float
    reflection_score: float
    habits_completed: int
    habits_total: int
    tasks_completed: int
    tasks_total: int
    breakdown: Dict[str, Any]
    computed_at: datetime

class DashboardRead(BaseModel):
    date: date
    discipline_score: float
    habits: Dict[str, Any]
    tasks: Dict[str, Any]
    has_reflection: bool
    streaks: List[Dict[str, Any]]
    week_score_trend: List[float]
    habit_list: List[Dict[str, Any]] = []

# --- REPORTS ---

class ReportRequest(BaseModel):
    report_type: str # weekly, monthly, habit_history, full
    period_start: date
    period_end: date
    format: str # pdf, csv, json
    include_sections: List[str] = []

class ReportJobSchema(BaseModel):
    job_id: str
    status: str # queued, processing, done, failed
    download_url: Optional[str] = None
