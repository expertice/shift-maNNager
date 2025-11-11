import apiClient from './client';
import { ApiResponse } from '@types';

export interface Position {
  id: string;
  scheduleId: string;
  name: string;
}

export interface CreatePositionRequest {
  name: string;
}

export interface UpdatePositionRequest extends Partial<CreatePositionRequest> {}

/**
 * Сервис для работы с должностями
 */
export const positionsService = {
  /**
   * Получить список должностей схемы
   */
  getPositions: async (scheduleId: string): Promise<Position[]> => {
    const response = await apiClient.get<ApiResponse<Position[]>>(
      `/schedules/${scheduleId}/positions`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки должностей');
    }
    return response.data.data;
  },

  /**
   * Создать должность
   */
  createPosition: async (scheduleId: string, data: CreatePositionRequest): Promise<Position> => {
    try {
      const response = await apiClient.post<ApiResponse<Position>>(
        `/schedules/${scheduleId}/positions`,
        data
      );
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.message || response.data.error || 'Ошибка создания должности');
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
   * Обновить должность
   */
  updatePosition: async (
    scheduleId: string,
    positionId: string,
    data: UpdatePositionRequest
  ): Promise<Position> => {
    const response = await apiClient.put<ApiResponse<Position>>(
      `/schedules/${scheduleId}/positions/${positionId}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления должности');
    }
    return response.data.data;
  },

  /**
   * Удалить должность
   */
  deletePosition: async (scheduleId: string, positionId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/positions/${positionId}`);
  },
};

