import React, { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { Sidebar, SidebarItem, SidebarIcons } from './Sidebar';
import { useUIStore } from '@store/useUIStore';
import classNames from 'classnames';

export interface MainLayoutProps {
  children: ReactNode;
  sidebarItems?: SidebarItem[];
  showSidebar?: boolean;
  sidebarFooter?: ReactNode;
}

/**
 * Основной layout приложения с шапкой, сайдбаром и подвалом
 */
export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  sidebarItems = [],
  showSidebar = true,
  sidebarFooter,
}) => {
  const { sidebarCollapsed } = useUIStore();

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <div className="flex flex-1 overflow-hidden relative pt-16">
        {showSidebar && sidebarItems.length > 0 && (
          <Sidebar items={sidebarItems} footer={sidebarFooter} />
        )}
        <main
          className={classNames(
            'flex-1 overflow-y-auto transition-all duration-300',
            showSidebar && sidebarItems.length > 0
              ? sidebarCollapsed
                ? 'ml-16'
                : 'ml-64'
              : ''
          )}
        >
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

