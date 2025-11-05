import apiClient from './client';
import { ApiResponse, Conflict } from '@types';

export interface ResolveConflictRequest {
  solutionId?: string;
  resolutionNotes?: string;
}

/**
 * Сервис для работы с конфликтами
 */
export const conflictsService = {
  /**
   * Получить конфликты схемы
   */
  getConflicts: async (scheduleId: string, resolved?: boolean): Promise<Conflict[]> => {
    const response = await apiClient.get<ApiResponse<Conflict[]>>(
      `/schedules/${scheduleId}/conflicts`,
      { params: resolved !== undefined ? { resolved } : {} }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки конфликтов');
    }
    return response.data.data;
  },

  /**
   * Разрешить конфликт
   */
  resolveConflict: async (
    scheduleId: string,
    conflictId: string,
    data: ResolveConflictRequest
  ): Promise<Conflict> => {
    const response = await apiClient.post<ApiResponse<Conflict>>(
      `/schedules/${scheduleId}/conflicts/${conflictId}/resolve`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка разрешения конфликта');
    }
    return response.data.data;
  },
};

