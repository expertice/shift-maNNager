import { create } from 'zustand';
import Cookies from 'js-cookie';

interface AuthState {
  token: string | null;
  user: { id: string; email: string } | null;
  isAuthenticated: boolean;
  login: (token: string, user: { id: string; email: string }) => void;
  logout: () => void;
  initialize: () => void;
}

const USER_STORAGE_KEY = 'shift_manager_user';

export const useAuthStore = create<AuthState>((set) => {
  // Инициализация при создании store
  const initialize = () => {
    const token = Cookies.get('auth_token');
    if (token) {
      // Восстанавливаем информацию о пользователе из localStorage
      try {
        const savedUser = localStorage.getItem(USER_STORAGE_KEY);
        if (savedUser) {
          const user = JSON.parse(savedUser);
          set({ token, user, isAuthenticated: true });
          return;
        }
      } catch (error) {
        console.error('Failed to restore user from localStorage:', error);
      }
      // Если пользователь не найден в localStorage, но токен есть - проверяем токен
      // Можно декодировать базовую информацию из токена (без верификации подписи)
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.userId && payload.email) {
          const user = {
            id: payload.userId,
            email: payload.email,
          };
          localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
          set({ token, user, isAuthenticated: true });
          return;
        }
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
      // Если ничего не получилось, но токен есть - только устанавливаем авторизацию
      set({ token, isAuthenticated: true });
    } else {
      // Токена нет - очищаем localStorage
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  // Автоматическая инициализация
  initialize();

  return {
    token: null,
    user: null,
    isAuthenticated: false,

    login: (token, user) => {
      Cookies.set('auth_token', token, { expires: 7 }); // 7 дней
      // Сохраняем информацию о пользователе в localStorage
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
      set({ token, user, isAuthenticated: true });
    },

    logout: () => {
      Cookies.remove('auth_token');
      localStorage.removeItem(USER_STORAGE_KEY);
      set({ token: null, user: null, isAuthenticated: false });
    },

    initialize,
  };
});

