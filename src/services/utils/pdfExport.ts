/**
 * Модуль для экспорта результатов сравнения профилей смен в PDF
 */

import pdfMake from 'pdfmake/build/pdfmake';
import { ProfileComparisonResult } from '@types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

// Инициализируем шрифты для pdfmake
// Для pdfmake 0.2.x используется другая структура импорта
let fontsInitialized = false;

async function initializeFonts() {
  if (fontsInitialized) return;
  
  try {
    // Динамический импорт для правильной загрузки модуля
    const pdfFontsModule = await import('pdfmake/build/vfs_fonts');
    
    // Пробуем разные возможные структуры
    const fonts = pdfFontsModule.default || pdfFontsModule;
    
    if (fonts) {
      // Для pdfmake 0.2.x структура может быть fonts.pdfMake.vfs или fonts.vfs
      if ((fonts as any).pdfMake && (fonts as any).pdfMake.vfs) {
        (pdfMake as any).vfs = (fonts as any).pdfMake.vfs;
      } else if ((fonts as any).vfs) {
        (pdfMake as any).vfs = (fonts as any).vfs;
      } else if ((fonts as any).pdfMake) {
        (pdfMake as any).vfs = (fonts as any).pdfMake;
      } else {
        // Если структура совсем другая, пробуем использовать весь объект
        (pdfMake as any).vfs = fonts;
      }
    }
    
    // Проверяем, что vfs был установлен
    if (!(pdfMake as any).vfs) {
      throw new Error('Не удалось найти vfs в модуле шрифтов');
    }
    
    fontsInitialized = true;
  } catch (error) {
    console.error('Ошибка инициализации шрифтов pdfmake:', error);
    throw new Error('Не удалось загрузить шрифты для PDF. Пожалуйста, обновите страницу и попробуйте снова.');
  }
}

/**
 * Вспомогательная функция для определения контрастного цвета текста
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Генерирует изображение паттерна в формате base64
 * Canvas создается с фиксированным соотношением сторон для правильного масштабирования
 */
function generatePatternImage(
  pattern: ProfileComparisonResult['visualizedPatterns'][number],
  maxCycleLength: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const cellSize = 30; // Размер ячейки в пикселях
      const padding = 4; // Отступ в пикселях
      const headerHeight = 25; // Высота заголовка в пикселях
      const daysToRender = Math.max(maxCycleLength, pattern.cycleLength, pattern.sequence.length);
      const colsPerRow = 10; // Количество дней в одной строке
      const rows = Math.ceil(daysToRender / colsPerRow);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Не удалось создать контекст canvas'));
        return;
      }
      
      // Фиксированная ширина canvas (10 ячеек в ряд)
      const width = colsPerRow * (cellSize + padding) + padding;
      const height = rows * (cellSize + padding) + padding + headerHeight;
      
      canvas.width = width;
      canvas.height = height;
      
      // Белый фон
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      
      // Заголовок
      ctx.fillStyle = '#000000';
      ctx.font = '12px Arial';
      ctx.fillText(`Сотрудник ${pattern.patternNumber}`, padding, headerHeight - 8);
      
      // Рисуем паттерн
      for (let dayIndex = 0; dayIndex < daysToRender; dayIndex++) {
        const row = Math.floor(dayIndex / colsPerRow);
        const col = dayIndex % colsPerRow;
        
        const x = padding + col * (cellSize + padding);
        const y = headerHeight + padding + row * (cellSize + padding);
        
        const shiftType = pattern.sequence[dayIndex % pattern.sequence.length];
        
        if (shiftType === null) {
          // Выходной день
          ctx.fillStyle = '#F3F4F6';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#D1D5DB';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellSize, cellSize);
          
          ctx.fillStyle = '#6B7280';
          ctx.font = '14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('—', x + cellSize / 2, y + cellSize / 2);
        } else {
          // Рабочий день
          const backgroundColor = shiftType.color || '#E5E7EB';
          const textColor = getContrastColor(backgroundColor);
          
          ctx.fillStyle = backgroundColor;
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#D1D5DB';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, y, cellSize, cellSize);
          
          ctx.fillStyle = textColor;
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(shiftType.name.charAt(0).toUpperCase(), x + cellSize / 2, y + cellSize / 2);
        }
      }
      
      // Конвертируем в base64
      const dataUrl = canvas.toDataURL('image/png');
      resolve(dataUrl);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Экспортировать результаты сравнения профилей в PDF
 */
