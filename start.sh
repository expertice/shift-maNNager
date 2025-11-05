#!/bin/bash
# Скрипт полного запуска проекта shift-Manager
# Автоматизирует запуск всех компонентов: БД, бэкенд, фронтенд

set -e

SKIP_DEPS=false
SKIP_MIGRATIONS=false

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-dependencies)
            SKIP_DEPS=true
            shift
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        *)
            echo "Неизвестный аргумент: $1"
            exit 1
            ;;
    esac
done

echo "========================================="
echo "  Запуск проекта shift-Manager"
echo "========================================="
echo ""

# Функция для проверки команды
check_command() {
    if ! command -v "$1" &> /dev/null; then
        echo "✗ $1 не найден. Установите $1."
        exit 1
    fi
}

# Проверка необходимых инструментов
echo "[1/7] Проверка необходимых инструментов..."

check_command docker
check_command node
check_command npm

echo "  ✓ Все необходимые инструменты установлены"
echo ""

# Шаг 1: Запуск базы данных
echo "[2/7] Запуск базы данных PostgreSQL..."

if docker ps -q -f name=shift-manager-db | grep -q .; then
    echo "  ✓ Контейнер базы данных уже запущен"
else
    echo "  → Запуск Docker контейнера..."
    docker-compose up -d
    
    echo "  → Ожидание готовности базы данных..."
    max_attempts=30
    attempt=0
    db_ready=false
    
    while [ $attempt -lt $max_attempts ] && [ "$db_ready" = false ]; do
        sleep 2
        if docker exec shift-manager-db pg_isready -U shift_manager &> /dev/null; then
            db_ready=true
        fi
        attempt=$((attempt + 1))
        echo "    Попытка $attempt/$max_attempts..."
    done
    
    if [ "$db_ready" = true ]; then
        echo "  ✓ База данных готова"
    else
        echo "  ⚠ База данных запущена, но проверка готовности заняла слишком долго. Продолжаем..."
    fi
fi

echo ""

# Шаг 2: Настройка бэкенда
echo "[3/7] Настройка бэкенда..."

cd server

# Установка зависимостей
if [ "$SKIP_DEPS" = false ]; then
    if [ ! -d "node_modules" ]; then
        echo "  → Установка зависимостей бэкенда..."
        npm install
        echo "  ✓ Зависимости установлены"
    else
        echo "  ✓ Зависимости бэкенда уже установлены"
    fi
else
    echo "  ⊘ Пропущена установка зависимостей (--skip-dependencies)"
fi

# Создание .env файла
if [ ! -f ".env" ]; then
    echo "  → Создание .env файла..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  ✓ .env файл создан из .env.example"
    else
        cat > .env << EOF
DATABASE_URL="postgresql://shift_manager:shift_manager_pass@localhost:5433/shift_manager?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
JWT_EXPIRES_IN="7d"
PORT=3000
NODE_ENV=development
WS_PORT=3000
EOF
        echo "  ✓ .env файл создан с базовыми настройками"
    fi
else
    echo "  ✓ .env файл уже существует"
fi

# Генерация Prisma клиента
echo "  → Генерация Prisma клиента..."
npx prisma generate
echo "  ✓ Prisma клиент сгенерирован"

# Применение миграций
if [ "$SKIP_MIGRATIONS" = false ]; then
    echo "  → Применение миграций базы данных..."
    npx prisma migrate deploy || npx prisma migrate dev --name init
    echo "  ✓ Миграции применены"
    
    # Заполнение тестовыми данными
    echo "  → Заполнение базы данных тестовыми данными..."
    npx prisma db seed || echo "  ⚠ Предупреждение: не удалось заполнить тестовыми данными (возможно, уже заполнено)"
    if [ $? -eq 0 ]; then
        echo "  ✓ Тестовые данные добавлены"
    fi
else
    echo "  ⊘ Пропущены миграции (--skip-migrations)"
fi

cd ..

echo ""

# Шаг 3: Настройка фронтенда
echo "[4/7] Настройка фронтенда..."

