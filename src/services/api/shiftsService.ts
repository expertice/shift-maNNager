import apiClient from './client';
import { ApiResponse, PaginatedResponse, Shift } from '@types';

export interface CreateShiftRequest {
  employeeId: string;
  date: string; // ISO date string
  shiftTypeId: string | null;
}

export interface UpdateShiftRequest {
  shiftTypeId?: string | null;
  date?: string; // ISO date string
  status?: 'scheduled' | 'modified' | 'cancelled';
  modifiedReason?: string;
}

export interface BulkCreateShiftRequest {
  shifts: Array<{
    employeeId: string;
    date: string; // ISO date string
    shiftTypeId: string | null;
  }>;
}

export interface SwapShiftsRequest {
  shiftId1: string;
  shiftId2: string;
}

/**
 * Сервис для работы со сменами
 */
export const shiftsService = {
  /**
   * Получить список смен схемы
   */
  getShifts: async (
    scheduleId: string,
    params?: {
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedResponse<Shift>> => {
    const response = await apiClient.get<ApiResponse<Shift[] | PaginatedResponse<Shift>>>(
      `/schedules/${scheduleId}/shifts`,
      { params }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки смен');
    }
    // Бэкенд возвращает массив напрямую, оборачиваем в пагинированный формат
    const data = response.data.data;
    if (Array.isArray(data)) {
      return {
        items: data,
        total: data.length,
        page: 1,
        pageSize: data.length,
        totalPages: 1,
      };
    }
    return data;
  },

  /**
   * Создать смену
   */
  createShift: async (scheduleId: string, data: CreateShiftRequest): Promise<Shift> => {
    const response = await apiClient.post<ApiResponse<Shift>>(
      `/schedules/${scheduleId}/shifts`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка создания смены');
    }
    return response.data.data;
  },

  /**
   * Массовое создание смен
   */
  bulkCreateShifts: async (
    scheduleId: string,
    data: BulkCreateShiftRequest
  ): Promise<{ count: number }> => {
    const response = await apiClient.post<ApiResponse<{ count: number }>>(
      `/schedules/${scheduleId}/shifts/bulk`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка массового создания смен');
    }
    return response.data.data;
  },

  /**
   * Обмен сменами между сотрудниками
   */
  swapShifts: async (scheduleId: string, data: SwapShiftsRequest): Promise<{ shift1: Shift; shift2: Shift }> => {
    const response = await apiClient.post<ApiResponse<{ shift1: Shift; shift2: Shift }>>(
      `/schedules/${scheduleId}/shifts/swap`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обмена сменами');
    }
    return response.data.data;
  },

  /**
   * Обновить смену
   */
  updateShift: async (
    scheduleId: string,
    shiftId: string,
    data: UpdateShiftRequest
  ): Promise<Shift> => {
    const response = await apiClient.put<ApiResponse<Shift>>(
      `/schedules/${scheduleId}/shifts/${shiftId}`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления смены');
    }
    return response.data.data;
  },

  /**
   * Удалить смену
   */
  deleteShift: async (scheduleId: string, shiftId: string): Promise<void> => {
    await apiClient.delete(`/schedules/${scheduleId}/shifts/${shiftId}`);
  },

  /**
   * Удалить все смены сотрудника в периоде расписания
   */
  deleteEmployeeShifts: async (
    scheduleId: string,
    employeeId: string,
    startDate: string,
    endDate: string
  ): Promise<{ count: number }> => {
    const response = await apiClient.delete<ApiResponse<{ count: number }>>(
      `/schedules/${scheduleId}/shifts/employee/${employeeId}`,
      {
        params: {
          startDate,
          endDate,
        },
      }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка удаления смен сотрудника');
    }
    return response.data.data;
  },
};

