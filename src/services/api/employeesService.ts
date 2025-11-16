import apiClient from './client';
import { ApiResponse, Employee } from '@types';

export interface CreateEmployeeRequest {
  fullName: string;
  tabNumber: string;
  birthDate?: string; // ISO date string
  departmentId: string;
  positionId?: string;
  isHidden?: boolean;
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

  /**
   * Назначить профиль смены сотруднику
   */
  assignProfileToEmployee: async (
    employeeId: string,
    scheduleId: string,
    shiftProfileId: string | null
  ): Promise<Employee> => {
    const response = await apiClient.put<ApiResponse<Employee>>(
      `/schedules/${scheduleId}/employees/${employeeId}/assign-profile`,
      { shiftProfileId }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка назначения профиля');
    }
    return response.data.data;
  },

  /**
   * Массовое обновление сотрудников
   */
  bulkUpdateEmployees: async (
    scheduleId: string,
    employeeIds: string[],
    data: {
      departmentId?: string;
      positionId?: string;
    }
  ): Promise<{ count: number }> => {
    const response = await apiClient.put<ApiResponse<{ count: number }>>(
      `/schedules/${scheduleId}/employees/bulk`,
      { employeeIds, ...data }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка массового обновления');
    }
    return response.data.data;
  },

  /**
   * Массовое удаление сотрудников
   */
  bulkDeleteEmployees: async (
    scheduleId: string,
    employeeIds: string[]
  ): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/employees/bulk`, {
      data: { employeeIds },
    });
  },

  /**
   * Экспорт сотрудников
   */
  exportEmployees: async (
    scheduleId: string,
    format: 'csv' | 'xlsx'
  ): Promise<Blob> => {
    const response = await apiClient.get(
      `/schedules/${scheduleId}/employees/export?format=${format}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Импорт сотрудников
   */
  importEmployees: async (
    scheduleId: string,
    file: File,
    mode: 'create' | 'update' | 'mixed',
    selectedIndices?: number[]
  ): Promise<{
    success: number;
    errors: Array<{ row: number; message: string }>;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    if (selectedIndices && selectedIndices.length > 0) {
      formData.append('selectedIndices', JSON.stringify(selectedIndices));
    }

    const response = await apiClient.post<ApiResponse<{
      success: number;
      errors: Array<{ row: number; message: string }>;
    }>>(
      `/schedules/${scheduleId}/employees/import`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка импорта');
    }
    return response.data.data;
  },

  /**
   * Массовое обновление видимости сотрудников
   */
  bulkUpdateEmployeeVisibility: async (
    scheduleId: string,
    employeeIds: string[],
    isHidden: boolean
  ): Promise<{ count: number }> => {
    const response = await apiClient.put<ApiResponse<{ count: number }>>(
      `/schedules/${scheduleId}/employees/bulk-visibility`,
      { employeeIds, isHidden }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления видимости');
    }
    return response.data.data;
  },
};

