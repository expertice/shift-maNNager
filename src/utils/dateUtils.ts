import { startOfDay } from 'date-fns';

/**
 * Безопасный парсинг даты из строки или Date объекта
 * Обрабатывает даты в формате ISO (YYYY-MM-DD) в локальном времени,
 * чтобы избежать смещения из-за часовых поясов
 */
export function parseLocalDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) {
    // Если это уже Date объект, нормализуем его к началу дня в локальном времени
    return startOfDay(dateInput);
  }
  
  // Если это строка
  const dateStr = String(dateInput).trim();
  
  // Если строка пустая, возвращаем текущую дату
  if (!dateStr) {
    return startOfDay(new Date());
  }
  
  // Убираем время, если оно есть (формат ISO: YYYY-MM-DDTHH:mm:ss.sssZ)
  const dateOnly = dateStr.split('T')[0].split(' ')[0];
  const parts = dateOnly.split('-');
  
  // Проверяем, что это формат YYYY-MM-DD
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // месяц начинается с 0
    const day = parseInt(parts[2], 10);
    
    // Проверяем валидность чисел
    if (!isNaN(year) && !isNaN(month) && !isNaN(day) && 
        year > 0 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      // Создаем дату в локальном времени напрямую из компонентов
      // Это гарантирует, что дата будет в локальном времени, а не UTC
      const localDate = new Date(year, month, day);
      return startOfDay(localDate);
    }
  }
  
  // Fallback: пытаемся распарсить как ISO строку, но затем нормализуем
  // Это нужно для случаев, когда дата приходит в нестандартном формате
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      // Если парсинг успешен, создаем дату из компонентов в локальном времени
      return startOfDay(new Date(
        parsed.getFullYear(),
        parsed.getMonth(),
        parsed.getDate()
      ));
    }
  } catch (e) {
    // Игнорируем ошибки парсинга
  }
  
  // Последний fallback - текущая дата
  return startOfDay(new Date());
}

