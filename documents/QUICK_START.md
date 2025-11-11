# Быстрый старт - Shift Manager

Минимальная инструкция для запуска проекта в режиме разработки.

## 🚀 Автоматический запуск (рекомендуется)

Для быстрого запуска всего проекта используйте автоматизированные скрипты:

**Windows:**
```powershell
.\start.ps1
```

**Linux/Mac:**
```bash
chmod +x start.sh
./start.sh
```

Скрипты автоматически запустят все компоненты: базу данных, бэкенд и фронтенд.

Для остановки используйте `stop.ps1` или `stop.sh`.

Подробнее: см. [SCRIPTS.md](./SCRIPTS.md)

---

## Ручной запуск (пошаговая инструкция)

### Шаг 1: Запуск базы данных

```bash
docker-compose up -d
```

Проверьте, что контейнер запущен:
```bash
docker ps
```

## Шаг 2: Настройка и запуск бэкенда

```bash
cd server

# Установка зависимостей
npm install

# Создание .env файла
cp .env.example .env
# Отредактируйте .env - обычно достаточно оставить значения по умолчанию

# Применение миграций
npx prisma migrate dev

# Заполнение тестовыми данными
npx prisma db seed

# Запуск сервера
npm run dev
```

Бэкенд доступен на `http://localhost:3000`

## Шаг 3: Настройка и запуск фронтенда

Откройте новый терминал:

```bash
# Вернуться в корневую директорию проекта
cd ..

# Установка зависимостей
npm install

# Создание .env файла (опционально)
cp .env.example .env

# Запуск dev-сервера
npm run dev
```

Фронтенд доступен на `http://localhost:5173`

## Шаг 4: Вход в систему

Откройте браузер и перейдите на `http://localhost:5173`

Используйте тестовые данные для входа:
- **Email**: `admin@example.com`
- **Password**: `admin123` (или как указано в seed данных)

## Проверка работоспособности

1. ✅ Бэкенд health check: `http://localhost:3000/health`
2. ✅ Фронтенд открывается без ошибок
3. ✅ Можно войти в систему
4. ✅ Можно создать расписание
5. ✅ Можно добавить сотрудников
6. ✅ После генерации смен можно перетаскивать смены в ростре (drag-and-drop)
7. ✅ Ростер автоматически разбивается на месячные таблицы

## Остановка

```bash
# Остановить фронтенд: Ctrl+C в терминале

# Остановить бэкенд: Ctrl+C в терминале

# Остановить базу данных
docker-compose down
```

## Полезные команды

### Бэкенд
```bash
cd server
npm run type-check  # Проверка типов TypeScript
npm run lint        # Проверка кода
npm run build       # Сборка для production
```

### Фронтенд
```bash
npm run type-check  # Проверка типов TypeScript
npm run lint        # Проверка кода
npm run build       # Сборка для production
npm run preview     # Предпросмотр production сборки
```

### База данных
```bash
cd server
npx prisma studio   # GUI для просмотра БД
npx prisma migrate reset  # Сброс БД и применение миграций заново
```

## Решение проблем

### Порт 5433 уже занят
Измените порт в `docker-compose.yml` на другой (например, 5434).

### Ошибка подключения к БД
Убедитесь, что Docker контейнер запущен: `docker ps`

### Ошибки TypeScript
```bash
# Бэкенд
cd server && npm run type-check

# Фронтенд
npm run type-check
```

### Ошибки при миграции
```bash
cd server
npx prisma migrate reset  # ВНИМАНИЕ: удалит все данные!
npx prisma migrate dev
npx prisma db seed
```

