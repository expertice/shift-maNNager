import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Spinner, Card, Button, Badge, Modal } from '@components/common';
import { schedulesService, shiftsService, employeesService, patternInstancesService, shiftProfilesService, positionsService } from '@services/api';
import type { RosterPatternInstanceDTO } from '@services/api/patternInstancesService';
import { useRealtime } from '@hooks/useRealtime';
import { EditPeriodModal } from '@components/schedules/EditPeriodModal';
import { ShiftSwapRequestsModal } from '@components/schedules/ShiftSwapRequestsModal';
import { EditEmployeeModal, AddEmployeeToRosterModal } from '@components/employees';
import { shiftSwapService } from '@services/api/shiftSwapService';
import { Shift, Employee } from '@types';
import { format, eachDayOfInterval, parseISO, isDate, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import RosterMonthBoard from '@components/schedules/RosterMonthBoard';
import { SlotView } from '@components/shifts/PatternConstructor';
import { splitPeriodByMonths, maxDaysAcrossMonths, getSlotStatus } from '@/utils/rosterCalendar';
import LaborViolationsModal from '@components/schedules/LaborViolationsModal';
import LaborLawSettingsModal from '@components/labor/LaborLawSettingsModal';
import { EmployeeStatistics } from '@components/schedules/EmployeeStatistics';
import { getViolationStats } from '@services/api/laborLawComplianceApi';

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
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [hoveredEmployeeId, setHoveredEmployeeId] = useState<string | null>(null);
  // Храним предыдущее состояние сотрудников для определения, кто стал видимым
  const prevEmployeesRef = useRef<Map<string, boolean>>(new Map());
  // Защита от множественных одновременных вызовов перемотки паттернов
  const patternOffsetChangeRef = useRef<Promise<void> | null>(null);

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
        // Создаем карту текущего состояния видимости сотрудников
        const currentVisibility = new Map<string, boolean>();
        employees.forEach(emp => {
          currentVisibility.set(emp.id, !emp.isHidden);
        });
        
        // Определяем сотрудников, которые стали видимыми (были скрыты, теперь видимы)
        // Только если ref уже инициализирован (не первая загрузка)
        const newlyVisibleIds: string[] = [];
        const isFirstLoad = prevEmployeesRef.current.size === 0;
        
        if (!isFirstLoad) {
          // Сравниваем текущее состояние с предыдущим
          currentVisibility.forEach((isVisible, empId) => {
            const prevWasHidden = prevEmployeesRef.current.get(empId) === false;
            // Если сотрудник стал видимым (был скрыт, теперь видим)
            if (isVisible && prevWasHidden) {
              newlyVisibleIds.push(empId);
            }
          });
        }
        
        // Обновляем ref с текущим состоянием ПОСЛЕ определения новоявленных
        // Это важно, чтобы на следующем рендере мы могли определить изменения
        prevEmployeesRef.current = currentVisibility;
        
        // Если порядок уже установлен, обновляем его
        if (prev.length > 0) {
          const existingIds = new Set(prev);
          const employeeIds = new Set(employees.map(emp => emp.id));
          
          // Получаем видимых сотрудников
          const visibleEmployees = employees.filter(emp => !emp.isHidden);
          const visibleIds = new Set(visibleEmployees.map(emp => emp.id));
          
          // Удаляем несуществующих сотрудников из порядка
          // Оставляем только видимых сотрудников в порядке
          const filtered = prev.filter(id => employeeIds.has(id) && visibleIds.has(id));
          
          // Удаляем вновь ставших видимыми из их текущих позиций (если они были в порядке)
          const orderWithoutNewlyVisible = filtered.filter(id => !newlyVisibleIds.includes(id));
          
          // Находим новых сотрудников (которых вообще не было в порядке) и которые видимы
          const newIds = employees
            .filter(emp => !existingIds.has(emp.id) && !emp.isHidden)
            .map(emp => emp.id);
          
          // Добавляем вновь ставших видимыми и новых сотрудников в конец
          const idsToAdd = [...newlyVisibleIds, ...newIds];
          return idsToAdd.length > 0 ? [...orderWithoutNewlyVisible, ...idsToAdd] : orderWithoutNewlyVisible;
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
              
              // Получаем видимых сотрудников
              const visibleEmployees = employees.filter(emp => !emp.isHidden);
              const visibleIds = new Set(visibleEmployees.map(emp => emp.id));
              
              // Оставляем только видимых сотрудников из сохраненного порядка
              const existingVisible = validOrder.filter(id => visibleIds.has(id));
              
              // Удаляем вновь ставших видимыми из их текущих позиций (если не первая загрузка)
              // Это важно: если сотрудник был скрыт и стал видимым, он должен быть в конце
              // Также проверяем: если сотрудник видим и его ID был в сохраненном порядке,
              // но он стал видимым только сейчас - перемещаем его в конец
              let orderWithoutNewlyVisible: string[];
              if (isFirstLoad) {
                orderWithoutNewlyVisible = existingVisible;
              } else {
                // Удаляем тех, кто стал видимым, из их текущих позиций
                orderWithoutNewlyVisible = existingVisible.filter(id => !newlyVisibleIds.includes(id));
              }
              
              // Добавляем новых видимых сотрудников в конец (которых не было в сохраненном порядке)
              const savedOrderIds = new Set(validOrder);
              const newIds = visibleEmployees
                .filter(emp => !savedOrderIds.has(emp.id))
                .map(emp => emp.id);
              
              // Добавляем вновь ставших видимыми и новых сотрудников в конец
              const idsToAdd = isFirstLoad ? newIds : [...newlyVisibleIds, ...newIds];
              return idsToAdd.length > 0 ? [...orderWithoutNewlyVisible, ...idsToAdd] : orderWithoutNewlyVisible;
            }
          } catch (error) {
            console.error('Error parsing saved employee order:', error);
          }
        }
        
        // Если нет сохраненного порядка, инициализируем из массива видимых сотрудников
        return employees.filter(emp => !emp.isHidden).map(emp => emp.id);
      });
    } else if (employees && employees.length === 0) {
      // Если сотрудников нет, очищаем ref
      prevEmployeesRef.current = new Map();
    }
  }, [employees, scheduleId]);

  // Сортированные сотрудники по порядку (исключая скрытых)
  const sortedEmployees = useMemo(() => {
    if (!employees || employeeOrder.length === 0) {
      // Фильтруем скрытых сотрудников
      return (employees || []).filter(emp => !emp.isHidden);
    }
    
    const orderMap = new Map(employeeOrder.map((id, index) => [id, index]));
    // Фильтруем скрытых сотрудников перед сортировкой
    const visibleEmployees = employees.filter(emp => !emp.isHidden);
    const sorted = [...visibleEmployees].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Infinity;
      const bIndex = orderMap.get(b.id) ?? Infinity;
      return aIndex - bIndex;
    });
    
    // Добавляем новых видимых сотрудников в конец, если они появились
    const newEmployees = visibleEmployees.filter(emp => !orderMap.has(emp.id));
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

  // Загрузка статистики нарушений ТК РФ (для badge)
  const { data: violationStats } = useQuery({
    queryKey: ['violation-stats', scheduleId],
    queryFn: () => getViolationStats(scheduleId!),
    enabled: !!scheduleId,
    refetchInterval: 60000, // Обновляем каждую минуту
  });


  // Real-time обновления
  useRealtime(scheduleId, (event) => {
    // Обновляем данные при real-time событиях
    refetchShifts();
    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['shift-swaps', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['violation-stats', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
  });

  // Мутация для создания сотрудника
  const createEmployeeMutation = useMutation({
    mutationFn: (data: { fullName: string; tabNumber: string; birthDate?: string; departmentId: string; positionId?: string }) => {
      return employeesService.createEmployee(scheduleId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
      setEditingEmployeeId(null);
    },
  });

  // Мутация для переключения видимости сотрудника
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ employeeId, isHidden }: { employeeId: string; isHidden: boolean }) => {
      await employeesService.updateEmployee(scheduleId, employeeId, { isHidden });
      
      // Если сотрудник скрыт, очищаем его расписание
      if (isHidden && schedule) {
        const startDateISO = typeof schedule.startDate === 'string' 
          ? schedule.startDate 
          : new Date(schedule.startDate).toISOString();
        const endDateISO = typeof schedule.endDate === 'string' 
          ? schedule.endDate 
          : new Date(schedule.endDate).toISOString();
          
        await shiftsService.deleteEmployeeShifts(scheduleId, employeeId, startDateISO, endDateISO);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
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
      queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
      setEditingEmployeeId(null);
    },
  });

  // Мутация для удаления сотрудника
  const deleteEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => employeesService.deleteEmployee(scheduleId, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
    },
  });

  // Мутация для клонирования сотрудника
  const cloneEmployeeMutation = useMutation({
    mutationFn: (employeeId: string) => employeesService.cloneEmployee(scheduleId, employeeId),
    onSuccess: (newEmployee) => {
      queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
      // Добавляем нового сотрудника в конец списка
      if (newEmployee) {
        setEmployeeOrder(prev => [...prev, newEmployee.id]);
      }
    },
  });

  // Функция обновления смещения паттерна
  // ВАЖНО: НЕ перегенерируем все смены сразу - это слишком долго для года!
  // Обновляем только startIndex в экземплярах, смены перегенерируются при следующем просмотре
  const handlePatternOffsetChange = async (offsetDelta: number) => {
    if (!schedule || !employees) return;
    
    // Защита от множественных одновременных вызовов
    if (patternOffsetChangeRef.current) {
      console.log('[handlePatternOffsetChange] Already in progress, skipping duplicate call...');
      return;
    }

    try {
      console.log('[handlePatternOffsetChange] START', { scheduleId, offsetDelta });
      
      // Создаем промис для отслеживания выполнения
      const updatePromise = (async () => {
        // Обновляем смещение в экземплярах паттернов (включая patternStartOffset в расписании)
        // Это обновляет startIndex для всех экземпляров
        await shiftProfilesService.updatePatternOffset(scheduleId, offsetDelta);
        
        // Обновляем кэш для немедленного отображения изменений
        queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
        queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
        queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
        
        // ВАЖНО: НЕ перегенерируем все смены сразу - это слишком долго!
        // Вместо этого инвалидируем кэш смен, чтобы они перезагрузились при следующем просмотре
        // Смены будут использовать обновленный startIndex при следующей генерации
        queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
        
        console.log('[handlePatternOffsetChange] SUCCESS - startIndex updated, shifts cache invalidated', { 
          scheduleId, 
          offsetDelta,
          note: 'Shifts will use updated startIndex on next generation or view',
        });
      })();
      
      patternOffsetChangeRef.current = updatePromise;
      await updatePromise;
    } catch (error) {
      console.error('[handlePatternOffsetChange] ERROR', error);
      alert('Ошибка обновления смещения паттерна');
    } finally {
      patternOffsetChangeRef.current = null;
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
      
      // Если профиль снят (null), очищаем расписание сотрудника
      if (shiftProfileId === null && schedule) {
        const startDateISO = typeof schedule.startDate === 'string' 
          ? schedule.startDate 
          : new Date(schedule.startDate).toISOString();
        const endDateISO = typeof schedule.endDate === 'string' 
          ? schedule.endDate 
          : new Date(schedule.endDate).toISOString();
          
        await shiftsService.deleteEmployeeShifts(scheduleId, employeeId, startDateISO, endDateISO);
      }
      
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
      queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
    } catch (error: any) {
      console.error('Error updating employee pattern offset:', error);
      alert(`Ошибка обновления смещения паттерна: ${error.response?.data?.message || error.message}`);
    }
  };

  // Обработчик добавления сотрудника
  const handleAddEmployee = () => {
    setIsAddEmployeeModalOpen(true);
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

  // Вычисляем период для статистики
  const periodDates = useMemo(() => {
    if (!schedule) return null;
    
    const startDate = typeof schedule.startDate === 'string' 
      ? parseISO(schedule.startDate) 
      : new Date(schedule.startDate);
    const endDate = typeof schedule.endDate === 'string'
      ? parseISO(schedule.endDate)
      : new Date(schedule.endDate);
    
    return {
      start: startOfDay(startDate),
      end: startOfDay(endDate),
    };
  }, [schedule]);

  // Получаем массив всех смен для статистики
  const allShifts = useMemo(() => {
    if (!shiftsData) return [];
    
    const shiftsArray = Array.isArray(shiftsData) ? shiftsData : shiftsData.items || [];
    
    // Применяем оптимистичные обновления
    const shiftsMap = new Map<string, Shift>();
    shiftsArray.forEach((shift) => {
      let dateObj: Date;
      if (typeof shift.date === 'string') {
        dateObj = parseISO(shift.date);
      } else if (isDate(shift.date)) {
        dateObj = shift.date;
      } else {
        dateObj = new Date(shift.date);
      }
      const normalizedDate = startOfDay(dateObj);
      const dateStr = format(normalizedDate, 'yyyy-MM-dd');
      const key = `${dateStr}-${shift.employeeId}`;
      shiftsMap.set(key, shift);
    });
    
    // Добавляем оптимистичные обновления
    Object.values(optimisticShifts).forEach((shift) => {
      let dateObj: Date;
      if (typeof shift.date === 'string') {
        dateObj = parseISO(shift.date);
      } else if (isDate(shift.date)) {
        dateObj = shift.date;
      } else {
        dateObj = new Date(shift.date);
      }
      const normalizedDate = startOfDay(dateObj);
      const dateStr = format(normalizedDate, 'yyyy-MM-dd');
      const key = `${dateStr}-${shift.employeeId}`;
      shiftsMap.set(key, shift);
    });
    
    return Array.from(shiftsMap.values());
  }, [shiftsData, optimisticShifts]);

  // Компонент статистики для боковой панели
  const sidebarFooter = useMemo(() => {
    if (!schedule || !periodDates || !employees || employees.length === 0) {
      return null;
    }

    const baseCycleStart = startOfDay(new Date(schedule.startDate));

    return (
      <EmployeeStatistics
        employees={sortedEmployees || []}
        shifts={allShifts}
        periodStart={periodDates.start}
        periodEnd={periodDates.end}
        patternInstances={patternInstances || []}
        shiftProfiles={shiftProfiles || []}
        baseCycleStart={baseCycleStart}
        optimisticShifts={optimisticShifts}
        hoveredEmployeeId={hoveredEmployeeId}
      />
    );
  }, [schedule, periodDates, sortedEmployees, allShifts, patternInstances, shiftProfiles, optimisticShifts, hoveredEmployeeId]);

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
    <MainLayout sidebarItems={sidebarItems} sidebarFooter={sidebarFooter}>
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
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsEditPeriodModalOpen(true)}
                    className="h-9 px-3 rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors text-sm font-medium flex items-center"
                  >
                    {schedule && (
                      <>
                        {format(new Date(schedule.startDate), 'dd MMMM yyyy', { locale: ru })} -{' '}
                        {format(new Date(schedule.endDate), 'dd MMMM yyyy', { locale: ru })}
                      </>
                    )}
                  </button>
                  {/* Настройки ТК РФ */}
                  <button
                    onClick={() => setIsLaborSettingsOpen(true)}
                    className="relative h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                    title="Настройки ТК РФ"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
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

                  {/* Проверка ТК РФ */}
                  <div className="relative">
                    <button
                      onClick={() => setIsLaborViolationsModalOpen(true)}
                      className="relative h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                      title="Проверка ТК РФ"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                        />
                      </svg>
                    </button>
                    {violationStats && violationStats.unresolved > 0 && (
                      <Badge
                        variant="danger"
                        className="absolute -top-2 -right-2"
                      >
                        {violationStats.unresolved}
                      </Badge>
                    )}
                  </div>

                  {/* Запросы на обмен */}
                  <div className="relative">
                    <button
                      onClick={() => setIsSwapRequestsModalOpen(true)}
                      className="relative h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                      title="Запросы на обмен"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    </button>
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

            {employees && employees.length > 0 ? (
              (() => {
                // Представление ростера: всегда через движок паттернов
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
                          console.log('[MainSchedule] Updating shift in DB', {
                            scheduleId,
                            shiftId: existingShift.id,
                            employeeId,
                            date: dateISO,
                            shiftTypeId,
                          });
                          const updatedShift = await shiftsService.updateShift(scheduleId, existingShift.id, {
                            shiftTypeId,
                            status: 'modified',
                          });
                          console.log('[MainSchedule] Shift updated in DB', {
                            shiftId: updatedShift.id,
                            employeeId,
                            date: dateISO,
                          });
                        } else {
                          // Если смены нет в кэше, создаём новую (сервер использует upsert)
                          // Сервер сам обработает случай, если смена уже существует
                          console.log('[MainSchedule] Creating shift in DB', {
                            scheduleId,
                            employeeId,
                            date: dateISO,
                            shiftTypeId,
                          });
                          const createdShift = await shiftsService.createShift(scheduleId, {
                            employeeId,
                            date: dateISO,
                            shiftTypeId,
                          });
                          console.log('[MainSchedule] Shift created in DB', {
                            shiftId: createdShift.id,
                            employeeId,
                            date: dateISO,
                          });
                        }
                      }
                    
                    // Обновляем кэш смен после успешного сохранения
                    await refetchShifts();
                    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
                    
                    // ВАЖНО: Обновляем снимок ростера при изменении смен
                    // Это обеспечивает синхронизацию с VacationMode
                    queryClient.invalidateQueries({ queryKey: ['roster-snapshot', scheduleId] });
                    
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
                          onEmployeeToggleVisibility={(employeeId, isHidden) => {
                            toggleVisibilityMutation.mutate({ employeeId, isHidden });
                          }}
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
                          onEmployeeMouseEnter={setHoveredEmployeeId}
                          onEmployeeMouseLeave={() => setHoveredEmployeeId(null)}
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
                  isOpen={!!editingEmployeeId && editingEmployeeId !== 'new'}
                  onClose={() => setEditingEmployeeId(null)}
                  onSave={async (data) => {
                    if (editingEmployeeId && editingEmployeeId !== 'new') {
                      await updateEmployeeMutation.mutateAsync(data);
                    }
                  }}
                  employee={editingEmployeeId && editingEmployeeId !== 'new' ? employees?.find(e => e.id === editingEmployeeId) : null}
                  departments={schedule.departments || []}
                  positions={positions || []}
                  scheduleId={scheduleId}
                  isLoading={updateEmployeeMutation.isPending}
                />
                <AddEmployeeToRosterModal
                  isOpen={isAddEmployeeModalOpen}
                  onClose={() => setIsAddEmployeeModalOpen(false)}
                  scheduleId={scheduleId}
                  departments={schedule.departments || []}
                  positions={positions || []}
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

        {/* Модальное окно помощи */}
        <Modal
          isOpen={isHelpOpen}
          onClose={() => setIsHelpOpen(false)}
          title="Помощь по разделу 'Ростер'"
          size="lg"
        >
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Как назначить смену</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Кликните на ячейку в календаре для выбранного сотрудника и даты.</li>
                <li>Выберите тип смены из появившегося меню.</li>
                <li>Смена будет назначена автоматически.</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Как удалить смену</h3>
              <p className="text-gray-700">
                Кликните на ячейку с назначенной сменой и выберите "Удалить" или "Очистить" в меню.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Визуальные обозначения</h3>
              <ul className="list-disc list-inside space-y-1 text-gray-700">
                <li>Цветные ячейки - назначенные смены</li>
                <li>Буквы в ячейках - сокращенное название типа смены</li>
                <li>👑 - день рождения сотрудника</li>
                <li>Серые ячейки - выходные дни или неактивные периоды</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Настройки</h3>
              <p className="text-gray-700">
                В настройках можно изменить период расписания, настроить параметры контроля Трудового кодекса РФ, проверить нарушения и управлять запросами на обмен сменами.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </MainLayout>
  );
}
