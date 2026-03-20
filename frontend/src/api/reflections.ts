import apiClient from './client';

export interface ReflectionTemplateInput {
  name: string;
  description?: string;
  is_default?: boolean;
  questions: Array<{ text: string; type: string; order: number }>;
}

export interface ReflectionEntryInput {
  template_id?: string;
  answers: Record<string, { text?: string; rating?: number }>;
  mood_score?: number;
  energy_score?: number;
}

export const reflectionsApi = {
  getTemplates: async (): Promise<any[]> => {
    const response = await apiClient.get('reflections/templates');
    return response.data;
  },
  createTemplate: async (data: ReflectionTemplateInput): Promise<any> => {
    const response = await apiClient.post('reflections/templates', data);
    return response.data;
  },
  updateTemplate: async (id: string, data: Partial<ReflectionTemplateInput>): Promise<any> => {
    const response = await apiClient.put(`reflections/templates/${id}`, data);
    return response.data;
  },
  deleteTemplate: async (id: string): Promise<void> => {
    await apiClient.delete(`reflections/templates/${id}`);
  },
  setDefaultTemplate: async (id: string): Promise<any> => {
    const response = await apiClient.post(`reflections/templates/${id}/default`);
    return response.data;
  },
  getEntry: async (date: string): Promise<any> => {
    const response = await apiClient.get(`reflections/${date}`);
    return response.data;
  },
  createEntry: async (date: string, data: ReflectionEntryInput): Promise<any> => {
    const response = await apiClient.post(`reflections/${date}`, data);
    return response.data;
  },
  updateEntry: async (date: string, data: Partial<ReflectionEntryInput>): Promise<any> => {
    const response = await apiClient.put(`reflections/${date}`, data);
    return response.data;
  },
  getHistory: async (params?: { page?: number; page_size?: number }): Promise<any> => {
    const response = await apiClient.get('reflections/history', { params });
    return response.data;
  },
};
