import React, { useEffect, useRef, useState } from 'react';
import EmployeePatternRow from './EmployeePatternRow';
import { MonthSlice, getSlotStatus, SlotStatus } from '@/utils/rosterCalendar';
import { SlotView } from '@components/shifts/PatternConstructor';
import { Shift } from '@types';
import { startOfDay } from 'date-fns';
import { useSlotSelection } from '@/hooks/useSlotSelection';

export interface RosterMonthBoardProps {
  title: string;
  employees: { id: string; fullName: string; tabNumber?: string | null }[];
  instances: Record<string, { sequence: (string | null)[]; startIndex: number; lockedIndices?: number[] | null }>;
  slice: MonthSlice;
  maxDays: number;
  periodStart: Date;
  periodEnd: Date;
  onReorder: (employeeId: string, newSeq: (string | null)[]) => void;
  onSlotClick?: (employeeId: string, dayIndex: number, sequencePosition: number, event: React.MouseEvent<HTMLDivElement>) => void;
  renderChip?: (typeId: string | null, idx: number, status: SlotStatus) => React.ReactNode;
  baseCycleStart: Date;
  shiftTypes?: Array<{
    id: string;
    name: string;
    color?: string;
    profileName?: string; // Название профиля смены
    shiftProfileId?: string; // ID профиля смены
    startTime?: string; // Время начала смены (HH:mm)
    endTime?: string; // Время окончания смены (HH:mm)
    workingHours?: number; // Количество рабочих часов
  }>;
  shiftsByDateAndEmployee?: Map<string, Shift>;
  onUpsertShift?: (employeeId: string, date: Date, shiftTypeId: string | null) => Promise<void>;
  onCreateSwapRequest?: (fromEmployeeId: string, fromDate: Date, toEmployeeId: string, toDate: Date) => Promise<void>;
  onSelectionChange?: (selectedSlot: { employeeId: string; dayIndex: number } | null) => void;
}

