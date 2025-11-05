# shift-Manager — Система планирования смен и отпусков

**shift-Manager** — интерактивная многопользовательская система для планирования смен и управления отпусками для Норильского никеля, разработанная на **React 18 + Vite + TypeScript**.

## 🎯 Основные возможности

✅ **Управление расписанием смен** — создание, редактирование, удаление смен с drag-and-drop  
✅ **Профили смен** — готовые шаблоны (2/2, 3/3, 5/2 и т.д.)  
✅ **Управление отпусками** — отмечание и редактирование отпусков с контролем минимальной длительности  
✅ **Конфликты** — автоматическое обнаружение конфликтов между сменами и отпусками  
✅ **Аналитика** — статистика часов, нагрузки, сравнение вариантов расписания  
✅ **История версий** — полное отслеживание изменений с возможностью отката  
✅ **Управление правами** — роли owner, editor, viewer  
✅ **Real-time синхронизация** — обновление данных в реальном времени через WebSocket  
✅ **Offline mode** — работа без интернета с синхронизацией при восстановлении соединения  
✅ **Адаптивный дизайн** — полная поддержка мобильных устройств  

## 🛠️ Стек технологий

### Frontend
- **React 18** — UI библиотека
- **Vite** — modern build tool с hot module replacement
- **TypeScript** — type-safe разработка
- **React Router v6** — навигация
- **Zustand** — простое state management
- **TanStack Query (React Query)** — кэширование и синхронизация API запросов
- **React Hook Form + Zod** — валидация форм
- **dnd-kit** — drag-and-drop для смен
- **Socket.io** — real-time обновления
- **Tailwind CSS + CSS Modules** — стилизация

### DevTools
- **Vitest** — unit тестирование
- **React Testing Library** — компонент тестирование
- **MSW (Mock Service Worker)** — моки API для разработки
- **Storybook** — документирование компонентов
- **ESLint + Prettier** — лиинтинг и форматирование

### DevOps
- **Docker** — контейнеризация
- **Nginx** — reverse proxy и serving статики
- **GitHub Actions** — CI/CD pipeline

## 📋 Требования

- **Node.js** ≥ 18.0.0
- **npm** ≥ 9.0.0
- **Docker** (опционально, для контейнеризации)
- **PostgreSQL** (для бэка)

## 🚀 Быстрый старт

### 1. Клонирование репозитория

```bash
git clone https://github.com/expertice/shift-manager.git
cd shift-manager
```

### 2. Установка зависимостей

```bash
npm install
```

### 3. Переменные окружения

Создайте файл `.env.development`:

```env
VITE_API_URL=http://localhost:3000
VITE_APP_NAME=shift-Manager
VITE_APP_VERSION=0.1.0
```

### 4. Запуск в режиме разработки

```bash
npm run dev
```

Приложение откроется на `http://localhost:5173`

### 5. Сборка для продакшена

```bash
npm run build
npm run preview
```

## 📁 Структура проекта

```
shift-manager/
├── src/
│   ├── components/          # Переиспользуемые компоненты
│   │   ├── common/          # Button, Modal, Input и т.д.
│   │   ├── layouts/         # Header, Sidebar, MainLayout
│   │   ├── forms/           # Компоненты форм
│   │   ├── tables/          # Таблицы и матрицы
│   │   └── popovers/        # Всплывающие окна
│   ├── pages/               # Страницы приложения
│   ├── hooks/               # Custom React hooks
│   ├── services/            # API сервисы и утилиты
│   ├── store/               # Zustand хранилища
│   ├── types/               # TypeScript типы
│   ├── styles/              # Глобальные стили
│   ├── mocks/               # MSW моки для разработки
│   └── tests/               # Примеры тестов
├── stories/                 # Storybook stories
├── public/                  # Статические файлы
├── docker/                  # Docker конфигурация
├── .github/workflows/       # GitHub Actions CI/CD
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── README.md
```

## 🎨 Цветовая палитра (Норникель)

Основной цвет: **Pantone 3005** (фирменный синий)  
Вторичный цвет: **Pantone 2945** (светлый синий)  
Нейтральные: **Cool Gray 10** (серый)

