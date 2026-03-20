import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { format, parseISO } from 'date-fns';

interface ScoreTrendChartProps {
  data: Array<{ score_date: string; raw_score: number }>;
}

const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] bg-card rounded-xl border border-border">
        <p className="text-textMuted">No data yet. Start tracking to see your progress here.</p>
      </div>
    );
  }

  const formattedData = data.map((item) => ({
    ...item,
    formattedDate: format(parseISO(item.score_date), 'MMM d'),
  })).sort((a, b) => a.score_date.localeCompare(b.score_date));

  return (
    <div className="h-[300px] w-full bg-card p-4 rounded-xl border border-border">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
            itemStyle={{ color: '#f1f5f9' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Target', fill: '#f59e0b', fontSize: 10, position: 'insideBottomRight' }} />
          <Line
            type="monotone"
            dataKey="raw_score"
            name="Score"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#6366f1' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ScoreTrendChart;
