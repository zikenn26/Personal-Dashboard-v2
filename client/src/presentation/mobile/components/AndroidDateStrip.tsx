import React, { useState } from 'react';
import { nativeService } from '../../../services/nativeService';

export interface AndroidDateStripProps {
  onSelectDate?: (date: Date) => void;
  className?: string;
}

interface DayItem {
  dayName: string; // "Mon", "Tue"
  dayNumber: number; // 22, 23
  date: Date;
  isToday: boolean;
}

/**
 * Material You Horizontal Date Strip
 * Replicating Screen B's exact 7-day pill strip.
 */
export const AndroidDateStrip: React.FC<AndroidDateStripProps> = ({
  onSelectDate,
  className = '',
}) => {
  // Generate current week starting Monday
  const today = new Date();
  const currentDayOfWeek = today.getDay(); // 0 is Sunday
  const distanceToMonday = currentDayOfWeek === 0 ? -6 : 1 - currentDayOfWeek;
  const monday = new Date(today);
  monday.setDate(today.getDate() + distanceToMonday);

  const days: DayItem[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isToday =
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
    return {
      dayName: dayNames[d.getDay()],
      dayNumber: d.getDate(),
      date: d,
      isToday,
    };
  });

  const [selectedIdx, setSelectedIdx] = useState<number>(() => {
    const idx = days.findIndex((d) => d.isToday);
    return idx !== -1 ? idx : 2; // Default to today or mid-week
  });

  const handleSelect = (idx: number, day: DayItem) => {
    void nativeService.triggerHaptic('selection');
    setSelectedIdx(idx);
    if (onSelectDate) onSelectDate(day.date);
  };

  return (
    <div className={`w-full flex items-center justify-between gap-1 px-1 select-none ${className}`}>
      {days.map((d, idx) => {
        const isSelected = selectedIdx === idx;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => handleSelect(idx, d)}
            className={`flex-1 py-2 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer ${
              isSelected
                ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/30 scale-[1.03]'
                : d.isToday
                ? 'bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300'
                : 'bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-gray-700 dark:text-gray-300 hover:border-violet-300'
            }`}
          >
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                isSelected ? 'text-violet-100' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {d.dayName}
            </span>
            <span
              className={`text-sm font-bold mt-0.5 ${
                isSelected ? 'text-white' : 'text-gray-900 dark:text-white'
              }`}
            >
              {d.dayNumber}
            </span>
          </button>
        );
      })}
    </div>
  );
};
