import React from 'react';
import { format, parseISO, subDays, startOfToday, isSameDay } from 'date-fns';

interface ScoreHeatmapProps {
  data: Array<{ score_date: string; raw_score: number }>;
}

const ScoreHeatmap: React.FC<ScoreHeatmapProps> = ({ data }) => {
  // Generate last 365 days
  const today = startOfToday();
  const days = Array.from({ length: 365 }, (_, i) => subDays(today, 364 - i));

  const dataMap = new Map(data.map((item) => [item.score_date, item.raw_score]));

  const getColor = (score: number | undefined) => {
    if (score === undefined) return 'bg-slate-800'; // No data
    if (score === 0) return 'bg-slate-700';
    if (score < 20) return 'bg-indigo-900';
    if (score < 40) return 'bg-indigo-800';
    if (score < 60) return 'bg-indigo-600';
    if (score < 80) return 'bg-indigo-500';
    return 'bg-indigo-400';
  };

  // Group days into weeks for 52 columns
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];

  days.forEach((day) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  if (currentWeek.length > 0) weeks.push(currentWeek);

  return (
    <div className="bg-card p-6 rounded-xl border border-border overflow-x-auto">
      <div className="flex flex-col gap-2 min-w-max">
        <div className="flex gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {week.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const score = dataMap.get(dateStr);
                return (
                  <div
                    key={dateStr}
                    className={`w-3 h-3 rounded-sm ${getColor(score)} transition-colors cursor-pointer group relative`}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="bg-slate-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap border border-slate-700">
                        {format(day, 'MMM d, yyyy')}: {score !== undefined ? score.toFixed(1) : 'No data'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-textMuted justify-end">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-slate-800"></div>
          <div className="w-3 h-3 rounded-sm bg-indigo-900"></div>
          <div className="w-3 h-3 rounded-sm bg-indigo-700"></div>
          <div className="w-3 h-3 rounded-sm bg-indigo-500"></div>
          <div className="w-3 h-3 rounded-sm bg-indigo-300"></div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default ScoreHeatmap;
