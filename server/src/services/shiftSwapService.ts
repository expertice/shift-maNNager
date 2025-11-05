import { prisma } from '../lib/prisma';
import { ShiftSwapRequest, ShiftSwapRequestStatus, DailyShift, ShiftStatus } from '@prisma/client';
import { swapShifts } from './shiftsService';

export interface CreateShiftSwapRequestData {
  scheduleId: string;
  initiatorEmployeeId: string;
  fromEmployeeId: string;
  fromDate: Date;
  toEmployeeId: string;
  toDate: Date;
}

export interface ShiftSwapRequestWithDetails extends ShiftSwapRequest {
  schedule: { id: string; name: string };
  initiatorEmployee: { id: string; fullName: string; tabNumber: string | null };
  fromEmployee: { id: string; fullName: string; tabNumber: string | null };
  toEmployee: { id: string; fullName: string; tabNumber: string | null };
}

/**
 * Создать запрос на обмен сменами
 */
export async function createSwapRequest(
  data: CreateShiftSwapRequestData
): Promise<ShiftSwapRequest> {
  // Проверяем, что схема существует
  const schedule = await prisma.schedule.findUnique({
    where: { id: data.scheduleId },
  });

  if (!schedule) {
    throw new Error('Schedule not found');
  }

  // Проверяем, что сотрудники существуют и принадлежат схеме
  const [fromEmployee, toEmployee, initiatorEmployee] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: data.fromEmployeeId, scheduleId: data.scheduleId },
    }),
    prisma.employee.findFirst({
      where: { id: data.toEmployeeId, scheduleId: data.scheduleId },
    }),
    prisma.employee.findFirst({
      where: { id: data.initiatorEmployeeId, scheduleId: data.scheduleId },
    }),
  ]);

  if (!fromEmployee || !toEmployee || !initiatorEmployee) {
    throw new Error('One or more employees not found');
  }

  // Проверяем, что сотрудник не пытается обменять смену с самим собой
  if (data.fromEmployeeId === data.toEmployeeId) {
    throw new Error('Cannot swap shift with yourself');
  }

  // Проверяем, что смены существуют (или могут быть созданы)
  // Для fromDate
  const fromShift = await prisma.dailyShift.findFirst({
    where: {
      scheduleId: data.scheduleId,
      employeeId: data.fromEmployeeId,
      date: data.fromDate,
    },
  });

  // Для toDate
  const toShift = await prisma.dailyShift.findFirst({
    where: {
      scheduleId: data.scheduleId,
      employeeId: data.toEmployeeId,
      date: data.toDate,
    },
  });

  // Проверяем, нет ли уже pending запроса для этих смен
  const existingRequest = await prisma.shiftSwapRequest.findFirst({
    where: {
      scheduleId: data.scheduleId,
      status: 'pending',
      OR: [
        {
          fromEmployeeId: data.fromEmployeeId,
          fromDate: data.fromDate,
          toEmployeeId: data.toEmployeeId,
          toDate: data.toDate,
        },
        {
          fromEmployeeId: data.toEmployeeId,
          fromDate: data.toDate,
          toEmployeeId: data.fromEmployeeId,
          toDate: data.fromDate,
        },
      ],
    },
  });

  if (existingRequest) {
    throw new Error('A pending swap request already exists for these shifts');
  }

  // Создаем запрос
  return prisma.shiftSwapRequest.create({
    data: {
      scheduleId: data.scheduleId,
      initiatorEmployeeId: data.initiatorEmployeeId,
      fromEmployeeId: data.fromEmployeeId,
      fromDate: data.fromDate,
      toEmployeeId: data.toEmployeeId,
      toDate: data.toDate,
      status: 'pending',
    },
  });
}

/**
 * Получить все запросы на обмен для схемы
 */
