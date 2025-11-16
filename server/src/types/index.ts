/**
 * Общие TypeScript типы для бэкенда
 */

import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';

/**
 * Расширенный Request с информацией о пользователе
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
  userRole?: UserRole;
}

/**
 * JWT payload
 */
export interface JWTPayload extends JwtPayload {
  userId: string;
  email: string;
}

/**
 * Стандартный API ответ
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  warning?: string;
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

/**
 * Роль пользователя
 */
export type UserRole = 'owner' | 'editor' | 'viewer';

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
 * ShiftType для визуализации (упрощенный)
 */
export interface ShiftTypeForVisualization {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  color?: string;
  workingHours: number;
  nightHoursCount: number;
}

/**
 * Паттерн для визуализации
 */
export interface VisualizedPattern {
  patternNumber: number;
  sequence: (ShiftTypeForVisualization | null)[]; // null = выходной день
  cycleLength: number;
}

/**
 * Профиль для результата сравнения (упрощенный)
 */
export interface ShiftProfileForComparison {
  id: string;
  name: string;
  cycleLength: number;
  minEmployees: number;
  description: string | null;
}

/**
 * Результат сравнения для одного профиля
 */
export interface ProfileComparisonResult {
  profile: ShiftProfileForComparison;
  employeeCount: number;
  employeeMetrics: EmployeeProfileMetrics[];
  visualizedPatterns: VisualizedPattern[];
  shiftTypes: ShiftTypeForVisualization[]; // Типы смен для отображения названий
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

/**
 * Ответ от API
 */
export interface CompareProfilesResponse {
  comparisons: ProfileComparisonResult[];
  maxEmployeeCount: number; // Наибольшее minEmployees среди профилей
  employeeCount: number; // Фактическое количество сотрудников в расчёте
}

