import React, { useState } from 'react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  subWeeks, 
  isSameDay,
  isToday 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';

const WeeklyView: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const { data: scores, isLoading } = useQuery({
    queryKey: ['scores', 'daily', format(weekStart, 'yyyy-MM-dd')],
    queryFn: () => analyticsApi.getScores({ period_type: 'daily', limit: 30 }),
  });

  const getScoreForDay = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return scores?.find(s => s.score_date === dateStr);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-textPrimary">Weekly Performance</h1>
          <p className="text-textMuted mt-1">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={goToToday}
            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-card transition-colors"
          >
            Today
          </button>
          <div className="flex items-center bg-surface border border-border rounded-lg">
            <button onClick={prevWeek} className="p-2 hover:bg-card border-r border-border transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-4 py-2 text-sm font-medium flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-primary" />
              <span>This Week</span>
            </div>
            <button onClick={nextWeek} className="p-2 hover:bg-card border-l border-border transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {days.map((day) => {
          const dayScore = getScoreForDay(day);
          const isCurrentDay = isToday(day);
          
          return (
            <div 
              key={day.toString()} 
              className={`
                bg-card rounded-xl border p-4 flex flex-col items-center gap-4 transition-all
                ${isCurrentDay ? 'border-primary ring-1 ring-primary/20' : 'border-border'}
              `}
            >
              <div className="text-center">
                <p className={`text-xs font-bold uppercase tracking-wider ${isCurrentDay ? 'text-primary' : 'text-textMuted'}`}>
                  {format(day, 'EEE')}
                </p>
                <p className="text-xl font-bold mt-1">{format(day, 'd')}</p>
              </div>

              {dayScore ? (
                <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center font-mono text-xl font-bold ${getScoreColor(dayScore.raw_score)}`}>
                  {Math.round(dayScore.raw_score)}
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center text-textMuted text-xs font-medium italic">
                  —
                </div>
              )}

              <div className="w-full space-y-3 mt-2">
                <div className="flex justify-between text-[10px] text-textMuted uppercase font-bold tracking-tight">
                  <span>Habits</span>
                  <span>{dayScore?.habits_completed || 0}/{dayScore?.habits_total || 0}</span>
                </div>
                <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${dayScore ? (dayScore.habits_completed / dayScore.habits_total) * 100 : 0}%` }}
                  />
                </div>
                
                <div className="flex justify-between text-[10px] text-textMuted uppercase font-bold tracking-tight">
                  <span>Tasks</span>
                  <span>{dayScore?.tasks_completed || 0}/{dayScore?.tasks_total || 0}</span>
                </div>
                <div className="w-full bg-surface h-1 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-accent transition-all duration-500" 
                    style={{ width: `${dayScore ? (dayScore.tasks_completed / dayScore.tasks_total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-textMuted italic">"Discipline is the bridge between goals and accomplishment."</p>
      </div>
    </div>
  );
};

export default WeeklyView;
