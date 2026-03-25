import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addHours, startOfDay, addMinutes, differenceInMinutes, parseISO, isWithinInterval } from 'date-fns';
import { Clock, Plus, Trash2, CheckCircle2, Check } from 'lucide-react';
import { getDailyTimeBlocks, createTimeBlock, deleteTimeBlock, updateTimeBlock } from '../../api/time-blocks';
import { TimeBlock, PlannedTask } from '../../types';

interface DailyTimelineProps {
  dateStr: string;
  onTaskDrop: (taskId: string, startTime: string) => void;
}

const START_HOUR = 5;
const END_HOUR = 23;
// Intervals of 30 minutes
const INTERVALS = Array.from(
  { length: (END_HOUR - START_HOUR) * 2 },
  (_, i) => START_HOUR * 60 + i * 30
);

const DailyTimeline: React.FC<DailyTimelineProps> = ({ dateStr, onTaskDrop }) => {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [dragPreview, setDragPreview] = useState<{ top: number; height: number; time: string } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { data: blocks, isLoading } = useQuery<TimeBlock[]>({
    queryKey: ['time-blocks', dateStr],
    queryFn: () => getDailyTimeBlocks(dateStr),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTimeBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateTimeBlock(id, { status: 'completed' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-blocks', dateStr] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['plan', dateStr] });
    },
  });

  const handleDragOver = (e: React.DragEvent, baseMinutes: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    // Calculate 5-minute preview
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
    const stepMinutes = Math.floor((percentage * 30) / 5) * 5;
    const totalMinutes = baseMinutes + stepMinutes;

    // We assume a default 30m height for the preview, or we could fetch the actual task duration if available
    // For now, let's just show the top position accurately
    const hourHeight = 80;
    const top = ((totalMinutes - START_HOUR * 60) / 60) * hourHeight;
    
    const previewTime = format(addMinutes(startOfDay(new Date()), totalMinutes), 'HH:mm');
    setDragPreview({ top, height: 40, time: previewTime });
  };

  const handleDragLeave = () => {
    setDragPreview(null);
  };

  const handleDrop = (e: React.DragEvent, baseMinutes: number) => {
    e.preventDefault();
    setDragPreview(null);
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const percentage = Math.max(0, Math.min(1, relativeY / rect.height));
      const stepMinutes = Math.floor((percentage * 30) / 5) * 5;
      const totalMinutes = baseMinutes + stepMinutes;

      const startTime = format(addMinutes(startOfDay(parseISO(dateStr)), totalMinutes), "yyyy-MM-dd'T'HH:mm:ssXXX");
      onTaskDrop(taskId, startTime);
    }
  };

  const getBlockStyle = (block: TimeBlock, allBlocks: TimeBlock[]) => {
    const start = parseISO(block.start_time);
    const end = parseISO(block.end_time);
    const timelineStart = addHours(startOfDay(start), START_HOUR);
    
    const topMinutes = differenceInMinutes(start, timelineStart);
    const durationMinutes = differenceInMinutes(end, start);
    
    const hourHeight = 80;
    const top = (topMinutes / 60) * hourHeight;
    const height = Math.max(20, (durationMinutes / 60) * hourHeight);

    const overlaps = allBlocks.filter(b => {
      const bStart = parseISO(b.start_time);
      const bEnd = parseISO(b.end_time);
      return (start < bEnd && end > bStart);
    }).sort((a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime());

    const colCount = overlaps.length;
    const colIndex = overlaps.findIndex(b => b.id === block.id);

    const leftOffset = 56 + (colIndex * (84 / colCount));

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${leftOffset}px`,
      width: `calc(${100 / colCount}% - ${60 / colCount}px)`,
    };
  };

  const isNowInBlock = (block: TimeBlock) => {
    if (block.status === 'completed' || block.status === 'missed') return false;
    const start = parseISO(block.start_time);
    const end = parseISO(block.end_time);
    return isWithinInterval(now, { start, end });
  };

  const renderNowIndicator = () => {
    const timelineStart = addHours(startOfDay(now), START_HOUR);
    const minutesSinceStart = differenceInMinutes(now, timelineStart);
    if (minutesSinceStart < 0 || minutesSinceStart > (END_HOUR - START_HOUR) * 60) return null;

    const hourHeight = 80;
    const top = (minutesSinceStart / 60) * hourHeight;

    return (
      <div 
        className="absolute left-0 right-0 border-t-2 border-accent z-20 flex items-center pointer-events-none"
        style={{ top: `${top}px` }}
      >
        <div className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-r-md -ml-0.5 shadow-sm">
          NOW
        </div>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-[2rem] p-6 shadow-sm overflow-hidden flex flex-col h-[800px]">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-textPrimary flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent" />
          Schedule
        </h3>
        <span className="text-[10px] font-bold text-textMuted uppercase bg-surface px-2 py-1 rounded-md border border-border">
          {blocks?.length || 0} Blocks
        </span>
      </div>

      <div className="flex-1 overflow-y-auto relative pr-4 custom-scrollbar" onDragLeave={handleDragLeave}>
        <div className="relative min-h-[1520px]">
          {/* Interval Markers & Grid */}
          {INTERVALS.map((totalMinutes) => {
            const isHour = totalMinutes % 60 === 0;
            return (
              <div 
                key={totalMinutes} 
                className={`relative h-10 border-t ${isHour ? 'border-border/60' : 'border-border/20 border-dashed'} group/hour transition-colors`}
                onDragOver={(e) => handleDragOver(e, totalMinutes)}
                onDrop={(e) => handleDrop(e, totalMinutes)}
              >
                <div className={`absolute -top-3 left-1 px-1 text-[10px] tabular-nums bg-card z-10 min-w-[35px] ${isHour ? 'font-black text-textMuted' : 'font-medium text-textMuted/40'}`}>
                  {format(addMinutes(startOfDay(new Date()), totalMinutes), 'HH:mm')}
                </div>
                
                {/* Visual sub-guides for 5-min intervals during drag */}
                <div className="absolute inset-0 opacity-0 group-hover/hour:opacity-100 flex flex-col pointer-events-none">
                  {[5, 10, 15, 20, 25].map(m => (
                    <div key={m} className="flex-1 border-t border-accent/5 border-dotted" />
                  ))}
                </div>

                <div className="absolute inset-0 bg-accent/0 group-hover/hour:bg-accent/[0.02] transition-colors cursor-crosshair flex items-center justify-center">
                  <Plus className="w-4 h-4 text-accent/0 group-hover/hour:text-accent/20" />
                </div>
              </div>
            );
          })}

          {/* Drag Preview (Ghost Block) */}
          {dragPreview && (
            <div 
              className="absolute left-14 right-0 bg-accent/20 border-2 border-dashed border-accent/40 rounded-xl z-30 pointer-events-none flex items-center px-4"
              style={{ top: `${dragPreview.top}px`, height: `${dragPreview.height}px` }}
            >
              <span className="text-[10px] font-black text-accent uppercase tracking-widest">Release to schedule at {dragPreview.time}</span>
            </div>
          )}

          {/* Time Blocks */}
          {blocks?.map((block) => {
            const active = isNowInBlock(block);
            const completed = block.status === 'completed';
            const missed = block.status === 'missed';

            let bgColor = 'bg-surface';
            let borderColor = 'border-border';
            let textColor = 'text-textPrimary';

            if (active) {
              bgColor = 'bg-accent/10';
              borderColor = 'border-accent/40';
              textColor = 'text-accent';
            } else if (completed) {
              bgColor = 'bg-success/5';
              borderColor = 'border-success/30';
              textColor = 'text-success';
            } else if (missed) {
              bgColor = 'bg-danger/5';
              borderColor = 'border-danger/30';
              textColor = 'text-danger';
            }

            return (
              <div
                key={block.id}
                className={`absolute left-14 right-0 rounded-xl p-2.5 border shadow-sm transition-all z-10 group overflow-hidden ${bgColor} ${borderColor} ${active ? 'ring-1 ring-accent/20' : ''} hover:shadow-md hover:z-20`}
                style={getBlockStyle(block, blocks || [])}
              >
                <div className="flex justify-between items-start h-full">
                  <div className="min-w-0 flex-1 flex flex-col justify-center h-full">
                    <h4 className={`text-xs font-bold truncate leading-tight ${textColor}`}>
                      {block.title}
                    </h4>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-bold text-textMuted tabular-nums">
                        {format(parseISO(block.start_time), 'HH:mm')} - {format(parseISO(block.end_time), 'HH:mm')}
                      </span>
                      {missed && <span className="text-[7px] font-black uppercase text-danger bg-danger/10 px-1 rounded-sm">MISSED</span>}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(active || block.status === 'planned') && (
                      <button 
                        onClick={() => completeMutation.mutate(block.id)}
                        disabled={completeMutation.isPending}
                        className="p-1 hover:bg-success/10 text-success rounded-md transition-colors"
                        title="Mark as completed"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteMutation.mutate(block.id)}
                      disabled={deleteMutation.isPending}
                      className="p-1 hover:bg-danger/10 text-danger rounded-md transition-colors"
                      title="Delete block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {completed && (
                    <div className="absolute bottom-2 right-2 animate-in zoom-in duration-300">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Now Indicator */}
          {renderNowIndicator()}
        </div>
      </div>
    </div>
  );
};

export default DailyTimeline;
