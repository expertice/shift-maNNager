import React, { useState, useEffect, useMemo } from 'react';
import { Card, Button, Badge, Input, Tooltip } from '@components/common';
import { PatternConstructor, SlotItem, PatternConstructorConfig, slotSizeClasses, SlotView } from './PatternConstructor';
import {
  EditShiftPatternData,
  EditShiftTypeData,
  ShiftPattern,
  ShiftType,
} from '@types';
import {
  validate24HourCoverage,
  validateEmployeesPerShift,
  validateShiftProfile,
  calculateCycleLength,
  calculateMinEmployees,
  getEmployeesPerDay,
  getUncoveredHoursByDayIgnoringBreaks,
} from '@utils/shiftProfileValidation';

/**
 * Props для компонента редактирования паттернов
 */
export interface PatternEditorProps {
  /**
   * Паттерны для редактирования
   */
  patterns: EditShiftPatternData[];

  /**
   * Типы смен для использования в паттернах
   */
  shiftTypes: EditShiftTypeData[];

  /**
   * Callback при изменении паттернов
   */
  onChange: (patterns: EditShiftPatternData[]) => void;

  /**
   * Callback при добавлении нового паттерна
   */
  onAddPattern?: () => void;

  /**
   * Callback при удалении паттерна
   */
  onDeletePattern?: (patternNumber: number) => void;
}

/**
 * Компонент для редактирования паттернов с визуализацией и валидацией
 */
