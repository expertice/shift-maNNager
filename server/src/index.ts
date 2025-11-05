import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { createApp } from './app';
import { logger } from './utils/logger';

// Загружаем переменные окружения
dotenv.config();

const PORT = process.env.PORT || 3000;

// Создаем Express приложение
const app = createApp();

// Создаем HTTP сервер для Socket.io
const httpServer = createServer(app);

// Настраиваем Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Socket.io connection
io.on('connection', (socket) => {
  logger.info('Client connected:', socket.id);

  // Подключение к схеме для получения real-time обновлений
  socket.on('schedule:join', (scheduleId: string) => {
    socket.join(`schedule:${scheduleId}`);
    logger.info(`Socket ${socket.id} joined schedule:${scheduleId}`);
  });

  // Отключение от схемы
  socket.on('schedule:leave', (scheduleId: string) => {
    socket.leave(`schedule:${scheduleId}`);
    logger.info(`Socket ${socket.id} left schedule:${scheduleId}`);
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected:', socket.id);
  });
});

// Export io для использования в других модулях
export { io };

// Запускаем сервер
httpServer.on('error', (error: any) => {
  // Handle common case when the port is already in use so the app fails gracefully
  if (error && error.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Another process is listening on this port.`);
    logger.error('Tip: run .\\stop.ps1 in the project root to free ports 3000/5173, or set PORT to a different value.');
    process.exit(1);
  }
  logger.error('HTTP server encountered an unexpected error:', error);
  process.exit(1);
});

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on http://localhost:${PORT}`);
  logger.info(`📡 WebSocket server ready on ws://localhost:${PORT}`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

