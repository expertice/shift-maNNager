# Архитектура фронт-приложения shift-Manager

## Обзор проекта

**shift-Manager** — это интерактивная многопользовательская система планирования смен и отпусков для Норильского никеля, разработанная на React 18 + Vite.

**Стек технологий:**
- React 18 с TypeScript
- Vite (сборка и dev-сервер)
- React Router v6 (навигация)
- Zustand (state management)
- TanStack Query (React Query) — синхронизация данных с API
- Socket.io (real-time обновления)
- dnd-kit (drag-and-drop для смен)
- React Hook Form + Zod (валидация форм)
- Vitest + React Testing Library (тестирование)
- Storybook (демонстрация компонентов)
- Tailwind CSS + CSS Modules (стилизация)
- axios (HTTP запросы)

## Структура папок проекта

```
shift-manager/
├── src/
│   ├── components/          # Переиспользуемые компоненты UI
│   │   ├── common/          # Базовые компоненты (Button, Input, Modal и т.д.)
│   │   ├── layouts/         # Макеты страниц (Header, Sidebar, Footer)
│   │   ├── forms/           # Компоненты форм
│   │   ├── tables/          # Таблицы и сетки
│   │   └── popovers/        # Всплывающие окна и tooltips
│   ├── pages/               # Страницы приложения
│   │   ├── SchedulesList/   # Список всех схем
│   │   ├── MainSchedule/    # Главная страница расписания
│   │   ├── VacationMode/    # Режим редактирования отпусков
│   │   ├── HistoryView/     # История версий
│   │   ├── PermissionsManager/ # Управление правами доступа
│   │   ├── ProfileConfigurator/ # Конфигуратор профилей смен
│   │   └── NotFound/        # Страница 404
│   ├── hooks/               # Custom React hooks
│   │   ├── useSchedule.ts
│   │   ├── useShifts.ts
│   │   ├── useVacations.ts
│   │   ├── useAPI.ts
│   │   ├── useRealtime.ts
│   │   ├── useLocalStorage.ts
│   │   └── useConflicts.ts
│   ├── services/            # Сервисы для работы с API и логикой
│   │   ├── api/
│   │   │   ├── schedulesAPI.ts
│   │   │   ├── shiftsAPI.ts
│   │   │   ├── vacationsAPI.ts
│   │   │   ├── employeesAPI.ts
│   │   │   ├── profilesAPI.ts
│   │   │   └── analyticsAPI.ts
│   │   ├── realtime/
│   │   │   └── socketService.ts
│   │   ├── offline/
│   │   │   └── offlineSync.ts
│   │   └── utils/
│   │       ├── dateHelpers.ts
│   │       ├── formatters.ts
│   │       ├── validators.ts
│   │       └── calculations.ts
│   ├── store/               # Zustand хранилище
│   │   ├── useAppStore.ts   # Главное хранилище
│   │   ├── useUIStore.ts    # UI состояние
│   │   ├── useAuthStore.ts  # Аутентификация
│   │   └── useScheduleStore.ts # Данные расписания
│   ├── types/               # TypeScript типы и интерфейсы
│   │   ├── index.ts
│   │   ├── api.ts
│   │   ├── schedule.ts
│   │   ├── employee.ts
│   │   ├── shift.ts
│   │   └── vacation.ts
│   ├── styles/              # Глобальные стили
│   │   ├── index.css
│   │   ├── colors.css
│   │   ├── typography.css
│   │   ├── theme.ts
│   │   └── colorScheme.ts
│   ├── mocks/               # MSW моки для разработки
│   │   ├── handlers.ts
│   │   ├── data.ts
│   │   └── server.ts
│   ├── tests/               # Примеры тестов
│   │   ├── __mocks__/
│   │   └── setup.ts
│   ├── App.tsx              # Главный компонент приложения
│   ├── main.tsx             # Точка входа
│   └── vite-env.d.ts        # Типы для Vite
├── stories/                 # Storybook stories
│   ├── Button.stories.tsx
│   ├── Modal.stories.tsx
│   └── ...
├── public/                  # Статические файлы
│   ├── logo.svg
│   └── favicon.svg
├── .github/
│   └── workflows/           # GitHub Actions CI/CD
│       ├── ci.yml
│       └── deploy.yml
├── docker/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .dockerignore
├── .env.example             # Пример переменных окружения
├── .env.development         # Переменные для разработки
├── .env.production          # Переменные для продакшена
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── .eslintrc.json
├── .prettierrc
├── README.md
└── DEVELOPMENT.md
```

