import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isWithinInterval, parseISO, differenceInSeconds } from 'date-fns';
import { Clock, CheckCircle2, AlertCircle, Timer, Minimize2, Maximize2, Zap, Play, Send } from 'lucide-react';
import { getDailyTimeBlocks, updateTimeBlock } from '../../api/time-blocks';
import { TimeBlock } from '../../types';
import apiClient from '../../api/client';

const FocusOverlay: React.FC = () => {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [isMinimized, setIsMinimized] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [completionNote, setCompletionNote] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = format(now, 'yyyy-MM-dd');

  const { data: blocks } = useQuery<TimeBlock[]>({
    queryKey: ['time-blocks', dateStr],
    queryFn: () => getDailyTimeBlocks(dateStr),
    refetchInterval: 30000,
  });

  // Find either an already ACTIVE block, or a PLANNED block whose time has come
  const activeBlock = blocks?.find(b => b.status === 'active') || 
                      blocks?.find(b => {
                        if (b.status !== 'planned') return false;
                        const start = parseISO(b.start_time);
                        const end = parseISO(b.end_time);
                        return isWithinInterval(now, { start, end });
                      });

  const startMutation = useMutation({
    mutationFn: async (block: TimeBlock) => {
      if (block.task_id) {
        await apiClient.post(`/tracking/tasks/${block.task_id}/start-timer`);
      } else {
        await updateTimeBlock(block.id, { status: 'active' });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (block: TimeBlock) => {
      // 1. Mark block as completed
      await updateTimeBlock(block.id, { status: 'completed' });
      // 2. If it has a task, mark task as completed too with the note
      if (block.task_id) {
        await apiClient.post(`/tracking/tasks/${dateStr}`, { 
          planned_task_id: block.task_id, 
          completed: true,
          completion_note: completionNote
        });
      }
    },
    onSuccess: () => {
      setShowReflection(false);
      setCompletionNote('');
      queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['tracking', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  if (!activeBlock) return null;

  const isReady = activeBlock.status === 'planned';
  const isActive = activeBlock.status === 'active';
  
  const start = parseISO(activeBlock.start_time);
  const end = parseISO(activeBlock.end_time);
  const totalSeconds = differenceInSeconds(end, start);
  const elapsedSeconds = differenceInSeconds(now, start);
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const progress = Math.min(100, (elapsedSeconds / totalSeconds) * 100);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setIsMinimized(false)}
          className={`${isActive ? 'bg-accent' : 'bg-surface border border-border text-textPrimary'} p-4 rounded-full shadow-2xl flex items-center gap-3 group transition-all`}
        >
          <Zap className={`w-5 h-5 fill-current ${isActive ? 'animate-pulse' : 'text-textMuted'}`} />
          <span className="font-bold text-sm pr-2">{isActive ? formatTime(remainingSeconds) : 'Ready'}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-6 pointer-events-none flex justify-center">
      <div className="w-full max-w-2xl bg-card/95 backdrop-blur-xl border border-accent/30 rounded-[2.5rem] shadow-2xl shadow-accent/10 p-6 pointer-events-auto animate-in slide-in-from-bottom-10 duration-700 ring-1 ring-white/10">
        
        {!showReflection ? (
          <>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 ${isActive ? 'bg-accent/20 border-accent/30' : 'bg-surface border-border'} rounded-2xl flex items-center justify-center border shadow-inner transition-colors`}>
                  <Zap className={`w-6 h-6 ${isActive ? 'text-accent fill-accent/20' : 'text-textMuted'}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full ${isActive ? 'text-accent/70 bg-accent/10' : 'text-textMuted bg-surface border border-border'}`}>
                      {isActive ? 'Active Session' : 'Scheduled Task'}
                    </span>
                    <span className="text-[10px] font-bold text-textMuted uppercase tracking-wider">{format(start, 'HH:mm')} - {format(end, 'HH:mm')}</span>
                  </div>
                  <h3 className="text-xl font-bold text-textPrimary mt-0.5 leading-tight">{activeBlock.title}</h3>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMinimized(true)}
                  className="p-2 hover:bg-surface rounded-xl text-textMuted transition-colors"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {isActive ? (
                <>
                  <div className="relative h-3 bg-surface rounded-full overflow-hidden border border-border/50">
                    <div 
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent via-primary to-accent bg-[length:200%_100%] animate-shimmer transition-all duration-1000"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Remaining</p>
                        <p className="text-2xl font-black font-mono text-textPrimary tracking-tighter">{formatTime(remainingSeconds)}</p>
                      </div>
                      <div className="w-px h-8 bg-border/50" />
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-bold text-textMuted uppercase tracking-widest">Adherence</p>
                        <p className="text-2xl font-black font-mono text-success tracking-tighter">{Math.round(100 - (progress * 0.1))}%</p>
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowReflection(true)}
                      className="flex items-center gap-2 bg-success text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-success/20 hover:scale-105 transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Finish Block
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-surface/50 border border-border rounded-2xl p-4 flex items-center justify-between">
                  <p className="text-sm font-medium text-textMuted">You are scheduled for this task now.</p>
                  <button 
                    onClick={() => startMutation.mutate(activeBlock)}
                    disabled={startMutation.isPending}
                    className="flex items-center gap-2 bg-accent text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-accent/20 hover:scale-105 transition-all disabled:opacity-50"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    {startMutation.isPending ? 'Starting...' : 'Start Now'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-textPrimary">Session Reflection</h3>
              <button onClick={() => setShowReflection(false)} className="text-xs font-bold text-textMuted hover:text-textPrimary">Cancel</button>
            </div>
            <textarea 
              autoFocus
              placeholder="How did it go? Any obstacles or wins?"
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm min-h-[100px] focus:border-success focus:ring-1 focus:ring-success outline-none transition-all font-medium text-textPrimary"
              value={completionNote}
              onChange={(e) => setCompletionNote(e.target.value)}
            />
            <button 
              onClick={() => completeMutation.mutate(activeBlock)}
              disabled={completeMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-success text-white py-4 rounded-2xl font-bold shadow-lg shadow-success/20 hover:bg-success/90 transition-all"
            >
              <Send className="w-4 h-4" />
              {completeMutation.isPending ? 'Saving...' : 'Complete & Log Reflection'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FocusOverlay;
