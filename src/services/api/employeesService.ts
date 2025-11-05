import apiClient from './client';
import { ApiResponse, Employee } from '@types';

export interface CreateEmployeeRequest {
  fullName: string;
  tabNumber: string;
  birthDate?: string; // ISO date string
  departmentId: string;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {}

/**
 * Сервис для работы с сотрудниками
 */
export const employeesService = {
  /**
   * Получить список сотрудников схемы
   */
  getEmployees: async (scheduleId: string): Promise<Employee[]> => {
    const response = await apiClient.get<ApiResponse<Employee[]>>(
      `/schedules/${scheduleId}/employees`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки сотрудников');
    }
    return response.data.data;
  },

  /**
   * Получить сотрудника по ID
   */
  getEmployeeById: async (scheduleId: string, employeeId: string): Promise<Employee> => {
    const response = await apiClient.get<ApiResponse<Employee>>(
      `/schedules/${scheduleId}/employees/${employeeId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки сотрудника');
    }
    return response.data.data;
  },

  /**
   * Создать сотрудника
   */
  createEmployee: async (scheduleId: string, data: CreateEmployeeRequest): Promise<Employee> => {
    const response = await apiClient.post<ApiResponse<Employee>>(
      `/schedules/${scheduleId}/employees`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания сотрудника');
    }
    return response.data.data;
  },

  /**
   * Обновить сотрудника
   */
  updateEmployee: async (
    scheduleId: string,
    employeeId: string,
    data: UpdateEmployeeRequest
  ): Promise<Employee> => {
    const response = await apiClient.put<ApiResponse<Employee>>(
      `/schedules/${scheduleId}/employees/${employeeId}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления сотрудника');
    }
    return response.data.data;
  },

  /**
   * Удалить сотрудника
   */
  deleteEmployee: async (scheduleId: string, employeeId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/employees/${employeeId}`);
  },

  /**
   * Сгенерировать пароль для сотрудника
   */
  generatePassword: async (scheduleId: string, employeeId: string): Promise<{ password: string }> => {
    const response = await apiClient.post<ApiResponse<{ password: string }>>(
      `/schedules/${scheduleId}/employees/${employeeId}/generate-password`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка генерации пароля');
    }
    return response.data.data;
  },

  /**
   * Создать болванчиков-сотрудников
   */
  createPlaceholders: async (
    scheduleId: string,
    data: { count: number; departmentId?: string | null }
  ): Promise<Employee[]> => {
    const response = await apiClient.post<ApiResponse<Employee[]>>(
      `/schedules/${scheduleId}/employees/bulk-placeholders`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания болванчиков');
    }
    return response.data.data;
  },
};

