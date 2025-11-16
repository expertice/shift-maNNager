import React, { useMemo, useState, useEffect, useRef, memo, useCallback } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isWithinInterval, getDay, isSameDay, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import classNames from 'classnames';
import { SlotView } from '@components/shifts/PatternConstructor';
import { Vacation, Employee, Shift } from '@types';
import { splitPeriodByMonths } from '@/utils/rosterCalendar';
import { isBirthday } from '@/utils/vacationCalendarUtils';
import { useQuery } from '@tanstack/react-query';
import { vacationRulesService } from '@services/api/vacationRulesService';
import { parseLocalDate } from '@/utils/dateUtils';
import { computePositionInCycle } from '@/utils/patternCycle';

export interface VacationRosterViewProps {
  scheduleId: string;
  scheduleStart: Date;
  scheduleEnd: Date;
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
  onDateClick: (employeeId: string, date: Date) => void;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  selectedEmployeeId: string | null;
  clickedDate?: { employeeId: string; date: Date } | null;
}

// Мемоизированный компонент для строки сотрудника
const EmployeeRow = memo(({
  employee,
  monthDays,
  scaleX,
  vacationsByEmployee,
  shiftsByDateAndEmployee,
  shiftTypes,
  selectionStart,
  selectionEnd,
  selectedEmployeeId,
  clickedDate,
  onDateClick,
  isDateInVacation,
  isDateInSelection,
  getShiftForDate,
  getVacationDayNumber,
  getRemainingDays,
  isLatestVacationDay,
  isDateBlocked,
  patternInstances,
  baseCycleStart,
}: {
  employee: Employee;
  monthDays: Date[];
  scaleX: number;
  vacationsByEmployee: Map<string, Vacation[]>;
  shiftsByDateAndEmployee?: Map<string, Shift>;
  shiftTypes: Array<{ id: string; name: string; color?: string }>;
  patternInstances?: Array<{
    employeeId: string;
    sequence: (string | null)[];
    startIndex: number;
    pattern?: {
      cycleLength: number;
    };
  }>;
  baseCycleStart: Date;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  selectedEmployeeId: string | null;
  clickedDate?: { employeeId: string; date: Date } | null;
  onDateClick: (employeeId: string, date: Date) => void;
  isDateInVacation: (date: Date, employeeId: string) => boolean;
  isDateInSelection: (date: Date, employeeId: string) => boolean;
  getShiftForDate: (date: Date, employeeId: string) => Shift | null;
  getVacationDayNumber: (date: Date, employeeId: string) => number | null;
  getRemainingDays: (employeeId: string) => number | null;
  isLatestVacationDay: (date: Date, employeeId: string) => boolean;
  isDateBlocked: (date: Date) => boolean;
}) => {
  const employeeVacations = vacationsByEmployee.get(employee.id) || [];

  return (
    <div 
      key={employee.id} 
      className="flex items-stretch hover:bg-gray-50"
    >
      {/* Слот сотрудника слева (sticky) */}
      <div className="w-48 shrink-0 px-2 py-2 border-r bg-white sticky left-0 z-10 flex items-center">
        <div className="relative flex-1 min-w-0">
          <div
            className="relative rounded-md border-2 border-blue-400 bg-blue-50 hover:bg-blue-100 transition-all duration-200 p-2"
            title={`${employee.fullName}${employee.tabNumber ? ` (${employee.tabNumber})` : ''}`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-gray-900 truncate">
                {employee.fullName}
              </div>
              {employee.tabNumber && (
                <div className="text-[10px] text-gray-700 truncate mt-0.5 font-medium">
                  {employee.tabNumber}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Слоты для дней месяца */}
      <div className="flex-1 px-2 py-2">
        <div
          className="flex items-center flex-nowrap gap-2"
          style={{ 
            transform: `scaleX(${scaleX})`, 
            transformOrigin: 'left center', 
            width: 'max-content',
            minWidth: '100%'
          }}
        >
          {monthDays.map((day) => {
            const inVacation = isDateInVacation(day, employee.id);
            const inSelection = isDateInSelection(day, employee.id);
            // Получаем смену для даты (как в EmployeePatternRow - учитываем паттерны для 'scheduled')
            const dailyShift = getShiftForDate(day, employee.id);
            // Сначала проверяем DailyShift со статусом 'modified' или 'cancelled', затем паттерн
            // DailyShift со статусом 'scheduled' игнорируются, так как они созданы генератором и должны показываться через паттерн
            let shiftTypeId: string | null = null;
            if (dailyShift && (dailyShift.status === 'modified' || dailyShift.status === 'cancelled')) {
              shiftTypeId = dailyShift.shiftTypeId;
            } else {
              // Если DailyShift нет или он имеет статус 'scheduled', используем паттерн
              const instance = patternInstances?.find(inst => inst.employeeId === employee.id);
              if (instance && instance.sequence && instance.sequence.length > 0) {
                const cycleLength = instance.pattern?.cycleLength || instance.sequence.length;
                const pos = computePositionInCycle(day, baseCycleStart, cycleLength, instance.startIndex || 0);
                shiftTypeId = instance.sequence[pos] ?? null;
              }
            }
            
            const shift = shiftTypeId ? { ...dailyShift, shiftTypeId } : dailyShift;
            const shiftType = shiftTypeId
              ? shiftTypes.find(st => st.id === shiftTypeId)
              : null;
            
            // Логирование для отладки (только для первых нескольких дней)
            if (shift && !shiftType && day.getDate() <= 3) {
              console.log('[VacationRosterView] Shift found but shiftType not found', {
                employeeId: employee.id,
                employeeName: employee.fullName,
                date: format(day, 'yyyy-MM-dd'),
                shiftId: shift.id,
                shiftTypeId: shift.shiftTypeId,
                availableShiftTypeIds: shiftTypes.map(st => st.id),
                shiftHasShiftType: !!shift.shiftType,
                shiftShiftTypeName: shift.shiftType?.name,
              });
            }
            const isBday = isBirthday(day, employee.birthDate);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const isClicked = clickedDate && 
              clickedDate.employeeId === employee.id && 
              isSameDay(day, clickedDate.date);
            const vacationDayNumber = inVacation ? getVacationDayNumber(day, employee.id) : null;
            const isLatestDay = isLatestVacationDay(day, employee.id);
            const remainingDays = isLatestDay ? getRemainingDays(employee.id) : null;
            const isBlocked = !inVacation && isDateBlocked(day);

            return (
              <div
                key={day.toISOString()}
                className={classNames(
                  'relative transition-all',
                  {
                    'ring-2 ring-blue-500 ring-offset-2': isClicked,
                    'cursor-pointer': !isBlocked,
                    'cursor-not-allowed opacity-50': isBlocked,
                  }
                )}
                onClick={() => !isBlocked && onDateClick(employee.id, day)}
                title={
                  isBlocked
                    ? 'Недоступно: достигнут лимит одновременных отпусков'
                    : format(day, 'dd.MM.yyyy', { locale: ru })
                }
              >
                <SlotView
                  label={
                    inVacation
                      ? vacationDayNumber?.toString()
                      : inSelection
                      ? undefined
                      : shiftType
                      ? shiftType.name?.charAt(0).toUpperCase() || '?'
                      : undefined
                  }
                  color={
                    inVacation
                      ? '#FCD34D' // желтый для отпуска
                      : inSelection
                      ? '#93C5FD' // синий для выбора
                      : shiftType?.color
                      ? shiftType.color
                      : undefined
                  }
                  isEmpty={!shiftType && !inVacation && !inSelection && !isBlocked}
                  isDragging={false}
                  className={classNames('h-8', {
                    'border-yellow-400 bg-yellow-100': inVacation,
                    'border-blue-400 bg-blue-100': inSelection && !inVacation,
                    'border-gray-300 bg-gray-200': isBlocked,
                    'opacity-30': shiftType && !inVacation && !inSelection && !isBlocked, // бледный цвет для смен
                    'opacity-50': isBlocked,
                  })}
                  textClassName={classNames({
                    'text-gray-700': !isWeekend && !inVacation,
                    'text-red-600': isWeekend && !inVacation,
                    'text-yellow-900 font-semibold': inVacation,
                  })}
                />
                
                {/* Подсказка с оставшимися днями над последним днем отпуска */}
                {isLatestDay && remainingDays !== null && (
                  <div
                    className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none whitespace-nowrap"
                    title={`Осталось дней отпуска: ${remainingDays}`}
                  >
                    <div className="bg-yellow-600 text-white text-xs px-2 py-1 rounded shadow-lg">
                      Осталось: {remainingDays}
                    </div>
                  </div>
                )}
                
                {/* Отметка дня рождения */}
                {isBday && (
                  <div
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
                    title="День рождения"
                    style={{
                      fontSize: '16px',
                      lineHeight: '1',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
                      marginTop: isLatestDay ? '-24px' : '0',
                    }}
                  >
                    👑
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

EmployeeRow.displayName = 'EmployeeRow';

// Мемоизированный компонент для месяца
const MonthBoard = memo(({
  monthSlice,
  employees,
  vacationsByEmployee,
  shiftsByDateAndEmployee,
  shiftTypes,
  patternInstances,
  baseCycleStart,
  selectionStart,
  selectionEnd,
  selectedEmployeeId,
  clickedDate,
  onDateClick,
  isDateInVacation,
  isDateInSelection,
  getShiftForDate,
  getWeekdayAbbr,
  getVacationDayNumber,
  getRemainingDays,
  isLatestVacationDay,
  isDateBlocked,
}: {
  monthSlice: { year: number; month: number; daysInMonth: number };
  employees: Employee[];
  vacationsByEmployee: Map<string, Vacation[]>;
  shiftsByDateAndEmployee?: Map<string, Shift>;
  shiftTypes: Array<{ id: string; name: string; color?: string }>;
  patternInstances?: Array<{
    employeeId: string;
    sequence: (string | null)[];
    startIndex: number;
    pattern?: {
      cycleLength: number;
    };
  }>;
  baseCycleStart: Date;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  selectedEmployeeId: string | null;
  clickedDate?: { employeeId: string; date: Date } | null;
  onDateClick: (employeeId: string, date: Date) => void;
  isDateInVacation: (date: Date, employeeId: string) => boolean;
  isDateInSelection: (date: Date, employeeId: string) => boolean;
  getShiftForDate: (date: Date, employeeId: string) => Shift | null;
  getWeekdayAbbr: (date: Date) => string;
  getVacationDayNumber: (date: Date, employeeId: string) => number | null;
  getRemainingDays: (employeeId: string) => number | null;
  isLatestVacationDay: (date: Date, employeeId: string) => boolean;
  isDateBlocked: (date: Date) => boolean;
}) => {
  const monthStart = startOfMonth(new Date(monthSlice.year, monthSlice.month, 1));
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = monthSlice.daysInMonth;
  const monthDays = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

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

  return (
    <div className="mb-8">
      <div className="overflow-x-hidden">
        {/* Head row: day numbers */}
        <div className="flex items-stretch">
          <div className="w-48 shrink-0 px-6 py-4 border-r bg-white sticky left-0 z-10">
            <div className="text-sm font-medium text-gray-900 uppercase">
              {format(monthStart, 'LLLL yyyy', { locale: ru })}
            </div>
          </div>
          <div className="flex-1 px-2 py-2" ref={daysRowRef}>
            <div
              className="flex items-center flex-nowrap gap-2"
              style={{ transform: `scaleX(${scaleX})`, transformOrigin: 'left center', width: 'max-content' }}
            >
              {Array.from({ length: daysInMonth }, (_, i) => {
                const day = i + 1;
                const date = new Date(monthSlice.year, monthSlice.month, day);
                const weekday = getWeekdayAbbr(date);
                const dayOfWeek = date.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
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
          {employees.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              monthDays={monthDays}
              scaleX={scaleX}
              vacationsByEmployee={vacationsByEmployee}
              shiftsByDateAndEmployee={shiftsByDateAndEmployee}
              shiftTypes={shiftTypes}
              patternInstances={patternInstances}
              baseCycleStart={baseCycleStart}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              selectedEmployeeId={selectedEmployeeId}
              clickedDate={clickedDate}
              onDateClick={onDateClick}
              isDateInVacation={isDateInVacation}
              isDateInSelection={isDateInSelection}
              getShiftForDate={getShiftForDate}
              getVacationDayNumber={getVacationDayNumber}
              getRemainingDays={getRemainingDays}
              isLatestVacationDay={isLatestVacationDay}
              isDateBlocked={isDateBlocked}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

MonthBoard.displayName = 'MonthBoard';

export default function VacationRosterView({
  scheduleId,
  scheduleStart,
  scheduleEnd,
  employees,
  vacations,
  shiftsByDateAndEmployee,
  shiftTypes = [],
  patternInstances = [],
  baseCycleStart,
  onDateClick,
  selectionStart,
  selectionEnd,
  selectedEmployeeId,
  clickedDate,
}: VacationRosterViewProps) {
  const currentYear = new Date().getFullYear();
  
  // Загружаем выделения дней отпуска для всех сотрудников
  const { data: allocations } = useQuery({
    queryKey: ['vacationAllocations', scheduleId, currentYear],
    queryFn: () => vacationRulesService.getEmployeeAllocations(scheduleId, currentYear),
    enabled: !!scheduleId,
  });

  // Загружаем правила отпусков для получения maxConcurrentEmployees
  const { data: vacationRules } = useQuery({
    queryKey: ['vacationRules', scheduleId],
    queryFn: () => vacationRulesService.getVacationRules(scheduleId),
    enabled: !!scheduleId,
  });

  // Создаем Map для быстрого доступа к выделениям по employeeId
  const allocationsByEmployee = useMemo(() => {
    const map = new Map<string, number>();
    if (allocations) {
      allocations.forEach(allocation => {
        map.set(allocation.employeeId, allocation.allocatedDays);
      });
    }
    return map;
  }, [allocations]);
  // Разбиваем период на месяцы
  const months = useMemo(() => {
    return splitPeriodByMonths(scheduleStart, scheduleEnd);
  }, [scheduleStart, scheduleEnd]);

  // Группируем отпуска по сотрудникам
  const vacationsByEmployee = useMemo(() => {
    const map = new Map<string, Vacation[]>();
    vacations.forEach(vacation => {
      if (!map.has(vacation.employeeId)) {
        map.set(vacation.employeeId, []);
      }
      map.get(vacation.employeeId)!.push(vacation);
    });
    return map;
  }, [vacations]);

  // Проверяем, находится ли дата в отпуске для сотрудника
  const isDateInVacation = useCallback((date: Date, employeeId: string): boolean => {
    const employeeVacations = vacationsByEmployee.get(employeeId) || [];
    const checkDate = startOfDay(date);
    return employeeVacations.some(vacation => {
      const start = parseLocalDate(vacation.startDate);
      const end = parseLocalDate(vacation.endDate);
      return checkDate >= start && checkDate <= end;
    });
  }, [vacationsByEmployee]);

  // Получаем смену для даты и сотрудника
  // ВАЖНО: Возвращаем смену только если она имеет статус 'modified' или 'cancelled'
  // Смены со статусом 'scheduled' обрабатываются через паттерны в EmployeeRow
  const getShiftForDate = useCallback((date: Date, employeeId: string): Shift | null => {
    if (!shiftsByDateAndEmployee) return null;
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    const key = `${dateStr}-${employeeId}`;
    const shift = shiftsByDateAndEmployee.get(key) || null;
    
    // Возвращаем смену только если она имеет статус 'modified' или 'cancelled'
    // Смены со статусом 'scheduled' будут обработаны через паттерны
    if (shift && (shift.status === 'modified' || shift.status === 'cancelled')) {
      return shift;
    }
    
    return null;
  }, [shiftsByDateAndEmployee]);

  // Проверяем, находится ли дата в выбранном диапазоне
  const isDateInSelection = useCallback((date: Date, employeeId: string): boolean => {
    if (!selectionStart || !selectionEnd || selectedEmployeeId !== employeeId) return false;
    const checkDate = startOfDay(date);
    const start = startOfDay(selectionStart);
    const end = startOfDay(selectionEnd);
    return checkDate >= start && checkDate <= end;
  }, [selectionStart, selectionEnd, selectedEmployeeId]);

  // Получаем сокращение дня недели
  const getWeekdayAbbr = useCallback((date: Date): string => {
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
  }, []);

  // Вычисляем номер дня в отпуске для даты
  const getVacationDayNumber = useCallback((date: Date, employeeId: string): number | null => {
    const employeeVacations = vacationsByEmployee.get(employeeId) || [];
    const checkDate = startOfDay(date);
    
    for (const vacation of employeeVacations) {
      const start = parseLocalDate(vacation.startDate);
      const end = parseLocalDate(vacation.endDate);
      
      if (checkDate >= start && checkDate <= end) {
        // Вычисляем номер дня в этом периоде отпуска
        const daysDiff = Math.ceil((checkDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff + 1; // +1 потому что первый день = день 1
      }
    }
    
    return null;
  }, [vacationsByEmployee]);

  // Проверяем, является ли дата последним днем отпуска
  const latestVacationEndByEmployee = useMemo(() => {
    const map = new Map<string, Date>();
    vacations.forEach(vacation => {
      const end = parseLocalDate(vacation.endDate);
      const existing = map.get(vacation.employeeId);
      if (!existing || end > existing) {
        map.set(vacation.employeeId, end);
      }
    });
    return map;
  }, [vacations]);

  const isLatestVacationDay = useCallback((date: Date, employeeId: string): boolean => {
    const latestEnd = latestVacationEndByEmployee.get(employeeId);
    if (!latestEnd) return false;
    const checkDate = startOfDay(date);
    return checkDate.getTime() === latestEnd.getTime();
  }, [latestVacationEndByEmployee]);

  // Вычисляем количество сотрудников в отпуске на дату
  const getVacationCountOnDate = useCallback((date: Date): number => {
    const checkDate = startOfDay(date);
    let count = 0;
    
    // Подсчитываем уникальных сотрудников в отпуске на эту дату
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
  }, [vacations]);

  // Проверяем, заблокирована ли дата (достигнут лимит одновременных отпусков)
  const isDateBlocked = useCallback((date: Date): boolean => {
    if (!vacationRules?.maxConcurrentEmployees || vacationRules.maxConcurrentEmployees <= 0) {
      return false;
    }
    
    const count = getVacationCountOnDate(date);
    return count >= vacationRules.maxConcurrentEmployees;
  }, [vacationRules, getVacationCountOnDate]);

  // Вычисляем оставшиеся дни отпуска для сотрудника
  const getRemainingDays = useCallback((employeeId: string): number | null => {
    const allocatedDays = allocationsByEmployee.get(employeeId);
    if (!allocatedDays) return null;

    const employeeVacations = vacationsByEmployee.get(employeeId) || [];
    let usedDays = 0;

    // Вычисляем использованные дни за текущий год
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59);

    for (const vacation of employeeVacations) {
      if (vacation.status !== 'approved' && vacation.status !== 'pending') continue;
      
      const start = parseLocalDate(vacation.startDate);
      const end = parseLocalDate(vacation.endDate);
      
      // Проверяем пересечение с текущим годом
      if (end < yearStart || start > yearEnd) continue;
      
      const actualStart = start < yearStart ? yearStart : start;
      const actualEnd = end > yearEnd ? yearEnd : end;
      
      const days = Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      usedDays += days;
    }

    return Math.max(0, allocatedDays - usedDays);
  }, [allocationsByEmployee, vacationsByEmployee, currentYear]);

  return (
    <div className="w-full overflow-x-hidden">
      {months.map((monthSlice) => (
        <MonthBoard
          key={`${monthSlice.year}-${monthSlice.month}`}
          monthSlice={monthSlice}
          employees={employees}
          vacationsByEmployee={vacationsByEmployee}
          shiftsByDateAndEmployee={shiftsByDateAndEmployee}
          shiftTypes={shiftTypes}
          patternInstances={patternInstances}
          baseCycleStart={baseCycleStart}
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          selectedEmployeeId={selectedEmployeeId}
          clickedDate={clickedDate}
          onDateClick={onDateClick}
          isDateInVacation={isDateInVacation}
          isDateInSelection={isDateInSelection}
          getShiftForDate={getShiftForDate}
          getWeekdayAbbr={getWeekdayAbbr}
          getVacationDayNumber={getVacationDayNumber}
          getRemainingDays={getRemainingDays}
          isLatestVacationDay={isLatestVacationDay}
          isDateBlocked={isDateBlocked}
        />
      ))}
    </div>
  );
}
