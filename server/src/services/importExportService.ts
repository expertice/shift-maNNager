import { prisma } from '../lib/prisma';
import { Employee, Department, Position, ShiftProfile, ShiftType, ShiftProfilePattern } from '@prisma/client';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { ShiftProfileWithDetails, UpdateShiftProfileData, UpdateShiftTypeData, UpdateShiftPatternData, createShiftProfile, updateShiftProfile } from './shiftProfilesService';

export interface ImportRow {
  fullName: string;
  tabNumber: string;
  department?: string;
  position?: string;
  birthDate?: string;
}

export interface ValidationError {
  row: number;
  message: string;
}

export interface ImportResult {
  success: number;
  errors: ValidationError[];
}

export type ImportMode = 'create' | 'update' | 'mixed';

/**
 * Парсинг CSV файла
 */
export function parseCSVFile(buffer: Buffer): ImportRow[] {
  try {
    const text = buffer.toString('utf-8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    return records.map((record) => ({
      fullName: record['ФИО'] || record['fullName'] || record['Full Name'] || '',
      tabNumber: record['Табельный номер'] || record['tabNumber'] || record['Tab Number'] || '',
      department: record['Отдел'] || record['department'] || record['Department'] || undefined,
      position: record['Должность'] || record['position'] || record['Position'] || undefined,
      birthDate: record['Дата рождения'] || record['birthDate'] || record['Birth Date'] || undefined,
    }));
  } catch (error) {
    throw new Error('Ошибка при парсинге CSV файла');
  }
}

/**
 * Парсинг Excel файла
 */
export function parseExcelFile(buffer: Buffer): ImportRow[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

    return records.map((record) => ({
      fullName: record['ФИО'] || record['fullName'] || record['Full Name'] || '',
      tabNumber: String(record['Табельный номер'] || record['tabNumber'] || record['Tab Number'] || ''),
      department: record['Отдел'] || record['department'] || record['Department'] || undefined,
      position: record['Должность'] || record['position'] || record['Position'] || undefined,
      birthDate: record['Дата рождения'] || record['birthDate'] || record['Birth Date'] || undefined,
    }));
  } catch (error) {
    throw new Error('Ошибка при парсинге Excel файла');
  }
}

/**
 * Валидация данных импорта
 */
export function validateImportData(
  rows: ImportRow[],
  scheduleId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +2 потому что первая строка - заголовок, индексация с 0

    if (!row.fullName || row.fullName.trim() === '') {
      errors.push({
        row: rowNumber,
        message: 'ФИО обязательно для заполнения',
      });
    }

    if (!row.tabNumber || row.tabNumber.trim() === '') {
      errors.push({
        row: rowNumber,
        message: 'Табельный номер обязателен для заполнения',
      });
    }
  });

  return errors;
}

/**
 * Получить или создать отдел
 */
async function getOrCreateDepartment(
  scheduleId: string,
  departmentName: string | undefined
): Promise<string | null> {
  if (!departmentName || departmentName.trim() === '') {
    return null;
  }

  const trimmedName = departmentName.trim();

  // Ищем существующий отдел
  let department = await prisma.department.findFirst({
    where: {
      scheduleId,
      name: trimmedName,
    },
  });

  // Создаем новый, если не найден
  if (!department) {
    department = await prisma.department.create({
      data: {
        scheduleId,
        name: trimmedName,
      },
    });
  }

  return department.id;
}

/**
 * Получить или создать должность
 */
async function getOrCreatePosition(
  scheduleId: string,
  positionName: string | undefined
): Promise<string | null> {
  if (!positionName || positionName.trim() === '') {
    return null;
  }

  const trimmedName = positionName.trim();

  // Ищем существующую должность
  let position = await prisma.position.findFirst({
    where: {
      scheduleId,
      name: trimmedName,
    },
  });

  // Создаем новую, если не найдена
  if (!position) {
    position = await prisma.position.create({
      data: {
        scheduleId,
        name: trimmedName,
      },
    });
  }

  return position.id;
}

/**
 * Обработка импорта
 */
