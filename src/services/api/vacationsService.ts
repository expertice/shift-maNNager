import apiClient from './client';
import { ApiResponse, Vacation } from '@types';

export interface CreateVacationRequest {
  employeeId: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  status?: 'approved' | 'pending' | 'rejected' | 'cancelled';
}

export interface UpdateVacationRequest {
  startDate?: string; // ISO date string
  endDate?: string; // ISO date string
  status?: 'approved' | 'pending' | 'rejected' | 'cancelled';
}

/**
 * Сервис для работы с отпусками
 */
export const vacationsService = {
  /**
   * Получить список отпусков схемы
   */
  getVacations: async (scheduleId: string): Promise<Vacation[]> => {
    const response = await apiClient.get<ApiResponse<Vacation[]>>(
      `/schedules/${scheduleId}/vacations`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки отпусков');
    }
    return response.data.data;
  },

  /**
   * Создать отпуск
   */
  createVacation: async (scheduleId: string, data: CreateVacationRequest): Promise<{ vacation: Vacation; warning?: string }> => {
    const response = await apiClient.post<ApiResponse<Vacation>>(
      `/schedules/${scheduleId}/vacations`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания отпуска');
    }
    return {
      vacation: response.data.data,
      warning: response.data.warning,
    };
  },

  /**
   * Обновить отпуск
   */
  updateVacation: async (
    scheduleId: string,
    vacationId: string,
    data: UpdateVacationRequest
  ): Promise<Vacation> => {
    const response = await apiClient.put<ApiResponse<Vacation>>(
      `/schedules/${scheduleId}/vacations/${vacationId}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления отпуска');
    }
    return response.data.data;
  },

  /**
   * Удалить отпуск
   */
  deleteVacation: async (scheduleId: string, vacationId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/vacations/${vacationId}`);
  },
};