export const PatternEditor: React.FC<PatternEditorProps> = ({
  patterns,
  shiftTypes,
  onChange,
  onAddPattern,
  onDeletePattern,
}) => {
  const [localPatterns, setLocalPatterns] = useState<EditShiftPatternData[]>(patterns);
  const [slotMenu, setSlotMenu] = useState<{ patternIndex: number; dayIndex: number; x: number; y: number } | null>(null);
  const [cycleSlider, setCycleSlider] = useState<{ patternIndex: number; x: number; y: number } | null>(null);
  const [globalCycleLength, setGlobalCycleLength] = useState<number>(patterns[0]?.cycleLength || 1);
  // Ширинный скейл: вычисляем общий scaleX для правых колонок (дни и слоты)
  const [scaleX, setScaleX] = useState<number>(1);
  const rightColRef = React.useRef<HTMLDivElement | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);

  // Синхронизация с внешними данными
  useEffect(() => {
    setLocalPatterns(patterns);
    if (patterns[0]?.cycleLength && patterns[0].cycleLength !== globalCycleLength) {
      setGlobalCycleLength(patterns[0].cycleLength);
    }
  }, [patterns]);

  // Гарантируем единую длину цикла у всех паттернов при смене глобального значения
  useEffect(() => {
    const fixed = localPatterns.map((p) => {
      if (p.cycleLength === globalCycleLength) return p;
      if (globalCycleLength > p.cycleLength) {
        const add = globalCycleLength - p.cycleLength;
        return {
          ...p,
          cycleLength: globalCycleLength,
          sequence: [...p.sequence, ...Array(add).fill(null)],
        };
      }
      return {
        ...p,
        cycleLength: globalCycleLength,
        sequence: p.sequence.slice(0, globalCycleLength),
      };
    });
    const changed = fixed.some((p, i) => p !== localPatterns[i]);
    if (changed) {
      setLocalPatterns(fixed);
      onChange(fixed);
    }
  }, [globalCycleLength]);

  // Пересчет scaleX по ширине контейнера
  useEffect(() => {
    const el = rightColRef.current;
    if (!el) return;
    const compute = () => {
      const containerWidth = el.clientWidth;
      const count = localPatterns[0]?.sequence.length || globalCycleLength || 1;
      const baseSize = 48; // px (w-12)
      const gap = 8; // px (gap-2)
      const needed = count * baseSize + (count - 1) * gap;
      const s = needed > containerWidth ? Math.max(0.1, (containerWidth - 2) / needed) : 1;
      setScaleX(s);
    };
    compute();
    const ro = new (window as any).ResizeObserver(compute);
    ro.observe(el);
    window.addEventListener('resize', compute);
    return () => { ro.disconnect(); window.removeEventListener('resize', compute); };
  }, [localPatterns, globalCycleLength]);

  // Преобразование типов для валидации
  const shiftTypesForValidation = useMemo((): ShiftType[] => {
    return shiftTypes.map((st) => ({
      id: st.id || '',
      shiftProfileId: '',
      name: st.name,
      startTime: st.startTime,
      endTime: st.endTime,
      breaks: st.breaks,
      nightHoursCount: st.nightHoursCount,
      workingHours: st.workingHours,
      color: st.color,
    }));
  }, [shiftTypes]);

  // Преобразование паттернов для валидации
  const patternsForValidation = useMemo((): ShiftPattern[] => {
    return localPatterns.map((p) => ({
      id: p.id || '',
      shiftProfileId: '',
      patternNumber: p.patternNumber,
      cycleLength: p.cycleLength,
      sequence: p.sequence,
    }));
  }, [localPatterns]);

  // Валидация при изменении данных
  useEffect(() => {
    const result = validateShiftProfile(patternsForValidation, shiftTypesForValidation);
    setValidationResult(result);
  }, [patternsForValidation, shiftTypesForValidation]);

  // Создание слотов для каждого паттерна
  const createSlotsForPattern = (
    pattern: EditShiftPatternData,
    patternIndex: number
  ): SlotItem[] => {
    return pattern.sequence.map((shiftTypeId, dayIndex) => ({
      id: `pattern-${patternIndex}-day-${dayIndex}`,
      data: {
        shiftTypeId,
        dayIndex,
        patternIndex,
      },
    }));
  };

  // Обработка изменения паттерна через drag-and-drop
  const handlePatternChange = (
    patternIndex: number,
    newSlots: SlotItem[]
  ) => {
    const newPatterns = [...localPatterns];
    newPatterns[patternIndex] = {
      ...newPatterns[patternIndex],
      sequence: newSlots.map((slot) => slot.data.shiftTypeId),
    };
    setLocalPatterns(newPatterns);
    onChange(newPatterns);
  };

  // Добавление дня в паттерн
  const handleAddDay = (patternIndex: number) => {
    const newPatterns = [...localPatterns];
    newPatterns[patternIndex] = {
      ...newPatterns[patternIndex],
      cycleLength: newPatterns[patternIndex].cycleLength + 1,
      sequence: [...newPatterns[patternIndex].sequence, null],
    };
    setLocalPatterns(newPatterns);
    onChange(newPatterns);
  };

  // Удаление дня из паттерна
  const handleRemoveDay = (patternIndex: number, dayIndex: number) => {
    const newPatterns = [...localPatterns];
    if (newPatterns[patternIndex].cycleLength > 1) {
      newPatterns[patternIndex] = {
        ...newPatterns[patternIndex],
        cycleLength: newPatterns[patternIndex].cycleLength - 1,
        sequence: newPatterns[patternIndex].sequence.filter(
          (_, i) => i !== dayIndex
        ),
      };
      setLocalPatterns(newPatterns);
      onChange(newPatterns);
    }
  };

  // Изменение длины цикла для всех паттернов
  const handleCycleLengthChange = (patternIndex: number, newLength: number) => {
    if (newLength < 1) return;

    setGlobalCycleLength(newLength);

    const synced = localPatterns.map((p) => {
      if (p.cycleLength === newLength) return p;
      if (newLength > p.cycleLength) {
        const add = newLength - p.cycleLength;
        return {
          ...p,
        cycleLength: newLength,
          sequence: [...p.sequence, ...Array(add).fill(null)],
      };
      }
      return {
        ...p,
        cycleLength: newLength,
        sequence: p.sequence.slice(0, newLength),
      };
    });

    setLocalPatterns(synced);
    onChange(synced);
  };

  // Клонирование паттерна
  const handleClonePattern = (patternIndex: number) => {
    const sourcePattern = localPatterns[patternIndex];
    const newPatternNumber =
      localPatterns.length > 0
        ? Math.max(...localPatterns.map((p) => p.patternNumber)) + 1
        : 1;

    const clonedPattern: EditShiftPatternData = {
      patternNumber: newPatternNumber,
      cycleLength: sourcePattern.cycleLength,
      sequence: [...sourcePattern.sequence], // Копируем раскладку
    };

    const newPatterns = [...localPatterns, clonedPattern];
    setLocalPatterns(newPatterns);
    onChange(newPatterns);
  };

  // Установка смены в слот
  const handleSetShiftType = (
    patternIndex: number,
    dayIndex: number,
    shiftTypeId: string | null
  ) => {
    const newPatterns = [...localPatterns];
    const newSequence = [...newPatterns[patternIndex].sequence];
    newSequence[dayIndex] = shiftTypeId;
    newPatterns[patternIndex] = {
      ...newPatterns[patternIndex],
      sequence: newSequence,
    };
    setLocalPatterns(newPatterns);
    onChange(newPatterns);
  };

  const cycleLength = calculateCycleLength(patternsForValidation);
  const minEmployees = calculateMinEmployees(patternsForValidation);
  const employeesPerDay = getEmployeesPerDay(patternsForValidation);
  const uncoveredByDay = getUncoveredHoursByDayIgnoringBreaks(
    patternsForValidation,
    shiftTypesForValidation
  );

  // Нет эффекта: размеры дней совпадают со слотами (SlotView)

  // Форматирование непокрытых часов как диапазоны (например 17:00–23:00)
  const formatHourRanges = (hours: number[]): string => {
    if (!hours || hours.length === 0) return '';
    const sorted = [...hours].sort((a, b) => a - b);
    const ranges: Array<{ start: number; end: number }> = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const h = sorted[i];
      if (h === prev + 1) {
        prev = h;
      } else {
        ranges.push({ start, end: prev + 1 }); // end exclusive
        start = h;
        prev = h;
      }
    }
    ranges.push({ start, end: prev + 1 });
    const fmt = (h: number) => `${String(h).padStart(2, '0')}:00`;
    return ranges
      .map(r => `${fmt(r.start)}–${fmt(r.end % 24)}`)
      .join(', ');
  };

  return (
    <div className="space-y-4">
      {/* Комбинированная панель: слева подпись, справа квадраты-дни */}
      <Card className="p-3 bg-gray-50">
        <div className="grid grid-cols-6 gap-3 items-center">
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-sm text-gray-600 whitespace-nowrap">Мин. сотрудников:</span>
            <Badge variant="info">{minEmployees}</Badge>
          </div>
          <div className="col-span-4" ref={rightColRef}>
            <div className="flex items-center flex-nowrap gap-2 md:gap-2 sm:gap-1" style={{ transform: `scaleX(${scaleX})`, transformOrigin: 'left center', width: 'max-content' }}>
              {employeesPerDay.map((count, dayIndex) => {
                const uncovered = uncoveredByDay[dayIndex] || [];
                const hasError = uncovered.length > 0;
                const tooltipText = hasError ? `Непокрытые часы: ${formatHourRanges(uncovered)}` : '';
                return (
                  <div key={dayIndex} className="flex items-center">
                    <SlotView
                      label={count}
                      isEmpty={false}
                      title={tooltipText}
                      className={hasError ? 'bg-red-50 text-red-700 border-red-300' : 'bg-blue-50 text-blue-700 border-blue-200'}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Паттерны */}
      <div className="space-y-4">
        {localPatterns.map((pattern, patternIndex) => {
          const slots = createSlotsForPattern(pattern, patternIndex);

          return (
            <Card key={patternIndex} className="p-3">
              <div className="grid grid-cols-6 gap-3 items-center">
                {/* Левый столбец: заголовок и контролы */}
                <div className="col-span-2 flex items-center gap-3">
                  <Tooltip content="Изменить длину цикла">
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Открыть ползунок длины цикла"
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        setCycleSlider({ patternIndex, x: rect.left, y: rect.bottom });
                      }}
                    >
                      ≡
                    </Button>
                  </Tooltip>
                      <h4 className="font-semibold">Паттерн {pattern.patternNumber}</h4>
                  <Badge variant="info">{pattern.cycleLength}</Badge>
                  <Tooltip content="Клонировать паттерн">
                    <Button
                      aria-label="Клонировать паттерн"
                      variant="outline"
                      size="sm"
                      onClick={() => handleClonePattern(patternIndex)}
                    >
                      ⧉
                    </Button>
                  </Tooltip>
                  {onDeletePattern && (
                    <Tooltip content="Удалить паттерн">
                      <Button
                        aria-label="Удалить паттерн"
                        variant="danger"
                        size="sm"
                        onClick={() => onDeletePattern(pattern.patternNumber)}
                      >
                        ✕
                      </Button>
                    </Tooltip>
                  )}
                    </div>
                {/* Правый столбец: слоты */}
                <div className="col-span-4">
                  <PatternConstructor
                    slots={slots}
                    shiftTypes={shiftTypes.map((st) => ({
                      // Use stable temporary id when not persisted yet
                      id: st.id || st.name,
                      name: st.name,
                      color: st.color,
                    }))}
                    config={{
                      direction: 'horizontal',
                      allowEmptySlots: true,
                      onSlotClick: (slot, e) => {
                        setSlotMenu({ patternIndex, dayIndex: slot.data.dayIndex, x: e.clientX, y: e.clientY });
                      },
                    }}
                    onChange={(newSlots) => handlePatternChange(patternIndex, newSlots)}
                    scaleX={scaleX}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Кнопка добавления паттерна */}
      {onAddPattern && (
        <Button variant="outline" onClick={onAddPattern}>
          + Добавить паттерн
        </Button>
      )}

      {/* Выпадающее меню выбора типа смены */}
      {slotMenu && (
        <div
          className="fixed z-50 bg-white border rounded shadow-lg p-2 max-h-60 overflow-auto"
          style={{ left: slotMenu.x + 8, top: slotMenu.y + 8 }}
          onMouseLeave={() => setSlotMenu(null)}
        >
          <button
            className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded"
            onClick={() => {
              handleSetShiftType(slotMenu.patternIndex, slotMenu.dayIndex, null);
              setSlotMenu(null);
            }}
          >
            <span className="inline-flex w-4 h-4 rounded bg-gray-300" />
            <span className="text-xs">Выходной</span>
          </button>
          {shiftTypes.map((st) => (
            <button
              key={st.id || st.name}
              className="flex items-center gap-2 w-full text-left px-2 py-1 hover:bg-gray-50 rounded"
              onClick={() => {
                handleSetShiftType(slotMenu.patternIndex, slotMenu.dayIndex, st.id || st.name);
                setSlotMenu(null);
              }}
            >
              <span className="inline-flex w-4 h-4 rounded" style={{ backgroundColor: st.color || '#CBD5E1' }} />
              <span className="text-xs font-medium">{st.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Поповер ползунка длины цикла */}
      {cycleSlider && (
        <div
          className="fixed z-50 bg-white border rounded shadow-lg p-3"
          style={{ left: cycleSlider.x, top: cycleSlider.y + 6 }}
          onMouseLeave={() => setCycleSlider(null)}
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={60}
              value={localPatterns[cycleSlider.patternIndex].cycleLength}
              onChange={(e) =>
                handleCycleLengthChange(
                  cycleSlider.patternIndex,
                  Number((e.target as HTMLInputElement).value)
                )
              }
            />
            <Badge variant="info">{localPatterns[cycleSlider.patternIndex].cycleLength}</Badge>
          </div>
        </div>
      )}
    </div>
  );
};

