import apiClient from './client';
import { ApiResponse, PaginatedResponse, ChangeHistory } from '@types';

/**
 * Сервис для работы с историей изменений
 */
export const historyService = {
  /**
   * Получить историю изменений схемы
   */
  getHistory: async (
    scheduleId: string,
    params?: {
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResponse<ChangeHistory>> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<ChangeHistory>>>(
      `/schedules/${scheduleId}/history`,
      { params }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки истории');
    }
    return response.data.data;
  },
};

