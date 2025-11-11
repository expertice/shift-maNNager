import apiClient from './client';
import { ApiResponse } from '@types';

export interface Department {
  id: string;
  scheduleId: string;
  name: string;
}

export interface CreateDepartmentRequest {
  name: string;
}

export interface UpdateDepartmentRequest extends Partial<CreateDepartmentRequest> {}

/**
 * Сервис для работы с отделами
 */
export const departmentsService = {
  /**
   * Получить список отделов схемы
   */
  getDepartments: async (scheduleId: string): Promise<Department[]> => {
    const response = await apiClient.get<ApiResponse<Department[]>>(
      `/schedules/${scheduleId}/departments`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки отделов');
    }
    return response.data.data;
  },

  /**
   * Создать отдел
   */
  createDepartment: async (scheduleId: string, data: CreateDepartmentRequest): Promise<Department> => {
    try {
      const response = await apiClient.post<ApiResponse<Department>>(
        `/schedules/${scheduleId}/departments`,
        data
      );
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || response.data.error || 'Ошибка создания отдела');
      }
      return response.data.data;
    } catch (error: any) {
      // Извлекаем сообщение об ошибке из ответа сервера
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  },

  /**
   * Обновить отдел
   */
  updateDepartment: async (
    scheduleId: string,
    departmentId: string,
    data: UpdateDepartmentRequest
  ): Promise<Department> => {
    const response = await apiClient.put<ApiResponse<Department>>(
      `/schedules/${scheduleId}/departments/${departmentId}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления отдела');
    }
    return response.data.data;
  },

  /**
   * Удалить отдел
   */
  deleteDepartment: async (scheduleId: string, departmentId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/departments/${departmentId}`);
  },
};

