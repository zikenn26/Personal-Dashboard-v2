import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { WeeklyScheduleData, DayOfWeek, ScheduleActivity } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { CARD_SURFACE_CLASSES, CARD_HEADER_CLASSES, CARD_TITLE_CLASSES, CARD_BODY_CLASSES } from '../../design-system/materialYou';

export interface AndroidScheduleCardProps {
  schedule?: WeeklyScheduleData;
  onNavigateToSchedule?: () => void;
}

const DAYS: { key: DayOfWeek; short: string; label: string }[] = [
  { key: 'monday', short: 'M', label: 'Mon' },
  { key: 'tuesday', short: 'T', label: 'Tue' },
  { key: 'wednesday', short: 'W', label: 'Wed' },
  { key: 'thursday', short: 'T', label: 'Thu' },
  { key: 'friday', short: 'F', label: 'Fri' },
  { key: 'saturday', short: 'S', label: 'Sat' },
  { key: 'sunday', short: 'S', label: 'Sun' },
];

const getTodayDayOfWeek = (): DayOfWeek => {
  const dayIdx = new Date().getDay(); // 0 is Sunday
  const map: DayOfWeek[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return map[dayIdx];
};

export const AndroidScheduleCard: React.FC<AndroidScheduleCardProps> = ({ schedule }) => {
  const todayKey = getTodayDayOfWeek();
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayKey);

  const activities: ScheduleActivity[] = schedule?.[selectedDay] || [];

  return (
    <div className={CARD_SURFACE_CLASSES}>
      {/* Header */}
      <div className={CARD_HEADER_CLASSES}>
        <div className={CARD_TITLE_CLASSES}>
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <span>This Week&apos;s Schedule</span>
        </div>

        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
          {DAYS.find((d) => d.key === selectedDay)?.label}
        </span>
      </div>

      {/* Body */}
      <div className={CARD_BODY_CLASSES}>
        {/* Day Selector Pills */}
        <div className="flex items-center justify-between gap-1 mb-3.5 p-1 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]">
          {DAYS.map((d) => {
            const isSelected = selectedDay === d.key;
            const isToday = todayKey === d.key;
            return (
              <button
                key={d.key}
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setSelectedDay(d.key);
                }}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                  isSelected
                    ? 'bg-violet-600 text-white shadow-xs'
                    : isToday
                    ? 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                <span>{d.label}</span>
                {isToday && !isSelected && (
                  <span className="w-1 h-1 rounded-full bg-violet-600 dark:bg-violet-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Schedule Activities List */}
        {activities.length === 0 ? (
          <div className="py-5 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No specific activities scheduled for {DAYS.find((d) => d.key === selectedDay)?.label}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.slice(0, 4).map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                  <div
                    style={{ backgroundColor: act.color || '#7C3AED' }}
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white block truncate">
                      {act.title}
                    </span>
                    {act.category && (
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                        {act.category}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[11px] font-mono text-gray-500 dark:text-gray-400 shrink-0">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span>{act.time}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
