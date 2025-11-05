import apiClient from './client';
import { ApiResponse, PaginatedResponse, Schedule, ScheduleWithDetails } from '@types';

export interface CreateScheduleRequest {
  name: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

export interface UpdateScheduleRequest extends Partial<CreateScheduleRequest> {
  status?: 'draft' | 'published' | 'completed' | 'archived';
}

/**
 * Сервис для работы с расписаниями
 */
export const schedulesService = {
  /**
   * Получить список всех расписаний
   */
  getSchedules: async (): Promise<Schedule[]> => {
    const response = await apiClient.get<ApiResponse<PaginatedResponse<Schedule>>>('/schedules');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки расписаний');
    }
    // Бэкенд возвращает пагинированный ответ, нужно извлечь items
    return response.data.data.items || response.data.data;
  },

  /**
   * Получить расписание по ID с деталями
   */
  getScheduleById: async (id: string): Promise<ScheduleWithDetails> => {
    const response = await apiClient.get<ApiResponse<ScheduleWithDetails>>(`/schedules/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки расписания');
    }
    return response.data.data;
  },

  /**
   * Создать новое расписание
   */
  createSchedule: async (data: CreateScheduleRequest): Promise<Schedule> => {
    const response = await apiClient.post<ApiResponse<Schedule>>('/schedules', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания расписания');
    }
    return response.data.data;
  },

  /**
   * Обновить расписание
   */
  updateSchedule: async (id: string, data: UpdateScheduleRequest): Promise<Schedule> => {
    const response = await apiClient.put<ApiResponse<Schedule>>(`/schedules/${id}`, data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления расписания');
    }
    return response.data.data;
  },

  /**
   * Удалить расписание
   */
  deleteSchedule: async (id: string): Promise<void> => {
    await apiClient.delete(`/schedules/${id}`);
  },

  /**
   * Дублировать расписание
   */
  duplicateSchedule: async (id: string, newName?: string): Promise<Schedule> => {
    const response = await apiClient.post<ApiResponse<Schedule>>(`/schedules/${id}/duplicate`, {
      name: newName,
    });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка дублирования расписания');
    }
    return response.data.data;
  },
};

