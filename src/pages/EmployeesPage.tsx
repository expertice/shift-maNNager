import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Card, Spinner } from '@components/common';
import { EditEmployeeModal, BulkEditModal, ImportExportModal, EmployeeRowView } from '@components/employees';
import { employeesService, schedulesService, positionsService } from '@services/api';
import { Employee } from '@types';
import { Grid3x3, List, Eye, EyeOff } from 'lucide-react';

/**
 * Страница управления сотрудниками
 */
export default function EmployeesPage() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  
  // Загружаем режим отображения из localStorage
  const getInitialViewMode = (): 'tiles' | 'rows' => {
    try {
      const stored = localStorage.getItem('employeeViewMode');
      if (stored === 'tiles' || stored === 'rows') {
        return stored;
      }
    } catch {
      // Игнорируем ошибки
    }
    return 'tiles';
  };
  
  const [viewMode, setViewMode] = useState<'tiles' | 'rows'>(getInitialViewMode);
  const [showHidden, setShowHidden] = useState(false);
  
  // Сохраняем режим отображения в localStorage при изменении
  useEffect(() => {
    try {
      localStorage.setItem('employeeViewMode', viewMode);
    } catch {
      // Игнорируем ошибки сохранения
    }
  }, [viewMode]);

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
      isHidden?: boolean;
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
      isHidden?: boolean;
    }) => {
      if (!editingEmployeeId) throw new Error('No employee selected');
      return employeesService.updateEmployee(scheduleId, editingEmployeeId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setEditingEmployeeId(null);
    },
  });

  // Обновление видимости сотрудника
  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ employeeId, isHidden }: { employeeId: string; isHidden: boolean }) =>
      employeesService.updateEmployee(scheduleId, employeeId, { isHidden }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    },
  });

  // Удаление сотрудника
  const deleteMutation = useMutation({
    mutationFn: (employeeId: string) => employeesService.deleteEmployee(scheduleId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    },
  });

  // Массовое обновление сотрудников
  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { employeeIds: string[]; departmentId?: string; positionId?: string }) =>
      employeesService.bulkUpdateEmployees(scheduleId, data.employeeIds, {
        departmentId: data.departmentId,
        positionId: data.positionId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setIsBulkEditModalOpen(false);
      setSelectedEmployeeIds(new Set());
      setIsSelectionMode(false);
    },
  });

  // Массовое удаление сотрудников
  const bulkDeleteMutation = useMutation({
    mutationFn: (employeeIds: string[]) =>
      employeesService.bulkDeleteEmployees(scheduleId, employeeIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setSelectedEmployeeIds(new Set());
      setIsSelectionMode(false);
    },
  });

  // Импорт сотрудников
  const importMutation = useMutation({
    mutationFn: ({ file, mode }: { file: File; mode: 'create' | 'update' | 'mixed' }) =>
      employeesService.importEmployees(scheduleId, file, mode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    },
  });

  // Экспорт сотрудников
  const exportMutation = useMutation({
    mutationFn: (format: 'csv' | 'xlsx') => employeesService.exportEmployees(scheduleId, format),
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

  const handleToggleSelection = (employeeId: string) => {
    const newSelected = new Set(selectedEmployeeIds);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedEmployeeIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedEmployeeIds.size === employees?.length) {
      setSelectedEmployeeIds(new Set());
    } else {
      setSelectedEmployeeIds(new Set(employees?.map(e => e.id) || []));
    }
  };

  const handleBulkEdit = () => {
    if (selectedEmployeeIds.size > 0) {
      setIsBulkEditModalOpen(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedEmployeeIds.size === 0) return;
    const count = selectedEmployeeIds.size;
    if (window.confirm(`Вы уверены, что хотите удалить ${count} сотрудников?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedEmployeeIds));
    }
  };

  const handleBulkSave = async (data: { departmentId?: string; positionId?: string }) => {
    await bulkUpdateMutation.mutateAsync({
      employeeIds: Array.from(selectedEmployeeIds),
      ...data,
    });
  };

  const handleImport = async (file: File, mode: 'create' | 'update' | 'mixed') => {
    return importMutation.mutateAsync({ file, mode });
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    return exportMutation.mutateAsync(format);
  };

  const handleToggleVisibility = (employeeId: string, isHidden: boolean) => {
    toggleVisibilityMutation.mutate({ employeeId, isHidden });
  };

  // Фильтрация сотрудников
  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    const filtered = showHidden ? employees : employees.filter((emp) => !emp.isHidden);
    // Сортируем скрытых сотрудников по ФИО
    if (showHidden) {
      return [...filtered].sort((a, b) => {
        // Сначала видимые, потом скрытые, внутри каждой группы - по ФИО
        if (a.isHidden !== b.isHidden) {
          return a.isHidden ? 1 : -1;
        }
        return a.fullName.localeCompare(b.fullName, 'ru');
      });
    }
    return filtered;
  }, [employees, showHidden]);

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-1">
              <button
                onClick={() => setViewMode('tiles')}
                className={`p-2 rounded ${viewMode === 'tiles' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Плитки"
              >
                <Grid3x3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('rows')}
                className={`p-2 rounded ${viewMode === 'rows' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'}`}
                title="Строки"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`flex items-center gap-2 px-3 py-2 rounded border ${
                showHidden ? 'bg-gray-100 border-gray-300' : 'border-gray-300 hover:bg-gray-50'
              }`}
              title={showHidden ? 'Скрыть скрытых сотрудников' : 'Показать скрытых сотрудников'}
            >
              {showHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              <span className="text-sm">Скрытые</span>
            </button>
            <Button
              variant={isSelectionMode ? 'secondary' : 'outline'}
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                setSelectedEmployeeIds(new Set());
              }}
            >
              {isSelectionMode ? 'Отменить выбор' : 'Выбрать'}
            </Button>
            <Button variant="outline" onClick={() => setIsImportExportModalOpen(true)}>
              Импорт/Экспорт
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>+ Добавить сотрудника</Button>
          </div>
        </div>

        {isSelectionMode && selectedEmployeeIds.size > 0 && (
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900">
                Выбрано: {selectedEmployeeIds.size} сотрудников
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleBulkEdit}>
                  Массовое редактирование
                </Button>
                <Button size="sm" variant="danger" onClick={handleBulkDelete}>
                  Массовое удаление
                </Button>
              </div>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {filteredEmployees && filteredEmployees.length > 0 && (
          <div className="mb-4">
            {isSelectionMode && (
              <div className="mb-3">
                <Button size="sm" variant="outline" onClick={handleSelectAll}>
                  {selectedEmployeeIds.size === filteredEmployees.length ? 'Снять выделение' : 'Выбрать все'}
                </Button>
              </div>
            )}
            {viewMode === 'tiles' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEmployees.map((employee) => {
                  const isHidden = employee.isHidden || false;
                  return (
                    <Card
                      key={employee.id}
                      hover={!isSelectionMode}
                      className={`p-4 ${isSelectionMode && selectedEmployeeIds.has(employee.id) ? 'ring-2 ring-primary' : ''} ${isHidden ? 'opacity-60 bg-gray-50' : ''}`}
                    >
                      {isSelectionMode && (
                        <div className="mb-2">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.has(employee.id)}
                            onChange={() => handleToggleSelection(employee.id)}
                            className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                          />
                        </div>
                      )}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold">{employee.fullName}</h3>
                          {isHidden && (
                            <EyeOff className="h-4 w-4 text-gray-400" title="Скрыт из ростера" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600">Табельный №: {employee.tabNumber}</p>
                        {employee.position && (
                          <p className="text-sm text-gray-600 font-medium">{employee.position.name}</p>
                        )}
                        {employee.department && (
                          <p className="text-sm text-gray-500">{employee.department.name}</p>
                        )}
                      </div>
                      {!isSelectionMode && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleVisibility(employee.id, !isHidden)}
                              className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                              title={isHidden ? 'Показать в ростере' : 'Скрыть из ростера'}
                            >
                              {isHidden ? (
                                <>
                                  <EyeOff className="h-4 w-4 mr-1" />
                                  <span>Показать</span>
                                </>
                              ) : (
                                <>
                                  <Eye className="h-4 w-4 mr-1" />
                                  <span>Скрыть</span>
                                </>
                              )}
                            </button>
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
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmployeeRowView
                employees={filteredEmployees}
                isSelectionMode={isSelectionMode}
                selectedEmployeeIds={selectedEmployeeIds}
                onToggleSelection={handleToggleSelection}
                onEdit={(id) => setEditingEmployeeId(id)}
                onGeneratePassword={(id) => generatePasswordMutation.mutate(id)}
                onDelete={handleDelete}
                onToggleVisibility={handleToggleVisibility}
                showHidden={showHidden}
              />
            )}
          </div>
        )}

        {(!employees || employees.length === 0) && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-gray-500 mb-4">Нет сотрудников в этом расписании</p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Добавить первого сотрудника
            </Button>
          </Card>
        )}
        {employees && employees.length > 0 && filteredEmployees.length === 0 && (
          <Card className="p-8 text-center">
            <p className="text-gray-500 mb-4">
              {showHidden ? 'Нет сотрудников' : 'Нет видимых сотрудников'}
            </p>
            {!showHidden && (
              <Button variant="outline" onClick={() => setShowHidden(true)}>
                Показать скрытых
              </Button>
            )}
          </Card>
        )}

        {/* Модальное окно создания сотрудника */}
        <EditEmployeeModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={async (data) => {
            await createMutation.mutateAsync({
              ...data,
              isHidden: data.isHidden || false,
            });
          }}
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
          onSave={async (data) => {
            await updateMutation.mutateAsync({
              ...data,
              isHidden: data.isHidden || false,
            });
          }}
          employee={editingEmployeeId ? employees?.find(e => e.id === editingEmployeeId) : null}
          departments={schedule?.departments || []}
          positions={positions || []}
          scheduleId={scheduleId}
          isLoading={updateMutation.isPending}
        />

        {/* Модальное окно массового редактирования */}
        <BulkEditModal
          isOpen={isBulkEditModalOpen}
          onClose={() => setIsBulkEditModalOpen(false)}
          onSave={handleBulkSave}
          selectedCount={selectedEmployeeIds.size}
          departments={schedule?.departments || []}
          positions={positions || []}
          scheduleId={scheduleId}
          isLoading={bulkUpdateMutation.isPending}
        />

        {/* Модальное окно импорта/экспорта */}
        <ImportExportModal
          isOpen={isImportExportModalOpen}
          onClose={() => setIsImportExportModalOpen(false)}
          onImport={handleImport}
          onExport={handleExport}
          scheduleId={scheduleId}
          isLoading={importMutation.isPending || exportMutation.isPending}
        />
      </div>
    </MainLayout>
  );
}
