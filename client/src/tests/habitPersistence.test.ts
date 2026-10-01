import { describe, expect, it, beforeEach } from 'vitest';
import { Storage } from '../utils/storage';
import { checkAndRollOverHabits, getMondayOfWeek, getWeekId, parseIsoDate } from '../utils/habitWeekManager';
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

describe('Habits & Streaks Persistence and Sync Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    Storage.setHabits([]);
    Storage.setHabitHistory([]);
    Storage.setHabitActiveWeek('');
    Storage.setHabitActivities([]);
    Storage.setTrash([]);
  });

  it('adds a new habit, verifies in Storage and in getAllDataPayload', () => {
    const newHabit: HabitItem = {
      id: 'hb-gym-101',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [false, false, false, false, false, false, false],
      streak: 0,
      color: '#EF4444',
    };

    Storage.setHabits([newHabit]);
    const stored = Storage.getHabits();
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Gym');

    const payload = Storage.getAllDataPayload();
    expect(payload.habits).toHaveLength(1);
    expect(payload.habits[0].id).toBe('hb-gym-101');
    expect(payload.habits[0].title).toBe('Gym');
  });

  it('toggles a day on an existing habit and verifies completion and streak persistence', () => {
    const habit: HabitItem = {
      id: 'hb-gym-101',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [true, false, false, false, false, false, false],
      streak: 1,
      color: '#EF4444',
    };
    Storage.setHabits([habit]);

    // Update habit (toggle another day)
    const updated = Storage.getHabits().map((h) => {
      if (h.id === 'hb-gym-101') {
        const nextDays = [...h.completedDays];
        nextDays[1] = true; // Tue
        return {
          ...h,
          completedDays: nextDays,
          streak: 2,
        };
      }
      return h;
    });
    Storage.setHabits(updated);

    const verified = Storage.getHabits();
    expect(verified[0].completedDays[0]).toBe(true);
    expect(verified[0].completedDays[1]).toBe(true);
    expect(verified[0].streak).toBe(2);

    const payload = Storage.getAllDataPayload();
    expect(payload.habits[0].completedDays[1]).toBe(true);
  });

  it('does NOT overwrite newer local habits when incoming cloud payload has an empty habit list', () => {
    const gymHabit: HabitItem = {
      id: 'hb-gym-101',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [true, false, false, false, false, false, false],
      streak: 1,
      color: '#EF4444',
    };
    Storage.setHabits([gymHabit]);

    // Incoming cloud payload with empty habits array (e.g. uninitialized cloud state)
    const success = Storage.importAllDataPayload({
      habits: [],
      version: '4.0.0',
    });

    expect(success).toBe(true);
    const afterImport = Storage.getHabits();
    expect(afterImport).toHaveLength(1);
    expect(afterImport[0].title).toBe('Gym');
  });

  it('deterministically merges incoming cloud habits with existing local habits without dropping either', () => {
    const localGym: HabitItem = {
      id: 'hb-gym-local',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [false, true, false, false, false, false, false],
      streak: 1,
      color: '#EF4444',
    };
    Storage.setHabits([localGym]);

    const cloudRead: HabitItem = {
      id: 'hb-read-cloud',
      title: 'Read 20 pages',
      category: 'Learning',
      icon: '📚',
      completedDays: [true, false, false, false, false, false, false],
      streak: 3,
      color: '#3B82F6',
    };

    Storage.importAllDataPayload({
      habits: [cloudRead],
    });

    const merged = Storage.getHabits();
    expect(merged).toHaveLength(2);
    expect(merged.some((h) => h.id === 'hb-gym-local')).toBe(true);
    expect(merged.some((h) => h.id === 'hb-read-cloud')).toBe(true);
  });

  it('merges completedDays from both local and cloud so progress is never lost', () => {
    const localGym: HabitItem = {
      id: 'hb-gym-shared',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [false, true, false, false, false, false, false], // Tue done
      streak: 1,
      color: '#EF4444',
    };
    Storage.setHabits([localGym]);

    const cloudGym: HabitItem = {
      id: 'hb-gym-shared',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [true, false, false, false, false, false, false], // Mon done
      streak: 1,
      color: '#EF4444',
    };

    Storage.importAllDataPayload({
      habits: [cloudGym],
    });

    const merged = Storage.getHabits();
    expect(merged).toHaveLength(1);
    // Both Mon (0) and Tue (1) must be preserved as completed!
    expect(merged[0].completedDays[0]).toBe(true);
    expect(merged[0].completedDays[1]).toBe(true);
  });

  it('does NOT resurrect habits that were explicitly deleted and moved to trash', () => {
    const gymHabit: HabitItem = {
      id: 'hb-gym-deleted',
      title: 'Gym',
      category: 'Health',
      icon: '💪',
      completedDays: [false, false, false, false, false, false, false],
      streak: 0,
      color: '#EF4444',
    };
    // Simulate user deletion: habit removed from active list and moved to trash
    Storage.moveToTrash('habits', gymHabit, gymHabit.title);
    Storage.setHabits([]);

    // Incoming cloud payload still has the deleted habit
    Storage.importAllDataPayload({
      habits: [gymHabit],
    });

    // The trashed habit must NOT be resurrected
    const current = Storage.getHabits();
    expect(current).toHaveLength(0);
  });

  it('checkAndRollOverHabits does not roll over when week IDs match, even with week- prefix', () => {
    const now = new Date();
    const currentWeekId = getWeekId(now);
    const habits: HabitItem[] = [
      {
        id: 'hb-1',
        title: 'Gym',
        category: 'Health',
        icon: '💪',
        completedDays: [true, true, false, false, false, false, false],
        streak: 2,
        color: '#EF4444',
      },
    ];

    // Same week ID with prefix: "week-YYYY-MM-DD"
    const result1 = checkAndRollOverHabits(habits, `week-${currentWeekId}`, []);
    expect(result1.didRollover).toBe(false);
    expect(result1.updatedHabits[0].completedDays[0]).toBe(true);

    // Same week ID without prefix: "YYYY-MM-DD"
    const result2 = checkAndRollOverHabits(habits, currentWeekId, []);
    expect(result2.didRollover).toBe(false);
    expect(result2.updatedHabits[0].completedDays[0]).toBe(true);
  });

  it('parseIsoDate safely parses dates with or without week- prefix', () => {
    const d1 = parseIsoDate('2026-09-28');
    expect(d1.getFullYear()).toBe(2026);
    expect(d1.getMonth()).toBe(8); // September (0-indexed)
    expect(d1.getDate()).toBe(28);

    const d2 = parseIsoDate('week-2026-09-28');
    expect(d2.getFullYear()).toBe(2026);
    expect(d2.getMonth()).toBe(8);
    expect(d2.getDate()).toBe(28);
  });

  it('updates an existing habit using Storage.updateHabit and verifies persistence', () => {
    const habit: HabitItem = {
      id: 'hb-read-1',
      title: 'Read 10 pages',
      category: 'Learning',
      icon: '📖',
      completedDays: [true, false, false, false, false, false, false],
      streak: 1,
      color: '#3B82F6',
    };
    Storage.setHabits([habit]);

    // Update habit details
    const updated = Storage.updateHabit({
      ...habit,
      title: 'Read 25 pages daily',
      category: 'Growth',
      icon: '📚',
      streak: 5,
    });

    expect(updated[0].title).toBe('Read 25 pages daily');
    expect(updated[0].category).toBe('Growth');
    expect(updated[0].icon).toBe('📚');

    const stored = Storage.getHabits();
    expect(stored[0].title).toBe('Read 25 pages daily');
    expect(stored[0].streak).toBe(5);
  });

  it('preserves local habit custom updates when merging with cloud payload', () => {
    const localHabit: HabitItem = {
      id: 'hb-exercise',
      title: 'Workout & Cardio Extra',
      category: 'Health & Fitness',
      icon: '🏋️',
      completedDays: [true, true, false, false, false, false, false],
      streak: 2,
      color: '#10B981',
    };
    Storage.setHabits([localHabit]);

    const cloudHabit: HabitItem = {
      id: 'hb-exercise',
      title: 'Workout',
      category: 'Health',
      icon: '💪',
      completedDays: [true, false, false, false, false, false, false],
      streak: 1,
      color: '#EF4444',
    };

    Storage.importAllDataPayload({
      habits: [cloudHabit],
    });

    const result = Storage.getHabits();
    expect(result[0].title).toBe('Workout & Cardio Extra');
    expect(result[0].category).toBe('Health & Fitness');
    expect(result[0].icon).toBe('🏋️');
    expect(result[0].color).toBe('#10B981');
    expect(result[0].completedDays[1]).toBe(true);
  });

  it('never reverts habitActiveWeek to an older week from cloud payload', () => {
    const currentWeekMonday = getWeekId(new Date());
    Storage.setHabitActiveWeek(currentWeekMonday);

    // Incoming older week from cloud
    Storage.importAllDataPayload({
      habitActiveWeek: '2026-08-01',
    });

    const activeWeek = Storage.getHabitActiveWeek();
    expect(activeWeek).toBe(currentWeekMonday);
  });
});
