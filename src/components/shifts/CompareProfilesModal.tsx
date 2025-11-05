import React, { useState } from 'react';
import { format } from 'date-fns';
import { Modal, Button, Input, Spinner } from '@components/common';
import { shiftProfilesService } from '@services/api';
import { CompareProfilesResponse } from '@types';

export interface CompareProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProfileIds: string[];
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
  scheduleStartDate,
  scheduleEndDate,
}) => {
  const [startDate, setStartDate] = useState(format(scheduleStartDate, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(scheduleEndDate, 'yyyy-MM-dd'));
  const [isLoading, setIsLoading] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<CompareProfilesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await shiftProfilesService.compareProfiles({
        profileIds: selectedProfileIds,
        startDate,
        endDate,
      });

      setComparisonResult(result);
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
    onClose();
  };

  const handleExportPDF = async () => {
    if (!comparisonResult) return;

    try {
      const { exportComparisonToPDF } = await import('@utils/pdfExport');
      await exportComparisonToPDF(comparisonResult.comparisons);
      alert('PDF экспортирован успешно!');
    } catch (err: any) {
      alert(`Ошибка экспорта PDF: ${err.message}`);
    }
  };

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
                disabled={isLoading || !startDate || !endDate}
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
                <strong>Максимальное количество сотрудников:</strong>{' '}
                {comparisonResult.maxEmployeeCount}
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

                    <h4 className="font-semibold text-gray-700 text-xs mb-2">Паттерны:</h4>
                    <div className="space-y-2">
                      {comparison.visualizedPatterns.map((pattern) => (
                        <div key={pattern.patternNumber} className="border border-gray-200 rounded p-2">
                          <div className="text-xs text-gray-600 mb-1">
                            Паттерн {pattern.patternNumber}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {pattern.sequence.slice(0, Math.min(pattern.cycleLength + 2, pattern.sequence.length)).map((shiftType, dayIndex) => {
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
                              } else {
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
                              }
                            })}
                          </div>
                        </div>
                      ))}
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

