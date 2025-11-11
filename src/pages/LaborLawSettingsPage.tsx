/**
 * Страница настроек контроля соответствия ТК РФ
 */

import { useState, useEffect } from 'react';
import { getSettings, updateSettings } from '../services/api/laborLawComplianceApi';
import { LaborLawSettings } from '../types';

export default function LaborLawSettingsPage() {
  const [settings, setSettings] = useState<LaborLawSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettings(data);
      setError(null);
    } catch (err) {
      setError('Ошибка загрузки настроек');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const updated = await updateSettings(settings);
      setSettings(updated);
      setError(null);
      alert('Настройки успешно сохранены');
    } catch (err) {
      setError('Ошибка сохранения настроек');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-8">
        <div className="text-red-600">Не удалось загрузить настройки</div>
        {error && <div className="mt-2 text-sm text-gray-600">{error}</div>}
        <button
          onClick={loadSettings}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Настройки контроля ТК РФ</h1>
        <p className="mt-2 text-sm text-gray-600">
          Управление параметрами проверки соответствия режима труда и отдыха требованиям
          Трудового кодекса РФ
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 space-y-6">
        {/* Максимальная продолжительность смены */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Максимальная продолжительность смены (часы)
            <span className="text-xs text-gray-500 ml-2">Ст. 94 ТК РФ</span>
          </label>
          <input
            type="number"
            value={settings.maxWorkingHoursPerShift}
            onChange={(e) =>
              setSettings({
                ...settings,
                maxWorkingHoursPerShift: Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Норма часов в неделю */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Норма часов в неделю
            <span className="text-xs text-gray-500 ml-2">Ст. 91 ТК РФ</span>
          </label>
          <input
            type="number"
            value={settings.maxHoursPerWeek}
            onChange={(e) =>
              setSettings({
                ...settings,
                maxHoursPerWeek: Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Норма часов в месяц */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Норма часов в месяц
            <span className="text-xs text-gray-500 ml-2">Ст. 91 ТК РФ</span>
          </label>
          <input
            type="number"
            step="0.01"
            value={settings.maxHoursPerMonth}
            onChange={(e) =>
              setSettings({
                ...settings,
                maxHoursPerMonth: Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Допустимое превышение часов в год */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Допустимое превышение часов в год (сверхурочные)
            <span className="text-xs text-gray-500 ml-2">Ст. 99 ТК РФ</span>
          </label>
          <input
            type="number"
            value={settings.maxOvertimeHoursPerYear}
            onChange={(e) =>
              setSettings({
                ...settings,
                maxOvertimeHoursPerYear: Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Максимум рабочих дней подряд */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Максимум рабочих дней подряд
            <span className="text-xs text-gray-500 ml-2">Ст. 110 ТК РФ</span>
          </label>
          <input
            type="number"
            value={settings.maxConsecutiveWorkDays}
            onChange={(e) =>
              setSettings({
                ...settings,
                maxConsecutiveWorkDays: Number(e.target.value),
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Ночные часы */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Начало ночных часов
              <span className="text-xs text-gray-500 ml-2">Ст. 96 ТК РФ</span>
            </label>
            <input
              type="time"
              value={settings.nightHoursStart}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  nightHoursStart: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Конец ночных часов
            </label>
            <input
              type="time"
              value={settings.nightHoursEnd}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  nightHoursEnd: e.target.value,
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Учитывать перерывы в ночных часах */}
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={settings.includeBreaksInNightHours}
            onChange={(e) =>
              setSettings({
                ...settings,
                includeBreaksInNightHours: e.target.checked,
              })
            }
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-700">
            Учитывать перерывы в ночных часах
          </label>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={loadSettings}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Отменить
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </div>
    </div>
  );
}

