import { useState, useCallback } from 'react';

export interface SelectedSlot {
  employeeId: string;
  dayIndex: number;
}

export interface UseSlotSelectionResult {
  selectedSlot: SelectedSlot | null;
  selectSlot: (employeeId: string, dayIndex: number) => void;
  clearSelection: () => void;
  toggleSlot: (employeeId: string, dayIndex: number) => void;
  isSlotSelected: (employeeId: string, dayIndex: number) => boolean;
}

/**
 * Хук для управления выбором слотов для обмена сменами
 */
export function useSlotSelection(): UseSlotSelectionResult {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);

  const selectSlot = useCallback((employeeId: string, dayIndex: number) => {
    setSelectedSlot({ employeeId, dayIndex });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
  }, []);

  const toggleSlot = useCallback((employeeId: string, dayIndex: number) => {
    setSelectedSlot((prev) => {
      // Если кликнули на тот же слот - снимаем выделение
      if (prev && prev.employeeId === employeeId && prev.dayIndex === dayIndex) {
        return null;
      }
      // Иначе выбираем новый слот
      return { employeeId, dayIndex };
    });
  }, []);

  const isSlotSelected = useCallback((employeeId: string, dayIndex: number) => {
    return selectedSlot?.employeeId === employeeId && selectedSlot?.dayIndex === dayIndex;
  }, [selectedSlot]);

  return {
    selectedSlot,
    selectSlot,
    clearSelection,
    toggleSlot,
    isSlotSelected,
  };
}
