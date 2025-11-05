import React from 'react';
import { Card, Button, Badge } from '@components/common';
import { ShiftProfile } from '@types';
import { Pencil, Copy, Trash2, Play, Eye } from 'lucide-react';

export interface ShiftProfilesTableProps {
  profiles: ShiftProfile[];
  selectedProfileId?: string;
  onSelectProfile: (profileId: string) => void;
  onGenerate: (profileId: string) => void;
  onEdit?: (profileId: string) => void;
  onViewDetails?: (profileId: string) => void;
  onDelete?: (profileId: string) => void;
  onClone?: (profileId: string) => void;
  comparisonMode?: boolean;
  selectedProfileIds?: string[];
  onToggleProfileSelection?: (profileId: string) => void;
}

/**
 * Таблица профилей смен для компактного отображения
 */
export const ShiftProfilesTable: React.FC<ShiftProfilesTableProps> = ({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onGenerate,
  onEdit,
  onViewDetails,
  onDelete,
  onClone,
  comparisonMode = false,
  selectedProfileIds = [],
  onToggleProfileSelection,
}) => {
  if (profiles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">Нет доступных профилей смен</p>
      </Card>
    );
  }

  const handleSelectAll = () => {
    if (!onToggleProfileSelection) return;
    
    // Если все выбраны, снимаем выбор со всех
    if (selectedProfileIds.length === profiles.length) {
      profiles.forEach((profile) => onToggleProfileSelection(profile.id));
    } else {
      // Иначе выбираем все невыбранные
      profiles.forEach((profile) => {
        if (!selectedProfileIds.includes(profile.id)) {
          onToggleProfileSelection(profile.id);
        }
      });
    }
  };

  const allSelected = profiles.length > 0 && selectedProfileIds.length === profiles.length;

  return (
    <Card className="overflow-hidden" padding="none">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {comparisonMode && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                    title="Выбрать все"
                  />
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Название
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Описание
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Цикл
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Мин. сотрудников
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Типы смен
              </th>
              {!comparisonMode && (
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {profiles.map((profile) => {
              const isSelected = comparisonMode 
                ? selectedProfileIds.includes(profile.id)
                : selectedProfileId === profile.id;

              return (
                <tr
                  key={profile.id}
                  className={`transition-colors ${
                    isSelected
                      ? 'bg-primary/5 border-l-4 border-primary'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => !comparisonMode && onSelectProfile(profile.id)}
                  style={{ cursor: comparisonMode ? 'default' : 'pointer' }}
                >
                  {comparisonMode && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedProfileIds.includes(profile.id)}
                        onChange={() => onToggleProfileSelection?.(profile.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-gray-900">{profile.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600 max-w-md truncate">
                      {profile.description || '-'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{profile.cycleLength} дней</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{profile.minEmployees}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant="info">{profile.shiftTypes?.length || 0} типов</Badge>
                  </td>
                  {!comparisonMode && (
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => onGenerate(profile.id)}
                          title="Использовать профиль"
                          className="px-2"
                        >
                          <Play size={16} />
                        </Button>
                        {onEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEdit(profile.id)}
                            title="Редактировать"
                            className="px-2"
                          >
                            <Pencil size={16} />
                          </Button>
                        )}
                        {onClone && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onClone(profile.id)}
                            title="Клонировать профиль"
                            className="px-2"
                          >
                            <Copy size={16} />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onDelete(profile.id)}
                            className="px-2 text-red-600 hover:text-red-700 hover:border-red-600"
                            title="Удалить профиль"
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                        {onViewDetails && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onViewDetails(profile.id)}
                            title="Посмотреть детали"
                            className="px-2"
                          >
                            <Eye size={16} />
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