export async function processImport(
  rows: ImportRow[],
  scheduleId: string,
  mode: ImportMode
): Promise<ImportResult> {
  const errors: ValidationError[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    try {
      // Валидация строки
      if (!row.fullName || row.fullName.trim() === '') {
        errors.push({ row: rowNumber, message: 'ФИО обязательно' });
        continue;
      }
      if (!row.tabNumber || row.tabNumber.trim() === '') {
        errors.push({ row: rowNumber, message: 'Табельный номер обязателен' });
        continue;
      }

      // Получаем или создаем отдел и должность
      const departmentId = await getOrCreateDepartment(scheduleId, row.department);
      const positionId = await getOrCreatePosition(scheduleId, row.position);

      // Парсим дату рождения
      let birthDate: Date | undefined;
      if (row.birthDate) {
        const parsedDate = new Date(row.birthDate);
        if (!isNaN(parsedDate.getTime())) {
          birthDate = parsedDate;
        }
      }

      // Ищем существующего сотрудника по табельному номеру
      const existingEmployee = await prisma.employee.findFirst({
        where: {
          scheduleId,
          tabNumber: row.tabNumber.trim(),
        },
      });

      if (existingEmployee) {
        // Обновление существующего
        if (mode === 'create') {
          errors.push({
            row: rowNumber,
            message: 'Сотрудник с таким табельным номером уже существует (режим: только создание)',
          });
          continue;
        }

        // Обновляем сотрудника
        await prisma.employee.update({
          where: { id: existingEmployee.id },
          data: {
            fullName: row.fullName.trim(),
            departmentId,
            positionId: positionId || undefined,
            birthDate: birthDate || undefined,
          },
        });
        successCount++;
      } else {
        // Создание нового
        if (mode === 'update') {
          errors.push({
            row: rowNumber,
            message: 'Сотрудник с таким табельным номером не найден (режим: только обновление)',
          });
          continue;
        }

        // Создаем нового сотрудника
        await prisma.employee.create({
          data: {
            scheduleId,
            fullName: row.fullName.trim(),
            tabNumber: row.tabNumber.trim(),
            departmentId,
            positionId: positionId || undefined,
            birthDate: birthDate || undefined,
          },
        });
        successCount++;
      }
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    }
  }

  return {
    success: successCount,
    errors,
  };
}

/**
 * Генерация CSV файла
 */
