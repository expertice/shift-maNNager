import { Request, Response } from 'express';

/**
 * Обработчик 404 ошибок
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: 'Route not found',
  });
};


