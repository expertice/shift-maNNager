import apiClient from './client';

export interface RosterPatternInstanceDTO {
  id: string;
  scheduleId: string;
  employeeId: string;
  patternId?: string | null;
  startIndex: number;
  sequence: (string | null)[];
  lockedIndices?: number[] | null;
}

export async function getInstances(scheduleId: string): Promise<RosterPatternInstanceDTO[]> {
  const res = await apiClient.get(`/schedules/${scheduleId}/pattern-instances`);
  return res.data.data as RosterPatternInstanceDTO[];
}

export async function updateSequence(
  scheduleId: string,
  employeeId: string,
  sequence: (string | null)[]
): Promise<RosterPatternInstanceDTO> {
  const res = await apiClient.patch(
    `/schedules/${scheduleId}/pattern-instances/${employeeId}/sequence`,
    { sequence }
  );
  return res.data.data as RosterPatternInstanceDTO;
}

export async function updateStartIndex(
  scheduleId: string,
  employeeId: string,
  startIndex: number
): Promise<RosterPatternInstanceDTO> {
  const res = await apiClient.patch(
    `/schedules/${scheduleId}/pattern-instances/${employeeId}/start-index`,
    { startIndex }
  );
  return res.data.data as RosterPatternInstanceDTO;
}

export async function lockIndices(
  scheduleId: string,
  employeeId: string,
  indices: number[]
): Promise<RosterPatternInstanceDTO> {
  const res = await apiClient.post(
    `/schedules/${scheduleId}/pattern-instances/${employeeId}/lock`,
    { indices }
  );
  return res.data.data as RosterPatternInstanceDTO;
}

export async function unlockIndices(
  scheduleId: string,
  employeeId: string,
  indices: number[]
): Promise<RosterPatternInstanceDTO> {
  const res = await apiClient.post(
    `/schedules/${scheduleId}/pattern-instances/${employeeId}/unlock`,
    { indices }
  );
  return res.data.data as RosterPatternInstanceDTO;
}


