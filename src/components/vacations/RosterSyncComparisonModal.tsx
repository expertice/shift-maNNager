import React, { useState, useMemo } from 'react';
import { Modal } from '@components/common';
import { Button } from '@components/common';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { compareRosterSync, ShiftDifference } from '@/utils/rosterSyncChecker';
import { Employee, Shift } from '@types';
import classNames from 'classnames';

export interface RosterSyncComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  employees: Employee[];
}

export default function RosterSyncComparisonModal({
  isOpen,
  onClose,
  scheduleId,
  scheduleStart,
  scheduleEnd,
  employees,
}: RosterSyncComparisonModalProps) {
  const [comparisonStartDate, setComparisonStartDate] = useState<Date>(scheduleStart);
  const [comparisonEndDate, setComparisonEndDate] = useState<Date>(scheduleEnd);
  const [isComparing, setIsComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{
    differences: ShiftDifference[];
    statistics: {
      totalDays: number;
      totalEmployees: number;
      matchingShifts: number;
      differentShifts: number;
      missingInMain: number;
      missingInVacation: number;
    };
  } | null>(null);

  const handleCompare = async () => {
    if (!scheduleId || !employees.length) {
      alert('Не указан ID расписания или нет сотрудников для сравнения');
      return;
    }

    if (comparisonStartDate > comparisonEndDate) {
      alert('Дата начала не может быть позже даты окончания');
      return;
    }

    setIsComparing(true);
    setComparisonResult(null); // Сбрасываем предыдущий результат
    
    try {
      const result = await compareRosterSync(
        scheduleId,
        comparisonStartDate,
        comparisonEndDate,
        employees
      );

      setComparisonResult({
        differences: result.differences,
        statistics: result.statistics,
      });
    } catch (error) {
      console.error('Error comparing rosters:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при сравнении ростеров: ${errorMessage}. Попробуйте еще раз.`);
    } finally {
      setIsComparing(false);
    }
  };

  // Группируем различия по датам для отображения в таблице
  const differencesByDate = useMemo(() => {
    if (!comparisonResult) return new Map<string, Map<string, ShiftDifference>>();

    const map = new Map<string, Map<string, ShiftDifference>>();

    comparisonResult.differences.forEach((diff) => {
      if (!map.has(diff.date)) {
        map.set(diff.date, new Map());
      }
      map.get(diff.date)!.set(diff.employeeId, diff);
    });

    return map;
  }, [comparisonResult]);

  // Получаем все даты для отображения - только те, где есть различия или совпадения
  const datesToShow = useMemo(() => {
    if (!comparisonResult) return [];
    const dates = new Set<string>();
    comparisonResult.differences.forEach((diff) => dates.add(diff.date));
    return Array.from(dates).sort();
  }, [comparisonResult]);

  // Получаем только даты с различиями для фильтрации (опционально)
  const datesWithDifferences = useMemo(() => {
    if (!comparisonResult) return new Set<string>();
    const dates = new Set<string>();
    comparisonResult.differences
      .filter((diff) => diff.type !== 'match')
      .forEach((diff) => dates.add(diff.date));
    return dates;
  }, [comparisonResult]);

  // Получаем shiftTypeId для отображения
  const getShiftTypeDisplay = (shift: Shift | null): string => {
    if (!shift) return '-';
    if (!shift.shiftTypeId) return 'Выходной';
    return shift.shiftType?.name || shift.shiftTypeId.substring(0, 8);
  };

  // Получаем цвет ячейки в зависимости от типа различия
  const getCellColor = (type: ShiftDifference['type']): string => {
    switch (type) {
      case 'match':
        return 'bg-green-50';
      case 'different_shift_type':
        return 'bg-red-100';
      case 'missing_in_main':
        return 'bg-yellow-50';
      case 'missing_in_vacation':
        return 'bg-yellow-50';
      default:
        return 'bg-white';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Проверка синхронности ростера"
      size="xl"
    >
      <div className="space-y-4">
        {/* Выбор периода */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата начала
            </label>
            <input
              type="date"
              value={format(comparisonStartDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const date = e.target.value ? parseISO(e.target.value) : scheduleStart;
                setComparisonStartDate(startOfDay(date));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              value={format(comparisonEndDate, 'yyyy-MM-dd')}
              onChange={(e) => {
                const date = e.target.value ? parseISO(e.target.value) : scheduleEnd;
                setComparisonEndDate(endOfDay(date));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleCompare}
              disabled={isComparing || !scheduleId || !employees.length}
              isLoading={isComparing}
              className="px-4 py-2"
            >
              {isComparing ? 'Проверка...' : 'Проверить синхронность'}
            </Button>
          </div>
        </div>

        {/* Статистика */}
        {comparisonResult && (
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Всего дней</div>
                <div className="text-lg font-semibold">{comparisonResult.statistics.totalDays}</div>
              </div>
              <div>
                <div className="text-gray-600">Совпадающих смен</div>
                <div className="text-lg font-semibold text-green-600">
                  {comparisonResult.statistics.matchingShifts}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Различий</div>
                <div className="text-lg font-semibold text-red-600">
                  {comparisonResult.statistics.differentShifts +
                    comparisonResult.statistics.missingInMain +
                    comparisonResult.statistics.missingInVacation}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm mt-2">
              <div>
                <div className="text-gray-600">Разные типы смен</div>
                <div className="text-lg font-semibold">{comparisonResult.statistics.differentShifts}</div>
              </div>
              <div>
                <div className="text-gray-600">Отсутствует в ростере смен</div>
                <div className="text-lg font-semibold">{comparisonResult.statistics.missingInMain}</div>
              </div>
              <div>
                <div className="text-gray-600">Отсутствует в ростере отпусков</div>
                <div className="text-lg font-semibold">
                  {comparisonResult.statistics.missingInVacation}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Сообщение, если нет данных для сравнения */}
        {comparisonResult && datesToShow.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Нет данных для сравнения за выбранный период
          </div>
        )}

        {/* Таблица сравнения */}
        {comparisonResult && datesToShow.length > 0 && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-[600px]">
              <table className="min-w-full divide-y divide-gray-200 border-collapse">
                <thead className="bg-gray-50 sticky top-0 z-20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-30 border-r border-b">
                      Сотрудник
                    </th>
                    {datesToShow.map((date) => (
                      <th
                        key={date}
                        className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[100px] border-b"
                      >
                        <div>{format(parseISO(date), 'dd', { locale: ru })}</div>
                        <div className="text-[10px] text-gray-400">
                          {format(parseISO(date), 'EEE', { locale: ru })}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 sticky left-0 bg-white z-20 border-r whitespace-nowrap">
                        {employee.fullName}
                      </td>
                      {datesToShow.map((date) => {
                        const diff = differencesByDate.get(date)?.get(employee.id);
                        if (!diff) {
                          return (
                            <td key={date} className="px-2 py-1 text-center text-xs bg-gray-50 border">
                              <div className="text-gray-400">-</div>
                              <div className="text-gray-400">-</div>
                            </td>
                          );
                        }

                        const isDifferent = diff.type !== 'match';
                        const hasMainShift = !!diff.mainScheduleShift;
                        const hasVacationShift = !!diff.vacationModeShift;
                        
                        return (
                          <td
                            key={date}
                            className={classNames(
                              'px-2 py-1 text-center text-xs border',
                              getCellColor(diff.type),
                              isDifferent && 'border-red-300'
                            )}
                            title={
                              isDifferent
                                ? `Различие: ${diff.type === 'different_shift_type' ? 'Разные типы смен' : diff.type === 'missing_in_main' ? 'Отсутствует в ростере смен' : 'Отсутствует в ростере отпусков'}`
                                : 'Совпадает'
                            }
                          >
                            <div className="space-y-1 min-h-[40px] flex flex-col justify-center">
                              <div className={classNames(
                                'font-semibold',
                                hasMainShift ? 'text-blue-700' : 'text-gray-400'
                              )}>
                                {getShiftTypeDisplay(diff.mainScheduleShift)}
                              </div>
                              <div className={classNames(
                                'border-t border-gray-300 pt-1',
                                hasVacationShift ? 'text-purple-700' : 'text-gray-400'
                              )}>
                                {getShiftTypeDisplay(diff.vacationModeShift)}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Легенда */}
        {comparisonResult && (
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-50 border border-green-200"></div>
              <span>Совпадает</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border border-red-200"></div>
              <span>Разные типы смен</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-50 border border-yellow-200"></div>
              <span>Отсутствует в одном из ростеров</span>
            </div>
          </div>
        )}

        {/* Кнопка закрытия */}
        <div className="flex justify-end">
          <Button onClick={onClose} variant="outline">
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
}

