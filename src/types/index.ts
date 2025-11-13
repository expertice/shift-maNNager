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
  user?: {
    id: string;
    email: string;
  };
}

// ============ Расписания (Schedules) ============

/**
 * Статус схемы планирования
 */
export type ScheduleStatus = 'draft' | 'published' | 'completed' | 'archived';

/**
 * Отчетный период для контроля часов
 */
export type ReportingPeriod = 'week' | 'month' | 'quarter' | 'year';

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
  reportingPeriod?: ReportingPeriod;
  allowOvertimeWeekly?: boolean;
  allowOvertimeMonthly?: boolean;
  allowOvertimeQuarterly?: boolean;
  patternStartOffset?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Расширенная информация о схеме с связанными данными
 */
export interface ScheduleWithDetails extends Schedule {
  permissions?: SchedulePermission[];
  departments?: Department[];
  positions?: Position[];
  employees?: Employee[];
  shifts?: Shift[];
  vacations?: Vacation[];
  conflicts?: Conflict[];
  shiftProfiles?: ShiftProfile[];
  shiftAssignments?: ScheduleShiftAssignment[];
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
 * Должность в рамках схемы
 */
export interface Position {
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
  departmentId: string | null;
  positionId: string | null;
  shiftProfileId?: string | null;
  fullName: string;
  tabNumber: string;
  birthDate?: Date | null;
  loginId?: string | null;
  passwordHash?: string | null;
  passwordExpiry?: Date | null;
  isPlaceholder?: boolean;
  isHidden?: boolean;
  createdAt: Date;
  department?: Department;
  position?: Position;
  shiftProfile?: ShiftProfile;
  restrictions?: EmployeeRestriction[];
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
  color?: string;         // Цвет для визуализации (hex)
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
 * Профиль смены (уникальный для каждого расписания, например 2/2, 3/3)
 */
export interface ShiftProfile {
  id: string;
  scheduleId: string;
  name: string;
  cycleLength: number;
  minEmployees: number;
  description: string | null;
  shiftTypes?: ShiftType[];
  patterns?: ShiftPattern[];
}

/**
 * Данные для редактирования типа смены
 */
export interface EditShiftTypeData {
  id?: string; // Если указан, обновляем существующий
  name: string;
  startTime: string;
  endTime: string;
  breaks: ShiftBreak[];
  nightHoursCount: number;
  workingHours: number;
  color?: string;
}

/**
 * Данные для редактирования паттерна
 */
export interface EditShiftPatternData {
  id?: string; // Если указан, обновляем существующий
  patternNumber: number;
  cycleLength: number;
  sequence: (string | null)[]; // ID типов смен или null для отдыха
}

/**
 * Данные для редактирования профиля смены
 */
export interface EditShiftProfileData {
  scheduleId: string;
  name: string;
  description?: string | null;
  shiftTypes: EditShiftTypeData[];
  patterns: EditShiftPatternData[];
  // cycleLength и minEmployees вычисляются автоматически
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
  modifiedReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
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
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  employee?: Employee;
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
  dailyShiftId?: string | null;
  vacationId?: string | null;
  businessTripId?: string | null;
  conflictType: ConflictType;
  resolved: boolean;
  resolutionNotes?: string | null;
  createdAt: Date;
  dailyShift?: Shift;
  vacation?: Vacation;
  businessTrip?: BusinessTrip;
  solutions?: ConflictSolution[];
}

/**
 * Предложенное решение конфликта
 */
export interface ConflictSolution {
  id: string;
  conflictId: string;
  employeeIdSubstitute: string;
  newDate?: Date | null;
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
  scheduleId?: string | null;
  date: Date;
  eventType: CalendarEventType;
  description: string;
  isWorkingDay: boolean;
  employeeId?: string | null;
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
  cumulativeHoursYTD: number;
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
  userId?: string | null;
  employeeId?: string | null;
  tableName: string;
  recordId: string;
  changeType: ChangeType;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string | null;
  createdAt: Date;
  version: number;
  employee?: {
    id: string;
    fullName: string;
  };
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
  details?: Record<string, unknown>;
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
  employeeHoursMap: Record<string, number>;
  employeeNightHoursMap: Record<string, number>;
  conflictCount: number;
}

/**
 * Сравнение вариантов расписания
 */
export interface ScheduleComparison {
  variant1: ScheduleAnalytics;
  variant2: ScheduleAnalytics;
  differences: {
    hoursPerEmployeeDiff: Record<string, number>;
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
  | 'vacation_updated'
  | 'vacation_deleted'
  | 'vacation_conflict'
  | 'conflict_detected'
  | 'schedule_published'
  | 'exchange_request_created'
  | 'exchange_request_resolved';

/**
 * Real-time событие
 */
export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  scheduleId: string;
  userId?: string;
  timestamp: Date;
  data: T;
}

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
  positionId: z.string().uuid().optional().nullable(),
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

// ============ Сравнение профилей смен ============

/**
 * Модуль метрик для сравнения (расширяемый)
 */
export interface ProfileComparisonMetric {
  metricId: string;
  metricName: string;
  value: number | string;
}

/**
 * Метрики по одному сотруднику в одном профиле
 */
export interface EmployeeProfileMetrics {
  employeeNumber: number; // Номер сотрудника (1, 2, 3...)
  shiftsCount: number;
  totalHours: number;
  nightHours: number;
  shiftTypeCounts?: Record<string, number>; // Количество смен каждого типа (shiftTypeId -> count)
  additionalMetrics?: ProfileComparisonMetric[]; // Для будущего расширения
}

/**
 * Паттерн для визуализации
 */
export interface VisualizedPattern {
  patternNumber: number;
  sequence: (ShiftType | null)[]; // null = выходной день
  cycleLength: number;
}

/**
 * Результат сравнения для одного профиля
 */
export interface ProfileComparisonResult {
  profile: ShiftProfile;
  employeeCount: number;
  employeeMetrics: EmployeeProfileMetrics[];
  visualizedPatterns: VisualizedPattern[];
  shiftTypes: ShiftType[]; // Типы смен для отображения названий
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Запрос на сравнение профилей
 */
export interface CompareProfilesRequest {
  profileIds: string[];
  startDate: string; // ISO date
  endDate: string; // ISO date
  employeeCount?: number;
}

// ============ Контроль соответствия ТК РФ ============

/**
 * Источник норм рабочего времени
 */
export type WorkHoursSource = 'manual' | 'production_calendar' | 'consultant_ru' | 'custom_api';

/**
 * Интервал минимального отдыха между сменами
 */
export interface MinRestInterval {
  shiftDuration: number;
  minRest: number;
}

/**
 * Настройки контроля режима труда и отдыха ТК РФ
 */
export interface LaborLawSettings {
  id: string;
  maxWorkingHoursPerShift: number;
  minRestBetweenShifts: MinRestInterval[];
  maxHoursPerWeek: number;
  maxHoursPerMonth: number;
  maxHoursPerQuarter: number;
  maxOvertimeHoursPerYear: number;
  nightHoursStart: string;
  nightHoursEnd: string;
  includeBreaksInNightHours: boolean;
  maxConsecutiveWorkDays: number;
  maxNightShiftsPerWeek: number | null;
  enabledRules: string[];
  workHoursSource: WorkHoursSource;
  customApiUrl: string | null;
  lastSyncAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Норма рабочего времени для года
 */
export interface WorkHoursNorm {
  id: string;
  year: number;
  totalHours: number;
  isManualOverride: boolean;
  source: WorkHoursSource;
  workingDays: number | null;
  weekendDays: number | null;
  holidayDays: number | null;
  metadata: any | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Тип нарушения ТК РФ
 */
export type LaborViolationType =
  | 'excessive_shift_hours'
  | 'insufficient_rest'
  | 'excessive_weekly_hours'
  | 'excessive_monthly_hours'
  | 'excessive_quarterly_hours'
  | 'excessive_yearly_hours'
  | 'excessive_consecutive_days'
  | 'excessive_night_shifts';

/**
 * Критичность нарушения
 */
export type ViolationSeverity = 'critical' | 'warning' | 'info';

/**
 * Нарушение требований ТК РФ
 */
export interface LaborViolation {
  id: string;
  scheduleId: string;
  employeeId: string | null;
  violationType: LaborViolationType;
  severity: ViolationSeverity;
  dateFrom: Date;
  dateTo: Date | null;
  dailyShiftId: string | null;
  actualValue: number;
  expectedValue: number;
  articleTkRf: string;
  description: string;
  resolved: boolean;
  resolutionNotes: string | null;
  detectedAt: Date;
  updatedAt: Date;
  employee?: {
    id: string;
    fullName: string;
    tabNumber: string;
  };
  dailyShift?: Shift;
}

/**
 * Статистика нарушений для расписания
 */
export interface ViolationStats {
  total: number;
  bySeverity: Record<ViolationSeverity, number>;
  byType: Record<LaborViolationType, number>;
  resolved: number;
  unresolved: number;
}

/**
 * Ответ от API
 */
export interface CompareProfilesResponse {
  comparisons: ProfileComparisonResult[];
  maxEmployeeCount: number; // Наибольшее minEmployees среди профилей
  employeeCount: number; // Фактическое количество сотрудников в расчёте
}

