import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import {
  Button,
  Card,
  Spinner,
  Modal,
  Select,
  Badge,
} from '@components/common';
import { permissionsService, schedulesService } from '@services/api';
import { SchedulePermission, UserRole } from '@types';
import { Avatar } from '@components/common';

/**
 * Страница управления правами доступа
 */
export default function PermissionsManager() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<SchedulePermission | null>(null);

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка прав доступа
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['permissions', scheduleId],
    queryFn: () => permissionsService.getPermissions(scheduleId),
    enabled: !!scheduleId,
  });

  // Загрузка расписания для получения информации о владельце
  const { data: schedule } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedulesService.getScheduleById(scheduleId),
    enabled: !!scheduleId,
  });

  // Обновление роли
  const updateMutation = useMutation({
    mutationFn: ({ permissionId, role }: { permissionId: string; role: UserRole }) =>
      permissionsService.updatePermission(scheduleId, permissionId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', scheduleId] });
      setIsEditModalOpen(false);
      setSelectedPermission(null);
    },
  });

  // Удаление права доступа
  const deleteMutation = useMutation({
    mutationFn: (permissionId: string) =>
      permissionsService.deletePermission(scheduleId, permissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', scheduleId] });
    },
  });

  const getRoleLabel = (role: UserRole): string => {
    const labels = {
      owner: 'Владелец',
      editor: 'Редактор',
      viewer: 'Просмотр',
    };
    return labels[role] || role;
  };

  const getRoleVariant = (role: UserRole): 'success' | 'warning' | 'info' | 'default' => {
    const variants = {
      owner: 'success' as const,
      editor: 'warning' as const,
      viewer: 'info' as const,
    };
    return variants[role] || 'default';
  };

  const handleEdit = (permission: SchedulePermission) => {
    setSelectedPermission(permission);
    setIsEditModalOpen(true);
  };

  const handleDelete = (permissionId: string) => {
    if (window.confirm('Вы уверены, что хотите удалить это право доступа?')) {
      deleteMutation.mutate(permissionId);
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
      id: 'users',
      label: 'Права доступа',
      icon: SidebarIcons.Settings,
      path: `/schedule/${scheduleId}/users`,
    },
  ];

  return (
    <MainLayout sidebarItems={sidebarItems}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Управление правами доступа</h1>
            <p className="text-gray-600 mt-1">
              Управление пользователями с доступом к этому расписанию
            </p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={() => setIsAddModalOpen(true)}>
              + Добавить пользователя
            </Button>
            <Button onClick={() => navigate(`/schedule/${scheduleId}`)} variant="outline">
              Назад к расписанию
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {permissions && permissions.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-gray-500 mb-4">
              Нет пользователей с доступом (кроме владельца)
            </p>
            <Button onClick={() => setIsAddModalOpen(true)}>
              Добавить первого пользователя
            </Button>
          </Card>
        )}

        {permissions && permissions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {permissions.map((permission) => (
              <Card key={permission.id} hover className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Avatar name={permission.user?.email || ''} size="sm" />
                    <div>
                      <div className="font-medium">
                        {permission.user?.email || 'Неизвестный пользователь'}
                      </div>
                      <Badge variant={getRoleVariant(permission.role)}>
                        {getRoleLabel(permission.role)}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mb-3">
                  Добавлен: {format(new Date(permission.createdAt), 'dd.MM.yyyy', { locale: ru })}
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(permission)}
                    disabled={permission.role === 'owner'}
                  >
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(permission.id)}
                    disabled={permission.role === 'owner'}
                  >
                    Удалить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Модальное окно редактирования роли */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedPermission(null);
          }}
          title="Изменить роль пользователя"
        >
          {selectedPermission && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm">
                  <strong>Пользователь:</strong> {selectedPermission.user?.email}
                </p>
              </div>
              <Select
                label="Роль"
                value={selectedPermission.role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  updateMutation.mutate({
                    permissionId: selectedPermission.id,
                    role: newRole,
                  });
                }}
                options={[
                  { value: 'viewer', label: 'Просмотр (только чтение)' },
                  { value: 'editor', label: 'Редактор (чтение и редактирование)' },
                  { value: 'owner', label: 'Владелец (полный доступ)' },
                ]}
                disabled={updateMutation.isPending}
              />
            </div>
          )}
        </Modal>

        {/* Модальное окно добавления пользователя */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          title="Добавить пользователя"
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Для добавления пользователя необходимо знать его email и ID пользователя.
              Эта функциональность требует дополнительной интеграции с системой управления
              пользователями.
            </p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
