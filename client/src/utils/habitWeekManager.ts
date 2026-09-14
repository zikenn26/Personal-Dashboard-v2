import { HabitItem, HabitWeekRecord, HabitActivityLog } from '../types';

export const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Returns the Date object set to Monday 00:00:00 of the week containing the given date.
 * In JS, getDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday.
 */
export function getMondayOfWeek(d: Date = new Date()): Date {
  const date = new Date(d);
  const day = date.getDay();
  // Mon: (1+6)%7 = 0. Sun: (0+6)%7 = 6. Tue: (2+6)%7 = 1.
  const diff = (day + 6) % 7;
  date.setDate(date.getDate() - diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Returns the Date object set to Sunday 23:59:59 of the week containing the given Monday.
 */
export function getSundayOfWeek(monday: Date): Date {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Formats a Date as YYYY-MM-DD
 */
export function formatDateIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parses a YYYY-MM-DD string into a Date object at midnight local time
 */
export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/**
 * Returns the unique ID for a week based on its starting Monday: e.g. "2026-09-07"
 */
export function getWeekId(d: Date = new Date()): string {
  return formatDateIso(getMondayOfWeek(d));
}

/**
 * Formats a human-friendly week range: e.g. "Sep 7 – Sep 13, 2026"
 */
export function formatWeekRange(monday: Date): string {
  const sunday = getSundayOfWeek(monday);
  const monMonth = monday.toLocaleString('en-US', { month: 'short' });
  const sunMonth = sunday.toLocaleString('en-US', { month: 'short' });
  const year = sunday.getFullYear();

  if (monMonth === sunMonth) {
    return `${monMonth} ${monday.getDate()} – ${sunday.getDate()}, ${year}`;
  }
  return `${monMonth} ${monday.getDate()} – ${sunMonth} ${sunday.getDate()}, ${year}`;
}

/**
 * Returns details for all 7 days of the specified week (Mon=0 to Sun=6)
 */
export function getWeekDaysInfo(monday: Date = getMondayOfWeek()): Array<{
  name: string;
  dayIndex: number;
  dateStr: string;
  formattedDate: string;
  isToday: boolean;
}> {
  const todayIso = formatDateIso(new Date());
  return DAYS_OF_WEEK.map((name, idx) => {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + idx);
    const dateStr = formatDateIso(dayDate);
    return {
      name,
      dayIndex: idx,
      dateStr,
      formattedDate: `${name}, ${dayDate.toLocaleString('en-US', { month: 'short' })} ${dayDate.getDate()}`,
      isToday: dateStr === todayIso,
    };
  });
}

/**
 * Generates activity logs from completed days of habits for a specific week
 */
export function extractActivitiesFromHabits(
  habits: HabitItem[],
  monday: Date
): HabitActivityLog[] {
  const activities: HabitActivityLog[] = [];
  const daysInfo = getWeekDaysInfo(monday);

  habits.forEach((habit) => {
    habit.completedDays.forEach((isDone, dayIdx) => {
      if (isDone) {
        const info = daysInfo[dayIdx] || {
          name: DAYS_OF_WEEK[dayIdx],
          dateStr: formatDateIso(monday),
        };
        activities.push({
          id: `act-${habit.id}-${info.dateStr}`,
          habitId: habit.id,
          habitTitle: habit.title,
          category: habit.category,
          icon: habit.icon,
          color: habit.color,
          dayIndex: dayIdx,
          dayName: DAYS_OF_WEEK[dayIdx],
          date: info.dateStr,
          completed: true,
          timestamp: parseIsoDate(info.dateStr).getTime() + 12 * 3600 * 1000,
        });
      }
    });
  });

  return activities.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Default sample archive records for previous weeks if history is empty
 */
export function generateDefaultHabitHistory(currentMonday: Date = getMondayOfWeek()): HabitWeekRecord[] {
  const records: HabitWeekRecord[] = [];

  // Previous week 1 (Last week)
  const prev1Monday = new Date(currentMonday);
  prev1Monday.setDate(currentMonday.getDate() - 7);
  const prev1Sunday = getSundayOfWeek(prev1Monday);
  const prev1WeekStart = formatDateIso(prev1Monday);
  const prev1WeekEnd = formatDateIso(prev1Sunday);

  const prev1Habits: HabitItem[] = [
    {
      id: 'prev-hb-1',
      title: 'Deep Focus Coding',
      category: 'Work',
      icon: '⚡',
      completedDays: [true, true, true, true, true, false, false], // 5/7
      streak: 10,
      color: '#6366F1',
    },
    {
      id: 'prev-hb-2',
      title: 'Daily Workout & Cardio',
      category: 'Health',
      icon: '🏃',
      completedDays: [true, true, false, true, true, true, false], // 5/7
      streak: 6,
      color: '#10B981',
    },
    {
      id: 'prev-hb-3',
      title: 'Evening Reading',
      category: 'Growth',
      icon: '📚',
      completedDays: [true, true, true, true, true, true, false], // 6/7
      streak: 4,
      color: '#F59E0B',
    },
  ];

  const totalDone1 = prev1Habits.reduce((acc, h) => acc + h.completedDays.filter(Boolean).length, 0);
  const totalPoss1 = prev1Habits.length * 7;

  records.push({
    id: `week-${prev1WeekStart}`,
    weekStart: prev1WeekStart,
    weekEnd: prev1WeekEnd,
    label: formatWeekRange(prev1Monday),
    archivedAt: prev1Sunday.getTime(),
    completionRate: Math.round((totalDone1 / totalPoss1) * 100),
    totalDone: totalDone1,
    totalPossible: totalPoss1,
    habits: prev1Habits,
    activities: extractActivitiesFromHabits(prev1Habits, prev1Monday),
  });

  // Previous week 2 (2 weeks ago)
  const prev2Monday = new Date(currentMonday);
  prev2Monday.setDate(currentMonday.getDate() - 14);
  const prev2Sunday = getSundayOfWeek(prev2Monday);
  const prev2WeekStart = formatDateIso(prev2Monday);
  const prev2WeekEnd = formatDateIso(prev2Sunday);

  const prev2Habits: HabitItem[] = [
    {
      id: 'prev-hb-1',
      title: 'Deep Focus Coding',
      category: 'Work',
      icon: '⚡',
      completedDays: [true, true, true, true, false, false, false], // 4/7
      streak: 5,
      color: '#6366F1',
    },
    {
      id: 'prev-hb-2',
      title: 'Daily Workout & Cardio',
      category: 'Health',
      icon: '🏃',
      completedDays: [true, false, true, false, true, false, false], // 3/7
      streak: 2,
      color: '#10B981',
    },
    {
      id: 'prev-hb-3',
      title: 'Evening Reading',
      category: 'Growth',
      icon: '📚',
      completedDays: [true, true, true, true, true, false, false], // 5/7
      streak: 3,
      color: '#F59E0B',
    },
  ];

  const totalDone2 = prev2Habits.reduce((acc, h) => acc + h.completedDays.filter(Boolean).length, 0);
  const totalPoss2 = prev2Habits.length * 7;

  records.push({
    id: `week-${prev2WeekStart}`,
    weekStart: prev2WeekStart,
    weekEnd: prev2WeekEnd,
    label: formatWeekRange(prev2Monday),
    archivedAt: prev2Sunday.getTime(),
    completionRate: Math.round((totalDone2 / totalPoss2) * 100),
    totalDone: totalDone2,
    totalPossible: totalPoss2,
    habits: prev2Habits,
    activities: extractActivitiesFromHabits(prev2Habits, prev2Monday),
  });

  return records;
}

export interface RolloverResult {
  didRollover: boolean;
  newWeekId: string;
  updatedHabits: HabitItem[];
  updatedHistory: HabitWeekRecord[];
  archivedRecord?: HabitWeekRecord;
}

/**
 * Evaluates whether Monday has arrived or a new week has started.
 * If yes, archives the previous week's habits & activities, and resets current week habits fresh!
 */
export function checkAndRollOverHabits(
  currentHabits: HabitItem[],
  lastActiveWeekId: string | null,
  currentHistory: HabitWeekRecord[],
  now: Date = new Date()
): RolloverResult {
  const currentWeekId = getWeekId(now);

  // If no previous week recorded, this is initial initialization
  if (!lastActiveWeekId) {
    const historyToUse = currentHistory && currentHistory.length > 0
      ? currentHistory
      : generateDefaultHabitHistory(getMondayOfWeek(now));

    return {
      didRollover: false,
      newWeekId: currentWeekId,
      updatedHabits: currentHabits,
      updatedHistory: historyToUse,
    };
  }

  // If we are still in the same week, no rollover needed
  if (lastActiveWeekId === currentWeekId) {
    return {
      didRollover: false,
      newWeekId: currentWeekId,
      updatedHabits: currentHabits,
      updatedHistory: currentHistory,
    };
  }

  // NEW WEEK DETECTED (Monday or later in a new week)!
  // 1. Archive previous week's activities & habits
  const lastMonday = parseIsoDate(lastActiveWeekId);
  const lastSunday = getSundayOfWeek(lastMonday);
  const totalDone = currentHabits.reduce(
    (acc, h) => acc + h.completedDays.filter(Boolean).length,
    0
  );
  const totalPossible = currentHabits.length * 7;
  const completionRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  const previousRecord: HabitWeekRecord = {
    id: `week-${lastActiveWeekId}`,
    weekStart: lastActiveWeekId,
    weekEnd: formatDateIso(lastSunday),
    label: formatWeekRange(lastMonday),
    archivedAt: Date.now(),
    completionRate,
    totalDone,
    totalPossible,
    habits: JSON.parse(JSON.stringify(currentHabits)),
    activities: extractActivitiesFromHabits(currentHabits, lastMonday),
  };

  // Prepend or update archive, avoiding duplicate week records
  const filteredHistory = currentHistory.filter((r) => r.id !== previousRecord.id && r.weekStart !== lastActiveWeekId);
  const updatedHistory = [previousRecord, ...filteredHistory];

  // 2. Start fresh for the new week!
  const freshHabits: HabitItem[] = currentHabits.map((h) => {
    const wasActiveLastWeek = h.completedDays.filter(Boolean).length >= 4;
    return {
      ...h,
      completedDays: [false, false, false, false, false, false, false],
      // If user had strong consistency, preserve or reward streak, otherwise keep count
      streak: wasActiveLastWeek ? h.streak : Math.max(0, Math.floor(h.streak * 0.8)),
    };
  });

  return {
    didRollover: true,
    newWeekId: currentWeekId,
    updatedHabits: freshHabits,
    updatedHistory,
    archivedRecord: previousRecord,
  };
}

/**
 * Archives current week's habits and activities into a HabitWeekRecord
 */
export function archiveCurrentWeekRecord(
  habits: HabitItem[],
  weekId: string,
  activities: HabitActivityLog[] = []
): HabitWeekRecord {
  const monday = parseIsoDate(weekId);
  const sunday = getSundayOfWeek(monday);
  const totalDone = habits.reduce((acc, h) => acc + h.completedDays.filter(Boolean).length, 0);
  const totalPossible = habits.length * 7;
  const completionRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

  const derivedActivities = extractActivitiesFromHabits(habits, monday);
  const mergedActivities = [...activities];
  derivedActivities.forEach((act) => {
    if (!mergedActivities.some((m) => m.id === act.id)) {
      mergedActivities.push(act);
    }
  });

  return {
    id: `week-${weekId}`,
    weekStart: weekId,
    weekEnd: formatDateIso(sunday),
    label: formatWeekRange(monday),
    archivedAt: Date.now(),
    completionRate,
    totalDone,
    totalPossible,
    habits: JSON.parse(JSON.stringify(habits)),
    activities: mergedActivities,
  };
}

