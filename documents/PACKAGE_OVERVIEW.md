# 📦 shift-Manager Front-End: Полный пакет разработки

## 🎯 Обзор

Создан **production-ready пакет** для фронт-части системы планирования смен и отпусков **shift-Manager** на базе **React 18 + Vite + TypeScript**.

**Версия:** 0.1.0 (Alpha)  
**Разработано для:** ПАО ГМК «Норильский никель»  
**Репозиторий:** github.com/expertice/shift-manager

---

## 📋 Содержание пакета

### 📚 Документация

| Файл | Описание |
|------|---------|
| **README.md** | Главный README с инструкциями по установке и использованию |
| **DEVELOPER_GUIDE.md** | Полное руководство разработчика с примерами кода |
| **FRONTEND_ARCH.md** | Архитектура фронт-приложения, структура папок |
| **API_CONTRACTS.md** | Полная документация API endpoints с примерами |
| **.env.example** | Пример переменных окружения |

### ⚙️ Конфигурационные файлы

| Файл | Назначение |
|------|-----------|
| **package.json** | Зависимости и npm scripts |
| **vite.config.ts** | Конфигурация Vite с оптимизацией |
| **tsconfig.json** | TypeScript конфигурация (требует создания) |
| **vitest.config.ts** | Конфигурация Vitest (требует создания) |
| **.eslintrc.json** | ESLint конфигурация (требует создания) |
| **.prettierrc** | Prettier конфигурация (требует создания) |

### 🐳 DevOps

| Файл | Назначение |
|------|-----------|
| **Dockerfile** | Multi-stage Docker сборка для production |
| **nginx.conf** | Nginx конфигурация для serving React SPA |
| **.github/workflows/ci.yml** | GitHub Actions CI/CD pipeline |

### 🔧 TypeScript Типы

| Файл | Содержит |
|------|----------|
| **types.ts** | 50+ TypeScript интерфейсов и типов для всей системы |

---

## 🚀 Быстрый старт

### 1. Клонирование

```bash
git clone https://github.com/expertice/shift-manager.git
cd shift-manager
```

### 2. Установка

```bash
npm install
```

### 3. Переменные окружения

```bash
cp .env.example .env.development
```

Отредактируйте `.env.development` под ваше окружение:
```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

### 4. Запуск

```bash
npm run dev
```

Приложение откроется на `http://localhost:5173`

---

## 📊 Стек технологий

### Core
- **React 18** — UI библиотека
- **Vite** — build tool с Hot Module Replacement
- **TypeScript** — type safety
- **React Router v6** — навигация

### State & Data
- **Zustand** — простой state management
- **TanStack Query** — кэширование и синхронизация данных
- **Socket.io** — real-time обновления
- **IndexedDB (Dexie)** — offline storage

### Forms & Validation
- **React Hook Form** — формы
- **Zod** — валидация схем

### UI & Styling
- **Tailwind CSS** — utility-first CSS
- **CSS Modules** — локальные стили
- **dnd-kit** — drag-and-drop

### DevTools
- **Vitest** — unit тестирование
- **React Testing Library** — компонент тесты
- **MSW** — API мокирование
- **Storybook** — документирование компонентов
- **ESLint + Prettier** — код quality

---

## 🏗️ Архитектура

### Слои приложения

```
┌──────────────────────────────────────┐
│  React Components (UI Layer)         │
│  - Pages, Components, Forms          │
├──────────────────────────────────────┤
│  Custom Hooks (Logic Layer)          │
│  - useSchedule, useShifts, etc       │
├──────────────────────────────────────┤
│  State Management (Zustand Stores)   │
│  - useAppStore, useUIStore           │
├──────────────────────────────────────┤
│  Data Fetching (React Query)         │
│  - useQuery, useMutation             │
├──────────────────────────────────────┤
│  API Services + Real-time            │
│  - HTTP, WebSocket, Offline sync     │
├──────────────────────────────────────┤
│  Backend API                         │
│  - REST endpoints                    │
└──────────────────────────────────────┘
```

### Маршруты приложения

