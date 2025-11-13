import React, { useMemo, useState, useEffect, useRef, memo, useCallback } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isWithinInterval, getDay, isSameDay, startOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import classNames from 'classnames';
import { SlotView } from '@components/shifts/PatternConstructor';
import { Vacation, Employee, Shift } from '@types';
import { splitPeriodByMonths } from '@/utils/rosterCalendar';
import { isBirthday } from '@/utils/vacationCalendarUtils';

export interface VacationRosterViewProps {
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
}: {
  employee: Employee;
  monthDays: Date[];
  scaleX: number;
  vacationsByEmployee: Map<string, Vacation[]>;
  shiftsByDateAndEmployee?: Map<string, Shift>;
  shiftTypes: Array<{ id: string; name: string; color?: string }>;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  selectedEmployeeId: string | null;
  clickedDate?: { employeeId: string; date: Date } | null;
  onDateClick: (employeeId: string, date: Date) => void;
  isDateInVacation: (date: Date, employeeId: string) => boolean;
  isDateInSelection: (date: Date, employeeId: string) => boolean;
  getShiftForDate: (date: Date, employeeId: string) => Shift | null;
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
          style={{ transform: `scaleX(${scaleX})`, transformOrigin: 'left center', width: 'max-content' }}
        >
          {monthDays.map((day) => {
            const inVacation = isDateInVacation(day, employee.id);
            const inSelection = isDateInSelection(day, employee.id);
            const shift = getShiftForDate(day, employee.id);
            const shiftType = shift?.shiftTypeId
              ? shiftTypes.find(st => st.id === shift.shiftTypeId)
              : null;
            const isBday = isBirthday(day, employee.birthDate);
            const isWeekend = getDay(day) === 0 || getDay(day) === 6;
            const isClicked = clickedDate && 
              clickedDate.employeeId === employee.id && 
              isSameDay(day, clickedDate.date);

            return (
              <div
                key={day.toISOString()}
                className={classNames(
                  'relative cursor-pointer transition-all',
                  {
                    'ring-2 ring-blue-500 ring-offset-2': isClicked,
                  }
                )}
                onClick={() => onDateClick(employee.id, day)}
                title={format(day, 'dd.MM.yyyy', { locale: ru })}
              >
                <SlotView
                  label={
                    inVacation || inSelection
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
                  isEmpty={!shiftType && !inVacation && !inSelection}
                  isDragging={false}
                  className={classNames('h-8', {
                    'border-yellow-400 bg-yellow-100': inVacation,
                    'border-blue-400 bg-blue-100': inSelection && !inVacation,
                    'opacity-30': shiftType && !inVacation && !inSelection, // бледный цвет для смен
                  })}
                  textClassName={classNames({
                    'text-gray-700': !isWeekend,
                    'text-red-600': isWeekend,
                  })}
                />
                
                {/* Отметка дня рождения */}
                {isBday && (
                  <div
                    className="absolute -top-3 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none"
                    title="День рождения"
                    style={{
                      fontSize: '16px',
                      lineHeight: '1',
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
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
  selectionStart,
  selectionEnd,
  selectedEmployeeId,
  clickedDate,
  onDateClick,
  isDateInVacation,
  isDateInSelection,
  getShiftForDate,
  getWeekdayAbbr,
}: {
  monthSlice: { year: number; month: number; daysInMonth: number };
  employees: Employee[];
  vacationsByEmployee: Map<string, Vacation[]>;
  shiftsByDateAndEmployee?: Map<string, Shift>;
  shiftTypes: Array<{ id: string; name: string; color?: string }>;
  selectionStart: Date | null;
  selectionEnd: Date | null;
  selectedEmployeeId: string | null;
  clickedDate?: { employeeId: string; date: Date } | null;
  onDateClick: (employeeId: string, date: Date) => void;
  isDateInVacation: (date: Date, employeeId: string) => boolean;
  isDateInSelection: (date: Date, employeeId: string) => boolean;
  getShiftForDate: (date: Date, employeeId: string) => Shift | null;
  getWeekdayAbbr: (date: Date) => string;
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
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              selectedEmployeeId={selectedEmployeeId}
              clickedDate={clickedDate}
              onDateClick={onDateClick}
              isDateInVacation={isDateInVacation}
              isDateInSelection={isDateInSelection}
              getShiftForDate={getShiftForDate}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

MonthBoard.displayName = 'MonthBoard';

export default function VacationRosterView({
  scheduleStart,
  scheduleEnd,
  employees,
  vacations,
  shiftsByDateAndEmployee,
  shiftTypes = [],
  onDateClick,
  selectionStart,
  selectionEnd,
  selectedEmployeeId,
  clickedDate,
}: VacationRosterViewProps) {
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
      const start = startOfDay(new Date(vacation.startDate));
      const end = startOfDay(new Date(vacation.endDate));
      return checkDate >= start && checkDate <= end;
    });
  }, [vacationsByEmployee]);

  // Получаем смену для даты и сотрудника
  const getShiftForDate = useCallback((date: Date, employeeId: string): Shift | null => {
    if (!shiftsByDateAndEmployee) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const key = `${dateStr}-${employeeId}`;
    return shiftsByDateAndEmployee.get(key) || null;
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
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          selectedEmployeeId={selectedEmployeeId}
          clickedDate={clickedDate}
          onDateClick={onDateClick}
          isDateInVacation={isDateInVacation}
          isDateInSelection={isDateInSelection}
          getShiftForDate={getShiftForDate}
          getWeekdayAbbr={getWeekdayAbbr}
        />
      ))}
    </div>
  );
}