# Установка зависимостей
if [ "$SKIP_DEPS" = false ]; then
    if [ ! -d "node_modules" ]; then
        echo "  → Установка зависимостей фронтенда..."
        npm install
        echo "  ✓ Зависимости установлены"
    else
        echo "  ✓ Зависимости фронтенда уже установлены"
    fi
else
    echo "  ⊘ Пропущена установка зависимостей (--skip-dependencies)"
fi

# Создание .env файла для фронтенда
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "  ✓ .env файл создан из .env.example"
    else
        cat > .env << EOF
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
EOF
        echo "  ✓ .env файл создан с базовыми настройками"
    fi
else
    echo "  ✓ .env файл уже существует"
fi

echo ""

# Шаг 4: Запуск бэкенда
echo "[5/7] Запуск бэкенд сервера..."

# Проверка занятости порта 3000
PORT_3000_OCCUPIED=false
if command -v lsof &> /dev/null; then
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        PORT_3000_OCCUPIED=true
    fi
elif command -v netstat &> /dev/null; then
    if netstat -an 2>/dev/null | grep -q ":3000.*LISTEN"; then
        PORT_3000_OCCUPIED=true
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":3000"; then
        PORT_3000_OCCUPIED=true
    fi
fi

if [ "$PORT_3000_OCCUPIED" = true ]; then
    echo "  ⚠ Порт 3000 уже занят. Возможно, бэкенд уже запущен."
    echo "  → Пропускаем запуск бэкенда"
else
    echo "  → Запуск бэкенд сервера в фоновом режиме..."
    cd server
    NODE_ENV=development npm run dev > ../backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > .backend.pid
    cd ..
    sleep 3
    echo "  ✓ Бэкенд сервер запущен (PID: $BACKEND_PID, http://localhost:3000)"
fi

echo ""

# Шаг 5: Запуск фронтенда
echo "[6/7] Запуск фронтенд приложения..."

# Проверка занятости порта 5173
PORT_5173_OCCUPIED=false
if command -v lsof &> /dev/null; then
    if lsof -Pi :5173 -sTCP:LISTEN -t >/dev/null 2>&1; then
        PORT_5173_OCCUPIED=true
    fi
elif command -v netstat &> /dev/null; then
    if netstat -an 2>/dev/null | grep -q ":5173.*LISTEN"; then
        PORT_5173_OCCUPIED=true
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":5173"; then
        PORT_5173_OCCUPIED=true
    fi
fi

if [ "$PORT_5173_OCCUPIED" = true ]; then
    echo "  ⚠ Порт 5173 уже занят. Возможно, фронтенд уже запущен."
    echo "  → Пропускаем запуск фронтенда"
else
    echo "  → Запуск фронтенд сервера в фоновом режиме..."
    NODE_ENV=development npm run dev > frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo $FRONTEND_PID > .frontend.pid
    sleep 2
    echo "  ✓ Фронтенд сервер запущен (PID: $FRONTEND_PID, http://localhost:5173)"
fi

echo ""

# Шаг 6: Финальная проверка
echo "[7/7] Финальная проверка..."
sleep 5

if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "  ✓ Бэкенд отвечает на запросы"
else
    echo "  ⚠ Бэкенд ещё не готов (возможно, нужно подождать несколько секунд)"
fi

echo ""
echo "========================================="
echo "  Проект успешно запущен!"
echo "========================================="
echo ""
echo "Доступные сервисы:"
echo "  • Фронтенд:  http://localhost:5173"
echo "  • Бэкенд:    http://localhost:3000"
echo "  • Health:    http://localhost:3000/health"
echo ""
echo "Тестовые данные для входа:"
echo "  • Email:    admin@example.com"
echo "  • Password: admin123"
echo ""
echo "Для остановки проекта используйте скрипт stop.sh"
echo ""
echo "Логи:"
echo "  • Бэкенд:    tail -f backend.log"
echo "  • Фронтенд:  tail -f frontend.log"
echo ""

