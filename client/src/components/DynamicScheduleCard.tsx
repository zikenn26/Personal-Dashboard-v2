import React, { useState, useMemo } from 'react';
import {
  WeeklyScheduleData,
  ScheduleActivity,
  DayOfWeek,
} from '../types';
import { Sound } from '../utils/audio';
import { DEFAULT_SCHEDULE_ACTIVITIES } from '../utils/storage';
import {
  Edit3,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Copy,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

interface DynamicScheduleCardProps {
  schedule: WeeklyScheduleData;
  onUpdateSchedule: (updated: WeeklyScheduleData) => void;
  soundEnabled: boolean;
}

export const DAY_KEYS: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_METADATA: Record<
  DayOfWeek,
  { short: string; label: string; isWeekend: boolean }
> = {
  monday: { short: 'Mon', label: 'Monday', isWeekend: false },
  tuesday: { short: 'Tue', label: 'Tuesday', isWeekend: false },
  wednesday: { short: 'Wed', label: 'Wednesday', isWeekend: false },
  thursday: { short: 'Thu', label: 'Thursday', isWeekend: false },
  friday: { short: 'Fri', label: 'Friday', isWeekend: false },
  saturday: { short: 'Sat', label: 'Saturday', isWeekend: true },
  sunday: { short: 'Sun', label: 'Sunday', isWeekend: true },
};

const getTodayKey = (): DayOfWeek => {
  const day = new Date().getDay(); // 0 is Sunday
  const map: DayOfWeek[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  return map[day];
};

const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const match12 = timeStr.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
  if (match12) {
    let hours = parseInt(match12[1], 10) || 0;
    const minutes = parseInt(match12[2] || '0', 10);
    const ampm = match12[3]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 0;
};

export const DynamicScheduleCard: React.FC<DynamicScheduleCardProps> = ({
  schedule,
  onUpdateSchedule,
  soundEnabled,
}) => {
  const todayKey = useMemo(() => getTodayKey(), []);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(todayKey);
  const [isEditing, setIsEditing] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  // Derive current day's active activities
  const currentActivities: ScheduleActivity[] = useMemo(() => {
    const dayConfig = schedule.days?.[selectedDay];
    if (dayConfig?.isCustomized && Array.isArray(dayConfig.activities)) {
      return dayConfig.activities;
    }

    const isWeekend = DAY_METADATA[selectedDay].isWeekend;
    const template = isWeekend ? schedule.weekendTemplate : schedule.weekdayTemplate;
    if (Array.isArray(template) && template.length > 0) {
      return template;
    }

    return DEFAULT_SCHEDULE_ACTIVITIES;
  }, [schedule, selectedDay]);

  // Helper to commit changes to the selected day
  const updateActivities = (newActivities: ScheduleActivity[]) => {
    onUpdateSchedule({
      ...schedule,
      days: {
        ...schedule.days,
        [selectedDay]: {
          isCustomized: true,
          activities: newActivities,
        },
      },
    });
  };

  // Inline edit handlers
  const handleUpdateRow = (id: string, field: 'time' | 'title', value: string) => {
    const updated = currentActivities.map((act) =>
      act.id === id ? { ...act, [field]: value } : act
    );
    updateActivities(updated);
  };

  const handleAddRow = () => {
    Sound.click(soundEnabled);
    const newId = `sch-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    const newRow: ScheduleActivity = {
      id: newId,
      time: '12:00 PM',
      title: 'activity',
    };
    const updated = [...currentActivities, newRow];
    updateActivities(updated);
    setEditingRowId(newId);
    setIsEditing(true);
  };

  const handleDeleteRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    Sound.click(soundEnabled);
    const updated = currentActivities.filter((act) => act.id !== id);
    updateActivities(updated);
  };

  const handleSortByTime = () => {
    Sound.click(soundEnabled);
    const sorted = [...currentActivities].sort(
      (a, b) => parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
    );
    updateActivities(sorted);
  };

  const handleResetToDefault = () => {
    Sound.click(soundEnabled);
    updateActivities([...DEFAULT_SCHEDULE_ACTIVITIES]);
    setCopyNotification('Reset to default schedule');
    setTimeout(() => setCopyNotification(null), 2000);
  };

  const handleCopyToAllDays = () => {
    Sound.success(soundEnabled);
    const updatedDays = { ...schedule.days };
    DAY_KEYS.forEach((day) => {
      updatedDays[day] = {
        isCustomized: true,
        activities: currentActivities.map((act, index) => ({
          ...act,
          id: `sch-${day}-${Date.now()}-${index}`,
        })),
      };
    });
    onUpdateSchedule({
      ...schedule,
      days: updatedDays,
    });
    setCopyNotification('Applied to all 7 days');
    setTimeout(() => setCopyNotification(null), 2000);
  };

  const handlePrevDay = () => {
    Sound.click(soundEnabled);
    const idx = DAY_KEYS.indexOf(selectedDay);
    setSelectedDay(DAY_KEYS[idx === 0 ? DAY_KEYS.length - 1 : idx - 1]);
  };

  const handleNextDay = () => {
    Sound.click(soundEnabled);
    const idx = DAY_KEYS.indexOf(selectedDay);
    setSelectedDay(DAY_KEYS[idx === DAY_KEYS.length - 1 ? 0 : idx + 1]);
  };

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] shadow-2xs space-y-4">
      {/* Top Bar: Reference Header Badge & Action Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Header Badge as seen in reference image */}
        <div className="flex items-center gap-2">
          <div className="inline-block bg-[#F1F1EF] dark:bg-[#334155]/70 px-3 py-1 rounded text-xs sm:text-sm font-bold tracking-widest uppercase text-[#37352F] dark:text-[#E2E8F0] select-none">
            SCHEDULE
          </div>
          {copyNotification && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
              {copyNotification}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {isEditing && (
            <>
              <button
                type="button"
                onClick={handleSortByTime}
                title="Sort activities chronologically by time"
                className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">Sort</span>
              </button>
              <button
                type="button"
                onClick={handleCopyToAllDays}
                title="Copy current schedule to all days"
                className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">Copy to all</span>
              </button>
              <button
                type="button"
                onClick={handleResetToDefault}
                title="Reset to default routine"
                className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-xs cursor-pointer transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="text-[11px] hidden sm:inline">Reset</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleAddRow}
            title="Add new activity row"
            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-[#0F172A] hover:bg-gray-200 dark:hover:bg-[#334155] text-[#37352F] dark:text-[#E2E8F0] border border-gray-200 dark:border-[#334155] cursor-pointer transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>Add row</span>
          </button>

          <button
            type="button"
            onClick={() => {
              Sound.click(soundEnabled);
              setIsEditing(!isEditing);
              setEditingRowId(null);
            }}
            className={`px-3 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition-all flex items-center gap-1.5 ${
              isEditing
                ? 'bg-[#6366F1] text-white border-[#6366F1] shadow-2xs'
                : 'bg-white dark:bg-[#0F172A] border-[#E2E8F0] dark:border-[#334155] text-[#37352F] dark:text-[#E2E8F0] hover:border-[#6366F1]'
            }`}
          >
            {isEditing ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Done</span>
              </>
            ) : (
              <>
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Subtle Day Navigation */}
      <div className="flex items-center justify-between gap-1 bg-[#F8FAFC] dark:bg-[#0F172A] p-1 rounded-xl border border-[#E2E8F0] dark:border-[#334155]/60">
        <button
          type="button"
          onClick={handlePrevDay}
          title="Previous day"
          className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-white dark:hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1 overflow-x-auto py-0.5 px-0.5 justify-between flex-1 scrollbar-none">
          {DAY_KEYS.map((key) => {
            const isSelected = selectedDay === key;
            const isToday = todayKey === key;
            const meta = DAY_METADATA[key];

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  Sound.click(soundEnabled);
                  setSelectedDay(key);
                }}
                className={`relative px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer text-center flex-1 min-w-[32px] ${
                  isSelected
                    ? 'bg-[#37352F] dark:bg-white text-white dark:text-[#0F172A] shadow-2xs font-bold'
                    : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-white/70 dark:hover:bg-[#1E293B]/70'
                }`}
              >
                <span>{meta.short}</span>
                {isToday && (
                  <span
                    className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${
                      isSelected ? 'bg-indigo-400 dark:bg-indigo-600' : 'bg-indigo-500'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNextDay}
          title="Next day"
          className="p-1 text-gray-500 hover:text-gray-800 dark:hover:text-white hover:bg-white dark:hover:bg-[#1E293B] rounded-lg transition-colors cursor-pointer shrink-0"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tabular Schedule View (Matching the Screenshot) */}
      <div className="overflow-hidden rounded-lg border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A]">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#E2E8F0] dark:border-[#334155] bg-[#F7F6F3]/80 dark:bg-[#1E293B]/80 text-[#787774] dark:text-[#94A3B8]">
              <th className="py-2.5 px-4 font-bold uppercase tracking-wider w-[125px] sm:w-[150px] border-r border-[#E2E8F0] dark:border-[#334155]">
                TIME
              </th>
              <th className="py-2.5 px-4 font-bold uppercase tracking-wider">
                ACTIVITY
              </th>
              {isEditing && (
                <th className="py-2.5 px-2 font-bold uppercase tracking-wider w-10 text-center">
                  
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#334155]">
            {currentActivities.length === 0 ? (
              <tr>
                <td
                  colSpan={isEditing ? 3 : 2}
                  className="py-8 text-center text-[#787774] dark:text-[#94A3B8] italic"
                >
                  No activities scheduled for {DAY_METADATA[selectedDay].label}.
                  <br />
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add activity
                  </button>
                </td>
              </tr>
            ) : (
              currentActivities.map((act) => {
                const isThisRowEditing = isEditing || editingRowId === act.id;

                return (
                  <tr
                    key={act.id}
                    onClick={() => {
                      if (!isEditing) {
                        setEditingRowId(act.id);
                      }
                    }}
                    className={`transition-colors group ${
                      isThisRowEditing
                        ? 'bg-indigo-50/20 dark:bg-indigo-950/20'
                        : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]/50'
                    }`}
                  >
                    {/* TIME Column */}
                    <td className="py-2 px-4 border-r border-[#E2E8F0] dark:border-[#334155] align-middle font-medium text-[#37352F] dark:text-[#E2E8F0]">
                      {isThisRowEditing ? (
                        <input
                          type="text"
                          value={act.time}
                          placeholder="e.g. 7:00 AM"
                          onChange={(e) => handleUpdateRow(act.id, 'time', e.target.value)}
                          className="w-full px-2 py-1 bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#475569] rounded text-xs font-semibold text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                        />
                      ) : (
                        <span className="font-semibold tracking-wide select-none">
                          {act.time}
                        </span>
                      )}
                    </td>

                    {/* ACTIVITY Column */}
                    <td className="py-2 px-4 align-middle text-[#37352F] dark:text-[#E2E8F0]">
                      {isThisRowEditing ? (
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={act.title}
                            placeholder="e.g. wake up"
                            onChange={(e) => handleUpdateRow(act.id, 'title', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (editingRowId === act.id && !isEditing) {
                                  setEditingRowId(null);
                                }
                              }
                            }}
                            className="w-full px-2 py-1 bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#475569] rounded text-xs text-[#37352F] dark:text-white focus:outline-hidden focus:border-[#6366F1]"
                          />
                          {!isEditing && editingRowId === act.id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingRowId(null);
                              }}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition-colors cursor-pointer"
                              title="Save inline edit"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-[#37352F] dark:text-[#CBD5E1]">
                            {act.title}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRowId(act.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-opacity cursor-pointer"
                            title="Edit row"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>

                    {/* Delete Column (in Edit Mode) */}
                    {isEditing && (
                      <td className="py-2 px-2 text-center align-middle">
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRow(act.id, e)}
                          title="Delete row"
                          className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Bottom "+ Add Row" row for seamless Notion-like addition */}
        <div
          onClick={handleAddRow}
          className="border-t border-[#E2E8F0] dark:border-[#334155] px-4 py-2 bg-[#F8FAFC]/50 dark:bg-[#0F172A]/50 hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] text-[11px] font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1.5 select-none"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add new row</span>
        </div>
      </div>
    </div>
  );
};