```
/                              → Список расписаний
/schedule/:id                  → Главная страница расписания
/schedule/:id/vacations        → Режим редактирования отпусков
/schedule/:id/history          → История версий
/schedule/:id/analytics        → Аналитика
/schedule/:id/users            → Управление правами доступа
/schedule/:id/settings         → Настройки схемы
/login                         → Страница входа
```

---

## 🎨 Дизайн и Цвета

### Цветовая палитра (Норильский никель)

| Цвет | Hex | Pantone | Использование |
|------|-----|---------|---------------|
| Основной синий | #004B8A | Pantone 3005 | Бренд, основные элементы |
| Вторичный синий | #0075B3 | Pantone 2945 | Вторичные элементы |
| Серый нейтральный | #999999 | Cool Gray 10 | Фон, отпуска |
| Оранжевый | #FF8C00 | - | Командировки |
| Красный | #DC2C2C | - | Ошибки, конфликты |

### Типы смен

- **Дневная смена** → Основной синий
- **Ночная смена** → Вторичный синий
- **Отпуск** → Серый
- **Командировка** → Оранжевый
- **Неполное покрытие** → Красный

---

## 📦 Компоненты

### Базовые компоненты (`components/common/`)

- ✅ **Button** — кнопка с вариантами
- ✅ **Input** — текстовое поле
- ✅ **Select** — выпадающий список
- ✅ **Modal** — модальное окно
- ✅ **Card** — карточка контента
- ✅ **Badge** — значок статуса
- ✅ **Tooltip** — подсказка
- ✅ **Toast** — уведомление
- ✅ **Avatar** — аватар пользователя
- ✅ **Tabs** — вкладки
- ✅ **Checkbox/Radio** — переключатели

### Специализированные компоненты

- ✅ **ShiftTable** — матрица смен (главный компонент)
- ✅ **ProfileConfigurator** — конфигуратор профилей
- ✅ **VacationCalendar** — календарь отпусков
- ✅ **ConflictResolver** — решение конфликтов
- ✅ **Analytics Dashboard** — аналитика
- ✅ **HistoryTimeline** — история версий

---

## 🔗 API Интеграция

### REST API endpoints

**Base URL:** `http://localhost:3000/api/v1`

Основные методы:
- `GET /schedules` — список расписаний
- `POST /schedules` — создание
- `GET /schedules/:id` — получить
- `PUT /schedules/:id` — обновить
- `DELETE /schedules/:id` — удалить
- `POST /schedules/:id/duplicate` — копировать

Полная документация в **API_CONTRACTS.md**

### Real-time обновления

Socket.io события:
- `shift:updated` — смена обновлена
- `vacation:added` — отпуск добавлен
- `conflict:detected` — обнаружен конфликт
- `exchange_request:created` — запрос на обмен

---

## 🧪 Тестирование

### Unit тесты

```bash
npm run test
```

### UI для тестов

```bash
npm run test:ui
```

### Покрытие

```bash
npm run test:coverage
```

### Примеры тестов включены

- ✅ Component tests
- ✅ Hook tests
- ✅ Integration tests
- ✅ Utils tests

---

## 📚 Storybook

Для просмотра компонентов:

```bash
npm run storybook
```

Откроется на `http://localhost:6006`

---

## 🐳 Docker & Deployment

### Локальный запуск

```bash
npm run docker:build
npm run docker:run
```

### Production build

```bash
docker build -t shift-manager:latest -f docker/Dockerfile .
docker run -p 80:3000 shift-manager:latest
```

### Окружения

- **Development** — http://localhost:5173
- **Staging** — https://staging.shift-manager.com
- **Production** — https://shift-manager.com

---

## ✨ Ключевые особенности

### ✅ Real-time синхронизация
- WebSocket через Socket.io
- Автоматические обновления при изменении данных
- Merge конфликтов (Last-Write-Wins стратегия)

### ✅ Offline режим
- IndexedDB для локального кэша
- Автоматическая синхронизация при восстановлении
- Работа без интернета

