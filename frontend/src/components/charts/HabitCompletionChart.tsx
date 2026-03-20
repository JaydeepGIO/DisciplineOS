import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface HabitCompletionChartProps {
  data: Array<{
    habit_id: string;
    name: string;
    color: string;
    completion_rate: number;
    completed_days: number;
    total_days: number;
  }>;
}

const HabitCompletionChart: React.FC<HabitCompletionChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] bg-card rounded-xl border border-border">
        <p className="text-textMuted">No data yet. Start tracking to see your progress here.</p>
      </div>
    );
  }

  const formattedData = data.map((item) => ({
    ...item,
    truncatedName: item.name.length > 12 ? `${item.name.substring(0, 10)}...` : item.name,
    percentage: item.completion_rate * 100,
  }));

  return (
    <div className="h-[300px] w-full bg-card p-4 rounded-xl border border-border">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="truncatedName"
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
            tickFormatter={(value) => `${value}%`}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
            itemStyle={{ color: '#f1f5f9' }}
            labelStyle={{ color: '#94a3b8' }}
            formatter={(value: number, name: string, props: any) => [
              `${value.toFixed(1)}% (${props.payload.completed_days}/${props.payload.total_days} days)`,
              'Rate'
            ]}
          />
          <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
            {formattedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color || '#6366f1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HabitCompletionChart;
