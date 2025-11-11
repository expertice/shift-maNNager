import React, { useState, useEffect } from 'react';
import classNames from 'classnames';
import { Modal, Input, Button, Card, Tabs, Spinner } from '@components/common';
import { ShiftProfile, EditShiftProfileData, EditShiftTypeData, EditShiftPatternData, ShiftBreak } from '@types';
import { ShiftTypeEditor } from './ShiftTypeEditor';
import { PatternEditor } from './PatternEditor';
import {
  calculateCycleLength,
  calculateMinEmployees,
} from '@utils/shiftProfileValidation';
import { Copy, Trash2, Plus, ChevronRight, Save } from 'lucide-react';

/**
 * Props для модального окна редактирования профиля смены
 */
export interface EditShiftProfileModalProps {
  /**
   * Открыто ли модальное окно
   */
  isOpen: boolean;

  /**
   * Callback при закрытии
   */
  onClose: () => void;

  /**
   * ID расписания, к которому принадлежит профиль
   */
  scheduleId: string;

  /**
   * Профиль для редактирования
   */
  profile: ShiftProfile | null;

  /**
   * Callback при сохранении
   */
  onSave: (data: EditShiftProfileData, options?: { silent?: boolean }) => Promise<void>;

  /**
   * Загрузка в процессе
   */
  isLoading?: boolean;
}

/**
 * Модальное окно для редактирования профиля смены
 */
