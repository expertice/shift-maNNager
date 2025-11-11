/**
 * Модальное окно для назначения профиля смены сотруднику
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button } from '@components/common';
import { shiftProfilesService } from '@services/api';
import { employeesService } from '@services/api';
import { ShiftProfile } from '@types';

interface AssignProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeId: string;
  scheduleId: string;
  onSuccess?: () => void;
}

export default function AssignProfileModal({
  isOpen,
  onClose,
  employeeId,
  scheduleId,
  onSuccess,
}: AssignProfileModalProps) {
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Загружаем профили смен
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['shiftProfiles', scheduleId],
    queryFn: () => shiftProfilesService.getShiftProfiles(scheduleId),
    enabled: isOpen && !!scheduleId,
  });

  // Загружаем текущего сотрудника для получения назначенного профиля
  const { data: employee } = useQuery({
    queryKey: ['employee', scheduleId, employeeId],
    queryFn: () => employeesService.getEmployeeById(scheduleId, employeeId),
    enabled: isOpen && !!employeeId && !!scheduleId,
  });

  // Устанавливаем текущий профиль при открытии
  useEffect(() => {
    if (isOpen && employee?.shiftProfileId) {
      setSelectedProfileId(employee.shiftProfileId);
    } else if (isOpen) {
      setSelectedProfileId(null);
    }
  }, [isOpen, employee?.shiftProfileId]);

  const handleAssign = async () => {
    if (!selectedProfileId) return;

    try {
      setAssigning(true);
      
      // Назначаем профиль сотруднику
      // Циклическое распределение паттернов будет выполнено автоматически при следующей генерации смен
      await employeesService.assignProfileToEmployee(employeeId, scheduleId, selectedProfileId);
      
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error assigning profile:', error);
      alert('Ошибка назначения профиля');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async () => {
    try {
      setAssigning(true);
      await employeesService.assignProfileToEmployee(employeeId, scheduleId, null);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error removing profile:', error);
      alert('Ошибка удаления профиля');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Установить график"
      size="md"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4">Загрузка профилей...</div>
        ) : profiles && profiles.length > 0 ? (
          <>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              <label className="block">
                <input
                  type="radio"
                  name="profile"
                  checked={selectedProfileId === null}
                  onChange={() => setSelectedProfileId(null)}
                  className="mr-2"
                />
                <span className="text-sm">Не назначен</span>
              </label>
              {profiles.map((profile) => (
                <label key={profile.id} className="block">
                  <input
                    type="radio"
                    name="profile"
                    value={profile.id}
                    checked={selectedProfileId === profile.id}
                    onChange={() => setSelectedProfileId(profile.id)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium">{profile.name}</span>
                  {profile.patterns && profile.patterns.length > 0 && (
                    <span className="text-xs text-gray-500 ml-2">
                      ({profile.patterns.length} паттерн{profile.patterns.length > 1 ? 'ов' : ''})
                    </span>
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-2 pt-4 border-t">
              {employee?.shiftProfileId && (
                <Button
                  variant="outline"
                  onClick={handleRemove}
                  isLoading={assigning}
                  disabled={assigning}
                >
                  Удалить график
                </Button>
              )}
              <Button
                variant="primary"
                onClick={handleAssign}
                isLoading={assigning}
                disabled={assigning || !selectedProfileId}
              >
                Применить
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-4 text-gray-500">
            Нет доступных профилей смен. Создайте профиль в разделе "Генерация смен".
          </div>
        )}
      </div>
    </Modal>
  );
}

