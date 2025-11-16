import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import classNames from 'classnames';

// Единый набор классов размеров слота (используется также в днях сверху)
export const slotSizeClasses =
  'w-12 h-12 xl:w-11 xl:h-11 lg:w-10 lg:h-10 md:w-9 md:h-9 sm:w-8 sm:h-8';

// Презентационный (без DnD) вид слота. Переиспользуется для отображения «дней» сверху.
export const SlotView: React.FC<{
  label?: React.ReactNode;
  color?: string;
  isEmpty?: boolean;
  isDragging?: boolean;
  className?: string;
  title?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  textClassName?: string;
  style?: React.CSSProperties;
}> = ({ label, color, isEmpty, isDragging, className, title, onClick, textClassName, style }) => (
  <div
    className={classNames(
      'relative flex items-center justify-center',
      slotSizeClasses,
      'rounded-md border-2 transition-all duration-200',
      isEmpty
        ? (isDragging ? 'border-gray-400 bg-gray-200' : 'border-gray-300 bg-gray-50 hover:bg-gray-100')
        : (isDragging ? 'border-blue-500 bg-blue-200 shadow-lg' : 'border-blue-400 bg-blue-50 hover:bg-blue-100'),
      className
    )}
    title={title}
    onClick={onClick}
    style={style}
  >
    {!isEmpty && (
      <div className="absolute inset-0 rounded-md" style={{ backgroundColor: color || '#E5E7EB', opacity: 0.65 }} />
    )}
    <span className={classNames('relative z-10 text-xs font-semibold', textClassName || 'text-gray-800')}>
      {isEmpty ? '−' : label}
    </span>
  </div>
);

/**
 * Конфигурация поведения drag-and-drop
 */
export interface PatternConstructorConfig {
  /**
   * Направление сортировки
   */
  direction?: 'horizontal' | 'vertical';
  
  /**
   * Разрешить перетаскивание между паттернами
   */
  allowCrossPatternDrag?: boolean;
  
  /**
   * Разрешить пустые слоты (null)
   */
  allowEmptySlots?: boolean;
  
  /**
   * Вызывается при начале перетаскивания
   */
  onDragStart?: (event: DragStartEvent) => void;
  
  /**
   * Вызывается при окончании перетаскивания
   */
  onDragEnd?: (event: DragEndEvent) => void;
  
  /**
   * Вызывается при наведении на слот
   */
  onDragOver?: (event: DragOverEvent) => void;

  /**
   * Клик по слоту (для назначения активного типа)
   */
  onSlotClick?: (slot: SlotItem, event: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Элемент слота для перетаскивания
 */
export interface SlotItem {
  id: string;
  data: {
    shiftTypeId: string | null;
    dayIndex: number;
    patternIndex: number;
  };
}

/**
 * Props для компонента слота
 */
interface SlotProps {
  item: SlotItem;
  shiftTypeName?: string;
  shiftTypeColor?: string;
  isDragging?: boolean;
  isEmpty?: boolean;
  config: PatternConstructorConfig;
}

/**
 * Компонент слота
 */
const Slot: React.FC<SlotProps> = ({
  item,
  shiftTypeName,
  shiftTypeColor,
  isDragging,
  isEmpty,
  config,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSlotDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isEmptySlot = isEmpty || item.data.shiftTypeId === null;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing relative">
      <SlotView
        label={isEmptySlot ? undefined : (shiftTypeName?.charAt(0).toUpperCase() || '?')}
        color={shiftTypeColor}
        isEmpty={isEmptySlot}
        isDragging={isSlotDragging}
      title={isEmptySlot ? 'Выходной' : shiftTypeName || 'Смена'}
        onClick={(e) => config.onSlotClick?.(item, e as unknown as React.MouseEvent<HTMLDivElement>)}
      />
      {/* Кнопка-хотспот для назначения смены, не инициирует drag */}
      <button
        type="button"
        aria-label="Назначить тип смены"
        className="absolute top-0.5 right-0.5 z-20 w-4 h-4 rounded bg-white/80 border border-gray-300 text-[10px] leading-3 text-gray-600 hover:bg-white"
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          config.onSlotClick?.(item, (e as unknown as React.MouseEvent<HTMLDivElement>));
        }}
      >
        ·
      </button>
    </div>
  );
};

/**
 * Props для PatternConstructor
 */
export interface PatternConstructorProps {
  /**
   * Слоты для отображения
   */
  slots: SlotItem[];
  
  /**
   * Словарь типов смен для получения названий и цветов
   */
  shiftTypes?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  
  /**
   * Конфигурация поведения
   */
  config?: PatternConstructorConfig;
  
  /**
   * Callback при изменении порядка
   */
  onChange?: (newSlots: SlotItem[]) => void;
  
  /**
   * Дополнительные CSS классы
   */
  className?: string;
  /** Коэффициент горизонтального масштабирования визуального ряда */
  scaleX?: number;
}

/**
 * Переиспользуемый компонент для drag-and-drop конструктора паттернов
 */
export const PatternConstructor: React.FC<PatternConstructorProps> = ({
  slots,
  shiftTypes = [],
  config = {},
  onChange,
  className,
  scaleX,
}) => {
  const {
    direction = 'horizontal',
    allowEmptySlots = true,
    onDragStart,
    onDragEnd,
    onDragOver,
  } = config;

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<SlotItem[]>(slots);

  // Создаем словарь типов смен для быстрого доступа
  const shiftTypeMap = React.useMemo(
    () =>
      new Map(shiftTypes.map((st) => [st.id, { name: st.name, color: st.color }])),
    [shiftTypes]
  );

  // Синхронизируем items с slots при изменении slots
  React.useEffect(() => {
    setItems(slots);
  }, [slots]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const strategy =
    direction === 'horizontal' ? horizontalListSortingStrategy : verticalListSortingStrategy;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    onDragStart?.(event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);

    if (!over || active.id === over.id) {
      onDragEnd?.(event);
      return;
    }

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      onChange?.(newItems);
    }

    onDragEnd?.(event);
  };

  const handleDragOver = (event: DragOverEvent) => {
    onDragOver?.(event);
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;
  const activeShiftType = activeItem
    ? shiftTypeMap.get(activeItem.data.shiftTypeId || '')
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <SortableContext items={items.map((item) => item.id)} strategy={strategy}>
        <div
          className={classNames(
            'flex flex-nowrap gap-2 md:gap-2 sm:gap-1',
            direction === 'horizontal' ? 'flex-row' : 'flex-col',
            className
          )}
          style={{ transform: `scaleX(${scaleX ?? 1})`, transformOrigin: 'left center', width: 'max-content' }}
        >
          {items.map((item) => {
            const shiftType = item.data.shiftTypeId
              ? shiftTypeMap.get(item.data.shiftTypeId)
              : null;
            const isEmpty = item.data.shiftTypeId === null;

            return (
              <Slot
                key={item.id}
                item={item}
                shiftTypeName={shiftType?.name}
                shiftTypeColor={shiftType?.color}
                isEmpty={isEmpty}
                isDragging={item.id === activeId}
                config={config}
              />
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeItem ? (
          <Slot
            item={activeItem}
            shiftTypeName={activeShiftType?.name}
            shiftTypeColor={activeShiftType?.color}
            isEmpty={activeItem.data.shiftTypeId === null}
            isDragging={true}
            config={config}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

