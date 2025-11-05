import apiClient from './client';
import { ApiResponse, SchedulePermission, UserRole } from '@types';

export interface CreatePermissionRequest {
  userId: string;
  role: UserRole;
}

export interface UpdatePermissionRequest {
  role: UserRole;
}

/**
 * Сервис для работы с правами доступа
 */
export const permissionsService = {
  /**
   * Получить права доступа схемы
   */
  getPermissions: async (scheduleId: string): Promise<SchedulePermission[]> => {
    const response = await apiClient.get<ApiResponse<SchedulePermission[]>>(
      `/schedules/${scheduleId}/permissions`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки прав доступа');
    }
    return response.data.data;
  },

  /**
   * Создать право доступа
   */
  createPermission: async (
    scheduleId: string,
    data: CreatePermissionRequest
  ): Promise<SchedulePermission> => {
    const response = await apiClient.post<ApiResponse<SchedulePermission>>(
      `/schedules/${scheduleId}/permissions`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания права доступа');
    }
    return response.data.data;
  },

  /**
   * Обновить право доступа
   */
  updatePermission: async (
    scheduleId: string,
    permissionId: string,
    data: UpdatePermissionRequest
  ): Promise<SchedulePermission> => {
    const response = await apiClient.put<ApiResponse<SchedulePermission>>(
      `/schedules/${scheduleId}/permissions/${permissionId}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления права доступа');
    }
    return response.data.data;
  },

  /**
   * Удалить право доступа
   */
  deletePermission: async (scheduleId: string, permissionId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/permissions/${permissionId}`);
  },
};

