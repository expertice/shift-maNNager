import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Modal, Button, Input, Spinner } from '@components/common';
import { shiftProfilesService } from '@services/api';
import { CompareProfilesResponse, ShiftProfile } from '@types';

export interface CompareProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfileIds: string[];
  selectedProfiles: ShiftProfile[];
  scheduleStartDate: Date;
  scheduleEndDate: Date;
}

/**
 * Вспомогательная функция для определения контрастного цвета текста
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Модальное окно для сравнения профилей смен
 */
export const CompareProfilesModal: React.FC<CompareProfilesModalProps> = ({
  isOpen,
  onClose,
  selectedProfileIds,
  selectedProfiles,
  scheduleStartDate,
  scheduleEndDate,
}) => {
  const [startDate, setStartDate] = useState(format(scheduleStartDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(scheduleEndDate, 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<CompareProfilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const minRequiredEmployees = useMemo(
    () => selectedProfiles.reduce((max, profile) => Math.max(max, profile.minEmployees), 0),
    [selectedProfiles]
  );
  const [employeeCount, setEmployeeCount] = useState<number>(() => Math.max(minRequiredEmployees, 0));

  useEffect(() => {
    if (!isOpen) {
      setEmployeeCount(Math.max(minRequiredEmployees, 0));
      return;
    }

    setEmployeeCount((prev) => {
      const normalizedPrev = Number.isFinite(prev) ? prev : 0;
      return Math.max(minRequiredEmployees, normalizedPrev || minRequiredEmployees);
    });
  }, [minRequiredEmployees, isOpen]);

  const handleCompare = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const normalizedEmployeeCount = Math.max(
        minRequiredEmployees,
        Math.floor(Number.isFinite(employeeCount) ? employeeCount : minRequiredEmployees)
      );

      const result = await shiftProfilesService.compareProfiles({
        profileIds: selectedProfileIds,
        startDate,
        endDate,
        employeeCount: normalizedEmployeeCount,
      });

      setComparisonResult(result);
      setEmployeeCount(normalizedEmployeeCount);
    } catch (err: any) {
      setError(err.message || 'Ошибка при сравнении профилей');
      setComparisonResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setComparisonResult(null);
    setError(null);
    setEmployeeCount(Math.max(minRequiredEmployees, 0));
    onClose();
  };

  const handleExportPDF = async () => {
    if (!comparisonResult) return;

    try {
      const { exportComparisonToPDF } = await import('@utils/pdfExport');
      await exportComparisonToPDF(
        comparisonResult.comparisons,
        comparisonResult.maxEmployeeCount,
        comparisonResult.employeeCount
      );
      alert('PDF экспортирован успешно!');
    } catch (err: any) {
      alert(`Ошибка экспорта PDF: ${err.message}`);
    }
  };

  const globalMaxCycleLength = useMemo(() => {
    if (!comparisonResult) {
      return 0;
    }

    return comparisonResult.comparisons.reduce((maxCycle, comparison) => {
      const comparisonMax = comparison.visualizedPatterns.reduce(
        (innerMax, pattern) => Math.max(innerMax, pattern.cycleLength),
        0
      );
      return Math.max(maxCycle, comparisonMax);
    }, 0);
  }, [comparisonResult]);

  const patternsCache = useMemo(() => {
    type PatternInfo = {
      sorted: CompareProfilesResponse['comparisons'][number]['visualizedPatterns'];
      byNumber: Map<
        number,
        CompareProfilesResponse['comparisons'][number]['visualizedPatterns'][number]
      >;
    };

    const cache = new Map<string, PatternInfo>();

    if (!comparisonResult) {
      return cache;
    }

    comparisonResult.comparisons.forEach((comparison) => {
      const sorted = [...comparison.visualizedPatterns].sort(
        (a, b) => a.patternNumber - b.patternNumber
      );
      const byNumber = new Map(sorted.map((pattern) => [pattern.patternNumber, pattern]));

      cache.set(comparison.profile.id, { sorted, byNumber });
    });

    return cache;
  }, [comparisonResult]);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">Сравнение профилей смен</h2>

        {!comparisonResult && (
          <div className="space-y-4">
            <p className="text-gray-600">
              Выбрано профилей: <strong>{selectedProfileIds.length}</strong>
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата начала периода
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={format(scheduleStartDate, 'yyyy-MM-dd')}
                  max={format(scheduleEndDate, 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Дата окончания периода
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={format(scheduleStartDate, 'yyyy-MM-dd')}
                  max={format(scheduleEndDate, 'yyyy-MM-dd')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Количество сотрудников
              </label>
              <Input
                type="number"
                min={minRequiredEmployees}
                value={Number.isFinite(employeeCount) ? employeeCount : ''}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isNaN(value)) {
                    setEmployeeCount(minRequiredEmployees);
                  } else {
                    setEmployeeCount(value);
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Минимум для выбранных профилей: {minRequiredEmployees}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={handleClose} variant="outline">
                Отмена
              </Button>
              <Button
                onClick={handleCompare}
                variant="primary"
                disabled={
                  isLoading ||
                  !startDate ||
                  !endDate ||
                  minRequiredEmployees === 0 ||
                  (Number.isFinite(employeeCount) && employeeCount < minRequiredEmployees)
                }
              >
                {isLoading ? (
                  <>
                    <Spinner size="sm" className="mr-2" />
                    Выполняется сравнение...
                  </>
                ) : (
                  'Выполнить сравнение'
                )}
              </Button>
            </div>
          </div>
        )}

        {comparisonResult && (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded">
              <p className="text-sm text-blue-800">
                <strong>Период:</strong> {format(new Date(startDate), 'dd.MM.yyyy')} —{' '}
                {format(new Date(endDate), 'dd.MM.yyyy')}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Минимум по выбранным профилям:</strong>{' '}
                {comparisonResult.maxEmployeeCount}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                <strong>Использовано сотрудников:</strong> {comparisonResult.employeeCount}
              </p>
            </div>

            {/* Колонки сравнения профилей */}
            <div className="overflow-x-auto">
              <div className="inline-flex gap-4 min-w-full">
                {comparisonResult.comparisons.map((comparison, index) => (
                  <div
                    key={comparison.profile.id}
                    className="flex-shrink-0 border border-gray-300 rounded-lg p-4"
                    style={{
                      width: comparisonResult.comparisons.length === 1 ? '100%' :
                             comparisonResult.comparisons.length === 2 ? 'calc(50% - 8px)' :
                             comparisonResult.comparisons.length === 3 ? 'calc(33.333% - 11px)' :
                             '320px'
                    }}
                  >
                    <h3 className="text-lg font-semibold mb-3 border-b pb-2">
                      {comparison.profile.name}
                    </h3>

                    {comparison.profile.description && (
                      <p className="text-gray-600 text-xs mb-3 line-clamp-2" title={comparison.profile.description}>
                        {comparison.profile.description}
                      </p>
                    )}

                    <div className="mb-4 space-y-1">
                      <p className="text-xs text-gray-600">
                        <strong>Цикл:</strong> {comparison.profile.cycleLength} дней
                      </p>
                      <p className="text-xs text-gray-600">
                        <strong>Мин. сотрудников:</strong> {comparison.profile.minEmployees}
                      </p>
                    </div>

                    <h4 className="font-semibold text-gray-700 text-sm mb-2">Метрики:</h4>
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full border border-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-2 py-1 border-b text-left text-xs font-medium text-gray-700">
                              Сотр.
                            </th>
                            <th className="px-2 py-1 border-b text-right text-xs font-medium text-gray-700">
                              Смен
                            </th>
                            <th className="px-2 py-1 border-b text-right text-xs font-medium text-gray-700">
                              Часов
                            </th>
                            <th className="px-2 py-1 border-b text-right text-xs font-medium text-gray-700">
                              Ночн.
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.employeeMetrics.map((metrics) => (
                            <tr key={metrics.employeeNumber} className="hover:bg-gray-50">
                              <td className="px-2 py-1 border-b text-xs">
                                {metrics.employeeNumber}
                              </td>
                              <td className="px-2 py-1 border-b text-xs text-right">
                                {metrics.shiftsCount}
                              </td>
                              <td className="px-2 py-1 border-b text-xs text-right">
                                {metrics.totalHours.toFixed(1)}
                              </td>
                              <td className="px-2 py-1 border-b text-xs text-right">
                                {metrics.nightHours}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Разбивка по типам смен */}
                    {comparison.shiftTypes && comparison.shiftTypes.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-semibold text-gray-700 text-sm mb-2">
                          Типы смен по сотрудникам:
                        </h4>
                        <div className="overflow-x-auto">
                          <table className="w-full border border-gray-200 text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1 border-b text-left text-xs font-medium text-gray-700">
                                  Сотрудник
                                </th>
                                {comparison.shiftTypes.map((shiftType) => {
                                  const backgroundColor = shiftType.color || '#f9fafb';
                                  const textColor = getContrastColor(backgroundColor);

                                  return (
                                    <th
                                      key={shiftType.id}
                                      className="px-2 py-1 border-b text-xs font-medium text-center"
                                      style={{
                                        backgroundColor,
                                        color: textColor,
                                      }}
                                      title={`${shiftType.name} (${shiftType.startTime}-${shiftType.endTime}), ${shiftType.workingHours}ч`}
                                    >
                                      <div>{shiftType.name}</div>
                                      <div className="text-[10px] font-normal opacity-90">
                                        {shiftType.startTime}-{shiftType.endTime}
                                      </div>
                                    </th>
                                  );
                                })}
                              </tr>
                            </thead>
                            <tbody>
                              {comparison.employeeMetrics.map((metrics) => (
                                <tr key={metrics.employeeNumber} className="hover:bg-gray-50">
                                  <td className="px-2 py-1 border-b text-xs">
                                    Сотрудник {metrics.employeeNumber}
                                  </td>
                                  {comparison.shiftTypes.map((shiftType) => {
                                    const count = metrics.shiftTypeCounts?.[shiftType.id] ?? 0;
                                    return (
                                      <td
                                        key={shiftType.id}
                                        className="px-2 py-1 border-b text-xs text-center"
                                      >
                                        {count > 0 ? count : '—'}
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

                    <h4 className="font-semibold text-gray-700 text-xs mb-2">Паттерны по сотрудникам:</h4>
                    <div className="space-y-2">
                      {Array.from(
                        {
                          length:
                            comparisonResult.employeeCount ?? comparisonResult.maxEmployeeCount,
                        },
                        (_, index) => {
                        const employeeNumber = index + 1;
                        const cacheEntry = patternsCache.get(comparison.profile.id);
                        const exactPattern = cacheEntry?.byNumber.get(employeeNumber);
                        let pattern = exactPattern;

                        if (!pattern && cacheEntry?.sorted && cacheEntry.sorted.length > 0) {
                          const repeatIndex = (employeeNumber - 1) % cacheEntry.sorted.length;
                          pattern = cacheEntry.sorted[repeatIndex];
                        }

                        return (
                          <div key={employeeNumber} className="border border-gray-200 rounded p-2">
                            <div className="text-xs text-gray-600 mb-1">
                              Сотрудник {employeeNumber}
                            </div>
                            {pattern && cacheEntry?.sorted?.length ? (
                              <div className="flex flex-wrap gap-1">
                                {(() => {
                                  const sequenceLength = pattern.sequence.length;
                                  if (sequenceLength === 0) {
                                    return (
                                      <div className="text-xs text-gray-500 italic">
                                        Нет данных по паттерну
                                      </div>
                                    );
                                  }

                                  const daysToRender = Math.max(
                                    globalMaxCycleLength,
                                    pattern.cycleLength,
                                    sequenceLength
                                  );

                                  return Array.from({ length: daysToRender }, (_, dayIndex) => {
                                    const shiftType = pattern.sequence[dayIndex % sequenceLength];

                                    if (shiftType === null) {
                                      return (
                                        <div
                                          key={dayIndex}
                                          className="w-6 h-6 bg-gray-100 border border-gray-300 rounded flex items-center justify-center"
                                          title={`День ${dayIndex + 1}: Выходной`}
                                        >
                                          <span className="text-[8px] text-gray-500">—</span>
                                        </div>
                                      );
                                    }

                                    const backgroundColor = shiftType.color || '#e5e7eb';
                                    const textColor = getContrastColor(backgroundColor);

                                    return (
                                      <div
                                        key={dayIndex}
                                        className="w-6 h-6 border border-gray-300 rounded flex items-center justify-center"
                                        style={{
                                          backgroundColor,
                                          color: textColor,
                                        }}
                                        title={`День ${dayIndex + 1}: ${shiftType.name} (${shiftType.startTime}-${shiftType.endTime})`}
                                      >
                                        <span className="text-[8px] font-semibold">
                                          {shiftType.name.charAt(0)}
                                        </span>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500 italic">Нет паттернов для отображения</div>
                            )}
                          </div>
                        );
                      }
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button onClick={handleExportPDF} variant="outline">
                Экспорт в PDF
              </Button>
              <Button onClick={handleClose} variant="primary">
                Закрыть
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

