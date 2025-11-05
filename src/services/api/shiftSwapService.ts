import apiClient from './client';

export interface ShiftSwapRequest {
  id: string;
  scheduleId: string;
  initiatorEmployeeId: string;
  fromEmployeeId: string;
  fromDate: string;
  toEmployeeId: string;
  toDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  schedule?: {
    id: string;
    name: string;
  };
  initiatorEmployee?: {
    id: string;
    fullName: string;
    tabNumber: string | null;
  };
  fromEmployee?: {
    id: string;
    fullName: string;
    tabNumber: string | null;
  };
  toEmployee?: {
    id: string;
    fullName: string;
    tabNumber: string | null;
  };
}

export interface CreateSwapRequestData {
  initiatorEmployeeId: string;
  fromEmployeeId: string;
  fromDate: string; // ISO date string
  toEmployeeId: string;
  toDate: string; // ISO date string
}

/**
 * Сервис для работы с запросами на обмен сменами
 */
export const shiftSwapService = {
  /**
   * Создать запрос на обмен сменами
   */
  createSwapRequest: async (
    scheduleId: string,
    data: CreateSwapRequestData
  ): Promise<ShiftSwapRequest> => {
    const response = await apiClient.post<{ success: boolean; data: ShiftSwapRequest }>(
      `/schedules/${scheduleId}/shift-swaps`,
      data
    );
    return response.data.data;
  },

  /**
   * Получить все запросы на обмен для схемы
   */
  getSwapRequests: async (
    scheduleId: string,
    status?: 'pending' | 'approved' | 'rejected' | 'cancelled'
  ): Promise<ShiftSwapRequest[]> => {
    const params = status ? { status } : {};
    const response = await apiClient.get<{ success: boolean; data: ShiftSwapRequest[] }>(
      `/schedules/${scheduleId}/shift-swaps`,
      { params }
    );
    return response.data.data;
  },

  /**
   * Подтвердить запрос на обмен
   */
  approveSwapRequest: async (
    scheduleId: string,
    requestId: string
  ): Promise<ShiftSwapRequest> => {
    const response = await apiClient.post<{ success: boolean; data: ShiftSwapRequest }>(
      `/schedules/${scheduleId}/shift-swaps/${requestId}/approve`
    );
    return response.data.data;
  },

  /**
   * Отклонить запрос на обмен
   */
  rejectSwapRequest: async (
    scheduleId: string,
    requestId: string
  ): Promise<ShiftSwapRequest> => {
    const response = await apiClient.post<{ success: boolean; data: ShiftSwapRequest }>(
      `/schedules/${scheduleId}/shift-swaps/${requestId}/reject`
    );
    return response.data.data;
  },

  /**
   * Отменить запрос на обмен (инициатором)
   */
  cancelSwapRequest: async (
    scheduleId: string,
    requestId: string,
    employeeId: string
  ): Promise<void> => {
    await apiClient.delete(`/shift-swaps/${requestId}`, {
      data: { scheduleId, employeeId },
    });
  },
};

