import apiClient from './client';
import { TimeBlock, TimeBlockStatus } from '../types';

export interface TimeBlockCreate {
  title: string;
  start_time: string;
  end_time: string;
  task_id?: string | null;
  status?: TimeBlockStatus;
  metadata?: Record<string, any>;
}

export interface TimeBlockUpdate {
  title?: string;
  start_time?: string;
  end_time?: string;
  task_id?: string | null;
  status?: TimeBlockStatus;
  metadata?: Record<string, any>;
}

export const createTimeBlock = async (data: TimeBlockCreate): Promise<TimeBlock> => {
  const response = await apiClient.post<TimeBlock>('time-blocks', data);
  return response.data;
};

export const getDailyTimeBlocks = async (day: string): Promise<TimeBlock[]> => {
  const response = await apiClient.get<TimeBlock[]>(`time-blocks/day?day=${day}`);
  return response.data;
};

export const getActiveTimeBlock = async (): Promise<TimeBlock> => {
  const response = await apiClient.get<TimeBlock>('time-blocks/active');
  return response.data;
};

export const updateTimeBlock = async (id: string, data: TimeBlockUpdate): Promise<TimeBlock> => {
  const response = await apiClient.put<TimeBlock>(`time-blocks/${id}`, data);
  return response.data;
};

export const deleteTimeBlock = async (id: string): Promise<void> => {
  await apiClient.delete(`time-blocks/${id}`);
};
