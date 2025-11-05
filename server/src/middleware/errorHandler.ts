import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../types';

/**
 * Обработчик ошибок для Express
 */
export const errorHandler = (
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('Error:', err);

  if ('status' in err && 'code' in err) {
    // Это ApiError
    res.status(err.status).json({
      success: false,
      error: err.code,
      message: err.message,
      details: err.details,
    });
  } else {
    // Обычная ошибка
    const status = 500;
    const message =
      process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';

    res.status(status).json({
      success: false,
      error: 'INTERNAL_SERVER_ERROR',
      message,
    });
  }
};


