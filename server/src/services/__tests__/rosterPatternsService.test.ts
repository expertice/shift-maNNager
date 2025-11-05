import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as service from '../rosterPatternsService';
import { prisma } from '../../lib/prisma';

// Мокируем Prisma
vi.mock('../../lib/prisma', () => ({
  prisma: {
    rosterPatternInstance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    employee: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn) => fn()),
  },
}));

describe('rosterPatternsService', () => {
  const scheduleId = 'schedule-1';
  const employeeId = 'employee-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstancesForSchedule', () => {
    it('should return existing instances', async () => {
      const existingInstances = [
        {
          id: 'inst-1',
          scheduleId,
          employeeId: 'emp-1',
          sequence: ['type-1', null],
          startIndex: 0,
        },
      ];
      const employees = [{ id: 'emp-1' }];

      (prisma.employee.findMany as any).mockResolvedValue(employees);
      (prisma.rosterPatternInstance.findMany as any)
        .mockResolvedValueOnce(existingInstances)
        .mockResolvedValueOnce(existingInstances);

      const result = await service.getInstancesForSchedule(scheduleId);

      expect(result).toEqual(existingInstances);
      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { scheduleId },
        select: { id: true },
      });
    });

    it('should create instances for employees without one', async () => {
      const employees = [{ id: 'emp-1' }, { id: 'emp-2' }];
      const existingInstances: any[] = [];

      (prisma.employee.findMany as any).mockResolvedValue(employees);
      (prisma.rosterPatternInstance.findMany as any)
        .mockResolvedValueOnce(existingInstances)
        .mockResolvedValueOnce([]);

      (prisma.rosterPatternInstance.create as any).mockResolvedValue({});

      await service.getInstancesForSchedule(scheduleId);

      expect(prisma.rosterPatternInstance.create).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateSequence', () => {
    it('should update sequence for employee', async () => {
      const newSequence = ['type-2', 'type-1', null];
      const updated = {
        id: 'inst-1',
        scheduleId,
        employeeId,
        sequence: newSequence,
        startIndex: 0,
      };

      (prisma.rosterPatternInstance.update as any).mockResolvedValue(updated);

      const result = await service.updateSequence(scheduleId, employeeId, newSequence);

      expect(result).toEqual(updated);
      expect(prisma.rosterPatternInstance.update).toHaveBeenCalledWith({
        where: { scheduleId_employeeId: { scheduleId, employeeId } },
        data: { sequence: newSequence },
      });
    });
  });

  describe('updateStartIndex', () => {
    it('should update start index for employee', async () => {
      const newStartIndex = 5;
      const updated = {
        id: 'inst-1',
        scheduleId,
        employeeId,
        sequence: ['type-1'],
        startIndex: newStartIndex,
      };

      (prisma.rosterPatternInstance.update as any).mockResolvedValue(updated);

      const result = await service.updateStartIndex(scheduleId, employeeId, newStartIndex);

      expect(result).toEqual(updated);
      expect(prisma.rosterPatternInstance.update).toHaveBeenCalledWith({
        where: { scheduleId_employeeId: { scheduleId, employeeId } },
        data: { startIndex: newStartIndex },
      });
    });
  });

  describe('lockIndices', () => {
    it('should merge new indices with existing locked indices', async () => {
      const existing = {
        id: 'inst-1',
        scheduleId,
        employeeId,
        lockedIndices: [0, 2],
      };
      const newIndices = [1, 3];
      const updated = { ...existing, lockedIndices: [0, 1, 2, 3] };

      (prisma.rosterPatternInstance.findUnique as any).mockResolvedValue(existing);
      (prisma.rosterPatternInstance.update as any).mockResolvedValue(updated);

      const result = await service.lockIndices(scheduleId, employeeId, newIndices);

      expect(result.lockedIndices).toEqual([0, 1, 2, 3]);
    });

    it('should create locked indices array if none exists', async () => {
      const existing = {
        id: 'inst-1',
        scheduleId,
        employeeId,
        lockedIndices: null,
      };
      const newIndices = [1, 3];

      (prisma.rosterPatternInstance.findUnique as any).mockResolvedValue(existing);
      (prisma.rosterPatternInstance.update as any).mockResolvedValue({
        ...existing,
        lockedIndices: [1, 3],
      });

      const result = await service.lockIndices(scheduleId, employeeId, newIndices);

      expect(result.lockedIndices).toEqual([1, 3]);
    });
  });

  describe('unlockIndices', () => {
    it('should remove specified indices from locked list', async () => {
      const existing = {
        id: 'inst-1',
        scheduleId,
        employeeId,
        lockedIndices: [0, 1, 2, 3],
      };
      const toUnlock = [1, 3];

      (prisma.rosterPatternInstance.findUnique as any).mockResolvedValue(existing);
      (prisma.rosterPatternInstance.update as any).mockResolvedValue({
        ...existing,
        lockedIndices: [0, 2],
      });

      const result = await service.unlockIndices(scheduleId, employeeId, toUnlock);

      expect(result.lockedIndices).toEqual([0, 2]);
    });
  });
});

