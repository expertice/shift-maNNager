import React, { useState, useRef } from 'react';
import { Modal, Tabs, Button, Input } from '@components/common';
import { parseCSVPreview, validateFileFormat, downloadFile } from '@utils/fileUtils';

export type ImportMode = 'create' | 'update' | 'mixed';

export interface ImportResult {
  success: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, mode: ImportMode) => Promise<ImportResult>;
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
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'xlsx'>('csv');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    // Предпросмотр для CSV
    if (file.name.endsWith('.csv')) {
      try {
        const preview = await parseCSVPreview(file);
        setPreviewData(preview.slice(0, 10)); // Показываем первые 10 строк
      } catch (error) {
        setImportError('Ошибка при чтении файла');
        setSelectedFile(null);
      }
    } else {
      // Для Excel предпросмотр будет на сервере
      setPreviewData([]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setImportError('Выберите файл для импорта');
      return;
    }

    setImportError(null);
    try {
      const result = await onImport(selectedFile, importMode);
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

              {previewData.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Предпросмотр (первые строки):
                  </p>
                  <div className="border rounded-md overflow-auto max-h-48">
                    <table className="min-w-full divide-y divide-gray-200 text-xs">
                      <thead className="bg-gray-50">
                        <tr>
                          {previewData[0]?.map((_, idx) => (
                            <th key={idx} className="px-2 py-1 text-left font-medium text-gray-700">
                              Колонка {idx + 1}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {previewData.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="px-2 py-1 text-gray-900">
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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

