# Инструкции по развертыванию

## Подготовка к production

### 1. Настройка переменных окружения

#### Backend
Создайте `.env` файл в `server/`:
```env
DATABASE_URL="postgresql://user:strong_password@db_host:5432/shift_manager?schema=public"
JWT_SECRET="используйте-длинный-случайный-ключ-минимум-32-символа"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="https://your-domain.com"
PORT=3000
NODE_ENV="production"
```

#### Frontend
Создайте `.env.production` файл в корне:
```env
VITE_API_URL=https://api.your-domain.com/api/v1
VITE_WS_URL=https://api.your-domain.com
```

### 2. Сборка проекта

#### Backend
```bash
cd server
npm ci --production=false
npm run build
```

#### Frontend
```bash
npm ci
npm run build
# Файлы будут в папке dist/
```

### 3. Развертывание базы данных

```bash
# Применить миграции
cd server
npx prisma migrate deploy

# Заполнить начальными данными (опционально)
npx prisma db seed
```

### 4. Запуск приложения

#### Использование PM2 (рекомендуется)
```bash
# Установить PM2
npm install -g pm2

# Запустить backend
cd server
pm2 start dist/index.js --name shift-manager-api

# Сохранить конфигурацию PM2
pm2 save
pm2 startup
```

#### Использование Docker (опционально)
Создайте `Dockerfile` для backend и используйте docker-compose для полного стека.

### 5. Настройка Nginx (для фронтенда)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /path/to/shift-maNNager/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 6. SSL сертификаты (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com
```

## Мониторинг и логи

### PM2 логи
```bash
pm2 logs shift-manager-api
pm2 monit
```

### Проверка здоровья
```bash
curl http://localhost:3000/health
```

## Резервное копирование

### База данных
```bash
pg_dump -h localhost -U user -d shift_manager > backup_$(date +%Y%m%d).sql
```

### Восстановление
```bash
psql -h localhost -U user -d shift_manager < backup_YYYYMMDD.sql
```

## Обновление приложения

```bash
# 1. Остановить приложение
pm2 stop shift-manager-api

# 2. Обновить код
git pull origin main

# 3. Установить зависимости
cd server && npm ci && npm run build
cd .. && npm ci && npm run build

# 4. Применить миграции (если есть)
cd server
npx prisma migrate deploy

# 5. Перезапустить
pm2 restart shift-manager-api
```

