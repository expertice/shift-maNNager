import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

const TEMP_PASSWORD_EXPIRY_HOURS = parseInt(
  process.env.TEMP_PASSWORD_EXPIRY_HOURS || '24',
  10
);

/**
 * Генерация одноразового пароля для сотрудника
 */
export async function generateTemporaryPassword(employeeId: string): Promise<{
  temporaryPassword: string;
  expiresAt: Date;
  loginId: string;
}> {
  // Генерируем случайный пароль (6 символов)
  const temporaryPassword = crypto.randomBytes(3).toString('hex').toUpperCase();

  // Хешируем пароль
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  // Вычисляем срок действия
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + TEMP_PASSWORD_EXPIRY_HOURS);

  // Используем ID сотрудника как loginId (можно изменить на другое значение)
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  const loginId = employee.loginId || employee.id;

  // Обновляем данные сотрудника
  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      passwordHash,
      passwordExpiry: expiresAt,
      loginId,
    },
  });

  return {
    temporaryPassword,
    expiresAt,
    loginId,
  };
}

/**
 * Проверка одноразового пароля сотрудника
 */
export async function verifyEmployeePassword(
  loginId: string,
  password: string
): Promise<{ employeeId: string; scheduleId: string } | null> {
  const employee = await prisma.employee.findFirst({
    where: {
      loginId,
      passwordExpiry: {
        gt: new Date(), // Пароль не истек
      },
    },
  });

  if (!employee || !employee.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, employee.passwordHash);

  if (!isValid) {
    return null;
  }

  return {
    employeeId: employee.id,
    scheduleId: employee.scheduleId,
  };
}


