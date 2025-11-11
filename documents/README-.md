# 🔄 Shift Manager - Система управления сменными графиками

<div align="center">

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18-61dafb)
![License](https://img.shields.io/badge/license-Private-red)

Комплексная система планирования смен и управления расписанием с поддержкой real-time обновлений и автоматической генерации графиков работы.

[Быстрый старт](#-быстрый-старт) • [Документация](#-документация) • [CI/CD](#-cicd-pipeline) • [API](#-api-документация)

</div>

---

## 📑 Содержание

- [Особенности](#-особенности)
- [Технологический стек](#️-технологический-стек)
- [Быстрый старт](#-быстрый-старт)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Структура проекта](#-структура-проекта)
- [Развертывание](#-развертывание)
- [API Документация](#-api-документация)
- [Тестирование](#-тестирование)
- [Разработка](#-разработка)

---

## ✨ Особенности

### 🎯 Основной функционал

- **📅 Интеллектуальное планирование смен** - автоматическая генерация расписаний на основе профилей смен (2/2, 3/3, и т.д.)
- **👥 Управление сотрудниками** - полный контроль над персоналом и их графиками
- **🔄 Real-time обновления** - мгновенная синхронизация изменений между пользователями через WebSocket
- **📊 Помесячная визуализация** - расписание разбивается на таблицы по месяцам для удобного просмотра
- **🎨 Цветовое кодирование** - визуальное различение типов смен с настраиваемыми цветами
- **🔒 Управление доступом** - гибкая система ролей (owner, editor, viewer)
- **📝 История изменений** - полный аудит всех операций в системе
- **🏖️ Управление отпусками** - интерактивный календарь для планирования отпусков
- **⚠️ Валидация покрытия** - автоматическая проверка минимального количества персонала
- **🔐 Безопасная аутентификация** - JWT токены + bcrypt хеширование паролей

### 🚀 Продвинутые возможности

- **Drag & Drop** - перетаскивание смен для быстрого редактирования
- **Экспорт в PDF** - генерация отчетов и расписаний
- **Шаблоны графиков** - создание и переиспользование профилей смен
- **Запросы на обмен сменами** - сотрудники могут запрашивать обмен сменами
- **Конфликты и валидация** - автоматическое выявление проблем в расписании

---

## 🛠️ Технологический стек

### Backend
```
Node.js + Express.js + TypeScript
├── Prisma ORM → PostgreSQL
├── Socket.io → Real-time коммуникация
├── JWT → Аутентификация
├── bcrypt → Безопасность паролей
└── Vitest → Unit тестирование
```

### Frontend
```
React 18 + TypeScript + Vite
├── React Router v6 → Навигация
├── Zustand → State management
├── TanStack Query → API & кеширование
├── React Hook Form + Zod → Формы & валидация
├── Tailwind CSS → Стилизация
├── date-fns → Работа с датами
└── Socket.io Client → Real-time
```

### DevOps & CI/CD
```
GitHub Actions → Автоматизация
├── Docker → Контейнеризация
├── Nginx → Reverse proxy
├── PM2 → Process management
├── PostgreSQL 14+ → База данных
└── Trivy → Security scanning
```

---

## 🚀 Быстрый старт

### Предварительные требования

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** и **Docker Compose** (для локальной БД)
- **PostgreSQL** 14+ (для production)

### Автоматический запуск (PowerShell для Windows)

```powershell
# Первый запуск - установка и настройка
.\first_start.ps1

# Обычный запуск
.\start.ps1

# Остановка
.\stop.ps1
```

### Автоматический запуск (Bash для Linux/Mac)

```bash
# Первый запуск
chmod +x first_start.sh start.sh stop.sh
./first_start.sh

# Обычный запуск
./start.sh

# Остановка
./stop.sh
```

### Ручная установка

<details>
<summary>Развернуть инструкции</summary>

#### 1. Клонирование репозитория
```bash
git clone https://github.com/expertice/shift-maNNager.git
cd shift-maNNager
```

#### 2. База данных
```bash
# Запуск PostgreSQL в Docker
docker-compose up -d
```

#### 3. Backend настройка
```bash
cd server
npm install

# Создание .env файла
cat > .env << EOF
DATABASE_URL="postgresql://shift_user:shift_password@localhost:5433/shift_manager?schema=public"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="http://localhost:5173"
PORT=3000
NODE_ENV="development"
EOF

# Применение миграций и seed данных
npx prisma migrate dev
npx prisma db seed

# Запуск backend
npm run dev
```
Backend запустится на `http://localhost:3000`

#### 4. Frontend настройка
```bash
# Возврат в корневую директорию
cd ..
npm install

# Создание .env файла (опционально)
cat > .env << EOF
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
EOF

# Запуск frontend
npm run dev
```
Frontend запустится на `http://localhost:5173`

</details>

### 🔐 Тестовые данные для входа

После `prisma db seed`:
- **Admin**: `admin@example.com` / `admin123`
- Сотрудники входят по одноразовым паролям, генерируемым в системе

---

## 🔄 CI/CD Pipeline

Проект использует **GitHub Actions** для автоматизации процессов разработки и деплоя.

### 📊 Workflow Pipeline

```mermaid
graph LR
    A[Push/PR] --> B[Lint & Format]
    A --> C[Type Check]
    A --> D[Unit Tests]
    B --> E[Build]
    C --> E
    D --> E
    E --> F[Docker Build]
    F --> G{Branch?}
    G -->|develop| H[Deploy Staging]
    G -->|main| I[Security Scan]
    I --> J[Deploy Production]
```

### 🎯 Этапы CI/CD

#### 1️⃣ **Lint & Format Check**
- ESLint проверка кода
- Prettier форматирование
- Прогоняется на каждом push/PR

#### 2️⃣ **TypeScript Type Check**
- Проверка типов TypeScript
- Валидация типовой безопасности

#### 3️⃣ **Unit Tests**
- Запуск всех unit тестов
- Генерация отчета о покрытии
- Загрузка в Codecov

#### 4️⃣ **Build Application**
- Сборка backend и frontend
- Валидация успешности сборки
- Сохранение артефактов

#### 5️⃣ **Docker Build & Push**
- Создание Docker образа
- Push в GitHub Container Registry
- Кеширование слоев для ускорения

#### 6️⃣ **Security Scan**
- Сканирование на уязвимости (Trivy)
- Отправка результатов в Security tab
- Блокировка при критических уязвимостях

#### 7️⃣ **Deploy**
- **Staging** (develop branch) - автоматический деплой
- **Production** (main branch) - деплой после одобрения

### 📁 Настройка CI/CD

#### Создание файла workflow

Файл `.github/workflows/ci-cd.yml` уже включен в репозиторий.

```bash
# Структура
.github/
└── workflows/
    └── ci-cd.yml  # Основной CI/CD pipeline
```

#### Необходимые GitHub Secrets

Настройте следующие secrets в настройках репозитория (`Settings` → `Secrets and variables` → `Actions`):

```yaml
# Для Docker Registry
GITHUB_TOKEN: автоматически доступен

# Для деплоя (опционально)
DEPLOY_SSH_KEY: ваш SSH ключ для деплоя на сервер
DEPLOY_HOST: адрес production сервера
DEPLOY_USER: пользователь для деплоя

# Для уведомлений (опционально)
SLACK_WEBHOOK: webhook для уведомлений в Slack
```

#### Запуск Workflow

Pipeline запускается автоматически при:
- Push в ветки `main` или `develop`
- Создании Pull Request в `main` или `develop`

Или вручную:
1. Перейдите в `Actions` на GitHub
2. Выберите `CI/CD Pipeline`
3. Нажмите `Run workflow`

### 🐳 Docker Deployment

#### Локальная сборка Docker образа

```bash
# Frontend
docker build -t shift-manager-frontend:latest .

# Backend
docker build -t shift-manager-backend:latest ./server
```

#### Использование Docker Compose

```bash
# Полный стек (БД + Backend + Frontend)
docker-compose up -d

# Остановка
docker-compose down

# Просмотр логов
docker-compose logs -f
```

### 📈 Мониторинг Pipeline

- **Build статус**: ![Build Status](https://github.com/expertice/shift-maNNager/actions/workflows/ci-cd.yml/badge.svg)
- **Coverage**: Доступен через Codecov
- **Security**: GitHub Security tab

---

## 📁 Структура проекта

```
shift-maNNager/
├── .github/
│   └── workflows/
│       └── ci-cd.yml          # GitHub Actions CI/CD
│
├── server/                     # Backend приложение
│   ├── src/
│   │   ├── controllers/       # API контроллеры
│   │   ├── services/          # Бизнес-логика
│   │   ├── routes/            # Express маршруты
│   │   ├── middleware/        # Auth, error handling
│   │   ├── lib/               # Утилиты (Prisma client)
│   │   ├── types/             # TypeScript типы
│   │   └── utils/             # Вспомогательные функции
│   ├── prisma/
│   │   ├── schema.prisma      # Схема БД
│   │   ├── migrations/        # Миграции БД
│   │   └── seed.ts            # Тестовые данные
│   ├── dist/                  # Скомпилированный JS
│   └── package.json
│
├── src/                        # Frontend приложение
│   ├── components/
│   │   ├── common/            # Переиспользуемые UI компоненты
│   │   ├── layout/            # Layout компоненты
│   │   ├── schedules/         # Компоненты расписаний
│   │   └── shifts/            # Компоненты смен
│   ├── pages/                 # Страницы приложения
│   ├── services/
│   │   ├── api/               # API клиенты
│   │   └── utils/             # Утилиты (PDF, валидация)
│   ├── hooks/                 # React hooks
│   ├── store/                 # Zustand stores
│   ├── types/                 # TypeScript типы
│   └── styles/                # CSS стили
│
├── documents/                  # Документация
│   ├── API_CONTRACTS.md       # API спецификация
│   ├── DEVELOPER_GUIDE.md     # Руководство разработчика
│   ├── FRONTEND_ARCH.md       # Архитектура frontend
│   └── ...
│
├── docker-compose.yml          # Docker конфигурация
├── Dockerfile                  # Docker образ (если нужен)
├── start.ps1 / start.sh        # Скрипты запуска
├── stop.ps1 / stop.sh          # Скрипты остановки
└── first_start.ps1             # Первоначальная настройка
```

---

## 🚢 Развертывание

### Production Deployment

#### Вариант 1: Традиционный (VPS/Dedicated Server)

<details>
<summary>Развернуть инструкции</summary>

**1. Подготовка сервера**
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Установка Nginx
sudo apt install -y nginx

# Установка PM2
sudo npm install -g pm2
```

**2. Клонирование и сборка**
```bash
cd /var/www
git clone https://github.com/expertice/shift-maNNager.git
cd shift-maNNager

# Backend
cd server
npm ci --production=false
npm run build
npx prisma migrate deploy
npx prisma db seed

# Frontend
cd ..
npm ci
npm run build
```

**3. Настройка переменных окружения**
```bash
# server/.env
DATABASE_URL="postgresql://user:password@localhost:5432/shift_manager?schema=public"
JWT_SECRET="используйте-длинный-случайный-ключ-минимум-32-символа"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="https://yourdomain.com"
PORT=3000
NODE_ENV="production"
```

**4. Запуск с PM2**
```bash
cd server
pm2 start dist/index.js --name shift-manager-api
pm2 save
pm2 startup
```

**5. Настройка Nginx**
```nginx
# /etc/nginx/sites-available/shift-manager
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/shift-maNNager/dist;
    index index.html;

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

```bash
# Активация конфигурации
sudo ln -s /etc/nginx/sites-available/shift-manager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**6. SSL сертификат (Let's Encrypt)**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

</details>

#### Вариант 2: Docker Deployment

<details>
<summary>Развернуть инструкции</summary>

**Использование Docker Compose для полного стека:**

```bash
# Клонирование
git clone https://github.com/expertice/shift-maNNager.git
cd shift-maNNager

# Настройка .env файлов
cp server/.env.example server/.env
cp .env.example .env

# Запуск
docker-compose -f docker-compose.prod.yml up -d

# Применение миграций
docker-compose exec backend npx prisma migrate deploy

# Просмотр логов
docker-compose logs -f
```

</details>

### Обновление приложения

```bash
# 1. Остановка
pm2 stop shift-manager-api

# 2. Обновление кода
git pull origin main

# 3. Установка зависимостей и сборка
cd server
npm ci --production=false
npm run build

cd ..
npm ci
npm run build

# 4. Миграции БД (если есть)
cd server
npx prisma migrate deploy

# 5. Перезапуск
pm2 restart shift-manager-api
```

---

## 📚 API Документация

### Базовый URL
```
http://localhost:3000/api/v1
```

### Аутентификация

Все защищенные endpoints требуют JWT токен:
```http
Authorization: Bearer <your-jwt-token>
```

### Основные Endpoints

<details>
<summary><b>Authentication</b></summary>

```http
POST /api/v1/auth/login
POST /api/v1/auth/employee-login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

</details>

<details>
<summary><b>Schedules</b></summary>

```http
GET    /api/v1/schedules
POST   /api/v1/schedules
GET    /api/v1/schedules/:id
PUT    /api/v1/schedules/:id
DELETE /api/v1/schedules/:id
POST   /api/v1/schedules/:id/duplicate
POST   /api/v1/schedules/:id/publish
```

</details>

<details>
<summary><b>Employees</b></summary>

```http
GET    /api/v1/schedules/:scheduleId/employees
POST   /api/v1/schedules/:scheduleId/employees
PUT    /api/v1/employees/:id
DELETE /api/v1/employees/:id
POST   /api/v1/employees/:id/generate-password
```

</details>

<details>
<summary><b>Shifts</b></summary>

```http
GET    /api/v1/shifts
POST   /api/v1/shifts/generate
PUT    /api/v1/shifts/:id
DELETE /api/v1/shifts/:id
GET    /api/v1/shifts/conflicts
```

</details>

<details>
<summary><b>Shift Profiles</b></summary>

```http
GET    /api/v1/shift-profiles
POST   /api/v1/shift-profiles
GET    /api/v1/shift-profiles/:id
PUT    /api/v1/shift-profiles/:id
DELETE /api/v1/shift-profiles/:id
POST   /api/v1/shift-profiles/compare
```

</details>

Полная документация: [`documents/API_CONTRACTS.md`](documents/API_CONTRACTS.md)

---

## 🧪 Тестирование

### Backend Tests

```bash
cd server

# Запуск тестов
npm run test

# Watch режим
npm run test:watch

# Coverage отчет
npm run test:coverage

# UI интерфейс для тестов
npm run test:ui
```

**Тестируемые модули:**
- `rosterPatternsService` - управление экземплярами паттернов
- Контроллеры и middleware
- Утилиты и сервисы

### Frontend Tests

```bash
# Запуск тестов
npm run test

# Watch режим
npm run test:watch

# Coverage отчет
npm run test:coverage

# UI интерфейс
npm run test:ui
```

**Тестируемые компоненты:**
- `rosterCalendar` - утилиты календаря
- `EmployeePatternRow` - drag-and-drop компоненты
- React компоненты и hooks

### E2E Tests (планируется)

```bash
# Установка Playwright
npm install -D @playwright/test

# Запуск E2E тестов
npm run test:e2e
```

---

## 💻 Разработка

### Требования к окружению

- Node.js >= 18.0.0
- npm >= 9.0.0
- Git
- IDE с TypeScript поддержкой (рекомендуется VS Code)

### Настройка окружения для разработки

```bash
# Клонирование
git clone https://github.com/expertice/shift-maNNager.git
cd shift-maNNager

# Установка зависимостей
npm install
cd server && npm install && cd ..

# Запуск в dev режиме
npm run dev          # Frontend
cd server && npm run dev  # Backend
```

### Code Style

Проект использует:
- **ESLint** для проверки кода
- **Prettier** для форматирования
- **TypeScript strict mode**

```bash
# Проверка кода
npm run lint

# Автоисправление
npm run lint:fix

# Форматирование
npm run format

# Type checking
npm run type-check
```

### Git Workflow

```bash
# Создание feature ветки
git checkout -b feature/your-feature-name

# Коммит изменений
git add .
git commit -m "feat: добавлена новая функция"

# Push и создание PR
git push origin feature/your-feature-name
```

**Формат коммитов (Conventional Commits):**
- `feat:` - новая функция
- `fix:` - исправление бага
- `docs:` - изменения в документации
- `style:` - форматирование, отступы
- `refactor:` - рефакторинг кода
- `test:` - добавление тестов
- `chore:` - обновление зависимостей, конфигурации

### Добавление новых функций

<details>
<summary>Backend</summary>

1. Создайте контроллер в `server/src/controllers/`
2. Создайте сервис в `server/src/services/`
3. Добавьте маршруты в `server/src/routes/`
4. Обновите типы в `server/src/types/index.ts`
5. Добавьте тесты

</details>

<details>
<summary>Frontend</summary>

1. Создайте компонент в `src/components/`
2. Добавьте API сервис в `src/services/api/`
3. Обновите типы в `src/types/index.ts`
4. Добавьте страницу в `src/pages/` (если нужно)
5. Добавьте тесты

</details>

### Полезные команды

```bash
# Генерация Prisma типов
cd server
npx prisma generate

# Создание новой миграции
npx prisma migrate dev --name your_migration_name

# Просмотр БД в браузере
npx prisma studio

# Очистка и rebuild
npm run clean
npm run build
```

---

## 🐛 Известные ограничения

- Виртуализация больших таблиц не реализована (может быть медленно при >1000 записей)
- Офлайн режим с синхронизацией не реализован
- Расширенная аналитика (графики, dashboard) в разработке
- Перетаскивание смен между сотрудниками не реализовано (только внутри строки)
- Мобильная версия требует оптимизации

---

## 📊 Roadmap

### v0.3.0 (Планируется)
- [ ] Виртуализация таблиц для больших данных
- [ ] Расширенная аналитика и отчеты
- [ ] Экспорт в Excel
- [ ] Мобильное приложение (React Native)
- [ ] Уведомления через email/SMS

### v0.4.0 (Планируется)
- [ ] Интеграция с внешними календарями (Google, Outlook)
- [ ] API для интеграции с другими системами
- [ ] Машинное обучение для оптимизации расписаний
- [ ] Офлайн режим с синхронизацией

---

## 📝 Документация

- [API Контракты](documents/API_CONTRACTS.md)
- [Руководство разработчика](documents/DEVELOPER_GUIDE.md)
- [Архитектура Frontend](documents/FRONTEND_ARCH.md)
- [Структура БД](documents/структура%20БД.md)
- [Инструкции по развертыванию](DEPLOYMENT.md)
- [Быстрый старт](QUICK_START.md)

---

## 🤝 Вклад в проект

Проект находится в активной разработке. Для участия:

1. Fork репозиторий
2. Создайте feature branch (`git checkout -b feature/amazing-feature`)
3. Commit изменения (`git commit -m 'feat: Add amazing feature'`)
4. Push в branch (`git push origin feature/amazing-feature`)
5. Откройте Pull Request

---

## 📄 Лицензия

Внутренний проект. Все права защищены.

---

## 👥 Контакты

**Проект:** Shift Manager  
**Организация:** Норникель  
**Repository:** [github.com/expertice/shift-maNNager](https://github.com/expertice/shift-maNNager)

---

<div align="center">

**Версия:** 0.2.0 | **Последнее обновление:** November 2025

Made with ❤️ for efficient shift management

</div>
