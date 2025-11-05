import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest, UserRole, ApiError } from '../types';

/**
 * Middleware для проверки прав доступа к схеме
 * Проверяет, имеет ли пользователь необходимую роль для доступа к схеме
 */
export const authorize = (requiredRole: UserRole = 'viewer') => {
  return async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        const error: ApiError = {
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
        };
        return next(error);
      }

      const scheduleId = req.params.scheduleId || req.params.id;

      if (!scheduleId) {
        const error: ApiError = {
          status: 400,
          code: 'BAD_REQUEST',
          message: 'Schedule ID is required',
        };
        return next(error);
      }

      // Проверяем права доступа
      const schedule = await prisma.schedule.findUnique({
        where: { id: scheduleId },
        include: {
          permissions: {
            where: {
              userId: user.id,
            },
          },
        },
      });

      if (!schedule) {
        const error: ApiError = {
          status: 404,
          code: 'NOT_FOUND',
          message: 'Schedule not found',
        };
        return next(error);
      }

      // Владелец схемы имеет все права
      if (schedule.ownerUserId === user.id) {
        req.userRole = 'owner';
        return next();
      }

      // Проверяем права через permissions
      const permission = schedule.permissions[0];
      if (!permission) {
        const error: ApiError = {
          status: 403,
          code: 'FORBIDDEN',
          message: 'Access denied to this schedule',
        };
        return next(error);
      }

      // Проверяем уровень доступа
      const roleHierarchy: Record<UserRole, number> = {
        viewer: 1,
        editor: 2,
        owner: 3,
      };

      const userRoleLevel = roleHierarchy[permission.role];
      const requiredRoleLevel = roleHierarchy[requiredRole];

      if (userRoleLevel < requiredRoleLevel) {
        const error: ApiError = {
          status: 403,
          code: 'FORBIDDEN',
          message: `Access denied. Required role: ${requiredRole}`,
        };
        return next(error);
      }

      req.userRole = permission.role;
      next();
    } catch (error) {
      const apiError: ApiError = {
        status: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Authorization check failed',
      };
      next(apiError);
    }
  };
};

