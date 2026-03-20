import uuid
from datetime import datetime, date, time
from typing import List, Optional
from sqlalchemy import String, Boolean, DateTime, Date, Time, Numeric, ForeignKey, Index, text, ARRAY, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from .database import Base

class TimestampMixin:
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"), default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), onupdate=text("now()"))
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

class User(Base, TimestampMixin):
    __tablename__ = "users"
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    timezone: Mapped[str] = mapped_column(String, default="UTC")
    preferences: Mapped[dict] = mapped_column(JSONB, default={})
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class HabitTemplate(Base, TimestampMixin):
    __tablename__ = "habit_templates"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[str] = mapped_column(String, default="custom") # health, career, mental, physical, social, custom
    tracking_type: Mapped[str] = mapped_column(String, default="boolean") # boolean, numeric, duration
    target_value: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    target_unit: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    scoring_weight: Mapped[float] = mapped_column(Numeric, default=1.0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(default=0)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    metadata_: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (
        Index("idx_habits_user_id", "user_id"),
        Index("idx_habits_user_category", "user_id", "category"),
    )

class TaskTemplate(Base, TimestampMixin):
    __tablename__ = "task_templates"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    priority_level: Mapped[int] = mapped_column(default=3) # 1=critical, 2=high, 3=medium, 4=low
    scoring_weight: Mapped[float] = mapped_column(Numeric, default=1.0)
    estimated_mins: Mapped[Optional[int]] = mapped_column(nullable=True)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    metadata_: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (Index("idx_tasks_user_id", "user_id"),)

class DailyPlan(Base, TimestampMixin):
    __tablename__ = "daily_plans"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    plan_date: Mapped[date] = mapped_column(Date, nullable=False)
    morning_intention: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    metadata_: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (
        Index("idx_plans_user_date", "user_id", text("plan_date DESC")),
        UniqueConstraint("user_id", "plan_date", name="uq_user_plan_date")
    )

class PlannedTask(Base, TimestampMixin):
    __tablename__ = "planned_tasks"
    daily_plan_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("daily_plans.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    task_template_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("task_templates.id"), nullable=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    priority_rank: Mapped[int] = mapped_column(default=0)
    scheduled_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    estimated_mins: Mapped[Optional[int]] = mapped_column(nullable=True)
    scoring_weight: Mapped[float] = mapped_column(Numeric, default=1.0)
    tags: Mapped[List[str]] = mapped_column(ARRAY(String), default=[])
    metadata_: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (
        Index("idx_planned_tasks_plan_id", "daily_plan_id"),
        Index("idx_planned_tasks_user_id", "user_id"),
    )

class HabitLog(Base, TimestampMixin):
    __tablename__ = "habit_logs"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    habit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("habit_templates.id", ondelete="CASCADE"))
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    numeric_value: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    duration_secs: Mapped[Optional[int]] = mapped_column(nullable=True)
    target_value: Mapped[Optional[float]] = mapped_column(Numeric, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))
    metadata_: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (
        Index("idx_habit_logs_user_date", "user_id", text("log_date DESC")),
        Index("idx_habit_logs_habit_date", "habit_id", text("log_date DESC")),
        UniqueConstraint("user_id", "habit_id", "log_date", name="uq_user_habit_log_date")
    )

    @property
    def completion_ratio(self) -> float:
        if self.completed is not None:
            return 1.0 if self.completed else 0.0
        if self.target_value and self.target_value > 0:
            actual = self.numeric_value or (self.duration_secs / 60 if self.duration_secs else 0)
            return min(actual / float(self.target_value), 1.0)
        return 1.0

class TaskLog(Base, TimestampMixin):
    __tablename__ = "task_logs"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    planned_task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("planned_tasks.id", ondelete="CASCADE"), unique=True)
    log_date: Mapped[date] = mapped_column(Date, nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    actual_mins: Mapped[Optional[int]] = mapped_column(nullable=True)
    completion_note: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (Index("idx_task_logs_user_date", "user_id", text("log_date DESC")),)

class ReflectionTemplate(Base, TimestampMixin):
    __tablename__ = "reflection_templates"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    questions: Mapped[list] = mapped_column(JSONB, default=[]) # [{"id": "uuid", "text": str, "type": "text"|"multiline"|"rating", "order": int}]

    __table_args__ = (Index("idx_ref_templates_user_id", "user_id"),)

class ReflectionEntry(Base, TimestampMixin):
    __tablename__ = "reflection_entries"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("reflection_templates.id"), nullable=True)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    answers: Mapped[dict] = mapped_column(JSONB, default={}) # {"question_id": {"text": str, "rating": int}}
    mood_score: Mapped[Optional[int]] = mapped_column(nullable=True)
    energy_score: Mapped[Optional[int]] = mapped_column(nullable=True)

    __table_args__ = (
        Index("idx_ref_entries_user_date", "user_id", text("entry_date DESC")),
        UniqueConstraint("user_id", "entry_date", name="uq_user_reflection_entry_date")
    )

class ScoringRule(Base, TimestampMixin):
    __tablename__ = "scoring_rules"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    habit_weight: Mapped[float] = mapped_column(Numeric, default=0.5)
    task_weight: Mapped[float] = mapped_column(Numeric, default=0.4)
    reflection_weight: Mapped[float] = mapped_column(Numeric, default=0.1)
    formula_config: Mapped[dict] = mapped_column(JSONB, default={})

    __table_args__ = (Index("idx_scoring_rules_user_id", "user_id"),)

class DisciplineScore(Base, TimestampMixin):
    __tablename__ = "discipline_scores"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    score_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[str] = mapped_column(String, default="daily") # daily, weekly, monthly
    period_key: Mapped[str] = mapped_column(String, nullable=False)
    raw_score: Mapped[float] = mapped_column(Numeric, default=0)
    habit_score: Mapped[float] = mapped_column(Numeric, default=0)
    task_score: Mapped[float] = mapped_column(Numeric, default=0)
    reflection_score: Mapped[float] = mapped_column(Numeric, default=0)
    habits_completed: Mapped[int] = mapped_column(default=0)
    habits_total: Mapped[int] = mapped_column(default=0)
    tasks_completed: Mapped[int] = mapped_column(default=0)
    tasks_total: Mapped[int] = mapped_column(default=0)
    breakdown: Mapped[dict] = mapped_column(JSONB, default={})
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"))

    __table_args__ = (
        Index("idx_scores_user_date", "user_id", text("score_date DESC")),
        Index("idx_scores_user_period", "user_id", "period_type", "period_key"),
        UniqueConstraint("user_id", "period_type", "period_key", name="uq_user_period_score")
    )

class Streak(Base, TimestampMixin):
    __tablename__ = "streaks"
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    habit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("habit_templates.id", ondelete="CASCADE"))
    current_streak: Mapped[int] = mapped_column(default=0)
    longest_streak: Mapped[int] = mapped_column(default=0)
    streak_start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    last_completed_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    total_completions: Mapped[int] = mapped_column(default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        Index("idx_streaks_user_id", "user_id"),
        UniqueConstraint("user_id", "habit_id", name="uq_user_habit_streak")
    )
