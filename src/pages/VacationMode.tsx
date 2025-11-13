import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Spinner, Modal, Select } from '@components/common';
import classNames from 'classnames';
import { schedulesService, employeesService, shiftsService, vacationsService, shiftProfilesService } from '@services/api';
import { useRealtime } from '@hooks/useRealtime';
import { Employee, Shift } from '@types';
import { parseISO, startOfDay, endOfDay } from 'date-fns';
import VacationScheduler from '@components/vacations/VacationScheduler';
import VacationSettingsPanel from '@components/vacations/VacationSettingsPanel';

/**
 * Страница режима отпусков
 */
export default function VacationMode() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'roster'>('compact');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

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

  // Загрузка отпусков
  const { data: vacations, isLoading: vacationsLoading } = useQuery({
    queryKey: ['vacations', scheduleId],
    queryFn: () => vacationsService.getVacations(scheduleId),
    enabled: !!scheduleId,
  });

  // Загрузка смен для отображения
  const { data: shiftsData } = useQuery({
    queryKey: ['shifts', scheduleId, schedule?.startDate, schedule?.endDate],
    queryFn: () => {
      if (!schedule) return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0, totalPages: 0 });
      
      const startDate = typeof schedule.startDate === 'string' 
        ? parseISO(schedule.startDate) 
        : new Date(schedule.startDate);
      const endDate = typeof schedule.endDate === 'string'
        ? parseISO(schedule.endDate)
        : new Date(schedule.endDate);
      
      const start = startOfDay(startDate);
      const end = endOfDay(endDate);
      
      return shiftsService.getShifts(scheduleId, {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        limit: 10000,
      });
    },
    enabled: !!scheduleId && !!schedule,
  });

  // Загрузка профилей смен для получения цветов
  const { data: shiftProfiles } = useQuery({
    queryKey: ['shiftProfiles', scheduleId],
    queryFn: () => scheduleId ? shiftProfilesService.getShiftProfiles(scheduleId) : Promise.resolve([]),
    enabled: !!scheduleId,
  });

  // Real-time обновления
  useRealtime(scheduleId, () => {
    queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
  });

  // Преобразуем смены в Map для быстрого доступа
  const shiftsByDateAndEmployee = useMemo(() => {
    if (!shiftsData?.items) return new Map<string, Shift>();
    
    const map = new Map<string, Shift>();
    shiftsData.items.forEach(shift => {
      const dateStr = typeof shift.date === 'string' 
        ? shift.date.split('T')[0] 
        : new Date(shift.date).toISOString().split('T')[0];
      const key = `${dateStr}-${shift.employeeId}`;
      map.set(key, shift);
    });
    return map;
  }, [shiftsData]);

  // Получаем все типы смен из профилей
  const shiftTypes = useMemo(() => {
    if (!shiftProfiles) return [];
    return shiftProfiles.flatMap(profile => 
      (profile.shiftTypes || []).map(type => ({
        id: type.id,
        name: type.name,
        color: type.color,
      }))
    );
  }, [shiftProfiles]);

  // Преобразуем даты расписания
  const scheduleStart = useMemo(() => {
    if (!schedule) return new Date();
    const date = typeof schedule.startDate === 'string' 
      ? parseISO(schedule.startDate) 
      : new Date(schedule.startDate);
    return startOfDay(date);
  }, [schedule]);

  const scheduleEnd = useMemo(() => {
    if (!schedule) return new Date();
    const date = typeof schedule.endDate === 'string'
      ? parseISO(schedule.endDate)
      : new Date(schedule.endDate);
    return endOfDay(date);
  }, [schedule]);

  const isLoading = scheduleLoading || employeesLoading || vacationsLoading;

  // Фильтруем только видимых сотрудников
  const visibleEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => !emp.isHidden);
  }, [employees]);

  // Опции для выпадающего списка сотрудников
  const employeeOptions = useMemo(() => {
    return visibleEmployees.map(emp => ({
      value: emp.id,
      label: `${emp.fullName}${emp.tabNumber ? ` (${emp.tabNumber})` : ''}`,
    }));
  }, [visibleEmployees]);

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
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Режим отпусков</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsHelpOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Помощь"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                title="Настройки"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewMode === 'compact' && (
              <div className="flex items-center gap-3 px-4 py-2 border border-gray-300 rounded-lg bg-white">
                <div className="w-64">
                  <Select
                    value={selectedEmployeeId}
                    onChange={(e) => {
                      setSelectedEmployeeId(e.target.value);
                    }}
                    options={employeeOptions}
                    placeholder="Выберите сотрудника"
                    className="border-2 border-gray-300 focus:border-primary focus:ring-primary"
                  />
                </div>
                <div className="flex items-center gap-1 border-l border-gray-300 pl-3">
                  <button
                    onClick={() => {
                      setViewMode('compact');
                      setSelectedEmployeeId('');
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'compact'
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Компактный календарь
                  </button>
                  <button
                    onClick={() => {
                      setViewMode('roster');
                      setSelectedEmployeeId('');
                    }}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      viewMode === 'roster'
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Ростер
                  </button>
                </div>
              </div>
            )}
            {viewMode === 'roster' && (
              <div className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg bg-white">
                <button
                  onClick={() => {
                    setViewMode('compact');
                    setSelectedEmployeeId('');
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'compact'
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Компактный календарь
                </button>
                <button
                  onClick={() => {
                    setViewMode('roster');
                    setSelectedEmployeeId('');
                  }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    viewMode === 'roster'
                      ? 'bg-primary text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Ростер
                </button>
              </div>
            )}
            <Button onClick={() => navigate(`/schedule/${scheduleId}`)} variant="outline">
              Назад к расписанию
            </Button>
          </div>
        </div>

        {/* Загрузка */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {/* Основной компонент расстановки отпусков */}
        {schedule && employees && !isLoading && (
          <VacationScheduler
            scheduleId={scheduleId}
            scheduleStart={scheduleStart}
            scheduleEnd={scheduleEnd}
            employees={employees}
            vacations={vacations || []}
            shiftsByDateAndEmployee={shiftsByDateAndEmployee}
            shiftTypes={shiftTypes}
            viewMode={viewMode}
            selectedEmployeeId={selectedEmployeeId}
            onViewModeChange={setViewMode}
            onSelectedEmployeeChange={setSelectedEmployeeId}
            onVacationCreated={() => {
              queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
            }}
            onVacationDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
            }}
          />
        )}

        {/* Модальное окно настроек */}
        <Modal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          title="Настройки отпусков"
          size="xl"
        >
          {employees && (
            <VacationSettingsPanel
              scheduleId={scheduleId}
              employees={employees}
              onClose={() => setIsSettingsOpen(false)}
            />
          )}
        </Modal>

        {/* Модальное окно помощи */}
        <Modal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="Помощь по разделу 'Режим отпусков'"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Как создать отпуск</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>В режиме "Ростер": кликните на дату начала отпуска для сотрудника, затем на дату конца отпуска.</li>
                <li>В режиме "Компактный календарь": выберите сотрудника из списка, затем кликните на дату начала отпуска, затем на дату конца отпуска.</li>
                <li>Отпуск создается автоматически после выбора конечной даты.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Как удалить отпуск</h3>
              <p className="text-gray-700">
                Кликните на дату, которая уже находится в отпуске. Отпуск будет удален без подтверждения.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Визуальные обозначения</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li><span className="inline-block w-4 h-4 bg-yellow-100 border border-yellow-400 rounded mr-2"></span> - дни отпуска</li>
                <li><span className="inline-block w-4 h-4 bg-blue-100 border border-blue-400 rounded mr-2"></span> - выбранный период</li>
                <li><span className="inline-block w-4 h-4 border-2 border-blue-500 rounded mr-2"></span> - кликнутый день (контур)</li>
                <li>👑 - день рождения сотрудника</li>
                <li>Бледные цвета - смены сотрудника</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Настройки</h3>
              <p className="text-gray-700">
                В настройках можно задать количество дней отпуска для каждого сотрудника, максимальное количество сотрудников в отпуске одновременно и минимальную длительность непрерывного отпуска.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
