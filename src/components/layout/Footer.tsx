import React from 'react';

/**
 * Подвал приложения
 */
export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 border-t border-gray-200 mt-auto">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            <p>© {currentYear} Марченко В.Ю. Все права защищены.</p>
          </div>
          <div className="flex items-center space-x-4">
            <span>Версия 0.1.0</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

