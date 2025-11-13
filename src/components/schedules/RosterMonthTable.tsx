import React from 'react';
import EmployeePatternRow from './EmployeePatternRow';
import { MonthSlice, getSlotStatus, SlotStatus } from '@/utils/rosterCalendar';

export interface RosterMonthTableProps {
  title: string;
  employees: { id: string; fullName: string; tabNumber?: string | null; birthDate?: Date | string | null }[];
  instances: Record<string, { sequence: (string | null)[]; startIndex: number; lockedIndices?: number[] | null }>;
  slice: MonthSlice;
  maxDays: number;
  periodStart: Date;
  periodEnd: Date;
  onReorder: (employeeId: string, newSeq: (string | null)[]) => void;
  onEmployeeClick?: (employeeId: string) => void;
  renderChip: (typeId: string | null, idx: number, status: SlotStatus) => React.ReactNode;
}

export default function RosterMonthTable({
  title,
  employees,
  instances,
  slice,
  maxDays,
  periodStart,
  periodEnd,
  onReorder,
  onEmployeeClick,
  renderChip,
}: RosterMonthTableProps) {
  // Prepare mask for this month
  const mask: SlotStatus[] = Array.from({ length: maxDays }, (_, i) =>
    getSlotStatus(i, slice, periodStart, periodEnd)
  );

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <div className="overflow-x-hidden">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r w-48">
                Сотрудник
              </th>
              {Array.from({ length: maxDays }, (_, i) => (
                <th key={i} className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ width: `calc((100% - 12rem) / ${maxDays})` }}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((emp) => {
              const inst = instances[emp.id];
              const seq = inst?.sequence ?? [];
              return (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td
                    className={`sticky left-0 z-10 bg-white px-6 py-4 whitespace-nowrap border-r ${
                      onEmployeeClick ? 'cursor-pointer hover:bg-blue-50 transition-colors' : ''
                    }`}
                    onClick={() => onEmployeeClick?.(emp.id)}
                  >
                    <div className="text-sm font-medium text-gray-900">{emp.fullName}</div>
                    {emp.position && <div className="text-xs text-gray-600 font-medium">{emp.position.name}</div>}
                  </td>
                  <td colSpan={maxDays} className="px-2 py-2">
                    {seq.length > 0 ? (
                      <EmployeePatternRow
                        employeeId={emp.id}
                        sequence={seq}
                        editableMask={mask}
                        onReorder={(newSeq) => onReorder(emp.id, newSeq)}
                        renderChip={renderChip}
                      />
                    ) : (
                      <div className="text-gray-400 text-sm">Нет паттерна</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


