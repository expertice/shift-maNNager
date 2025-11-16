/**
 * Скрипт для предзагрузки календарей с xmlcalendar.ru
 */

import { preloadCalendars } from '../services/xmlCalendarService.js';

async function main() {
  console.log('Starting calendar preload...');
  await preloadCalendars([2025, 2026], 'ru');
  console.log('Calendar preload completed!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Error preloading calendars:', error);
  process.exit(1);
});

