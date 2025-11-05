import React from 'react';
import classNames from 'classnames';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  hover?: boolean;
}

/**
 * Карточка для группировки контента
 */
export const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = 'md',
  hover = false,
}) => {
  const paddings = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    none: '',
  };

  return (
    <div
      className={classNames(
        'bg-white rounded-lg shadow border border-gray-200',
        paddings[padding],
        hover && 'transition-shadow hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
};

