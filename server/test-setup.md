# Инструкции по тестированию

## Шаг 1: Проверка порта 5432

Если порт 5432 уже занят, либо:
- Остановите существующий PostgreSQL
- Или измените порт в docker-compose.yml на другой (например, 5433)

## Шаг 2: Настройка .env

Создайте файл `server/.env` на основе `server/.env.example`:

```env
DATABASE_URL="postgresql://shift_manager:shift_manager_pass@localhost:5432/shift_manager?schema=public"
PORT=3000
NODE_ENV=development
JWT_SECRET=dev-secret-key-change-in-production-min-32-chars
JWT_EXPIRES_IN=24h
CORS_ORIGIN=http://localhost:5173
WS_PORT=3000
TEMP_PASSWORD_EXPIRY_HOURS=24
```

## Шаг 3: Запуск Docker

```bash
docker-compose up -d
```

## Шаг 4: Применение миграций

```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed
```

## Шаг 5: Запуск сервера

```bash
cd server
npm run dev
```

## Шаг 6: Тестирование endpoints

### Health check
```bash
curl http://localhost:3000/health
```

### Авторизация
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@shift-manager.com\",\"password\":\"admin123\"}"
```

### Получение списка схем (нужен токен)
```bash
curl http://localhost:3000/api/v1/schedules \
  -H "Authorization: Bearer YOUR_TOKEN"
```