export async function getSwapRequests(
  scheduleId: string,
  status?: ShiftSwapRequestStatus
): Promise<ShiftSwapRequestWithDetails[]> {
  const where: { scheduleId: string; status?: ShiftSwapRequestStatus } = {
    scheduleId,
  };

  if (status) {
    where.status = status;
  }

  return prisma.shiftSwapRequest.findMany({
    where,
    include: {
      schedule: {
        select: {
          id: true,
          name: true,
        },
      },
      initiatorEmployee: {
        select: {
          id: true,
          fullName: true,
          tabNumber: true,
        },
      },
      fromEmployee: {
        select: {
          id: true,
          fullName: true,
          tabNumber: true,
        },
      },
      toEmployee: {
        select: {
          id: true,
          fullName: true,
          tabNumber: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  }) as Promise<ShiftSwapRequestWithDetails[]>;
}

/**
 * Подтвердить запрос на обмен (выполнить обмен смен)
 */
export async function approveSwapRequest(
  requestId: string,
  scheduleId: string
): Promise<ShiftSwapRequest> {
  // Получаем запрос
  const request = await prisma.shiftSwapRequest.findFirst({
    where: {
      id: requestId,
      scheduleId,
      status: 'pending',
    },
  });

  if (!request) {
    throw new Error('Swap request not found or already processed');
  }

  // Получаем или создаем смены для обмена
  const fromShift = await prisma.dailyShift.findFirst({
    where: {
      scheduleId: request.scheduleId,
      employeeId: request.fromEmployeeId,
      date: request.fromDate,
    },
  });

  const toShift = await prisma.dailyShift.findFirst({
    where: {
      scheduleId: request.scheduleId,
      employeeId: request.toEmployeeId,
      date: request.toDate,
    },
  });

  // Если смены не существуют, создаем их (используем паттерн или создаем пустые)
  // Для упрощения, если смены нет - создаем с null shiftTypeId
  let fromShiftId = fromShift?.id;
  let toShiftId = toShift?.id;

  if (!fromShift) {
    const created = await prisma.dailyShift.create({
      data: {
        scheduleId: request.scheduleId,
        employeeId: request.fromEmployeeId,
        date: request.fromDate,
        shiftTypeId: null,
        status: 'scheduled',
      },
    });
    fromShiftId = created.id;
  }

  if (!toShift) {
    const created = await prisma.dailyShift.create({
      data: {
        scheduleId: request.scheduleId,
        employeeId: request.toEmployeeId,
        date: request.toDate,
        shiftTypeId: null,
        status: 'scheduled',
      },
    });
    toShiftId = created.id;
  }

  // Выполняем обмен смен
  if (fromShiftId && toShiftId) {
    // Получаем данные смен для обмена
    const fromShiftData = fromShiftId === fromShift?.id
      ? fromShift
      : await prisma.dailyShift.findUnique({ where: { id: fromShiftId } });
    const toShiftData = toShiftId === toShift?.id
      ? toShift
      : await prisma.dailyShift.findUnique({ where: { id: toShiftId } });

    if (fromShiftData && toShiftData) {
      // Сохраняем данные для обмена
      const fromShiftTypeId = fromShiftData.shiftTypeId;
      const toShiftTypeId = toShiftData.shiftTypeId;

      // Обмениваем смены через транзакцию:
      // Смена fromEmployeeId на fromDate получает shiftTypeId от toEmployeeId на toDate
      // Смена toEmployeeId на toDate получает shiftTypeId от fromEmployeeId на fromDate
      await prisma.$transaction([
        prisma.dailyShift.update({
          where: { id: fromShiftId },
          data: {
            shiftTypeId: toShiftTypeId,
            status: 'modified' as ShiftStatus,
            modifiedReason: 'Swapped via swap request',
          },
        }),
        prisma.dailyShift.update({
          where: { id: toShiftId },
          data: {
            shiftTypeId: fromShiftTypeId,
            status: 'modified' as ShiftStatus,
            modifiedReason: 'Swapped via swap request',
          },
        }),
      ]);
    }
  }

  // Обновляем статус запроса
  return prisma.shiftSwapRequest.update({
    where: { id: requestId },
    data: {
      status: 'approved',
    },
  });
}

/**
 * Отклонить запрос на обмен
 */
export async function rejectSwapRequest(
  requestId: string,
  scheduleId: string
): Promise<ShiftSwapRequest> {
  const request = await prisma.shiftSwapRequest.findFirst({
    where: {
      id: requestId,
      scheduleId,
      status: 'pending',
    },
  });

  if (!request) {
    throw new Error('Swap request not found or already processed');
  }

  return prisma.shiftSwapRequest.update({
    where: { id: requestId },
    data: {
      status: 'rejected',
    },
  });
}

/**
 * Отменить запрос на обмен (инициатором)
 */
export async function cancelSwapRequest(
  requestId: string,
  scheduleId: string,
  employeeId: string
): Promise<ShiftSwapRequest> {
  const request = await prisma.shiftSwapRequest.findFirst({
    where: {
      id: requestId,
      scheduleId,
      initiatorEmployeeId: employeeId,
      status: 'pending',
    },
  });

  if (!request) {
    throw new Error('Swap request not found, already processed, or you are not the initiator');
  }

  return prisma.shiftSwapRequest.update({
    where: { id: requestId },
    data: {
      status: 'cancelled',
    },
  });
}

