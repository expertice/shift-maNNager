import React, { useState } from 'react';
import { Modal, Button, Card, Select } from '@components/common';
import { ShiftProfile, Employee, Department } from '@types';

export interface CreatePlaceholdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (count: number, departmentId?: string | null) => Promise<Employee[]>;
  isLoading: boolean;
  profile: ShiftProfile | null;
  currentEmployeeCount: number;
  departments?: Department[];
}

/**
 * Модальное окно для создания болванчиков-сотрудников
 */
export const CreatePlaceholdersModal: React.FC<CreatePlaceholdersModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  isLoading,
  profile,
  currentEmployeeCount,
  departments = [],
}) => {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [createdPlaceholders, setCreatedPlaceholders] = useState<Employee[]>([]);

  if (!profile) return null;

  const missingCount = Math.max(0, profile.minEmployees - currentEmployeeCount);
  const totalNeeded = missingCount;

  const handleCreate = async () => {
    try {
      const created = await onCreate(totalNeeded, selectedDepartmentId || null);
      setCreatedPlaceholders(created);
      // Модальное окно закроется автоматически через родительский компонент
    } catch (error: any) {
      // Ошибка уже обработана в родительском компоненте
      // Не обновляем состояние, чтобы пользователь мог попробовать снова
    }
  };

  const handleClose = () => {
    if (createdPlaceholders.length > 0) {
      // Если болванчики созданы, просто закрываем модальное окно
      // Список будет обновлен через query invalidation в родительском компоненте
      setCreatedPlaceholders([]);
      setSelectedDepartmentId('');
      onClose();
    } else {
      // Если еще не созданы, сбрасываем состояние и закрываем
      setSelectedDepartmentId('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Создание болванчиков-сотрудников"
      size="lg"
    >
      <div className="space-y-6">
        {createdPlaceholders.length === 0 ? (
          <>
            <Card padding="md" className="bg-yellow-50 border-yellow-200">
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-yellow-800">
                  Для схемы "{profile.name}" требуется минимум {profile.minEmployees} сотрудников
                </p>
                <p className="text-yellow-700">
                  У вас {currentEmployeeCount} сотрудников. Не хватает {missingCount} человек.
                </p>
              </div>
            </Card>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Выберите отдел для болванчиков (необязательно)
                </label>
                <Select
                  value={selectedDepartmentId}
                  onChange={(e) => setSelectedDepartmentId(e.target.value)}
                  placeholder="-- Отдел можно выбрать позже --"
                  options={(departments || []).map((dept) => ({
                    value: dept.id,
                    label: dept.name,
                  }))}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Отдел можно указать позже при редактировании сотрудника
                </p>
              </div>

              <Card padding="md" className="bg-gray-50">
                <div className="space-y-2 text-sm text-gray-600">
                  <p>
                    <strong>Будет создано:</strong> {totalNeeded} болванчиков-сотрудников
                  </p>
                  <p>
                    Болванчики будут созданы с именами "Сотрудник 1", "Сотрудник 2" и т.д.
                  </p>
                  <p>
                    Табельные номера будут сгенерированы автоматически.
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    После создания вы сможете отредактировать данные болванчиков на странице сотрудников.
                  </p>
                </div>
              </Card>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Отмена
              </Button>
              <Button
                onClick={handleCreate}
                isLoading={isLoading}
                disabled={totalNeeded === 0}
              >
                Создать {totalNeeded} болванчиков
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <Card padding="md" className="bg-green-50 border-green-200">
              <p className="text-sm font-semibold text-green-800 mb-2">
                ✅ Болванчики успешно созданы!
              </p>
              <p className="text-sm text-green-700">
                Создано {createdPlaceholders.length} болванчиков-сотрудников.
              </p>
            </Card>

            <div>
              <h4 className="text-sm font-medium mb-2">Созданные болванчики:</h4>
              <div className="max-h-64 overflow-y-auto border rounded-md p-2 space-y-2">
                {createdPlaceholders.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded"
                  >
                    <div>
                      <div className="text-sm font-medium">{emp.fullName}</div>
                      <div className="text-xs text-gray-500">Таб. №: {emp.tabNumber}</div>
                    </div>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                      Болванчик
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleClose}>Продолжить к генерации</Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
