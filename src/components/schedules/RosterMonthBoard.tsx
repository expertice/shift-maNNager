import React, { useEffect, useRef, useState } from 'react';
import EmployeePatternRow from './EmployeePatternRow';
import { MonthSlice, getSlotStatus, SlotStatus } from '@/utils/rosterCalendar';
import { SlotView } from '@components/shifts/PatternConstructor';
import { Shift } from '@types';
import { startOfDay } from 'date-fns';
import { useSlotSelection } from '@/hooks/useSlotSelection';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface RosterMonthBoardProps {
  title: string;
  employees: { id: string; fullName: string; tabNumber?: string | null; department?: { name: string } | null }[];
  instances: Record<string, { sequence: (string | null)[]; startIndex: number; lockedIndices?: number[] | null; cycleLength?: number }>;
  slice: MonthSlice;
  maxDays: number;
  periodStart: Date;
  periodEnd: Date;
  onReorder: (employeeId: string, newSeq: (string | null)[]) => void;
  onSlotClick?: (employeeId: string, dayIndex: number, sequencePosition: number, event: React.MouseEvent<HTMLDivElement>) => void;
  onEmployeeClick?: (employeeId: string) => void;
  onEmployeeEdit?: (employeeId: string) => void;
  onEmployeeDelete?: (employeeId: string) => void;
  onEmployeeClone?: (employeeId: string) => void;
  onEmployeeMoveUp?: (employeeId: string) => void;
  onEmployeeMoveDown?: (employeeId: string) => void;
  onEmployeeAssignProfile?: (employeeId: string, shiftProfileId: string | null) => Promise<void>;
  onEmployeePatternOffsetChange?: (employeeId: string, offsetDelta: number) => Promise<void>;
  onEmployeeAdd?: () => void;
  shiftProfiles?: Array<{ id: string; name: string }>;
  employeeProfiles?: Record<string, string | null>; // employeeId -> shiftProfileId
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
  patternStartOffset?: number;
  onPatternOffsetChange?: (offsetDelta: number) => Promise<void>;
  scheduleId?: string;
  maxCycleLength?: number;
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
  onEmployeeClick,
  onEmployeeEdit,
  onEmployeeDelete,
  onEmployeeClone,
  onEmployeeMoveUp,
  onEmployeeMoveDown,
  onEmployeeAssignProfile,
  onEmployeePatternOffsetChange,
  onEmployeeAdd,
  shiftProfiles = [],
  employeeProfiles = {},
  renderChip,
  baseCycleStart,
  shiftTypes = [],
  shiftsByDateAndEmployee,
  onUpsertShift,
  onCreateSwapRequest,
  onSelectionChange,
  patternStartOffset = 0,
  onPatternOffsetChange,
  scheduleId,
  maxCycleLength = 0,
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

  // Состояние для меню сотрудника
  const [employeeMenu, setEmployeeMenu] = useState<{
    employeeId: string;
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
              <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-900 uppercase">{title}</div>
                {onPatternOffsetChange && (() => {
                  // Получаем длину цикла из первого найденного экземпляра паттерна
                  const firstInstance = Object.values(instances).find(inst => inst && inst.cycleLength && inst.cycleLength > 0);
                  const cycleLength = firstInstance?.cycleLength || maxCycleLength || 0;
                  
                  // Нормализуем startIndex относительно длины цикла для отображения
                  const displayStartIndex = cycleLength > 0 
                    ? ((patternStartOffset || 0) % cycleLength + cycleLength) % cycleLength
                    : (patternStartOffset || 0);
                  
                  return (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={async () => {
                          // Смещение влево: -1 (начинаем с предыдущего дня в цикле)
                          await onPatternOffsetChange(-1);
                        }}
                        className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                        title="Сместить влево (начать с предыдущего дня цикла)"
                      >
                        <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
                      </button>
                      <span className="text-xs text-gray-500 min-w-[5ch] text-center">
                        {cycleLength > 0 ? `${displayStartIndex + 1}/${cycleLength}` : (patternStartOffset || 0)}
                      </span>
                      <button
                        onClick={async () => {
                          // Смещение вправо: +1 (начинаем со следующего дня в цикле)
                          await onPatternOffsetChange(1);
                        }}
                        className="p-1 rounded hover:bg-gray-100 text-gray-600 hover:text-gray-900"
                        title="Сместить вправо (начать со следующего дня цикла)"
                      >
                        <ChevronUp className="w-4 h-4 rotate-90" />
                      </button>
                    </div>
                  );
                })()}
              </div>
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
            {employees.map((emp, empIndex) => {
              const inst = instances[emp.id];
              const seq = inst?.sequence ?? [];
              const canMoveUp = empIndex > 0 && onEmployeeMoveUp;
              const canMoveDown = empIndex < employees.length - 1 && onEmployeeMoveDown;
              
              return (
                <div key={emp.id} className="flex items-stretch hover:bg-gray-50">
                  <div className="w-48 shrink-0 px-2 py-2 border-r bg-white sticky left-0 z-10 flex items-center gap-2">
                    {/* Кнопки перемещения */}
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        aria-label="Переместить вверх"
                        disabled={!canMoveUp}
                        className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
                          canMoveUp ? 'cursor-pointer text-gray-600' : 'cursor-not-allowed text-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canMoveUp) {
                            onEmployeeMoveUp?.(emp.id);
                          }
                        }}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label="Переместить вниз"
                        disabled={!canMoveDown}
                        className={`p-0.5 rounded hover:bg-gray-200 transition-colors ${
                          canMoveDown ? 'cursor-pointer text-gray-600' : 'cursor-not-allowed text-gray-300'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canMoveDown) {
                            onEmployeeMoveDown?.(emp.id);
                          }
                        }}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                    
                    {/* Слот сотрудника с информацией */}
                    <div className="relative flex-1 min-w-0">
                      <div
                        className="relative rounded-md border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 transition-all duration-200 p-2 cursor-pointer"
                        onClick={() => onEmployeeClick?.(emp.id)}
                        title={`${emp.fullName}${emp.position ? ` - ${emp.position.name}` : ''}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-gray-900 truncate">
                              {emp.fullName}
                            </div>
                            {emp.position && (
                              <div className="text-[10px] text-gray-700 truncate mt-0.5 font-medium">
                                {emp.position.name}
                              </div>
                            )}
                          </div>
                          {/* Кнопки смещения паттерна для сотрудника */}
                          {onEmployeePatternOffsetChange && inst && inst.cycleLength && inst.cycleLength > 0 && (
                            <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  await onEmployeePatternOffsetChange(emp.id, -1);
                                }}
                                className="p-0.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                                title="Сместить паттерн влево (начать с предыдущего дня цикла)"
                              >
                                <ChevronUp className="w-3 h-3 rotate-[-90deg]" />
                              </button>
                              <span className="text-[10px] text-gray-500 min-w-[4ch] text-center">
                                {inst.startIndex + 1}/{inst.cycleLength}
                              </span>
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  await onEmployeePatternOffsetChange(emp.id, 1);
                                }}
                                className="p-0.5 rounded hover:bg-gray-200 text-gray-600 hover:text-gray-900"
                                title="Сместить паттерн вправо (начать со следующего дня цикла)"
                              >
                                <ChevronUp className="w-3 h-3 rotate-90" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Кнопка-хотспот для меню сотрудника */}
                      <button
                        type="button"
                        aria-label="Меню сотрудника"
                        className="absolute top-0.5 right-0.5 z-20 w-4 h-4 rounded bg-white/80 border border-gray-300 text-[10px] leading-3 text-gray-600 hover:bg-white hover:border-blue-400 cursor-pointer"
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setEmployeeMenu({
                            employeeId: emp.id,
                            x: e.clientX,
                            y: e.clientY,
                          });
                        }}
                      >
                        ·
                      </button>
                    </div>
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
            {/* Кнопка добавления сотрудника */}
            {onEmployeeAdd && (
              <div className="flex items-stretch hover:bg-gray-50 border-t border-gray-200">
                <div className="w-48 shrink-0 px-2 py-2 border-r bg-white sticky left-0 z-10 flex items-center">
                  <button
                    type="button"
                    onClick={onEmployeeAdd}
                    className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded border border-dashed border-gray-300 flex items-center justify-center gap-2"
                  >
                    <span className="text-lg">+</span>
                    <span>Добавить сотрудника</span>
                  </button>
                </div>
                <div className="flex-1 px-2 py-2" />
              </div>
            )}
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
            {shiftTypes.map((st) => {
              const timeRange = st.startTime && st.endTime
                ? `${st.startTime} - ${st.endTime}`
                : st.startTime || st.endTime || null;

              return (
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
                    {timeRange && (
                      <span className="text-[10px] text-gray-600">{timeRange}</span>
                    )}
                    {st.profileName && (
                      <span className="text-[10px] text-gray-500">из "{st.profileName}"</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Меню сотрудника */}
        {employeeMenu && (
          <div
            className="fixed z-50 bg-white border rounded shadow-lg p-2 min-w-[120px]"
            style={{ left: employeeMenu.x + 8, top: employeeMenu.y + 8 }}
            onMouseLeave={() => setEmployeeMenu(null)}
          >
            {onEmployeeAssignProfile && (
              <div className="border-t pt-1 mt-1">
                <div className="text-[10px] text-gray-500 px-2 py-1">Установить график:</div>
                <button
                  className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-xs"
                  onClick={async () => {
                    await onEmployeeAssignProfile(employeeMenu.employeeId, null);
                    setEmployeeMenu(null);
                  }}
                >
                  <span className="inline-flex w-3 h-3 rounded border border-gray-300 mr-1" />
                  Не назначен
                </button>
                {shiftProfiles.map((profile) => {
                  const isSelected = employeeProfiles[employeeMenu.employeeId] === profile.id;
                  return (
                    <button
                      key={profile.id}
                      className={`flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-xs ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                      onClick={async () => {
                        await onEmployeeAssignProfile(employeeMenu.employeeId, profile.id);
                        setEmployeeMenu(null);
                      }}
                    >
                      <span
                        className={`inline-flex w-3 h-3 rounded border mr-1 ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                        }`}
                      />
                      {profile.name}
                    </button>
                  );
                })}
              </div>
            )}
            {onEmployeeEdit && (
              <button
                className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-xs"
                onClick={() => {
                  onEmployeeEdit(employeeMenu.employeeId);
                  setEmployeeMenu(null);
                }}
              >
                Редактировать
              </button>
            )}
            {onEmployeeClone && (
              <button
                className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded text-xs"
                onClick={() => {
                  onEmployeeClone(employeeMenu.employeeId);
                  setEmployeeMenu(null);
                }}
              >
                Копировать
              </button>
            )}
            {onEmployeeDelete && (
              <button
                className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-red-50 rounded text-xs text-red-600"
                onClick={() => {
                  onEmployeeDelete(employeeMenu.employeeId);
                  setEmployeeMenu(null);
                }}
              >
                Удалить
              </button>
            )}
          </div>
        )}
      </div>
  );
}