## Маршруты приложения (Routes)

```typescript
/                              → SchedulesList (список схем)
/schedule/:scheduleId          → MainSchedule (главное расписание)
/schedule/:scheduleId/vacations → VacationMode (режим отпусков)
/schedule/:scheduleId/history  → HistoryView (история версий)
/schedule/:scheduleId/analytics → Analytics (аналитика)
/schedule/:scheduleId/users    → PermissionsManager (управление правами)
/schedule/:scheduleId/settings → ScheduleSettings (настройки схемы)
/login                         → LoginPage (вход)
/404                           → NotFound (страница не найдена)
```

## Состояние приложения (Zustand Stores)

### useAppStore.ts
Главное хранилище приложения:
```typescript
{
  currentSchedule: Schedule | null,
  schedules: Schedule[],
  employees: Employee[],
  shiftProfiles: ShiftProfile[],
  shifts: Shift[],
  vacations: Vacation[],
  conflicts: Conflict[],
  
  // Actions
  setCurrentSchedule,
  loadSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  syncWithAPI,
}
```

### useUIStore.ts
UI состояние:
```typescript
{
  sidebarOpen: boolean,
  sidebarPosition: 'left' | 'right',
  darkMode: boolean,
  selectedDateRange: { start: Date, end: Date },
  viewMode: 'monthly' | 'weekly' | 'yearly',
  selectedEmployeeIds: string[],
  
  // Actions
  toggleSidebar,
  setSidebarPosition,
  toggleDarkMode,
  setDateRange,
  setViewMode,
  selectEmployees,
}
```

### useAuthStore.ts
Аутентификация:
```typescript
{
  currentUser: User | null,
  isAuthenticated: boolean,
  userRole: 'owner' | 'editor' | 'viewer',
  
  // Actions
  login,
  logout,
  setCurrentUser,
  hasPermission,
}
```

### useScheduleStore.ts
Данные расписания:
```typescript
{
  scheduleData: ScheduleData,
  selectedShiftId: string | null,
  draggedShift: Shift | null,
  
  // Actions
  updateScheduleData,
  selectShift,
  startDragging,
  dropShift,
  cancelDrag,
}
```

## Компоненты (Components)

### Базовые компоненты (common/)
- **Button** — кнопка с разными вариантами
- **Input** — текстовое поле
- **Select** — выпадающий список
- **Checkbox** — флажок
- **Radio** — радиокнопка
- **Modal** — модальное окно
- **Card** — карточка контента
- **Badge** — значок статуса
- **Tooltip** — подсказка
- **Toast** — уведомление
- **Spinner** — загрузка
- **Tabs** — вкладки
- **Avatar** — аватар пользователя
- **Icon** — набор иконок

### Макеты (layouts/)
- **MainLayout** — основной макет со звбаром и сайдбаром
- **AuthLayout** — макет для страниц входа
- **Header** — заголовок с логотипом
- **Sidebar** — боковая панель с меню
- **Footer** — подвал

### Компоненты форм (forms/)
- **ProfileConfiguratorForm** — форма конфигурации профилей
- **EmployeeForm** — форма редактирования сотрудника
- **VacationForm** — форма отпуска
- **ScheduleFiltersForm** — форма фильтров

### Таблицы (tables/)
- **ShiftTable** — таблица смен (главная матрица)
- **EmployeeListTable** — таблица сотрудников
- **HistoryTable** — таблица истории изменений

### Всплывающие окна (popovers/)
- **ShiftDetailsPopover** — информация о смене
- **ConflictPopover** — информация о конфликте
- **AnalyticsPopover** — аналитика

## Custom Hooks

### useSchedule
Работа с расписанием:
```typescript
const { 
  schedule, 
  updateSchedule, 
  generateShifts, 
  isLoading 
} = useSchedule(scheduleId);
```

### useShifts
Работа со сменами:
```typescript
const { 
  shifts, 
  createShift, 
  updateShift, 
  deleteShift, 
  swapShifts,
  cloneShift 
} = useShifts(scheduleId);
```

### useVacations
Работа с отпусками:
```typescript
const { 
  vacations, 
  addVacation, 
  removeVacation, 
  getAvailableDays 
} = useVacations(scheduleId, employeeId);
```

### useAPI
Базовая работа с API:
```typescript
const { 
  data, 
  isLoading, 
  error, 
  refetch 
} = useAPI('/api/v1/schedules', options);
```

