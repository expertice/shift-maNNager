# Developer Guide — Руководство разработчика shift-Manager

## 📖 Содержание

1. [Установка окружения](#установка-окружения)
2. [Архитектура приложения](#архитектура-приложения)
3. [Компоненты](#компоненты)
4. [Hooks](#hooks)
5. [State Management](#state-management)
6. [API Integration](#api-integration)
7. [Real-time & WebSocket](#real-time--websocket)
8. [Offline Mode](#offline-mode)
9. [Тестирование](#тестирование)
10. [Performance](#performance)
11. [Common Patterns](#common-patterns)
12. [Troubleshooting](#troubleshooting)

---

## Установка окружения

### 1. Клонирование и зависимости

```bash
git clone https://github.com/expertice/shift-manager.git
cd shift-manager
npm install
```

### 2. Переменные окружения

Создайте `.env.development`:

```env
# API
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000

# App
VITE_APP_NAME=shift-Manager
VITE_APP_VERSION=0.1.0

# Feature flags
VITE_ENABLE_OFFLINE_MODE=true
VITE_ENABLE_ANALYTICS=true
```

### 3. Запуск

```bash
npm run dev           # Запуск dev сервера
npm run lint          # ESLint проверка
npm run type-check    # TypeScript проверка
npm run test          # Запуск тестов
npm run storybook     # Запуск Storybook
```

---

## Архитектура приложения

### Главные слои

```
┌─────────────────────────────────────┐
│         UI Components               │ ← React компоненты
├─────────────────────────────────────┤
│      State Management (Zustand)     │ ← Global state
├─────────────────────────────────────┤
│    API Services + React Query       │ ← Data fetching & caching
├─────────────────────────────────────┤
│      Real-time (Socket.io)          │ ← WebSocket connection
├─────────────────────────────────────┤
│      Backend API (REST/HTTP)        │ ← External API
└─────────────────────────────────────┘
```

### Папки и их ответственность

| Папка | Содержит | Назначение |
|-------|----------|-----------|
| `components/` | UI компоненты | Переиспользуемые React компоненты |
| `pages/` | Страницы приложения | Главные маршруты (SchedulesList, MainSchedule и т.д.) |
| `hooks/` | Custom React hooks | Логика для компонентов (useSchedule, useShifts и т.д.) |
| `services/api/` | API сервисы | Функции для API запросов |
| `services/realtime/` | Socket.io | Real-time обновления |
| `services/utils/` | Утилиты | Форматирование, валидация, расчёты |
| `store/` | Zustand хранилища | Global state management |
| `types/` | TypeScript типы | Интерфейсы и типы данных |
| `styles/` | Стили | CSS переменные, темы, глобальные стили |
| `mocks/` | MSW моки | Моки для разработки без бэка |
| `tests/` | Тесты | Unit и integration тесты |

---

## Компоненты

### Создание компонента

```typescript
// components/common/Button.tsx
import React, { FC, ReactNode } from 'react';
import styles from './Button.module.css';

/**
 * Компонент кнопки
 * @param label - Текст кнопки
 * @param onClick - Обработчик клика
 * @param variant - Стиль кнопки ('primary' | 'secondary' | 'danger')
 * @param disabled - Отключить кнопку
 */
interface ButtonProps {
  label: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  className?: string;
}

export const Button: FC<ButtonProps> = ({
  label,
  onClick,
  variant = 'primary',
  disabled = false,
  className = '',
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
};

export default Button;
```

### Структура папки компонента

```
components/common/Button/
├── Button.tsx          # Основной компонент
├── Button.module.css   # Стили
├── Button.test.tsx     # Тесты
└── Button.stories.tsx  # Storybook stories
```

### Типирование пропсов

```typescript
interface ComponentProps {
  // Required пропсы
  id: string;
  name: string;
  
  // Optional пропсы
  description?: string;
  tags?: string[];
  
  // Обработчики событий
  onChange?: (value: any) => void;
  onSubmit?: (data: FormData) => Promise<void>;
  
  // React специфичные пропсы
  children?: ReactNode;
  className?: string;
}
```

### Использование в других компонентах

```typescript
import { Button } from '@components/common/Button';

export function MyComponent() {
  const handleClick = () => console.log('Clicked!');

  return (
    <Button
      label="Submit"
      variant="primary"
      onClick={handleClick}
    />
  );
}
```

---

## Hooks

### Custom Hooks для работы с расписанием

#### useSchedule
```typescript
// hooks/useSchedule.ts
const { 
  schedule, 
  isLoading, 
  error, 
  updateSchedule, 
  deleteSchedule,
  publishSchedule 
} = useSchedule(scheduleId);
```

#### useShifts
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

#### useVacations
```typescript
const { 
  vacations,
  addVacation,
  removeVacation,
  getAvailableDays,
  validateVacation
} = useVacations(scheduleId, employeeId);
```

### Пример создания custom hook

```typescript
// hooks/useMyData.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import { myAPI } from '@services/api';

/**
 * Hook для загрузки и управления данными
 */
export function useMyData(id: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['myData', id],
    queryFn: () => myAPI.getById(id),
    staleTime: 1000 * 60 * 5, // 5 минут
  });

  const updateMutation = useMutation({
    mutationFn: (newData) => myAPI.update(id, newData),
    onSuccess: () => {
      // Инвалидировать кэш после успешного обновления
      queryClient.invalidateQueries({ queryKey: ['myData', id] });
    },
  });

  return {
    data,
    isLoading,
    error,
    updateData: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
  };
}
```

---

## State Management

### Zustand Stores

#### useAppStore (главное хранилище)

```typescript
// store/useAppStore.ts
import { create } from 'zustand';

interface AppState {
  currentSchedule: Schedule | null;
  schedules: Schedule[];
  
  // Actions
  setCurrentSchedule: (schedule: Schedule) => void;
  loadSchedules: () => Promise<void>;
  createSchedule: (data: any) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentSchedule: null,
  schedules: [],
  
  setCurrentSchedule: (schedule) => set({ currentSchedule: schedule }),
  
  loadSchedules: async () => {
    const schedules = await schedulesAPI.getAll();
    set({ schedules });
  },
  
  createSchedule: async (data) => {
    const newSchedule = await schedulesAPI.create(data);
    set((state) => ({
      schedules: [...state.schedules, newSchedule],
    }));
  },
}));
```

#### useUIStore (UI состояние)

```typescript
interface UIState {
  sidebarOpen: boolean;
  sidebarPosition: 'left' | 'right';
  darkMode: boolean;
  
  toggleSidebar: () => void;
  setSidebarPosition: (position: 'left' | 'right') => void;
  toggleDarkMode: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  sidebarPosition: 'left',
  darkMode: false,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarPosition: (position) => set({ sidebarPosition: position }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
}));
```

### Использование в компонентах

```typescript
import { useAppStore } from '@store/useAppStore';

export function MyComponent() {
  // Выбрать конкретное значение из store
  const schedules = useAppStore((state) => state.schedules);
  const loadSchedules = useAppStore((state) => state.loadSchedules);

  React.useEffect(() => {
    loadSchedules();
  }, []);

  return (
    <div>
      {schedules.map((schedule) => (
        <div key={schedule.id}>{schedule.name}</div>
      ))}
    </div>
  );
}
```

---

## API Integration

### API сервисы

```typescript
// services/api/schedulesAPI.ts
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL;

export const schedulesAPI = {
  /**
   * Получить все расписания
   */
  getAll: async () => {
    const { data } = await axios.get(`${API_BASE}/schedules`);
    return data.data;
  },

  /**
   * Получить расписание по ID
   */
  getById: async (id: string) => {
    const { data } = await axios.get(`${API_BASE}/schedules/${id}`);
    return data.data;
  },

  /**
   * Создать новое расписание
   */
  create: async (payload: any) => {
    const { data } = await axios.post(`${API_BASE}/schedules`, payload);
    return data.data;
  },

  /**
   * Обновить расписание
   */
  update: async (id: string, payload: any) => {
    const { data } = await axios.put(
      `${API_BASE}/schedules/${id}`,
      payload
    );
    return data.data;
  },

  /**
   * Удалить расписание
   */
  delete: async (id: string) => {
    await axios.delete(`${API_BASE}/schedules/${id}`);
  },
};
```

### Использование с React Query

```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { schedulesAPI } from '@services/api/schedulesAPI';

export function SchedulesList() {
  // Получить все расписания
  const { data: schedules, isLoading, error } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesAPI.getAll(),
  });

  // Создать новое расписание
  const createMutation = useMutation({
    mutationFn: (newSchedule) => schedulesAPI.create(newSchedule),
    onSuccess: () => {
      // Обновить кэш после успешного создания
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error) => {
      console.error('Error creating schedule:', error);
    },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {schedules?.map((schedule) => (
        <div key={schedule.id}>{schedule.name}</div>
      ))}
      <button onClick={() => createMutation.mutate({ name: 'New' })}>
        Create
      </button>
    </div>
  );
}
```

---

## Real-time & WebSocket

### Socket.io интеграция

```typescript
// services/realtime/socketService.ts
import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(scheduleId: string) {
    this.socket = io(import.meta.env.VITE_WS_URL, {
      auth: {
        token: localStorage.getItem('token'),
        scheduleId,
      },
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket');
    });
  }

  // Слушать события
  onShiftUpdated(callback: (data: any) => void) {
    this.socket?.on('shift:updated', callback);
  }

  onVacationAdded(callback: (data: any) => void) {
    this.socket?.on('vacation:added', callback);
  }

  // Отправить событие
  emitShiftUpdate(data: any) {
    this.socket?.emit('shift:update', data);
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export const socketService = new SocketService();
```

### Использование в компоненте

```typescript
import { useEffect } from 'react';
import { socketService } from '@services/realtime/socketService';
import { useAppStore } from '@store/useAppStore';

export function MainSchedule() {
  const updateShifts = useAppStore((state) => state.updateShifts);

  useEffect(() => {
    socketService.connect(scheduleId);

    socketService.onShiftUpdated((data) => {
      updateShifts(data);
    });

    return () => socketService.disconnect();
  }, [scheduleId]);

  return <div>Schedule</div>;
}
```

---

## Offline Mode

### IndexedDB для локального хранилища

```typescript
// services/offline/offlineDB.ts
import Dexie, { Table } from 'dexie';

class OfflineDB extends Dexie {
  shifts!: Table<Shift>;
  vacations!: Table<Vacation>;
  syncQueue!: Table<SyncOperation>;

  constructor() {
    super('ShiftManagerDB');
    this.version(1).stores({
      shifts: '++id, scheduleId, employeeId, date',
      vacations: '++id, employeeId',
      syncQueue: '++id, status, timestamp',
    });
  }
}

export const db = new OfflineDB();
```

### Синхронизация при восстановлении соединения

```typescript
// services/offline/offlineSync.ts
export async function syncOfflineChanges() {
  const operations = await db.syncQueue.toArray();

  for (const op of operations) {
    try {
      if (op.type === 'create') {
        await API.create(op.data);
      } else if (op.type === 'update') {
        await API.update(op.id, op.data);
      } else if (op.type === 'delete') {
        await API.delete(op.id);
      }

      // Удалить из очереди после успешной синхронизации
      await db.syncQueue.delete(op.id);
    } catch (error) {
      console.error('Sync error:', error);
    }
  }
}

// Слушать восстановление соединения
window.addEventListener('online', syncOfflineChanges);
```

---

## Тестирование

### Unit тесты с Vitest

```typescript
// components/Button.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button Component', () => {
  it('должен отображать текст кнопки', () => {
    render(<Button label="Click me" />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('должен вызывать onClick при клике', async () => {
    const handleClick = vi.fn();
    render(<Button label="Click" onClick={handleClick} />);

    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it('должен быть отключен при disabled=true', () => {
    render(<Button label="Click" disabled />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Integration тесты

```typescript
// hooks/__tests__/useSchedule.test.tsx
import { renderHook, waitFor } from '@testing-library/react';
import { useSchedule } from '../useSchedule';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const wrapper = ({ children }: any) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('useSchedule', () => {
  it('должен загружать расписание', async () => {
    const { result } = renderHook(() => useSchedule('schedule-id'), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.schedule).toBeDefined();
  });
});
```

---

## Performance

### React.memo для оптимизации рендеринга

```typescript
const ShiftCell = React.memo(
  ({ shift }: { shift: Shift }) => {
    return <div>{shift.shiftType?.name}</div>;
  },
  (prevProps, nextProps) => {
    return prevProps.shift.id === nextProps.shift.id;
  }
);
```

### Виртуализация больших таблиц

```typescript
import { FixedSizeList as List } from 'react-window';

export function LargeShiftTable({ shifts }: { shifts: Shift[] }) {
  const Row = ({ index, style }: any) => (
    <div style={style}>
      {shifts[index].shiftType?.name}
    </div>
  );

  return (
    <List
      height={600}
      itemCount={shifts.length}
      itemSize={35}
      width="100%"
    >
      {Row}
    </List>
  );
}
```

### Ленивая загрузка страниц

```typescript
import { lazy, Suspense } from 'react';

const MainSchedule = lazy(() => import('@pages/MainSchedule'));

export function Routes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MainSchedule />
    </Suspense>
  );
}
```

---

## Common Patterns

### Обработка асинхронных операций

```typescript
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (data: any) => {
  setIsLoading(true);
  setError(null);
  
  try {
    await api.create(data);
    // Успех
  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};
```

### Форма с валидацией

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1, 'Требуется'),
  email: z.string().email(),
});

export function MyForm() {
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

---

## Troubleshooting

### Hot Module Replacement не работает

**Решение:** Перезагрузите сервер разработки
```bash
npm run dev
```

### Ошибка "Cannot find module"

**Решение:** Проверьте пути импортов в `vite.config.ts`
```typescript
alias: {
  '@': path.resolve(__dirname, './src'),
}
```

### Тесты не проходят

**Решение:** Очистите кэш Vitest
```bash
npm run test -- --clearCache
```

### CORS ошибка при API запросе

**Решение:** Используйте прокси в `vite.config.ts`
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
    },
  },
}
```

---

**Удачи в разработке!** 🚀
