import React, { useState, useEffect } from 'react';
import { Input, Button, Card, Badge } from '@components/common';
import { EditShiftTypeData, ShiftBreak } from '@types';
import {
  calculateShiftParameters,
  timeToMinutes,
} from '@services/utils/shiftCalculations';
import { Copy, Trash2, X, Save } from 'lucide-react';

/**
 * Props для компонента редактирования типа смены
 */
export interface ShiftTypeEditorProps {
  /**
   * Данные типа смены для редактирования
   */
  shiftType?: EditShiftTypeData | null;

  /**
   * Callback при сохранении
   */
  onSave: (data: EditShiftTypeData) => void;

  /**
   * Callback при отмене
   */
  onCancel?: () => void;

  /**
   * Callback при удалении (если тип существующий)
   */
  onDelete?: () => void;

  /**
   * Callback при клонировании
   */
  onClone?: () => void;

  /**
   * Режим - создание нового или редактирование
   */
  mode?: 'create' | 'edit';
}

/**
 * Компонент для редактирования типа смены
 */
export const ShiftTypeEditor: React.FC<ShiftTypeEditorProps> = ({
  shiftType,
  onSave,
  onCancel,
  onDelete,
  onClone,
  mode = 'edit',
}) => {
  const [name, setName] = useState(shiftType?.name || '');
  const [startTime, setStartTime] = useState(shiftType?.startTime || '09:00');
  const [endTime, setEndTime] = useState(shiftType?.endTime || '18:00');
  const [color, setColor] = useState(shiftType?.color || '#3B82F6');
  const [manualBreaks, setManualBreaks] = useState<ShiftBreak[]>(
    shiftType?.breaks || []
  );

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Синхронизация с внешними данными
  useEffect(() => {
    if (shiftType) {
      setName(shiftType.name);
      setStartTime(shiftType.startTime);
      setEndTime(shiftType.endTime);
      setColor(shiftType.color || '#3B82F6');
      // Сохраняем только ручные перерывы (без автоматических)
      // Автоматические перерывы будут пересчитываться при сохранении
      // Фильтруем перерывы: убираем автоматические (длительностью ровно 60 минут)
      const manualOnly = (shiftType.breaks || []).filter(b => b.duration !== 60);
      setManualBreaks(manualOnly);
    }
  }, [shiftType]);

  // Расчет всех параметров смены с учетом автоматических перерывов
  const shiftParams = React.useMemo(() => {
    if (!startTime || !endTime) {
      return { nightHours: 0, workingHours: 0, breaks: [] };
    }
    return calculateShiftParameters(startTime, endTime, manualBreaks);
  }, [startTime, endTime, manualBreaks]);

  // Финальные перерывы (автоматические + ручные)
  const allBreaks = shiftParams.breaks;

  const parseTime = (time: string): { hour: number; minute: number } => {
    const [hour, minute] = time.split(':').map(Number);
    return { hour, minute };
  };

  const handleAddBreak = () => {
    setManualBreaks([
      ...manualBreaks,
      {
        startTime: '13:00',
        endTime: '13:30',
        duration: 30,
      },
    ]);
  };

  const handleBreakChange = (index: number, field: keyof ShiftBreak, value: string | number) => {
    const newBreaks = [...manualBreaks];
    newBreaks[index] = { ...newBreaks[index], [field]: value };
    
    // Пересчитываем duration если изменилось время
    if (field === 'startTime' || field === 'endTime') {
      const start = parseTime(newBreaks[index].startTime);
      const end = parseTime(newBreaks[index].endTime);
      let duration = 0;
      
      if (end.hour > start.hour || (end.hour === start.hour && end.minute > start.minute)) {
        duration = (end.hour - start.hour) * 60 + (end.minute - start.minute);
      } else {
        // Перерыв через полночь
        duration = (24 - start.hour) * 60 - start.minute + end.hour * 60 + end.minute;
      }
      
      newBreaks[index].duration = duration;
    }
    
    setManualBreaks(newBreaks);
  };

  const handleRemoveBreak = (index: number) => {
    // Удаляем только из ручных перерывов
    setManualBreaks(manualBreaks.filter((_, i) => i !== index));
  };

  // Определяем, есть ли автоматический перерыв
  // Автоматический перерыв добавляется если смена < 12 часов
  const shiftDuration = React.useMemo(() => {
    if (!startTime || !endTime) return 0;
    const start = timeToMinutes(startTime);
    const end = timeToMinutes(endTime);
    if (end >= start) {
      return (end - start) / 60;
    } else {
      return (24 * 60 - start + end) / 60;
    }
  }, [startTime, endTime]);

  const hasAutomaticBreak = shiftDuration > 0 && shiftDuration < 12;
  // Находим автоматический перерыв (он длится ровно 60 минут и не находится в ручных)
  const automaticBreak = hasAutomaticBreak
    ? allBreaks.find(
        (b) =>
          b.duration === 60 &&
          !manualBreaks.some(
            (mb) => mb.startTime === b.startTime && mb.endTime === b.endTime
          )
      ) || null
    : null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Название обязательно';
    }

    if (!startTime) {
      newErrors.startTime = 'Время начала обязательно';
    }

    if (!endTime) {
      newErrors.endTime = 'Время окончания обязательно';
    }

    // Проверка валидности времени
    const start = parseTime(startTime);
    const end = parseTime(endTime);

    if (
      start.hour < 0 ||
      start.hour > 23 ||
      start.minute < 0 ||
      start.minute > 59 ||
      end.hour < 0 ||
      end.hour > 23 ||
      end.minute < 0 ||
      end.minute > 59
    ) {
      newErrors.time = 'Некорректное время';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    // Используем рассчитанные параметры с автоматическими перерывами
    onSave({
      id: shiftType?.id,
      name: name.trim(),
      startTime,
      endTime,
      breaks: shiftParams.breaks, // Сохраняем все перерывы (автоматические + ручные)
      nightHoursCount: shiftParams.nightHours,
      workingHours: shiftParams.workingHours,
      color,
    });
  };

  return (
    <Card className="p-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {mode === 'create' ? 'Новый тип смены' : 'Редактирование типа смены'}
          </h3>
          <div className="flex gap-2">
            {shiftType?.id && onClone && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={onClone}
                title="Клонировать"
                className="px-2"
              >
                <Copy size={16} />
              </Button>
            )}
            {shiftType?.id && onDelete && (
              <Button 
                type="button" 
                variant="danger" 
                size="sm" 
                onClick={onDelete}
                title="Удалить"
                className="px-2"
              >
                <Trash2 size={16} />
              </Button>
            )}
            {onCancel && (
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={onCancel}
                title="Отмена"
                className="px-2"
              >
                <X size={16} />
              </Button>
            )}
            <Button 
              type="submit" 
              variant="primary" 
              size="sm"
              title={mode === 'create' ? 'Создать' : 'Сохранить'}
              className="px-2"
            >
              <Save size={16} />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Цвет
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#3B82F6"
                className="flex-1"
              />
            </div>
          </div>

          <Input
            label="Время начала"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            error={errors.startTime}
            required
          />

          <Input
            label="Время окончания"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            error={errors.endTime}
            required
          />
        </div>

        {errors.time && (
          <p className="text-sm text-red-600">{errors.time}</p>
        )}

        {/* Автоматически вычисляемые значения */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-600">Ночные часы: </span>
            <Badge variant="info">{shiftParams.nightHours}</Badge>
          </div>
          <div>
            <span className="text-gray-600">Рабочие часы: </span>
            <Badge variant="info">{shiftParams.workingHours.toFixed(2)}</Badge>
          </div>
        </div>

        {/* Перерывы */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Перерывы
            </label>
            <Button type="button" variant="outline" size="sm" onClick={handleAddBreak}>
              Добавить перерыв
            </Button>
          </div>
          
          {/* Автоматический перерыв для смен < 12 часов */}
          {hasAutomaticBreak && automaticBreak && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="info">Автоматический</Badge>
                <span className="text-sm text-gray-600">
                  Для смен меньше 12 часов автоматически добавляется часовой перерыв посередине
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">{automaticBreak.startTime}</span>
                {' - '}
                <span className="font-medium">{automaticBreak.endTime}</span>
                {' '}
                <span className="text-gray-600">({automaticBreak.duration} мин)</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {manualBreaks.map((breakItem, index) => (
              <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                <Input
                  label="Начало"
                  type="time"
                  value={breakItem.startTime}
                  onChange={(e) => handleBreakChange(index, 'startTime', e.target.value)}
                  className="flex-1"
                />
                <Input
                  label="Окончание"
                  type="time"
                  value={breakItem.endTime}
                  onChange={(e) => handleBreakChange(index, 'endTime', e.target.value)}
                  className="flex-1"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{breakItem.duration} мин</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveBreak(index)}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            ))}
            {manualBreaks.length === 0 && !hasAutomaticBreak && (
              <p className="text-sm text-gray-500">Ручные перерывы не указаны</p>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
};

