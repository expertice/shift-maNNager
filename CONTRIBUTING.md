# Contributing to Shift Manager

Спасибо за интерес к участию в проекте! Этот документ содержит руководство по внесению вклада в проект.

## 📋 Содержание

- [Code of Conduct](#code-of-conduct)
- [Как начать](#как-начать)
- [Процесс разработки](#процесс-разработки)
- [Стиль кода](#стиль-кода)
- [Коммиты](#коммиты)
- [Pull Requests](#pull-requests)
- [Тестирование](#тестирование)

## Code of Conduct

Участвуя в проекте, вы соглашаетесь соблюдать профессиональные стандарты поведения и уважать других участников.

## Как начать

### 1. Настройка окружения

```bash
# Клонирование репозитория
git clone https://github.com/expertice/shift-maNNager.git
cd shift-maNNager

# Установка зависимостей
npm install
cd server && npm install && cd ..

# Настройка БД
docker-compose up -d
cd server
npx prisma migrate dev
npx prisma db seed
```

### 2. Проверка, что всё работает

```bash
# Backend
cd server
npm run dev

# Frontend (в другом терминале)
npm run dev
```

Откройте `http://localhost:5173` и убедитесь, что приложение работает.

## Процесс разработки

### 1. Создание Issue

Перед началом работы создайте issue или выберите существующий:
- Опишите проблему или функцию
- Укажите предполагаемое решение
- Добавьте соответствующие labels

### 2. Создание ветки

```bash
# Создайте ветку от develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Или для багфикса
git checkout -b fix/bug-description
```

**Naming conventions для веток:**
- `feature/*` - новая функциональность
- `fix/*` - исправление бага
- `docs/*` - изменения в документации
- `refactor/*` - рефакторинг кода
- `test/*` - добавление тестов
- `chore/*` - обновление зависимостей, конфигурации

### 3. Разработка

Следуйте [стилю кода](#стиль-кода) и пишите тесты для новой функциональности.

### 4. Коммиты

Делайте атомарные коммиты с понятными сообщениями:

```bash
git add .
git commit -m "feat: добавлена функция экспорта в Excel"
```

См. [Формат коммитов](#формат-коммитов) ниже.

### 5. Проверка перед push

```bash
# Lint
npm run lint
cd server && npm run lint && cd ..

# Type check
npx tsc --noEmit
cd server && npx tsc --noEmit && cd ..

# Tests
npm run test
cd server && npm run test && cd ..
```

### 6. Push и Pull Request

```bash
git push origin feature/your-feature-name
```

Затем создайте Pull Request на GitHub.

## Стиль кода

### TypeScript

- Используйте TypeScript strict mode
- Избегайте `any`, используйте конкретные типы
- Предпочитайте `interface` для объектов, `type` для unions/intersections
- Используйте функциональный стиль где возможно

**Хорошо:**
```typescript
interface User {
  id: number;
  name: string;
  email: string;
}

const getUser = async (id: number): Promise<User> => {
  // implementation
}
```

**Плохо:**
```typescript
const getUser = async (id: any): Promise<any> => {
  // implementation
}
```

### React

- Используйте функциональные компоненты с hooks
- Извлекайте логику в custom hooks
- Избегайте inline стилей, используйте Tailwind классы
- Мемоизируйте тяжелые вычисления с `useMemo`
- Мемоизируйте колбэки с `useCallback`

**Хорошо:**
```tsx
interface Props {
  userId: number;
  onUpdate: (user: User) => void;
}

export const UserProfile: React.FC<Props> = ({ userId, onUpdate }) => {
  const { data: user, isLoading } = useQuery(['user', userId], () => fetchUser(userId));
  
  const handleSubmit = useCallback((data: UserFormData) => {
    // handle submit
  }, [userId]);
  
  if (isLoading) return <Spinner />;
  
  return (
    <div className="p-4 bg-white rounded-lg">
      {/* content */}
    </div>
  );
}
```

### Именование

- **Компоненты**: PascalCase (`UserProfile.tsx`)
- **Hooks**: camelCase с префиксом `use` (`useAuth.ts`)
- **Утилиты**: camelCase (`formatDate.ts`)
- **Константы**: UPPER_SNAKE_CASE (`MAX_RETRY_COUNT`)
- **Типы/Интерфейсы**: PascalCase (`UserProfile`, `ApiResponse`)

### Форматирование

Используется Prettier для автоматического форматирования:

```bash
npm run format
```

### Линтинг

Используется ESLint для проверки кода:

```bash
npm run lint
npm run lint:fix  # автоматическое исправление
```

## Коммиты

### Формат коммитов

Используем [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type:**
- `feat` - новая функция
- `fix` - исправление бага
- `docs` - изменения в документации
- `style` - форматирование, пропущенные точки с запятой и т.д.
- `refactor` - рефакторинг кода
- `test` - добавление или изменение тестов
- `chore` - обновление зависимостей, конфигурации
- `perf` - улучшение производительности
- `ci` - изменения в CI/CD конфигурации

**Scope** (опционально):
- `backend` - изменения в backend
- `frontend` - изменения в frontend
- `api` - изменения в API
- `db` - изменения в БД
- `ui` - изменения в UI компонентах

**Примеры:**

```bash
# Новая функция
git commit -m "feat(frontend): добавлен компонент для экспорта в Excel"

# Исправление бага
git commit -m "fix(backend): исправлена ошибка валидации дат в scheduleService"

# Документация
git commit -m "docs: обновлена документация API для endpoints расписаний"

# Рефакторинг
git commit -m "refactor(frontend): переписан хук useRealtime с использованием useSyncExternalStore"

# Breaking change
git commit -m "feat(api)!: изменен формат ответа API для /schedules

BREAKING CHANGE: поле 'employees' теперь возвращает только id, полные данные в 'employeeDetails'"
```

## Pull Requests

### Создание PR

1. **Заголовок**: краткое описание изменений
2. **Описание**: подробное объяснение что и почему изменено
3. **Связанные Issues**: укажите номера issue (`Closes #123`)
4. **Скриншоты**: добавьте скриншоты для UI изменений
5. **Чеклист**: используйте template PR

### Checklist для PR

- [ ] Код следует стилю проекта
- [ ] Выполнен self-review кода
- [ ] Код прокомментирован в сложных местах
- [ ] Документация обновлена
- [ ] Не добавлено предупреждений линтера
- [ ] Добавлены тесты для новой функциональности
- [ ] Все тесты проходят локально
- [ ] Зависимые изменения были смержены
- [ ] CI/CD pipeline проходит успешно

### Code Review

- Будьте уважительны и конструктивны
- Объясняйте "почему", а не только "что"
- Предлагайте альтернативы
- Одобряйте хорошие решения

## Тестирование

### Unit тесты

Пишите тесты для:
- Утилит и helper функций
- Сложной бизнес-логики
- Критичных компонентов

```typescript
// Пример теста
describe('formatDate', () => {
  it('должен форматировать дату в формат DD.MM.YYYY', () => {
    const date = new Date('2025-11-05');
    expect(formatDate(date)).toBe('05.11.2025');
  });
  
  it('должен обрабатывать null', () => {
    expect(formatDate(null)).toBe('');
  });
});
```

### Запуск тестов

```bash
# Frontend
npm run test
npm run test:watch
npm run test:coverage

# Backend
cd server
npm run test
npm run test:watch
npm run test:coverage
```

### Покрытие тестами

Стремитесь к покрытию:
- **Утилиты**: > 90%
- **Сервисы**: > 80%
- **Компоненты**: > 70%

## Структура проекта

### Backend

```
server/src/
├── controllers/    # API контроллеры
├── services/       # Бизнес-логика
├── routes/         # Express маршруты
├── middleware/     # Middleware (auth, errors)
├── lib/            # Общие библиотеки (Prisma)
├── types/          # TypeScript типы
└── utils/          # Утилиты
```

### Frontend

```
src/
├── components/     # React компоненты
│   ├── common/    # Переиспользуемые UI
│   ├── layout/    # Layout компоненты
│   ├── schedules/ # Компоненты расписаний
│   └── shifts/    # Компоненты смен
├── pages/          # Страницы
├── services/       # API клиенты
├── hooks/          # Custom hooks
├── store/          # State management
├── types/          # TypeScript типы
└── utils/          # Утилиты
```

## Дополнительные ресурсы

- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Вопросы?

Если у вас есть вопросы, создайте issue с меткой `question`.

---

Спасибо за вклад в проект! 🎉

