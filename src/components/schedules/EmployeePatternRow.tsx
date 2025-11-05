import React from 'react';
import { SlotView } from '@components/shifts/PatternConstructor';
import { computePositionInCycle } from '@/utils/patternCycle';
import classNames from 'classnames';
import { Shift } from '@types';
import { format, startOfDay } from 'date-fns';

type SlotStatus = 'InsidePeriod' | 'OutsideMonth' | 'OutsidePeriod';

export interface EmployeePatternRowProps {
  employeeId: string;
  sequence: (string | null)[];
  editableMask: SlotStatus[]; // per slot status in current month (length = maxDays)
  onReorder?: (newSeq: (string | null)[]) => void;
  onSlotClick?: (employeeId: string, dayIndex: number, sequencePosition: number, event: React.MouseEvent<HTMLDivElement>) => void;
  year: number;
  month: number; // 0-based
  baseCycleStart: Date;
  employeeOffset: number; // startIndex
  shiftTypes?: Array<{
    id: string;
    name: string;
    color?: string;
    startTime?: string; // Время начала смены (HH:mm)
    endTime?: string; // Время окончания смены (HH:mm)
    workingHours?: number; // Количество рабочих часов
  }>;
  scaleX?: number;
  shiftsByDateAndEmployee?: Map<string, Shift>;
  selectedSlotId?: string; // ID выбранного слота для обмена (формат: `${employeeId}-${dayIndex}`)
  isSlotSelected?: (employeeId: string, dayIndex: number) => boolean;
}

// Компонент отдельного слота
const RosterSlot: React.FC<{
  id: string;
  shiftTypeId: string | null;
  dayIndex: number;
  status: SlotStatus;
  shiftTypes: Array<{
    id: string;
    name: string;
    color?: string;
    startTime?: string; // Время начала смены (HH:mm)
    endTime?: string; // Время окончания смены (HH:mm)
    workingHours?: number; // Количество рабочих часов
  }>;
  onSlotClick?: (dayIndex: number, event: React.MouseEvent<HTMLDivElement>) => void;
  isSelected?: boolean;
  employeeId: string;
  isSlotSelected?: (employeeId: string, dayIndex: number) => boolean;
  shiftTypeFromShift?: {
    startTime?: string;
    endTime?: string;
    workingHours?: number;
  };
}> = ({ id, shiftTypeId, dayIndex, status, shiftTypes, onSlotClick, isSelected, employeeId, isSlotSelected, shiftTypeFromShift }) => {
  const shiftType = shiftTypeId ? shiftTypes.find(st => st.id === shiftTypeId) : null;
  
  // Используем данные из смены, если они доступны, иначе из массива типов смен
  const effectiveShiftType = shiftType ? {
    ...shiftType,
    startTime: shiftTypeFromShift?.startTime || shiftType.startTime,
    endTime: shiftTypeFromShift?.endTime || shiftType.endTime,
    workingHours: shiftTypeFromShift?.workingHours !== undefined ? shiftTypeFromShift.workingHours : shiftType.workingHours,
  } : null;
  const isEmpty = shiftTypeId === null;
  const disabled = status !== 'InsidePeriod';
  const slotId = `${employeeId}-${dayIndex}`;
  
  // Используем функцию isSlotSelected, если она предоставлена, иначе используем isSelected prop
  const isActuallySelected = isSlotSelected 
    ? isSlotSelected(employeeId, dayIndex)
    : (isSelected && slotId === id);

  // Формируем tooltip с рабочими часами
  const getTooltipText = () => {
    if (isEmpty) {
      return 'Выходной';
    }
    if (!effectiveShiftType) {
      return 'Смена';
    }
    let tooltip = effectiveShiftType.name;
    const parts: string[] = [];
    if (effectiveShiftType.startTime && effectiveShiftType.endTime) {
      parts.push(`${effectiveShiftType.startTime} - ${effectiveShiftType.endTime}`);
    }
    if (effectiveShiftType.workingHours !== undefined) {
      // Форматируем часы: если целое число, показываем без десятичных, иначе с одним знаком
      const hours = effectiveShiftType.workingHours;
      const formattedHours = hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
      parts.push(`${formattedHours} ч.`);
    }
    if (parts.length > 0) {
      tooltip += ` (${parts.join(', ')})`;
    }
    return tooltip;
  };

  // Обработка Ctrl+клика на весь слот (для выбора для обмена)
  const handleSlotContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Только Ctrl+клик обрабатываем на контейнере
    if ((e.ctrlKey || e.metaKey) && onSlotClick && !disabled) {
      e.stopPropagation();
      onSlotClick(dayIndex, e);
    }
  };

  return (
    <div
      className={classNames(
        'relative',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-default',
        isActuallySelected && 'border-2 border-blue-600'
      )}
      onClick={handleSlotContainerClick}
    >
      <SlotView
        label={isEmpty ? undefined : (effectiveShiftType?.name?.charAt(0).toUpperCase() || '?')}
        color={effectiveShiftType?.color}
        isEmpty={isEmpty}
        isDragging={false}
        title={getTooltipText()}
        className="h-8"
      />
      {/* Кнопка-хотспот для назначения смены, открывает меню выбора типа смены */}
      {!disabled && (
        <button
          type="button"
          aria-label="Назначить тип смены"
          className="absolute top-0.5 right-0.5 z-20 w-4 h-4 rounded bg-white/80 border border-gray-300 text-[10px] leading-3 text-gray-600 hover:bg-white hover:border-blue-400 cursor-pointer"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (onSlotClick) {
              onSlotClick(dayIndex, e as unknown as React.MouseEvent<HTMLDivElement>);
            }
          }}
        >
          ·
        </button>
      )}
    </div>
  );
};

