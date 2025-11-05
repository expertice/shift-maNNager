/**
 * Модуль для экспорта результатов сравнения профилей смен в PDF
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ProfileComparisonResult } from '@types';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Экспортировать результаты сравнения профилей в PDF
 */
export async function exportComparisonToPDF(
  comparisons: ProfileComparisonResult[]
): Promise<void> {
  // Создаем новый PDF документ
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Устанавливаем шрифт (по умолчанию jsPDF не поддерживает кириллицу хорошо,
  // но для базового функционала используем стандартный)
  doc.setFont('helvetica');

  let yOffset = 20;

  // Заголовок документа
  doc.setFontSize(18);
  doc.text('Сравнение профилей смен', 15, yOffset);
  yOffset += 10;

  // Период сравнения
  if (comparisons.length > 0) {
    const firstComparison = comparisons[0];
    doc.setFontSize(12);
    const periodText = `Период: ${format(new Date(firstComparison.periodStart), 'dd.MM.yyyy', { locale: ru })} - ${format(new Date(firstComparison.periodEnd), 'dd.MM.yyyy', { locale: ru })}`;
    doc.text(periodText, 15, yOffset);
    yOffset += 10;
  }

  // Максимальное количество сотрудников
  const maxEmployees = Math.max(...comparisons.map((c) => c.employeeCount));
  doc.setFontSize(11);
  doc.text(`Максимальное количество сотрудников: ${maxEmployees}`, 15, yOffset);
  yOffset += 15;

  // Для каждого профиля
  comparisons.forEach((comparison, index) => {
    // Проверяем, нужна ли новая страница
    if (yOffset > 180) {
      doc.addPage();
      yOffset = 20;
    }

    // Заголовок профиля
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${comparison.profile.name}`, 15, yOffset);
    yOffset += 7;

    // Информация о профиле
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (comparison.profile.description) {
      doc.text(`Описание: ${comparison.profile.description}`, 15, yOffset);
      yOffset += 5;
    }
    doc.text(`Цикл: ${comparison.profile.cycleLength} дней`, 15, yOffset);
    yOffset += 5;
    doc.text(
      `Минимум сотрудников: ${comparison.profile.minEmployees}`,
      15,
      yOffset
    );
    yOffset += 10;

    // Таблица метрик сотрудников
    const tableData = comparison.employeeMetrics.map((metrics) => [
      `Сотрудник ${metrics.employeeNumber}`,
      metrics.shiftsCount.toString(),
      metrics.totalHours.toFixed(1),
      metrics.nightHours.toString(),
    ]);

    autoTable(doc, {
      startY: yOffset,
      head: [['Сотрудник', 'Смен', 'Всего часов', 'Ночных часов']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      margin: { left: 15 },
    });

    // Обновляем yOffset после таблицы
    const finalY = (doc as any).lastAutoTable.finalY || yOffset;
    yOffset = finalY + 10;

    // Визуализация паттернов (упрощенная текстовая версия)
    if (comparison.visualizedPatterns.length > 0) {
      if (yOffset > 170) {
        doc.addPage();
        yOffset = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Паттерны смен:', 15, yOffset);
      yOffset += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      comparison.visualizedPatterns.forEach((pattern) => {
        if (yOffset > 180) {
          doc.addPage();
          yOffset = 20;
        }

        const patternText = `Паттерн ${pattern.patternNumber} (цикл: ${pattern.cycleLength} дней):`;
        doc.text(patternText, 15, yOffset);
        yOffset += 5;

        // Формируем упрощенное представление паттерна
        const days = pattern.sequence.slice(0, Math.min(pattern.cycleLength + 2, pattern.sequence.length));
        const patternRepresentation = days
          .map((shift, idx) => {
            if (shift === null) {
              return `День ${idx + 1}: Выходной`;
            } else {
              return `День ${idx + 1}: ${shift.name} (${shift.startTime}-${shift.endTime})`;
            }
          })
          .join('; ');

        // Разбиваем длинный текст на строки
        const lines = doc.splitTextToSize(patternRepresentation, 270);
        doc.text(lines, 20, yOffset);
        yOffset += lines.length * 4 + 5;
      });

      yOffset += 5;
    }

    // Разделитель между профилями
    if (index < comparisons.length - 1) {
      yOffset += 5;
      if (yOffset > 180) {
        doc.addPage();
        yOffset = 20;
      }
    }
  });

  // Сохраняем PDF
  const fileName = `Сравнение_профилей_смен_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`;
  doc.save(fileName);
}

