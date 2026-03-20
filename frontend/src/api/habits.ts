import apiClient from './client';
import { HabitTemplate, HabitCategory, TrackingType } from '../types';

export interface CreateHabitInput {
  name: string;
  category: HabitCategory;
  tracking_type: TrackingType;
  target_value?: number;
  target_unit?: string;
  scoring_weight: number;
  color?: string;
  icon?: string;
  metadata?: Record<string, any>;
}

export const habitsApi = {
  getHabits: async (params?: { category?: string; is_active?: boolean }): Promise<HabitTemplate[]> => {
    const response = await apiClient.get<HabitTemplate[]>('habits', { params });
    return response.data;
  },
  createHabit: async (data: CreateHabitInput): Promise<HabitTemplate> => {
    const response = await apiClient.post<HabitTemplate>('habits', data);
    return response.data;
  },
  updateHabit: async (id: string, data: Partial<CreateHabitInput>): Promise<HabitTemplate> => {
    const response = await apiClient.put<HabitTemplate>(`habits/${id}`, data);
    return response.data;
  },
  deleteHabit: async (id: string): Promise<void> => {
    await apiClient.delete(`habits/${id}`);
  },
  getHabitStats: async (id: string): Promise<any> => {
    const response = await apiClient.get(`habits/${id}/stats`);
    return response.data;
  },
};
