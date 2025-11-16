import { io } from '../index';
import { logger } from '../utils/logger';

/**
 * Сервис для отправки real-time событий через Socket.io
 */

/**
 * Отправить событие об обновлении отпуска
 */
export function emitVacationEvent(
  scheduleId: string,
  eventType: 'vacation:added' | 'vacation:updated' | 'vacation:deleted',
  data: unknown
): void {
  try {
    io.to(`schedule:${scheduleId}`).emit(eventType, {
      scheduleId,
      timestamp: new Date().toISOString(),
      data,
    });
    logger.debug(`Emitted ${eventType} for schedule ${scheduleId}`);
  } catch (error) {
    logger.error('Error emitting vacation event:', error);
  }
}

/**
 * Отправить событие об обнаружении конфликта отпусков
 */
export function emitVacationConflictEvent(
  scheduleId: string,
  conflictData: unknown
): void {
  try {
    io.to(`schedule:${scheduleId}`).emit('vacation:conflict', {
      scheduleId,
      timestamp: new Date().toISOString(),
      data: conflictData,
    });
    logger.debug(`Emitted vacation:conflict for schedule ${scheduleId}`);
  } catch (error) {
    logger.error('Error emitting vacation conflict event:', error);
  }
}

/**
 * Отправить событие об обновлении смены
 */
export function emitShiftUpdateEvent(
  scheduleId: string,
  shiftData: unknown
): void {
  try {
    io.to(`schedule:${scheduleId}`).emit('shift:updated', {
      scheduleId,
      timestamp: new Date().toISOString(),
      data: shiftData,
    });
    logger.debug(`Emitted shift:updated for schedule ${scheduleId}`);
  } catch (error) {
    logger.error('Error emitting shift update event:', error);
  }
}

/**
 * Отправить событие об обновлении ростера (паттерны, порядок сотрудников и т.д.)
 */
export function emitRosterUpdateEvent(
  scheduleId: string,
  updateType: 'pattern_offset' | 'employee_order' | 'employee_added' | 'employee_updated' | 'employee_deleted' | 'shift_profile_updated',
  data: unknown
): void {
  try {
    io.to(`schedule:${scheduleId}`).emit('roster:updated', {
      scheduleId,
      updateType,
      timestamp: new Date().toISOString(),
      data,
    });
    logger.debug(`Emitted roster:updated (${updateType}) for schedule ${scheduleId}`);
  } catch (error) {
    logger.error('Error emitting roster update event:', error);
  }
}

/**
 * Подключить клиента к комнате схемы
 */
export function joinScheduleRoom(socketId: string, scheduleId: string): void {
  try {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.join(`schedule:${scheduleId}`);
      logger.debug(`Socket ${socketId} joined schedule:${scheduleId}`);
    }
  } catch (error) {
    logger.error('Error joining schedule room:', error);
  }
}

/**
 * Отключить клиента от комнаты схемы
 */
export function leaveScheduleRoom(socketId: string, scheduleId: string): void {
  try {
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.leave(`schedule:${scheduleId}`);
      logger.debug(`Socket ${socketId} left schedule:${scheduleId}`);
    }
  } catch (error) {
    logger.error('Error leaving schedule room:', error);
  }
}

