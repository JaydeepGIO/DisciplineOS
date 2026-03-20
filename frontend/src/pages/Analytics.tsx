import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../api/client';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp, Award, Activity, Calendar } from 'lucide-react';

const Analytics: React.FC = () => {
  const [days, setDays] = useState(30);

  const { data: scores, isLoading: scoresLoading } = useQuery<any[]>({
    queryKey: ['analytics-scores', days],
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/scores?limit=${days}`);
      return res.data.reverse(); // Show chronological order
    },
  });

  const { data: habitStats, isLoading: habitsLoading } = useQuery<any[]>({
    queryKey: ['analytics-habits', days],
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/habits/completion-rate?days=${days}`);
      return res.data;
    },
  });

  if (scoresLoading || habitsLoading) return <div className="p-8">Loading analytics...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics & Insights</h2>
          <p className="text-textMuted font-medium">Data-driven view of your discipline journey.</p>
        </div>
        <div className="flex bg-card p-1 rounded-xl border border-border">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${
                days === d ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-textPrimary'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </header>

      {/* Summary Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card border border-border p-6 rounded-3xl flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl text-primary"><TrendingUp className="w-6 h-6" /></div>
          <div>
            <p className="text-xs font-bold text-textMuted uppercase tracking-wider">Avg Score</p>
            <p className="text-2xl font-black font-mono">
              {scores && scores.length > 0 
                ? Math.round(scores.reduce((acc, s) => acc + s.raw_score, 0) / scores.length) 
                : 0}%
            </p>
          </div>
        </div>
        {/* Add more summary cards here */}
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Score Trend Chart */}
        <div className="bg-card border border-border p-6 rounded-[32px] space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Discipline Score Trend
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scores}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="score_date" 
                  tickFormatter={(str) => format(parseISO(str), 'MMM d')}
                  stroke="#94a3b8"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Target', fill: '#f59e0b', fontSize: 10, position: 'insideTopRight' }} />
                <Line type="monotone" dataKey="raw_score" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Habit Completion Chart */}
        <div className="bg-card border border-border p-6 rounded-[32px] space-y-6">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Award className="w-5 h-5 text-success" />
            Habit Consistency
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={habitStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} domain={[0, 1]} tickFormatter={(val) => `${val * 100}%`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px' }}
                  formatter={(val: number) => [`${Math.round(val * 100)}%`, 'Completion Rate']}
                />
                <Bar dataKey="completion_rate" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
