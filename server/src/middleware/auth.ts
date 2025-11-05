import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from '../utils/jwt';
import { AuthRequest } from '../types';
import { ApiError } from '../types';

/**
 * Middleware для аутентификации пользователя
 * Проверяет JWT токен и добавляет информацию о пользователе в request
 */
export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    if (!token) {
      const error: ApiError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'No token provided',
      };
      throw error;
    }

    const payload = verifyToken(token);
    (req as AuthRequest).user = {
      id: payload.userId,
      email: payload.email,
    };

    next();
  } catch (error) {
    const apiError: ApiError = {
      status: 401,
      code: 'UNAUTHORIZED',
      message: error instanceof Error ? error.message : 'Invalid token',
    };
    next(apiError);
  }
};

/**
 * Опциональная аутентификация (для endpoints где авторизация необязательна)
 */
export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractToken(authHeader);

    if (token) {
      const payload = verifyToken(token);
      (req as AuthRequest).user = {
        id: payload.userId,
        email: payload.email,
      };
    }

    next();
  } catch {
    // Игнорируем ошибки для опциональной аутентификации
    next();
  }
};

