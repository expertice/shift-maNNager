/**
 * Сервис для загрузки производственных календарей с xmlcalendar.ru
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Интерфейс месяца из календаря xmlcalendar.ru
 */
interface CalendarMonth {
  month: number; // 1-12
  days: string; // Строка с номерами дней, например "1,2,3,7*,8,9" где * - предпраздничный, + - рабочий выходной
}

/**
 * Интерфейс переноса выходного дня
 */
interface CalendarTransition {
  from: string; // Дата в формате "DD.MM"
  to: string; // Дата в формате "DD.MM"
}

/**
 * Интерфейс календаря xmlcalendar.ru
 */
interface XmlCalendarData {
  year: number;
  months: CalendarMonth[];
  transitions?: CalendarTransition[];
}

/**
 * Получить путь к файлу календаря
 */
function getCalendarPath(year: number, country: string = 'ru'): string {
  const calendarDir = path.join(__dirname, '../../calendar', country, year.toString());
  return path.join(calendarDir, 'calendar.json');
}

/**
 * Проверить существование файла календаря
 */
async function calendarFileExists(year: number, country: string = 'ru'): Promise<boolean> {
  try {
    const filePath = getCalendarPath(year, country);
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Загрузить календарь с xmlcalendar.ru
 */
async function downloadCalendar(year: number, country: string = 'ru'): Promise<XmlCalendarData> {
  const url = `https://xmlcalendar.ru/data/${country}/${year}/calendar.json`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download calendar: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as XmlCalendarData;
  } catch (error) {
    throw new Error(`Error downloading calendar from xmlcalendar.ru: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Сохранить календарь в файл
 */
async function saveCalendar(data: XmlCalendarData, country: string = 'ru'): Promise<void> {
  const filePath = getCalendarPath(data.year, country);
  const dir = path.dirname(filePath);
  
  // Создаем директорию, если её нет
  await fs.mkdir(dir, { recursive: true });
  
  // Сохраняем файл
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Загрузить календарь из файла
 */
async function loadCalendarFromFile(year: number, country: string = 'ru'): Promise<XmlCalendarData> {
  const filePath = getCalendarPath(year, country);
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as XmlCalendarData;
}

/**
 * Получить производственный календарь для года
 * Сначала проверяет наличие файла, если нет - загружает с xmlcalendar.ru и сохраняет
 */
export async function getXmlCalendar(year: number, country: string = 'ru'): Promise<XmlCalendarData> {
  // Проверяем наличие файла
  if (await calendarFileExists(year, country)) {
    try {
      return await loadCalendarFromFile(year, country);
    } catch (error) {
      console.warn(`Error loading calendar from file for year ${year}, downloading...`, error);
    }
  }
  
  // Если файла нет или ошибка при чтении - загружаем с сайта
  console.log(`Downloading calendar for year ${year} from xmlcalendar.ru...`);
  const calendar = await downloadCalendar(year, country);
  
  // Сохраняем для будущего использования
  await saveCalendar(calendar, country);
  
  return calendar;
}

/**
 * Предварительно загрузить календари за указанные годы
 */
export async function preloadCalendars(years: number[], country: string = 'ru'): Promise<void> {
  const results = await Promise.allSettled(
    years.map(year => getXmlCalendar(year, country))
  );
  
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      console.log(`✓ Calendar for year ${years[index]} loaded successfully`);
    } else {
      console.error(`✗ Failed to load calendar for year ${years[index]}:`, result.reason);
    }
  });
}

/**
 * Преобразовать календарь xmlcalendar.ru в формат ProductionCalendar
 */
export function convertXmlCalendarToProductionCalendar(data: XmlCalendarData): {
  year: number;
  workingDays: number;
  weekendDays: number;
  holidayDays: number;
  holidays: string[];
  workingWeekends: string[];
  preholidayDays: string[]; // Предпраздничные дни
} {
  const holidays: string[] = [];
  const workingWeekends: string[] = [];
  const preholidayDays: string[] = [];
  const workingDaysSet = new Set<string>();
  const allDaysSet = new Set<string>();
  
  // Список фиксированных праздников РФ
  const fixedHolidays = [
    `01-01`, // Новый год
    `01-02`,
    `01-03`,
    `01-04`,
    `01-05`,
    `01-06`,
    `01-07`,
    `01-08`,
    `02-23`, // День защитника Отечества
    `03-08`, // Международный женский день
    `05-01`, // Праздник Весны и Труда
    `05-09`, // День Победы
    `06-12`, // День России
    `11-04`, // День народного единства
  ];
  
  // Обрабатываем каждый месяц
  data.months.forEach(monthData => {
    const month = monthData.month;
    const daysStr = monthData.days;
    
    // Парсим строку дней (например "1,2,3,7*,8,9+")
    const dayNumbers = daysStr.split(',').map(d => d.trim());
    
    dayNumbers.forEach(dayStr => {
      const isPreholiday = dayStr.endsWith('*');
      const isWorkingWeekend = dayStr.endsWith('+');
      const dayNum = parseInt(dayStr.replace(/[*+]/g, ''), 10);
      
      if (dayNum >= 1 && dayNum <= 31) {
        const date = new Date(data.year, month - 1, dayNum);
        const dateStr = date.toISOString().split('T')[0];
        allDaysSet.add(dateStr);
        
        if (isWorkingWeekend) {
          workingWeekends.push(dateStr);
          workingDaysSet.add(dateStr);
        } else if (isPreholiday) {
          preholidayDays.push(dateStr);
          workingDaysSet.add(dateStr);
        } else {
          workingDaysSet.add(dateStr);
        }
      }
    });
  });
  
  // Определяем праздничные дни (они всегда нерабочие)
  fixedHolidays.forEach(holiday => {
    const [month, day] = holiday.split('-').map(Number);
    const date = new Date(data.year, month - 1, day);
    const dateStr = date.toISOString().split('T')[0];
    allDaysSet.add(dateStr);
    
    // Праздничные дни всегда нерабочие
    holidays.push(dateStr);
    workingDaysSet.delete(dateStr); // Убираем из рабочих, если был добавлен
  });
  
  // Обрабатываем переносы выходных дней
  if (data.transitions) {
    data.transitions.forEach(transition => {
      const [fromDay, fromMonth] = transition.from.split('.').map(Number);
      const [toDay, toMonth] = transition.to.split('.').map(Number);
      
      const fromDate = new Date(data.year, fromMonth - 1, fromDay);
      const toDate = new Date(data.year, toMonth - 1, toDay);
      
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      
      // День, с которого переносится выходной, становится выходным (убираем из рабочих)
      workingDaysSet.delete(fromDateStr);
      
      // День, на который переносится выходной, становится рабочим выходным
      workingDaysSet.add(toDateStr);
      workingWeekends.push(toDateStr);
    });
  }
  
  // Подсчитываем итоговые значения
  let workingDays = 0;
  let weekendDays = 0;
  let holidayDays = holidays.length;
  
  // Проходим по всем дням года
  for (let month = 0; month < 12; month++) {
    const daysInMonth = new Date(data.year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(data.year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
      
      if (holidays.includes(dateStr)) {
        // Праздничный день - уже учтен
        continue;
      } else if (workingWeekends.includes(dateStr)) {
        // Рабочий выходной
        workingDays++;
      } else if (workingDaysSet.has(dateStr)) {
        // Рабочий день
        workingDays++;
      } else if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Выходной день
        weekendDays++;
      } else {
        // По умолчанию будний день - рабочий
        workingDays++;
      }
    }
  }
  
  return {
    year: data.year,
    workingDays,
    weekendDays,
    holidayDays,
    holidays,
    workingWeekends,
    preholidayDays,
  };
}

