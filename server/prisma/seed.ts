import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Если в БД уже есть пользователь или расписание, пропускаем сид (если не принудительно)
  const forceReset = process.env.SEED_RESET === 'true';
  const existingUsers = await prisma.user.count();
  const existingSchedules = await prisma.schedule.count();
  if (!forceReset && (existingUsers > 0 || existingSchedules > 0)) {
    console.log('⏭️  Seed skipped: existing data detected. Set SEED_RESET=true to force.');
    return;
  }

  // Очистка данных (опционально, только для разработки)
  if (process.env.NODE_ENV === 'development' && forceReset) {
    console.log('Cleaning existing data...');
    await prisma.scheduleLaborViolation.deleteMany();
    await prisma.changeHistory.deleteMany();
    await prisma.workHourTracking.deleteMany();
    await prisma.calendarEvent.deleteMany();
    await prisma.conflictSolution.deleteMany();
    await prisma.conflict.deleteMany();
    await prisma.businessTrip.deleteMany();
    await prisma.vacation.deleteMany();
    await prisma.vacationRule.deleteMany();
    await prisma.dailyShift.deleteMany();
    await prisma.employeeShiftAssignment.deleteMany();
    await prisma.scheduleShiftAssignment.deleteMany();
    await prisma.employeeRestriction.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.department.deleteMany();
    await prisma.schedulePermission.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.shiftProfilePattern.deleteMany();
    await prisma.shiftType.deleteMany();
    await prisma.shiftProfile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.workHoursNorm.deleteMany();
    await prisma.laborLawSettings.deleteMany();
  }

  // Создание суперпользователя
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: hashedPassword,
    },
  });
  console.log('✅ Created admin user:', admin.email);

  // Создание тестового пользователя
  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash: hashedPassword,
    },
  });
  console.log('✅ Created test user:', testUser.email);

  // Создание тестового расписания
  const schedule = await prisma.schedule.create({
    data: {
      ownerUserId: admin.id,
      name: 'Тестовое расписание на декабрь 2024',
      startDate: new Date('2024-12-01'),
      endDate: new Date('2024-12-31'),
      status: 'draft',
    },
  });
  console.log('✅ Created test schedule:', schedule.name);

  // Создание отдела
  const department = await prisma.department.create({
    data: {
      scheduleId: schedule.id,
      name: 'Производственный отдел',
    },
  });
  console.log('✅ Created department:', department.name);

  // Создание сотрудников
  const employees = await Promise.all([
    prisma.employee.create({
      data: {
        scheduleId: schedule.id,
        departmentId: department.id,
        fullName: 'Иван Петров',
        tabNumber: '001',
        birthDate: new Date('1990-05-15'),
      },
    }),
    prisma.employee.create({
      data: {
        scheduleId: schedule.id,
        departmentId: department.id,
        fullName: 'Мария Сидорова',
        tabNumber: '002',
        birthDate: new Date('1988-03-20'),
      },
    }),
    prisma.employee.create({
      data: {
        scheduleId: schedule.id,
        departmentId: department.id,
        fullName: 'Алексей Иванов',
        tabNumber: '003',
        birthDate: new Date('1992-07-10'),
      },
    }),
  ]);
  console.log(`✅ Created ${employees.length} employees`);

  // Создание правил отпусков
  await prisma.vacationRule.create({
    data: {
      scheduleId: schedule.id,
      availableDays: 28,
      minContinuousDays: 14,
    },
  });
  console.log('✅ Created vacation rules');

  // Создание профилей смен для расписания (2/2)
  const shiftProfile22 = await prisma.shiftProfile.create({
    data: {
      scheduleId: schedule.id,
      name: '2/2',
      cycleLength: 4,
      minEmployees: 4,
      description: '2 дня работа, 2 дня отдых',
    },
  });
  console.log('✅ Created shift profile:', shiftProfile22.name);

  // Создание типов смен для профиля 2/2
  const dayShift = await prisma.shiftType.create({
    data: {
      shiftProfileId: shiftProfile22.id,
      name: 'Дневная смена',
      startTime: '09:00',
      endTime: '21:00',
      breaks: [
        { startTime: '13:00', endTime: '13:30', duration: 30 },
        { startTime: '17:00', endTime: '17:30', duration: 30 },
      ],
      nightHoursCount: 0,
      workingHours: 11,
    },
  });

  const nightShift = await prisma.shiftType.create({
    data: {
      shiftProfileId: shiftProfile22.id,
      name: 'Ночная смена',
      startTime: '21:00',
      endTime: '09:00',
      breaks: [
        { startTime: '01:00', endTime: '01:30', duration: 30 },
        { startTime: '05:00', endTime: '05:30', duration: 30 },
      ],
      nightHoursCount: 8,
      workingHours: 11,
    },
  });
  console.log('✅ Created shift types');

  // Создание паттернов для профиля 2/2 (4 паттерна)
  await Promise.all([
    prisma.shiftProfilePattern.create({
      data: {
        shiftProfileId: shiftProfile22.id,
        patternNumber: 1,
        cycleLength: 4,
        sequence: [dayShift.id, nightShift.id, null, null],
      },
    }),
    prisma.shiftProfilePattern.create({
      data: {
        shiftProfileId: shiftProfile22.id,
        patternNumber: 2,
        cycleLength: 4,
        sequence: [null, dayShift.id, nightShift.id, null],
      },
    }),
    prisma.shiftProfilePattern.create({
      data: {
        shiftProfileId: shiftProfile22.id,
        patternNumber: 3,
        cycleLength: 4,
        sequence: [null, null, dayShift.id, nightShift.id],
      },
    }),
    prisma.shiftProfilePattern.create({
      data: {
        shiftProfileId: shiftProfile22.id,
        patternNumber: 4,
        cycleLength: 4,
        sequence: [nightShift.id, null, null, dayShift.id],
      },
    }),
  ]);
  console.log('✅ Created shift patterns');

  // Создание настроек контроля ТК РФ
  const laborLawSettings = await prisma.laborLawSettings.create({
    data: {
      maxWorkingHoursPerShift: 12,
      minRestBetweenShifts: [
        { shiftDuration: 12, minRest: 11 },
        { shiftDuration: 8, minRest: 8 },
        { shiftDuration: 6, minRest: 8 },
      ],
      maxHoursPerWeek: 40,
      maxHoursPerMonth: 166.67,
      maxHoursPerQuarter: 500,
      maxOvertimeHoursPerYear: 120,
      nightHoursStart: '22:00',
      nightHoursEnd: '06:00',
      includeBreaksInNightHours: false,
      maxConsecutiveWorkDays: 6,
      maxNightShiftsPerWeek: null,
      enabledRules: [
        'excessive_shift_hours',
        'insufficient_rest',
        'excessive_weekly_hours',
        'excessive_monthly_hours',
        'excessive_quarterly_hours',
        'excessive_yearly_hours',
        'excessive_consecutive_days',
      ],
      workHoursSource: 'production_calendar',
      customApiUrl: null,
      lastSyncAt: null,
    },
  });
  console.log('✅ Created labor law settings');

  // Создание норм часов для 2024 и 2025 годов
  const currentYear = new Date().getFullYear();
  await Promise.all([
    prisma.workHoursNorm.create({
      data: {
        year: currentYear,
        totalHours: 1970, // Примерная норма для 2024
        isManualOverride: false,
        source: 'production_calendar',
        workingDays: 247,
        weekendDays: 118,
        holidayDays: 0,
        metadata: {
          holidays: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05', '2024-01-08', '2024-02-23', '2024-03-08', '2024-05-01', '2024-05-09', '2024-06-12', '2024-11-04'],
          workingWeekends: [],
          calculationDetails: {
            weeklyHours: 40,
            calculatedFrom: 'production_calendar',
          },
        },
      },
    }),
    prisma.workHoursNorm.create({
      data: {
        year: currentYear + 1,
        totalHours: 1979, // Примерная норма для 2025
        isManualOverride: false,
        source: 'production_calendar',
        workingDays: 248,
        weekendDays: 117,
        holidayDays: 0,
        metadata: {
          holidays: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07', '2025-01-08', '2025-02-23', '2025-03-08', '2025-05-01', '2025-05-09', '2025-06-12', '2025-11-04'],
          workingWeekends: [],
          calculationDetails: {
            weeklyHours: 40,
            calculatedFrom: 'production_calendar',
          },
        },
      },
    }),
  ]);
  console.log('✅ Created work hours norms for current and next year');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


