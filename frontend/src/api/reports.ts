import apiClient from './client';

export interface ReportRequest {
  report_type: 'weekly' | 'monthly' | 'habit_history' | 'full';
  period_start: string;
  period_end: string;
  format: 'pdf' | 'csv' | 'json';
  include_sections: string[];
}

export const reportsApi = {
  generateReport: async (data: ReportRequest): Promise<{ job_id: string; status: string }> => {
    const response = await apiClient.post('reports/generate', data);
    return response.data;
  },
  getReportStatus: async (jobId: string): Promise<{ job_id: string; status: string; download_url?: string }> => {
    const response = await apiClient.get(`reports/${jobId}`);
    return response.data;
  },
  getDownloadUrl: (jobId: string): string => {
    return `${apiClient.defaults.baseURL}reports/${jobId}/download`;
  },
  downloadReport: async (jobId: string, filename: string): Promise<void> => {
    const response = await apiClient.get(`reports/${jobId}/download`, {
      responseType: 'blob',
    });
    
    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};
