import React from 'react';
import { Employee } from '@types';
import { Button } from '@components/common';
import { Eye, EyeOff } from 'lucide-react';

export interface EmployeeRowViewProps {
  employees: Employee[];
  isSelectionMode: boolean;
  selectedEmployeeIds: Set<string>;
  onToggleSelection: (employeeId: string) => void;
  onEdit: (employeeId: string) => void;
  onGeneratePassword: (employeeId: string) => void;
  onDelete: (employeeId: string) => void;
  onToggleVisibility: (employeeId: string, isHidden: boolean) => void;
  showHidden: boolean;
}

/**
 * Компонент для отображения сотрудников в виде таблицы (строки)
 */
export const EmployeeRowView: React.FC<EmployeeRowViewProps> = ({
  employees,
  isSelectionMode,
  selectedEmployeeIds,
  onToggleSelection,
  onEdit,
  onGeneratePassword,
  onDelete,
  onToggleVisibility,
  showHidden,
}) => {
  const filteredEmployees = React.useMemo(() => {
    const filtered = showHidden
      ? employees
      : employees.filter((emp) => !emp.isHidden);
    
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

  if (filteredEmployees.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        {showHidden ? 'Нет сотрудников' : 'Нет видимых сотрудников'}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {isSelectionMode && (
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectedEmployeeIds.size === filteredEmployees.length && filteredEmployees.length > 0}
                  onChange={() => {
                    if (selectedEmployeeIds.size === filteredEmployees.length) {
                      // Снять выделение со всех
                      filteredEmployees.forEach((emp) => {
                        if (selectedEmployeeIds.has(emp.id)) {
                          onToggleSelection(emp.id);
                        }
                      });
                    } else {
                      // Выбрать всех
                      filteredEmployees.forEach((emp) => {
                        if (!selectedEmployeeIds.has(emp.id)) {
                          onToggleSelection(emp.id);
                        }
                      });
                    }
                  }}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
              </th>
            )}
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              ФИО
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Табельный №
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Должность
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Отдел
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Статус
            </th>
            {!isSelectionMode && (
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Действия
              </th>
            )}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {filteredEmployees.map((employee) => {
            const isHidden = employee.isHidden || false;
            return (
              <tr
                key={employee.id}
                className={`hover:bg-gray-50 ${isHidden ? 'opacity-60 bg-gray-50' : ''}`}
              >
                {isSelectionMode && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.has(employee.id)}
                      onChange={() => onToggleSelection(employee.id)}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="text-sm font-medium text-gray-900">{employee.fullName}</div>
                    {isHidden && (
                      <EyeOff className="ml-2 h-4 w-4 text-gray-400" title="Скрыт из ростера" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">{employee.tabNumber}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-600">
                    {employee.position?.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">
                    {employee.department?.name || '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => onToggleVisibility(employee.id, !isHidden)}
                    className="flex items-center text-sm text-gray-600 hover:text-gray-900"
                    title={isHidden ? 'Показать в ростере' : 'Скрыть из ростера'}
                  >
                    {isHidden ? (
                      <>
                        <EyeOff className="h-4 w-4 mr-1" />
                        <span>Скрыт</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-1" />
                        <span>Видим</span>
                      </>
                    )}
                  </button>
                </td>
                {!isSelectionMode && (
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(employee.id)}
                      >
                        Редактировать
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onGeneratePassword(employee.id)}
                      >
                        Пароль
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => onDelete(employee.id)}
                      >
                        Удалить
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

