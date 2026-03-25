import apiClient from './client';

export interface ScoringRuleInput {
  name: string;
  habit_weight: number;
  task_weight: number;
  reflection_weight: number;
  schedule_weight: number;
  formula_config?: Record<string, any>;
}

export const scoringApi = {
  getRules: async (): Promise<any[]> => {
    const response = await apiClient.get('scoring/rules');
    return response.data;
  },
  createRule: async (data: ScoringRuleInput): Promise<any> => {
    const response = await apiClient.post('scoring/rules', data);
    return response.data;
  },
  updateRule: async (id: string, data: Partial<ScoringRuleInput>): Promise<any> => {
    const response = await apiClient.put(`scoring/rules/${id}`, data);
    return response.data;
  },
  activateRule: async (id: string): Promise<any> => {
    const response = await apiClient.post(`scoring/rules/${id}/activate`);
    return response.data;
  },
};
