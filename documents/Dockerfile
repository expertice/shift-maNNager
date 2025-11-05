# Multi-stage build для оптимизации размера образа

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm ci --only=production && \
    npm ci --only=development && \
    npm run build

# Stage 2: Runtime
FROM nginx:alpine

# Копируем nginx конфиг
COPY docker/nginx.conf /etc/nginx/nginx.conf

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Создаём директорию для логов
RUN mkdir -p /var/log/nginx

# Выставляем порт
EXPOSE 80

# Здоровье проверка
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/health || exit 1

# Запуск nginx в foreground режиме
CMD ["nginx", "-g", "daemon off;"]
