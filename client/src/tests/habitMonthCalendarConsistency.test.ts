import { describe, expect, it, beforeEach } from 'vitest';
import { Storage } from '../utils/storage';
import {
  getMonthCalendarData,
  isHabitDateCompleted,
  toggleHabitDate,
  getMondayOfWeek,
  formatDateIso,
} from '../utils/habitWeekManager';
import { HabitItem } from '../types';

if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
    key: (idx: number) => Object.keys(store)[idx] || null,
    length: 0,
  } as any;
}

describe('Habit Month Calendar & Consistency (Web + Android)', () => {
  beforeEach(() => {
    localStorage.clear();
    Storage.setHabits([]);
    Storage.setHabitActivities([]);
  });

  it('generates accurate month calendar data with Monday-first week structure', () => {
    // October 2026: 31 days. Oct 1, 2026 is a Thursday (Monday=0 -> Thu=3)
    const octData = getMonthCalendarData(2026, 9);
    expect(octData.daysInMonth).toBe(31);
    expect(octData.leadingBlankCount).toBe(3); // Mon, Tue, Wed are blank
    expect(octData.days).toHaveLength(31);
    expect(octData.days[0].dateStr).toBe('2026-10-01');
    expect(octData.days[30].dateStr).toBe('2026-10-31');

    // February 2024 (Leap year): 29 days
    const feb2024 = getMonthCalendarData(2024, 1);
    expect(feb2024.daysInMonth).toBe(29);
  });

  it('marks and unmarks any day in the month calendar correctly', () => {
    const monday = getMondayOfWeek(new Date(2026, 9, 8)); // October 8, 2026
    const habit: HabitItem = {
      id: 'hb-read-101',
      title: 'Daily Reading',
      category: 'Learning',
      icon: '📚',
      completedDays: [false, false, false, false, false, false, false],
      completedDates: [],
      streak: 0,
      color: '#7b2cbf',
    };

    // 1. Mark Oct 5, 2026
    const marked = toggleHabitDate(habit, '2026-10-05', monday);
    expect(isHabitDateCompleted(marked, '2026-10-05', monday)).toBe(true);
    expect(marked.completedDates).toContain('2026-10-05');

    // 2. Mark Oct 12, 2026 (another week in the month)
    const markedSecond = toggleHabitDate(marked, '2026-10-12', monday);
    expect(isHabitDateCompleted(markedSecond, '2026-10-12', monday)).toBe(true);
    expect(markedSecond.completedDates).toContain('2026-10-05');
    expect(markedSecond.completedDates).toContain('2026-10-12');

    // 3. Unmark Oct 5, 2026 by clicking it again
    const unmarked = toggleHabitDate(markedSecond, '2026-10-05', monday);
    expect(isHabitDateCompleted(unmarked, '2026-10-05', monday)).toBe(false);
    expect(unmarked.completedDates).not.toContain('2026-10-05');
    expect(unmarked.completedDates).toContain('2026-10-12');
  });

  it('synchronizes completedDates with completedDays for dates in the current week', () => {
    const today = new Date();
    const monday = getMondayOfWeek(today);
    const mondayIso = formatDateIso(monday);

    const habit: HabitItem = {
      id: 'hb-workout',
      title: 'Workout',
      category: 'Fitness',
      icon: '🏋️',
      completedDays: [false, false, false, false, false, false, false],
      streak: 0,
      color: '#10B981',
    };

    // Mark current week's Monday
    const toggled = toggleHabitDate(habit, mondayIso, monday);
    expect(toggled.completedDays[0]).toBe(true); // Monday is day 0
    expect(toggled.completedDates).toContain(mondayIso);

    // Unmark current week's Monday
    const untoggled = toggleHabitDate(toggled, mondayIso, monday);
    expect(untoggled.completedDays[0]).toBe(false);
    expect(untoggled.completedDates).not.toContain(mondayIso);
  });

  it('persists completedDates through Storage and getAllDataPayload export/import', () => {
    const habitWithDates: HabitItem = {
      id: 'hb-meditation',
      title: 'Mindful Meditation',
      category: 'Mindfulness',
      icon: '🧘',
      completedDays: [true, false, true, false, false, false, false],
      completedDates: ['2026-10-01', '2026-10-02', '2026-10-05'],
      streak: 3,
      color: '#6100a4',
    };

    Storage.setHabits([habitWithDates]);

    // Verify storage read
    const loaded = Storage.getHabits();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].completedDates).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);

    // Verify backup payload roundtrip
    const payload = Storage.getAllDataPayload();
    expect(payload.habits[0].completedDates).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);

    // Clear storage and import payload back
    Storage.setHabits([]);
    expect(Storage.getHabits()).toHaveLength(0);

    const imported = Storage.importAllDataPayload(payload);
    expect(imported).toBe(true);

    const restored = Storage.getHabits();
    expect(restored).toHaveLength(1);
    expect(restored[0].completedDates).toEqual(['2026-10-01', '2026-10-02', '2026-10-05']);
  });
});
