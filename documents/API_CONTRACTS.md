# API Контракты для shift-Manager

## Базовая информация

**Base URL:** `http://localhost:3000/api/v1`
**Аутентификация:** Bearer Token в заголовке `Authorization`
**Формат данных:** JSON
**Content-Type:** `application/json`

---

## Расписания (Schedules)

### GET /schedules
Получить список всех схем, доступных текущему пользователю

**Query Parameters:**
- `page`: number - номер страницы (default: 1)
- `pageSize`: number - размер страницы (default: 20)
- `status`: enum - фильтр по статусу (draft|published|completed|archived)

**Response:** 
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "ownerUserId": "uuid",
        "name": "Расписание на декабрь 2024",
        "startDate": "2024-12-01",
        "endDate": "2024-12-31",
        "status": "draft",
        "createdAt": "2024-11-01T10:00:00Z",
        "updatedAt": "2024-11-01T10:00:00Z"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

---

### GET /schedules/:id
Получить расписание со всеми деталями

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ownerUserId": "uuid",
    "name": "Расписание на декабрь 2024",
    "startDate": "2024-12-01",
    "endDate": "2024-12-31",
    "status": "draft",
    "createdAt": "2024-11-01T10:00:00Z",
    "updatedAt": "2024-11-01T10:00:00Z",
    "permissions": [
      {
        "id": "uuid",
        "scheduleId": "uuid",
        "userId": "uuid",
        "role": "editor",
        "createdAt": "2024-11-01T10:00:00Z"
      }
    ],
    "departments": [...],
    "employees": [...],
    "shifts": [...],
    "vacations": [...]
  }
}
```

---

### POST /schedules
Создать новое расписание

**Request Body:**
```json
{
  "name": "Расписание на декабрь 2024",
  "startDate": "2024-12-01",
  "endDate": "2024-12-31"
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "ownerUserId": "uuid",
    "name": "Расписание на декабрь 2024",
    "startDate": "2024-12-01",
    "endDate": "2024-12-31",
    "status": "draft",
    "createdAt": "2024-11-01T10:00:00Z",
    "updatedAt": "2024-11-01T10:00:00Z"
  }
}
```

---

### PUT /schedules/:id
Обновить расписание

**Request Body:**
```json
{
  "name": "Новое название",
  "status": "published",
  "endDate": "2024-12-31"
}
```

**Response:** 200 OK

---

### DELETE /schedules/:id
Удалить расписание

**Response:** 204 No Content

---

### POST /schedules/:id/duplicate
Создать копию расписания

**Request Body:**
```json
{
  "newName": "Копия - Расписание на декабрь 2024"
}
```

**Response:** 201 Created

---

## Сотрудники (Employees)

### GET /schedules/:scheduleId/employees
Получить список сотрудников схемы

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "departmentId": "uuid",
      "fullName": "Иван Петров",
      "tabNumber": "12345",
      "birthDate": "1990-05-15",
      "loginId": "12345",
      "passwordHash": "hash...",
      "passwordExpiry": "2024-11-02T10:00:00Z",
      "createdAt": "2024-11-01T10:00:00Z"
    }
  ]
}
```

---

### POST /schedules/:scheduleId/employees
Добавить сотрудника

**Request Body:**
```json
{
  "fullName": "Иван Петров",
  "tabNumber": "12345",
  "birthDate": "1990-05-15",
  "departmentId": "uuid"
}
```

**Response:** 201 Created

---

### PUT /schedules/:scheduleId/employees/:id
Обновить данные сотрудника

**Request Body:**
```json
{
  "fullName": "Иван Сергеевич Петров",
  "birthDate": "1990-05-15",
  "departmentId": "uuid"
}
```

---

### DELETE /schedules/:scheduleId/employees/:id
Удалить сотрудника из схемы

**Response:** 204 No Content

---

### POST /schedules/:scheduleId/employees/:id/generate-password
Сгенерировать одноразовый пароль

**Response:**
```json
{
  "success": true,
  "data": {
    "temporaryPassword": "ABC123",
    "expiresAt": "2024-11-02T10:00:00Z",
    "loginId": "12345"
  }
}
```

---

## Смены (Shifts)

### GET /schedules/:scheduleId/shifts
Получить смены для схемы

**Query Parameters:**
- `startDate`: date - начало диапазона
- `endDate`: date - конец диапазона
- `employeeId`: uuid - фильтр по сотруднику

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "employeeId": "uuid",
      "date": "2024-12-01",
      "shiftTypeId": "uuid",
      "status": "scheduled",
      "modifiedReason": null,
      "createdAt": "2024-11-01T10:00:00Z",
      "updatedAt": "2024-11-01T10:00:00Z"
    }
  ]
}
```

---

### POST /schedules/:scheduleId/shifts
Создать новую смену

**Request Body:**
```json
{
  "employeeId": "uuid",
  "date": "2024-12-01",
  "shiftTypeId": "uuid"
}
```

**Response:** 201 Created

---

### PUT /schedules/:scheduleId/shifts/:id
Обновить смену

**Request Body:**
```json
{
  "shiftTypeId": "uuid",
  "status": "modified",
  "modifiedReason": "Перемещение по просьбе сотрудника"
}
```

---

### POST /schedules/:scheduleId/shifts/bulk
Массовое создание смен (при генерации)

**Request Body:**
```json
{
  "shifts": [
    {
      "employeeId": "uuid",
      "date": "2024-12-01",
      "shiftTypeId": "uuid"
    },
    {
      "employeeId": "uuid",
      "date": "2024-12-02",
      "shiftTypeId": "uuid"
    }
  ]
}
```

---

### POST /schedules/:scheduleId/shifts/swap
Обменять две смены

**Request Body:**
```json
{
  "shift1Id": "uuid",
  "shift2Id": "uuid"
}
```

---

### DELETE /schedules/:scheduleId/shifts/:id
Удалить смену

**Response:** 204 No Content

---

## Отпуска (Vacations)

### GET /schedules/:scheduleId/vacations
Получить отпуска для схемы

**Query Parameters:**
- `employeeId`: uuid - фильтр по сотруднику
- `status`: enum - фильтр по статусу

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "employeeId": "uuid",
      "startDate": "2024-12-01",
      "endDate": "2024-12-14",
      "status": "approved",
      "createdBy": "uuid",
      "createdAt": "2024-11-01T10:00:00Z",
      "updatedAt": "2024-11-01T10:00:00Z"
    }
  ]
}
```

