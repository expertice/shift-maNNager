import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Spinner, Card, Button, Badge } from '@components/common';
import { schedulesService, shiftsService, employeesService, patternInstancesService, shiftProfilesService, positionsService } from '@services/api';
import type { RosterPatternInstanceDTO } from '@services/api/patternInstancesService';
import { useRealtime } from '@hooks/useRealtime';
import { EditPeriodModal } from '@components/schedules/EditPeriodModal';
import { ShiftSwapRequestsModal } from '@components/schedules/ShiftSwapRequestsModal';
import { EditEmployeeModal } from '@components/employees';
import { shiftSwapService } from '@services/api/shiftSwapService';
import { Shift, Employee } from '@types';
import { format, eachDayOfInterval, parseISO, isDate, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import RosterMonthBoard from '@components/schedules/RosterMonthBoard';
import { SlotView } from '@components/shifts/PatternConstructor';
import { splitPeriodByMonths, maxDaysAcrossMonths, getSlotStatus } from '@/utils/rosterCalendar';
import LaborViolationsModal from '@components/schedules/LaborViolationsModal';
import LaborLawSettingsModal from '@components/labor/LaborLawSettingsModal';

/**
 * Основная страница редактирования расписания
 */
export default function MainSchedule() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditPeriodModalOpen, setIsEditPeriodModalOpen] = useState(false);
  const [isSwapRequestsModalOpen, setIsSwapRequestsModalOpen] = useState(false);
  const [selectedSlotForSwap, setSelectedSlotForSwap] = useState<{ employeeId: string; dayIndex: number } | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]);
  const [isLaborViolationsModalOpen, setIsLaborViolationsModalOpen] = useState<boolean>(false);
  const [isLaborSettingsOpen, setIsLaborSettingsOpen] = useState<boolean>(false);

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка данных расписания
  const { data: schedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedulesService.getScheduleById(scheduleId),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Загрузка сотрудников
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', scheduleId],
    queryFn: () => employeesService.getEmployees(scheduleId),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Сохранение порядка сотрудников в localStorage при изменении
  useEffect(() => {
    if (scheduleId && employeeOrder.length > 0) {
      localStorage.setItem(`employeeOrder_${scheduleId}`, JSON.stringify(employeeOrder));
    }
  }, [employeeOrder, scheduleId]);

  // Инициализация и обновление порядка сотрудников при загрузке
  useEffect(() => {
    if (employees && employees.length > 0 && scheduleId) {
      setEmployeeOrder(prev => {
        // Если порядок уже установлен, обновляем его (добавляем новых, удаляем несуществующих)
        if (prev.length > 0) {
          const existingIds = new Set(prev);
          const newIds = employees
            .filter(emp => !existingIds.has(emp.id))
            .map(emp => emp.id);
          // Удаляем несуществующих сотрудников из порядка
          const employeeIds = new Set(employees.map(emp => emp.id));
          const filtered = prev.filter(id => employeeIds.has(id));
          return newIds.length > 0 ? [...filtered, ...newIds] : filtered;
        }
        
        // Если порядок не установлен, загружаем из localStorage или инициализируем из массива сотрудников
        const savedOrder = localStorage.getItem(`employeeOrder_${scheduleId}`);
        if (savedOrder) {
          try {
            const parsedOrder = JSON.parse(savedOrder);
            if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
              // Проверяем, что все ID из сохраненного порядка существуют в текущем списке сотрудников
              const employeeIds = new Set(employees.map(emp => emp.id));
              const validOrder = parsedOrder.filter(id => employeeIds.has(id));
              // Добавляем новых сотрудников в конец
              const newIds = employees
                .filter(emp => !validOrder.includes(emp.id))
                .map(emp => emp.id);
              return newIds.length > 0 ? [...validOrder, ...newIds] : validOrder;
            }
          } catch (error) {
            console.error('Error parsing saved employee order:', error);
          }
        }
        
        // Если нет сохраненного порядка, инициализируем из массива сотрудников
        return employees.map(emp => emp.id);
      });
    }
  }, [employees, scheduleId]);

  // Сортированные сотрудники по порядку
  const sortedEmployees = useMemo(() => {
    if (!employees || employeeOrder.length === 0) return employees || [];
    
    const orderMap = new Map(employeeOrder.map((id, index) => [id, index]));
    const sorted = [...employees].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity;
      const bIndex = orderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });
    
    // Добавляем новых сотрудников в конец, если они появились
    const newEmployees = employees.filter(emp => !orderMap.has(emp.id));
    return [...sorted, ...newEmployees];
  }, [employees, employeeOrder]);

  // Загрузка экземпляров паттернов (для DnD-режима)
  const { data: patternInstances } = useQuery({
    queryKey: ['patternInstances', scheduleId],
    queryFn: () => patternInstancesService.getInstances(scheduleId),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Загружаем профили смен, чтобы получить цвета и названия типов смен
  const { data: shiftProfiles } = useQuery({
    queryKey: ['shiftProfiles', scheduleId],
    queryFn: () => scheduleId ? shiftProfilesService.getShiftProfiles(scheduleId) : Promise.resolve([]),
    enabled: !!scheduleId,
    staleTime: 0, // Считаем данные устаревшими сразу
    refetchOnMount: true, // Обновлять при монтировании
    refetchOnWindowFocus: true, // Обновлять при фокусе окна
  });

  // Загрузка должностей
  const { data: positions } = useQuery({
    queryKey: ['positions', scheduleId],
    queryFn: () => positionsService.getPositions(scheduleId),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Загрузка смен с фильтрацией по периоду расписания
  const { data: shiftsData, isLoading: shiftsLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts', scheduleId, schedule?.startDate, schedule?.endDate],
    queryFn: () => {
      if (!schedule) return Promise.resolve({ items: [], total: 0, page: 1, pageSize: 0, totalPages: 0 });
      
      const startDate = typeof schedule.startDate === 'string' 
        ? parseISO(schedule.startDate) 
        : new Date(schedule.startDate);
      const endDate = typeof schedule.endDate === 'string'
        ? parseISO(schedule.endDate)
        : new Date(schedule.endDate);
      
      // Нормализуем к началу дня для обеих дат
      // Используем startOfDay для endDate, т.к. в БД поле date имеет тип @db.Date (только дата)
      // и сравнение должно быть по началу дня включительно
      const start = startOfDay(startDate);
      const end = endOfDay(endDate); // Используем endOfDay для включения всего последнего дня
      
      const startISO = start.toISOString();
      const endISO = end.toISOString();
      
      return shiftsService.getShifts(scheduleId, {
        startDate: startISO,
        endDate: endISO,
        limit: 1000, // Большое число для загрузки всех смен
      });
    },
    enabled: !!scheduleId && !!schedule,
    staleTime: 0, // Считаем данные устаревшими сразу
    refetchOnWindowFocus: true, // Обновлять при фокусе окна
    refetchOnMount: true, // Обновлять при монтировании
  });

  // Загрузка pending запросов на обмен (для badge)
  const { data: pendingSwapRequests } = useQuery({
    queryKey: ['shift-swaps', scheduleId, 'pending'],
    queryFn: () => shiftSwapService.getSwapRequests(scheduleId, 'pending'),
    enabled: !!scheduleId,
    refetchInterval: 30000, // Обновляем каждые 30 секунд
  });

  // Real-time обновления
  useRealtime(scheduleId, (event) => {
    // Обновляем данные при real-time событиях
    refetchShifts();
    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['shift-swaps', scheduleId] });
  });

  // Мутация для создания сотрудника
  const createEmployeeMutation = useMutation({
    mutationFn: (data: { fullName: string; tabNumber: string; birthDate?: string; departmentId: string; positionId?: string }) => {
      return employeesService.createEmployee(scheduleId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setEditingEmployeeId(null);
    },
  });

  // Мутация для обновления сотрудника
  const updateEmployeeMutation = useMutation({
    mutationFn: (data: { fullName: string; tabNumber: string; birthDate?: string; departmentId: string }) => {
      if (!editingEmployeeId || editingEmployeeId === 'new') throw new Error('No employee selected');
      return employeesService.updateEmployee(scheduleId, editingEmployeeId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      setEditingEmployeeId(null);
    },
  });

  // Мутация для удаления сотрудника
  const deleteEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => employeesService.deleteEmployee(scheduleId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    },
  });

  // Мутация для клонирования сотрудника
  const cloneEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => employeesService.cloneEmployee(scheduleId, employeeId),
    onSuccess: (newEmployee) => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      // Добавляем нового сотрудника в конец списка
      if (newEmployee) {
        setEmployeeOrder(prev => [...prev, newEmployee.id]);
      }
    },
  });

  // Функция обновления смещения паттерна с перегенерацией смен
  const handlePatternOffsetChange = async (offsetDelta: number) => {
    if (!schedule || !employees) return;

    try {
      // Обновляем смещение в экземплярах паттернов (включая patternStartOffset в расписании)
      await shiftProfilesService.updatePatternOffset(scheduleId, offsetDelta);
      
      // Группируем сотрудников по профилям
      const employeesByProfile = new Map<string, string[]>();
      employees.forEach((emp) => {
        if (emp.shiftProfileId) {
          const profileId = emp.shiftProfileId;
          if (!employeesByProfile.has(profileId)) {
            employeesByProfile.set(profileId, []);
          }
          employeesByProfile.get(profileId)!.push(emp.id);
        }
      });

      // Перегенерируем смены для каждого профиля
      const startDate = new Date(schedule.startDate);
      const endDate = new Date(schedule.endDate);
      
      for (const [profileId, employeeIds] of employeesByProfile.entries()) {
        try {
          await shiftProfilesService.generateShifts({
            scheduleId,
            shiftProfileId: profileId,
            employeeIds,
            startDate,
            endDate,
          });
        } catch (error) {
          console.error(`Error regenerating shifts for profile ${profileId}:`, error);
        }
      }

      // Обновляем кэш
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
    } catch (error) {
      console.error('Error updating pattern offset:', error);
      alert('Ошибка обновления смещения паттерна');
    }
  };

  // Функции перемещения сотрудников
  const handleEmployeeMoveUp = (employeeId: string) => {
    setEmployeeOrder(prev => {
      const index = prev.indexOf(employeeId);
      if (index > 0) {
        const newOrder = [...prev];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        return newOrder;
      }
      return prev;
    });
  };

  const handleEmployeeMoveDown = (employeeId: string) => {
    setEmployeeOrder(prev => {
      const index = prev.indexOf(employeeId);
      if (index < prev.length - 1) {
        const newOrder = [...prev];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        return newOrder;
      }
      return prev;
    });
  };

  // Обработчик назначения профиля сотруднику
  const handleAssignProfile = async (employeeId: string, shiftProfileId: string | null) => {
    try {
      await employeesService.assignProfileToEmployee(employeeId, scheduleId, shiftProfileId);
      
      // Если профиль назначен (не null), генерируем смены для этого сотрудника
      if (shiftProfileId && schedule) {
        // Конвертируем даты в ISO формат для API
        const startDateISO = typeof schedule.startDate === 'string' 
          ? schedule.startDate 
          : new Date(schedule.startDate).toISOString();
        const endDateISO = typeof schedule.endDate === 'string' 
          ? schedule.endDate 
          : new Date(schedule.endDate).toISOString();
          
        await shiftProfilesService.generateShifts(scheduleId, {
          shiftProfileId,
          employeeIds: [employeeId],
          startDate: startDateISO,
          endDate: endDateISO,
        });
      }
      
      // Обновляем все связанные данные
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
    } catch (error: any) {
      console.error('Error assigning profile:', error);
      alert(`Ошибка назначения профиля: ${error.response?.data?.message || error.message}`);
    }
  };

  // Обработчик смещения паттерна конкретного сотрудника
  const handleEmployeePatternOffsetChange = async (employeeId: string, offsetDelta: number) => {
    try {
      await shiftProfilesService.updateEmployeePatternOffset(scheduleId, employeeId, offsetDelta);
      queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
    } catch (error: any) {
      console.error('Error updating employee pattern offset:', error);
      alert(`Ошибка обновления смещения паттерна: ${error.response?.data?.message || error.message}`);
    }
  };

  // Обработчик добавления сотрудника
  const handleAddEmployee = () => {
    setEditingEmployeeId('new');
  };

  // Получаем даты периода расписания для отображения
  // Важно: используем локальное время для корректной работы с датами
  const periodDays = schedule
    ? (() => {
        // Парсим даты и нормализуем к началу дня в локальном часовом поясе
        const startDate = typeof schedule.startDate === 'string' 
          ? parseISO(schedule.startDate) 
          : new Date(schedule.startDate);
        const endDate = typeof schedule.endDate === 'string'
          ? parseISO(schedule.endDate)
          : new Date(schedule.endDate);
        
        const start = startOfDay(startDate);
        const end = startOfDay(endDate);
        
        // Генерируем массив дней для периода
        const days = eachDayOfInterval({ start, end });
        return days;
      })()
    : [];

  // Состояние для оптимистичных обновлений (используем Record вместо Map для стабильности зависимостей)
  const [optimisticShifts, setOptimisticShifts] = useState<Record<string, Shift>>({});
  
  // Группируем смены по дате и сотруднику
  const shiftsByDateAndEmployee = useMemo(() => {
    const map = new Map<string, Shift>();
    // Бэкенд может возвращать либо массив, либо пагинированный ответ
    const shiftsArray = shiftsData 
      ? (Array.isArray(shiftsData) ? shiftsData : shiftsData.items || [])
      : [];
    
    shiftsArray.forEach((shift) => {
      // Нормализуем дату в формат 'yyyy-MM-dd' для ключа
      // Важно: используем локальную дату, а не UTC
      let dateObj: Date;
      if (typeof shift.date === 'string') {
        // Если дата пришла как строка, парсим
        dateObj = parseISO(shift.date);
      } else if (isDate(shift.date)) {
        // Если это уже Date объект
        dateObj = shift.date;
      } else {
        // Fallback: пытаемся создать Date из значения
        dateObj = new Date(shift.date);
      }
      
      // Нормализуем к началу дня в локальном часовом поясе и форматируем
      const normalizedDate = startOfDay(dateObj);
      const dateStr = format(normalizedDate, 'yyyy-MM-dd');
      
      const key = `${dateStr}-${shift.employeeId}`;
      map.set(key, shift);
    });
    
    // Применяем оптимистичные обновления
    Object.entries(optimisticShifts).forEach(([key, shift]) => {
      map.set(key, shift);
    });
    
    return map;
  }, [shiftsData, optimisticShifts]);

  const getShiftForDate = (employeeId: string, date: Date): Shift | undefined => {
    const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
    return shiftsByDateAndEmployee.get(`${dateStr}-${employeeId}`);
  };

  const isLoading = scheduleLoading || employeesLoading || shiftsLoading;

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
    {
      id: 'history',
      label: 'История',
      icon: SidebarIcons.History,
      path: `/schedule/${scheduleId}/history`,
    },
  ];

  return (
    <MainLayout sidebarItems={sidebarItems}>
      <div className="p-8">
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {schedule && !isLoading && (
          <>
            {/* Заголовок */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center space-x-3">
                  <h1 className="text-3xl font-bold">{schedule.name}</h1>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsLaborSettingsOpen(true)}
                    >
                      Настройки ТК РФ
                    </Button>
                  </div>
                  <p className="text-gray-600 mt-1">
                    {format(new Date(schedule.startDate), 'dd MMMM yyyy', { locale: ru })} -{' '}
                    {format(new Date(schedule.endDate), 'dd MMMM yyyy', { locale: ru })}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditPeriodModalOpen(true)}
                  >
                    Редактировать период
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsLaborViolationsModalOpen(true)}
                  >
                    Проверка ТК РФ
                  </Button>
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSwapRequestsModalOpen(true)}
                    >
                      Запросы на обмен
                    </Button>
                    {pendingSwapRequests && pendingSwapRequests.length > 0 && (
                      <Badge
                        variant="danger"
                        className="absolute -top-2 -right-2"
                      >
                        {pendingSwapRequests.length}
                      </Badge>
                    )}
                  </div>
                  <Badge
                    variant={
                      schedule.status === 'published'
                        ? 'success'
                        : schedule.status === 'completed'
                        ? 'info'
                        : 'default'
                    }
                  >
                    {schedule.status === 'published'
                      ? 'Опубликовано'
                      : schedule.status === 'completed'
                      ? 'Завершено'
                      : schedule.status === 'archived'
                      ? 'Архив'
                      : 'Черновик'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Представление ростера: всегда через движок паттернов */}
            {employees && employees.length > 0 ? (
              (() => {
                // Вычисляем максимальную длину цикла из всех паттернов для отображения смещения
                const allCycleLengths = shiftProfiles 
                  ? shiftProfiles.flatMap(sp => (sp.patterns || []).map(p => p.cycleLength || 0)).filter(l => l > 0)
                  : [];
                const maxCycleLength = allCycleLengths.length > 0 ? Math.max(...allCycleLengths) : 0;
                const start = startOfDay(new Date(schedule.startDate));
                const end = endOfDay(new Date(schedule.endDate));
                const months = splitPeriodByMonths(start, end);
                const maxDays = maxDaysAcrossMonths(months);
                const instancesByEmp = Object.fromEntries(
                  (patternInstances || []).map((p) => [p.employeeId, { 
                    sequence: p.sequence, 
                    startIndex: p.startIndex, 
                    lockedIndices: p.lockedIndices,
                    cycleLength: p.pattern?.cycleLength || 0
                  }])
                );
                
                // Определяем последний использованный профиль по shiftAssignments
                // Это надежно, т.к. каждая генерация создает новую запись
                const assignedProfileIds = new Set<string>();
                const shiftAssignments = schedule?.shiftAssignments || [];
                
                if (shiftAssignments.length > 0) {
                  // Сортируем: сначала по assignmentNumber (больше = новее), потом по createdAt
                  const sorted = [...shiftAssignments].sort((a: any, b: any) => {
                    // assignmentNumber - главный критерий (больше = позже)
                    const aNum = a.assignmentNumber || 0;
                    const bNum = b.assignmentNumber || 0;
                    if (aNum !== bNum) {
                      return bNum - aNum;
                    }
                    // Если одинаковые номера, сортируем по дате создания
                    const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                    const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                    return bDate - aDate;
                  });
                  
                  // Берем профиль из последнего назначения
                  const latestAssignment = sorted[0];
                  const profileId = latestAssignment?.shiftProfileId || latestAssignment?.shiftProfile?.id || null;
                  if (profileId && typeof profileId === 'string') {
                    assignedProfileIds.add(profileId);
                  }
                }
                
                // Карта типов смен для цветов/названий
                const shiftTypeMap: Record<string, { name: string; color?: string }> = {};
                const allShiftTypes: Array<{ 
                  id: string; 
                  name: string; 
                  color?: string; 
                  profileName?: string;
                  shiftProfileId?: string; // Добавляем ID профиля для фильтрации
                  startTime?: string;
                  endTime?: string;
                  workingHours?: number;
                }> = [];
                
                // Собираем все активные профили: из shiftAssignments и из назначенных сотрудникам
                const activeProfileIds = new Set<string>(assignedProfileIds);
                (employees || []).forEach((emp) => {
                  if (emp.shiftProfileId) {
                    activeProfileIds.add(emp.shiftProfileId);
                  }
                });
                
                // Если есть активные профили, фильтруем типы смен только из этих профилей
                // Если активных профилей нет, показываем все типы (для обратной совместимости)
                const profilesToUse = activeProfileIds.size > 0
                  ? (shiftProfiles || []).filter((sp) => activeProfileIds.has(sp.id))
                  : (shiftProfiles || []);
                
                profilesToUse.forEach((sp) => {
                  (sp.shiftTypes || []).forEach((t) => {
                    shiftTypeMap[t.id] = { name: t.name, color: t.color };
                    // Собираем все типы смен для меню выбора с указанием профиля и рабочих часов
                    const existingIndex = allShiftTypes.findIndex(st => st.id === t.id);
                    if (existingIndex === -1) {
                      allShiftTypes.push({
                        id: t.id,
                        name: t.name,
                        color: t.color,
                        profileName: sp.name, // Добавляем название профиля
                        shiftProfileId: sp.id, // Добавляем ID профиля
                        startTime: t.startTime,
                        endTime: t.endTime,
                        workingHours: t.workingHours,
                      });
                    } else {
                      // Если тип смены уже есть (из другого профиля), добавляем все названия профилей
                      const existing = allShiftTypes[existingIndex];
                      if (existing.profileName && !existing.profileName.includes(sp.name)) {
                        existing.profileName = `${existing.profileName}, ${sp.name}`;
                      } else if (!existing.profileName) {
                        existing.profileName = sp.name;
                      }
                      // Если shiftProfileId не установлен, добавляем его
                      if (!existing.shiftProfileId) {
                        existing.shiftProfileId = sp.id;
                      }
                      // Обновляем рабочие часы, если они не были сохранены
                      if (!existing.startTime && t.startTime) {
                        existing.startTime = t.startTime;
                        existing.endTime = t.endTime;
                        existing.workingHours = t.workingHours;
                      }
                    }
                  });
                });
                const minEmployees = (() => {
                  const sp = (shiftProfiles || [])[0];
                  return sp?.minEmployees ?? 1;
                })();
                
                // Функция для создания/обновления смены на конкретную дату
                const upsertDailyShift = async (
                  employeeId: string,
                  date: Date,
                  shiftTypeId: string | null
                ) => {
                  // Определяем key и dateStr вне try блока, чтобы они были доступны в catch
                  const dateStr = format(startOfDay(date), 'yyyy-MM-dd');
                  const key = `${dateStr}-${employeeId}`;
                  
                  try {
                    // Нормализуем дату для API - используем UTC для корректного сохранения в БД
                    const normalizedDate = startOfDay(date);
                    const year = normalizedDate.getFullYear();
                    const month = normalizedDate.getMonth();
                    const day = normalizedDate.getDate();
                    // Создаем дату в UTC на начало дня - это гарантирует правильную дату в БД
                    const normalizedDateUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
                    const dateISO = normalizedDateUTC.toISOString();
                    
                    // Проверяем существующую смену (включая scheduled)
                    const existingShift = shiftsByDateAndEmployee.get(key);
                    
                    // Оптимистичное обновление: сразу обновляем состояние для немедленного отображения в UI
                    setOptimisticShifts((prev) => {
                      const newObj = { ...prev };
                      if (shiftTypeId === null) {
                        // Для выходного дня: если есть модифицированная/отмененная смена, удаляем её
                        // Если есть scheduled смена или смены нет, создаем/обновляем запись с null shiftTypeId и статусом 'modified'
                        if (existingShift && (existingShift.status === 'modified' || existingShift.status === 'cancelled')) {
                          delete newObj[key];
                        } else {
                          // Создаем/обновляем запись для выходного дня (используем ID существующей scheduled смены, если есть)
                          const optimisticShift: Shift = {
                            id: existingShift?.id || 'temp-' + Date.now(),
                            scheduleId,
                            employeeId,
                            date: normalizedDate,
                            shiftTypeId: null,
                            status: 'modified',
                            createdAt: existingShift?.createdAt || new Date(),
                            updatedAt: new Date(),
                          };
                          newObj[key] = optimisticShift;
                        }
                      } else {
                        // Добавляем/обновляем в объекте
                        const optimisticShift: Shift = {
                          id: existingShift?.id || 'temp-' + Date.now(),
                          scheduleId,
                          employeeId,
                          date: normalizedDate,
                          shiftTypeId,
                          status: 'modified',
                          createdAt: existingShift?.createdAt || new Date(),
                          updatedAt: new Date(),
                        };
                        newObj[key] = optimisticShift;
                      }
                      return newObj;
                    });
                    
                    // Оптимистичное обновление кэша React Query
                    queryClient.setQueryData<{ items: Shift[] } | Shift[]>(
                      ['shifts', scheduleId, schedule?.startDate, schedule?.endDate],
                      (oldData) => {
                        if (!oldData) return oldData;
                        const items = Array.isArray(oldData) ? oldData : oldData.items || [];
                        const dateStrForComparison = format(startOfDay(date), 'yyyy-MM-dd');
                        
                        if (shiftTypeId === null) {
                          // Удаляем из кэша
                          const filtered = items.filter((s) => {
                            const sDateStr = format(startOfDay(new Date(s.date)), 'yyyy-MM-dd');
                            return !(sDateStr === dateStrForComparison && s.employeeId === employeeId);
                          });
                          return Array.isArray(oldData) ? filtered : { ...oldData, items: filtered };
                        }
                        
                        const optimisticShift: Shift = {
                          id: existingShift?.id || 'temp-' + Date.now(),
                          scheduleId,
                          employeeId,
                          date: normalizedDate,
                          shiftTypeId,
                          status: 'modified',
                          createdAt: existingShift?.createdAt || new Date(),
                          updatedAt: new Date(),
                        };
                        
                        const existingIndex = items.findIndex(
                          (s) => {
                            const sDateStr = format(startOfDay(new Date(s.date)), 'yyyy-MM-dd');
                            return (s.id === optimisticShift.id && s.id !== 'temp-' + Date.now()) || 
                              (sDateStr === dateStrForComparison && s.employeeId === employeeId);
                          }
                        );
                        
                        if (existingIndex >= 0) {
                          // Обновляем существующую
                          const updated = [...items];
                          updated[existingIndex] = { ...updated[existingIndex], ...optimisticShift };
                          return Array.isArray(oldData) ? updated : { ...oldData, items: updated };
                        } else {
                          // Добавляем новую
                          const updated = [...items, optimisticShift];
                          return Array.isArray(oldData) ? updated : { ...oldData, items: updated };
                        }
                      }
                    );
                    
                    if (shiftTypeId === null) {
                      // Если shiftTypeId null, назначаем выходной
                      if (existingShift && (existingShift.status === 'modified' || existingShift.status === 'cancelled')) {
                        // Удаляем только модифицированные/отмененные смены
                        // Scheduled смены игнорируются при отображении, поэтому их удалять не нужно
                        await shiftsService.deleteShift(scheduleId, existingShift.id);
                      } else if (existingShift && existingShift.status === 'scheduled') {
                        // Если есть смена со статусом 'scheduled', обновляем её на выходной
                        // Это переопределяет паттерн, поэтому устанавливаем статус 'modified'
                        await shiftsService.updateShift(scheduleId, existingShift.id, {
                          shiftTypeId: null,
                          status: 'modified',
                        });
                      } else if (!existingShift) {
                        // Если смены нет, создаем новую смену для выходного дня
                        const createdShift = await shiftsService.createShift(scheduleId, {
                          employeeId,
                          date: dateISO,
                          shiftTypeId: null,
                        });
                        // Обновляем статус на 'modified', так как это ручное изменение выходного дня
                        await shiftsService.updateShift(scheduleId, createdShift.id, {
                          status: 'modified',
                        });
                      }
                    } else {
                        // Если shiftTypeId не null, создаем или обновляем смену
                        // Сервер использует upsert, поэтому просто создаем/обновляем
                        if (existingShift && existingShift.id) {
                          // Обновляем существующую смену и помечаем как 'modified'
                          await shiftsService.updateShift(scheduleId, existingShift.id, {
                            shiftTypeId,
                            status: 'modified',
                          });
                        } else {
                          // Если смены нет в кэше, создаём новую (сервер использует upsert)
                          // Сервер сам обработает случай, если смена уже существует
                          await shiftsService.createShift(scheduleId, {
                            employeeId,
                            date: dateISO,
                            shiftTypeId,
                          });
                        }
                      }
                    
                    // Обновляем кэш смен после успешного сохранения
                    await refetchShifts();
                    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
                    
                    // Очищаем оптимистичные обновления после успешного сохранения
                    // (они будут заменены реальными данными из refetchShifts)
                    setOptimisticShifts((prev) => {
                      const newObj = { ...prev };
                      delete newObj[key];
                      return newObj;
                    });
                  } catch (error) {
                    console.error('Error upserting daily shift:', error);
                    // Откатываем оптимистичное обновление при ошибке
                    setOptimisticShifts((prev) => {
                      const newObj = { ...prev };
                      delete newObj[key];
                      return newObj;
                    });
                    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
                    throw error;
                  }
                };

                // Функция для создания запроса на обмен сменами
                const createSwapRequest = async (
                  fromEmployeeId: string,
                  fromDate: Date,
                  toEmployeeId: string,
                  toDate: Date
                ) => {
                  try {
                    // Инициатором является сотрудник, который выбрал свой слот для обмена (fromEmployeeId)
                    const initiatorEmployeeId = fromEmployeeId;

                    await shiftSwapService.createSwapRequest(scheduleId, {
                      initiatorEmployeeId,
                      fromEmployeeId,
                      fromDate: startOfDay(fromDate).toISOString(),
                      toEmployeeId,
                      toDate: startOfDay(toDate).toISOString(),
                    });

                    // Обновляем список запросов
                    queryClient.invalidateQueries({ queryKey: ['shift-swaps', scheduleId] });
                  } catch (error) {
                    console.error('Error creating swap request:', error);
                    throw error;
                  }
                };
                
                const onReorder = async (empId: string, newSeq: (string | null)[]) => {
                  try {
                    // Оптимистичное обновление - сразу обновляем кэш
                    queryClient.setQueryData<RosterPatternInstanceDTO[]>(
                      ['patternInstances', scheduleId],
                      (oldData) => {
                        if (!oldData) return oldData;
                        return oldData.map((instance) =>
                          instance.employeeId === empId
                            ? { ...instance, sequence: newSeq }
                            : instance
                        );
                      }
                    );
                    
                    // Отправляем на сервер
                    await patternInstancesService.updateSequence(scheduleId, empId, newSeq);
                    
                    // Обновляем данные после успешного сохранения
                    queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
                  } catch (error) {
                    // В случае ошибки откатываем изменения
                    console.error('Error updating sequence:', error);
                    queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
                  }
                };
                const renderChip = (typeId: string | null) => {
                  if (!typeId) return <SlotView isEmpty className="h-8" />;
                  const meta = shiftTypeMap[typeId];
                  const label = (meta?.name?.charAt(0) || '?').toUpperCase();
                  return <SlotView label={label} color={meta?.color} className="h-8" />;
                };
                // Убрали подсветку покрытия
                return (
                  <>
                    {months.map((m) => (
                      <div key={`${m.year}-${m.month}`}>
                        {/* Убран заголовок с красной полосой */}
                        <RosterMonthBoard
                          title={format(new Date(m.year, m.month, 1), 'LLLL yyyy', { locale: ru })}
                          employees={sortedEmployees || []}
                          instances={instancesByEmp}
                          slice={m}
                          maxDays={maxDays}
                          periodStart={start}
                          periodEnd={end}
                          onReorder={onReorder}
                          onEmployeeClick={setEditingEmployeeId}
                          onEmployeeEdit={setEditingEmployeeId}
                          onEmployeeDelete={(employeeId) => {
                            if (window.confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
                              deleteEmployeeMutation.mutate(employeeId);
                              // Удаляем из порядка
                              setEmployeeOrder(prev => prev.filter(id => id !== employeeId));
                            }
                          }}
                          onEmployeeClone={(employeeId) => cloneEmployeeMutation.mutate(employeeId)}
                          onEmployeeMoveUp={handleEmployeeMoveUp}
                          onEmployeeMoveDown={handleEmployeeMoveDown}
                          onEmployeeAssignProfile={handleAssignProfile}
                          onEmployeePatternOffsetChange={handleEmployeePatternOffsetChange}
                          onEmployeeAdd={handleAddEmployee}
                          shiftProfiles={shiftProfiles?.map(p => ({ id: p.id, name: p.name })) || []}
                          employeeProfiles={Object.fromEntries(
                            (employees || []).map(emp => [emp.id, emp.shiftProfileId || null])
                          )}
                          renderChip={(t, idx, status) => renderChip(t)}
                          baseCycleStart={start}
                          shiftTypes={allShiftTypes}
                          shiftsByDateAndEmployee={shiftsByDateAndEmployee}
                          onUpsertShift={upsertDailyShift}
                          onCreateSwapRequest={createSwapRequest}
                          onSelectionChange={setSelectedSlotForSwap}
                          patternStartOffset={schedule.patternStartOffset || 0}
                          onPatternOffsetChange={handlePatternOffsetChange}
                          scheduleId={scheduleId}
                          maxCycleLength={maxCycleLength}
                        />
                      </div>
                    ))}
                  </>
                );
              })()
            ) : null}

            {/* Кнопки действий */}
            <div className="mt-6">
              <div className="flex space-x-4">
                <Button
                  onClick={() => navigate(`/schedule/${scheduleId}/employees`)}
                  variant="outline"
                >
                  Управление сотрудниками
                </Button>
                <Button
                  onClick={() => navigate(`/schedule/${scheduleId}/profiles`)}
                  variant="primary"
                >
                  Генерация смен
                </Button>
                <Button
                  onClick={() => navigate(`/schedule/${scheduleId}/vacations`)}
                  variant="outline"
                >
                  Режим отпусков
                </Button>
              </div>
              {selectedSlotForSwap && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <strong>Слот выбран для обмена.</strong> Удерживайте CTRL и щелкните на другую смену для обмена.
                </div>
              )}
            </div>

            {/* Модальное окно редактирования периода */}
            {schedule && (
              <>
                <EditPeriodModal
                  isOpen={isEditPeriodModalOpen}
                  onClose={() => setIsEditPeriodModalOpen(false)}
                  schedule={schedule}
                />
                <ShiftSwapRequestsModal
                  isOpen={isSwapRequestsModalOpen}
                  onClose={() => setIsSwapRequestsModalOpen(false)}
                  scheduleId={scheduleId}
                />
                <EditEmployeeModal
                  isOpen={!!editingEmployeeId}
                  onClose={() => setEditingEmployeeId(null)}
                  onSave={async (data) => {
                    if (editingEmployeeId === 'new') {
                      await createEmployeeMutation.mutateAsync(data);
                    } else {
                      await updateEmployeeMutation.mutateAsync(data);
                    }
                  }}
                  employee={editingEmployeeId && editingEmployeeId !== 'new' ? employees?.find(e => e.id === editingEmployeeId) : null}
                  departments={schedule.departments || []}
                  positions={positions || []}
                  scheduleId={scheduleId}
                  isLoading={createEmployeeMutation.isPending || updateEmployeeMutation.isPending}
                />
                <LaborViolationsModal
                  isOpen={isLaborViolationsModalOpen}
                  onClose={() => setIsLaborViolationsModalOpen(false)}
                  scheduleId={scheduleId}
                />
                <LaborLawSettingsModal
                  isOpen={isLaborSettingsOpen}
                  onClose={() => setIsLaborSettingsOpen(false)}
                />
              </>
            )}
          </>
        )}

        {!schedule && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-gray-500">Расписание не найдено</p>
            <Button onClick={() => navigate('/') } className="mt-4">
              Вернуться к списку
            </Button>
          </Card>
        )}

        {/* Модалка настроек ТК РФ */}
        <LaborLawSettingsModal
          isOpen={isLaborSettingsOpen}
          onClose={() => setIsLaborSettingsOpen(false)}
        />
      </div>
    </MainLayout>
  );
}
