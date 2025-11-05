import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Card } from '@components/common';
import { ShiftProfile, Employee } from '@types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface GenerateShiftsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (data: {
    shiftProfileId: string;
    employeeIds: string[];
    startDate: string;
    endDate: string;
  }) => void;
  isLoading: boolean;
  profile: ShiftProfile | null;
  employees: Employee[];
  scheduleStartDate: Date;
  scheduleEndDate: Date;
}

/**
 * Модальное окно для генерации смен на основе профиля
 */
export const GenerateShiftsModal: React.FC<GenerateShiftsModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isLoading,
  profile,
  employees,
  scheduleStartDate,
  scheduleEndDate,
}) => {
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(
    format(scheduleStartDate, 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState(format(scheduleEndDate, 'yyyy-MM-dd'));
  const [selectAll, setSelectAll] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Сбрасываем состояние при закрытии модального окна
      setShowConfirmation(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (profile && profile.minEmployees) {
      // Автоматически выбираем минимальное количество сотрудников
      const minCount = profile.minEmployees;
      const selected = employees.slice(0, Math.min(minCount, employees.length));
      setSelectedEmployeeIds(selected.map((e) => e.id));
    }
  }, [profile, employees]);

  useEffect(() => {
    if (selectAll) {
      setSelectedEmployeeIds(employees.map((e) => e.id));
    } else if (profile) {
      const minCount = profile.minEmployees;
      const selected = employees.slice(0, Math.min(minCount, employees.length));
      setSelectedEmployeeIds(selected.map((e) => e.id));
    }
  }, [selectAll, employees, profile]);

  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      }
      return [...prev, employeeId];
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || selectedEmployeeIds.length < (profile.minEmployees || 0)) {
      alert(`Минимум требуется ${profile.minEmployees} сотрудников`);
      return;
    }
    // Показываем предупреждение о замене существующих смен
    setShowConfirmation(true);
  };

  const handleConfirmGenerate = () => {
    if (!profile) return;
    onGenerate({
      shiftProfileId: profile.id,
      employeeIds: selectedEmployeeIds,
      startDate,
      endDate,
    });
    setShowConfirmation(false);
  };

  const handleCancelConfirmation = () => {
    setShowConfirmation(false);
  };

  const isValid =
    profile &&
    selectedEmployeeIds.length >= (profile.minEmployees || 0) &&
    startDate &&
    endDate &&
    new Date(endDate) >= new Date(startDate);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Генерация смен: ${profile?.name || ''}`}
      size="lg"
    >
      {profile && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {showConfirmation ? (
            <div className="space-y-4">
              <Card padding="md" className="bg-yellow-50 border-yellow-200">
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold text-yellow-800">
                    Внимание!
                  </h3>
                  <p className="text-sm text-yellow-700">
                    При генерации смен все существующие смены в выбранном периоде{' '}
                    <strong>
                      {format(new Date(startDate), 'dd.MM.yyyy', { locale: ru })} -{' '}
                      {format(new Date(endDate), 'dd.MM.yyyy', { locale: ru })}
                    </strong>{' '}
                    будут удалены и заменены новыми сменами.
                  </p>
                  <p className="text-sm text-yellow-700">
                    Это действие нельзя отменить. Вы уверены, что хотите продолжить?
                  </p>
                </div>
              </Card>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={handleCancelConfirmation}>
                  Отмена
                </Button>
                <Button
                  variant="danger"
                  onClick={handleConfirmGenerate}
                  isLoading={isLoading}
                >
                  Да, сгенерировать смены
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Card padding="md" className="bg-gray-50">
            <div className="space-y-2 text-sm">
              <p>
                <strong>Профиль:</strong> {profile.name}
              </p>
              <p>
                <strong>Длина цикла:</strong> {profile.cycleLength} дней
              </p>
              <p>
                <strong>Минимум сотрудников:</strong> {profile.minEmployees}
              </p>
              {profile.description && (
                <p>
                  <strong>Описание:</strong> {profile.description}
                </p>
              )}
            </div>
          </Card>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Период генерации
              </label>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Дата начала"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={format(scheduleStartDate, 'yyyy-MM-dd')}
                  max={format(scheduleEndDate, 'yyyy-MM-dd')}
                  required
                />
                <Input
                  label="Дата окончания"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={format(scheduleStartDate, 'yyyy-MM-dd')}
                  max={format(scheduleEndDate, 'yyyy-MM-dd')}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">
                  Выбор сотрудников ({selectedEmployeeIds.length} выбрано)
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => setSelectAll(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm">Выбрать всех</span>
                </label>
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-2">
                {employees.map((employee) => (
                  <label
                    key={employee.id}
                    className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(employee.id)}
                      onChange={() => handleToggleEmployee(employee.id)}
                      className="rounded"
                    />
                    <div>
                      <div className="text-sm font-medium">{employee.fullName}</div>
                      <div className="text-xs text-gray-500">
                        Таб. №: {employee.tabNumber}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              {selectedEmployeeIds.length < (profile.minEmployees || 0) && (
                <p className="mt-2 text-sm text-red-600">
                  Требуется минимум {profile.minEmployees} сотрудников
                </p>
              )}
            </div>
          </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={onClose}>
                  Отмена
                </Button>
                <Button type="submit" isLoading={isLoading} disabled={!isValid}>
                  Сгенерировать смены
                </Button>
              </div>
            </>
          )}
        </form>
      )}
    </Modal>
  );
};

