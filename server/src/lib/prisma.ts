import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Prisma Client instance
 * Используется singleton паттерн для предотвращения создания множественных экземпляров
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Обработка завершения процесса
process.on('beforeExit', async () => {
  logger.info('Closing Prisma connection...');
  await prisma.$disconnect();
});

export default prisma;


