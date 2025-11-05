import apiClient from './client';
import { ApiResponse, ShiftProfile, EditShiftProfileData, CompareProfilesRequest, CompareProfilesResponse } from '@types';

export interface GenerateShiftsRequest {
  shiftProfileId: string;
  employeeIds: string[];
  startDate: string; // ISO date string
  endDate: string; // ISO date string
}

/**
 * Сервис для работы с профилями смен
 */
export const shiftProfilesService = {
  /**
   * Получить все профили смен
   */
  getShiftProfiles: async (): Promise<ShiftProfile[]> => {
    const response = await apiClient.get<ApiResponse<ShiftProfile[]>>('/shift-profiles');
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки профилей смен');
    }
    return response.data.data;
  },

  /**
   * Получить профиль смены по ID
   */
  getShiftProfileById: async (id: string): Promise<ShiftProfile> => {
    const response = await apiClient.get<ApiResponse<ShiftProfile>>(`/shift-profiles/${id}`);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки профиля смены');
    }
    return response.data.data;
  },

  /**
   * Сгенерировать смены на основе профиля
   */
  generateShifts: async (
    scheduleId: string,
    data: GenerateShiftsRequest
  ): Promise<{ count: number; shifts: unknown[] }> => {
    // Debug logging to browser console for quick copy
    try {
      // eslint-disable-next-line no-console
      console.info('[shift-manager][generateShifts][request]', {
        scheduleId,
        shiftProfileId: data.shiftProfileId,
        employeeIds: data.employeeIds,
        startDate: data.startDate,
        endDate: data.endDate,
      });
    } catch {}

    const response = await apiClient.post<ApiResponse<{ count: number; shifts: unknown[] }>>(
      `/schedules/${scheduleId}/generate-shifts`,
      data
    );
    if (!response.data.success || !response.data.data) {
      try {
        // eslint-disable-next-line no-console
        console.error('[shift-manager][generateShifts][error]', response.data.error, {
          scheduleId,
          shiftProfileId: data.shiftProfileId,
          employeeIds: data.employeeIds,
          startDate: data.startDate,
          endDate: data.endDate,
        });
      } catch {}
      throw new Error(response.data.error || 'Ошибка генерации смен');
    }
    try {
      // eslint-disable-next-line no-console
      console.info('[shift-manager][generateShifts][success]', {
        scheduleId,
        shiftProfileId: data.shiftProfileId,
        startDate: data.startDate,
        endDate: data.endDate,
        employees: data.employeeIds.length,
        createdOrUpdated: response.data.data.count,
      });
    } catch {}
    return response.data.data;
  },

  /**
   * Создать новый профиль смены
   */
  createShiftProfile: async (data: EditShiftProfileData): Promise<ShiftProfile> => {
    const response = await apiClient.post<ApiResponse<ShiftProfile>>('/shift-profiles', data);
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания профиля смены');
    }
    return response.data.data;
  },

  /**
   * Обновить профиль смены
   */
  updateShiftProfile: async (
    id: string,
    data: EditShiftProfileData
  ): Promise<ShiftProfile> => {
    const response = await apiClient.put<ApiResponse<ShiftProfile>>(
      `/shift-profiles/${id}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления профиля смены');
    }
    return response.data.data;
  },

  /**
   * Сравнить профили смен
   */
  compareProfiles: async (
    data: CompareProfilesRequest
  ): Promise<CompareProfilesResponse> => {
    const response = await apiClient.post<ApiResponse<CompareProfilesResponse>>(
      '/shift-profiles/compare',
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка сравнения профилей');
    }
    return response.data.data;
  },

  /**
   * Удалить профиль смены
   */
  deleteShiftProfile: async (id: string): Promise<void> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/shift-profiles/${id}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Ошибка удаления профиля смены');
    }
  },

  /**
   * Клонировать профиль смены
   */
  cloneShiftProfile: async (id: string): Promise<ShiftProfile> => {
    const response = await apiClient.post<ApiResponse<ShiftProfile>>(
      `/shift-profiles/${id}/clone`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка клонирования профиля смены');
    }
    return response.data.data;
  },
};

