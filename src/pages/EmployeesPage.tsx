import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import {
  Button,
  Card,
  Spinner,
  Modal,
  Input,
  Select,
} from '@components/common';
import { employeesService, schedulesService } from '@services/api';
import { Employee } from '@types';

/**
 * Страница управления сотрудниками
 */
export default function EmployeesPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  // Создание сотрудника
  const createMutation = useMutation({
    mutationFn: (data: {
      fullName: string;
      tabNumber: string;
      birthDate?: string;
      departmentId: string;
    }) => employeesService.createEmployee(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setIsCreateModalOpen(false);
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
                  {employee.department && (
                    <p className="text-sm text-gray-500">{employee.department.name}</p>
                  )}
                </div>
                <div className="flex space-x-2">
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
        <EmployeeFormModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
          departments={schedule?.departments || []}
        />
      </div>
    </MainLayout>
  );
}

interface EmployeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    fullName: string;
    tabNumber: string;
    birthDate?: string;
    departmentId: string;
  }) => void;
  isLoading: boolean;
  departments: Array<{ id: string; name: string }>;
}

function EmployeeFormModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  departments,
}: EmployeeFormModalProps) {
  const [fullName, setFullName] = useState('');
  const [tabNumber, setTabNumber] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      fullName,
      tabNumber,
      birthDate: birthDate || undefined,
      departmentId,
    });
    // Сброс формы
    setFullName('');
    setTabNumber('');
    setBirthDate('');
    setDepartmentId('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Добавить сотрудника">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="ФИО"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          placeholder="Иванов Иван Иванович"
        />
        <Input
          label="Табельный номер"
          value={tabNumber}
          onChange={(e) => setTabNumber(e.target.value)}
          required
          placeholder="12345"
        />
        <Input
          label="Дата рождения"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
        />
        <Select
          label="Отдел"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value)}
          required
          options={departments.map((dept) => ({
            value: dept.id,
            label: dept.name,
          }))}
          placeholder="Выберите отдел"
        />
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Добавить
          </Button>
        </div>
      </form>
    </Modal>
  );
}
