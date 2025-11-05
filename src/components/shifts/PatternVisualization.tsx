import React from 'react';
import { VisualizedPattern } from '@types';

export interface PatternVisualizationProps {
  patterns: VisualizedPattern[];
  displayDays: number; // Количество дней для отображения
}

/**
 * Компонент для визуализации паттернов смен
 */
export const PatternVisualization: React.FC<PatternVisualizationProps> = ({
  patterns,
  displayDays,
}) => {
  if (!patterns || patterns.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-4">
        Нет паттернов для отображения
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-700 text-sm">Визуализация паттернов:</h4>
      {patterns.map((pattern) => {
        // Берем только первые displayDays дней
        const daysToShow = Math.min(displayDays, pattern.sequence.length);
        const sequence = pattern.sequence.slice(0, daysToShow);

        return (
          <div key={pattern.patternNumber} className="border border-gray-200 rounded-lg p-4">
            <div className="mb-2">
              <span className="font-medium text-gray-700">
                Паттерн {pattern.patternNumber}
              </span>
              <span className="text-gray-500 text-sm ml-2">
                (цикл: {pattern.cycleLength} дней)
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sequence.map((shiftType, dayIndex) => {
                if (shiftType === null) {
                  // Выходной день
                  return (
                    <div
                      key={dayIndex}
                      className="flex flex-col items-center justify-center bg-gray-100 border border-gray-300 rounded px-3 py-2 min-w-[80px]"
                      title={`День ${dayIndex + 1}: Выходной`}
                    >
                      <div className="text-xs text-gray-500 mb-1">День {dayIndex + 1}</div>
                      <div className="font-medium text-gray-600">—</div>
                      <div className="text-xs text-gray-500 mt-1">Выходной</div>
                    </div>
                  );
                } else {
                  // Рабочая смена
                  const backgroundColor = shiftType.color || '#e5e7eb';
                  const textColor = getContrastColor(backgroundColor);

                  return (
                    <div
                      key={dayIndex}
                      className="flex flex-col items-center justify-center border border-gray-300 rounded px-3 py-2 min-w-[80px]"
                      style={{
                        backgroundColor,
                        color: textColor,
                      }}
                      title={`День ${dayIndex + 1}: ${shiftType.name} (${shiftType.startTime}-${shiftType.endTime})`}
                    >
                      <div className="text-xs opacity-75 mb-1">День {dayIndex + 1}</div>
                      <div className="font-semibold text-sm">{shiftType.name}</div>
                      <div className="text-xs opacity-90 mt-1">
                        {shiftType.startTime}-{shiftType.endTime}
                      </div>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Вспомогательная функция для определения контрастного цвета текста
 * на основе цвета фона
 */
function getContrastColor(hexColor: string): string {
  // Удаляем # если есть
  const hex = hexColor.replace('#', '');

  // Конвертируем в RGB
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Вычисляем яркость (luminance)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Если яркость больше 0.5, используем темный текст, иначе светлый
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

