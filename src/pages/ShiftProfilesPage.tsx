import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Card, Spinner } from '@components/common';
import { ShiftProfilesTable } from '@components/shifts/ShiftProfilesTable';
import { GenerateShiftsModal } from '@components/shifts/GenerateShiftsModal';
import { CreatePlaceholdersModal } from '@components/shifts/CreatePlaceholdersModal';
import { EditShiftProfileModal } from '@components/shifts/EditShiftProfileModal';
import { CompareProfilesModal } from '@components/shifts/CompareProfilesModal';
import { ImportExportProfilesModal } from '@components/shifts/ImportExportProfilesModal';
import { shiftProfilesService, schedulesService, employeesService } from '@services/api';
import { ShiftProfile, EditShiftProfileData } from '@types';
import { Plus, ArrowLeft, GitCompare, X, Upload } from 'lucide-react';

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
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка профилей смен
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['shift-profiles', scheduleId],
    queryFn: () => shiftProfilesService.getShiftProfiles(scheduleId),
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

  // Порядок сотрудников как на странице расписания (DnD сохраняется в localStorage)
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);

  useEffect(() => {
    if (employees && employees.length > 0 && scheduleId) {
      setEmployeeOrder(prev => {
        // Попытка восстановить сохраненный порядок
        const savedOrder = localStorage.getItem(`employeeOrder_${scheduleId}`);
        if (savedOrder) {
          try {
            const parsedOrder: unknown = JSON.parse(savedOrder);
            if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
              const employeeIds = new Set(employees.map(emp => emp.id));
              const validOrder = parsedOrder.filter((id: string) => employeeIds.has(id));
              const newIds = employees
                .filter(emp => !validOrder.includes(emp.id))
                .map(emp => emp.id);
              return newIds.length > 0 ? [...validOrder, ...newIds] : validOrder;
            }
          } catch (error) {
            console.error('Error parsing saved employee order:', error);
          }
        }
        // Если нет сохраненного порядка — порядок как в текущем списке
        return employees.map(emp => emp.id);
      });
    }
  }, [employees, scheduleId]);

  // Сортированные сотрудники по сохраненному порядку (исключая скрытых)
  const sortedEmployees = useMemo(() => {
    if (!employees || employeeOrder.length === 0) {
      // Фильтруем скрытых сотрудников
      return employees?.filter(emp => !emp.isHidden) || [];
    }
    const orderMap = new Map(employeeOrder.map((id, index) => [id, index]));
    // Фильтруем скрытых сотрудников перед сортировкой
    const visibleEmployees = employees.filter(emp => !emp.isHidden);
    const sorted = [...visibleEmployees].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity;
      const bIndex = orderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });
    const newEmployees = visibleEmployees.filter(emp => !orderMap.has(emp.id));
    return [...sorted, ...newEmployees];
  }, [employees, employeeOrder]);

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
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles'] });
      await queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      
      // Принудительно обновляем данные смен перед переходом на страницу расписания
      await queryClient.refetchQueries({ queryKey: ['shifts', scheduleId] });
      await queryClient.refetchQueries({ queryKey: ['patternInstances', scheduleId] });
      await queryClient.refetchQueries({ queryKey: ['schedule', scheduleId] });
      
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
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles', scheduleId] });
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
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles', scheduleId] });
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

  const handleSaveProfile = async (data: EditShiftProfileData, options?: { silent?: boolean }) => {
    if (options?.silent) {
      if (!editingProfileId) return;
      try {
        await shiftProfilesService.updateShiftProfile(editingProfileId, data);
        await queryClient.invalidateQueries({ queryKey: ['shift-profiles', scheduleId] });
      } catch (error: any) {
        console.error('Ошибка тихого сохранения профиля:', error);
      }
      return;
    }

    if (isCreatingProfile) {
      await createProfileMutation.mutateAsync(data);
    } else {
      await updateProfileMutation.mutateAsync(data);
    }
  };

  // Удаление профиля
  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => shiftProfilesService.deleteShiftProfile(id, scheduleId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles', scheduleId] });
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
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles', scheduleId] });
      alert('Профиль успешно клонирован!');
    },
    onError: (error: any) => {
      alert(`Ошибка клонирования: ${error.message || 'Неизвестная ошибка'}`);
    },
  });

  // Импорт профилей смен
  const importMutation = useMutation({
    mutationFn: ({ file, mode, selectedIndices }: { file: File; mode: 'create' | 'update' | 'mixed'; selectedIndices?: number[] }) =>
      shiftProfilesService.importShiftProfiles(scheduleId, file, mode, selectedIndices),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift-profiles', scheduleId] });
    },
  });

  // Экспорт профилей смен
  const exportMutation = useMutation({
    mutationFn: ({ format, profileIds }: { format: 'json'; profileIds?: string[] }) => 
      shiftProfilesService.exportShiftProfiles(scheduleId, format, profileIds),
  });

  const handleImport = async (file: File, mode: 'create' | 'update' | 'mixed', selectedIndices?: number[]) => {
    return importMutation.mutateAsync({ file, mode, selectedIndices });
  };

  const handleExport = async (format: 'json', profileIds?: string[]) => {
    return exportMutation.mutateAsync({ format, profileIds });
  };

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
          <div className="flex items-center gap-1">
            {!comparisonMode && (
              <>
                <button
                  onClick={handleCreateNew}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary bg-primary text-white hover:bg-primary/90 transition-colors"
                  title="Создать профиль"
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setIsImportExportModalOpen(true)} 
                  className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                  title="Импорт / Экспорт профилей"
                >
                  <Upload className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setComparisonMode(true)} 
                  className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                  title="Сравнить профили"
                >
                  <GitCompare className="h-5 w-5" />
                </button>
              </>
            )}
            {comparisonMode && (
              <>
                <button
                  onClick={() => setIsCompareModalOpen(true)}
                  disabled={selectedProfileIds.length < 2}
                  className={`h-9 w-9 flex items-center justify-center rounded-lg border-2 transition-colors ${
                    selectedProfileIds.length < 2
                      ? 'border-gray-300 text-gray-400 cursor-not-allowed'
                      : 'border-primary bg-primary text-white hover:bg-primary/90'
                  }`}
                  title="Сравнить выбранные профили"
                >
                  <GitCompare className="h-5 w-5" />
                </button>
                <button
                  onClick={() => {
                    setComparisonMode(false);
                    setSelectedProfileIds([]);
                  }}
                  className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                  title="Отменить режим сравнения"
                >
                  <X className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              onClick={() => navigate(`/schedule/${scheduleId}`)} 
              className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
              title="Назад к расписанию"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
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
              employees={sortedEmployees}
              scheduleStartDate={new Date(schedule.startDate)}
              scheduleEndDate={new Date(schedule.endDate)}
            />
            <EditShiftProfileModal
              isOpen={!!editingProfileId || isCreatingProfile}
              onClose={() => {
                setEditingProfileId(null);
                setIsCreatingProfile(false);
              }}
              scheduleId={scheduleId}
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
              selectedProfiles={profiles?.filter((profile) => selectedProfileIds.includes(profile.id)) || []}
              scheduleStartDate={new Date(schedule.startDate)}
              scheduleEndDate={new Date(schedule.endDate)}
            />
            <ImportExportProfilesModal
              isOpen={isImportExportModalOpen}
              onClose={() => setIsImportExportModalOpen(false)}
              onImport={handleImport}
              onExport={handleExport}
              scheduleId={scheduleId}
              profiles={profiles?.map(p => ({ id: p.id, name: p.name })) || []}
              isLoading={importMutation.isPending || exportMutation.isPending}
            />
          </>
        )}
      </div>
    </MainLayout>
  );
}

