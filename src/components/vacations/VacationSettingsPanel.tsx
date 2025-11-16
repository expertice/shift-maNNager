import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Card, Spinner } from '@components/common';
import { Employee, VacationRules, EmployeeVacationAllocation } from '@types';
import { vacationRulesService } from '@services/api/vacationRulesService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';

export interface VacationSettingsPanelProps {
  scheduleId: string;
  employees: Employee[];
  scheduleStart?: Date;
  onClose?: () => void;
  onSaveReady?: (handleSave: () => Promise<void>, isSaving: boolean) => void;
}

export default function VacationSettingsPanel({
  scheduleId,
  employees,
  scheduleStart,
  onClose,
  onSaveReady,
}: VacationSettingsPanelProps) {
  const queryClient = useQueryClient();
  // Используем год начала расписания, а не текущий год
  const scheduleYear = scheduleStart ? scheduleStart.getFullYear() : new Date().getFullYear();

  // Состояние для правил
  const [rules, setRules] = useState<Partial<VacationRules>>({
    maxConcurrentEmployees: 1,
    minContinuousDays: 14,
  });

  // Состояние для выделений дней
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Загрузка правил
  const { data: vacationRules, isLoading: rulesLoading } = useQuery({
    queryKey: ['vacationRules', scheduleId],
    queryFn: () => vacationRulesService.getVacationRules(scheduleId),
    enabled: !!scheduleId,
  });

  // Загрузка выделений
  const { data: vacationAllocations, isLoading: allocationsLoading } = useQuery({
    queryKey: ['vacationAllocations', scheduleId, scheduleYear],
    queryFn: () => vacationRulesService.getEmployeeAllocations(scheduleId, scheduleYear),
    enabled: !!scheduleId,
  });

  // Инициализация данных
  useEffect(() => {
    if (vacationRules) {
      setRules({
        maxConcurrentEmployees: vacationRules.maxConcurrentEmployees,
        minContinuousDays: vacationRules.minContinuousDays,
      });
    }
  }, [vacationRules]);

  useEffect(() => {
    if (vacationAllocations) {
      const allocationsMap: Record<string, number> = {};
      vacationAllocations.forEach(allocation => {
        allocationsMap[allocation.employeeId] = allocation.allocatedDays;
      });
      setAllocations(allocationsMap);
    }
  }, [vacationAllocations]);

  // Мутация для обновления правил
  const updateRulesMutation = useMutation({
    mutationFn: (data: { maxConcurrentEmployees?: number; minContinuousDays?: number }) =>
      vacationRulesService.updateVacationRules(scheduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacationRules', scheduleId] });
    },
  });

  // Мутация для обновления выделений
  const updateAllocationsMutation = useMutation({
    mutationFn: (allocationsData: Array<{ employeeId: string; year: number; allocatedDays: number }>) =>
      vacationRulesService.updateEmployeeAllocations(scheduleId, allocationsData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vacationAllocations', scheduleId] });
    },
  });

  const isLoading = rulesLoading || allocationsLoading;
  const isSaving = updateRulesMutation.isPending || updateAllocationsMutation.isPending;

  // Используем ref для хранения актуальных значений
  const rulesRef = useRef(rules);
  const allocationsRef = useRef(allocations);
  const employeesRef = useRef(employees);
  
  useEffect(() => {
    rulesRef.current = rules;
    allocationsRef.current = allocations;
    employeesRef.current = employees;
  }, [rules, allocations, employees]);

  // Обработка сохранения
  const handleSave = useCallback(async () => {
    try {
      // Сохраняем правила
      await updateRulesMutation.mutateAsync({
        maxConcurrentEmployees: rulesRef.current.maxConcurrentEmployees,
        minContinuousDays: rulesRef.current.minContinuousDays,
      });

      // Сохраняем выделения
      const allocationsData = employeesRef.current.map(emp => ({
        employeeId: emp.id,
        year: scheduleYear,
        allocatedDays: allocationsRef.current[emp.id] ?? 28,
      }));

      await updateAllocationsMutation.mutateAsync(allocationsData);
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
    }
  }, [scheduleYear, updateRulesMutation, updateAllocationsMutation]);

  // Передаем handleSave в родительский компонент через callback
  useEffect(() => {
    if (onSaveReady) {
      onSaveReady(handleSave, isSaving);
    }
  }, [onSaveReady, handleSave, isSaving]);

  return (
    <Card className="p-6">

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Правила отпусков */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Общие правила</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Максимум одновременных отпусков
                </label>
                <Input
                  type="number"
                  min="1"
                  value={rules.maxConcurrentEmployees || 1}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      maxConcurrentEmployees: parseInt(e.target.value, 10) || 1,
                    })
                  }
                  placeholder="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Максимальное количество сотрудников, которые могут быть в отпуске одновременно
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Обязательная длина периода отпуска (дней)
                </label>
                <Input
                  type="number"
                  min="1"
                  value={rules.minContinuousDays || 14}
                  onChange={(e) =>
                    setRules({
                      ...rules,
                      minContinuousDays: parseInt(e.target.value, 10) || 14,
                    })
                  }
                  placeholder="14"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Минимальная длина одного периода отпуска (согласно ТК РФ - 14 дней)
                </p>
              </div>
            </div>
          </div>

          {/* Выделенные дни по сотрудникам */}
          <div>
            <h3 className="text-lg font-semibold mb-4">
              Выделенные дни отпуска на {scheduleYear} год
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Сотрудник
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Дней отпуска
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((employee) => (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="text-sm font-medium">{employee.fullName}</div>
                          {employee.tabNumber && (
                            <div className="text-xs text-gray-500">{employee.tabNumber}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Input
                            type="number"
                            min="0"
                            value={allocations[employee.id] ?? 28}
                            onChange={(e) => {
                              const value = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                              setAllocations({
                                ...allocations,
                                [employee.id]: value ?? 28,
                              });
                            }}
                            className="w-24"
                            placeholder="28"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

