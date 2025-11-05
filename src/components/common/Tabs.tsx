import React, { useState, ReactElement, cloneElement } from 'react';
import classNames from 'classnames';

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

/**
 * Компонент вкладок
 */
export const Tabs: React.FC<TabsProps> = ({ items, defaultTab, onChange, className }) => {
  const [activeTab, setActiveTab] = useState(defaultTab || items[0]?.id);

  const handleTabChange = (tabId: string) => {
    const tab = items.find((item) => item.id === tabId);
    if (tab && !tab.disabled) {
      setActiveTab(tabId);
      onChange?.(tabId);
    }
  };

  const activeContent = items.find((item) => item.id === activeTab)?.content;

  return (
    <div className={className}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              disabled={item.disabled}
              className={classNames(
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === item.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                item.disabled && 'opacity-50 cursor-not-allowed'
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-4">{activeContent}</div>
    </div>
  );
};