### Типы смен (цвета)
- **Дневная смена**: Фирменный синий (Pantone 3005)
- **Ночная смена**: Светлый синий (Pantone 2945)
- **Отпуск**: Серый (Cool Gray 10)
- **Командировка**: Оранжевый
- **Неполное покрытие**: Красный

## 🧪 Тестирование

### Unit тесты

```bash
npm run test
```

### UI для тестов

```bash
npm run test:ui
```

### Покрытие тестами

```bash
npm run test:coverage
```

## 📚 Storybook

Документация компонентов доступна в Storybook:

```bash
npm run storybook
```

Откроется на `http://localhost:6006`

## 🐳 Docker

### Сборка образа

```bash
npm run docker:build
```

### Запуск контейнера

```bash
npm run docker:run
```

Приложение будет доступно на `http://localhost`

### docker-compose (с бэком)

```bash
docker-compose up -d
```

## 📖 API Документация

API контракты описаны в файле `API_CONTRACTS.md`

**Base URL:** `http://localhost:3000/api/v1`

Основные endpoints:
- `GET /schedules` — список расписаний
- `POST /schedules` — создание расписания
- `GET /schedules/:id` — получить расписание
- `GET /schedules/:id/shifts` — смены
- `GET /schedules/:id/vacations` — отпуска
- `GET /schedules/:id/analytics` — аналитика

## 🔐 Аутентификация

### Для разработки

Используется MSW (Mock Service Worker) для моков. Аутентификация происходит через localStorage.

### Для продакшена

Используется Bearer Token в заголовке `Authorization`.

## 🚀 Развёртывание

### На собственном сервере

1. Собрать проект: `npm run build`
2. Скопировать `dist/` на сервер
3. Настроить Nginx как reverse proxy

### На облаке (Vercel, Netlify)

```bash
# Vercel
npm install -g vercel
vercel

# Netlify
npm install -g netlify-cli
netlify deploy
```

### Docker на сервере

```bash
docker build -t shift-manager .
docker run -p 80:3000 shift-manager
```

## 📝 Разработка

### Основные команды

```bash
# Разработка
npm run dev

# Лиинтинг
npm run lint
npm run lint:fix

# Форматирование
npm run format

# Type checking
npm run type-check

# Тесты
npm run test
npm run test:coverage

# Build
npm run build
npm run preview

# Storybook
npm run storybook
npm run build-storybook

# Docker
npm run docker:build
npm run docker:run
```

### Соглашения кода

- **Именование файлов**: camelCase для компонентов (`Button.tsx`), kebab-case для папок (`common/`)
- **Компоненты**: функциональные компоненты с TypeScript
- **Стили**: Tailwind CSS для компонентов, CSS Modules для сложных стилей
- **Тесты**: 1 файл tests на каждый компонент
- **Комментарии**: JSDoc для функций и компонентов

### Git workflow

```bash
# Создать ветку feature
git checkout -b feature/my-feature

# Коммиты
git commit -m "feat: описание изменений"

# Push и PR
git push origin feature/my-feature
```

## 🐛 Отладка

### Browser DevTools

- React DevTools расширение
- Redux DevTools для Zustand (использовать middleware)

### VSCode Extensions

- ESLint
- Prettier
- TypeScript Vue Plugin
- Tailwind CSS IntelliSense

## 📊 Performance

### Оптимизация

- ✅ Виртуализация таблицы (react-window)
- ✅ Lazy loading страниц
- ✅ Code splitting по маршрутам
- ✅ Кэширование API (React Query)
- ✅ Мемоизация компонентов (React.memo)
- ✅ Gzip compression (Nginx)
- ✅ CDN для статики

## 🤝 Контрибьютинг

1. Fork репозиторий
2. Создать ветку `feature/your-feature`
3. Commit изменения `git commit -am 'Add new feature'`
4. Push в ветку `git push origin feature/your-feature`
5. Создать Pull Request

## 📄 Лицензия

Проект разработан для ПАО ГМК «Норильский никель»

## 👥 Команда

- **Разработка**: expertice

## 📞 Контакты

Для вопросов и предложений: support@shift-manager.com

---

**Версия:** 0.1.0 (Alpha)  
**Последнее обновление:** November 2024