### useRealtime
Real-time обновления через WebSocket:
```typescript
const { 
  connect, 
  disconnect, 
  emit, 
  on 
} = useRealtime(scheduleId);
```

### useLocalStorage
Персистентность данных:
```typescript
const [value, setValue] = useLocalStorage('key', defaultValue);
```

### useConflicts
Управление конфликтами:
```typescript
const { 
  conflicts, 
  resolveConflict, 
  getSolutions 
} = useConflicts(scheduleId);
```

## API Сервисы

Все API запросы через функции в `services/api/`:

```typescript
// schedulesAPI.ts
export const schedulesAPI = {
  getAll: () => api.get('/schedules'),
  getById: (id) => api.get(`/schedules/${id}`),
  create: (data) => api.post('/schedules', data),
  update: (id, data) => api.put(`/schedules/${id}`, data),
  delete: (id) => api.delete(`/schedules/${id}`),
  duplicate: (id) => api.post(`/schedules/${id}/duplicate`),
};

// shiftsAPI.ts
export const shiftsAPI = {
  getBySchedule: (scheduleId) => api.get(`/schedules/${scheduleId}/shifts`),
  create: (data) => api.post('/shifts', data),
  update: (id, data) => api.put(`/shifts/${id}`, data),
  delete: (id) => api.delete(`/shifts/${id}`),
  swap: (shift1Id, shift2Id) => api.post('/shifts/swap', { shift1Id, shift2Id }),
  bulkCreate: (shifts) => api.post('/shifts/bulk', shifts),
};
```

## Использование React Query (TanStack Query)

```typescript
// В компонентах
const { data: schedules, isLoading, error } = useQuery({
  queryKey: ['schedules'],
  queryFn: () => schedulesAPI.getAll(),
  staleTime: 1000 * 60 * 5, // 5 минут
});

const createMutation = useMutation({
  mutationFn: (data) => schedulesAPI.create(data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schedules'] }),
});
```

## Валидация форм (React Hook Form + Zod)

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  name: z.string().min(1, 'Название обязательно'),
  email: z.string().email('Некорректный email'),
});

export function ScheduleForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <span>{errors.name.message}</span>}
    </form>
  );
}
```

## Тестирование (Vitest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from '@/components/common/Button';

describe('Button Component', () => {
  it('должен отображать текст кнопки', () => {
    render(<Button>Клик</Button>);
    expect(screen.getByText('Клик')).toBeInTheDocument();
  });

  it('должен вызывать onClick при клике', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Клик</Button>);
    
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

## Стилизация

**Комбинированный подход:**
- **Tailwind CSS** — для быстрого создания компонентов UI
- **CSS Modules** — для локальных, не конфликтующих стилей сложных компонентов
- **Темизация** — через CSS переменные для поддержки light/dark mode

```typescript
// Button.module.css
.button {
  padding: var(--spacing-2) var(--spacing-4);
  background-color: var(--color-primary);
  border-radius: var(--radius-md);
}

.button.dark {
  background-color: var(--color-primary-dark);
}
```

## Drag-and-Drop с dnd-kit

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { Droppable, Draggable } from '@dnd-kit/core';

<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  {shifts.map(shift => (
    <Draggable key={shift.id} id={shift.id}>
      <ShiftCell shift={shift} />
    </Draggable>
  ))}
</DndContext>
```

## Offline Mode

При отсутствии интернета:
1. Данные сохраняются в IndexedDB
2. Изменения кэшируются локально
3. При восстановлении соединения — синхронизация с сервером
4. Использование последней версии при merge-конфликтах (LWW)

## Performance Оптимизация

1. **Виртуализация таблицы** с react-window для больших матриц смен
2. **Lazy loading** страниц через React Router
3. **Code splitting** по маршрутам
4. **Кэширование** API запросов через React Query
5. **Мемоизация** компонентов через React.memo
6. **Оптимизация re-renders** через Zustand selectors

## Доступность (a11y)

- ARIA атрибуты для всех интерактивных элементов
- Клавиатурная навигация (Tab, Enter, Escape)
- Скрин-ридер поддержка
- Цветовой контраст согласно WCAG

## Версионирование и развёртывание

- **Версия:** 0.1.0 (alpha)
- **Окружения:** development, staging, production
- **CI/CD:** GitHub Actions (линтинг, тестирование, build)
- **Деплой:** Docker контейнер на собственный сервер или облако

---

**Это полная архитектура фронта shift-Manager. Готовы начинать разработку!** 🚀
