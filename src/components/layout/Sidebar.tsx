import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import classNames from 'classnames';
import { useUIStore } from '@store/useUIStore';

export interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  onClick?: () => void;
  badge?: string | number;
}

export interface SidebarProps {
  items: SidebarItem[];
  className?: string;
  footer?: React.ReactNode;
}

/**
 * Боковая панель навигации
 */
export const Sidebar: React.FC<SidebarProps> = ({ items, className, footer }) => {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={classNames(
        'fixed left-0 top-16 bottom-0 bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 z-40 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Кнопка сворачивания */}
      <div className="p-2 border-b border-gray-200 flex-shrink-0">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {sidebarCollapsed ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            )}
          </svg>
        </button>
      </div>

      <nav className="p-4 space-y-1 flex-1">
        {items.map((item) => {
          // Для кнопки "Расписание" проверяем точное совпадение пути
          // Для остальных - проверяем, что путь начинается с item.path, но не равен базовому пути расписания
          let isActive = false;
          if (item.path) {
            if (item.id === 'schedule') {
              // Точное совпадение для "Расписание"
              isActive = location.pathname === item.path || location.pathname === `${item.path}/`;
            } else {
              // Для остальных - startsWith, но исключаем базовый путь расписания
              const baseSchedulePath = items.find(i => i.id === 'schedule')?.path;
              isActive = location.pathname.startsWith(item.path) && 
                        (baseSchedulePath ? location.pathname !== baseSchedulePath && location.pathname !== `${baseSchedulePath}/` : true);
            }
          }
          const content = (
            <div
              className={classNames(
                'flex items-center justify-between rounded-lg transition-colors',
                sidebarCollapsed ? 'px-2 py-3 justify-center' : 'px-4 py-3',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700'
              )}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <div className={classNames(
                'flex items-center',
                sidebarCollapsed ? 'justify-center' : 'space-x-3'
              )}>
                {item.icon && <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>}
                {!sidebarCollapsed && (
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                )}
              </div>
              {!sidebarCollapsed && item.badge && (
                <span
                  className={classNames(
                    'px-2 py-1 text-xs rounded-full flex-shrink-0',
                    isActive ? 'bg-white text-primary' : 'bg-primary text-white'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </div>
          );

          if (item.path) {
            return (
              <Link key={item.id} to={item.path}>
                {content}
              </Link>
            );
          }

          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className="w-full text-left"
            >
              {content}
            </button>
          );
        })}
      </nav>

      {/* Футер с дополнительным контентом (статистика) */}
      {footer && <div className="flex-shrink-0">{footer}</div>}
    </aside>
  );
};

/**
 * Иконки для навигации
 */
export const SidebarIcons = {
  Home: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  ),
  Calendar: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  ),
  Users: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  ),
  Vacation: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
      />
    </svg>
  ),
  History: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  Settings: (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
};

