import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { analyticsApi } from '../api/analytics';
import ScoreRing from '../components/ui/ScoreRing';
import { DashboardData } from '../types';
import { Flame, CheckCircle2, Circle, MessageSquarePlus, Check } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => analyticsApi.getDashboard(),
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-64 bg-card rounded-2xl w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-card rounded-2xl" />
          <div className="h-48 bg-card rounded-2xl" />
        </div>
      </div>
    );
  }

  const score = data?.discipline_score || 0;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-textPrimary">Daily Overview</h2>
          <p className="text-textMuted font-medium">Keep building your streak and discipline.</p>
        </div>
      </header>

      {/* Main Score & Top Stats Section */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
        <div className="bg-card border border-border p-8 rounded-[2.5rem] flex items-center justify-center shadow-sm">
          <ScoreRing score={score} />
        </div>
        
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-card border border-border p-6 rounded-[2rem] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-textMuted uppercase text-[10px] tracking-widest">Active Habits</h3>
              <Flame className="w-5 h-5 text-accent" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-mono text-textPrimary">{data?.habits.completed}/{data?.habits.total}</span>
              <span className="text-textMuted text-xs font-bold uppercase tracking-tight">Completed Today</span>
            </div>
            <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
              <div 
                className="bg-accent h-full transition-all duration-1000 ease-out" 
                style={{ width: `${(data?.habits.completed || 0) / (data?.habits.total || 1) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-card border border-border p-6 rounded-[2rem] space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-textMuted uppercase text-[10px] tracking-widest">Tasks Planned</h3>
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold font-mono text-textPrimary">{data?.tasks.completed}/{data?.tasks.total}</span>
              <span className="text-textMuted text-xs font-bold uppercase tracking-tight">Finished</span>
            </div>
            <div className="w-full bg-surface h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-1000 ease-out" 
                style={{ width: `${(data?.tasks.completed || 0) / (data?.tasks.total || 1) * 100}%` }}
              />
            </div>
          </div>

          <Link 
            to="/reflection"
            className="md:col-span-2 bg-surface border border-dashed border-border p-6 rounded-[2rem] flex items-center justify-between group cursor-pointer hover:border-accent hover:bg-card transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="bg-card p-3 rounded-2xl group-hover:bg-accent group-hover:text-white transition-colors border border-border">
                <MessageSquarePlus className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-textPrimary">Daily Reflection</h4>
                <p className="text-textMuted text-sm">Record your thoughts and mindset for today.</p>
              </div>
            </div>
            {data?.has_reflection ? (
              <div className="flex items-center gap-2 bg-success/10 text-success px-4 py-1.5 rounded-full text-xs font-bold border border-success/20">
                <Check className="w-3.5 h-3.5" />
                <span>COMPLETED</span>
              </div>
            ) : (
              <span className="text-accent text-xs font-bold uppercase tracking-widest group-hover:translate-x-1 transition-transform">Pending Entry →</span>
            )}
          </Link>
        </div>
      </section>

      {/* Habits Grid Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-textPrimary">Today's Habits</h3>
          <Link to="/tracking" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">Track All →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.habit_list?.map((habit: any) => (
            <div key={habit.id} className="bg-card p-4 rounded-2xl border border-border flex items-center justify-between group hover:border-primary/30 transition-all shadow-sm">
              <div className="flex items-center gap-3">
                <div 
                  className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all ${habit.completed ? 'bg-success/10 border-success/30 text-success' : 'bg-surface border-border text-textMuted'}`}
                >
                  {habit.completed ? <Check className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </div>
                <div>
                  <p className={`font-bold text-sm ${habit.completed ? 'text-textMuted line-through' : 'text-textPrimary'}`}>
                    {habit.name}
                  </p>
                  <p className="text-[10px] font-bold text-textMuted uppercase tracking-tight">
                    {habit.tracking_type}
                  </p>
                </div>
              </div>
              <div 
                className="w-1.5 h-8 rounded-full" 
                style={{ backgroundColor: habit.color || '#6366f1' }}
              />
            </div>
          ))}
          {(!data?.habit_list || data.habit_list.length === 0) && (
            <div className="col-span-full bg-card p-8 rounded-3xl border border-dashed border-border flex flex-col items-center justify-center text-center space-y-2">
              <p className="text-textMuted font-medium">No active habits found.</p>
              <Link to="/habits" className="text-primary font-bold text-sm hover:underline">Go to Habit Manager →</Link>
            </div>
          )}
        </div>
      </section>

      {/* Streaks Section */}
      <section className="space-y-4">
        <h3 className="text-xl font-bold text-textPrimary">Active Streaks</h3>
        <div className="flex flex-wrap gap-4">
          {data?.streaks.map((streak) => (
            <div key={streak.habit_id} className="bg-card border border-border px-5 py-4 rounded-2xl flex items-center gap-4 shadow-sm hover:border-accent/30 transition-all">
              <div className="bg-accent/10 p-2.5 rounded-xl text-accent border border-accent/20">
                <Flame className="w-6 h-6 fill-accent" />
              </div>
              <div>
                <p className="text-[10px] text-textMuted font-bold uppercase tracking-widest leading-none mb-1">{streak.name}</p>
                <p className="text-xl font-bold font-mono text-textPrimary">{streak.current_streak} <span className="text-xs font-normal text-textMuted uppercase tracking-tighter">days</span></p>
              </div>
            </div>
          ))}
          {(!data?.streaks || data.streaks.length === 0) && (
            <div className="text-textMuted text-sm italic">No active streaks yet. Build consistency to see them here!</div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
