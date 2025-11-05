import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Card, Badge, Spinner, Modal, Input } from '@components/common';
import { schedulesService } from '@services/api';
import { Schedule, ScheduleStatus } from '@types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Страница со списком всех схем планирования
 */
export default function SchedulesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newScheduleName, setNewScheduleName] = useState('');
  const [newScheduleStart, setNewScheduleStart] = useState('');
  const [newScheduleEnd, setNewScheduleEnd] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  // Загрузка списка расписаний
  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesService.getSchedules(),
  });

  // Создание нового расписания
  const createMutation = useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) =>
      schedulesService.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setIsCreateModalOpen(false);
      setNewScheduleName('');
      setNewScheduleStart('');
      setNewScheduleEnd('');
      setCreateError(null);
    },
    onError: (error: Error) => {
      setCreateError(error.message || 'Ошибка создания расписания');
    },
  });

  // Удаление расписания
  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesService.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  // Дублирование расписания
  const duplicateMutation = useMutation({
    mutationFn: (id: string) => schedulesService.duplicateSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });

  const handleCreate = () => {
    if (!newScheduleName || !newScheduleStart || !newScheduleEnd) return;
    createMutation.mutate({
      name: newScheduleName,
      startDate: newScheduleStart,
      endDate: newScheduleEnd,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить это расписание?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id);
  };

  const getStatusBadge = (status: ScheduleStatus) => {
    const variants = {
      draft: 'default',
      published: 'success',
      completed: 'info',
      archived: 'default',
    } as const;

    const labels = {
      draft: 'Черновик',
      published: 'Опубликовано',
      completed: 'Завершено',
      archived: 'Архив',
    };

    return (
      <Badge variant={variants[status] as any}>{labels[status]}</Badge>
    );
  };

  const sidebarItems = [
    {
      id: 'schedules',
      label: 'Расписания',
      icon: SidebarIcons.Calendar,
      path: '/',
    },
  ];

  return (
    <MainLayout sidebarItems={sidebarItems}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Схемы планирования</h1>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            + Создать расписание
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-red-800">Ошибка загрузки расписаний</p>
          </Card>
        )}

        {schedules && schedules.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-gray-500 mb-4">Нет созданных расписаний</p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Создать первое расписание
            </Button>
          </Card>
        )}

        {schedules && schedules.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {schedules.map((schedule) => (
              <Card key={schedule.id} hover className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold">{schedule.name}</h3>
                  {getStatusBadge(schedule.status)}
                </div>
                <div className="space-y-2 mb-4 text-sm text-gray-600">
                  <p>
                    <strong>Период:</strong>{' '}
                    {format(new Date(schedule.startDate), 'dd.MM.yyyy', { locale: ru })} -{' '}
                    {format(new Date(schedule.endDate), 'dd.MM.yyyy', { locale: ru })}
                  </p>
                  <p>
                    <strong>Создано:</strong>{' '}
                    {format(new Date(schedule.createdAt), 'dd.MM.yyyy', { locale: ru })}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="primary"
                    fullWidth
                    onClick={() => navigate(`/schedule/${schedule.id}`)}
                  >
                    Открыть
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDuplicate(schedule.id)}
                  >
                    Копировать
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    Удалить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Модальное окно создания */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setCreateError(null);
          }}
          title="Создать новое расписание"
        >
          <div className="space-y-4">
            {createError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{createError}</p>
              </div>
            )}
            <Input
              label="Название расписания"
              value={newScheduleName}
              onChange={(e) => setNewScheduleName(e.target.value)}
              placeholder="Например: Январь 2024"
            />
            <Input
              label="Дата начала"
              type="date"
              value={newScheduleStart}
              onChange={(e) => setNewScheduleStart(e.target.value)}
            />
            <Input
              label="Дата окончания"
              type="date"
              value={newScheduleEnd}
              onChange={(e) => setNewScheduleEnd(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setCreateError(null);
                }}
              >
                Отмена
              </Button>
              <Button
                onClick={handleCreate}
                isLoading={createMutation.isPending}
                disabled={!newScheduleName || !newScheduleStart || !newScheduleEnd}
              >
                Создать
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
