import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { RealtimeEvent } from '@types';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

/**
 * Хук для подключения к Socket.io и получения real-time событий
 */
export function useRealtime(
  scheduleId: string | null,
  onEvent?: (event: RealtimeEvent) => void
) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!scheduleId) return;

    // Создаем подключение
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Подключаемся к схеме
    socket.emit('schedule:join', scheduleId);

    // Обработка событий
    const eventHandlers = [
      'shift_updated',
      'vacation_added',
      'vacation_updated',
      'vacation_deleted',
      'vacation_conflict',
      'conflict_detected',
      'roster:updated', // Обновление ростера (паттерны, порядок сотрудников)
    ];

    eventHandlers.forEach((eventType) => {
      socket.on(eventType, (data: RealtimeEvent) => {
        if (onEvent) {
          onEvent(data);
        }
      });
    });

    // Очистка при размонтировании
    return () => {
      if (scheduleId) {
        socket.emit('schedule:leave', scheduleId);
      }
      socket.disconnect();
    };
  }, [scheduleId, onEvent]);

  return socketRef.current;
}

