import React, { useState, useEffect } from 'react';
import { Play, Pause, Square, CheckCircle2, Clock } from 'lucide-react';
import { trackingApi } from '../../api/tracking';
import { useQueryClient } from '@tanstack/react-query';

interface TaskTimerProps {
  taskId: string;
  initialSeconds: number;
  isRunning: boolean;
  startedAt?: string | null;
  onComplete?: (actualMins: number, note: string) => void;
}

const TaskTimer: React.FC<TaskTimerProps> = ({ 
  taskId, 
  initialSeconds, 
  isRunning, 
  startedAt,
  onComplete 
}) => {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [active, setActive] = useState(isRunning);
  const [showReflection, setShowReflection] = useState(false);
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  useEffect(() => {
    let interval: any = null;
    if (active) {
      const calculateSeconds = () => {
        if (!startedAt) return initialSeconds;
        // Parse UTC string and calculate difference from current UTC time
        const start = new Date(startedAt).getTime();
        const now = Date.now();
        // Since startedAt is UTC from server, and Date.now() is current time, 
        // the difference is absolute elapsed time regardless of local TZ
        const elapsed = Math.floor((now - start) / 1000);
        return initialSeconds + elapsed;
      };

      setSeconds(calculateSeconds());
      
      interval = setInterval(() => {
        setSeconds(calculateSeconds());
      }, 1000);
    } else {
      clearInterval(interval);
      setSeconds(initialSeconds);
    }
    return () => clearInterval(interval);
  }, [active, startedAt, initialSeconds]);

  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStart = async () => {
    await trackingApi.startTaskTimer(taskId);
    setActive(true);
    queryClient.invalidateQueries({ queryKey: ['tracking'] });
  };

  const handlePause = async () => {
    await trackingApi.pauseTaskTimer(taskId);
    setActive(false);
    queryClient.invalidateQueries({ queryKey: ['tracking'] });
  };

  const handleStop = () => {
    setShowReflection(true);
  };

  const handleSubmitReflection = async () => {
    const result = await trackingApi.stopTaskTimer(taskId, note);
    setActive(false);
    setShowReflection(false);
    if (onComplete) onComplete(result.actual_mins, note);
    queryClient.invalidateQueries({ queryKey: ['tracking'] });
  };

  if (showReflection) {
    return (
      <div className="flex flex-col gap-3 p-4 bg-surface border border-primary/20 rounded-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-bold text-sm uppercase tracking-tight">Task Reflection</span>
        </div>
        <textarea
          autoFocus
          placeholder="How did it go? Any blockers?"
          className="w-full bg-card border border-border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[80px]"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs font-mono text-textMuted">Final Time: {formatTime(seconds)}</span>
          <button
            onClick={handleSubmitReflection}
            className="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            Submit & Complete
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 bg-card/50 px-4 py-2 rounded-2xl border border-border group-hover:border-primary/30 transition-all">
      <div className="flex items-center gap-2 min-w-[70px]">
        <Clock className={`w-4 h-4 ${active ? 'text-primary animate-pulse' : 'text-textMuted'}`} />
        <span className={`font-mono font-bold text-sm ${active ? 'text-primary' : 'text-textPrimary'}`}>
          {formatTime(seconds)}
        </span>
      </div>

      <div className="flex items-center gap-1 border-l border-border pl-3">
        {active ? (
          <button 
            onClick={handlePause}
            className="p-1.5 hover:bg-amber-500/10 rounded-lg text-amber-500 transition-colors"
            title="Pause"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>
        ) : (
          <button 
            onClick={handleStart}
            className="p-1.5 hover:bg-primary/10 rounded-lg text-primary transition-colors"
            title="Start Tracking"
          >
            <Play className="w-4 h-4 fill-current" />
          </button>
        )}
        
        <button 
          onClick={handleStop}
          className="p-1.5 hover:bg-danger/10 rounded-lg text-danger transition-colors"
          title="Stop & Reflect"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>
    </div>
  );
};

export default TaskTimer;
