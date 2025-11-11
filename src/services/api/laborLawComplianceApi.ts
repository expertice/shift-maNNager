/**
 * API клиент для работы с проверкой соответствия ТК РФ
 */

import {
  LaborLawSettings,
  WorkHoursNorm,
  LaborViolation,
  ViolationStats,
  LaborViolationType,
  ViolationSeverity,
} from '../../types';
import apiClient from './client';

const BASE_URL = '/labor-law';

/**
 * Получить настройки контроля ТК РФ
 */
export async function getSettings(): Promise<LaborLawSettings> {
  const response = await apiClient.get<{ success: boolean; data: LaborLawSettings }>(
    `${BASE_URL}/settings`
  );
  return response.data.data;
}

/**
 * Обновить настройки контроля ТК РФ
 */
export async function updateSettings(
  settings: Partial<LaborLawSettings>
): Promise<LaborLawSettings> {
  const response = await apiClient.put<{ success: boolean; data: LaborLawSettings }>(
    `${BASE_URL}/settings`,
    settings
  );
  return response.data.data;
}

/**
 * Получить все нормы часов
 */
export async function getAllWorkHoursNorms(): Promise<WorkHoursNorm[]> {
  const response = await apiClient.get<{ success: boolean; data: WorkHoursNorm[] }>(
    `${BASE_URL}/work-hours-norms`
  );
  return response.data.data;
}

/**
 * Получить норму часов для конкретного года
 */
export async function getWorkHoursNormByYear(
  year: number
): Promise<{ year: number; totalHours: number }> {
  const response = await apiClient.get<{
    success: boolean;
    data: { year: number; totalHours: number };
  }>(`${BASE_URL}/work-hours-norms/${year}`);
  return response.data.data;
}

/**
 * Обновить норму часов вручную
 */
export async function updateWorkHoursNorm(
  year: number,
  hours: number,
  isManual: boolean = true
): Promise<void> {
  await apiClient.put(`${BASE_URL}/work-hours-norms/${year}`, {
    hours,
    isManual,
  });
}

/**
 * Синхронизировать норму из внешнего источника
 */
export async function syncWorkHoursNorm(
  year: number,
  source?: string
): Promise<{ year: number; totalHours: number }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { year: number; totalHours: number };
  }>(`${BASE_URL}/work-hours-norms/${year}/sync`, { source });
  return response.data.data;
}

/**
 * Пересчитать норму из производственного календаря
 */
export async function calculateWorkHoursNorm(
  year: number
): Promise<{ year: number; totalHours: number; calendar: any }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { year: number; totalHours: number; calendar: any };
  }>(`${BASE_URL}/work-hours-norms/${year}/calculate`);
  return response.data.data;
}

/**
 * Запустить проверку расписания вручную
 */
export async function validateSchedule(
  scheduleId: string
): Promise<{ violationsCount: number; violations: any[] }> {
  const response = await apiClient.post<{
    success: boolean;
    data: { violationsCount: number; violations: any[] };
  }>(`${BASE_URL}/validate/${scheduleId}`);
  return response.data.data;
}

/**
 * Получить нарушения для расписания
 */
export async function getViolations(
  scheduleId: string,
  filters?: {
    employeeId?: string;
    violationType?: LaborViolationType;
    severity?: ViolationSeverity;
    resolved?: boolean;
  }
): Promise<LaborViolation[]> {
  const params = new URLSearchParams();

  if (filters?.employeeId) {
    params.append('employeeId', filters.employeeId);
  }

  if (filters?.violationType) {
    params.append('violationType', filters.violationType);
  }

  if (filters?.severity) {
    params.append('severity', filters.severity);
  }

  if (filters?.resolved !== undefined) {
    params.append('resolved', String(filters.resolved));
  }

  const url = `${BASE_URL}/violations/${scheduleId}${
    params.toString() ? `?${params.toString()}` : ''
  }`;

  const response = await apiClient.get<{ success: boolean; data: LaborViolation[] }>(url);
  return response.data.data;
}

/**
 * Отметить нарушение как решенное
 */
export async function resolveViolation(
  violationId: string,
  notes: string
): Promise<void> {
  await apiClient.put(`${BASE_URL}/violations/${violationId}/resolve`, {
    notes,
  });
}

/**
 * Получить статистику нарушений для расписания
 */
export async function getViolationStats(scheduleId: string): Promise<ViolationStats> {
  const response = await apiClient.get<{ success: boolean; data: ViolationStats }>(
    `${BASE_URL}/violations/${scheduleId}/stats`
  );
  return response.data.data;
}

