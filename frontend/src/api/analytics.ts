import apiClient from './client';
import { DashboardData } from '../types';

export const analyticsApi = {
  getDashboard: async (date?: string): Promise<DashboardData> => {
    const response = await apiClient.get<DashboardData>('analytics/dashboard', { params: { date } });
    return response.data;
  },
  getScores: async (params?: { period_type?: 'daily' | 'weekly' | 'monthly'; limit?: number }): Promise<any[]> => {
    const response = await apiClient.get<any[]>('analytics/scores', { params });
    return response.data;
  },
  getHabitCompletionRates: async (params?: { days?: number }): Promise<any[]> => {
    const response = await apiClient.get<any[]>('analytics/habits/completion-rate', { params });
    return response.data;
  },
  getHabitTrend: async (habitId: string, params?: { days?: number }): Promise<any[]> => {
    const response = await apiClient.get<any[]>(`analytics/habits/${habitId}/trend`, { params });
    return response.data;
  },
  getStreaks: async (): Promise<any[]> => {
    const response = await apiClient.get<any[]>('analytics/streaks');
    return response.data;
  },
  getWeeklySummary: async (week: string): Promise<any> => {
    const response = await apiClient.get(`analytics/weekly-summary/${week}`);
    return response.data;
  },
  getMonthlySummary: async (month: string): Promise<any> => {
    const response = await apiClient.get(`analytics/monthly-summary/${month}`);
    return response.data;
  },
};
