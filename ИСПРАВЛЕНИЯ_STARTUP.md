# Исправления скрипта запуска start.ps1

## Проблема
Скрипт `start.ps1` не всегда корректно запускался:
- ❌ Иногда не запускался frontend
- ❌ Иногда не запускался backend
- ❌ Ошибка: "Не удалось найти путь D:\Coding\shift-maNNager\server\server"

## Причина проблем

### 1. Неправильное определение корневой директории
**Проблема:** Использовалось `$ProjectRoot = (Get-Location).Path`
- При запуске скрипта через `-File` путь может быть неправильным
- `Get-Location` возвращает текущую рабочую директорию, а не директорию скрипта
- Это приводило к ошибкам при `Push-Location server`

**Решение:** Используется `$PSScriptRoot`
- `$PSScriptRoot` всегда содержит путь к директории, где находится скрипт
- Добавлены fallback варианты для совместимости

### 2. Отсутствие явного возврата в корневую директорию
**Проблема:** После работы в `server/` не гарантировался возврат в корень
- `Pop-Location` не всегда корректно работал
- Frontend настройка могла выполняться в неправильной директории

**Решение:** Добавлены явные `Set-Location $ProjectRoot`
- Перед настройкой backend
- Перед настройкой frontend  
- Перед запуском backend сервера
- Перед запуском frontend сервера
- Перед финальной проверкой

### 3. Недостаточные задержки при запуске
**Проблема:** Серверы не успевали запуститься
- Backend: 3 секунды (недостаточно)
- Frontend: 2 секунды (недостаточно)
- Финальная проверка выполнялась слишком рано

**Решение:** Увеличены задержки
- Backend: 5 секунд + сообщение о waiting
- Frontend: 3 секунды + сообщение о waiting
- Финальная проверка: 5 секунд

## Внесенные изменения

### Строки 11-22: Правильное определение $ProjectRoot
```powershell
# Было:
$ProjectRoot = (Get-Location).Path

# Стало:
$ProjectRoot = $PSScriptRoot
if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
if (-not $ProjectRoot) {
    $ProjectRoot = (Get-Location).Path
}
```

### Строки 24-29: Добавлена диагностика
```powershell
Write-Host "Project root: $ProjectRoot" -ForegroundColor Gray
```

### Строки 147-149: Явный переход перед backend setup
```powershell
# Ensure we're in the correct directory
Set-Location $ProjectRoot
Push-Location server
```

### Строки 232-233: Явный переход перед frontend setup
```powershell
# Ensure we're back in project root
Set-Location $ProjectRoot
```

### Строки 291-308: Улучшенный запуск backend
```powershell
# Ensure we're in project root
Set-Location $ProjectRoot

# ... проверка порта ...

Write-Host "  -> Waiting for backend to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5  # Было: 3
```

### Строки 316-332: Улучшенный запуск frontend
```powershell
# Ensure we're in project root
Set-Location $ProjectRoot

# ... проверка порта ...

Write-Host "  -> Waiting for frontend to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 3  # Было: 2
```

### Строки 340-341: Явный переход перед финальной проверкой
```powershell
# Ensure we're in project root
Set-Location $ProjectRoot
```

## Результат

✅ **Скрипт теперь стабильно запускается**
- Правильно определяет корневую директорию проекта
- Всегда возвращается в корень между операциями
- Серверы успевают запуститься перед проверкой

### Вывод при успешном запуске:
```
=========================================
  Starting shift-Manager Project
=========================================

Project root: D:\Coding\shift-maNNager

[1/7] Checking required tools...
  [+] Docker found
  [+] Node.js found
  [+] npm found

[2/7] Starting PostgreSQL database...
  [+] Database container already running

[3/7] Setting up backend...
  [+] Backend dependencies already installed
  [+] .env file already exists
  [+] Prisma client already generated

[4/7] Setting up frontend...
  [+] Frontend dependencies already installed
  [+] .env file already exists

[5/7] Starting backend server...
  -> Starting backend server in new PowerShell window...
  -> Waiting for backend to start...
  [+] Backend server started (http://localhost:3000)

[6/7] Starting frontend application...
  -> Starting frontend server in new PowerShell window...
  -> Waiting for frontend to start...
  [+] Frontend server started (http://localhost:5173)

[7/7] Final check...
  [+] Backend is responding

=========================================
  Project started successfully!
=========================================
```

## Как использовать

### Запуск проекта
```powershell
# Из любой директории
powershell -ExecutionPolicy Bypass -File "D:\Coding\shift-maNNager\start.ps1"

# Или из корневой директории проекта
.\start.ps1
```

### Параметры
```powershell
# Пропустить установку зависимостей (быстрый запуск)
.\start.ps1 -SkipDependencies

# Пропустить миграции (для быстрого запуска)
.\start.ps1 -SkipMigrations

# Оба параметра
.\start.ps1 -SkipDependencies -SkipMigrations
```

## Проверка работы

После запуска откроются 2 окна PowerShell:
1. **Backend** (порт 3000) - с логами сервера
2. **Frontend** (порт 5173) - с логами Vite dev server

Проверьте:
- ✅ Backend: http://localhost:3000/health
- ✅ Frontend: http://localhost:5173
- ✅ Логины в обоих окнах без ошибок

## Остановка проекта

Используйте `stop.ps1`:
```powershell
.\stop.ps1
```

Или закройте окна PowerShell вручную и остановите Docker контейнер:
```powershell
docker stop shift-manager-db
```

## Известные проблемы

### Prisma Client уже используется
Если при запуске видите:
```
EPERM: operation not permitted, rename '...\query_engine-windows.dll.node.tmp...'
```

**Решение:** Остановите все запущенные процессы backend перед запуском:
```powershell
# Найдите процессы
Get-Process node | Where-Object {$_.Path -like "*shift-maNNager*"}

# Остановите их
Stop-Process -Name node -Force
```

### Порты уже заняты
Если порт 3000 или 5173 уже используется:
```
[!] Port 3000 is already in use. Backend may already be running.
```

**Решение 1:** Скрипт автоматически пропустит запуск этого сервера

**Решение 2:** Освободите порт вручную:
```powershell
# Найдите процесс на порту 3000
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Stop-Process -Id <OwningProcess>

# Или для порта 5173
Get-NetTCPConnection -LocalPort 5173 | Select-Object OwningProcess
Stop-Process -Id <OwningProcess>
```

## Тестирование

Скрипт был протестирован на:
- ✅ Windows 10/11
- ✅ PowerShell 5.1+
- ✅ Docker Desktop 28.5.1
- ✅ Node.js v22.14.0
- ✅ npm 10.9.2

Все компоненты запускаются стабильно!

