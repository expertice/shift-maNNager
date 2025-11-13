import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Button, Tabs } from '@components/common';
import { EditEmployeeModal } from './EditEmployeeModal';
import { Employee, Department, Position } from '@types';
import { employeesService } from '@services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EyeOff } from 'lucide-react';

export interface AddEmployeeToRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
  departments: Department[];
  positions: Position[];
}

/**
 * Модальное окно для добавления сотрудника в ростер
 * С двумя вкладками: создание нового и выбор из скрытых
 */
export const AddEmployeeToRosterModal: React.FC<AddEmployeeToRosterModalProps> = ({
  isOpen,
  onClose,
  scheduleId,
  departments,
  positions,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'select'>('create');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  // Загрузка всех сотрудников (включая скрытых)
  const { data: allEmployees } = useQuery({
    queryKey: ['employees', scheduleId],
    queryFn: () => employeesService.getEmployees(scheduleId),
    enabled: isOpen && !!scheduleId,
  });

  // Получаем только скрытых сотрудников и сортируем по ФИО
  const hiddenEmployees = useMemo(() => {
    const hidden = allEmployees?.filter(emp => emp.isHidden) || [];
    return [...hidden].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ru'));
  }, [allEmployees]);

  // Мутация для создания нового сотрудника
  const createMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      tabNumber: string;
      positionId?: string;
      birthDate?: string;
      departmentId: string;
      isHidden?: boolean;
    }) => employeesService.createEmployee(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setIsCreateModalOpen(false);
      onClose();
    },
  });

  // Мутация для массового обновления видимости
  const bulkUpdateVisibilityMutation = useMutation({
    mutationFn: (employeeIds: string[]) =>
      employeesService.bulkUpdateEmployeeVisibility(scheduleId, employeeIds, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
      setSelectedEmployeeIds(new Set());
      onClose();
    },
  });

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setActiveTab('create');
      setSelectedEmployeeIds(new Set());
      setIsCreateModalOpen(false);
    }
  }, [isOpen]);

  const handleToggleSelection = (employeeId: string) => {
    const newSelected = new Set(selectedEmployeeIds);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployeeIds(newSelected);
  };

  const handleAddSelected = () => {
    if (selectedEmployeeIds.size > 0) {
      bulkUpdateVisibilityMutation.mutate(Array.from(selectedEmployeeIds));
    }
  };

  const handleCreateNew = () => {
    setIsCreateModalOpen(true);
  };

  const tabItems = [
    {
      id: 'create',
      label: 'Создать нового',
      content: (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Создайте нового сотрудника и добавьте его в ростер.
          </p>
          <Button onClick={handleCreateNew} className="w-full">
            + Создать нового сотрудника
          </Button>
        </div>
      ),
    },
    {
      id: 'select',
      label: `Выбрать из скрытых (${hiddenEmployees.length})`,
      content: (
        <div className="space-y-4">
          {hiddenEmployees.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <EyeOff className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Нет скрытых сотрудников</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Выберите сотрудников, которых нужно вернуть в ростер.
              </p>
              <div className="max-h-96 overflow-y-auto border rounded-md">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        <input
                          type="checkbox"
                          checked={selectedEmployeeIds.size === hiddenEmployees.length && hiddenEmployees.length > 0}
                          onChange={() => {
                            if (selectedEmployeeIds.size === hiddenEmployees.length) {
                              setSelectedEmployeeIds(new Set());
                            } else {
                              setSelectedEmployeeIds(new Set(hiddenEmployees.map(emp => emp.id)));
                            }
                          }}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        ФИО
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Табельный №
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Должность
                      </th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Отдел
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {hiddenEmployees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.has(employee.id)}
                            onChange={() => handleToggleSelection(employee.id)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {employee.fullName}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {employee.tabNumber}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                          {employee.position?.name || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {employee.department?.name || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedEmployeeIds.size > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <span className="text-sm font-medium text-blue-900">
                    Выбрано: {selectedEmployeeIds.size} сотрудников
                  </span>
                  <Button
                    onClick={handleAddSelected}
                    disabled={bulkUpdateVisibilityMutation.isPending}
                  >
                    {bulkUpdateVisibilityMutation.isPending
                      ? 'Добавление...'
                      : `Добавить выбранных (${selectedEmployeeIds.size})`}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Добавить сотрудника в ростер"
        size="lg"
      >
        <Tabs
          items={tabItems}
          defaultTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as 'create' | 'select')}
        />
      </Modal>

      {/* Модальное окно создания нового сотрудника */}
      <EditEmployeeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSave={async (data) => {
          await createMutation.mutateAsync({
            ...data,
            isHidden: false, // Новый сотрудник сразу видим в ростере
          });
        }}
        employee={null}
        departments={departments}
        positions={positions}
        scheduleId={scheduleId}
        isLoading={createMutation.isPending}
      />
    </>
  );
};

