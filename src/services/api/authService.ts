import apiClient from './client';
import { ApiResponse } from '@types';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
  };
}

export interface EmployeeLoginRequest {
  loginId: string;
  password: string;
}

export interface EmployeeLoginResponse {
  token: string;
  loginId: string;
  employee: {
    id: string;
    fullName: string;
  };
}

/**
 * Сервис аутентификации
 */
export const authService = {
  /**
   * Вход для суперпользователей
   */
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<ApiResponse<LoginResponse>>('/auth/login', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка авторизации');
    }
    return response.data.data;
  },

  /**
   * Вход для сотрудников
   */
  employeeLogin: async (data: EmployeeLoginRequest): Promise<EmployeeLoginResponse> => {
    const response = await apiClient.post<ApiResponse<EmployeeLoginResponse>>(
      '/auth/employee/login',
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка авторизации');
    }
    return response.data.data;
  },

  /**
   * Генерация пароля для сотрудника
   */
  generateEmployeePassword: async (employeeId: string): Promise<{ password: string }> => {
    const response = await apiClient.post<ApiResponse<{ password: string }>>(
      `/auth/employee/${employeeId}/generate-password`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка генерации пароля');
    }
    return response.data.data;
  },
};

