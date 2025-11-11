import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';
import { Button } from './Button';

export interface SelectWithAddOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectWithAddProps {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectWithAddOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  onAddNew?: (name: string) => Promise<{ id: string; name: string }>;
  addButtonLabel?: string;
  addPlaceholder?: string;
}

/**
 * Выпадающий список с возможностью добавления новых элементов
 */
export const SelectWithAdd: React.FC<SelectWithAddProps> = ({
  label,
  error,
  helperText,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  onAddNew,
  addButtonLabel = '+ Добавить',
  addPlaceholder = 'Введите название',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Закрытие при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsAdding(false);
        setNewItemName('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Фокус на input при открытии режима добавления
  useEffect(() => {
    if (isAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isAdding]);

  const handleSelectChange = (newValue: string) => {
    onChange(newValue);
    setIsOpen(false);
  };

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAdding(true);
    setIsOpen(true);
  };

  const handleAddSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!newItemName.trim() || !onAddNew) {
      return;
    }

    setIsCreating(true);
    setAddError(null);
    try {
      const newItem = await onAddNew(newItemName.trim());
      onChange(newItem.id);
      setIsAdding(false);
      setNewItemName('');
      setIsOpen(false);
      setAddError(null);
    } catch (err) {
      console.error('Ошибка при создании элемента:', err);
      const errorMessage = err instanceof Error ? err.message : 'Ошибка при создании элемента';
      setAddError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleAddSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      handleCancelAdd();
    }
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewItemName('');
    setAddError(null);
  };

  const selectedOption = options.find((opt) => opt.value === value);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={classNames(
            'block w-full px-3 py-2 border rounded-md shadow-sm bg-white text-left',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
            error && 'border-red-500',
            disabled && 'bg-gray-100 cursor-not-allowed',
            !disabled && 'cursor-pointer hover:border-gray-400'
          )}
        >
          <span className={classNames('block truncate', !selectedOption && 'text-gray-500')}>
            {selectedOption ? selectedOption.label : placeholder || 'Выберите...'}
          </span>
          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
            <svg
              className={classNames(
                'h-5 w-5 text-gray-400 transition-transform',
                isOpen && 'transform rotate-180'
              )}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {isAdding ? (
              <div className="p-2 border-b border-gray-200">
                <input
                  ref={inputRef}
                  type="text"
                  value={newItemName}
                  onChange={(e) => {
                    setNewItemName(e.target.value);
                    setAddError(null);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder={addPlaceholder}
                  disabled={isCreating}
                  className={classNames(
                    'w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary',
                    addError ? 'border-red-500' : 'border-gray-300'
                  )}
                />
                {addError && (
                  <p className="mt-1 text-xs text-red-600">{addError}</p>
                )}
                <div className="flex space-x-2 mt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddSubmit}
                    disabled={!newItemName.trim() || isCreating}
                    className="flex-1"
                  >
                    {isCreating ? 'Создание...' : 'Создать'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleCancelAdd}
                    disabled={isCreating}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {options.length > 0 ? (
                  options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectChange(option.value)}
                      disabled={option.disabled}
                      className={classNames(
                        'w-full text-left px-3 py-2 text-sm hover:bg-gray-100 focus:bg-gray-100 focus:outline-none',
                        option.value === value && 'bg-blue-50 text-blue-700',
                        option.disabled && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      {option.label}
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">Нет элементов</div>
                )}
                {onAddNew && (
                  <button
                    type="button"
                    onClick={handleAddClick}
                    className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-200 font-medium"
                  >
                    {addButtonLabel}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-gray-500">{helperText}</p>}
    </div>
  );
};

