import { prisma } from '../lib/prisma';
import { Vacation, VacationStatus } from '@prisma/client';
import * as realtimeService from './realtimeService';
import { detectConflicts } from './conflictsService';

export interface CreateVacationData {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  status: VacationStatus;
  createdBy: string;
}

export interface UpdateVacationData {
  startDate?: Date;
  endDate?: Date;
  status?: VacationStatus;
}

/**
 * Получить отпуска для схемы
 */
export async function getVacationsBySchedule(
  scheduleId: string,
  employeeId?: string,
  status?: string
): Promise<Vacation[]> {
  // Сначала получаем всех сотрудников схемы, затем их отпуска
  const employees = await prisma.employee.findMany({
    where: { scheduleId },
    select: { id: true },
  });

  const employeeIds = employees.map((e) => e.id);

  const where: any = {
    employeeId: {
      in: employeeIds,
    },
  };

  if (employeeId) {
    where.employeeId = employeeId;
  }

  if (status && ['approved', 'pending', 'rejected', 'cancelled'].includes(status)) {
    where.status = status as VacationStatus;
  }

  return prisma.vacation.findMany({
    where,
    include: {
      employee: true,
    },
    orderBy: {
      startDate: 'asc',
    },
  });
}

/**
 * Создать отпуск
 */
export async function createVacation(data: CreateVacationData): Promise<Vacation> {
  const employee = await prisma.employee.findUnique({
    where: { id: data.employeeId },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const vacation = await prisma.vacation.create({
    data: {
      employeeId: data.employeeId,
      startDate: data.startDate,
      endDate: data.endDate,
      status: data.status,
      createdBy: data.createdBy,
    },
    include: {
      employee: true,
    },
  });

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(vacation.employee.scheduleId, 'vacation:added', vacation);

  // Обнаруживаем конфликты
  await detectConflicts(vacation.employee.scheduleId);

  return vacation;
}

/**
 * Обновить отпуск
 */
export async function updateVacation(
  vacationId: string,
  scheduleId: string,
  data: UpdateVacationData
): Promise<Vacation | null> {
  // Проверяем, что отпуск принадлежит сотруднику из схемы
  const vacation = await prisma.vacation.findFirst({
    where: { id: vacationId },
    include: {
      employee: true,
    },
  });

  if (!vacation || vacation.employee.scheduleId !== scheduleId) {
    return null;
  }

  const updated = await prisma.vacation.update({
    where: { id: vacationId },
    data: {
      ...(data.startDate && { startDate: data.startDate }),
      ...(data.endDate && { endDate: data.endDate }),
      ...(data.status && { status: data.status }),
    },
    include: {
      employee: true,
    },
  });

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(scheduleId, 'vacation:updated', updated);

  // Обнаруживаем конфликты
  await detectConflicts(scheduleId);

  return updated;
}

/**
 * Удалить отпуск
 */
export async function deleteVacation(
  vacationId: string,
  scheduleId: string
): Promise<boolean> {
  // Проверяем, что отпуск принадлежит сотруднику из схемы
  const vacation = await prisma.vacation.findFirst({
    where: { id: vacationId },
    include: {
      employee: true,
    },
  });

  if (!vacation || vacation.employee.scheduleId !== scheduleId) {
    return false;
  }

  await prisma.vacation.delete({
    where: { id: vacationId },
  });

  // Отправляем real-time событие
  realtimeService.emitVacationEvent(scheduleId, 'vacation:deleted', { id: vacationId });

  // Обнаруживаем конфликты
  await detectConflicts(scheduleId);

  return true;
}

