/**
 * Главный файл TypeScript типов для shift-Manager
 * Содержит все интерфейсы и типы приложения
 */

// ============ Пользователи и аутентификация ============

/**
 * Суперпользователь системы
 */
export interface User {
  id: string;
  email: string;
  createdAt: Date;
}

/**
 * Роль пользователя в схеме
 */
export type UserRole = 'owner' | 'editor' | 'viewer';

/**
 * Разрешение пользователя для схемы
 */
export interface SchedulePermission {
  id: string;
  scheduleId: string;
  userId: string;
  role: UserRole;
  createdAt: Date;
}

// ============ Расписания (Schedules) ============

/**
 * Статус схемы планирования
 */
export type ScheduleStatus = 'draft' | 'published' | 'completed' | 'archived';

/**
 * Основная схема планирования
 */
export interface Schedule {
  id: string;
  ownerUserId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: ScheduleStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Расширенная информация о схеме с связанными данными
 */
export interface ScheduleWithDetails extends Schedule {
  permissions: SchedulePermission[];
  departments: Department[];
  employees: Employee[];
  shifts: Shift[];
  vacations: Vacation[];
  conflicts: Conflict[];
  shiftProfiles: ShiftProfile[];
  shiftAssignments: ScheduleShiftAssignment[];
}

// ============ Отделы и сотрудники ============

/**
 * Отдел в рамках схемы
 */
export interface Department {
  id: string;
  scheduleId: string;
  name: string;
}

/**
 * Сотрудник в схеме
 */
export interface Employee {
  id: string;
  scheduleId: string;
  departmentId: string;
  fullName: string;
  tabNumber: string;
  birthDate: Date;
  loginId: string; // ID для входа
  passwordHash: string;
  passwordExpiry: Date | null;
  createdAt: Date;
}

/**
 * Ограничения на сотрудника
 */
export interface EmployeeRestriction {
  id: string;
  employeeId: string;
  restrictionType: 'no_night_shifts' | 'max_hours_per_week' | 'custom';
  value: string;
}

// ============ Смены и типы смен ============

/**
 * Информация о перерыве в смене
 */
export interface ShiftBreak {
  id?: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  duration: number;  // в минутах
}

/**
 * Тип смены (дневная, ночная и т.д.)
 */
export interface ShiftType {
  id: string;
  shiftProfileId: string;
  name: string;
  startTime: string;      // HH:mm
  endTime: string;        // HH:mm
  breaks: ShiftBreak[];
  nightHoursCount: number;  // Количество ночных часов
  workingHours: number;   // Общее рабочее время в часах
}

/**
 * Паттерн смен в профиле
 */
export interface ShiftPattern {
  id: string;
  shiftProfileId: string;
  patternNumber: number;
  cycleLength: number;
  sequence: (string | null)[]; // ID типов смен или null для отдыха
}

/**
 * Профиль смены (глобальный шаблон, например 2/2, 3/3)
 */
export interface ShiftProfile {
  id: string;
  name: string;
  cycleLength: number;
  minEmployees: number;
  description: string;
  shiftTypes?: ShiftType[];
  patterns?: ShiftPattern[];
}

/**
 * Назначение профиля смены схеме
 */
export interface ScheduleShiftAssignment {
  id: string;
  scheduleId: string;
  shiftProfileId: string;
  assignmentNumber: number;
}

/**
 * Назначение паттерна сотруднику
 */
export interface EmployeeShiftAssignment {
  id: string;
  scheduleShiftAssignmentId: string;
  employeeId: string;
  patternNumber: number;
  assignedAt: Date;
}

/**
 * Смена конкретного сотрудника на конкретный день
 */
export interface Shift {
  id: string;
  scheduleId: string;
  employeeId: string;
  date: Date;
  shiftTypeId: string | null;
  status: 'scheduled' | 'modified' | 'cancelled';
  modifiedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Смена с полной информацией
 */
export interface ShiftWithDetails extends Shift {
  shiftType?: ShiftType;
  employee?: Employee;
  conflicts?: Conflict[];
}

// ============ Отпуска и командировки ============

/**
 * Статус отпуска
 */
export type VacationStatus = 'approved' | 'pending' | 'rejected' | 'cancelled';

/**
 * Отпуск сотрудника
 */
export interface Vacation {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  status: VacationStatus;
  createdBy: string; // ID пользователя или сотрудника
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Правила отпусков для схемы
 */
export interface VacationRules {
  id: string;
  scheduleId: string;
  availableDays: number;
  minContinuousDays: number; // Минимум 14 дней согласно ТК РФ
}

/**
 * Командировка
 */
export interface BusinessTrip {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  status: 'approved' | 'pending' | 'rejected' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

// ============ Конфликты ============

/**
 * Тип конфликта
 */
export type ConflictType = 'shift_vs_vacation' | 'shift_vs_business_trip' | 'insufficient_coverage' | 'vacation_overlap';

/**
 * Конфликт между сменой и отпуском/командировкой
 */
export interface Conflict {
  id: string;
  scheduleId: string;
  dailyShiftId?: string;
  vacationId?: string;
  businessTripId?: string;
  conflictType: ConflictType;
  resolved: boolean;
  resolutionNotes?: string;
  createdAt: Date;
}

/**
 * Предложенное решение конфликта
 */
export interface ConflictSolution {
  id: string;
  conflictId: string;
  employeeIdSubstitute: string;
  newDate?: Date;
  priority: number;
  status: 'proposed' | 'accepted' | 'rejected' | 'manual_override';
}

// ============ События в календаре ============

/**
 * Тип события в календаре
 */
export type CalendarEventType = 'holiday' | 'birthday' | 'custom_event' | 'celebration';

/**
 * Событие календаря (праздник, день рождения и т.д.)
 */
export interface CalendarEvent {
  id: string;
  scheduleId?: string | null; // null для глобальных праздников
  date: Date;
  eventType: CalendarEventType;
  description: string;
  isWorkingDay: boolean;
  employeeId?: string;
}

// ============ Отслеживание рабочих часов ============

/**
 * Статус расчёта часов
 */
export type WorkHoursStatus = 'calculated' | 'approved' | 'adjusted';

/**
 * Отслеживание рабочих часов для аналитики
 */
export interface WorkHourTracking {
  id: string;
  employeeId: string;
  scheduleId: string;
  date: Date;
  hoursWorked: number;
  nightHours: number;
  holidayHours: number;
  totalHours: number;
  cumulativeHoursYTD: number; // С начала года
  status: WorkHoursStatus;
  calculatedAt: Date;
}

// ============ История изменений ============

/**
 * Тип изменения
 */
export type ChangeType = 'create' | 'update' | 'delete';

/**
 * История изменений
 */
export interface ChangeHistory {
  id: string;
  scheduleId: string;
  userId?: string;
  employeeId?: string;
  tableName: string;
  recordId: string;
  changeType: ChangeType;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  reason?: string;
  createdAt: Date;
  version: number;
}

// ============ API Запросы и ответы ============

/**
 * Стандартный API ответ
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * API ошибка
 */
export interface ApiError {
  status: number;
  message: string;
  code: string;
  details?: Record<string, any>;
}

/**
 * Пагинированный ответ
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============ Аналитика ============

/**
 * Статистика расписания
 */
export interface ScheduleAnalytics {
  scheduleId: string;
  totalHours: number;
  totalNightHours: number;
  averageHoursPerEmployee: number;
  coveragePercentage: number;
  employeeHoursMap: Map<string, number>;
  conflictCount: number;
}

/**
 * Сравнение вариантов расписания
 */
export interface ScheduleComparison {
  variant1: ScheduleAnalytics;
  variant2: ScheduleAnalytics;
  differences: {
    hoursPerEmployeeDiff: Map<string, number>;
    nightHoursDiff: number;
    coverageDiff: number;
  };
}

// ============ UI состояние ============

/**
 * Режим отображения расписания
 */
export type ViewMode = 'monthly' | 'weekly' | 'yearly';

/**
 * Выбранный диапазон дат
 */
export interface DateRange {
  startDate: Date;
  endDate: Date;
}

/**
 * Состояние боковой панели
 */
export interface SidebarState {
  isOpen: boolean;
  position: 'left' | 'right';
  width: number;
}

// ============ Real-time события ============

/**
 * Типы real-time событий
 */
export type RealtimeEventType = 
  | 'shift_updated'
  | 'vacation_added'
  | 'conflict_detected'
  | 'schedule_published'
  | 'exchange_request_created'
  | 'exchange_request_resolved';

/**
 * Real-time событие
 */
export interface RealtimeEvent<T = any> {
  type: RealtimeEventType;
  scheduleId: string;
  userId: string;
  timestamp: Date;
  data: T;
}

// ============ Экспортируемые типы для комментариев JSDoc ============

/**
 * Вспомогательный тип для работы с датами
 */
export type ISO8601String = string;

/**
 * UUID строка
 */
export type UUID = string;

/**
 * UNIX timestamp
 */
export type UnixTimestamp = number;

// ============ Валидация форм ============

import { z } from 'zod';

/**
 * Схема валидации расписания
 */
export const ScheduleFormSchema = z.object({
  name: z.string().min(1, 'Название схемы обязательно').max(255),
  startDate: z.date(),
  endDate: z.date(),
}).refine((data) => data.endDate > data.startDate, {
  message: 'Конечная дата должна быть позже начальной',
  path: ['endDate'],
});

/**
 * Схема валидации сотрудника
 */
export const EmployeeFormSchema = z.object({
  fullName: z.string().min(1, 'ФИО обязательно').max(255),
  tabNumber: z.string().min(1, 'Табельный номер обязательно'),
  birthDate: z.date().optional(),
  departmentId: z.string().uuid(),
});

/**
 * Схема валидации отпуска
 */
export const VacationFormSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
}).refine((data) => data.endDate >= data.startDate, {
  message: 'Конечная дата должна быть не раньше начальной',
  path: ['endDate'],
});

export type ScheduleFormData = z.infer<typeof ScheduleFormSchema>;
export type EmployeeFormData = z.infer<typeof EmployeeFormSchema>;
export type VacationFormData = z.infer<typeof VacationFormSchema>;
