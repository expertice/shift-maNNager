import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/useAuthStore';
import { Avatar } from '@components/common';

/**
 * Шапка приложения
 */
export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 bg-primary text-white shadow-md z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Логотип и название */}
          <Link to="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white rounded flex items-center justify-center">
              <span className="text-primary font-bold text-xl">N</span>
            </div>
            <h1 className="text-xl font-bold">Shift Manager</h1>
          </Link>

          {/* Навигация */}
          <nav className="flex items-center space-x-6">
            <Link
              to="/"
              className="hover:text-primary-light transition-colors"
            >
              Расписания
            </Link>
          </nav>

          {/* Пользователь */}
          <div className="flex items-center space-x-4">
            {(user || isAuthenticated) && (
              <>
                <div className="flex items-center space-x-2">
                  <Avatar name={user?.email || 'Пользователь'} size="sm" />
                  <span className="text-sm">{user?.email || 'Пользователь'}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-primary-light hover:bg-primary-dark rounded-md transition-colors text-sm"
                >
                  Выход
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

