/**
 * Панель отображения нарушений требований ТК РФ для расписания
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getViolations,
  getViolationStats,
  resolveViolation,
  validateSchedule,
} from '../../services/api/laborLawComplianceApi';
import { schedulesService } from '@services/api';
import { LaborViolation, ViolationStats, ReportingPeriod } from '../../types';

interface LaborViolationsPanelProps {
  scheduleId: string;
}

export default function LaborViolationsPanel({ scheduleId }: LaborViolationsPanelProps) {
  const [violations, setViolations] = useState<LaborViolation[]>([]);
  const [stats, setStats] = useState<ViolationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  // Получаем расписание для доступа к reportingPeriod
  const { data: schedule } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedulesService.getScheduleById(scheduleId),
    enabled: !!scheduleId,
  });

  useEffect(() => {
    loadData();
  }, [scheduleId, filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [violationsData, statsData] = await Promise.all([
        getViolations(scheduleId, {
          severity: filter === 'all' ? undefined : filter,
        }),
        getViolationStats(scheduleId),
      ]);
      
      // Фильтруем нарушения в зависимости от отчетного периода
      let filteredViolations = violationsData;
      if (schedule?.reportingPeriod === 'year') {
        // При годовом периоде скрываем недельные, месячные и квартальные нарушения
        filteredViolations = violationsData.filter(
          (v) =>
            v.violationType !== 'excessive_weekly_hours' &&
            v.violationType !== 'excessive_monthly_hours' &&
            v.violationType !== 'excessive_quarterly_hours'
        );
      }
      
      setViolations(filteredViolations);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading violations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      await validateSchedule(scheduleId);
      await loadData();
    } catch (error) {
      console.error('Error validating schedule:', error);
    } finally {
      setValidating(false);
    }
  };

  const handleResolve = async (violationId: string) => {
    try {
      await resolveViolation(violationId, 'Нарушение исправлено');
      await loadData();
    } catch (error) {
      console.error('Error resolving violation:', error);
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-red-100 text-red-800',
      warning: 'bg-yellow-100 text-yellow-800',
      info: 'bg-blue-100 text-blue-800',
    };
    return colors[severity as keyof typeof colors] || colors.info;
  };

  const getSeverityLabel = (severity: string) => {
    const labels = {
      critical: 'Критическое',
      warning: 'Предупреждение',
      info: 'Информация',
    };
    return labels[severity as keyof typeof labels] || severity;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Заголовок и действия */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Проверка ТК РФ</h2>
        <button
          onClick={handleValidate}
          disabled={validating}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {validating ? 'Проверка...' : 'Запустить проверку'}
        </button>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Всего нарушений</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg shadow">
            <div className="text-sm text-red-600">Критических</div>
            <div className="text-2xl font-bold text-red-800">
              {stats.bySeverity.critical || 0}
            </div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <div className="text-sm text-yellow-600">Предупреждений</div>
            <div className="text-2xl font-bold text-yellow-800">
              {stats.bySeverity.warning || 0}
            </div>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <div className="text-sm text-blue-600">Информационных</div>
            <div className="text-2xl font-bold text-blue-800">
              {stats.bySeverity.info || 0}
            </div>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="mb-4 flex space-x-2">
        {['all', 'critical', 'warning', 'info'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-3 py-1 rounded-md text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {f === 'all' ? 'Все' : getSeverityLabel(f)}
          </button>
        ))}
      </div>

      {/* Список нарушений */}
      {violations.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-green-800 font-medium">
            Нарушений не обнаружено
          </div>
          <div className="text-sm text-green-600 mt-1">
            Расписание соответствует требованиям ТК РФ
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {violations.map((violation) => (
            <div
              key={violation.id}
              className={`bg-white border rounded-lg p-4 ${
                violation.resolved ? 'opacity-60' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getSeverityBadge(
                        violation.severity
                      )}`}
                    >
                      {getSeverityLabel(violation.severity)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {violation.articleTkRf}
                    </span>
                    {violation.resolved && (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                        Решено
                      </span>
                    )}
                  </div>
                  <p className="text-gray-900 mb-2">{violation.description}</p>
                  {violation.employee && (
                    <p className="text-sm text-gray-600">
                      Сотрудник: {violation.employee.fullName} (№
                      {violation.employee.tabNumber})
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Обнаружено: {new Date(violation.detectedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                {!violation.resolved && (
                  <button
                    onClick={() => handleResolve(violation.id)}
                    className="ml-4 px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Отметить решенным
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

