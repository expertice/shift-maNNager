import apiClient from './client';
import { ApiResponse, VacationRules, EmployeeVacationAllocation } from '@types';

export interface UpdateVacationRulesRequest {
  availableDays?: number;
  minContinuousDays?: number;
  maxConcurrentEmployees?: number;
}

export interface EmployeeAllocationRequest {
  employeeId: string;
  year: number;
  allocatedDays: number;
}

/**
 * Сервис для работы с правилами отпусков
 */
export const vacationRulesService = {
  /**
   * Получить правила отпусков для схемы
   */
  getVacationRules: async (scheduleId: string): Promise<VacationRules | null> => {
    const response = await apiClient.get<ApiResponse<VacationRules | null>>(
      `/schedules/${scheduleId}/vacation-rules`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Ошибка загрузки правил отпусков');
    }
    return response.data.data;
  },

  /**
   * Обновить правила отпусков для схемы
   */
  updateVacationRules: async (
    scheduleId: string,
    data: UpdateVacationRulesRequest
  ): Promise<VacationRules> => {
    const response = await apiClient.put<ApiResponse<VacationRules>>(
      `/schedules/${scheduleId}/vacation-rules`,
      data
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления правил отпусков');
    }
    return response.data.data;
  },

  /**
   * Получить все выделения дней отпуска для схемы
   */
  getEmployeeAllocations: async (
    scheduleId: string,
    year?: number
  ): Promise<EmployeeVacationAllocation[]> => {
    const params = year ? `?year=${year}` : '';
    const response = await apiClient.get<ApiResponse<EmployeeVacationAllocation[]>>(
      `/schedules/${scheduleId}/vacation-rules/allocations${params}`
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка загрузки выделений отпусков');
    }
    return response.data.data;
  },

  /**
   * Обновить выделения дней отпуска для нескольких сотрудников (bulk)
   */
  updateEmployeeAllocations: async (
    scheduleId: string,
    allocations: EmployeeAllocationRequest[]
  ): Promise<EmployeeVacationAllocation[]> => {
    const response = await apiClient.put<ApiResponse<EmployeeVacationAllocation[]>>(
      `/schedules/${scheduleId}/vacation-rules/allocations`,
      { allocations }
    );
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || 'Ошибка обновления выделений отпусков');
    }
    return response.data.data;
  },

  /**
   * Получить выделение дней отпуска для конкретного сотрудника
   */
  getEmployeeAllocation: async (
    scheduleId: string,
    employeeId: string,
    year: number
  ): Promise<EmployeeVacationAllocation | null> => {
    const response = await apiClient.get<ApiResponse<EmployeeVacationAllocation | null>>(
      `/schedules/${scheduleId}/vacation-rules/allocations/${employeeId}/${year}`
    );
    if (!response.data.success) {
      throw new Error(response.data.error || 'Ошибка загрузки выделения отпуска');
    }
    return response.data.data;
  },
};