---

### POST /schedules/:scheduleId/vacations
Добавить отпуск

**Request Body:**
```json
{
  "employeeId": "uuid",
  "startDate": "2024-12-01",
  "endDate": "2024-12-14",
  "status": "approved"
}
```

**Response:** 201 Created

---

### PUT /schedules/:scheduleId/vacations/:id
Обновить отпуск

**Request Body:**
```json
{
  "startDate": "2024-12-01",
  "endDate": "2024-12-21",
  "status": "approved"
}
```

---

### DELETE /schedules/:scheduleId/vacations/:id
Удалить отпуск

**Response:** 204 No Content

---

## Профили смен (Shift Profiles)

### GET /shift-profiles
Получить все профили смен (глобальные)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "2/2",
      "cycleLength": 4,
      "minEmployees": 4,
      "description": "2 дня работа, 2 дня отдых",
      "shiftTypes": [
        {
          "id": "uuid",
          "shiftProfileId": "uuid",
          "name": "День",
          "startTime": "09:00",
          "endTime": "21:00",
          "breaks": [
            {
              "startTime": "13:00",
              "endTime": "13:30",
              "duration": 30
            }
          ],
          "nightHoursCount": 0,
          "workingHours": 11
        }
      ],
      "patterns": [
        {
          "id": "uuid",
          "patternNumber": 1,
          "cycleLength": 4,
          "sequence": ["day_shift_id", "night_shift_id", null, null]
        }
      ]
    }
  ]
}
```

---

## Конфликты (Conflicts)

### GET /schedules/:scheduleId/conflicts
Получить конфликты схемы

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "dailyShiftId": "uuid",
      "vacationId": "uuid",
      "conflictType": "shift_vs_vacation",
      "resolved": false,
      "resolutionNotes": null,
      "createdAt": "2024-11-01T10:00:00Z"
    }
  ]
}
```

---

### POST /schedules/:scheduleId/conflicts/:id/resolve
Разрешить конфликт

**Request Body:**
```json
{
  "solutionId": "uuid",
  "resolutionNotes": "Перемещено на 2024-12-02"
}
```

---

## Аналитика (Analytics)

### GET /schedules/:scheduleId/analytics
Получить аналитику расписания

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduleId": "uuid",
    "totalHours": 800,
    "totalNightHours": 200,
    "averageHoursPerEmployee": 100,
    "coveragePercentage": 95.5,
    "employeeHoursMap": {
      "employee_uuid_1": 100,
      "employee_uuid_2": 100
    },
    "conflictCount": 2
  }
}
```

---

## История (History)

### GET /schedules/:scheduleId/history
Получить историю изменений

**Query Parameters:**
- `limit`: number - максимальное количество (default: 50)
- `offset`: number - смещение (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "userId": "uuid",
      "tableName": "shifts",
      "recordId": "uuid",
      "changeType": "create",
      "oldValue": null,
      "newValue": {
        "employeeId": "uuid",
        "date": "2024-12-01",
        "shiftTypeId": "uuid"
      },
      "reason": "Создание смены вручную",
      "createdAt": "2024-11-01T10:00:00Z",
      "version": 1
    }
  ]
}
```

---

## Управление правами (Permissions)

### GET /schedules/:scheduleId/permissions
Получить список пользователей с доступом

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "scheduleId": "uuid",
      "userId": "uuid",
      "role": "editor",
      "createdAt": "2024-11-01T10:00:00Z"
    }
  ]
}
```

---

### POST /schedules/:scheduleId/permissions
Добавить пользователя с доступом

**Request Body:**
```json
{
  "userId": "uuid",
  "role": "editor"
}
```

---

### PUT /schedules/:scheduleId/permissions/:id
Изменить роль пользователя

**Request Body:**
```json
{
  "role": "viewer"
}
```

---

### DELETE /schedules/:scheduleId/permissions/:id
Удалить доступ пользователя

**Response:** 204 No Content

---

## Обработка ошибок

Все ошибки возвращаются с соответствующим HTTP статусом:

```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Ошибка валидации",
  "details": {
    "name": "Название обязательно"
  }
}
```

**Возможные коды ошибок:**
- `400` - Bad Request (валидация, неправильные данные)
- `401` - Unauthorized (не авторизирован)
- `403` - Forbidden (нет доступа)
- `404` - Not Found (ресурс не найден)
- `409` - Conflict (конфликт данных)
- `500` - Internal Server Error (ошибка сервера)

---

## Пагинация

Все методы GET с данными поддерживают пагинацию:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

---

## Rate Limiting

API использует rate limiting:
- Общие endpoints: 10 req/s
- API endpoints: 30 req/s

В ответах включены заголовки:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
