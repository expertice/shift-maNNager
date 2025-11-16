import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Spinner, Modal, Select, Badge } from '@components/common';
import classNames from 'classnames';
import { schedulesService, employeesService, shiftsService, vacationsService, shiftProfilesService, patternInstancesService } from '@services/api';
import { useRealtime } from '@hooks/useRealtime';
import { Employee, Shift } from '@types';
import { parseISO, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { parseLocalDate } from '@/utils/dateUtils';
import { splitPeriodByMonths } from '@/utils/rosterCalendar';
import VacationScheduler from '@components/vacations/VacationScheduler';
import VacationSettingsPanel from '@components/vacations/VacationSettingsPanel';
import { Save, Trash2, Printer, Calendar, Grid3x3, GitCompare, HelpCircle } from 'lucide-react';
import RosterSyncComparisonModal from '@components/vacations/RosterSyncComparisonModal';

/**
 * Страница режима отпусков
 */
export default function VacationMode() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isVacationsListOpen, setIsVacationsListOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'compact' | 'roster'>('roster'); // Режим ростера по умолчанию
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [handleSave, setHandleSave] = useState<(() => Promise<void>) | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [employeeOrder, setEmployeeOrder] = useState<string[]>([]); // Порядок сотрудников для синхронизации с MainSchedule
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false); // Состояние модального окна сравнения

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка расписания
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

  // Загрузка отпусков
  const { data: vacations, isLoading: vacationsLoading } = useQuery({
    queryKey: ['vacations', scheduleId],
    queryFn: () => vacationsService.getVacations(scheduleId),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Загрузка смен для отображения
  const { data: shiftsData, refetch: refetchShifts } = useQuery({
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
        limit: 1000, // Большое число для загрузки всех смен (как в MainSchedule)
      });
    },
    enabled: !!scheduleId && !!schedule,
    staleTime: 0, // Считаем данные устаревшими сразу для актуальности
    refetchOnMount: true, // Обновлять при монтировании компонента
    refetchOnWindowFocus: true, // Обновлять при возврате в окно
  });

  // Загрузка профилей смен для получения цветов
  const { data: shiftProfiles } = useQuery({
    queryKey: ['shiftProfiles', scheduleId],
    queryFn: () => scheduleId ? shiftProfilesService.getShiftProfiles(scheduleId) : Promise.resolve([]),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Загрузка экземпляров паттернов (как в MainSchedule)
  const { data: patternInstances } = useQuery({
    queryKey: ['patternInstances', scheduleId],
    queryFn: () => patternInstancesService.getInstances(scheduleId),
    enabled: !!scheduleId,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Real-time обновления - обновляем данные при изменениях в ростере смен
  useRealtime(scheduleId, (event) => {
    // Обновляем данные при real-time событиях (как в MainSchedule)
    refetchShifts();
    queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['employees', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['shiftProfiles', scheduleId] });
    queryClient.invalidateQueries({ queryKey: ['patternInstances', scheduleId] });
  });


  // Преобразуем смены в Map для быстрого доступа
  // Используем только смены из API (как в MainSchedule)
  // ВАЖНО: Нормализуем даты через startOfDay и format для консистентности с VacationRosterView
  const shiftsByDateAndEmployee = useMemo(() => {
    const map = new Map<string, Shift>();
    
    // Функция для нормализации даты - используем startOfDay для консистентности
    const normalizeDate = (date: Date | string): string => {
      const dateObj = typeof date === 'string' ? parseISO(date) : date;
      return format(startOfDay(dateObj), 'yyyy-MM-dd');
    };
    
    // Используем только смены из API (как в MainSchedule)
    if (shiftsData?.items && shiftsData.items.length > 0) {
      shiftsData.items.forEach(shift => {
        const dateStr = normalizeDate(shift.date);
        const key = `${dateStr}-${shift.employeeId}`;
        map.set(key, shift);
      });
    }
    
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

  // Загружаем порядок сотрудников из localStorage (как в MainSchedule)
  React.useEffect(() => {
    if (employees && employees.length > 0 && scheduleId) {
      const employeeIds = new Set(employees.map(emp => emp.id));
      
      // Загружаем из localStorage (как в MainSchedule)
      const savedOrder = localStorage.getItem(`employeeOrder_${scheduleId}`);
      if (savedOrder) {
        try {
          const parsedOrder = JSON.parse(savedOrder);
          if (Array.isArray(parsedOrder) && parsedOrder.length > 0) {
            const validOrder = parsedOrder.filter(id => employeeIds.has(id));
            const visibleEmployees = employees.filter(emp => !emp.isHidden);
            const visibleIds = new Set(visibleEmployees.map(emp => emp.id));
            const existingVisible = validOrder.filter(id => visibleIds.has(id));
            
            if (existingVisible.length > 0) {
              setEmployeeOrder(existingVisible);
              return;
            }
          }
        } catch (error) {
          console.error('Error parsing saved employee order:', error);
        }
      }
      
      // Если порядка нет, используем порядок из массива видимых сотрудников
      setEmployeeOrder(employees.filter(emp => !emp.isHidden).map(emp => emp.id));
    }
  }, [employees, scheduleId]);

  // Фильтруем только видимых сотрудников и сортируем по порядку из MainSchedule
  const visibleEmployees = useMemo(() => {
    if (!employees) return [];
    const visible = employees.filter(emp => !emp.isHidden);
    
    // Если есть порядок сотрудников, применяем его
    if (employeeOrder.length > 0) {
      const orderMap = new Map(employeeOrder.map((id, index) => [id, index]));
      const sorted = [...visible].sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Infinity;
        const bIndex = orderMap.get(b.id) ?? Infinity;
        return aIndex - bIndex;
      });
      
      // Добавляем новых видимых сотрудников в конец
      const newEmployees = visible.filter(emp => !orderMap.has(emp.id));
      return [...sorted, ...newEmployees];
    }
    
    return visible;
  }, [employees, employeeOrder]);

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
            <button
              onClick={() => setIsHelpOpen(true)}
              className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
              title="Помощь"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {/* Переключатель режимов просмотра */}
            <div className="flex items-center gap-1 border border-gray-300 rounded-lg bg-white p-1">
              <button
                onClick={() => {
                  setViewMode('compact');
                  setSelectedEmployeeId('');
                }}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'compact'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Компактный календарь"
              >
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  setViewMode('roster');
                  setSelectedEmployeeId('');
                }}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'roster'
                    ? 'bg-primary text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                title="Ростер"
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Блок кнопок действий */}
            {viewMode === 'compact' && (
              <div className="w-48">
                <Select
                  value={selectedEmployeeId}
                  onChange={(e) => {
                    setSelectedEmployeeId(e.target.value);
                  }}
                  options={employeeOptions}
                  placeholder="Сотрудник"
                  className="border border-gray-300 focus:border-primary focus:ring-primary text-sm"
                />
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsComparisonModalOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                title="Проверить синхронность с ростером смен"
              >
                <GitCompare className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsVacationsListOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                title="Список отпусков"
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
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </button>
              <button
                onClick={() => {
                  if (!schedule || !employees || !vacations) {
                    alert('Данные еще не загружены. Пожалуйста, подождите.');
                    return;
                  }

                  // Используем visibleEmployees, который уже отсортирован по порядку из ростера
                  // Это гарантирует, что порядок сотрудников при печати совпадает с порядком в ростерах
                  
                  // Разбиваем период на месяцы
                  const months = splitPeriodByMonths(scheduleStart, scheduleEnd);
                  
                  // Функция для получения смены
                  const getShiftForDate = (date: Date, employeeId: string): Shift | null => {
                    if (!shiftsByDateAndEmployee) return null;
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const key = `${dateStr}-${employeeId}`;
                    return shiftsByDateAndEmployee.get(key) || null;
                  };
                  
                  // Функция для получения типа смены
                  const getShiftType = (shift: Shift | null) => {
                    if (!shift || !shift.shiftTypeId) return null;
                    return shiftTypes.find(st => st.id === shift.shiftTypeId) || null;
                  };
                  
                  // Создаем версию для печати
                  const printWindow = window.open('', '_blank');
                  if (!printWindow) {
                    alert('Не удалось открыть окно для печати. Проверьте настройки блокировки всплывающих окон.');
                    return;
                  }

                  // Генерируем страницы для каждого месяца
                  const monthPages = months.map((monthSlice, monthIndex) => {
                    const monthStart = startOfMonth(new Date(monthSlice.year, monthSlice.month, 1));
                    const monthEnd = endOfMonth(monthStart);
                    const daysInMonth = monthSlice.daysInMonth;
                    
                    // Определяем реальные границы месяца в рамках периода
                    const actualStart = monthStart < scheduleStart ? scheduleStart : monthStart;
                    const actualEnd = monthEnd > scheduleEnd ? scheduleEnd : monthEnd;
                    
                    // Генерируем заголовки дней для месяца
                    const dayHeaders: string[] = [];
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(monthSlice.year, monthSlice.month, day);
                      const dayOfWeek = date.getDay();
                      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                      const isInPeriod = date >= scheduleStart && date <= scheduleEnd;
                      const weekday = ['ВС', 'ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ'][dayOfWeek];
                      
                      dayHeaders.push(
                        `<th class="${isWeekend ? 'weekend' : ''} ${!isInPeriod ? 'outside-period' : ''}">
                          <div class="day-number">${day}</div>
                          <div class="day-weekday">${weekday}</div>
                        </th>`
                      );
                    }

                    // Генерируем строки для сотрудников (используем visibleEmployees для сохранения порядка из ростера)
                    const employeeRows = visibleEmployees.map(employee => {
                      const employeeVacations = vacations.filter(v => v.employeeId === employee.id);
                      const vacationDays = new Set<string>();
                      employeeVacations.forEach(vacation => {
                        const start = parseLocalDate(vacation.startDate);
                        const end = parseLocalDate(vacation.endDate);
                        const current = new Date(start);
                        while (current <= end) {
                          vacationDays.add(format(current, 'yyyy-MM-dd'));
                          current.setDate(current.getDate() + 1);
                        }
                      });
                      
                      const days: string[] = [];
                      for (let day = 1; day <= daysInMonth; day++) {
                        const date = new Date(monthSlice.year, monthSlice.month, day);
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const isVacation = vacationDays.has(dateStr);
                        const dayOfWeek = date.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                        const isInPeriod = date >= scheduleStart && date <= scheduleEnd;
                        
                        // Получаем смену, если нет отпуска
                        let shiftContent = '';
                        if (!isVacation && isInPeriod) {
                          const shift = getShiftForDate(date, employee.id);
                          const shiftType = getShiftType(shift);
                          if (shiftType) {
                            // Берем первую букву названия смены
                            const shiftLetter = shiftType.name?.charAt(0).toUpperCase() || '';
                            shiftContent = `<div class="shift-mark">${shiftLetter}</div>`;
                          }
                        }
                        
                        days.push(
                          `<td class="${isVacation ? 'vacation-day' : isWeekend ? 'weekend' : ''} ${!isInPeriod ? 'outside-period' : ''}">
                            ${isVacation ? '<div class="vacation-mark">О</div>' : shiftContent}
                          </td>`
                        );
                      }
                      
                      // Формируем информацию о сотруднике с переносами
                      const employeeInfo = [
                        employee.fullName,
                        employee.tabNumber ? `Т/Н: ${employee.tabNumber}` : '',
                        employee.position?.name || ''
                      ].filter(Boolean).join('<br>');
                      
                      return `
                        <tr>
                          <td class="employee-name">${employeeInfo}</td>
                          ${days.join('')}
                        </tr>
                      `;
                    }).join('');

                    const monthName = format(monthStart, 'LLLL yyyy', { locale: ru });
                    const isLastMonth = monthIndex === months.length - 1;

                    return `
                      <div class="month-page ${isLastMonth ? '' : 'page-break'}">
                        <div class="month-header">
                          <h2>Ростер отпусков</h2>
                          <div class="month-title">${schedule.name || 'Расписание'} - ${monthName}</div>
                        </div>
                        <div class="table-container">
                          <table>
                            <thead>
                              <tr>
                                <th class="employee-name">Сотрудник</th>
                                ${dayHeaders.join('')}
                              </tr>
                            </thead>
                            <tbody>
                              ${employeeRows}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    `;
                  }).join('');

                  // Получаем данные для печати
                  const printContent = `
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta charset="UTF-8">
                        <title>Ростер отпусков - ${schedule.name || 'Расписание'}</title>
                        <style>
                          @media print {
                            @page {
                              size: A4 landscape;
                              margin: 5mm;
                            }
                            body {
                              margin: 0;
                              padding: 0;
                              font-family: Arial, sans-serif;
                            }
                            .page-break {
                              page-break-after: always;
                            }
                            .month-page {
                              width: 100%;
                              height: 100%;
                              display: flex;
                              flex-direction: column;
                              overflow: hidden;
                              padding: 0;
                            }
                            .month-header {
                              flex-shrink: 0;
                              margin-bottom: 5mm;
                            }
                            .table-container {
                              flex: 1;
                              overflow: hidden;
                              min-height: 0;
                            }
                            table {
                              font-size: 7pt;
                              height: 100%;
                            }
                            th, td {
                              padding: 2px 3px;
                            }
                            .employee-name {
                              width: 100px;
                              font-size: 6pt;
                              line-height: 1.2;
                              white-space: normal;
                              word-wrap: break-word;
                              padding: 2px 3px;
                            }
                            .day-number {
                              font-size: 8pt;
                              font-weight: bold;
                            }
                            .day-weekday {
                              font-size: 6pt;
                              color: #666;
                            }
                            .vacation-mark {
                              font-weight: bold;
                              font-size: 9pt;
                            }
                            .shift-mark {
                              color: #999;
                              font-size: 7pt;
                              opacity: 0.5;
                              font-weight: normal;
                            }
                          }
                          body {
                            margin: 0;
                            padding: 0;
                            font-family: Arial, sans-serif;
                            font-size: 9pt;
                          }
                          .month-page {
                            padding: 8mm;
                            width: 100%;
                            height: 100vh;
                            display: flex;
                            flex-direction: column;
                            box-sizing: border-box;
                          }
                          .month-header {
                            text-align: center;
                            margin-bottom: 8mm;
                            border-bottom: 2px solid #000;
                            padding-bottom: 4mm;
                            flex-shrink: 0;
                          }
                          .month-header h2 {
                            margin: 0;
                            font-size: 16pt;
                            font-weight: bold;
                          }
                          .month-title {
                            margin-top: 2mm;
                            font-size: 12pt;
                          }
                          .table-container {
                            flex: 1;
                            overflow: hidden;
                            min-height: 0;
                            display: flex;
                            flex-direction: column;
                            height: 100%;
                          }
                          table {
                            width: 100%;
                            height: 100%;
                            border-collapse: collapse;
                            table-layout: fixed;
                            font-size: 8pt;
                            display: table;
                          }
                          tbody {
                            display: table-row-group;
                          }
                          tr {
                            height: 1px;
                          }
                          td {
                            vertical-align: middle;
                          }
                          th, td {
                            border: 1px solid #000;
                            padding: 3px 4px;
                            text-align: center;
                            overflow: hidden;
                            text-overflow: ellipsis;
                          }
                          th {
                            background-color: #f0f0f0;
                            font-weight: bold;
                            position: sticky;
                            top: 0;
                            z-index: 10;
                          }
                          .employee-name {
                            text-align: left;
                            font-weight: bold;
                            width: 120px;
                            font-size: 7pt;
                            line-height: 1.2;
                            white-space: normal;
                            word-wrap: break-word;
                            padding: 4px 6px;
                          }
                          .shift-mark {
                            color: #999;
                            font-size: 8pt;
                            opacity: 0.5;
                          }
                          .vacation-day {
                            background-color: #ffeb3b;
                            font-weight: bold;
                          }
                          .weekend {
                            background-color: #f5f5f5;
                          }
                          .outside-period {
                            background-color: #e0e0e0;
                            opacity: 0.5;
                          }
                          .day-number {
                            font-size: 9pt;
                            font-weight: bold;
                          }
                          .day-weekday {
                            font-size: 7pt;
                            color: #666;
                            margin-top: 1px;
                          }
                          .vacation-mark {
                            font-weight: bold;
                            font-size: 10pt;
                          }
                          .shift-mark {
                            color: #999;
                            font-size: 8pt;
                            opacity: 0.5;
                            font-weight: normal;
                          }
                        </style>
                      </head>
                      <body>
                        ${monthPages}
                      </body>
                    </html>
                  `;

                  printWindow.document.write(printContent);
                  printWindow.document.close();
                  
                  // Ждем загрузки и печатаем
                  printWindow.onload = () => {
                    setTimeout(() => {
                      printWindow.print();
                      printWindow.close();
                    }, 250);
                  };
                }}
                className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                title="Печать ростера отпусков"
              >
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="h-9 w-9 flex items-center justify-center rounded-lg border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors"
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
            employees={visibleEmployees}
            vacations={vacations || []}
            shiftsByDateAndEmployee={shiftsByDateAndEmployee}
            shiftTypes={shiftTypes}
            patternInstances={patternInstances || []}
            baseCycleStart={startOfDay(new Date(schedule.startDate))}
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
          headerActions={
            handleSave && (
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed p-1"
                aria-label="Сохранить настройки"
                title="Сохранить настройки"
              >
                {isSaving ? (
                  <svg
                    className="animate-spin h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            )
          }
        >
          {employees && (
            <VacationSettingsPanel
              scheduleId={scheduleId}
              employees={visibleEmployees}
              scheduleStart={scheduleStart}
              onClose={() => setIsSettingsOpen(false)}
              onSaveReady={(saveHandler, saving) => {
                setHandleSave(() => saveHandler);
                setIsSaving(saving);
              }}
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

        {/* Модальное окно со списком отпусков */}
        <Modal
          isOpen={isVacationsListOpen}
          onClose={() => setIsVacationsListOpen(false)}
          title="Назначенные отпуска"
          size="lg"
        >
          {vacations && vacations.length > 0 ? (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                // Группируем отпуска по сотрудникам
                const vacationsByEmployee = new Map<string, typeof vacations>();
                vacations.forEach((vacation) => {
                  const employeeId = vacation.employeeId;
                  if (!vacationsByEmployee.has(employeeId)) {
                    vacationsByEmployee.set(employeeId, []);
                  }
                  vacationsByEmployee.get(employeeId)!.push(vacation);
                });

                return Array.from(vacationsByEmployee.entries()).map(([employeeId, employeeVacations]) => {
                  const employee = employees?.find(e => e.id === employeeId);
                  return (
                    <div key={employeeId} className="bg-gray-50 rounded-lg p-4">
                      <div className="font-semibold text-lg mb-3">
                        {employee?.fullName || 'Неизвестный сотрудник'}
                        {employee?.tabNumber && (
                          <span className="text-gray-500 ml-2 text-base font-normal">({employee.tabNumber})</span>
                        )}
                      </div>
                      <div className="space-y-2">
                        {employeeVacations.map((vacation) => (
                          <div
                            key={vacation.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="text-sm text-gray-700">
                                {format(parseLocalDate(vacation.startDate), 'dd.MM.yyyy', { locale: ru })} -{' '}
                                {format(parseLocalDate(vacation.endDate), 'dd.MM.yyyy', { locale: ru })}
                              </div>
                              <Badge
                                variant={
                                  vacation.status === 'approved'
                                    ? 'success'
                                    : vacation.status === 'rejected'
                                    ? 'danger'
                                    : 'default'
                                }
                              >
                                {vacation.status === 'approved'
                                  ? 'Утвержден'
                                  : vacation.status === 'rejected'
                                  ? 'Отклонен'
                                  : 'Ожидает'}
                              </Badge>
                            </div>
                            <button
                              onClick={async () => {
                                if (window.confirm('Удалить этот период отпуска?')) {
                                  try {
                                    await vacationsService.deleteVacation(scheduleId, vacation.id);
                                    queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
                                  } catch (error: any) {
                                    alert(error.message || 'Ошибка при удалении отпуска');
                                  }
                                }
                              }}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              title="Удалить период отпуска"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Нет назначенных отпусков
            </div>
          )}
        </Modal>

        {/* Модальное окно проверки синхронности */}
        {schedule && employees && (
          <RosterSyncComparisonModal
            isOpen={isComparisonModalOpen}
            onClose={() => setIsComparisonModalOpen(false)}
            scheduleId={scheduleId!}
            scheduleStart={scheduleStart}
            scheduleEnd={scheduleEnd}
            employees={employees}
          />
        )}
      </div>
    </MainLayout>
  );
}
