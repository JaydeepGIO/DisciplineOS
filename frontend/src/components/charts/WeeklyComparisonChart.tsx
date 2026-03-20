import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface WeeklyComparisonChartProps {
  data: Array<{
    period_key: string;
    habit_score: number;
    task_score: number;
    raw_score: number;
  }>;
}

const WeeklyComparisonChart: React.FC<WeeklyComparisonChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] bg-card rounded-xl border border-border">
        <p className="text-textMuted">No data yet. Start tracking to see your progress here.</p>
      </div>
    );
  }

  // Ensure data is sorted by period key
  const sortedData = [...data].sort((a, b) => a.period_key.localeCompare(b.period_key));

  return (
    <div className="h-[300px] w-full bg-card p-4 rounded-xl border border-border">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sortedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="period_key"
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
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Bar dataKey="habit_score" name="Habits" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="task_score" name="Tasks" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WeeklyComparisonChart;