export const EditShiftProfileModal: React.FC<EditShiftProfileModalProps> = ({
  isOpen,
  onClose,
  scheduleId,
  profile,
  onSave,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<EditShiftTypeData[]>([]);
  const [patterns, setPatterns] = useState<EditShiftPatternData[]>([]);
  const [editingShiftTypeIndex, setEditingShiftTypeIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'shiftTypes' | 'patterns' | 'stats'>('info');
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({});
  
  // Сохраняем исходные данные для сравнения
  const [initialData, setInitialData] = useState<{
    name: string;
    description: string | null;
    shiftTypes: EditShiftTypeData[];
    patterns: EditShiftPatternData[];
  } | null>(null);

  const deduplicateBreaks = React.useCallback((breaks?: ShiftBreak[]): ShiftBreak[] => {
    if (!breaks) return [];
    const seen = new Set<string>();
    return breaks.filter((b) => {
      const key = `${b.startTime}-${b.endTime}-${b.duration}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, []);

  // Синхронизация данных при изменении профиля
  useEffect(() => {
    if (profile) {
      const profileName = profile.name;
      const profileDescription = profile.description || null;
      
      setName(profileName);
      setDescription(profileDescription);
      
      // Преобразуем типы смен
      const profileShiftTypes = (profile.shiftTypes || []).map((st) => ({
        id: st.id,
        name: st.name,
        startTime: st.startTime,
        endTime: st.endTime,
        breaks: deduplicateBreaks(st.breaks),
        nightHoursCount: st.nightHoursCount !== null && st.nightHoursCount !== undefined ? Number(st.nightHoursCount) : 0,
        workingHours: st.workingHours !== null && st.workingHours !== undefined ? Number(st.workingHours) : 0,
        color: st.color,
      }));
      setShiftTypes(profileShiftTypes);
      setOpenAccordions({});

      // Преобразуем паттерны
      const profilePatterns = (profile.patterns || []).map((p) => ({
        id: p.id,
        patternNumber: p.patternNumber,
        cycleLength: p.cycleLength,
        sequence: p.sequence,
      }));
      setPatterns(profilePatterns);
      
      // Сохраняем исходные данные для сравнения
      setInitialData({
        name: profileName,
        description: profileDescription,
        shiftTypes: profileShiftTypes,
        patterns: profilePatterns,
      });
    } else {
      // Сброс формы
      setName('');
      setDescription(null);
      setShiftTypes([]);
      setPatterns([]);
      setEditingShiftTypeIndex(null);
      setInitialData({
        name: '',
        description: null,
        shiftTypes: [],
        patterns: [],
      });
    }
  }, [profile, isOpen, deduplicateBreaks]);

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Автоматически вычисляемые значения
  const cycleLength = calculateCycleLength(
    patterns.map((p) => ({
      id: p.id || '',
      shiftProfileId: '',
      patternNumber: p.patternNumber,
      cycleLength: p.cycleLength,
      sequence: p.sequence,
    }))
  );
  const minEmployees = calculateMinEmployees(
    patterns.map((p) => ({
      id: p.id || '',
      shiftProfileId: '',
      patternNumber: p.patternNumber,
      cycleLength: p.cycleLength,
      sequence: p.sequence,
    }))
  );

  // Управление типами смен
  const handleSaveShiftType = (data: EditShiftTypeData) => {
    // Проверка уникальности имени в рамках профиля
    const nameExists = shiftTypes.some(
      (st, index) =>
        st.name.toLowerCase().trim() === data.name.toLowerCase().trim() &&
        (editingShiftTypeIndex === null || index !== editingShiftTypeIndex) &&
        (!data.id || st.id !== data.id)
    );

    if (nameExists) {
      alert('Тип смены с таким именем уже существует в этом профиле');
      return;
    }

    // Определяем индекс для обновления:
    // 1) при явном режиме редактирования используем editingShiftTypeIndex
    // 2) иначе ищем по id, если он существует
    const inferredIndex =
      editingShiftTypeIndex !== null && editingShiftTypeIndex >= 0
        ? editingShiftTypeIndex
        : (data.id
            ? shiftTypes.findIndex((st) => !!st.id && st.id === data.id)
            : -1);

    if (inferredIndex >= 0) {
      // Обновляем существующий тип (обязательно сохраняем исходный id)
      const existing = shiftTypes[inferredIndex];
      const updated: EditShiftTypeData = {
        ...existing,
        ...data,
        id: existing.id,
        workingHours:
          data.workingHours !== null && data.workingHours !== undefined
            ? Number(data.workingHours)
            : (typeof existing.workingHours === 'number' ? existing.workingHours : Number(existing.workingHours) || 0),
        nightHoursCount:
          data.nightHoursCount !== null && data.nightHoursCount !== undefined
            ? Number(data.nightHoursCount)
            : (typeof existing.nightHoursCount === 'number' ? existing.nightHoursCount : Number(existing.nightHoursCount) || 0),
      };
      const newShiftTypes = [...shiftTypes];
      newShiftTypes[inferredIndex] = updated;
      setShiftTypes(newShiftTypes);
    } else {
      // Добавляем новый тип с временным ID
      const newShiftType: EditShiftTypeData = {
        ...data,
        id: data.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        workingHours:
          data.workingHours !== null && data.workingHours !== undefined
            ? Number(data.workingHours)
            : 0,
        nightHoursCount:
          data.nightHoursCount !== null && data.nightHoursCount !== undefined
            ? Number(data.nightHoursCount)
            : 0,
      };
      const newShiftTypes = [...shiftTypes, newShiftType];
      setShiftTypes(newShiftTypes);
      if (newShiftType.id) {
        setOpenAccordions((prev) => ({
          ...prev,
          [newShiftType.id as string]: true,
        }));
      }
    }
    setEditingShiftTypeIndex(null);
  };

  const handleDeleteShiftType = (index: number) => {
    const newShiftTypes = shiftTypes.filter((_, i) => i !== index);
    setShiftTypes(newShiftTypes);
    
    // Удаляем ссылки на этот тип из паттернов
    const deletedTypeId = shiftTypes[index].id;
    if (deletedTypeId) {
      const newPatterns = patterns.map((pattern) => ({
        ...pattern,
        sequence: pattern.sequence.map((shiftTypeId) =>
          shiftTypeId === deletedTypeId ? null : shiftTypeId
        ),
      }));
      setPatterns(newPatterns);
    }
    
    setEditingShiftTypeIndex(null);
  };

  const handleCloneShiftType = (index: number) => {
    const cloned = { ...shiftTypes[index] };
    cloned.id = undefined; // Убираем ID для создания нового
    cloned.name = `${cloned.name} (копия)`;
    const newShiftTypes = [...shiftTypes, cloned];
    setShiftTypes(newShiftTypes);
    const newIndex = newShiftTypes.length - 1;
    const newKey = cloned.id || `index-${newIndex}`;
    setOpenAccordions((prev) => ({
      ...prev,
      [newKey]: true,
    }));
  };

  const handleAddShiftType = () => {
    setEditingShiftTypeIndex(-1); // -1 означает создание нового
    setActiveTab('shiftTypes');
  };

  // Управление паттернами
  const handleAddPattern = () => {
    const newPatternNumber =
      patterns.length > 0
        ? Math.max(...patterns.map((p) => p.patternNumber)) + 1
        : 1;
    
    const newPattern: EditShiftPatternData = {
      patternNumber: newPatternNumber,
      cycleLength: 4,
      sequence: [null, null, null, null],
    };
    setPatterns([...patterns, newPattern]);
    setActiveTab('patterns');
  };

  const handleDeletePattern = (patternNumber: number) => {
    setPatterns(patterns.filter((p) => p.patternNumber !== patternNumber));
  };

  // Проверка наличия незаполненных обязательных полей
  const hasUnfilledRequiredFields = (): boolean => {
    return !name.trim() || shiftTypes.length === 0 || patterns.length === 0;
  };

  // Проверка наличия несохраненных изменений
  const hasUnsavedChanges = (): boolean => {
    if (!initialData) {
      // Если нет исходных данных, значит это новый профиль
      return name.trim() !== '' || shiftTypes.length > 0 || patterns.length > 0;
    }

    // Сравниваем текущие данные с исходными
    if (name.trim() !== initialData.name) return true;
    if (description !== initialData.description) return true;
    if (shiftTypes.length !== initialData.shiftTypes.length) return true;
    if (patterns.length !== initialData.patterns.length) return true;

    // Детальное сравнение типов смен
    for (let i = 0; i < shiftTypes.length; i++) {
      const current = shiftTypes[i];
      const initial = initialData.shiftTypes[i];
      if (!initial) return true;
      
      if (current.name !== initial.name ||
          current.startTime !== initial.startTime ||
          current.endTime !== initial.endTime ||
          current.color !== initial.color ||
          JSON.stringify(current.breaks) !== JSON.stringify(initial.breaks)) {
        return true;
      }
    }

    // Детальное сравнение паттернов
    for (let i = 0; i < patterns.length; i++) {
      const current = patterns[i];
      const initial = initialData.patterns[i];
      if (!initial) return true;
      
      if (current.patternNumber !== initial.patternNumber ||
          current.cycleLength !== initial.cycleLength ||
          JSON.stringify(current.sequence) !== JSON.stringify(initial.sequence)) {
        return true;
      }
    }

    return false;
  };

  // Ручное сохранение профиля
  const handleManualSave = async () => {
    if (!name.trim() || shiftTypes.length === 0 || patterns.length === 0) {
      alert('Заполните все обязательные поля: название, типы смен и паттерны');
      return;
    }

    const data: EditShiftProfileData = {
      scheduleId,
      name: name.trim(),
      description: description || null,
      shiftTypes,
      patterns,
    };

    try {
      await onSave(data);
      // После успешного сохранения обновляем исходные данные
      setInitialData({
        name: data.name,
        description: data.description,
        shiftTypes: data.shiftTypes,
        patterns: data.patterns,
      });
    } catch (error: any) {
      console.error('Ошибка сохранения профиля:', error);
      alert(`Ошибка сохранения: ${error.message || 'Неизвестная ошибка'}`);
    }
  };

  // Обработчик закрытия с проверкой несохраненных данных
  const handleClose = () => {
    const hasUnfilled = hasUnfilledRequiredFields();
    const hasChanges = hasUnsavedChanges();

    if (hasUnfilled || hasChanges) {
      const message = hasUnfilled
        ? 'У вас есть незаполненные обязательные поля. Вы уверены, что хотите закрыть? Все несохраненные данные будут потеряны.'
        : 'У вас есть несохраненные изменения. Вы уверены, что хотите закрыть? Все несохраненные данные будут потеряны.';
      
      if (window.confirm(message)) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  // Автосохранение изменений внутри модального окна
  useEffect(() => {
    if (!isOpen) return;
    if (!name.trim() || shiftTypes.length === 0 || patterns.length === 0) return;

    const data: EditShiftProfileData = {
      scheduleId,
      name: name.trim(),
      description: description || null,
      shiftTypes,
      patterns,
    };

    const timer = window.setTimeout(() => {
      onSave(data, { silent: true })
        .then(() => {
          // После успешного автосохранения обновляем исходные данные
          setInitialData({
            name: data.name,
            description: data.description,
            shiftTypes: data.shiftTypes,
            patterns: data.patterns,
          });
        })
        .catch((e) => console.error('Ошибка автосохранения профиля:', e));
    }, 600);

    return () => window.clearTimeout(timer);
  }, [isOpen, name, description, shiftTypes, patterns, onSave, scheduleId]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={profile ? `Редактирование: ${profile.name}` : 'Новый профиль смены'}
      size="xl"
      headerActions={
        <button
          onClick={handleManualSave}
          disabled={isLoading || !name.trim() || shiftTypes.length === 0 || patterns.length === 0}
          className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Сохранить"
          title="Сохранить профиль"
        >
          <Save className="w-6 h-6" />
        </button>
      }
    >
      <div className="space-y-6">
          <Tabs
            items={[
              {
                id: 'info',
                label: 'Основные параметры',
                content: (
                  <div className="space-y-4">
                <Input
                  label="Название профиля"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                <Input
                  label="Описание"
                  value={description || ''}
                  onChange={(e) => setDescription(e.target.value || null)}
                  placeholder="Описание профиля (необязательно)"
                />

                {/* Автоматически вычисляемые поля */}
                <Card className="p-4 bg-gray-50">
                  <h3 className="font-semibold mb-2">Автоматически вычисляемые параметры</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Длина цикла: </span>
                      <span className="font-semibold">{cycleLength} дней</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-600">Мин. сотрудников: </span>
                      <span className="font-semibold">{minEmployees}</span>
                    </div>
                  </div>
                </Card>
              </div>
                ),
              },
              {
                id: 'shiftTypes',
                label: 'Типы смен',
                content: (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="font-semibold">Типы смен ({shiftTypes.length})</h3>
                      <Button 
                        variant="outline" 
                        onClick={handleAddShiftType}
                        title="Добавить тип смены"
                      >
                        <Plus size={16} className="mr-1" />
                        Добавить тип смены
                      </Button>
                    </div>
                    {editingShiftTypeIndex === -1 && (
                      <div className="border border-dashed border-blue-300 rounded-lg bg-blue-50/60 p-3">
                        <ShiftTypeEditor
                          shiftType={null}
                          mode="create"
                          onSave={handleSaveShiftType}
                          autoSave
                          hideActions
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      {shiftTypes.map((shiftType, index) => {
                        const key = shiftType.id || `index-${index}`;
                        const isOpen = !!openAccordions[key];
                        const workingHoursLabel = Number.isFinite(shiftType.workingHours)
                          ? Number(shiftType.workingHours).toFixed(2)
                          : '—';
                        const nightHoursLabel = Number.isFinite(shiftType.nightHoursCount)
                          ? Number(shiftType.nightHoursCount).toFixed(2)
                          : '—';

                        return (
                          <div key={key} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                            <button
                              type="button"
                              onClick={() => toggleAccordion(key)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                {shiftType.color && (
                                  <span
                                    className="inline-flex w-4 h-4 rounded-full border border-gray-300"
                                    style={{ backgroundColor: shiftType.color }}
                                  />
                                )}
                                <div className="flex flex-col">
                                  <span className="font-medium text-sm">{shiftType.name}</span>
                                  <span className="text-xs text-gray-500">
                                    {shiftType.startTime} – {shiftType.endTime}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-gray-500">
                                <span>
                                  Рабочие: <span className="text-gray-800 font-medium">{workingHoursLabel}</span>
                                </span>
                                <span>
                                  Ночные: <span className="text-gray-800 font-medium">{nightHoursLabel}</span>
                                </span>
                                <ChevronRight
                                  size={16}
                                  className={classNames(
                                    'text-gray-400 transition-transform',
                                    isOpen && 'rotate-90'
                                  )}
                                />
                              </div>
                            </button>
                            {isOpen && (
                              <div className="px-4 py-3 bg-gray-50 text-sm space-y-3">
                                <ShiftTypeEditor
                                  shiftType={shiftType}
                                  mode="edit"
                                  onSave={handleSaveShiftType}
                                  onDelete={() => handleDeleteShiftType(index)}
                                  onClone={() => handleCloneShiftType(index)}
                                  autoSave
                                  hideActions
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {shiftTypes.length === 0 && (
                        <p className="text-gray-500 text-center py-4">
                          Типы смен не добавлены
                        </p>
                      )}
                    </div>
                  </div>
                ),
              },
              {
                id: 'patterns',
                label: 'Паттерны',
                content: (
                  <PatternEditor
                patterns={patterns}
                shiftTypes={shiftTypes}
                onChange={setPatterns}
                onAddPattern={handleAddPattern}
                onDeletePattern={handleDeletePattern}
                  />
                ),
              },
              {
                id: 'stats',
                label: 'Статистика',
                content: (
                  <div className="space-y-4">
                    <Card className="p-4 bg-blue-50 border border-blue-200">
                      <h3 className="font-semibold text-blue-900 mb-1">Сводка типов смен</h3>
                      <p className="text-sm text-blue-800">
                        Эти показатели будут использоваться при сравнении профилей за период. Проверьте корректность временных интервалов и ночных часов.
                      </p>
                    </Card>

                    {shiftTypes.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Тип смены</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Начало</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Конец</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Перерывы</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рабочие часы</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ночные часы</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {shiftTypes.map((shiftType) => {
                              const breaksLabel =
                                shiftType.breaks && shiftType.breaks.length > 0
                                  ? shiftType.breaks
                                      .map((b) => `${b.startTime}–${b.endTime}`)
                                      .join(', ')
                                  : '—';

                              const workingHoursLabel =
                                typeof shiftType.workingHours === 'number'
                                  ? shiftType.workingHours.toFixed(2)
                                  : shiftType.workingHours ?? '—';

                              const nightHoursLabel =
                                typeof shiftType.nightHoursCount === 'number'
                                  ? shiftType.nightHoursCount.toFixed(2)
                                  : shiftType.nightHoursCount ?? '—';

                              return (
                                <tr key={shiftType.id || shiftType.name}>
                                  <td className="px-4 py-2 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {shiftType.color && (
                                        <span
                                          className="inline-flex w-3 h-3 rounded-full border border-gray-300"
                                          style={{ backgroundColor: shiftType.color }}
                                        />
                                      )}
                                      <span className="text-sm text-gray-900">{shiftType.name}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{shiftType.startTime || '—'}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{shiftType.endTime || '—'}</td>
                                  <td className="px-4 py-2 text-sm text-gray-700">{breaksLabel}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{workingHoursLabel}</td>
                                  <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-700">{nightHoursLabel}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Card className="p-4 text-sm text-gray-500">
                        Статистика появится после добавления хотя бы одного типа смены.
                      </Card>
                    )}
                  </div>
                ),
              },
            ]}
            defaultTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
          />

          {/* Без явных кнопок: изменения сохраняются автоматически */}
        </div>
    </Modal>
  );
};

