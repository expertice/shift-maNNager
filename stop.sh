#!/bin/bash
# Скрипт полной остановки проекта shift-Manager
# Останавливает все запущенные компоненты: фронтенд, бэкенд, базу данных

set -e

echo "========================================="
echo "  Остановка проекта shift-Manager"
echo "========================================="
echo ""

# Шаг 1: Остановка фронтенда
echo "[1/4] Остановка фронтенд сервера..."

if [ -f ".frontend.pid" ]; then
    FRONTEND_PID=$(cat .frontend.pid)
    if kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "  → Остановка процесса фронтенда (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
        sleep 1
        kill -9 "$FRONTEND_PID" 2>/dev/null || true
        echo "  ✓ Фронтенд сервер остановлен"
    else
        echo "  ✓ Процесс фронтенда уже остановлен"
    fi
    rm -f .frontend.pid
else
    # Попытка найти процесс по порту
    FRONTEND_PID=""
    if command -v lsof &> /dev/null; then
        FRONTEND_PID=$(lsof -ti:5173 2>/dev/null || true)
    elif command -v fuser &> /dev/null; then
        FRONTEND_PID=$(fuser 5173/tcp 2>/dev/null | awk '{print $1}' || true)
    fi
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "  → Остановка процесса фронтенда (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
        echo "  ✓ Фронтенд сервер остановлен"
    else
        echo "  ✓ Фронтенд сервер не запущен"
    fi
fi

echo ""

# Шаг 2: Остановка бэкенда
echo "[2/4] Остановка бэкенд сервера..."

if [ -f "server/.backend.pid" ]; then
    BACKEND_PID=$(cat server/.backend.pid)
    if kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "  → Остановка процесса бэкенда (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        sleep 1
        kill -9 "$BACKEND_PID" 2>/dev/null || true
        echo "  ✓ Бэкенд сервер остановлен"
    else
        echo "  ✓ Процесс бэкенда уже остановлен"
    fi
    rm -f server/.backend.pid
else
    # Попытка найти процесс по порту
    BACKEND_PID=""
    if command -v lsof &> /dev/null; then
        BACKEND_PID=$(lsof -ti:3000 2>/dev/null || true)
    elif command -v fuser &> /dev/null; then
        BACKEND_PID=$(fuser 3000/tcp 2>/dev/null | awk '{print $1}' || true)
    fi
    
    if [ -n "$BACKEND_PID" ]; then
        echo "  → Остановка процесса бэкенда (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        echo "  ✓ Бэкенд сервер остановлен"
    else
        echo "  ✓ Бэкенд сервер не запущен"
    fi
fi

# Также ищем процессы tsx (используется для dev режима)
TSX_PIDS=$(pgrep -f "tsx.*server" 2>/dev/null || true)
if [ -n "$TSX_PIDS" ]; then
    echo "  → Остановка процессов tsx бэкенда..."
    echo "$TSX_PIDS" | xargs kill 2>/dev/null || true
fi

echo ""

# Шаг 3: Остановка базы данных
echo "[3/4] Остановка базы данных PostgreSQL..."

if docker ps -q -f name=shift-manager-db | grep -q .; then
    echo "  → Остановка Docker контейнера..."
    docker-compose down
    echo "  ✓ База данных остановлена"
else
    echo "  ✓ База данных не запущена"
fi

echo ""

# Шаг 4: Очистка временных файлов
echo "[4/4] Очистка временных файлов..."

rm -f .frontend.pid server/.backend.pid backend.log frontend.log 2>/dev/null || true

echo "  ✓ Временные файлы очищены"

echo ""
echo "========================================="
echo "  Проект успешно остановлен!"
echo "========================================="
echo ""

# Дополнительная информация
echo "Полезные команды:"
echo "  • Запуск проекта:     ./start.sh"
echo "  • Просмотр контейнеров: docker ps"
echo "  • Логи базы данных:    docker logs shift-manager-db"
echo "  • Удаление данных БД:  docker-compose down -v"
echo ""

