import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';
import { createToken } from '../utils/jwt';
import { ApiResponse, ApiError } from '../types';
import { generateTemporaryPassword, verifyEmployeePassword } from '../services/passwordService';

/**
 * Вход для суперпользователя
 */
export async function loginUser(
  req: Request,
  res: Response<ApiResponse<{ token: string; user: { id: string; email: string } }>>,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Email and password are required',
      };
      return next(error);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      const error: ApiError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      };
      return next(error);
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      const error: ApiError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials',
      };
      return next(error);
    }

    const token = createToken(user.id, user.email);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Вход для сотрудника (по одноразовому паролю)
 */
export async function loginEmployee(
  req: Request,
  res: Response<
    ApiResponse<{
      employeeId: string;
      scheduleId: string;
      loginId: string;
    }>
  >,
  next: NextFunction
): Promise<void> {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      const error: ApiError = {
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Login ID and password are required',
      };
      return next(error);
    }

    const result = await verifyEmployeePassword(loginId, password);

    if (!result) {
      const error: ApiError = {
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Invalid credentials or password expired',
      };
      return next(error);
    }

    res.json({
      success: true,
      data: {
        employeeId: result.employeeId,
        scheduleId: result.scheduleId,
        loginId: loginId,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Генерация одноразового пароля для сотрудника
 */
export async function generateEmployeePassword(
  req: Request,
  res: Response<
    ApiResponse<{
      temporaryPassword: string;
      expiresAt: Date;
      loginId: string;
    }>
  >,
  next: NextFunction
): Promise<void> {
  try {
    const { employeeId } = req.params;

    const result = await generateTemporaryPassword(employeeId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

