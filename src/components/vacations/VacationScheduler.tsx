import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, startOfDay, isSameDay, isBefore } from 'date-fns';
import { ru } from 'date-fns/locale';
import classNames from 'classnames';
import { Button, Select, Card, Badge } from '@components/common';
import { Vacation, Employee, Shift } from '@types';
import CompactAnnualCalendar from './CompactAnnualCalendar';
import VacationRosterView from './VacationRosterView';
import { vacationsService } from '@services/api/vacationsService';

export type VacationViewMode = 'compact' | 'roster';

export interface VacationSchedulerProps {
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
  viewMode: VacationViewMode;
  selectedEmployeeId: string;
  onViewModeChange: (mode: VacationViewMode) => void;
  onSelectedEmployeeChange: (employeeId: string) => void;
  onVacationCreated?: () => void;
  onVacationDeleted?: () => void;
}

export default function VacationScheduler({
  scheduleId,
  scheduleStart,
  scheduleEnd,
  employees,
  vacations,
  shiftsByDateAndEmployee,
  shiftTypes = [],
  viewMode,
  selectedEmployeeId,
  onViewModeChange,
  onSelectedEmployeeChange,
  onVacationCreated,
  onVacationDeleted,
}: VacationSchedulerProps) {
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clickedDate, setClickedDate] = useState<{ employeeId: string; date: Date } | null>(null);
  const clickedDateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Очищаем таймер при размонтировании
  useEffect(() => {
    return () => {
      if (clickedDateTimeoutRef.current) {
        clearTimeout(clickedDateTimeoutRef.current);
      }
    };
  }, []);

  // Проверяем, находится ли дата в существующем отпуске
  const getVacationForDate = (date: Date, employeeId: string): Vacation | null => {
    return vacations.find(v => {
      if (v.employeeId !== employeeId) return false;
      const start = startOfDay(new Date(v.startDate));
      const end = startOfDay(new Date(v.endDate));
      const checkDate = startOfDay(date);
      return checkDate >= start && checkDate <= end;
    }) || null;
  };

  // Обработка клика на дату в компактном режиме
  const handleCompactDateClick = (date: Date) => {
    if (!selectedEmployeeId) {
      setError('Выберите сотрудника');
      return;
    }

    // Очищаем предыдущий таймер (если был)
    if (clickedDateTimeoutRef.current) {
      clearTimeout(clickedDateTimeoutRef.current);
      clickedDateTimeoutRef.current = null;
    }

    // Проверяем, есть ли уже отпуск на эту дату
    const existingVacation = getVacationForDate(date, selectedEmployeeId);
    if (existingVacation) {
      // Повторное назначение - снимаем выбор (удаляем отпуск без подтверждения)
      setClickedDate(null);
      handleDeleteVacation(existingVacation.id, true);
      return;
    }

    if (!selectionStart) {
      // Первый клик - начало периода
      setSelectionStart(date);
      setSelectionEnd(null);
      setError(null);
      // Подсвечиваем кликнутый день (контур остается до второго клика)
      setClickedDate({ employeeId: selectedEmployeeId, date });
    } else if (!selectionEnd) {
      // Второй клик - конец периода
      const start = isBefore(date, selectionStart) ? date : selectionStart;
      const end = isBefore(date, selectionStart) ? selectionStart : date;
      setSelectionStart(start);
      setSelectionEnd(end);
      
      // Снимаем подсветку контура перед созданием отпуска
      setClickedDate(null);
      
      // Автоматически создаем отпуск
      handleCreateVacation(selectedEmployeeId, start, end);
    } else {
      // Третий клик - начинаем новый выбор
      setSelectionStart(date);
      setSelectionEnd(null);
      setError(null);
      // Подсвечиваем новый кликнутый день
      setClickedDate({ employeeId: selectedEmployeeId, date });
    }
  };

  // Обработка клика на дату в ростер-режиме
  const handleRosterDateClick = (employeeId: string, date: Date) => {
    // Очищаем предыдущий таймер (если был)
    if (clickedDateTimeoutRef.current) {
      clearTimeout(clickedDateTimeoutRef.current);
      clickedDateTimeoutRef.current = null;
    }

    // Проверяем, есть ли уже отпуск на эту дату
    const existingVacation = getVacationForDate(date, employeeId);
    if (existingVacation) {
      // Повторное назначение - снимаем выбор (удаляем отпуск без подтверждения)
      setClickedDate(null);
      handleDeleteVacation(existingVacation.id, true);
      return;
    }

    if (!selectionStart) {
      // Первый клик - начало периода
      setSelectionStart(date);
      setSelectionEnd(null);
      onSelectedEmployeeChange(employeeId);
      setError(null);
      // Подсвечиваем кликнутый день (контур остается до второго клика)
      setClickedDate({ employeeId, date });
    } else if (!selectionEnd) {
      // Второй клик - конец периода
      if (employeeId !== selectedEmployeeId) {
        setError('Выберите даты для того же сотрудника');
        return;
      }

      const start = isBefore(date, selectionStart) ? date : selectionStart;
      const end = isBefore(date, selectionStart) ? selectionStart : date;
      setSelectionStart(start);
      setSelectionEnd(end);
      
      // Снимаем подсветку контура перед созданием отпуска
      setClickedDate(null);
      
      // Автоматически создаем отпуск
      handleCreateVacation(employeeId, start, end);
    } else {
      // Третий клик - начинаем новый выбор
      setSelectionStart(date);
      setSelectionEnd(null);
      onSelectedEmployeeChange(employeeId);
      setError(null);
      // Подсвечиваем новый кликнутый день
      setClickedDate({ employeeId, date });
    }
  };

  // Создание отпуска
  const handleCreateVacation = async (employeeId: string, start: Date, end: Date) => {
    setIsCreating(true);
    setError(null);

    try {
      await vacationsService.createVacation(scheduleId, {
        employeeId,
        startDate: format(startOfDay(start), 'yyyy-MM-dd'),
        endDate: format(startOfDay(end), 'yyyy-MM-dd'),
        status: 'approved',
      });

      // Сбрасываем выбор
      setSelectionStart(null);
      setSelectionEnd(null);
      setClickedDate(null);
      
      if (onVacationCreated) {
        onVacationCreated();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при создании отпуска');
      // Не сбрасываем выбор при ошибке, чтобы пользователь мог исправить
    } finally {
      setIsCreating(false);
    }
  };

  // Удаление отпуска (без подтверждения для повторного клика)
  const handleDeleteVacation = async (vacationId: string, skipConfirm: boolean = false) => {
    if (!skipConfirm && !window.confirm('Удалить этот отпуск?')) {
      return;
    }

    try {
      await vacationsService.deleteVacation(scheduleId, vacationId);
      
      // Сбрасываем выбор после удаления
      setSelectionStart(null);
      setSelectionEnd(null);
      setClickedDate(null);
      
      if (onVacationDeleted) {
        onVacationDeleted();
      }
    } catch (err: any) {
      setError(err.message || 'Ошибка при удалении отпуска');
    }
  };

  // Фильтруем только видимых сотрудников (как в ростере)
  const visibleEmployees = useMemo(() => {
    return employees.filter(emp => !emp.isHidden);
  }, [employees]);

  return (
    <div className="flex flex-col">
      <div className="space-y-4 flex-shrink-0">

        {/* Сообщение об ошибке */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
      </div>

      {/* Отображение календаря */}
      <div className="mt-4">
        {viewMode === 'compact' ? (
            <CompactAnnualCalendar
              scheduleStart={scheduleStart}
              scheduleEnd={scheduleEnd}
              selectedEmployeeId={selectedEmployeeId}
              employees={visibleEmployees}
              vacations={vacations}
              shiftsByDateAndEmployee={shiftsByDateAndEmployee}
              shiftTypes={shiftTypes}
              onDateClick={handleCompactDateClick}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              clickedDate={clickedDate}
            />
        ) : (
          <VacationRosterView
            scheduleStart={scheduleStart}
            scheduleEnd={scheduleEnd}
            employees={visibleEmployees}
            vacations={vacations}
            shiftsByDateAndEmployee={shiftsByDateAndEmployee}
            shiftTypes={shiftTypes}
            onDateClick={handleRosterDateClick}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            selectedEmployeeId={selectedEmployeeId}
            clickedDate={clickedDate}
          />
        )}
      </div>

      {/* Список существующих отпусков */}
      {vacations.length > 0 && (
        <Card className="mt-6">
          <h3 className="text-lg font-semibold mb-4">Текущие отпуска</h3>
          <div className="space-y-2">
            {vacations.map((vacation) => {
              const employee = visibleEmployees.find(e => e.id === vacation.employeeId);
              return (
                <div
                  key={vacation.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {employee?.fullName || 'Неизвестный сотрудник'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(new Date(vacation.startDate), 'dd.MM.yyyy', { locale: ru })} -{' '}
                      {format(new Date(vacation.endDate), 'dd.MM.yyyy', { locale: ru })}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={
                        vacation.status === 'approved'
                          ? 'success'
                          : vacation.status === 'rejected'
                          ? 'danger'
                          : 'default'
                      }
                    >
                      {vacation.status === 'approved'
                        ? 'Утвержден'
                        : vacation.status === 'rejected'
                        ? 'Отклонен'
                        : 'Ожидает'}
                    </Badge>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDeleteVacation(vacation.id)}
                      disabled={isCreating}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

