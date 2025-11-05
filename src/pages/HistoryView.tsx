import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout, SidebarIcons } from '@components/layout';
import { Button, Card, Spinner, Badge } from '@components/common';
import { historyService } from '@services/api';
import { ChangeHistory, ChangeType } from '@types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Страница истории изменений
 */
export default function HistoryView() {
  const { scheduleId } = useParams<{ scheduleId: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const limit = 50;

  if (!scheduleId) {
    return <div>Ошибка: не указан ID расписания</div>;
  }

  // Загрузка истории
  const { data: historyData, isLoading } = useQuery({
    queryKey: ['history', scheduleId, page],
    queryFn: () =>
      historyService.getHistory(scheduleId, {
        limit,
        offset: (page - 1) * limit,
      }),
    enabled: !!scheduleId,
  });

  const getChangeTypeLabel = (type: ChangeType): string => {
    const labels = {
      create: 'Создание',
      update: 'Изменение',
      delete: 'Удаление',
    };
    return labels[type] || type;
  };

  const getChangeTypeVariant = (type: ChangeType): 'success' | 'warning' | 'danger' | 'default' => {
    const variants = {
      create: 'success' as const,
      update: 'warning' as const,
      delete: 'danger' as const,
    };
    return variants[type] || 'default';
  };

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
      id: 'history',
      label: 'История',
      icon: SidebarIcons.History,
      path: `/schedule/${scheduleId}/history`,
    },
  ];

  return (
    <MainLayout sidebarItems={sidebarItems}>
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">История изменений</h1>
            <p className="text-gray-600 mt-1">Журнал всех изменений в расписании</p>
          </div>
          <Button onClick={() => navigate(`/schedule/${scheduleId}`)} variant="outline">
            Назад к расписанию
          </Button>
        </div>

        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Spinner size="lg" />
          </div>
        )}

        {historyData && historyData.items.length === 0 && !isLoading && (
          <Card className="p-8 text-center">
            <p className="text-gray-500">История изменений пуста</p>
          </Card>
        )}

        {historyData && historyData.items.length > 0 && (
          <>
            <div className="space-y-3">
              {historyData.items.map((entry: ChangeHistory) => (
                <Card key={entry.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant={getChangeTypeVariant(entry.changeType)}>
                          {getChangeTypeLabel(entry.changeType)}
                        </Badge>
                        <span className="text-sm font-medium text-gray-900">
                          {entry.tableName}
                        </span>
                        {entry.employee && (
                          <span className="text-sm text-gray-600">
                            Сотрудник: {entry.employee.fullName}
                          </span>
                        )}
                      </div>
                      {entry.reason && (
                        <p className="text-sm text-gray-600 mb-2">{entry.reason}</p>
                      )}
                      <div className="text-xs text-gray-500">
                        {format(new Date(entry.createdAt), 'dd.MM.yyyy HH:mm:ss', { locale: ru })}
                        {' • '}
                        Версия: {entry.version}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Пагинация */}
            {historyData.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Страница {historyData.page} из {historyData.totalPages} (всего записей:{' '}
                  {historyData.total})
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                  >
                    Назад
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= historyData.totalPages}
                  >
                    Вперед
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}
