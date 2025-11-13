import React, { useMemo } from 'react';
import { Shift, Employee, ShiftProfile, ShiftType } from '@types';
import { startOfDay, isWithinInterval, eachDayOfInterval, format } from 'date-fns';
import { useUIStore } from '@store/useUIStore';
import { computePositionInCycle } from '@/utils/patternCycle';
import type { RosterPatternInstanceDTO } from '@services/api/patternInstancesService';

/**
 * Вспомогательная функция для определения контрастного цвета текста
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export interface EmployeeStatisticsProps {
  employees: Employee[];
  shifts: Shift[];
  periodStart: Date;
  periodEnd: Date;
  patternInstances?: RosterPatternInstanceDTO[];
  shiftProfiles?: ShiftProfile[];
  baseCycleStart: Date;
  optimisticShifts?: Record<string, Shift>;
  hoveredEmployeeId?: string | null;
}

interface ShiftTypeInfo {
  id: string;
  name: string;
  color?: string;
  startTime?: string;
  endTime?: string;
  count: number; // Количество смен этого типа за период
}

interface EmployeeStats {
  employeeId: string;
  employeeName: string;
  shiftsCount: number;
  totalHours: number;
  nightHours: number;
  shiftTypes: ShiftTypeInfo[];
}

/**
 * Компонент статистики по сотрудникам за период
 */
