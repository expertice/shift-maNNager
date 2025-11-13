import React, { useState, useEffect } from 'react';
import { Button, Input, Card, Spinner } from '@components/common';
import { Employee, VacationRules, EmployeeVacationAllocation } from '@types';
import { vacationRulesService } from '@services/api/vacationRulesService';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface VacationSettingsPanelProps {
  scheduleId: string;
  employees: Employee[];
  onClose?: () => void;
}

export default function VacationSettingsPanel({
  scheduleId,
  employees,
  onClose,
}: VacationSettingsPanelProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

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
    queryKey: ['vacationAllocations', scheduleId, currentYear],
    queryFn: () => vacationRulesService.getEmployeeAllocations(scheduleId, currentYear),
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

  // Обработка сохранения
  const handleSave = async () => {
    try {
      // Сохраняем правила
      await updateRulesMutation.mutateAsync({
        maxConcurrentEmployees: rules.maxConcurrentEmployees,
        minContinuousDays: rules.minContinuousDays,
      });

      // Сохраняем выделения
      const allocationsData = employees.map(emp => ({
        employeeId: emp.id,
        year: currentYear,
        allocatedDays: allocations[emp.id] || 0,
      }));

      await updateAllocationsMutation.mutateAsync(allocationsData);
    } catch (error) {
      console.error('Ошибка при сохранении настроек:', error);
    }
  };

  const isLoading = rulesLoading || allocationsLoading;
  const isSaving = updateRulesMutation.isPending || updateAllocationsMutation.isPending;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Настройки отпусков</h2>
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Правила отпусков */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Общие правила</h3>
            <div className="space-y-4">
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
              Выделенные дни отпуска на {currentYear} год
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
                            value={allocations[employee.id] || 0}
                            onChange={(e) =>
                              setAllocations({
                                ...allocations,
                                [employee.id]: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="w-24"
                            placeholder="0"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Кнопка сохранения */}
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              isLoading={isSaving}
            >
              Сохранить настройки
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

