import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Card, Spinner } from '@components/common';
import { EditEmployeeModal } from '@components/employees';
import { employeesService, schedulesService, positionsService } from '@services/api';
import { Employee } from '@types';

/**
 * Страница управления сотрудниками
 */
export default function EmployeesPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка расписания для получения отделов
  const { data: schedule } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedulesService.getScheduleById(scheduleId),
    enabled: !!scheduleId,
  });

  // Загрузка сотрудников
  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', scheduleId],
    queryFn: () => employeesService.getEmployees(scheduleId),
    enabled: !!scheduleId,
  });

  // Загрузка должностей
  const { data: positions } = useQuery({
    queryKey: ['positions', scheduleId],
    queryFn: () => positionsService.getPositions(scheduleId),
    enabled: !!scheduleId,
  });

  // Создание сотрудника
  const createMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      tabNumber: string;
      positionId?: string;
      birthDate?: string;
      departmentId: string;
    }) => employeesService.createEmployee(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setIsCreateModalOpen(false);
    },
  });

  // Обновление сотрудника
  const updateMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      tabNumber: string;
      positionId?: string;
      birthDate?: string;
      departmentId: string;
    }) => {
      if (!editingEmployeeId) throw new Error('No employee selected');
      return employeesService.updateEmployee(scheduleId, editingEmployeeId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setEditingEmployeeId(null);
    },
  });

  // Удаление сотрудника
  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => employeesService.deleteEmployee(scheduleId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    },
  });

  // Генерация пароля
  const generatePasswordMutation = useMutation({
    mutationFn: (employeeId: string) =>
      employeesService.generatePassword(scheduleId, employeeId),
    onSuccess: (data) => {
      alert(`Пароль сгенерирован: ${data.password}`);
    },
  });

  const handleDelete = (employeeId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
      deleteMutation.mutate(employeeId);
    }
  };

  const sidebarItems = [
    {
      id: 'schedule',
      label: 'Расписание',
      icon: SidebarIcons.Calendar,
      path: `/schedule/${scheduleId}`,
    },
    {
      id: 'employees',
      label: 'Сотрудники',
      icon: SidebarIcons.Users,
      path: `/schedule/${scheduleId}/employees`,
    },
    {
      id: 'vacations',
      label: 'Отпуска',
      icon: SidebarIcons.Vacation,
      path: `/schedule/${scheduleId}/vacations`,
    },
  ];

  return (
    <MainLayout sidebarItems={sidebarItems}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Сотрудники</h1>
          <Button onClick={() => setIsCreateModalOpen(true)}>+ Добавить сотрудника</Button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {employees && employees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employees.map((employee) => (
              <Card key={employee.id} hover className="p-4">
                <div className="mb-3">
                  <h3 className="text-lg font-semibold">{employee.fullName}</h3>
                  <p className="text-sm text-gray-600">Табельный №: {employee.tabNumber}</p>
                  {employee.position && (
                    <p className="text-sm text-gray-600 font-medium">{employee.position.name}</p>
                  )}
                  {employee.department && (
                    <p className="text-sm text-gray-500">{employee.department.name}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditingEmployeeId(employee.id)}
                  >
                    Редактировать
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generatePasswordMutation.mutate(employee.id)}
                  >
                    Пароль
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(employee.id)}
                  >
                    Удалить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {employees && employees.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-gray-500 mb-4">Нет сотрудников в этом расписании</p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Добавить первого сотрудника
            </Button>
          </Card>
        )}

        {/* Модальное окно создания сотрудника */}
        <EditEmployeeModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={(data) => createMutation.mutateAsync(data)}
          employee={null}
          departments={schedule?.departments || []}
          positions={positions || []}
          scheduleId={scheduleId}
          isLoading={createMutation.isPending}
        />

        {/* Модальное окно редактирования сотрудника */}
        <EditEmployeeModal
          isOpen={!!editingEmployeeId}
          onClose={() => setEditingEmployeeId(null)}
          onSave={(data) => updateMutation.mutateAsync(data)}
          employee={editingEmployeeId ? employees?.find(e => e.id === editingEmployeeId) : null}
          departments={schedule?.departments || []}
          positions={positions || []}
          scheduleId={scheduleId}
          isLoading={updateMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
