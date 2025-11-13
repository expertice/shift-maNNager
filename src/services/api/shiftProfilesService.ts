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
   * Получить все профили смен для конкретного расписания
   */
  getShiftProfiles: async (scheduleId: string): Promise<ShiftProfile[]> => {
    const response = await apiClient.get<ApiResponse<ShiftProfile[]>>(
      `/shift-profiles?scheduleId=${scheduleId}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки профилей смен');
    }
    return response.data.data;
  },

  /**
   * Получить профиль смены по ID
   */
  getShiftProfileById: async (id: string, scheduleId?: string): Promise<ShiftProfile> => {
    const url = scheduleId 
      ? `/shift-profiles/${id}?scheduleId=${scheduleId}`
      : `/shift-profiles/${id}`;
    const response = await apiClient.get<ApiResponse<ShiftProfile>>(url);
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
  deleteShiftProfile: async (id: string, scheduleId: string): Promise<void> => {
    const response = await apiClient.delete<ApiResponse<{ message: string }>>(
      `/shift-profiles/${id}?scheduleId=${scheduleId}`
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

  /**
   * Обновить смещение паттерна для всех экземпляров в расписании
   */
  updatePatternOffset: async (
    scheduleId: string,
    offsetDelta: number
  ): Promise<void> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      `/shift-profiles/update-pattern-offset`,
      { scheduleId, offsetDelta }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Ошибка обновления смещения паттерна');
    }
  },

  /**
   * Обновить смещение паттерна для конкретного сотрудника
   */
  updateEmployeePatternOffset: async (
    scheduleId: string,
    employeeId: string,
    offsetDelta: number
  ): Promise<void> => {
    const response = await apiClient.post<ApiResponse<{ message: string }>>(
      `/shift-profiles/update-employee-pattern-offset`,
      { scheduleId, employeeId, offsetDelta }
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Ошибка обновления смещения паттерна сотрудника');
    }
  },

  /**
   * Экспорт профилей смен
   */
  exportShiftProfiles: async (
    scheduleId: string,
    format: 'json' = 'json',
    profileIds?: string[]
  ): Promise<Blob> => {
    const params = new URLSearchParams({
      scheduleId,
      format,
    });
    if (profileIds && profileIds.length > 0) {
      profileIds.forEach(id => params.append('profileIds', id));
    }
    const response = await apiClient.get(
      `/shift-profiles/export?${params.toString()}`,
      { responseType: 'blob' }
    );
    return response.data;
  },

  /**
   * Импорт профилей смен
   */
  importShiftProfiles: async (
    scheduleId: string,
    file: File,
    mode: 'create' | 'update' | 'mixed'
  ): Promise<{
    success: number;
    errors: Array<{ row: number; message: string }>;
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);

    const response = await apiClient.post<ApiResponse<{
      success: number;
      errors: Array<{ row: number; message: string }>;
    }>>(
      `/shift-profiles/import?scheduleId=${scheduleId}`,
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
};

