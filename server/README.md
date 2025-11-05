# shift-Manager Backend API

Backend API для системы планирования смен и отпусков shift-Manager.

## Технологии

- **Node.js** + **TypeScript**
- **Express** - веб-фреймворк
- **Prisma** - ORM для работы с PostgreSQL
- **Socket.io** - real-time обновления
- **JWT** - аутентификация
- **Zod** - валидация данных

## Установка

```bash
# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Отредактировать .env файл

# Настроить базу данных
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Запуск

```bash
# Режим разработки
npm run dev

# Production
npm run build
npm start
```

## Структура проекта

```
server/
├── src/
│   ├── controllers/    # Контроллеры для обработки запросов
│   ├── services/       # Бизнес-логика
│   ├── middleware/     # Express middleware
│   ├── routes/         # Маршруты API
│   ├── types/          # TypeScript типы
│   ├── utils/          # Утилиты
│   └── index.ts        # Точка входа
├── prisma/
│   ├── schema.prisma   # Схема базы данных
│   └── seed.ts         # Seed данные
├── package.json
├── tsconfig.json
└── .env.example
```

## API Endpoints

Базовый URL: `http://localhost:3000/api/v1`

Подробная документация в файле `API_CONTRACTS.md` в корне проекта.

## Скрипты

- `npm run dev` - запуск в режиме разработки с hot reload
- `npm run build` - сборка проекта
- `npm start` - запуск production версии
- `npm run lint` - проверка кода ESLint
- `npm run lint:fix` - автоматическое исправление ошибок
- `npm run format` - форматирование кода Prettier
- `npm run type-check` - проверка типов TypeScript
- `npm run db:migrate` - применение миграций
- `npm run db:generate` - генерация Prisma клиента
- `npm run db:studio` - открыть Prisma Studio
- `npm run db:seed` - заполнить БД тестовыми данными