export default function RosterMonthBoard({
  title,
  employees,
  instances,
  slice,
  maxDays,
  periodStart,
  periodEnd,
  onReorder,
  onSlotClick,
  renderChip,
  baseCycleStart,
  shiftTypes = [],
  shiftsByDateAndEmployee,
  onUpsertShift,
  onCreateSwapRequest,
  onSelectionChange,
}: RosterMonthBoardProps) {
  // Используем реальное количество дней в месяце, а не maxDays
  const daysInMonth = slice.daysInMonth;
  const mask: SlotStatus[] = Array.from({ length: daysInMonth }, (_, i) =>
    getSlotStatus(i, slice, periodStart, periodEnd)
  );

  // Состояние для меню выбора типа смены
  const [slotMenu, setSlotMenu] = useState<{
    employeeId: string;
    dayIndex: number;
    sequencePosition: number;
    x: number;
    y: number;
  } | null>(null);

  // Используем хук для управления выбором слотов
  const { selectedSlot, toggleSlot, clearSelection, isSlotSelected } = useSlotSelection();

  // Уведомляем родителя об изменении выбора
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedSlot);
    }
  }, [selectedSlot, onSelectionChange]);

  // Обработка клика на слот
  const handleSlotClick = (
    employeeId: string,
    dayIndex: number,
    sequencePosition: number,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    // Ctrl+клик - выбор для обмена
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();

      // Если кликнули на тот же слот - снимаем выделение
      if (isSlotSelected(employeeId, dayIndex)) {
        clearSelection();
        return;
      }

      // Если уже есть выбранный слот и это другой слот - создаем запрос на обмен
      if (selectedSlot) {
        // Проверка: нельзя обменивать смену с самим собой
        if (selectedSlot.employeeId === employeeId) {
          console.warn('Нельзя запрашивать обмен на свою же смену');
          return;
        }

        if (onCreateSwapRequest) {
          const fromDate = new Date(slice.year, slice.month, selectedSlot.dayIndex + 1);
          const toDate = new Date(slice.year, slice.month, dayIndex + 1);
          
          onCreateSwapRequest(
            selectedSlot.employeeId,
            startOfDay(fromDate),
            employeeId,
            startOfDay(toDate)
          ).then(() => {
            clearSelection();
          }).catch((error) => {
            console.error('Error creating swap request:', error);
          });
        }
        clearSelection();
      } else {
        // Выбираем слот как активный
        toggleSlot(employeeId, dayIndex);
      }
      return;
    }

    // Обычный клик - меню выбора смены
    if (onSlotClick) {
      onSlotClick(employeeId, dayIndex, sequencePosition, event);
    } else {
      // Открываем меню выбора смены
      setSlotMenu({
        employeeId,
        dayIndex,
        sequencePosition,
        x: event.clientX,
        y: event.clientY,
      });
    }
  };

  // Назначение смены на конкретный день
  const handleSetShiftType = async (shiftTypeId: string | null) => {
    if (!slotMenu || !onUpsertShift) return;

    const { employeeId, dayIndex } = slotMenu;
    
    // Определяем реальную дату из dayIndex
    const dayDate = new Date(slice.year, slice.month, dayIndex + 1);
    const normalizedDate = startOfDay(dayDate);
    
    try {
      await onUpsertShift(employeeId, normalizedDate, shiftTypeId);
    } catch (error) {
      console.error('Error setting shift type:', error);
    }

    setSlotMenu(null);
  };

  // Адаптивное масштабирование для кубиков дат
  const [scaleX, setScaleX] = useState<number>(1);
  const daysRowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = daysRowRef.current;
    if (!el) return;
    const compute = () => {
      const containerWidth = el.clientWidth;
      const containerStyle = window.getComputedStyle(el);
      const paddingLeft = parseFloat(containerStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(containerStyle.paddingRight) || 0;
      const availableWidth = containerWidth - paddingLeft - paddingRight;
      
      const count = daysInMonth;
      // Учитываем реальную ширину: SlotView может быть шире из-за двухстрочного содержимого
      const baseSize = 55; // увеличен для двухстрочного текста
      const gap = 8; // px (gap-2)
      const needed = count * baseSize + (count - 1) * gap;
      // Еще более агрессивное сжатие с минимальным scaleX = 0.005
      const s = needed > availableWidth ? Math.max(0.005, (availableWidth - 20) / needed) : 1;
      setScaleX(s);
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', compute);
    };
  }, [daysInMonth]);

  // Маппинг дней недели для правильного отображения
  const getWeekdayAbbr = (date: Date): string => {
    const dayOfWeek = date.getDay();
    const weekdayMap: Record<number, string> = {
      0: 'ВС',
      1: 'ПН',
      2: 'ВТ',
      3: 'СР',
      4: 'ЧТ',
      5: 'ПТ',
      6: 'СБ',
    };
    return weekdayMap[dayOfWeek] || '';
  };

  return (
    <div className="mb-8">
        <div className="overflow-x-hidden">
          {/* Head row: day numbers */}
          <div className="flex items-stretch">
            <div className="w-48 shrink-0 px-6 py-4 border-r bg-white sticky left-0 z-10">
              <div className="text-sm font-medium text-gray-900 uppercase">{title}</div>
            </div>
            <div className="flex-1 px-2 py-2" ref={daysRowRef}>
              <div
                className="flex items-center flex-nowrap gap-2"
                style={{ transform: `scaleX(${scaleX})`, transformOrigin: 'left center', width: 'max-content' }}
              >
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const date = new Date(slice.year, slice.month, day);
                  const weekday = getWeekdayAbbr(date);
                  const dayOfWeek = date.getDay();
                  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // ВС=0, СБ=6
                  const textClass = isWeekend ? 'text-red-600' : 'text-gray-800';
                  return (
                    <div key={i} className="flex items-center">
                      <SlotView
                        isEmpty={false}
                        className="h-8 bg-gray-100 border-gray-300"
                        textClassName={textClass}
                        label={
                          <div className="leading-3">
                            <div>{day}</div>
                            <div className="text-[10px] mt-0.5">{weekday}</div>
                          </div>
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-200 bg-white">
            {employees.map((emp) => {
              const inst = instances[emp.id];
              const seq = inst?.sequence ?? [];
              return (
                <div key={emp.id} className="flex items-stretch hover:bg-gray-50">
                  <div className="w-48 shrink-0 px-6 py-4 border-r bg-white sticky left-0 z-10">
                    <div className="text-sm font-medium text-gray-900">{emp.fullName}</div>
                    {emp.tabNumber && <div className="text-sm text-gray-500">{emp.tabNumber}</div>}
                  </div>
                  <div className="flex-1 px-2 py-2">
                    {seq.length > 0 ? (
                      <div
                        style={{ transform: `scaleX(${scaleX})`, transformOrigin: 'left center', width: 'max-content' }}
                      >
                        <EmployeePatternRow
                          employeeId={emp.id}
                          sequence={seq}
                          editableMask={mask}
                          onSlotClick={handleSlotClick}
                          year={slice.year}
                          month={slice.month}
                          baseCycleStart={baseCycleStart}
                          employeeOffset={inst?.startIndex || 0}
                          shiftTypes={shiftTypes}
                          scaleX={1}
                          shiftsByDateAndEmployee={shiftsByDateAndEmployee}
                          selectedSlotId={selectedSlot && selectedSlot.employeeId === emp.id 
                            ? `${selectedSlot.employeeId}-${selectedSlot.dayIndex}` 
                            : undefined}
                          isSlotSelected={isSlotSelected}
                        />
                      </div>
                    ) : (
                      <div className="text-gray-400 text-sm">Нет паттерна</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Меню выбора типа смены */}
        {slotMenu && (
          <div
            className="fixed z-50 bg-white border rounded shadow-lg p-2 max-h-60 overflow-auto"
            style={{ left: slotMenu.x + 8, top: slotMenu.y + 8 }}
            onMouseLeave={() => setSlotMenu(null)}
          >
            <button
              className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded"
              onClick={() => {
                handleSetShiftType(null);
              }}
            >
              <span className="inline-flex w-4 h-4 rounded bg-gray-300" />
              <span className="text-xs">Выходной</span>
            </button>
            {shiftTypes.map((st) => (
              <button
                key={st.id}
                className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded"
                onClick={() => {
                  handleSetShiftType(st.id);
                }}
              >
                <span className="inline-flex w-4 h-4 rounded" style={{ backgroundColor: st.color || '#CBD5E1' }} />
                <div className="flex flex-col">
                  <span className="text-xs font-medium">{st.name}</span>
                  {st.profileName && (
                    <span className="text-[10px] text-gray-500">из "{st.profileName}"</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
  );
}


