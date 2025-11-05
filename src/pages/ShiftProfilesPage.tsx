import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Card, Spinner } from '@components/common';
import { ShiftProfilesTable } from '@components/shifts/ShiftProfilesTable';
import { GenerateShiftsModal } from '@components/shifts/GenerateShiftsModal';
import { CreatePlaceholdersModal } from '@components/shifts/CreatePlaceholdersModal';
import { EditShiftProfileModal } from '@components/shifts/EditShiftProfileModal';
import { CompareProfilesModal } from '@components/shifts/CompareProfilesModal';
import { shiftProfilesService, schedulesService, employeesService } from '@services/api';
import { ShiftProfile, EditShiftProfileData } from '@types';
import { Plus, ArrowLeft, GitCompare, X } from 'lucide-react';

/**
 * Страница работы с профилями смен
 */
export default function ShiftProfilesPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string>();
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [isPlaceholdersModalOpen, setIsPlaceholdersModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка профилей смен
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['shift-profiles'],
    queryFn: () => shiftProfilesService.getShiftProfiles(),
  });

  // Загрузка расписания
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedulesService.getScheduleById(scheduleId),
    enabled: !!scheduleId,
  });

  // Загрузка сотрудников
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', scheduleId],
    queryFn: () => employeesService.getEmployees(scheduleId),
    enabled: !!scheduleId,
  });

  // Генерация смен
  const generateMutation = useMutation({
    mutationFn: (data: {
      shiftProfileId: string;
      employeeIds: string[];
      startDate: string;
      endDate: string;
    }) => shiftProfilesService.generateShifts(scheduleId, data),
    onSuccess: async () => {
      setIsGenerateModalOpen(false);
      alert('Смены успешно сгенерированы!');
      
      // Инвалидируем все связанные кэши
      await queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      await queryClient.invalidateQueries({ queryKey: ['shiftProfiles'] });
      await queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      
      // Даем небольшую задержку для завершения инвалидации
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Редиректим на страницу расписания для просмотра результатов
      navigate(`/schedule/${scheduleId}`);
    },
    onError: (error: any) => {
      alert(`Ошибка генерации: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  // Создание болванчиков
  const createPlaceholdersMutation = useMutation({
    mutationFn: (data: { count: number; departmentId: string }) =>
      employeesService.createPlaceholders(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    },
    onError: (error: any) => {
      alert(`Ошибка создания болванчиков: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  const handleCreatePlaceholders = async (count: number, departmentId?: string | null) => {
    try {
      const createdEmployees = await createPlaceholdersMutation.mutateAsync({ count, departmentId });
      // Обновляем список сотрудников после создания
      await queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      // Ждем обновления данных перед открытием модального окна генерации
      await queryClient.refetchQueries({ queryKey: ['employees', scheduleId] });
      // Закрываем модальное окно создания болванчиков
      setIsPlaceholdersModalOpen(false);
      // После создания болванчиков открываем модальное окно генерации
      setIsGenerateModalOpen(true);
      return createdEmployees;
    } catch (error) {
      // Ошибка уже обработана в onError мутации
      throw error;
    }
  };

  const handleGenerate = (profileId: string) => {
    setSelectedProfileId(profileId);
    const profile = profiles?.find((p) => p.id === profileId);
    
    // Проверяем количество сотрудников
    if (profile && employees && employees.length < profile.minEmployees) {
      // Недостаточно сотрудников - показываем модальное окно создания болванчиков
      setIsPlaceholdersModalOpen(true);
    } else {
      // Достаточно сотрудников - открываем модальное окно генерации
      setIsGenerateModalOpen(true);
    }
  };

  const handleGenerateSubmit = (data: {
    shiftProfileId: string;
    employeeIds: string[];
    startDate: string;
    endDate: string;
  }) => {
    generateMutation.mutate(data);
  };

  // Создание профиля
  const createProfileMutation = useMutation({
    mutationFn: (data: EditShiftProfileData) => shiftProfilesService.createShiftProfile(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles'] });
      setIsCreatingProfile(false);
      alert('Профиль успешно создан!');
    },
    onError: (error: any) => {
      alert(`Ошибка создания: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  // Обновление профиля
  const updateProfileMutation = useMutation({
    mutationFn: (data: EditShiftProfileData) => {
      if (!editingProfileId) {
        throw new Error('Profile ID not set');
      }
      return shiftProfilesService.updateShiftProfile(editingProfileId, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles'] });
      setEditingProfileId(null);
      alert('Профиль успешно обновлен!');
    },
    onError: (error: any) => {
      alert(`Ошибка обновления: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  const handleEdit = (profileId: string) => {
    setEditingProfileId(profileId);
    setIsCreatingProfile(false);
  };

  const handleCreateNew = () => {
    setIsCreatingProfile(true);
    setEditingProfileId(null);
  };

  const handleSaveProfile = async (data: EditShiftProfileData) => {
    if (isCreatingProfile) {
      await createProfileMutation.mutateAsync(data);
    } else {
      await updateProfileMutation.mutateAsync(data);
    }
  };

  // Удаление профиля
  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => shiftProfilesService.deleteShiftProfile(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles'] });
      alert('Профиль успешно удален!');
    },
    onError: (error: any) => {
      alert(`Ошибка удаления: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  // Клонирование профиля
  const cloneProfileMutation = useMutation({
    mutationFn: (id: string) => shiftProfilesService.cloneShiftProfile(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles'] });
      alert('Профиль успешно клонирован!');
    },
    onError: (error: any) => {
      alert(`Ошибка клонирования: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  const handleDelete = (profileId: string) => {
    const profile = profiles?.find((p) => p.id === profileId);
    if (!profile) return;

    const confirmMessage = `Вы уверены, что хотите удалить профиль "${profile.name}"?\n\nВнимание: Если профиль используется в расписаниях, удаление будет невозможно.`;
    
    if (window.confirm(confirmMessage)) {
      deleteProfileMutation.mutate(profileId);
    }
  };

  const handleClone = (profileId: string) => {
    const profile = profiles?.find((p) => p.id === profileId);
    if (!profile) return;

    if (window.confirm(`Клонировать профиль "${profile.name}"?`)) {
      cloneProfileMutation.mutate(profileId);
    }
  };

  const selectedProfile = profiles?.find((p) => p.id === selectedProfileId);
  const editingProfile = profiles?.find((p) => p.id === editingProfileId);

  const isLoading = profilesLoading || scheduleLoading || employeesLoading;

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
      id: 'profiles',
      label: 'Профили смен',
      icon: SidebarIcons.Calendar,
      path: `/schedule/${scheduleId}/profiles`,
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
          <div>
            <h1 className="text-3xl font-bold">Профили смен</h1>
            <p className="text-gray-600 mt-1">
              Выберите профиль для генерации расписания смен или создайте новый
            </p>
          </div>
          <div className="flex gap-2">
            {!comparisonMode && (
              <>
                <Button onClick={handleCreateNew} variant="primary" title="Создать профиль">
                  <Plus size={18} className="mr-1" />
                  Создать профиль
                </Button>
                <Button 
                  onClick={() => setComparisonMode(true)} 
                  variant="outline"
                  title="Сравнить профили"
                >
                  <GitCompare size={18} className="mr-1" />
                  Сравнить профили
                </Button>
              </>
            )}
            {comparisonMode && (
              <>
                <Button
                  onClick={() => setIsCompareModalOpen(true)}
                  variant="primary"
                  disabled={selectedProfileIds.length < 2}
                  title="Сравнить выбранные профили"
                >
                  <GitCompare size={18} className="mr-1" />
                  Сравнить ({selectedProfileIds.length})
                </Button>
                <Button
                  onClick={() => {
                    setComparisonMode(false);
                    setSelectedProfileIds([]);
                  }}
                  variant="outline"
                  title="Отменить режим сравнения"
                >
                  <X size={18} className="mr-1" />
                  Отмена
                </Button>
              </>
            )}
            <Button 
              onClick={() => navigate(`/schedule/${scheduleId}`)} 
              variant="outline"
              title="Назад к расписанию"
            >
              <ArrowLeft size={18} className="mr-1" />
              Назад к расписанию
            </Button>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {profiles && profiles.length > 0 && !isLoading && (
          <ShiftProfilesTable
            profiles={profiles}
            selectedProfileId={selectedProfileId}
            onSelectProfile={setSelectedProfileId}
            onGenerate={handleGenerate}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onClone={handleClone}
            comparisonMode={comparisonMode}
            selectedProfileIds={selectedProfileIds}
            onToggleProfileSelection={(id) => {
              setSelectedProfileIds((prev) =>
                prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
              );
            }}
          />
        )}

        {profiles && profiles.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-gray-500">Нет доступных профилей смен</p>
          </Card>
        )}

        {schedule && employees && (
          <>
            <CreatePlaceholdersModal
              isOpen={isPlaceholdersModalOpen}
              onClose={() => setIsPlaceholdersModalOpen(false)}
              onCreate={handleCreatePlaceholders}
              isLoading={createPlaceholdersMutation.isPending}
              profile={selectedProfile || null}
              currentEmployeeCount={employees.length}
              departments={schedule.departments}
            />
            <GenerateShiftsModal
              isOpen={isGenerateModalOpen}
              onClose={() => setIsGenerateModalOpen(false)}
              onGenerate={handleGenerateSubmit}
              isLoading={generateMutation.isPending}
              profile={selectedProfile || null}
              employees={employees}
              scheduleStartDate={new Date(schedule.startDate)}
              scheduleEndDate={new Date(schedule.endDate)}
            />
            <EditShiftProfileModal
              isOpen={!!editingProfileId || isCreatingProfile}
              onClose={() => {
                setEditingProfileId(null);
                setIsCreatingProfile(false);
              }}
              profile={editingProfile || null}
              onSave={handleSaveProfile}
              isLoading={
                isCreatingProfile
                  ? createProfileMutation.isPending
                  : updateProfileMutation.isPending
              }
            />
            <CompareProfilesModal
              isOpen={isCompareModalOpen}
              onClose={() => setIsCompareModalOpen(false)}
              selectedProfileIds={selectedProfileIds}
              scheduleStartDate={new Date(schedule.startDate)}
              scheduleEndDate={new Date(schedule.endDate)}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}