export const EmployeeStatistics: React.FC<EmployeeStatisticsProps> = ({
  employees,
  shifts,
  periodStart,
  periodEnd,
  patternInstances = [],
  shiftProfiles = [],
  baseCycleStart,
  optimisticShifts = {},
  hoveredEmployeeId = null,
}) => {
  const { sidebarCollapsed } = useUIStore();

  // Создаем мапу паттернов по employeeId
  const patternInstancesMap = useMemo(() => {
    const map = new Map<string, RosterPatternInstanceDTO>();
    patternInstances.forEach((instance) => {
      map.set(instance.employeeId, instance);
    });
    return map;
  }, [patternInstances]);

  // Создаем мапу типов смен по ID
  const shiftTypesMap = useMemo(() => {
    const map = new Map<string, ShiftType>();
    shiftProfiles.forEach((profile) => {
      (profile.shiftTypes || []).forEach((shiftType) => {
        map.set(shiftType.id, shiftType);
      });
    });
    return map;
  }, [shiftProfiles]);

  // Создаем мапу смен по ключу "date-employeeId"
  const shiftsMap = useMemo(() => {
    const map = new Map<string, Shift>();
    shifts.forEach((shift) => {
      let shiftDate: Date;
      if (typeof shift.date === 'string') {
        shiftDate = new Date(shift.date);
      } else {
        shiftDate = shift.date;
      }
      const dateStr = format(startOfDay(shiftDate), 'yyyy-MM-dd');
      const key = `${dateStr}-${shift.employeeId}`;
      map.set(key, shift);
    });
    
    // Добавляем оптимистичные обновления
    Object.entries(optimisticShifts).forEach(([key, shift]) => {
      map.set(key, shift);
    });
    
    return map;
  }, [shifts, optimisticShifts]);

  // Вычисляем статистику для каждого сотрудника
  const statistics = useMemo(() => {
    // Фильтруем только видимых сотрудников (не скрытых)
    const visibleEmployees = employees.filter(emp => !emp.isHidden);
    
    const statsMap = new Map<string, EmployeeStats>();

    // Инициализируем статистику только для видимых сотрудников
    visibleEmployees.forEach((emp) => {
      statsMap.set(emp.id, {
        employeeId: emp.id,
        employeeName: emp.fullName,
        shiftsCount: 0,
        totalHours: 0,
        nightHours: 0,
        shiftTypes: [],
      });
    });

    const periodStartDay = startOfDay(periodStart);
    const periodEndDay = startOfDay(periodEnd);
    const periodDays = eachDayOfInterval({ start: periodStartDay, end: periodEndDay });

    // Для каждого сотрудника собираем уникальные типы смен с их данными и количеством
    const shiftTypesByEmployee = new Map<string, Map<string, ShiftTypeInfo>>();
    visibleEmployees.forEach((emp) => {
      shiftTypesByEmployee.set(emp.id, new Map());
    });

    // Проходим по всем дням периода и видимым сотрудникам
    periodDays.forEach((currentDate) => {
      visibleEmployees.forEach((employee) => {
        const stats = statsMap.get(employee.id);
        if (!stats) return;

        const dateStr = format(startOfDay(currentDate), 'yyyy-MM-dd');
        const shiftKey = `${dateStr}-${employee.id}`;
        
        // Проверяем, есть ли измененная/отмененная смена
        const existingShift = shiftsMap.get(shiftKey);
        
        let shiftTypeId: string | null = null;
        
        if (existingShift) {
          // Если смена отменена, пропускаем её (не считаем)
          if (existingShift.status === 'cancelled') {
            return; // Пропускаем этот день для этого сотрудника
          }
          // Если смена имеет статус 'modified', используем её
          if (existingShift.status === 'modified') {
            shiftTypeId = existingShift.shiftTypeId;
          }
          // Смены со статусом 'scheduled' игнорируем - они из паттерна
        }
        
        // Если нет измененной смены, вычисляем из паттерна
        if (shiftTypeId === null) {
          const instance = patternInstancesMap.get(employee.id);
          if (instance && instance.sequence && instance.pattern) {
            const cycleLength = instance.pattern.cycleLength || instance.sequence.length;
            const position = computePositionInCycle(
              currentDate,
              baseCycleStart,
              cycleLength,
              instance.startIndex || 0
            );
            shiftTypeId = instance.sequence[position] ?? null;
          }
        }

        // Если есть смена (не null), добавляем статистику
        if (shiftTypeId !== null) {
          stats.shiftsCount += 1;
          
          // Добавляем тип смены в карту уникальных типов с данными и увеличиваем счетчик
          const employeeShiftTypesMap = shiftTypesByEmployee.get(employee.id);
          if (employeeShiftTypesMap) {
            const existingTypeInfo = employeeShiftTypesMap.get(shiftTypeId);
            if (existingTypeInfo) {
              // Тип уже есть, увеличиваем счетчик
              existingTypeInfo.count += 1;
            } else {
              // Тип еще не добавлен, создаем новую запись
              // Получаем данные из глобальной мапы типов смен
              const globalType = shiftTypesMap.get(shiftTypeId);
              if (globalType) {
                employeeShiftTypesMap.set(shiftTypeId, {
                  id: shiftTypeId,
                  name: globalType.name,
                  color: globalType.color,
                  startTime: globalType.startTime,
                  endTime: globalType.endTime,
                  count: 1,
                });
              } else if (existingShift?.shiftType) {
                // Используем данные из смены
                employeeShiftTypesMap.set(shiftTypeId, {
                  id: shiftTypeId,
                  name: existingShift.shiftType.name,
                  color: existingShift.shiftType.color,
                  startTime: existingShift.shiftType.startTime,
                  endTime: existingShift.shiftType.endTime,
                  count: 1,
                });
              }
            }
          }
          
          // Получаем тип смены для подсчета часов
          const shiftType = shiftTypesMap.get(shiftTypeId);
          if (shiftType) {
            const workingHours = typeof shiftType.workingHours === 'number'
              ? shiftType.workingHours
              : parseFloat(String(shiftType.workingHours)) || 0;
            const nightHours = typeof shiftType.nightHoursCount === 'number'
              ? shiftType.nightHoursCount
              : parseFloat(String(shiftType.nightHoursCount)) || 0;
            
            stats.totalHours += workingHours;
            stats.nightHours += nightHours;
          } else if (existingShift?.shiftType) {
            // Если тип смены не найден в мапе, используем из смены
            const workingHours = typeof existingShift.shiftType.workingHours === 'number'
              ? existingShift.shiftType.workingHours
              : parseFloat(String(existingShift.shiftType.workingHours)) || 0;
            const nightHours = typeof existingShift.shiftType.nightHoursCount === 'number'
              ? existingShift.shiftType.nightHoursCount
              : parseFloat(String(existingShift.shiftType.nightHoursCount)) || 0;
            
            stats.totalHours += workingHours;
            stats.nightHours += nightHours;
          }
        }
        // Если shiftTypeId === null, это выходной день, не считаем
      });
    });

    // Обновляем список типов смен для каждого сотрудника
    shiftTypesByEmployee.forEach((shiftTypesMap, employeeId) => {
      const stats = statsMap.get(employeeId);
      if (stats) {
        stats.shiftTypes = Array.from(shiftTypesMap.values());
      }
    });

    // Если указан hoveredEmployeeId, показываем статистику только для этого сотрудника
    if (hoveredEmployeeId) {
      const stat = statsMap.get(hoveredEmployeeId);
      return stat ? [stat] : [];
    }

    // Сохраняем порядок сотрудников из входного массива (порядок ростера)
    // Возвращаем статистику в том же порядке, в котором сотрудники переданы
    // Фильтруем только видимых сотрудников и сохраняем их порядок
    const visibleEmployeesList = employees.filter(emp => !emp.isHidden);
    return visibleEmployeesList
      .map(emp => statsMap.get(emp.id))
      .filter((stat): stat is EmployeeStats => stat !== undefined);
  }, [employees, periodStart, periodEnd, patternInstancesMap, shiftTypesMap, shiftsMap, baseCycleStart, hoveredEmployeeId]);

  if (sidebarCollapsed) {
    return null; // Не показываем статистику в свернутом виде
  }

  // Если мышь не наведена на сотрудника, не показываем статистику
  if (!hoveredEmployeeId) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 mt-4 pt-4">
      <div className="px-4 mb-3">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Статистика за период</h3>
        
        {/* Статистика по сотрудникам */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {statistics.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Нет данных</p>
          ) : (
            statistics.map((stat) => (
              <div
                key={stat.employeeId}
                className="bg-white border border-gray-200 rounded p-2 text-xs"
              >
                <div className="font-medium text-gray-800 mb-1 truncate" title={stat.employeeName}>
                  {stat.employeeName}
                </div>
                <div className="grid grid-cols-3 gap-2 text-gray-600 mb-2">
                  <div>
                    <div className="text-gray-500">Смен</div>
                    <div className="font-semibold">{stat.shiftsCount}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Часов</div>
                    <div className="font-semibold">
                      {stat.totalHours % 1 === 0
                        ? stat.totalHours
                        : stat.totalHours.toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Ночных</div>
                    <div className="font-semibold">
                      {stat.nightHours % 1 === 0
                        ? stat.nightHours
                        : stat.nightHours.toFixed(1)}
                    </div>
                  </div>
                </div>
                {/* Типы смен */}
                {stat.shiftTypes.length > 0 && (
                  <div className="mt-2">
                    <div className="text-gray-500 text-[10px] mb-1">Типы смен:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {stat.shiftTypes.map((shiftType) => {
                        const backgroundColor = shiftType.color || '#f9fafb';
                        const textColor = getContrastColor(backgroundColor);
                        const timeRange = shiftType.startTime && shiftType.endTime
                          ? `${shiftType.startTime}-${shiftType.endTime}`
                          : shiftType.startTime || shiftType.endTime || null;

                        return (
                          <div
                            key={shiftType.id}
                            className="flex flex-col items-center"
                            title={`${shiftType.name}${timeRange ? ` (${timeRange})` : ''}`}
                          >
                            <div
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              style={{
                                backgroundColor,
                                color: textColor,
                              }}
                            >
                              <span>{shiftType.name}</span>
                              {timeRange && (
                                <span className="opacity-90 text-[9px]">{timeRange}</span>
                              )}
                            </div>
                            <div className="text-[9px] text-gray-600 mt-0.5 font-semibold">
                              {shiftType.count}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

