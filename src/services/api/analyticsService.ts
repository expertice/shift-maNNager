import apiClient from './client';
import { ApiResponse, ScheduleAnalytics } from '@types';

/**
 * Сервис для работы с аналитикой
 */
export const analyticsService = {
  /**
   * Получить аналитику расписания
   */
  getAnalytics: async (scheduleId: string): Promise<ScheduleAnalytics> => {
    const response = await apiClient.get<ApiResponse<ScheduleAnalytics>>(
      `/schedules/${scheduleId}/analytics`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки аналитики');
    }
    return response.data.data;
  },
};

