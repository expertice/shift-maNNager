import { create } from 'zustand';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const STORAGE_KEY = 'sidebar_collapsed';

// Загружаем состояние из localStorage при инициализации
const getInitialState = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : false;
  } catch {
    return false;
  }
};

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: getInitialState(),
  toggleSidebar: () => {
    set((state) => {
      const newState = !state.sidebarCollapsed;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
      return { sidebarCollapsed: newState };
    });
  },
  setSidebarCollapsed: (collapsed: boolean) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    set({ sidebarCollapsed: collapsed });
  },
}));

