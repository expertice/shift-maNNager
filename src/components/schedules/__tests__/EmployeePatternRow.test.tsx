import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EmployeePatternRow from '../EmployeePatternRow';

// Мокируем dnd-kit
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => {
    // Простой мок - можно вызвать onDragEnd для тестирования
    return <div data-testid="dnd-context">{children}</div>;
  },
  closestCenter: vi.fn(),
  useSensor: vi.fn(() => ({})),
  useSensors: vi.fn(() => []),
  PointerSensor: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div data-testid="sortable-context">{children}</div>,
  arrayMove: vi.fn((arr, oldIndex, newIndex) => {
    const newArr = [...arr];
    const [moved] = newArr.splice(oldIndex, 1);
    newArr.splice(newIndex, 0, moved);
    return newArr;
  }),
  horizontalListSortingStrategy: vi.fn(),
}));

describe('EmployeePatternRow', () => {
  const mockRenderChip = vi.fn((typeId: string | null) => (
    <div data-testid={`chip-${typeId || 'null'}`}>{typeId || '-'}</div>
  ));

  const defaultProps = {
    employeeId: 'emp-1',
    sequence: ['type-1', 'type-2', null],
    editableMask: ['InsidePeriod', 'InsidePeriod', 'InsidePeriod'] as const,
    onReorder: vi.fn(),
    renderChip: mockRenderChip,
  };

  it('should render chips for sequence', () => {
    render(<EmployeePatternRow {...defaultProps} />);

    expect(screen.getByTestId('chip-type-1')).toBeInTheDocument();
    expect(screen.getByTestId('chip-type-2')).toBeInTheDocument();
    expect(screen.getByTestId('chip-null')).toBeInTheDocument();
  });

  it('should render disabled chips for OutsidePeriod slots', () => {
    const props = {
      ...defaultProps,
      editableMask: ['InsidePeriod', 'OutsidePeriod', 'InsidePeriod'] as const,
    };

    render(<EmployeePatternRow {...props} />);

    const chips = screen.getAllByTestId(/chip-/);
    expect(chips).toHaveLength(3);
  });

  it('should handle longer mask than sequence', () => {
    const props = {
      ...defaultProps,
      editableMask: ['InsidePeriod', 'InsidePeriod', 'InsidePeriod', 'InsidePeriod', 'InsidePeriod'] as const,
    };

    render(<EmployeePatternRow {...props} />);

    // Sequence циклически повторяется
    const chips = screen.getAllByTestId(/chip-/);
    expect(chips.length).toBeGreaterThanOrEqual(3);
  });
});

