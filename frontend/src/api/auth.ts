import apiClient from './client';
import { LoginCredentials, RegisterData, AuthResponse, User } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const formData = new FormData();
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    const response = await apiClient.post<AuthResponse>('auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  register: async (data: RegisterData): Promise<User> => {
    const response = await apiClient.post<User>('auth/register', data);
    return response.data;
  },
  getMe: async (): Promise<User> => {
    const response = await apiClient.get<User>('auth/me');
    return response.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post('auth/logout');
  },
};
