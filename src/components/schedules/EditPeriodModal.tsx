import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Input, Button } from '@components/common';
import { schedulesService } from '@services/api';
import { Schedule } from '@types';
import { format } from 'date-fns';

export interface EditPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: Schedule;
}

/**
 * Модальное окно для редактирования периода расписания
 */
export const EditPeriodModal: React.FC<EditPeriodModalProps> = ({
  isOpen,
  onClose,
  schedule,
}) => {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [useYearlyReporting, setUseYearlyReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Инициализация дат при открытии модального окна
  useEffect(() => {
    if (isOpen && schedule) {
      setStartDate(format(new Date(schedule.startDate), 'yyyy-MM-dd'));
      setEndDate(format(new Date(schedule.endDate), 'yyyy-MM-dd'));
      // Если reportingPeriod не установлен, по умолчанию 'month' (флажок выключен)
      setUseYearlyReporting(schedule.reportingPeriod === 'year');
      setError(null);
    }
  }, [isOpen, schedule]);

  const updateMutation = useMutation({
    mutationFn: (data: { 
      startDate: string; 
      endDate: string;
      reportingPeriod?: 'year' | 'month';
    }) =>
      schedulesService.updateSchedule(schedule.id, data),
    onSuccess: () => {
      // Инвалидируем кэш расписания и связанных данных
      queryClient.invalidateQueries({ queryKey: ['schedule', schedule.id] });
      queryClient.invalidateQueries({ queryKey: ['shifts', schedule.id] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Ошибка обновления периода');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Валидация
    if (!startDate || !endDate) {
      setError('Необходимо указать обе даты');
      return;
    }

    if (end < start) {
      setError('Дата окончания должна быть позже или равна дате начала');
      return;
    }

    updateMutation.mutate({
      startDate,
      endDate,
      reportingPeriod: useYearlyReporting ? 'year' : 'month',
    });
  };

  const isValid =
    startDate && endDate && new Date(endDate) >= new Date(startDate);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Редактирование периода расписания"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Период расписания
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="От"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <Input
              label="До"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              required
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="yearlyReporting"
            checked={useYearlyReporting}
            onChange={(e) => setUseYearlyReporting(e.target.checked)}
            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
          />
          <label htmlFor="yearlyReporting" className="text-sm text-gray-700">
            Годовой отчётный период (без контроля недельных/месячных лимитов)
          </label>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={onClose} type="button">
            Отмена
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            disabled={!isValid}
          >
            Сохранить
          </Button>
        </div>
      </form>
    </Modal>
  );
};

