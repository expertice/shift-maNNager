import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, Card, Tabs, Spinner } from '@components/common';
import { ShiftProfile, EditShiftProfileData, EditShiftTypeData, EditShiftPatternData } from '@types';
import { ShiftTypeEditor } from './ShiftTypeEditor';
import { PatternEditor } from './PatternEditor';
import {
  calculateCycleLength,
  calculateMinEmployees,
} from '@utils/shiftProfileValidation';
import { Pencil, Copy, Trash2, Plus, X, Save } from 'lucide-react';

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
   * Профиль для редактирования
   */
  profile: ShiftProfile | null;

  /**
   * Callback при сохранении
   */
  onSave: (data: EditShiftProfileData) => Promise<void>;

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
  profile,
  onSave,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState<string | null>(null);
  const [shiftTypes, setShiftTypes] = useState<EditShiftTypeData[]>([]);
  const [patterns, setPatterns] = useState<EditShiftPatternData[]>([]);
  const [editingShiftTypeIndex, setEditingShiftTypeIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'shiftTypes' | 'patterns'>('info');

  // Синхронизация данных при изменении профиля
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDescription(profile.description || null);
      
      // Преобразуем типы смен
      setShiftTypes(
        (profile.shiftTypes || []).map((st) => ({
          id: st.id,
          name: st.name,
          startTime: st.startTime,
          endTime: st.endTime,
          breaks: st.breaks,
          nightHoursCount: st.nightHoursCount,
          workingHours: st.workingHours,
          color: st.color,
        }))
      );

      // Преобразуем паттерны
      setPatterns(
        (profile.patterns || []).map((p) => ({
          id: p.id,
          patternNumber: p.patternNumber,
          cycleLength: p.cycleLength,
          sequence: p.sequence,
        }))
      );
    } else {
      // Сброс формы
      setName('');
      setDescription(null);
      setShiftTypes([]);
      setPatterns([]);
      setEditingShiftTypeIndex(null);
    }
  }, [profile, isOpen]);

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

    if (editingShiftTypeIndex !== null && editingShiftTypeIndex >= 0) {
      // Обновляем существующий тип
      const newShiftTypes = [...shiftTypes];
      newShiftTypes[editingShiftTypeIndex] = data;
      setShiftTypes(newShiftTypes);
    } else {
      // Добавляем новый тип с временным ID
      const newShiftType: EditShiftTypeData = {
        ...data,
        id: data.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      };
      setShiftTypes([...shiftTypes, newShiftType]);
    }
    setEditingShiftTypeIndex(null);
  };

  const handleEditShiftType = (index: number) => {
    setEditingShiftTypeIndex(index);
    setActiveTab('shiftTypes');
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
    setShiftTypes([...shiftTypes, cloned]);
    setEditingShiftTypeIndex(shiftTypes.length);
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

  // Валидация формы
  const validate = (): boolean => {
    if (!name.trim()) {
      alert('Название профиля обязательно');
      return false;
    }

    if (shiftTypes.length === 0) {
      alert('Необходимо добавить хотя бы один тип смены');
      return false;
    }

    if (patterns.length === 0) {
      alert('Необходимо добавить хотя бы один паттерн');
      return false;
    }

    return true;
  };

  // Сохранение
  const handleSave = async () => {
    if (!validate()) {
      return;
    }

    const data: EditShiftProfileData = {
      name: name.trim(),
      description: description || null,
      shiftTypes,
      patterns,
    };

    try {
      await onSave(data);
      onClose();
    } catch (error) {
      console.error('Ошибка сохранения профиля:', error);
      alert('Ошибка сохранения профиля. Попробуйте еще раз.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={profile ? `Редактирование: ${profile.name}` : 'Новый профиль смены'}
      size="xl"
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
                {editingShiftTypeIndex !== null || editingShiftTypeIndex === -1 ? (
                  <ShiftTypeEditor
                    shiftType={
                      editingShiftTypeIndex !== null && editingShiftTypeIndex >= 0
                        ? shiftTypes[editingShiftTypeIndex]
                        : null
                    }
                    mode={editingShiftTypeIndex === null ? 'create' : 'edit'}
                    onSave={handleSaveShiftType}
                    onCancel={() => setEditingShiftTypeIndex(null)}
                    onDelete={
                      editingShiftTypeIndex !== null && editingShiftTypeIndex >= 0
                        ? () => handleDeleteShiftType(editingShiftTypeIndex)
                        : undefined
                    }
                    onClone={
                      editingShiftTypeIndex !== null && editingShiftTypeIndex >= 0
                        ? () => handleCloneShiftType(editingShiftTypeIndex)
                        : undefined
                    }
                  />
                ) : (
                  <>
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
                    <div className="space-y-2">
                      {shiftTypes.map((shiftType, index) => (
                        <Card key={index} className="p-3 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {shiftType.color && (
                                <div
                                  className="w-6 h-6 rounded border border-gray-300"
                                  style={{ backgroundColor: shiftType.color }}
                                />
                              )}
                              <div>
                                <div className="font-medium">{shiftType.name}</div>
                                <div className="text-sm text-gray-600">
                                  {shiftType.startTime} - {shiftType.endTime}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditShiftType(index)}
                                title="Редактировать"
                                className="px-2"
                              >
                                <Pencil size={16} />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCloneShiftType(index)}
                                title="Клонировать"
                                className="px-2"
                              >
                                <Copy size={16} />
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleDeleteShiftType(index)}
                                title="Удалить"
                                className="px-2"
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))}
                      {shiftTypes.length === 0 && (
                        <p className="text-gray-500 text-center py-4">
                          Типы смен не добавлены
                        </p>
                      )}
                    </div>
                  </>
                )}
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
            ]}
            defaultTab={activeTab}
            onChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
          />

          {/* Кнопки действий */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={isLoading}
              title="Отменить изменения"
            >
              <X size={16} className="mr-1" />
              Отмена
            </Button>
            <Button 
              onClick={handleSave} 
              isLoading={isLoading} 
              disabled={isLoading}
              title="Сохранить профиль"
            >
              <Save size={16} className="mr-1" />
              Сохранить
            </Button>
          </div>
        </div>
    </Modal>
  );
};

