import apiClient from './client';

export interface RosterSnapshot {
  id: string;
  scheduleId: string;
  employees: any[];
  shiftTypes: any[];
  instances: any[];
  shifts: any[];
  employeeOrder: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RosterSnapshotData {
  employees?: any[];
  shiftTypes?: any[];
  instances?: any[];
  shifts?: any[];
  employeeOrder?: string[];
}

/**
 * Получить снимок ростера для расписания
 */
export async function getRosterSnapshot(scheduleId: string): Promise<RosterSnapshot> {
  const response = await apiClient.get<RosterSnapshot>(`/schedules/${scheduleId}/roster-snapshot`);
  return response.data;
}

/**
 * Синхронизировать снимок ростера с текущими данными из БД
 */
export async function syncRosterSnapshot(scheduleId: string): Promise<RosterSnapshot> {
  const response = await apiClient.post<RosterSnapshot>(`/schedules/${scheduleId}/roster-snapshot/sync`);
  return response.data;
}

/**
 * Обновить снимок ростера
 */
export async function updateRosterSnapshot(
  scheduleId: string,
  data: RosterSnapshotData
): Promise<RosterSnapshot> {
  const response = await apiClient.put<RosterSnapshot>(`/schedules/${scheduleId}/roster-snapshot`, data);
  return response.data;
}

/**
 * Обновить порядок сотрудников в снимке ростера
 */
export async function updateEmployeeOrder(
  scheduleId: string,
  employeeOrder: string[]
): Promise<RosterSnapshot> {
  const response = await apiClient.put<RosterSnapshot>(
    `/schedules/${scheduleId}/roster-snapshot/employee-order`,
    { employeeOrder }
  );
  return response.data;
}

