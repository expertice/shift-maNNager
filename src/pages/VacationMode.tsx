import React, { useState, useMemo } from 'react';
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
  Badge,
} from '@components/common';
import { vacationsService, schedulesService, employeesService } from '@services/api';
import { useRealtime } from '@hooks/useRealtime';
import { Vacation, Employee } from '@types';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWithinInterval,
  addDays,
  subDays,
} from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Страница режима отпусков
 */
export default function VacationMode() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [vacationData, setVacationData] = useState<{
    employeeId: string;
    startDate: string;
    endDate: string;
  } | null>(null);

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

  // Real-time обновления
  useRealtime(scheduleId, () => {
    queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
  });

  // Создание отпуска
  const createMutation = useMutation({
    mutationFn: (data: {
      employeeId: string;
      startDate: string;
      endDate: string;
      status?: 'approved' | 'pending';
    }) => vacationsService.createVacation(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
      setIsCreateModalOpen(false);
      setVacationData(null);
      setSelectionStart(null);
      setSelectionEnd(null);
    },
  });

  // Удаление отпуска
  const deleteMutation = useMutation({
    mutationFn: (vacationId: string) => vacationsService.deleteVacation(scheduleId, vacationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacations', scheduleId] });
    },
  });

  // Получаем даты месяца для отображения
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Группируем отпуска по датам и сотрудникам
  const vacationsByDate = useMemo(() => {
    const map = new Map<string, Vacation[]>();
    vacations?.forEach((vacation) => {
      const dates = eachDayOfInterval({
        start: new Date(vacation.startDate),
        end: new Date(vacation.endDate),
      });
      dates.forEach((date) => {
        const key = format(date, 'yyyy-MM-dd');
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key)!.push(vacation);
      });
    });
    return map;
  }, [vacations]);

  const getVacationsForDate = (date: Date): Vacation[] => {
    const key = format(date, 'yyyy-MM-dd');
    return vacationsByDate.get(key) || [];
  };

  const handleDateClick = (date: Date, employeeId: string) => {
    if (!selectedEmployee) {
      setSelectedEmployee(employeeId);
    }

    if (!selectionStart || selectionEnd) {
      setSelectionStart(date);
      setSelectionEnd(null);
    } else if (selectionStart && !selectionEnd) {
      const start = selectionStart < date ? selectionStart : date;
      const end = selectionStart < date ? date : selectionStart;
      setSelectionStart(start);
      setSelectionEnd(end);
      
      // Открываем модальное окно для подтверждения
      setVacationData({
        employeeId: selectedEmployee || employeeId,
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      });
      setIsCreateModalOpen(true);
    }
  };

  const handleCreateVacation = () => {
    if (vacationData) {
      createMutation.mutate({
        ...vacationData,
        status: 'approved',
      });
    }
  };

  const isValidRange =
    vacationData &&
    vacationData.startDate &&
    vacationData.endDate &&
    new Date(vacationData.endDate) >= new Date(vacationData.startDate) &&
    schedule &&
    new Date(vacationData.startDate) >= new Date(schedule.startDate) &&
    new Date(vacationData.endDate) <= new Date(schedule.endDate);

  const isLoading = scheduleLoading || employeesLoading || vacationsLoading;

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
          <div>
            <h1 className="text-3xl font-bold">Режим отпусков</h1>
            <p className="text-gray-600 mt-1">
              Выберите сотрудника и отметьте даты отпуска на календаре
            </p>
          </div>
          <Button onClick={() => navigate(`/schedule/${scheduleId}`)} variant="outline">
            Назад к расписанию
          </Button>
        </div>

        {/* Выбор сотрудника */}
        <Card className="mb-6 p-4">
          <Select
            label="Выберите сотрудника"
            value={selectedEmployee}
            onChange={(e) => {
              setSelectedEmployee(e.target.value);
              setSelectionStart(null);
              setSelectionEnd(null);
            }}
            options={
              employees?.map((emp) => ({
                value: emp.id,
                label: `${emp.fullName} (${emp.tabNumber})`,
              })) || []
            }
            placeholder="Выберите сотрудника"
          />
        </Card>

        {/* Календарь */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {schedule && employees && !isLoading && (
          <Card padding="none" className="overflow-x-auto">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  {format(selectedMonth, 'MMMM yyyy', { locale: ru })}
                </h3>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedMonth(subDays(startOfMonth(selectedMonth), 1))}
                  >
                    ←
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedMonth(new Date())}
                  >
                    Сегодня
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedMonth(addDays(endOfMonth(selectedMonth), 1))}
                  >
                    →
                  </Button>
                </div>
              </div>
            </div>

            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase border-r min-w-[200px]">
                    Сотрудник
                  </th>
                  {monthDays.map((day) => (
                    <th
                      key={day.toISOString()}
                      className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase min-w-[60px]"
                    >
                      <div className="flex flex-col">
                        <span className="font-bold">{format(day, 'd')}</span>
                        <span className="text-xs font-normal text-gray-400">
                          {format(day, 'EEE', { locale: ru })}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => (
                  <tr key={employee.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap border-r">
                      <div className="text-sm font-medium">{employee.fullName}</div>
                      <div className="text-xs text-gray-500">{employee.tabNumber}</div>
                    </td>
                    {monthDays.map((day) => {
                      const dayVacations = getVacationsForDate(day).filter(
                        (v) => v.employeeId === employee.id
                      );
                      const isInRange =
                        selectionStart &&
                        selectionEnd &&
                        selectedEmployee === employee.id &&
                        isWithinInterval(day, {
                          start: selectionStart,
                          end: selectionEnd,
                        });
                      const isStart =
                        selectionStart &&
                        isSameDay(day, selectionStart) &&
                        selectedEmployee === employee.id;
                      const isEnd =
                        selectionEnd &&
                        isSameDay(day, selectionEnd) &&
                        selectedEmployee === employee.id;

                      return (
                        <td
                          key={`${employee.id}-${day.toISOString()}`}
                          className={`px-1 py-2 text-center border cursor-pointer ${
                            dayVacations.length > 0
                              ? 'bg-yellow-100 hover:bg-yellow-200'
                              : isInRange
                              ? 'bg-blue-100 hover:bg-blue-200'
                              : isStart || isEnd
                              ? 'bg-primary text-white hover:bg-primary-dark'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => handleDateClick(day, employee.id)}
                          title={
                            dayVacations.length > 0
                              ? `Отпуск: ${format(
                                  new Date(dayVacations[0].startDate),
                                  'dd.MM.yyyy'
                                )} - ${format(
                                  new Date(dayVacations[0].endDate),
                                  'dd.MM.yyyy'
                                )}`
                              : 'Кликните для выбора отпуска'
                          }
                        >
                          {dayVacations.length > 0 && (
                            <div className="flex items-center justify-center">
                              <Badge variant="warning" size="sm">
                                Отпуск
                              </Badge>
                            </div>
                          )}
                          {(isStart || isEnd) && (
                            <div className="text-xs font-bold">
                              {isStart && selectionEnd ? 'Начало' : 'Конец'}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Список существующих отпусков */}
        {vacations && vacations.length > 0 && (
          <Card className="mt-6">
            <h3 className="text-lg font-semibold mb-4">Текущие отпуска</h3>
            <div className="space-y-2">
              {vacations.map((vacation) => {
                const employee = employees?.find((e) => e.id === vacation.employeeId);
                return (
                  <div
                    key={vacation.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {employee?.fullName || 'Неизвестный сотрудник'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {format(new Date(vacation.startDate), 'dd.MM.yyyy', { locale: ru })} -{' '}
                        {format(new Date(vacation.endDate), 'dd.MM.yyyy', { locale: ru })}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
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
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          if (window.confirm('Удалить этот отпуск?')) {
                            deleteMutation.mutate(vacation.id);
                          }
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Модальное окно создания отпуска */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setVacationData(null);
            setSelectionStart(null);
            setSelectionEnd(null);
          }}
          title="Создать отпуск"
        >
          {vacationData && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-sm space-y-2">
                  <p>
                    <strong>Сотрудник:</strong>{' '}
                    {employees?.find((e) => e.id === vacationData.employeeId)?.fullName}
                  </p>
                  <p>
                    <strong>Период:</strong> {format(new Date(vacationData.startDate), 'dd.MM.yyyy', { locale: ru })} -{' '}
                    {format(new Date(vacationData.endDate), 'dd.MM.yyyy', { locale: ru })}
                  </p>
                  <p>
                    <strong>Дней:</strong>{' '}
                    {Math.ceil(
                      (new Date(vacationData.endDate).getTime() -
                        new Date(vacationData.startDate).getTime()) /
                        (1000 * 60 * 60 * 24)
                    ) + 1}
                  </p>
                </div>
              </div>

              {!isValidRange && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    Выбранный период выходит за рамки расписания или некорректен
                  </p>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setVacationData(null);
                    setSelectionStart(null);
                    setSelectionEnd(null);
                  }}
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleCreateVacation}
                  isLoading={createMutation.isPending}
                  disabled={!isValidRange}
                >
                  Создать отпуск
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </MainLayout>
  );
}