export default function EmployeePatternRow({
  employeeId,
  sequence,
  editableMask,
  onSlotClick,
  year,
  month,
  baseCycleStart,
  employeeOffset,
  shiftTypes = [],
  scaleX = 1,
  shiftsByDateAndEmployee,
  selectedSlotId,
  isSlotSelected,
}: EmployeePatternRowProps) {
  // Создаем карту типов смен для быстрого доступа
  const shiftTypeMap = React.useMemo(
    () => new Map(shiftTypes.map((st) => [st.id, { name: st.name, color: st.color }])),
    [shiftTypes]
  );

  // Обработка клика на слот
  const handleSlotClick = (dayIndex: number, event: React.MouseEvent<HTMLDivElement>) => {
    if (!onSlotClick) return;
    
    const dayDate = new Date(year, month, dayIndex + 1);
    const sequencePosition = computePositionInCycle(dayDate, baseCycleStart, sequence.length, employeeOffset || 0);
    onSlotClick(employeeId, dayIndex, sequencePosition, event);
  };

  return (
    <div
      className="flex items-center flex-nowrap gap-2"
      style={{ transform: `scaleX(${scaleX})`, transformOrigin: 'left center', width: 'max-content' }}
    >
      {editableMask.map((status, dayIndex) => {
        const dayDate = new Date(year, month, dayIndex + 1);
        const normalizedDate = startOfDay(dayDate);
        const dateStr = format(normalizedDate, 'yyyy-MM-dd');
        const key = `${dateStr}-${employeeId}`;
        
        // Сначала проверяем DailyShift со статусом 'modified' или 'cancelled', затем паттерн
        // DailyShift со статусом 'scheduled' игнорируются, так как они созданы генератором и должны показываться через паттерн
        const dailyShift = shiftsByDateAndEmployee?.get(key);
        const shiftTypeId = (dailyShift && (dailyShift.status === 'modified' || dailyShift.status === 'cancelled'))
          ? dailyShift.shiftTypeId
          : (() => {
              // Если DailyShift нет или он имеет статус 'scheduled', используем паттерн
              const pos = computePositionInCycle(dayDate, baseCycleStart, sequence.length, employeeOffset || 0);
              return sequence[pos] ?? null;
            })();
        
        const pos = computePositionInCycle(dayDate, baseCycleStart, sequence.length, employeeOffset || 0);
        const slotId = `${employeeId}-seq-${pos}-day-${dayIndex}`;
        const selectionId = `${employeeId}-${dayIndex}`;
        const isSelected = selectedSlotId === selectionId;

        // Получаем данные о типе смены из самой смены, если доступны
        const shiftTypeFromShift = dailyShift?.shiftType ? {
          startTime: dailyShift.shiftType.startTime,
          endTime: dailyShift.shiftType.endTime,
          workingHours: typeof dailyShift.shiftType.workingHours === 'number' 
            ? dailyShift.shiftType.workingHours 
            : (typeof dailyShift.shiftType.workingHours === 'string' 
              ? parseFloat(dailyShift.shiftType.workingHours) 
              : undefined),
        } : undefined;

        return (
          <RosterSlot
            key={slotId}
            id={selectionId}
            shiftTypeId={shiftTypeId}
            dayIndex={dayIndex}
            status={status}
            shiftTypes={shiftTypes}
            onSlotClick={handleSlotClick}
            isSelected={isSelected}
            employeeId={employeeId}
            isSlotSelected={isSlotSelected}
            shiftTypeFromShift={shiftTypeFromShift}
          />
        );
      })}
    </div>
  );
}


