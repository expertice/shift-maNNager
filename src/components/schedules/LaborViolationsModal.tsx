/**
 * Модальное окно для проверки и отображения нарушений требований ТК РФ
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal, Button, Badge, Card } from '@components/common';
import {
  getViolations,
  getViolationStats,
  resolveViolation,
  validateSchedule,
} from '../../services/api/laborLawComplianceApi';
import { schedulesService } from '@services/api';
import { LaborViolation, ViolationStats } from '../../types';

interface LaborViolationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: string;
}

export default function LaborViolationsModal({
  isOpen,
  onClose,
  scheduleId,
}: LaborViolationsModalProps) {
  const [violations, setViolations] = useState<LaborViolation[]>([]);
  const [stats, setStats] = useState<ViolationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(false);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  // Получаем расписание для доступа к reportingPeriod
  const { data: schedule } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedulesService.getScheduleById(scheduleId),
    enabled: !!scheduleId && isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [scheduleId, filter, isOpen, schedule?.reportingPeriod]);

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

  const getViolationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      excessive_shift_hours: 'Превышение длительности смены',
      insufficient_rest: 'Недостаточный отдых между сменами',
      excessive_weekly_hours: 'Превышение недельной нормы',
      excessive_monthly_hours: 'Превышение месячной нормы',
      excessive_quarterly_hours: 'Превышение квартальной нормы',
      excessive_yearly_hours: 'Превышение годовой нормы',
      excessive_consecutive_days: 'Превышение рабочих дней подряд',
      excessive_night_shifts: 'Превышение ночных смен',
    };
    return labels[type] || type;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Проверка соответствия ТК РФ"
      size="lg"
    >
      <div className="space-y-4">
        {/* Кнопка запуска проверки */}
        <div className="flex justify-end">
          <Button
            onClick={handleValidate}
            variant="primary"
            isLoading={validating}
            disabled={validating}
          >
            {validating ? 'Проверка...' : 'Запустить проверку'}
          </Button>
        </div>

        {/* Статистика */}
        {stats && (
          <Card padding="md" className="bg-gray-50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-600">Всего</div>
                <div className="text-2xl font-bold">{stats.total}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Критических</div>
                <div className="text-2xl font-bold text-red-600">
                  {stats.bySeverity.critical || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Предупреждений</div>
                <div className="text-2xl font-bold text-yellow-600">
                  {stats.bySeverity.warning || 0}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Решено</div>
                <div className="text-2xl font-bold text-green-600">
                  {stats.resolved}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Фильтры */}
        <div className="flex space-x-2">
          {(['all', 'critical', 'warning', 'info'] as const).map((severity) => (
            <button
              key={severity}
              onClick={() => setFilter(severity)}
              className={`px-3 py-1 rounded-md text-sm ${
                filter === severity
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {severity === 'all'
                ? 'Все'
                : getSeverityLabel(severity)}
            </button>
          ))}
        </div>

        {/* Список нарушений */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Загрузка...</div>
        ) : violations.length === 0 ? (
          <Card padding="md" className="bg-green-50 border-green-200 text-center">
            <p className="text-green-800">
              {schedule?.reportingPeriod === 'year'
                ? 'Нарушений не обнаружено (годовой период - проверяются только годовые лимиты)'
                : 'Нарушений не обнаружено'}
            </p>
          </Card>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {violations.map((violation) => (
              <Card
                key={violation.id}
                padding="md"
                className={`border-l-4 ${
                  violation.severity === 'critical'
                    ? 'border-red-500'
                    : violation.severity === 'warning'
                    ? 'border-yellow-500'
                    : 'border-blue-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge
                        className={getSeverityBadge(violation.severity)}
                      >
                        {getSeverityLabel(violation.severity)}
                      </Badge>
                      <span className="text-sm font-medium">
                        {getViolationTypeLabel(violation.violationType)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">
                      {violation.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      Статья ТК РФ: {violation.articleTkRf} | Дата:{' '}
                      {new Date(violation.dateFrom).toLocaleDateString('ru-RU')}
                      {violation.dateTo &&
                        ` - ${new Date(violation.dateTo).toLocaleDateString('ru-RU')}`}
                    </p>
                    {violation.employee && (
                      <p className="text-xs text-gray-500 mt-1">
                        Сотрудник: {violation.employee.fullName} (
                        {violation.employee.tabNumber})
                      </p>
                    )}
                  </div>
                  {!violation.resolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolve(violation.id)}
                    >
                      Отметить решённым
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

