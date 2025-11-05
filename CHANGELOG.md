# Changelog

Все значимые изменения в проекте будут документироваться в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект следует [Semantic Versioning](https://semver.org/lang/ru/).

## [0.1.0] - 2025-11-02

### Добавлено

#### Backend
- ✅ Инициализация проекта с Express.js и TypeScript
- ✅ Настройка Prisma ORM с 20 моделями базы данных
- ✅ Docker Compose конфигурация для PostgreSQL
- ✅ JWT аутентификация для суперпользователей
- ✅ Система ролей (owner, editor, viewer)
- ✅ Одноразовые пароли для сотрудников
- ✅ API endpoints для Schedules (CRUD + duplicate)
- ✅ API endpoints для Employees (CRUD + generate-password)
- ✅ API endpoints для Shifts (CRUD + bulk + swap)
- ✅ API endpoints для Vacations (CRUD)
- ✅ API endpoints для Shift Profiles и генерация смен
- ✅ API endpoints для Conflicts и Analytics
- ✅ API endpoints для History и Permissions
- ✅ Socket.io интеграция для real-time обновлений
- ✅ Middleware для обработки ошибок и валидации
- ✅ Seed данные для тестирования

#### Frontend
- ✅ Инициализация проекта с React 18, TypeScript, Vite
- ✅ Настройка React Router v6 для маршрутизации
- ✅ Настройка Zustand для управления состоянием
- ✅ Настройка TanStack Query для работы с API
- ✅ Настройка Tailwind CSS для стилизации
- ✅ Базовые UI компоненты (Button, Input, Select, Modal, Card, Badge, Spinner, Tabs, Avatar, Toast, Tooltip)
- ✅ Layout компоненты (Header, Sidebar, Footer, MainLayout)
- ✅ Страница авторизации с интеграцией API
- ✅ Страница списка расписаний с CRUD операциями
- ✅ Основная страница расписания с календарной таблицей смен
- ✅ Страница управления сотрудниками
- ✅ Страница работы с профилями смен и генерация
- ✅ Страница режима отпусков с интерактивным календарем
- ✅ Страница истории изменений с пагинацией
- ✅ Страница управления правами доступа
- ✅ API сервисы для всех endpoints
- ✅ Real-time обновления через Socket.io
- ✅ Защита маршрутов с проверкой авторизации

#### Документация
- ✅ README.md с описанием проекта и инструкциями
- ✅ QUICK_START.md для быстрого старта
- ✅ DEPLOYMENT.md с инструкциями по развертыванию
- ✅ PROGRESS.md с прогрессом разработки
- ✅ CHANGELOG.md (этот файл)

### Технические детали

- **Backend**: Node.js 18+, Express.js, TypeScript, Prisma, PostgreSQL, Socket.io
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, React Router v6, Zustand, TanStack Query
- **База данных**: PostgreSQL 14+ с 20 таблицами
- **Аутентификация**: JWT токены
- **Real-time**: Socket.io для обновлений в реальном времени

## [Unreleased]

### Планируется

- [ ] Виртуализация больших таблиц для улучшения производительности
- [ ] Drag-and-drop для перестановки смен
- [ ] Офлайн режим с синхронизацией
- [ ] Расширенная аналитика и отчеты
- [ ] Экспорт расписаний в различные форматы
- [ ] Уведомления и напоминания
- [ ] Мобильная версия приложения

---

[0.1.0]: https://github.com/your-org/shift-manager/releases/tag/v0.1.0