export function generateCSV(employees: (Employee & { department: Department | null; position: Position | null })[]): Buffer {
  const headers = ['ФИО', 'Табельный номер', 'Отдел', 'Должность', 'Дата рождения'];
  const rows = employees.map((emp) => [
    emp.fullName,
    emp.tabNumber,
    emp.department?.name || '',
    emp.position?.name || '',
    emp.birthDate ? new Date(emp.birthDate).toISOString().split('T')[0] : '',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Генерация Excel файла
 */
export function generateExcel(employees: (Employee & { department: Department | null; position: Position | null })[]): Buffer {
  const headers = ['ФИО', 'Табельный номер', 'Отдел', 'Должность', 'Дата рождения'];
  const rows = employees.map((emp) => [
    emp.fullName,
    emp.tabNumber,
    emp.department?.name || '',
    emp.position?.name || '',
    emp.birthDate ? new Date(emp.birthDate).toISOString().split('T')[0] : '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Сотрудники');

  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

// ============ Экспорт/Импорт профилей смен ============

export interface ShiftProfileExportData {
  name: string;
  cycleLength: number;
  minEmployees: number;
  description: string | null;
  shiftTypes: Array<{
    name: string;
    startTime: string;
    endTime: string;
    breaks: Array<{ startTime: string; endTime: string; duration: number }>;
    nightHoursCount: number;
    workingHours: number;
    color: string | null;
  }>;
  patterns: Array<{
    patternNumber: number;
    cycleLength: number;
    sequence: (string | null)[]; // Имена типов смен или null
  }>;
}

export interface ShiftProfilesExport {
  profiles: ShiftProfileExportData[];
}

export interface ShiftProfileImportRow {
  name: string;
  cycleLength?: number;
  minEmployees?: number;
  description?: string | null;
  shiftTypes: Array<{
    name: string;
    startTime: string;
    endTime: string;
    breaks: Array<{ startTime: string; endTime: string; duration: number }>;
    nightHoursCount: number;
    workingHours: number;
    color?: string | null;
  }>;
  patterns: Array<{
    patternNumber: number;
    cycleLength: number;
    sequence: (string | null)[]; // Имена типов смен или null
  }>;
}

/**
 * Экспорт профилей смен в JSON
 */
export function exportShiftProfilesToJSON(
  profiles: ShiftProfileWithDetails[]
): Buffer {
  const exportData: ShiftProfilesExport = {
    profiles: profiles.map((profile) => {
      // Создаем маппинг ID типов смен на их имена
      const shiftTypeIdToName = new Map<string, string>();
      profile.shiftTypes.forEach((st) => {
        shiftTypeIdToName.set(st.id, st.name);
      });

      return {
        name: profile.name,
        cycleLength: profile.cycleLength,
        minEmployees: profile.minEmployees,
        description: profile.description,
        shiftTypes: profile.shiftTypes.map((st) => ({
          name: st.name,
          startTime: st.startTime,
          endTime: st.endTime,
          breaks: st.breaks as Array<{ startTime: string; endTime: string; duration: number }>,
          nightHoursCount: st.nightHoursCount,
          workingHours: Number(st.workingHours),
          color: st.color,
        })),
        patterns: profile.patterns.map((pattern) => {
          const sequence = pattern.sequence as (string | null)[];
          // Заменяем ID типов смен на их имена
          const sequenceWithNames = sequence.map((shiftTypeId) => {
            if (shiftTypeId === null) {
              return null;
            }
            return shiftTypeIdToName.get(shiftTypeId) || null;
          });

          return {
            patternNumber: pattern.patternNumber,
            cycleLength: pattern.cycleLength,
            sequence: sequenceWithNames,
          };
        }),
      };
    }),
  };

  return Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');
}

/**
 * Парсинг JSON файла с профилями смен
 */
export function parseShiftProfilesFromJSON(buffer: Buffer): ShiftProfileImportRow[] {
  try {
    const text = buffer.toString('utf-8');
    const data = JSON.parse(text) as ShiftProfilesExport;

    if (!data.profiles || !Array.isArray(data.profiles)) {
      throw new Error('Неверный формат файла: ожидается объект с полем "profiles"');
    }

    return data.profiles;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Ошибка при парсинге JSON файла: неверный формат JSON');
    }
    throw error instanceof Error ? error : new Error('Ошибка при парсинге JSON файла');
  }
}

/**
 * Валидация данных импорта профилей смен
 */
export function validateShiftProfilesImport(
  rows: ShiftProfileImportRow[],
  scheduleId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;

    // Валидация основных полей профиля
    if (!row.name || row.name.trim() === '') {
      errors.push({
        row: rowNumber,
        message: 'Название профиля обязательно для заполнения',
      });
    }

    // Валидация типов смен
    if (!row.shiftTypes || !Array.isArray(row.shiftTypes) || row.shiftTypes.length === 0) {
      errors.push({
        row: rowNumber,
        message: 'Профиль должен содержать хотя бы один тип смены',
      });
    } else {
      const shiftTypeNames = new Set<string>();
      row.shiftTypes.forEach((st, stIndex) => {
        if (!st.name || st.name.trim() === '') {
          errors.push({
            row: rowNumber,
            message: `Тип смены #${stIndex + 1}: название обязательно`,
          });
        } else if (shiftTypeNames.has(st.name.toLowerCase().trim())) {
          errors.push({
            row: rowNumber,
            message: `Тип смены #${stIndex + 1}: название "${st.name}" дублируется`,
          });
        } else {
          shiftTypeNames.add(st.name.toLowerCase().trim());
        }

        if (!st.startTime || !st.endTime) {
          errors.push({
            row: rowNumber,
            message: `Тип смены #${stIndex + 1}: время начала и окончания обязательны`,
          });
        }

        if (typeof st.workingHours !== 'number' || st.workingHours < 0) {
          errors.push({
            row: rowNumber,
            message: `Тип смены #${stIndex + 1}: количество рабочих часов должно быть положительным числом`,
          });
        }

        if (typeof st.nightHoursCount !== 'number' || st.nightHoursCount < 0) {
          errors.push({
            row: rowNumber,
            message: `Тип смены #${stIndex + 1}: количество ночных часов должно быть неотрицательным числом`,
          });
        }
      });
    }

    // Валидация паттернов
    if (!row.patterns || !Array.isArray(row.patterns) || row.patterns.length === 0) {
      errors.push({
        row: rowNumber,
        message: 'Профиль должен содержать хотя бы один паттерн',
      });
    } else {
      const patternNumbers = new Set<number>();
      row.patterns.forEach((pattern, pIndex) => {
        if (typeof pattern.patternNumber !== 'number' || pattern.patternNumber < 1) {
          errors.push({
            row: rowNumber,
            message: `Паттерн #${pIndex + 1}: номер паттерна должен быть положительным числом`,
          });
        } else if (patternNumbers.has(pattern.patternNumber)) {
          errors.push({
            row: rowNumber,
            message: `Паттерн #${pIndex + 1}: номер паттерна ${pattern.patternNumber} дублируется`,
          });
        } else {
          patternNumbers.add(pattern.patternNumber);
        }

        if (typeof pattern.cycleLength !== 'number' || pattern.cycleLength < 1) {
          errors.push({
            row: rowNumber,
            message: `Паттерн #${pIndex + 1}: длина цикла должна быть положительным числом`,
          });
        }

        if (!pattern.sequence || !Array.isArray(pattern.sequence)) {
          errors.push({
            row: rowNumber,
            message: `Паттерн #${pIndex + 1}: последовательность обязательна`,
          });
        } else {
          // Проверяем, что все имена типов смен в sequence существуют в shiftTypes
          const shiftTypeNames = new Set(
            row.shiftTypes.map((st) => st.name.toLowerCase().trim())
          );
          pattern.sequence.forEach((item, seqIndex) => {
            if (item !== null && !shiftTypeNames.has(item.toLowerCase().trim())) {
              errors.push({
                row: rowNumber,
                message: `Паттерн #${pIndex + 1}, позиция ${seqIndex + 1}: тип смены "${item}" не найден в списке типов смен`,
              });
            }
          });
        }
      });
    }
  });

  return errors;
}

/**
 * Обработка импорта профилей смен
 */
export async function processShiftProfilesImport(
  rows: ShiftProfileImportRow[],
  scheduleId: string,
  mode: ImportMode
): Promise<ImportResult> {
  const errors: ValidationError[] = [];
  let successCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;

    try {
      // Валидация строки
      if (!row.name || row.name.trim() === '') {
        errors.push({ row: rowNumber, message: 'Название профиля обязательно' });
        continue;
      }

      if (!row.shiftTypes || row.shiftTypes.length === 0) {
        errors.push({ row: rowNumber, message: 'Профиль должен содержать типы смен' });
        continue;
      }

      if (!row.patterns || row.patterns.length === 0) {
        errors.push({ row: rowNumber, message: 'Профиль должен содержать паттерны' });
        continue;
      }

      // Ищем существующий профиль по имени
      const existingProfile = await prisma.shiftProfile.findFirst({
        where: {
          scheduleId,
          name: row.name.trim(),
        },
        include: {
          shiftTypes: true,
          patterns: true,
        },
      });

      if (existingProfile) {
        // Обновление существующего
        if (mode === 'create') {
          errors.push({
            row: rowNumber,
            message: `Профиль с названием "${row.name}" уже существует (режим: только создание)`,
          });
          continue;
        }

        // Подготавливаем данные для обновления
        const updateData: UpdateShiftProfileData = {
          scheduleId,
          name: row.name.trim(),
          description: row.description ?? null,
          shiftTypes: row.shiftTypes.map((st) => ({
            name: st.name.trim(),
            startTime: st.startTime,
            endTime: st.endTime,
            breaks: st.breaks,
            nightHoursCount: st.nightHoursCount,
            workingHours: st.workingHours,
            color: st.color ?? undefined,
          })),
          patterns: row.patterns.map((p) => ({
            patternNumber: p.patternNumber,
            cycleLength: p.cycleLength,
            sequence: p.sequence, // Пока оставляем имена, заменим на ID позже
          })),
        };

        // Заменяем имена типов смен на временные ID для обновления
        const shiftTypeNameToTempId = new Map<string, string>();
        updateData.shiftTypes.forEach((st, index) => {
          const tempId = `temp-${i}-${index}`;
          shiftTypeNameToTempId.set(st.name.toLowerCase().trim(), tempId);
          st.id = tempId;
        });

        // Заменяем имена в sequence на временные ID
        updateData.patterns.forEach((pattern) => {
          pattern.sequence = pattern.sequence.map((name) => {
            if (name === null) return null;
            const tempId = shiftTypeNameToTempId.get(name.toLowerCase().trim());
            return tempId || null;
          });
        });

        // Обновляем профиль
        await updateShiftProfile(existingProfile.id, updateData);
        successCount++;
      } else {
        // Создание нового
        if (mode === 'update') {
          errors.push({
            row: rowNumber,
            message: `Профиль с названием "${row.name}" не найден (режим: только обновление)`,
          });
          continue;
        }

        // Подготавливаем данные для создания
        const createData: UpdateShiftProfileData = {
          scheduleId,
          name: row.name.trim(),
          description: row.description ?? null,
          shiftTypes: row.shiftTypes.map((st) => ({
            name: st.name.trim(),
            startTime: st.startTime,
            endTime: st.endTime,
            breaks: st.breaks,
            nightHoursCount: st.nightHoursCount,
            workingHours: st.workingHours,
            color: st.color ?? undefined,
          })),
          patterns: row.patterns.map((p) => ({
            patternNumber: p.patternNumber,
            cycleLength: p.cycleLength,
            sequence: p.sequence, // Пока оставляем имена, заменим на ID позже
          })),
        };

        // Заменяем имена типов смен на временные ID для создания
        const shiftTypeNameToTempId = new Map<string, string>();
        createData.shiftTypes.forEach((st, index) => {
          const tempId = `temp-${i}-${index}`;
          shiftTypeNameToTempId.set(st.name.toLowerCase().trim(), tempId);
          st.id = tempId;
        });

        // Заменяем имена в sequence на временные ID
        createData.patterns.forEach((pattern) => {
          pattern.sequence = pattern.sequence.map((name) => {
            if (name === null) return null;
            const tempId = shiftTypeNameToTempId.get(name.toLowerCase().trim());
            return tempId || null;
          });
        });

        // Создаем профиль
        await createShiftProfile(createData);
        successCount++;
      }
    } catch (error) {
      errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : 'Неизвестная ошибка',
      });
    }
  }

  return {
    success: successCount,
    errors,
  };
}

