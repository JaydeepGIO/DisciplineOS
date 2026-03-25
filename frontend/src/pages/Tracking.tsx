import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import { TrackingDay } from '../types';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Clock, Flame, Calendar, ChevronLeft, ChevronRight, BarChart3, Timer } from 'lucide-react';
import TaskTimer from '../components/tracking/TaskTimer';

const Tracking: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const queryClient = useQueryClient();

  const { data: tracking, isLoading } = useQuery<TrackingDay>({
    queryKey: ['tracking', dateStr],
    queryFn: async () => {
      const res = await apiClient.get(`/tracking/${dateStr}`);
      return res.data;
    },
    staleTime: 10000,
  });

  const habitMutation = useMutation({
    mutationFn: ({ habit_id, completed }: { habit_id: string; completed: boolean }) => 
      apiClient.post(`/tracking/habits/${dateStr}`, { habit_id, completed }),
    onSuccess: () => {
      // Small delay to allow async scoring to finish in background
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tracking', dateStr] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }, 1000);
    },
  });

  const taskMutation = useMutation({
    mutationFn: ({ planned_task_id, completed }: { planned_task_id: string; completed: boolean }) => 
      apiClient.post(`/tracking/tasks/${dateStr}`, { planned_task_id, completed }),
    onSuccess: () => {
      // Small delay to allow async scoring to finish in background
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['tracking', dateStr] });
        queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }, 1000);
    },
  });

  const shiftDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  if (isLoading) return <div className="p-8">Loading tracking data...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-textPrimary">Daily Tracking</h2>
          <p className="text-textMuted font-medium">Log your activities and maintain your discipline.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-card border border-border p-1.5 rounded-2xl">
          <button onClick={() => shiftDate(-1)} className="p-2 hover:bg-surface rounded-xl transition-colors text-textPrimary">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-3 font-bold text-sm text-textPrimary">
            <Calendar className="w-4 h-4 text-primary" />
            {format(selectedDate, 'PPP')}
          </div>
          <button onClick={() => shiftDate(1)} className="p-2 hover:bg-surface rounded-xl transition-colors text-textPrimary">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Habits Column */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold flex items-center gap-2 text-textPrimary">
              <Flame className="w-5 h-5 text-accent" />
              Habits
            </h3>
            <span className="text-xs font-bold text-textMuted">
              {tracking?.habits.filter(h => h.completed).length}/{tracking?.habits.length} DONE
            </span>
          </div>

          <div className="space-y-3">
            {tracking?.habits.map((habit) => (
              <div 
                key={habit.habit_id}
                onClick={() => habitMutation.mutate({ habit_id: habit.habit_id, completed: !habit.completed })}
                className={`
                  group cursor-pointer p-4 rounded-3xl border transition-all flex items-center gap-4
                  ${habit.completed 
                    ? 'bg-card border-success/30 shadow-lg shadow-success/5' 
                    : 'bg-card border-border hover:border-accent/50'}
                `}
              >
                <div className={`
                  w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors
                  ${habit.completed ? 'bg-success border-success text-white' : 'border-border group-hover:border-accent'}
                `}>
                  {habit.completed && <CheckCircle2 className="w-4 h-4" />}
                </div>
                
                <div className="flex-1">
                  <h4 className={`font-bold transition-colors ${habit.completed ? 'text-success' : 'text-textPrimary'}`}>
                    {habit.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-500" 
                        style={{ 
                          width: `${habit.completion_ratio * 100}%`,
                          backgroundColor: habit.color || '#6366f1'
                        }} 
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!tracking?.habits || tracking.habits.length === 0) && (
              <div className="p-8 text-center bg-surface/30 rounded-3xl border border-dashed border-border text-textMuted text-sm font-medium">
                No habits defined for this day.
              </div>
            )}
          </div>
        </section>

        {/* Tasks Column */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-bold flex items-center gap-2 text-textPrimary">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Tasks
            </h3>
            <span className="text-xs font-bold text-textMuted">
              {tracking?.tasks.filter(t => t.completed).length}/{tracking?.tasks.length} DONE
            </span>
          </div>

          <div className="space-y-3">
            {tracking?.tasks.map((task) => (
              <div key={task.task_id} className="space-y-3">
                <div 
                  onClick={() => !task.timer_enabled && taskMutation.mutate({ planned_task_id: task.task_id, completed: !task.completed })}
                  className={`
                    group p-4 rounded-3xl border transition-all flex items-center gap-4
                    ${task.completed 
                      ? 'bg-card border-primary/30 opacity-75 shadow-lg shadow-primary/5' 
                      : 'bg-card border-border hover:border-primary/50'}
                    ${task.timer_enabled ? 'cursor-default' : 'cursor-pointer'}
                  `}
                >
                  <div className={`
                    w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors
                    ${task.completed ? 'bg-primary border-primary text-white' : 'border-border group-hover:border-primary'}
                  `}>
                    {task.completed && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className={`font-bold transition-all ${task.completed ? 'line-through text-textMuted' : 'text-textPrimary'}`}>
                      {task.title}
                    </h4>
                    {task.actual_mins && (
                      <span className="text-[10px] font-mono text-textMuted uppercase tracking-tighter">
                        Actual Time: {task.actual_mins}m
                      </span>
                    )}
                  </div>

                  {task.timer_enabled && !task.completed && (
                    <Timer className="w-4 h-4 text-primary/50" />
                  )}
                </div>

                {task.timer_enabled && !task.completed && (
                  <TaskTimer 
                    taskId={task.task_id}
                    initialSeconds={task.total_seconds}
                    isRunning={task.is_running}
                    startedAt={task.started_at}
                  />
                )}
                
                {task.completion_note && (
                  <div className="mx-6 p-3 bg-surface/50 border-l-2 border-primary/20 rounded-r-xl text-xs text-textMuted italic font-medium">
                    "{task.completion_note}"
                  </div>
                )}
              </div>
            ))}
            {(!tracking?.tasks || tracking.tasks.length === 0) && (
              <div className="p-8 text-center bg-surface/30 rounded-3xl border border-dashed border-border text-textMuted text-sm font-medium">
                No tasks planned for today.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Score Summary Card */}
      <div className="bg-primary/10 border border-primary/20 p-8 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl shadow-primary/5 transition-colors">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-2xl font-bold text-textPrimary">Today's Discipline</h3>
          <p className="text-textMuted font-medium leading-relaxed max-w-md">Your score is calculated based on habit completion and task consistency.</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs font-bold text-primary uppercase tracking-widest">Current Score</p>
            <p className="text-5xl font-black font-mono tracking-tighter text-textPrimary">{Math.round(tracking?.discipline_score || 0)}</p>
          </div>
          <div className="w-px h-12 bg-primary/20 hidden md:block" />
          <div className="bg-primary text-white p-4 rounded-3xl shadow-lg shadow-primary/20">
             <BarChart3 className="w-8 h-8" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tracking;
