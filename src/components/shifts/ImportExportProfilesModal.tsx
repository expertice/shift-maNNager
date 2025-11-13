import React, { useState, useRef } from 'react';
import { Modal, Tabs, Button } from '@components/common';
import { validateFileFormat, downloadFile } from '@utils/fileUtils';

export type ImportMode = 'create' | 'update' | 'mixed';

export interface ImportResult {
  success: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
}

export interface ImportExportProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (file: File, mode: ImportMode) => Promise<ImportResult>;
  onExport: (format: 'json', profileIds?: string[]) => Promise<Blob>;
  scheduleId: string;
  profiles?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

/**
 * Модальное окно для импорта и экспорта профилей смен
 */
export const ImportExportProfilesModal: React.FC<ImportExportProfilesModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onExport,
  scheduleId,
  profiles = [],
  isLoading = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('mixed');
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Валидация формата
    if (!validateFileFormat(file, ['json'])) {
      setImportError('Поддерживаются только файлы JSON (.json)');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setImportError(null);
    setImportResult(null);
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
    if (selectedProfileIds.size === 0) {
      setImportError('Выберите хотя бы один профиль для экспорта');
      return;
    }

    setIsExporting(true);
    setImportError(null);
    try {
      const blob = await onExport('json', Array.from(selectedProfileIds));
      const filename = `shift_profiles_${scheduleId}_${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(blob, filename);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Ошибка при экспорте');
    } finally {
      setIsExporting(false);
    }
  };

  const handleToggleProfile = (profileId: string) => {
    const newSelected = new Set(selectedProfileIds);
    if (newSelected.has(profileId)) {
      newSelected.delete(profileId);
    } else {
      newSelected.add(profileId);
    }
    setSelectedProfileIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedProfileIds.size === profiles.length) {
      setSelectedProfileIds(new Set());
    } else {
      setSelectedProfileIds(new Set(profiles.map(p => p.id)));
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setImportError(null);
    setImportResult(null);
    setImportMode('mixed');
    setSelectedProfileIds(new Set());
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
                      Профиль {err.row}: {err.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Выберите файл (JSON)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
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
                  {importMode === 'create' && 'Будут созданы только новые профили. Существующие будут пропущены.'}
                  {importMode === 'update' && 'Будут обновлены только существующие профили по названию.'}
                  {importMode === 'mixed' && 'Будут созданы новые профили и обновлены существующие.'}
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
              <p className="font-medium mb-2">Формат файла JSON:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Название профиля (обязательно)</li>
                <li>Типы смен (массив с названием, временем начала/окончания, перерывами, часами)</li>
                <li>Паттерны (массив с номером паттерна, длиной цикла, последовательностью)</li>
                <li>Описание (опционально)</li>
              </ul>
              <p className="mt-2 text-xs text-gray-500">
                Файл должен содержать объект с полем "profiles" - массив профилей смен.
              </p>
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

          {profiles.length === 0 ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700">
              Нет доступных профилей для экспорта
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Выберите профили для экспорта
                </label>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-sm text-primary hover:underline"
                  disabled={isExporting || isLoading}
                >
                  {selectedProfileIds.size === profiles.length ? 'Снять выделение' : 'Выбрать все'}
                </button>
              </div>

              <div className="border rounded-md max-h-64 overflow-y-auto">
                <div className="divide-y divide-gray-200">
                  {profiles.map((profile) => (
                    <label
                      key={profile.id}
                      className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProfileIds.has(profile.id)}
                        onChange={() => handleToggleProfile(profile.id)}
                        disabled={isExporting || isLoading}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="ml-3 text-sm text-gray-700">{profile.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-sm text-blue-700">
                Выбрано: {selectedProfileIds.size} из {profiles.length} профилей
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-600">
                <p className="font-medium mb-2">Экспортируемые данные включают:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Название профиля</li>
                  <li>Типы смен (название, время начала/окончания, перерывы, часы)</li>
                  <li>Паттерны (номер паттерна, длина цикла, последовательность)</li>
                  <li>Описание</li>
                </ul>
              </div>
            </>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isExporting || isLoading}>
              Отмена
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting || isLoading || selectedProfileIds.size === 0}
            >
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
      title="Импорт / Экспорт профилей смен"
      size="lg"
    >
      <Tabs items={tabs} />
    </Modal>
  );
};

