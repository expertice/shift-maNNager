import { prisma } from '../lib/prisma';
import { Conflict } from '@prisma/client';
import { isWithinInterval } from 'date-fns';

/**
 * Получить конфликты для схемы
 */
export async function getConflictsBySchedule(
  scheduleId: string,
  resolved?: boolean
): Promise<Conflict[]> {
  const where: any = {
    scheduleId,
  };

  if (resolved !== undefined) {
    where.resolved = resolved;
  }

  return prisma.conflict.findMany({
    where,
    include: {
      dailyShift: {
        include: {
          employee: true,
          shiftType: true,
        },
      },
      vacation: {
        include: {
          employee: true,
        },
      },
      businessTrip: {
        include: {
          employee: true,
        },
      },
      solutions: {
        include: {
          employee: true,
        },
        orderBy: {
          priority: 'asc',
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Обнаружить и создать конфликты для схемы
 */
export async function detectConflicts(scheduleId: string): Promise<number> {
  // Получаем все смены схемы
  const shifts = await prisma.dailyShift.findMany({
    where: { scheduleId },
    include: {
      employee: true,
      shiftType: true,
    },
  });

  // Получаем все отпуска сотрудников схемы
  const employees = await prisma.employee.findMany({
    where: { scheduleId },
    select: { id: true },
  });

  const employeeIds = employees.map((e) => e.id);

  const vacations = await prisma.vacation.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: 'approved',
    },
    include: {
      employee: true,
    },
  });

  const businessTrips = await prisma.businessTrip.findMany({
    where: {
      employeeId: { in: employeeIds },
      status: 'approved',
    },
    include: {
      employee: true,
    },
  });

  let conflictCount = 0;

  // Проверяем конфликты смен с отпусками
  for (const shift of shifts) {
    for (const vacation of vacations) {
      if (
        shift.employeeId === vacation.employeeId &&
        isWithinInterval(shift.date, {
          start: vacation.startDate,
          end: vacation.endDate,
        })
      ) {
        // Проверяем, нет ли уже такого конфликта
        const existingConflict = await prisma.conflict.findFirst({
          where: {
            scheduleId,
            dailyShiftId: shift.id,
            vacationId: vacation.id,
            resolved: false,
          },
        });

        if (!existingConflict) {
          await prisma.conflict.create({
            data: {
              scheduleId,
              dailyShiftId: shift.id,
              vacationId: vacation.id,
              conflictType: 'shift_vs_vacation',
              resolved: false,
            },
          });
          conflictCount++;
        }
      }
    }

    // Проверяем конфликты смен с командировками
    for (const trip of businessTrips) {
      if (
        shift.employeeId === trip.employeeId &&
        isWithinInterval(shift.date, {
          start: trip.startDate,
          end: trip.endDate,
        })
      ) {
        const existingConflict = await prisma.conflict.findFirst({
          where: {
            scheduleId,
            dailyShiftId: shift.id,
            businessTripId: trip.id,
            resolved: false,
          },
        });

        if (!existingConflict) {
          await prisma.conflict.create({
            data: {
              scheduleId,
              dailyShiftId: shift.id,
              businessTripId: trip.id,
              conflictType: 'shift_vs_business_trip',
              resolved: false,
            },
          });
          conflictCount++;
        }
      }
    }
  }

  // Проверяем конфликты отпусков друг с другом (vacation_overlap)
  // TODO: Реализовать проверку правил (например, не более 2 сотрудников в отпуске одновременно)

  return conflictCount;
}

/**
 * Разрешить конфликт
 */
export async function resolveConflict(
  conflictId: string,
  scheduleId: string,
  solutionId?: string,
  resolutionNotes?: string
): Promise<Conflict | null> {
  // Проверяем, что конфликт принадлежит схеме
  const conflict = await prisma.conflict.findFirst({
    where: {
      id: conflictId,
      scheduleId,
    },
  });

  if (!conflict) {
    return null;
  }

  // Если передан solutionId, применяем решение
  if (solutionId) {
    const solution = await prisma.conflictSolution.findUnique({
      where: { id: solutionId },
    });

    if (solution && solution.conflictId === conflictId) {
      // Применяем решение (например, перемещаем смену)
      if (solution.newDate && conflict.dailyShiftId) {
        await prisma.dailyShift.update({
          where: { id: conflict.dailyShiftId },
          data: {
            employeeId: solution.employeeIdSubstitute,
            date: solution.newDate,
            status: 'modified',
            modifiedReason: 'Resolved conflict',
          },
        });
      }

      // Помечаем решение как принятое
      await prisma.conflictSolution.update({
        where: { id: solutionId },
        data: { status: 'accepted' },
      });
    }
  }

  // Помечаем конфликт как решенный
  return prisma.conflict.update({
    where: { id: conflictId },
    data: {
      resolved: true,
      resolutionNotes,
    },
    include: {
      dailyShift: true,
      vacation: true,
      businessTrip: true,
    },
  });
}

