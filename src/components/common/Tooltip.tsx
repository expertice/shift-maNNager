import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

/**
 * Tooltip с подсказкой
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const positions = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };

  const arrows = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-black',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-black',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-black',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-black',
  };

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          className={classNames(
            'absolute z-50 px-3 py-2 text-sm text-white bg-black rounded-lg shadow-lg whitespace-nowrap',
            positions[position],
            className
          )}
          role="tooltip"
        >
          {content}
          <div
            className={classNames(
              'absolute w-0 h-0 border-4 border-transparent',
              arrows[position]
            )}
          />
        </div>
      )}
    </div>
  );
};

