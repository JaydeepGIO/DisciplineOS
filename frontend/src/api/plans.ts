import apiClient from './client';
import { DailyPlan, PlannedTask } from '../types';

export interface CreatePlanInput {
  morning_intention?: string;
  notes?: string;
  tasks?: Array<{
    title: string;
    priority_rank: number;
    scheduled_time?: string;
    estimated_mins?: number;
    scoring_weight?: number;
    task_template_id?: string;
  }>;
}

export const plansApi = {
  getPlan: async (date: string): Promise<DailyPlan> => {
    const response = await apiClient.get<DailyPlan>(`plans/${date}`);
    return response.data;
  },
  createPlan: async (date: string, data: CreatePlanInput): Promise<DailyPlan> => {
    const response = await apiClient.post<DailyPlan>(`plans/${date}`, data);
    return response.data;
  },
  updatePlan: async (date: string, data: Partial<CreatePlanInput>): Promise<DailyPlan> => {
    const response = await apiClient.put<DailyPlan>(`plans/${date}`, data);
    return response.data;
  },
  addTask: async (date: string, data: any): Promise<PlannedTask> => {
    const response = await apiClient.post<PlannedTask>(`plans/${date}/tasks`, data);
    return response.data;
  },
  updateTask: async (date: string, taskId: string, data: any): Promise<PlannedTask> => {
    const response = await apiClient.put<PlannedTask>(`plans/${date}/tasks/${taskId}`, data);
    return response.data;
  },
  deleteTask: async (date: string, taskId: string): Promise<void> => {
    await apiClient.delete(`plans/${date}/tasks/${taskId}`);
  },
  reorderTasks: async (date: string, taskOrders: Array<{ task_id: string; priority_rank: number }>): Promise<any> => {
    const response = await apiClient.patch(`plans/${date}/tasks/reorder`, taskOrders);
    return response.data;
  },
};