export async function exportComparisonToPDF(
  comparisons: ProfileComparisonResult[],
  maxEmployeeCount: number,
  employeeCount: number
): Promise<void> {
  // Инициализируем шрифты перед созданием PDF
  await initializeFonts();
  
  const docDefinition: any = {
    pageOrientation: 'portrait',
    pageSize: 'A4',
    content: [],
    defaultStyle: {
      font: 'Roboto',
      fontSize: 9,
    },
    styles: {
      header: {
        fontSize: 16,
        bold: true,
        margin: [0, 0, 0, 8],
      },
      profileHeader: {
        fontSize: 12,
        bold: true,
        margin: [0, 0, 0, 5],
      },
      tableHeader: {
        bold: true,
        fontSize: 8,
        color: 'white',
        fillColor: '#475569',
        alignment: 'center',
      },
      tableCell: {
        fontSize: 8,
      },
    },
    pageMargins: [10, 15, 10, 15],
  };

  // Заголовок документа
  docDefinition.content.push({
    text: 'Сравнение профилей смен',
    style: 'header',
    alignment: 'center',
  });

  // Период сравнения
  if (comparisons.length > 0) {
    const firstComparison = comparisons[0];
    const periodText = `Период: ${format(new Date(firstComparison.periodStart), 'dd.MM.yyyy', { locale: ru })} - ${format(new Date(firstComparison.periodEnd), 'dd.MM.yyyy', { locale: ru })}`;
    docDefinition.content.push({
      text: periodText,
      fontSize: 10,
      margin: [0, 0, 0, 5],
      alignment: 'center',
    });
    
    docDefinition.content.push({
      text: `Использовано сотрудников: ${employeeCount}`,
      fontSize: 9,
      margin: [0, 0, 0, 10],
      alignment: 'center',
    });
  }

  // Вычисляем максимальную длину цикла для всех паттернов
  const maxCycleLength = comparisons.reduce((max, comp) => {
    const compMax = comp.visualizedPatterns.reduce(
      (innerMax, pattern) => Math.max(innerMax, pattern.cycleLength),
      0
    );
    return Math.max(max, compMax);
  }, 0);

  // Генерируем изображения паттернов для всех профилей
  const patternImages: Map<string, Map<number, string>> = new Map();
  
  for (const comparison of comparisons) {
    const profilePatterns = new Map<number, string>();
    
    // Генерируем паттерны для всех сотрудников
    if (comparison.visualizedPatterns.length > 0) {
      for (let empNum = 1; empNum <= employeeCount; empNum++) {
        // Ищем точный паттерн или используем циклическое повторение
        const exactPattern = comparison.visualizedPatterns.find((p) => p.patternNumber === empNum);
        const pattern = exactPattern || 
          comparison.visualizedPatterns[(empNum - 1) % comparison.visualizedPatterns.length];
        
        if (pattern && pattern.sequence.length > 0) {
          try {
            const imageData = await generatePatternImage(pattern, maxCycleLength);
            profilePatterns.set(empNum, imageData);
          } catch (error) {
            console.error(`Ошибка генерации изображения паттерна для сотрудника ${empNum}:`, error);
          }
        }
      }
    }
    
    patternImages.set(comparison.profile.id, profilePatterns);
  }
  
  // Вычисляем ширину изображения как процент от ширины колонки
  // В книжной ориентации A4: ширина страницы 210mm, отступы 10mm с каждой стороны = 190mm доступной ширины
  const numColumns = comparisons.length;
  const availableWidth = 190; // Доступная ширина страницы в mm
  const columnGap = 10;
  const columnWidth = numColumns > 1 
    ? (availableWidth - (columnGap * (numColumns - 1))) / numColumns 
    : availableWidth;
  // Используем 90% от ширины колонки для изображений
  const imageWidthPercent = 0.9;
  const imageWidth = columnWidth * imageWidthPercent;
  
  // Создаем колонки для профилей
  const columns: any[] = [];
  
  comparisons.forEach((comparison) => {
    const columnContent: any[] = [];
    
    // Заголовок профиля
    columnContent.push({
      text: comparison.profile.name,
      style: 'profileHeader',
    });
    
    // Описание профиля
    if (comparison.profile.description) {
      columnContent.push({
        text: comparison.profile.description,
        fontSize: 8,
        margin: [0, 0, 0, 5],
        color: '#4B5563',
      });
    }
    
    // Информация о профиле
    columnContent.push({
      text: [
        { text: 'Цикл: ', bold: true },
        { text: `${comparison.profile.cycleLength} дней` },
        { text: '\nМин. сотрудников: ', bold: true },
        { text: `${comparison.profile.minEmployees}` },
      ],
      fontSize: 8,
      margin: [0, 0, 0, 8],
    });
    
    // Таблица метрик
    const metricsTable = [
      [
        { text: 'Сотр.', style: 'tableHeader' },
        { text: 'Смен', style: 'tableHeader' },
        { text: 'Часов', style: 'tableHeader' },
        { text: 'Ночн.', style: 'tableHeader' },
      ],
      ...comparison.employeeMetrics.map((metrics) => [
        { text: metrics.employeeNumber.toString(), style: 'tableCell' },
        { text: metrics.shiftsCount.toString(), style: 'tableCell', alignment: 'right' },
        { text: metrics.totalHours.toFixed(1), style: 'tableCell', alignment: 'right' },
        { text: metrics.nightHours.toString(), style: 'tableCell', alignment: 'right' },
      ]),
    ];
    
    columnContent.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto'],
        body: metricsTable,
      },
      margin: [0, 0, 0, 8],
      fontSize: 7,
    });
    
    // Таблица типов смен по сотрудникам
    if (comparison.shiftTypes && comparison.shiftTypes.length > 0) {
      const shiftTypesTable = [
        [
          { text: 'Сотрудник', style: 'tableHeader' },
          ...comparison.shiftTypes.map((st) => {
            const bgColor = st.color || '#F9FAFB';
            const textColor = getContrastColor(bgColor);
            return {
              stack: [
                { text: st.name, style: 'tableHeader', fontSize: 7 },
                { text: `${st.startTime}-${st.endTime}`, style: 'tableHeader', fontSize: 6, opacity: 0.9 },
              ],
              fillColor: bgColor,
              color: textColor,
              alignment: 'center',
            };
          }),
        ],
        ...comparison.employeeMetrics.map((metrics) => [
          { text: `Сотр. ${metrics.employeeNumber}`, style: 'tableCell' },
          ...comparison.shiftTypes.map((st) => {
            const count = metrics.shiftTypeCounts?.[st.id] ?? 0;
            return {
              text: count > 0 ? count.toString() : '—',
              style: 'tableCell',
              alignment: 'center',
            };
          }),
        ]),
      ];
      
      columnContent.push({
        text: 'Типы смен по сотрудникам:',
        fontSize: 9,
        bold: true,
        margin: [0, 5, 0, 3],
      });
      
      columnContent.push({
        table: {
          headerRows: 1,
          widths: ['auto', ...comparison.shiftTypes.map(() => '*')],
          body: shiftTypesTable,
        },
        margin: [0, 0, 0, 8],
        fontSize: 7,
      });
    }
    
    // Паттерны как изображения
    columnContent.push({
      text: 'Паттерны по сотрудникам:',
      fontSize: 9,
      bold: true,
      margin: [0, 5, 0, 5],
    });
    
    const profilePatterns = patternImages.get(comparison.profile.id);
    if (profilePatterns) {
      for (let empNum = 1; empNum <= employeeCount; empNum++) {
        const patternImage = profilePatterns.get(empNum);
        if (patternImage) {
          columnContent.push({
            image: patternImage,
            width: imageWidth,
            // Высота будет вычислена автоматически с сохранением пропорций
            margin: [0, 0, 0, 5],
          });
        }
      }
    }
    
    columns.push({
      width: '*',
      stack: columnContent,
    });
  });
  
  // Добавляем колонки в документ
  docDefinition.content.push({
    columns: columns,
    columnGap: 10,
  });

  // Генерируем и сохраняем PDF
  const fileName = `Сравнение_профилей_смен_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`;
  pdfMake.createPdf(docDefinition).download(fileName);
}
