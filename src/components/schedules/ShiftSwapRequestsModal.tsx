import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal, Button, Badge } from '@components/common';
import { shiftSwapService, ShiftSwapRequest } from '@services/api/shiftSwapService';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export interface ShiftSwapRequestsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
}

/**
 * Модальное окно для просмотра и управления запросами на обмен сменами
 */
export const ShiftSwapRequestsModal: React.FC<ShiftSwapRequestsModalProps> = ({
  isOpen,
  onClose,
  scheduleId,
}) => {
  const queryClient = useQueryClient();

  // Получаем pending запросы
  const { data: requests, isLoading, refetch } = useQuery({
    queryKey: ['shift-swaps', scheduleId, 'pending'],
    queryFn: () => shiftSwapService.getSwapRequests(scheduleId, 'pending'),
    enabled: isOpen && !!scheduleId,
  });

  // Мутация для подтверждения
  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      shiftSwapService.approveSwapRequest(scheduleId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['shifts', scheduleId] });
      refetch();
    },
  });

  // Мутация для отклонения
  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      shiftSwapService.rejectSwapRequest(scheduleId, requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-swaps', scheduleId] });
      refetch();
    },
  });

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'default' as const,
      approved: 'success' as const,
      rejected: 'danger' as const,
      cancelled: 'info' as const,
    };
    const labels = {
      pending: 'Ожидает',
      approved: 'Подтвержден',
      rejected: 'Отклонен',
      cancelled: 'Отменен',
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'default'}>
        {labels[status as keyof typeof labels] || status}
      </Badge>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy', { locale: ru });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Запросы на обмен сменами"
      size="lg"
    >
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Загрузка...</p>
          </div>
        ) : !requests || requests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Нет запросов на обмен</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((request: ShiftSwapRequest) => (
              <div
                key={request.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Запрос #{request.id.slice(0, 8)}</span>
                    {getStatusBadge(request.status)}
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Инициатор:</div>
                    <div className="text-gray-600">
                      {request.initiatorEmployee?.fullName || 'Неизвестно'}
                      {request.initiatorEmployee?.tabNumber && (
                        <span className="text-gray-400 ml-2">
                          ({request.initiatorEmployee.tabNumber})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm border-t pt-3">
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">Смена сотрудника:</div>
                    <div className="text-gray-600">
                      {request.fromEmployee?.fullName || 'Неизвестно'}
                      {request.fromEmployee?.tabNumber && (
                        <span className="text-gray-400 ml-2">
                          ({request.fromEmployee.tabNumber})
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Дата: {formatDate(request.fromDate)}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-medium text-gray-700">На смену сотрудника:</div>
                    <div className="text-gray-600">
                      {request.toEmployee?.fullName || 'Неизвестно'}
                      {request.toEmployee?.tabNumber && (
                        <span className="text-gray-400 ml-2">
                          ({request.toEmployee.tabNumber})
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500 text-xs">
                      Дата: {formatDate(request.toDate)}
                    </div>
                  </div>
                </div>

                {request.status === 'pending' && (
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rejectMutation.mutate(request.id)}
                      isLoading={rejectMutation.isPending}
                    >
                      Отклонить
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => approveMutation.mutate(request.id)}
                      isLoading={approveMutation.isPending}
                    >
                      Подтвердить
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </div>
      </div>
    </Modal>
  );
};

