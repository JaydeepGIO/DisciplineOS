export interface TimestampFields {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface User extends TimestampFields {
  email: string;
  username: string;
  display_name?: string | null;
  timezone: string;
  preferences: Record<string, any>;
  is_active: boolean;
}

export type HabitCategory = 'health' | 'career' | 'mental' | 'physical' | 'social' | 'custom';
export type TrackingType = 'boolean' | 'numeric' | 'duration';

export interface HabitTemplate extends TimestampFields {
  user_id: string;
  name: string;
  description?: string | null;
  category: HabitCategory;
  tracking_type: TrackingType;
  target_value?: number | null;
  target_unit?: string | null;
  scoring_weight: number;
  is_active: boolean;
  display_order: number;
  color?: string | null;
  icon?: string | null;
  metadata?: Record<string, any>;
}

export interface TaskTemplate extends TimestampFields {
  user_id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  priority_level: number;
  scoring_weight: number;
  estimated_mins?: number | null;
  tags: string[];
  metadata?: Record<string, any>;
}

export interface PlannedTask extends TimestampFields {
  daily_plan_id: string;
  user_id: string;
  task_template_id?: string | null;
  title: string;
  description?: string | null;
  priority_rank: number;
  scheduled_time?: string | null;
  estimated_mins?: number | null;
  scoring_weight: number;
  tags: string[];
  timer_enabled: boolean;
  completed: boolean;
  actual_mins?: number | null;
  total_seconds?: number;
  is_running?: boolean;
  started_at?: string | null;
}

export interface DailyPlan extends TimestampFields {
  user_id: string;
  plan_date: string;
  morning_intention?: string | null;
  notes?: string | null;
  tasks: PlannedTask[];
}

export interface HabitLog extends TimestampFields {
  user_id: string;
  habit_id: string;
  log_date: string;
  completed?: boolean | null;
  numeric_value?: number | null;
  duration_secs?: number | null;
  target_value?: number | null;
  notes?: string | null;
  logged_at: string;
  completion_ratio: number;
}

export interface TrackingDay {
  date: string;
  habits: Array<{
    habit_id: string;
    name: string;
    tracking_type: TrackingType;
    target_value?: number | null;
    target_unit?: string | null;
    completed?: boolean | null;
    numeric_value?: number | null;
    duration_secs?: number | null;
    completion_ratio: number;
    notes?: string | null;
    color?: string | null;
  }>;
  tasks: Array<{
    task_id: string;
    title: string;
    priority_rank: number;
    timer_enabled: boolean;
    completed: boolean;
    actual_mins?: number | null;
    completion_note?: string | null;
    total_seconds: number;
    is_running: boolean;
    started_at?: string | null;
  }>;
  has_reflection: boolean;
  discipline_score?: number | null;
}

export interface Streak {
  habit_id: string;
  name: string;
  current_streak: number;
  longest_streak: number;
  color?: string | null;
}

export interface DashboardData {
  date: string;
  discipline_score: number;
  habits: {
    completed: number;
    total: number;
  };
  tasks: {
    completed: number;
    total: number;
  };
  has_reflection: boolean;
  streaks: Streak[];
  week_score_trend: number[];
}
