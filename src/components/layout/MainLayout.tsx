import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { Sidebar, SidebarItem, SidebarIcons } from './Sidebar';

export interface MainLayoutProps {
  children: ReactNode;
  sidebarItems?: SidebarItem[];
  showSidebar?: boolean;
}

/**
 * Основной layout приложения с шапкой, сайдбаром и подвалом
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  sidebarItems = [],
  showSidebar = true,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && sidebarItems.length > 0 && <Sidebar items={sidebarItems} />}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};

// Экспорт компонентов для удобства
export { Header } from './Header';
export { Sidebar, SidebarIcons } from './Sidebar';
export { Footer } from './Footer';

