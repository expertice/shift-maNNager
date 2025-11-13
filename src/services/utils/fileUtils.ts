/**
 * Утилиты для работы с файлами
 */

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