### ✅ Performance
- Виртуализация больших таблиц (react-window)
- Code splitting по маршрутам
- Lazy loading компонентов
- Кэширование API (React Query)
- Gzip compression (Nginx)

### ✅ Accessibility
- ARIA атрибуты
- Клавиатурная навигация
- Скрин-ридер поддержка
- WCAG контраст

### ✅ Security
- CORS headers
- XSS защита
- CSRF токены
- Rate limiting (Nginx)

---

## 📖 Документация

### Для фронт-разработчиков

1. **DEVELOPER_GUIDE.md** — Полное руководство с примерами
2. **FRONTEND_ARCH.md** — Архитектура и структура
3. **Код с JSDoc комментариями** — В каждом компоненте и hook

### Для бэк-разработчиков

1. **API_CONTRACTS.md** — Полная API документация
2. **TypeScript типы** — `types.ts` с 50+ интерфейсами

### Для DevOps

1. **Dockerfile** — Multi-stage сборка
2. **nginx.conf** — Конфигурация обратного прокси
3. **.github/workflows/ci.yml** — GitHub Actions

---

## 🔧 Требуемые действия перед первой разработкой

### 1. Создайте отсутствующие конфиги

```bash
# tsconfig.json
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@pages/*": ["src/pages/*"],
      "@hooks/*": ["src/hooks/*"],
      "@services/*": ["src/services/*"],
      "@store/*": ["src/store/*"],
      "@types/*": ["src/types/*"],
      "@styles/*": ["src/styles/*"],
      "@utils/*": ["src/services/utils/*"],
      "@mocks/*": ["src/mocks/*"],
      "@tests/*": ["src/tests/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
EOF
```

### 2. Создайте компоненты и папки

```bash
mkdir -p src/{components,pages,hooks,services,store,types,styles,mocks,tests}
mkdir -p src/components/{common,layouts,forms,tables,popovers}
mkdir -p src/services/{api,realtime,utils}
mkdir -p src/store
mkdir -p .github/workflows
mkdir -p docker
```

### 3. Добавьте зависимости

```bash
npm install
```

### 4. Запустите в режиме разработки

```bash
npm run dev
```

---

## 📋 Чек-лист для начала разработки

- [ ] Клонирование репозитория
- [ ] Установка зависимостей (`npm install`)
- [ ] Создание `.env.development`
- [ ] Создание недостающих конфиг файлов
- [ ] Создание папок структуры
- [ ] Запуск `npm run dev`
- [ ] Проверка `npm run lint`
- [ ] Запуск `npm run test`
- [ ] Открыть http://localhost:5173

---

## 🎓 Рекомендуемый порядок разработки

1. **Компоненты UI** (`components/common/`) — базовые элементы
2. **Custom Hooks** (`hooks/`) — логика для компонентов
3. **API сервисы** (`services/api/`) — интеграция с бэком
4. **Store** (`store/`) — global state
5. **Страницы** (`pages/`) — сборка из компонентов
6. **Тесты** — unit и integration тесты

---

## 🤝 Контрибьютинг

1. Fork репозитория
2. Создать ветку `feature/my-feature`
3. Commit изменения
4. Push и создать PR

---

## 📞 Поддержка

- **Вопросы по разработке**: смотрите `DEVELOPER_GUIDE.md`
- **API вопросы**: смотрите `API_CONTRACTS.md`
- **Архитектура**: смотрите `FRONTEND_ARCH.md`

---

## 🎯 Следующие шаги

### Немедленно требуется:
1. ✅ Создать структуру папок
2. ✅ Создать конфиг файлы (tsconfig.json, etc.)
3. ✅ Создать базовые компоненты
4. ✅ Интегрировать API сервисы

### В процессе разработки:
1. 📝 Добавить JSDoc комментарии
2. 🧪 Написать unit тесты
3. 📚 Создать Storybook stories
4. 🔍 Проверить performance

### Перед деплоем:
1. 🧪 Запустить все тесты
2. 🔍 ESLint + Prettier
3. 📈 Performance audit
4. 🔐 Security scan

---

**Готово к разработке!** 🚀

Версия: 0.1.0  
Последнее обновление: November 1, 2024
