/**
 * Утилиты для работы с файлами
 */
import * as XLSX from 'xlsx';

/**
 * Скачать файл из blob
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Валидация формата файла
 */
export function validateFileFormat(file: File, allowedExtensions: string[]): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension ? allowedExtensions.includes(extension) : false;
}

/**
 * Парсинг CSV файла на клиенте (для предпросмотра)
 */
export async function parseCSVPreview(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Простой парсинг CSV (без учета кавычек и экранирования)
        const rows = lines.map(line => {
          return line.split(',').map(cell => cell.trim());
        });
        
        resolve(rows);
      } catch (error) {
        reject(new Error('Ошибка при парсинге CSV файла'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Ошибка при чтении файла'));
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Получить MIME тип для формата
 */
export function getMimeType(format: 'csv' | 'xlsx'): string {
  return format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}

/**
 * Получить расширение файла для формата
 */
export function getFileExtension(format: 'csv' | 'xlsx'): string {
  return format;
}

/**
 * Парсинг Excel файла на клиенте
 */
export async function parseExcelPreview(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error('Не удалось прочитать файл'));
          return;
        }
        
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Конвертируем в массив массивов строк
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        
        // Конвертируем все значения в строки
        const stringRows = rows.map(row => 
          row.map(cell => {
            if (cell === null || cell === undefined || cell === '') return '';
            // Для дат Excel (serial numbers) конвертируем в строку
            if (typeof cell === 'number') {
              // Excel serial date начинается с 1900-01-01 (25569 дней от 1970-01-01)
              // Проверяем, что это похоже на дату (обычно между 1 и 100000)
              if (cell > 1 && cell < 100000) {
                try {
                  // Excel использует 1900-01-01 как день 1, но это ошибка - должно быть 1900-01-00
                  // Корректируем на 1 день назад
                  const excelEpoch = new Date(1899, 11, 30); // 30 декабря 1899
                  const date = new Date(excelEpoch.getTime() + (cell - 1) * 86400 * 1000);
                  // Проверяем, что получилась валидная дата
                  if (!isNaN(date.getTime())) {
                    return date.toISOString().split('T')[0];
                  }
                } catch (e) {
                  // Если не удалось преобразовать, оставляем как число
                }
              }
            }
            return String(cell);
          })
        );
        
        resolve(stringRows);
      } catch (error) {
        reject(new Error('Ошибка при парсинге Excel файла'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Ошибка при чтении файла'));
    };
    
    reader.readAsBinaryString(file);
  });
}

