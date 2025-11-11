import React, { useState, useEffect } from 'react';
import { Modal, Input, SelectWithAdd, Button } from '@components/common';
import { Employee, Department, Position } from '@types';
import { positionsService, departmentsService } from '@services/api';

export interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    fullName: string;
    tabNumber: string;
    positionId?: string;
    birthDate?: string;
    departmentId: string;
  }) => Promise<void>;
  employee?: Employee | null;
  departments: Department[];
  positions: Position[];
  scheduleId: string;
  isLoading?: boolean;
}

/**
 * Модальное окно для создания и редактирования сотрудника
 */
export const EditEmployeeModal: React.FC<EditEmployeeModalProps> = ({
  isOpen,
  onClose,
  onSave,
  employee,
  departments,
  positions,
  scheduleId,
  isLoading = false,
}) => {
  const [fullName, setFullName] = useState('');
  const [tabNumber, setTabNumber] = useState('');
  const [positionId, setPositionId] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');
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

  // Инициализация полей при открытии модального окна или изменении сотрудника
  useEffect(() => {
    if (isOpen) {
      if (employee) {
        setFullName(employee.fullName);
        setTabNumber(employee.tabNumber);
        setPositionId(employee.positionId || '');
        setBirthDate(
          employee.birthDate
            ? new Date(employee.birthDate).toISOString().split('T')[0]
            : ''
        );
        setDepartmentId(employee.departmentId || '');
      } else {
        // Сброс для создания нового сотрудника
        setFullName('');
        setTabNumber('');
        setPositionId('');
        setBirthDate('');
        setDepartmentId('');
      }
      setError(null);
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      await onSave({
        fullName: fullName.trim(),
        tabNumber: tabNumber.trim(),
        positionId: positionId || undefined,
        birthDate: birthDate || undefined,
        departmentId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении сотрудника');
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
      title={employee ? `Редактировать: ${employee.fullName}` : 'Добавить сотрудника'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <Input
          label="ФИО"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Иванов Иван Иванович"
          disabled={isLoading}
        />

        <Input
          label="Табельный номер"
          value={tabNumber}
          onChange={(e) => setTabNumber(e.target.value)}
          required
          placeholder="12345"
          disabled={isLoading}
        />

        <SelectWithAdd
          label="Должность"
          value={positionId}
          onChange={setPositionId}
          options={(localPositions || []).map((pos) => ({
            value: pos.id,
            label: pos.name,
          }))}
          placeholder="Выберите должность"
          disabled={isLoading}
          onAddNew={async (name) => {
            const newPosition = await positionsService.createPosition(scheduleId, { name });
            setLocalPositions([...(localPositions || []), newPosition]);
            return newPosition;
          }}
          addButtonLabel="+ Добавить должность"
          addPlaceholder="Введите название должности"
        />

        <Input
          label="Дата рождения"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          disabled={isLoading}
        />

        <SelectWithAdd
          label="Отдел"
          value={departmentId}
          onChange={setDepartmentId}
          required
          options={(localDepartments || []).map((dept) => ({
            value: dept.id,
            label: dept.name,
          }))}
          placeholder="Выберите отдел"
          disabled={isLoading}
          onAddNew={async (name) => {
            const newDepartment = await departmentsService.createDepartment(scheduleId, { name });
            setLocalDepartments([...(localDepartments || []), newDepartment]);
            return newDepartment;
          }}
          addButtonLabel="+ Добавить отдел"
          addPlaceholder="Введите название отдела"
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
            Отмена
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Сохранение...' : employee ? 'Сохранить' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

