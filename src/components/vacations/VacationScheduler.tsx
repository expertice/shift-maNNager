import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { format, startOfDay, isSameDay, isBefore } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { ru } from 'date-fns/locale';
import classNames from 'classnames';
import { Button, Select, Modal } from '@components/common';
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
  patternInstances?: Array<{
    employeeId: string;
    sequence: (string | null)[];
    startIndex: number;
    pattern?: {
      cycleLength: number;
    };
  }>;
  baseCycleStart: Date;
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
  patternInstances = [],
  baseCycleStart,
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
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
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
      const start = parseLocalDate(v.startDate);
      const end = parseLocalDate(v.endDate);
      const checkDate = startOfDay(date);
      return checkDate >= start && checkDate <= end;
    }) || null;
  };

  // Обработка клика на дату в компактном режиме
  const handleCompactDateClick = (date: Date) => {
    if (!selectedEmployeeId) {
      setError('Выберите сотрудника');
      setIsErrorModalOpen(true);
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
        setIsErrorModalOpen(true);
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
      const result = await vacationsService.createVacation(scheduleId, {
        employeeId,
        startDate: format(startOfDay(start), 'yyyy-MM-dd'),
        endDate: format(startOfDay(end), 'yyyy-MM-dd'),
        status: 'approved',
      });

      // Сбрасываем выбор
      setSelectionStart(null);
      setSelectionEnd(null);
      setClickedDate(null);
      
      // Показываем предупреждение, если оно есть
      if (result.warning) {
        setError(result.warning);
        setIsErrorModalOpen(true);
      }
      
      if (onVacationCreated) {
        onVacationCreated();
      }
    } catch (err: any) {
      // Извлекаем понятное сообщение об ошибке
      // Приоритет: message > error (код) > стандартное сообщение
      let errorMessage = 'Ошибка при создании отпуска';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        // Если есть только код ошибки, создаем понятное сообщение
        const errorCode = err.response.data.error;
        if (errorCode === 'INTERNAL_SERVER_ERROR') {
          errorMessage = 'Произошла внутренняя ошибка сервера. Пожалуйста, попробуйте позже или обратитесь к администратору.';
        } else {
          errorMessage = errorCode;
        }
      }
      
      setError(errorMessage);
      setIsErrorModalOpen(true);
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
      // Извлекаем понятное сообщение об ошибке
      // Приоритет: message > error (код) > стандартное сообщение
      let errorMessage = 'Ошибка при удалении отпуска';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.error) {
        // Если есть только код ошибки, создаем понятное сообщение
        const errorCode = err.response.data.error;
        if (errorCode === 'INTERNAL_SERVER_ERROR') {
          errorMessage = 'Произошла внутренняя ошибка сервера. Пожалуйста, попробуйте позже или обратитесь к администратору.';
        } else {
          errorMessage = errorCode;
        }
      }
      
      setError(errorMessage);
      setIsErrorModalOpen(true);
    }
  };

  // Сотрудники уже отфильтрованы и отсортированы в родительском компоненте (VacationMode)
  // Используем их напрямую без дополнительной фильтрации (как в MainSchedule)
  const visibleEmployees = employees;

  // Определяем тип сообщения (предупреждение или ошибка)
  const isWarning = error && (error.includes('Обязательная длина периода отпуска') || error.includes('Осталось') || error.includes('рекомендуется'));

  return (
    <div className="flex flex-col">
      {/* Модальное окно с ошибкой или предупреждением */}
      <Modal
        isOpen={isErrorModalOpen}
        onClose={() => {
          setIsErrorModalOpen(false);
          setError(null);
        }}
        title={isWarning ? 'Предупреждение' : 'Ошибка'}
        size="md"
      >
        <div className="space-y-4">
          <div className={`p-4 rounded-lg ${
            isWarning
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <p className={`text-sm ${
              isWarning
                ? 'text-yellow-800'
                : 'text-red-800'
            }`}>
              {error}
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setIsErrorModalOpen(false);
                setError(null);
              }}
              variant={isWarning ? 'default' : 'danger'}
            >
              Понятно
            </Button>
          </div>
        </div>
      </Modal>

      {/* Отображение календаря */}
      <div className="mt-4">
        {viewMode === 'compact' ? (
            <CompactAnnualCalendar
              scheduleId={scheduleId}
              scheduleStart={scheduleStart}
              scheduleEnd={scheduleEnd}
              selectedEmployeeId={selectedEmployeeId}
              employees={visibleEmployees}
              vacations={vacations}
              shiftsByDateAndEmployee={shiftsByDateAndEmployee}
              shiftTypes={shiftTypes}
              patternInstances={patternInstances}
              baseCycleStart={baseCycleStart}
              onDateClick={handleCompactDateClick}
              selectionStart={selectionStart}
              selectionEnd={selectionEnd}
              clickedDate={clickedDate}
            />
        ) : (
          <VacationRosterView
            scheduleId={scheduleId}
            scheduleStart={scheduleStart}
            scheduleEnd={scheduleEnd}
            employees={visibleEmployees}
            vacations={vacations}
            shiftsByDateAndEmployee={shiftsByDateAndEmployee}
            shiftTypes={shiftTypes}
            patternInstances={patternInstances}
            baseCycleStart={baseCycleStart}
            onDateClick={handleRosterDateClick}
            selectionStart={selectionStart}
            selectionEnd={selectionEnd}
            selectedEmployeeId={selectedEmployeeId}
            clickedDate={clickedDate}
          />
        )}
      </div>

    </div>
  );
}

