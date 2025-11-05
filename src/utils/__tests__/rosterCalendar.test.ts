import { describe, it, expect } from 'vitest';
import {
  getDaysInMonth,
  splitPeriodByMonths,
  maxDaysAcrossMonths,
  getSlotStatus,
  MonthSlice,
} from '../rosterCalendar';

describe('rosterCalendar utils', () => {
  describe('getDaysInMonth', () => {
    it('should return correct days for February (non-leap)', () => {
      expect(getDaysInMonth(2025, 1)).toBe(28);
    });

    it('should return correct days for February (leap)', () => {
      expect(getDaysInMonth(2024, 1)).toBe(29);
    });

    it('should return 31 for January', () => {
      expect(getDaysInMonth(2025, 0)).toBe(31);
    });

    it('should return 30 for April', () => {
      expect(getDaysInMonth(2025, 3)).toBe(30);
    });
  });

  describe('splitPeriodByMonths', () => {
    it('should split single month period', () => {
      const start = new Date(2025, 0, 1); // Jan 1
      const end = new Date(2025, 0, 31); // Jan 31
      const slices = splitPeriodByMonths(start, end);

      expect(slices).toHaveLength(1);
      expect(slices[0].year).toBe(2025);
      expect(slices[0].month).toBe(0);
      expect(slices[0].daysInMonth).toBe(31);
    });

    it('should split multi-month period', () => {
      const start = new Date(2025, 0, 15); // Jan 15
      const end = new Date(2025, 2, 10); // Mar 10
      const slices = splitPeriodByMonths(start, end);

      expect(slices).toHaveLength(3);
      expect(slices[0].month).toBe(0); // January
      expect(slices[1].month).toBe(1); // February
      expect(slices[2].month).toBe(2); // March
    });

    it('should handle year boundary', () => {
      const start = new Date(2024, 11, 15); // Dec 15, 2024
      const end = new Date(2025, 1, 10); // Feb 10, 2025
      const slices = splitPeriodByMonths(start, end);

      expect(slices.length).toBeGreaterThan(1);
      expect(slices[0].year).toBe(2024);
      expect(slices[slices.length - 1].year).toBe(2025);
    });
  });

  describe('maxDaysAcrossMonths', () => {
    it('should return maximum days across slices', () => {
      const slices: MonthSlice[] = [
        { year: 2025, month: 0, daysInMonth: 31, start: new Date(), end: new Date() },
        { year: 2025, month: 1, daysInMonth: 28, start: new Date(), end: new Date() },
        { year: 2025, month: 2, daysInMonth: 31, start: new Date(), end: new Date() },
      ];

      expect(maxDaysAcrossMonths(slices)).toBe(31);
    });

    it('should return 0 for empty array', () => {
      expect(maxDaysAcrossMonths([])).toBe(0);
    });
  });

  describe('getSlotStatus', () => {
    const slice: MonthSlice = {
      year: 2025,
      month: 0, // January
      daysInMonth: 31,
      start: new Date(2025, 0, 1),
      end: new Date(2025, 0, 31),
    };

    it('should return InsidePeriod for valid day within period', () => {
      const periodStart = new Date(2025, 0, 1);
      const periodEnd = new Date(2025, 0, 31);

      expect(getSlotStatus(0, slice, periodStart, periodEnd)).toBe('InsidePeriod');
      expect(getSlotStatus(15, slice, periodStart, periodEnd)).toBe('InsidePeriod');
    });

    it('should return OutsideMonth for day beyond month length', () => {
      const periodStart = new Date(2025, 0, 1);
      const periodEnd = new Date(2025, 0, 31);

      expect(getSlotStatus(31, slice, periodStart, periodEnd)).toBe('OutsideMonth');
      expect(getSlotStatus(32, slice, periodStart, periodEnd)).toBe('OutsideMonth');
    });

    it('should return OutsidePeriod for day before period start', () => {
      const periodStart = new Date(2025, 0, 10);
      const periodEnd = new Date(2025, 0, 31);

      expect(getSlotStatus(0, slice, periodStart, periodEnd)).toBe('OutsidePeriod');
      expect(getSlotStatus(8, slice, periodStart, periodEnd)).toBe('OutsidePeriod');
    });

    it('should return OutsidePeriod for day after period end', () => {
      const periodStart = new Date(2025, 0, 1);
      const periodEnd = new Date(2025, 0, 20);

      expect(getSlotStatus(20, slice, periodStart, periodEnd)).toBe('OutsidePeriod');
      expect(getSlotStatus(30, slice, periodStart, periodEnd)).toBe('OutsidePeriod');
    });

    it('should handle February with 28 days', () => {
      const febSlice: MonthSlice = {
        year: 2025,
        month: 1,
        daysInMonth: 28,
        start: new Date(2025, 1, 1),
        end: new Date(2025, 1, 28),
      };
      const periodStart = new Date(2025, 1, 1);
      const periodEnd = new Date(2025, 1, 28);

      expect(getSlotStatus(27, febSlice, periodStart, periodEnd)).toBe('InsidePeriod');
      expect(getSlotStatus(28, febSlice, periodStart, periodEnd)).toBe('OutsideMonth');
    });
  });
});

