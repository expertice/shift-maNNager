import React, { useState, useRef, useMemo } from 'react';
import { Modal, Tabs, Button, Input } from '@components/common';
import { parseCSVPreview, parseExcelPreview, validateFileFormat, downloadFile } from '@utils/fileUtils';

export type ImportMode = 'create' | 'update' | 'mixed';

export interface ImportResult {
  success: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface EmployeeImportRow {
  fullName: string;
  tabNumber: string;
  department?: string;
  position?: string;
  birthDate?: string;
  originalIndex: number;
}

export interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, mode: ImportMode, selectedIndices?: number[]) => Promise<ImportResult>;
  onExport: (format: 'csv' | 'xlsx') => Promise<Blob>;
  scheduleId: string;
  isLoading?: boolean;
}

/**
 * Модальное окно для импорта и экспорта сотрудников
 */
export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onExport,
  scheduleId,
  isLoading = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('mixed');
  const [previewData, setPreviewData] = useState<string[][]>([]);
  const [parsedEmployees, setParsedEmployees] = useState<EmployeeImportRow[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'fullName' | 'department' | 'birthDate' | 'position'>('fullName');
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parseCSVToEmployees = (rows: string[][]): EmployeeImportRow[] => {
    if (rows.length === 0) return [];
    
    // Определяем индексы колонок по заголовкам или по порядку
    const headerRow = rows[0];
    const isHeader = headerRow.some(cell => 
      cell.toLowerCase().includes('фио') || 
      cell.toLowerCase().includes('fullname') ||
      cell.toLowerCase().includes('табельный') ||
      cell.toLowerCase().includes('tabnumber')
    );
    
    let fullNameIdx = -1, tabNumberIdx = -1, departmentIdx = -1, positionIdx = -1, birthDateIdx = -1;
    
    if (isHeader) {
      headerRow.forEach((cell, idx) => {
        const lower = cell.toLowerCase();
        if (lower.includes('фио') || lower.includes('fullname') || lower.includes('full name')) fullNameIdx = idx;
        else if (lower.includes('табельный') || lower.includes('tabnumber') || lower.includes('tab number')) tabNumberIdx = idx;
        else if (lower.includes('отдел') || lower.includes('department')) departmentIdx = idx;
        else if (lower.includes('должность') || lower.includes('position')) positionIdx = idx;
        else if (lower.includes('дата рождения') || lower.includes('birthdate') || lower.includes('birth date')) birthDateIdx = idx;
      });
    } else {
      // Если нет заголовков, используем порядок по умолчанию
      fullNameIdx = 0;
      tabNumberIdx = 1;
      departmentIdx = 2;
      positionIdx = 3;
      birthDateIdx = 4;
    }
    
    const startRow = isHeader ? 1 : 0;
    return rows.slice(startRow).map((row, idx) => ({
      fullName: row[fullNameIdx]?.trim() || '',
      tabNumber: row[tabNumberIdx]?.trim() || '',
      department: departmentIdx >= 0 ? row[departmentIdx]?.trim() : undefined,
      position: positionIdx >= 0 ? row[positionIdx]?.trim() : undefined,
      birthDate: birthDateIdx >= 0 ? row[birthDateIdx]?.trim() : undefined,
      originalIndex: startRow + idx,
    })).filter(emp => emp.fullName && emp.tabNumber);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация формата
    if (!validateFileFormat(file, ['csv', 'xlsx'])) {
      setImportError('Поддерживаются только файлы CSV и Excel (.xlsx)');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setImportError(null);
    setImportResult(null);
    setSelectedIndices(new Set());

    // Парсинг для CSV и Excel
    try {
      let allRows: string[][];
      if (file.name.endsWith('.csv')) {
        allRows = await parseCSVPreview(file);
      } else {
        // Excel файл
        allRows = await parseExcelPreview(file);
      }
      
      setPreviewData(allRows.slice(0, 10)); // Предпросмотр первых 10 строк
      const employees = parseCSVToEmployees(allRows);
      setParsedEmployees(employees);
      // Выбираем все по умолчанию
      setSelectedIndices(new Set(employees.map((_, idx) => idx)));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Ошибка при чтении файла');
      setSelectedFile(null);
      setParsedEmployees([]);
    }
  };

  const sortedEmployees = useMemo(() => {
    const sorted = [...parsedEmployees];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'fullName':
          return a.fullName.localeCompare(b.fullName, 'ru');
        case 'department':
          return (a.department || '').localeCompare(b.department || '', 'ru');
        case 'position':
          return (a.position || '').localeCompare(b.position || '', 'ru');
        case 'birthDate':
          return (a.birthDate || '').localeCompare(b.birthDate || '', 'ru');
        default:
          return 0;
      }
    });
    return sorted;
  }, [parsedEmployees, sortBy]);

  const handleToggleEmployee = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedIndices.size === sortedEmployees.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(sortedEmployees.map((_, idx) => idx)));
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError('Выберите файл для импорта');
      return;
    }

    if (selectedIndices.size === 0) {
      setImportError('Выберите хотя бы одного сотрудника для импорта');
      return;
    }

    setImportError(null);
    try {
      // Передаем выбранные индексы для CSV и Excel
      const indices = Array.from(selectedIndices).map(idx => sortedEmployees[idx].originalIndex);
      const result = await onImport(selectedFile, importMode, indices);
      setImportResult(result);
      if (result.errors.length === 0) {
        // Успешный импорт - закрываем через 2 секунды
        setTimeout(() => {
          onClose();
          resetForm();
        }, 2000);
      }
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Ошибка при импорте');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await onExport(exportFormat);
      const filename = `employees_${scheduleId}_${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      downloadFile(blob, filename);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Ошибка при экспорте');
    } finally {
      setIsExporting(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setPreviewData([]);
    setParsedEmployees([]);
    setSelectedIndices(new Set());
    setSortBy('fullName');
    setImportError(null);
    setImportResult(null);
    setImportMode('mixed');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const tabs = [
    {
      id: 'import',
      label: 'Импорт',
      content: (
        <div className="space-y-4">
          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {importError}
            </div>
          )}

          {importResult && (
            <div className={`p-3 border rounded-md text-sm ${
              importResult.errors.length === 0
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
            }`}>
              <p className="font-semibold">
                Импорт завершен: {importResult.success} успешно
                {importResult.errors.length > 0 && `, ${importResult.errors.length} ошибок`}
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto">
                  {importResult.errors.map((err, idx) => (
                    <p key={idx} className="text-xs">
                      Строка {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите файл (CSV или Excel)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              disabled={isLoading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary-dark"
            />
          </div>

          {selectedFile && (
            <>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-blue-700 text-sm">
                Выбран файл: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
              </div>

              {parsedEmployees.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Выберите сотрудников для импорта ({selectedIndices.size} из {parsedEmployees.length})
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">Сортировка:</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="text-sm px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="fullName">По ФИО</option>
                        <option value="department">По отделу</option>
                        <option value="position">По должности</option>
                        <option value="birthDate">По дате рождения</option>
                      </select>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-sm text-primary hover:underline"
                      >
                        {selectedIndices.size === sortedEmployees.length ? 'Снять выделение' : 'Выбрать все'}
                      </button>
                    </div>
                  </div>

                  <div className="border rounded-md max-h-64 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left">
                            <input
                              type="checkbox"
                              checked={selectedIndices.size === sortedEmployees.length && sortedEmployees.length > 0}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">ФИО</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Табельный №</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Отдел</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Должность</th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700">Дата рождения</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedEmployees.map((employee, idx) => (
                          <tr key={idx} className={selectedIndices.has(idx) ? 'bg-blue-50' : ''}>
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={selectedIndices.has(idx)}
                                onChange={() => handleToggleEmployee(idx)}
                                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                              />
                            </td>
                            <td className="px-2 py-2 text-gray-900">{employee.fullName}</td>
                            <td className="px-2 py-2 text-gray-900">{employee.tabNumber}</td>
                            <td className="px-2 py-2 text-gray-600">{employee.department || '-'}</td>
                            <td className="px-2 py-2 text-gray-600">{employee.position || '-'}</td>
                            <td className="px-2 py-2 text-gray-600">{employee.birthDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}


              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Режим импорта
                </label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as ImportMode)}
                  disabled={isLoading}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                >
                  <option value="create">Только создание новых</option>
                  <option value="update">Только обновление существующих</option>
                  <option value="mixed">Создание новых + обновление существующих</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {importMode === 'create' && 'Будут созданы только новые сотрудники. Существующие будут пропущены.'}
                  {importMode === 'update' && 'Будут обновлены только существующие сотрудники по табельному номеру.'}
                  {importMode === 'mixed' && 'Будут созданы новые сотрудники и обновлены существующие.'}
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                  Отмена
                </Button>
                <Button onClick={handleImport} disabled={isLoading}>
                  {isLoading ? 'Импорт...' : 'Импортировать'}
                </Button>
              </div>
            </>
          )}

          {!selectedFile && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
              <p className="font-medium mb-2">Формат файла:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>ФИО (обязательно)</li>
                <li>Табельный номер (обязательно, уникален)</li>
                <li>Отдел (название)</li>
                <li>Должность (название)</li>
                <li>Дата рождения (формат: YYYY-MM-DD)</li>
              </ul>
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'export',
      label: 'Экспорт',
      content: (
        <div className="space-y-4">
          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {importError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Формат экспорта
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'xlsx')}
              disabled={isExporting || isLoading}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
            </select>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
            Экспортируемые данные включают: ФИО, Табельный номер, Отдел, Должность, Дата рождения
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isExporting || isLoading}>
              Отмена
            </Button>
            <Button onClick={handleExport} disabled={isExporting || isLoading}>
              {isExporting ? 'Экспорт...' : 'Экспортировать'}
            </Button>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Импорт / Экспорт сотрудников"
      size="lg"
    >
      <Tabs items={tabs} />
    </Modal>
  );
};

