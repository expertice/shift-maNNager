# Скрипты запуска и остановки проекта

Проект включает автоматизированные скрипты для быстрого запуска и остановки всех компонентов.

## Windows (PowerShell)

### Запуск проекта

```powershell
.\start.ps1
```

Скрипт автоматически:
1. Проверяет наличие необходимых инструментов (Docker, Node.js, npm)
2. Запускает базу данных PostgreSQL в Docker
3. Устанавливает зависимости бэкенда (если нужно)
4. Создает/проверяет .env файлы
5. Применяет миграции базы данных
6. Заполняет базу тестовыми данными
7. Устанавливает зависимости фронтенда (если нужно)
8. Запускает бэкенд сервер в отдельном окне PowerShell
9. Запускает фронтенд сервер в отдельном окне PowerShell
10. Проверяет работоспособность сервисов

**Дополнительные параметры:**

```powershell
# Пропустить установку зависимостей (если уже установлены)
.\start.ps1 -SkipDependencies

# Пропустить применение миграций (если БД уже настроена)
.\start.ps1 -SkipMigrations

# Комбинация параметров
.\start.ps1 -SkipDependencies -SkipMigrations
```

### Остановка проекта

```powershell
.\stop.ps1
```

Скрипт автоматически:
1. Останавливает фронтенд сервер (процессы на порту 5173)
2. Останавливает бэкенд сервер (процессы на порту 3000)
3. Останавливает Docker контейнер с базой данных
4. Очищает временные файлы

## Linux / macOS (Bash)

### Запуск проекта

```bash
chmod +x start.sh
./start.sh
```

Скрипт автоматически выполняет те же действия, что и PowerShell версия.

**Дополнительные параметры:**

```bash
# Пропустить установку зависимостей
./start.sh --skip-dependencies

# Пропустить применение миграций
./start.sh --skip-migrations

# Комбинация параметров
./start.sh --skip-dependencies --skip-migrations
```

### Остановка проекта

```bash
chmod +x stop.sh
./stop.sh
```

## Что запускается

После выполнения скрипта запуска доступны следующие сервисы:

- **Фронтенд**: http://localhost:5173
- **Бэкенд API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health
- **База данных**: localhost:5433

## Тестовые данные

Для входа в систему используйте:
- **Email**: `admin@example.com`
- **Password**: `admin123`

## Решение проблем

### Порт уже занят

Если скрипт сообщает, что порт занят:

1. Проверьте, не запущен ли уже проект: используйте `stop.ps1` / `stop.sh`
2. Найдите процесс, занимающий порт:
   - Windows: `netstat -ano | findstr :3000` или `netstat -ano | findstr :5173`
   - Linux/Mac: `lsof -i :3000` или `lsof -i :5173`
3. Остановите процесс вручную

### Docker контейнер не запускается

```bash
# Проверьте статус контейнеров
docker ps -a

# Посмотрите логи
docker logs shift-manager-db

# Перезапустите контейнер
docker-compose restart

# Полная перезагрузка с удалением данных
docker-compose down -v
docker-compose up -d
```

### Ошибки при миграциях

```bash
cd server
npx prisma migrate reset  # ВНИМАНИЕ: удалит все данные!
npx prisma migrate dev
npx prisma db seed
```

### Процессы не останавливаются

Если скрипт остановки не сработал:

**Windows:**
```powershell
# Найти процессы Node.js
Get-Process node | Stop-Process -Force

# Остановить Docker
docker-compose down
```

**Linux/Mac:**
```bash
# Найти и остановить процессы
pkill -f "node.*vite"      # Фронтенд
pkill -f "tsx.*server"     # Бэкенд
killall node              # Все Node.js процессы

# Остановить Docker
docker-compose down
```

## Ручной запуск (альтернатива)

Если скрипты не работают, можно запустить вручную:

1. **База данных:**
   ```bash
   docker-compose up -d
   ```

2. **Бэкенд** (в отдельном терминале):
   ```bash
   cd server
   npm install
   npx prisma migrate deploy
   npx prisma db seed
   npm run dev
   ```

3. **Фронтенд** (в отдельном терминале):
   ```bash
   npm install
   npm run dev
   ```

## Автоматизация в CI/CD

Скрипты можно использовать в CI/CD пайплайнах:

```yaml
# Пример для GitHub Actions
- name: Start project
  run: |
    chmod +x start.sh
    ./start.sh --skip-migrations

- name: Run tests
  run: npm test

- name: Stop project
  run: |
    chmod +x stop.sh
    ./stop.sh
```

