import React, { useState } from 'react';
import { Card, Button, Badge } from '@components/common';
import { ShiftProfile } from '@types';

export interface ShiftProfileCarouselProps {
  profiles: ShiftProfile[];
  selectedProfileId?: string;
  onSelectProfile: (profileId: string) => void;
  onGenerate: (profileId: string) => void;
}

/**
 * Карусель профилей смен для выбора и генерации
 */
export const ShiftProfileCarousel: React.FC<ShiftProfileCarouselProps> = ({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onGenerate,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const visibleProfiles = profiles.slice(currentIndex, currentIndex + 3);

  const handlePrev = () => {
    setCurrentIndex(Math.max(0, currentIndex - 1));
  };

  const handleNext = () => {
    setCurrentIndex(Math.min(profiles.length - 3, currentIndex + 1));
  };

  if (profiles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-gray-500">Нет доступных профилей смен</p>
      </Card>
    );
  }

  return (
    <div className="relative">
      <div className="flex items-center space-x-4">
        {currentIndex > 0 && (
          <button
            onClick={handlePrev}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Предыдущие профили"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
          {visibleProfiles.map((profile) => (
            <Card
              key={profile.id}
              className={`p-4 cursor-pointer transition-all ${
                selectedProfileId === profile.id
                  ? 'ring-2 ring-primary border-primary'
                  : 'hover:shadow-md'
              }`}
              onClick={() => onSelectProfile(profile.id)}
            >
              <div className="mb-3">
                <h3 className="text-lg font-semibold mb-1">{profile.name}</h3>
                {profile.description && (
                  <p className="text-sm text-gray-600 mb-2">{profile.description}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <span>Цикл: {profile.cycleLength} дней</span>
                  <span>Мин. сотрудников: {profile.minEmployees}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Badge variant="info">{profile.shiftTypes?.length || 0} типов смен</Badge>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onGenerate(profile.id);
                  }}
                >
                  Использовать
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {currentIndex < profiles.length - 3 && (
          <button
            onClick={handleNext}
            className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Следующие профили"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

