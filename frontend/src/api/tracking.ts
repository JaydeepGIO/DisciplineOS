import apiClient from './client';
import { TrackingDay, HabitLog } from '../types';

export interface HabitLogInput {
  habit_id: string;
  completed?: boolean;
  numeric_value?: number;
  duration_secs?: number;
  notes?: string;
}

export interface TaskLogInput {
  planned_task_id: string;
  completed: boolean;
  actual_mins?: number;
  completion_note?: string;
}

export const trackingApi = {
  getTrackingByDate: async (date: string): Promise<TrackingDay> => {
    const response = await apiClient.get<TrackingDay>(`tracking/${date}`);
    return response.data;
  },
  logHabit: async (date: string, data: HabitLogInput): Promise<HabitLog> => {
    const response = await apiClient.post<HabitLog>(`tracking/habits/${date}`, data);
    return response.data;
  },
  updateHabitLog: async (date: string, habitId: string, data: Partial<HabitLogInput>): Promise<HabitLog> => {
    const response = await apiClient.patch<HabitLog>(`tracking/habits/${date}/${habitId}`, data);
    return response.data;
  },
  deleteHabitLog: async (date: string, habitId: string): Promise<void> => {
    await apiClient.delete(`tracking/habits/${date}/${habitId}`);
  },
  logTask: async (date: string, data: TaskLogInput): Promise<any> => {
    const response = await apiClient.post(`tracking/tasks/${date}`, data);
    return response.data;
  },
  startTaskTimer: async (taskId: string): Promise<any> => {
    const response = await apiClient.post(`tracking/tasks/${taskId}/start-timer`);
    return response.data;
  },
  pauseTaskTimer: async (taskId: string): Promise<any> => {
    const response = await apiClient.post(`tracking/tasks/${taskId}/pause-timer`);
    return response.data;
  },
  stopTaskTimer: async (taskId: string, completionNote?: string): Promise<any> => {
    const response = await apiClient.post(`tracking/tasks/${taskId}/stop-timer`, null, {
      params: { completion_note: completionNote }
    });
    return response.data;
  },
};
