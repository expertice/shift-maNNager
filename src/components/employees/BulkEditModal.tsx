import React, { useState, useEffect } from 'react';
import { Modal, SelectWithAdd, Button } from '@components/common';
import { Department, Position } from '@types';
import { positionsService, departmentsService } from '@services/api';

export interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    departmentId?: string;
    positionId?: string;
  }) => Promise<void>;
  selectedCount: number;
  departments: Department[];
  positions: Position[];
  scheduleId: string;
  isLoading?: boolean;
}

/**
 * Модальное окно для массового редактирования выбранных сотрудников
 */
export const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  departments,
  positions,
  scheduleId,
  isLoading = false,
}) => {
  const [departmentId, setDepartmentId] = useState('');
  const [positionId, setPositionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [localPositions, setLocalPositions] = useState<Position[]>(positions || []);
  const [localDepartments, setLocalDepartments] = useState<Department[]>(departments || []);

  // Обновление локальных списков при изменении пропсов
  useEffect(() => {
    setLocalPositions(positions || []);
  }, [positions]);

  useEffect(() => {
    setLocalDepartments(departments || []);
  }, [departments]);

  // Сброс полей при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      setDepartmentId('');
      setPositionId('');
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Проверяем, что хотя бы одно поле заполнено
    if (!departmentId && !positionId) {
      setError('Необходимо указать хотя бы одно поле для изменения');
      return;
    }

    try {
      await onSave({
        departmentId: departmentId || undefined,
        positionId: positionId || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении изменений');
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Массовое редактирование (${selectedCount} сотрудников)`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
          Изменения будут применены ко всем выбранным сотрудникам. Оставьте поле пустым, чтобы не изменять его.
        </div>

        <SelectWithAdd
          label="Отдел"
          value={departmentId}
          onChange={setDepartmentId}
          options={(localDepartments || []).map((dept) => ({
            value: dept.id,
            label: dept.name,
          }))}
          placeholder="Не изменять"
          disabled={isLoading}
          onAddNew={async (name) => {
            const newDepartment = await departmentsService.createDepartment(scheduleId, { name });
            setLocalDepartments([...(localDepartments || []), newDepartment]);
            return newDepartment;
          }}
          addButtonLabel="+ Добавить отдел"
          addPlaceholder="Введите название отдела"
        />

        <SelectWithAdd
          label="Должность"
          value={positionId}
          onChange={setPositionId}
          options={(localPositions || []).map((pos) => ({
            value: pos.id,
            label: pos.name,
          }))}
          placeholder="Не изменять"
          disabled={isLoading}
          onAddNew={async (name) => {
            const newPosition = await positionsService.createPosition(scheduleId, { name });
            setLocalPositions([...(localPositions || []), newPosition]);
            return newPosition;
          }}
          addButtonLabel="+ Добавить должность"
          addPlaceholder="Введите название должности"
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Применить изменения'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

