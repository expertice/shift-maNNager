import React, { useMemo } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, isWithinInterval, getDay, startOfDay } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { ru } from 'date-fns/locale';
import classNames from 'classnames';
import { SlotView } from '@components/shifts/PatternConstructor';
import { Vacation, Employee, Shift } from '@types';
import { splitPeriodIntoMonths, isBirthday } from '@/utils/vacationCalendarUtils';
import { useQuery } from '@tanstack/react-query';
import { vacationRulesService } from '@services/api/vacationRulesService';
import { computePositionInCycle } from '@/utils/patternCycle';

export interface CompactAnnualCalendarProps {
  scheduleId: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  selectedEmployeeId: string | null;
  employees: Employee[];
  vacations: Vacation[];
  shiftsByDateAndEmployee?: Map<string, Shift>;
  shiftTypes?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  patternInstances?: Array<{
    employeeId: string;
    sequence: (string | null)[];
    startIndex: number;
    pattern?: {
      cycleLength: number;
    };
  }>;
  baseCycleStart: Date;
  onDateClick: (date: Date) => void;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  clickedDate?: { employeeId: string; date: Date } | null;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export default function CompactAnnualCalendar({
  scheduleId,
  scheduleStart,
  scheduleEnd,
  selectedEmployeeId,
  employees,
  vacations,
  shiftsByDateAndEmployee,
  shiftTypes = [],
  patternInstances = [],
  baseCycleStart,
  onDateClick,
  selectionStart,
  selectionEnd,
  clickedDate,
}: CompactAnnualCalendarProps) {
  const selectedEmployee = useMemo(() => {
    return selectedEmployeeId ? employees.find(e => e.id === selectedEmployeeId) : null;
  }, [selectedEmployeeId, employees]);

  // Загружаем правила отпусков для получения maxConcurrentEmployees
  const { data: vacationRules } = useQuery({
    queryKey: ['vacationRules', scheduleId],
    queryFn: () => vacationRulesService.getVacationRules(scheduleId),
    enabled: !!scheduleId,
  });

  // Получаем месяцы для отображения (только активный период)
  const months = useMemo(() => {
    return splitPeriodIntoMonths(scheduleStart, scheduleEnd);
  }, [scheduleStart, scheduleEnd]);

  // Группируем месяцы по годам и разбиваем на ряды (по 4 месяца)
  const monthRows = useMemo(() => {
    const rows: typeof months[][] = [];
    for (let i = 0; i < months.length; i += 4) {
      rows.push(months.slice(i, i + 4));
    }
    return rows;
  }, [months]);

  // Получаем отпуска выбранного сотрудника
  const employeeVacations = useMemo(() => {
    if (!selectedEmployeeId) return [];
    return vacations.filter(v => v.employeeId === selectedEmployeeId);
  }, [selectedEmployeeId, vacations]);

  // Проверяем, находится ли дата в периоде отпуска
  const isDateInVacation = (date: Date): boolean => {
    const checkDate = startOfDay(date);
    return employeeVacations.some(vacation => {
      const start = parseLocalDate(vacation.startDate);
      const end = parseLocalDate(vacation.endDate);
      return checkDate >= start && checkDate <= end;
    });
  };

  // Проверяем, является ли дата началом или концом отпуска
  const getVacationMarker = (date: Date): 'start' | 'end' | 'middle' | null => {
    for (const vacation of employeeVacations) {
      const start = parseLocalDate(vacation.startDate);
      const end = parseLocalDate(vacation.endDate);
      
      if (isSameDay(date, start)) return 'start';
      if (isSameDay(date, end)) return 'end';
      if (isWithinInterval(date, { start, end })) return 'middle';
    }
    return null;
  };

  // Получаем смену для даты и сотрудника
  // ВАЖНО: Возвращаем смену только если она имеет статус 'modified' или 'cancelled'
  // Смены со статусом 'scheduled' обрабатываются через паттерны
  const getShiftForDate = (date: Date, employeeId: string): { shift: Shift | null; shiftTypeId: string | null } => {
    if (!shiftsByDateAndEmployee) return { shift: null, shiftTypeId: null };
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    const key = `${dateStr}-${employeeId}`;
    const dailyShift = shiftsByDateAndEmployee.get(key) || null;
    
    // Сначала проверяем DailyShift со статусом 'modified' или 'cancelled', затем паттерн
    // DailyShift со статусом 'scheduled' игнорируются, так как они созданы генератором и должны показываться через паттерн
    let shiftTypeId: string | null = null;
    if (dailyShift && (dailyShift.status === 'modified' || dailyShift.status === 'cancelled')) {
      shiftTypeId = dailyShift.shiftTypeId;
      return { shift: dailyShift, shiftTypeId };
    } else {
      // Если DailyShift нет или он имеет статус 'scheduled', используем паттерн
      const instance = patternInstances?.find(inst => inst.employeeId === employeeId);
      if (instance && instance.sequence && instance.sequence.length > 0) {
        const cycleLength = instance.pattern?.cycleLength || instance.sequence.length;
        const pos = computePositionInCycle(date, baseCycleStart, cycleLength, instance.startIndex || 0);
        shiftTypeId = instance.sequence[pos] ?? null;
      }
      return { shift: null, shiftTypeId };
    }
  };

  // Проверяем, находится ли дата в выбранном диапазоне
  const isDateInSelection = (date: Date): boolean => {
    if (!selectionStart || !selectionEnd) return false;
    const checkDate = startOfDay(date);
    const start = startOfDay(selectionStart);
    const end = startOfDay(selectionEnd);
    return checkDate >= start && checkDate <= end;
  };

  // Проверяем, можно ли редактировать дату (в пределах периода расписания)
  const isDateEditable = (date: Date): boolean => {
    return date >= scheduleStart && date <= scheduleEnd;
  };

  // Вычисляем количество сотрудников в отпуске на дату
  const getVacationCountOnDate = (date: Date): number => {
    const checkDate = startOfDay(date);
    const employeesOnVacation = new Set<string>();
    
    vacations.forEach(vacation => {
      if (vacation.status !== 'approved' && vacation.status !== 'pending') return;
      
      const start = parseLocalDate(vacation.startDate);
      const end = parseLocalDate(vacation.endDate);
      
      if (checkDate >= start && checkDate <= end) {
        employeesOnVacation.add(vacation.employeeId);
      }
    });
    
    return employeesOnVacation.size;
  };

  // Проверяем, заблокирована ли дата (достигнут лимит одновременных отпусков)
  const isDateBlocked = (date: Date): boolean => {
    if (!vacationRules?.maxConcurrentEmployees || vacationRules.maxConcurrentEmployees <= 0) {
      return false;
    }
    
    const count = getVacationCountOnDate(date);
    return count >= vacationRules.maxConcurrentEmployees;
  };

  return (
    <div className="w-full">
      {monthRows.map((row, rowIndex) => (
        <div key={rowIndex} className="mb-8">
          <div className="grid grid-cols-4 gap-4">
            {row.map((monthInfo) => {
              const monthStart = startOfMonth(new Date(monthInfo.year, monthInfo.month, 1));
              const monthEnd = endOfMonth(monthStart);
              const daysInMonth = monthInfo.daysInMonth;
              const firstDayOfWeek = getDay(monthStart); // 0 = Sunday, 1 = Monday, etc.

              return (
                <div key={`${monthInfo.year}-${monthInfo.month}`} className="border rounded-lg p-4 bg-white">
                  {/* Название месяца */}
                  <div className="text-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">
                      {MONTH_NAMES[monthInfo.month]} {monthInfo.year}
                    </h3>
                  </div>

                  {/* Дни недели заголовки */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, idx) => (
                      <div
                        key={idx}
                        className="text-center text-xs font-semibold text-gray-600 py-1"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* Календарная сетка */}
                  <div className="grid grid-cols-7 gap-1">
                    {/* Пустые ячейки до первого дня месяца */}
                    {Array.from({ length: (firstDayOfWeek + 6) % 7 }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="aspect-square" />
                    ))}

                    {/* Дни месяца */}
                    {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
                      const day = dayIdx + 1;
                      const date = new Date(monthInfo.year, monthInfo.month, day);
                      const isEditable = isDateEditable(date);
                      const inSelection = isDateInSelection(date);
                      const inVacation = isDateInVacation(date);
                      const vacationMarker = getVacationMarker(date);
                      const shiftResult = selectedEmployeeId ? getShiftForDate(date, selectedEmployeeId) : { shift: null, shiftTypeId: null };
                      const shiftType = shiftResult.shiftTypeId
                        ? shiftTypes.find(st => st.id === shiftResult.shiftTypeId)
                        : null;
                      const isBday = selectedEmployee?.birthDate
                        ? isBirthday(date, selectedEmployee.birthDate)
                        : false;
                      const isWeekend = getDay(date) === 0 || getDay(date) === 6;
                      const isClicked = clickedDate && 
                        clickedDate.employeeId === selectedEmployeeId && 
                        isSameDay(date, clickedDate.date);
                      const isBlocked = !inVacation && isDateBlocked(date);

                      return (
                        <div
                          key={day}
                          className={classNames(
                            'relative transition-all',
                            {
                              'opacity-50': !isEditable || isBlocked,
                              'cursor-pointer': isEditable && !isBlocked,
                              'cursor-not-allowed': isBlocked,
                              'ring-2 ring-blue-500 ring-offset-2': isClicked && isEditable && !isBlocked,
                            }
                          )}
                          onClick={() => {
                            if (isEditable && !isBlocked) {
                              onDateClick(date);
                            }
                          }}
                          title={
                            isBlocked
                              ? 'Недоступно: достигнут лимит одновременных отпусков'
                              : isEditable
                              ? format(date, 'dd.MM.yyyy', { locale: ru })
                              : 'Вне периода расписания'
                          }
                        >
                          <SlotView
                            label={day}
                            color={
                              inVacation
                                ? '#FCD34D' // желтый для отпуска
                                : inSelection
                                ? '#93C5FD' // синий для выбора
                                : isBlocked
                                ? '#E5E7EB' // серый для заблокированных
                                : shiftType?.color
                                ? shiftType.color
                                : undefined
                            }
                            isEmpty={!shiftType && !inVacation && !inSelection && !isBlocked}
                            isDragging={false}
                            className={classNames({
                              'border-yellow-400 bg-yellow-100': inVacation,
                              'border-blue-400 bg-blue-100': inSelection && !inVacation,
                              'border-gray-300 bg-gray-200': isBlocked,
                              'opacity-30': shiftType && !inVacation && !inSelection && !isBlocked, // бледный цвет для смен
                              'opacity-50': isBlocked,
                            })}
                            textClassName={classNames({
                              'text-gray-400': !isEditable,
                              'text-gray-700': isEditable && !isWeekend,
                              'text-red-600': isEditable && isWeekend,
                            })}
                          />
                          
                          {/* Отметка дня рождения */}
                          {isBday && (
                            <div
                              className="absolute -top-2 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
                              title="День рождения"
                              style={{
                                fontSize: '14px',
                                lineHeight: '1',
                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                              }}
                            >
                              👑
                            </div>
                          )}

                          {/* Маркеры начала/конца отпуска */}
                          {(vacationMarker === 'start' || vacationMarker === 'end') && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-600 rounded-b z-10" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

