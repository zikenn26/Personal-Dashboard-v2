import React, { useState } from 'react';
import { Target, CheckSquare, CreditCard, Flame, FileText, BookOpen, Film, Briefcase } from 'lucide-react';
import {
  UserProfile,
  TodoItem,
  HabitItem,
  QuoteItem,
  ExpenseItem,
  WeeklyScheduleData,
  Priority,
  TaskStatus,
  MainNavView,
  JournalEntry,
} from '../../../../types';
import { INITIAL_QUOTES } from '../../../../utils/storage';
import { nativeService } from '../../../../services/nativeService';
import { HorizontalPager } from '../../gestures/HorizontalPager';
import { AndroidWeatherWidget } from './AndroidWeatherWidget';
import { AndroidScratchPad } from './AndroidScratchPad';
import { AndroidDateStrip } from '../../components/AndroidDateStrip';
import { AndroidTasksCard } from './AndroidTasksCard';
import { AndroidSpendingCard } from './AndroidSpendingCard';
import { AndroidHabitsCard } from './AndroidHabitsCard';
import { AndroidScreenTimeCard } from './AndroidScreenTimeCard';
import { QuickTaskSheet } from '../../components/QuickTaskSheet';
import { QuickExpenseSheet } from '../../components/QuickExpenseSheet';
import { QuickHabitSheet } from '../../components/QuickHabitSheet';
import { QuickNoteSheet } from '../../components/QuickNoteSheet';

export interface AndroidHomeScreenProps {
  profile: UserProfile;
  todos: TodoItem[];
  habits: HabitItem[];
  quotes: QuoteItem[];
  expenses: ExpenseItem[];
  schedule?: WeeklyScheduleData;
  onNavigate: (view: MainNavView) => void;
  onToggleTodo: (id: string) => void;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onDeleteTodo?: (id: string) => void;
  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  onAddDiaryEntry?: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
}

export const AndroidHomeScreen: React.FC<AndroidHomeScreenProps> = ({
  profile,
  todos,
  habits,
  quotes,
  expenses,
  schedule,
  onNavigate,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onToggleHabitDay,
  onAddTodo,
  onAddExpense,
  onAddHabit,
  onAddDiaryEntry,
}) => {
  // Active modal sheets for Quick Access
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isExpenseSheetOpen, setIsExpenseSheetOpen] = useState(false);
  const [isHabitSheetOpen, setIsHabitSheetOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);

  return (
    <div className="w-full max-w-lg mx-auto space-y-2.5 px-3.5 pb-24 pt-1.5">
      {/* 1. COMPACT WEATHER WIDGET (Topmost) */}
      <AndroidWeatherWidget />

      {/* 2. STICKY NOTES / SCRATCH PAD */}
      <AndroidScratchPad />

      {/* 3. TODAY'S TASKS CARD */}
      <AndroidTasksCard
        todos={todos}
        onToggleTodo={onToggleTodo}
        onUpdateTodo={onUpdateTodo}
        onDeleteTodo={onDeleteTodo}
        onNavigateToTasks={() => onNavigate('tasks')}
        onOpenAddTask={() => setIsTaskSheetOpen(true)}
      />

      {/* 7. SPENDING SNAPSHOT CARD */}
      <AndroidSpendingCard
        expenses={expenses}
        onNavigateToMoney={() => onNavigate('expenses')}
        onOpenAddExpense={() => setIsExpenseSheetOpen(true)}
      />

      {/* 8. HABITS CARD */}
      <AndroidHabitsCard
        habits={habits}
        onToggleHabitDay={onToggleHabitDay}
        onNavigateToHabits={() => onNavigate('habits')}
        onOpenAddHabit={() => setIsHabitSheetOpen(true)}
      />

      {/* 9. SCREEN TIME CARD */}
      <AndroidScreenTimeCard
        onNavigateToScreenTime={() => onNavigate('screentime')}
      />

      {/* QUICK MODAL BOTTOM SHEETS */}
      {onAddTodo && (
        <QuickTaskSheet
          isOpen={isTaskSheetOpen}
          onClose={() => setIsTaskSheetOpen(false)}
          onAddTodo={onAddTodo}
        />
      )}

      {onAddExpense && (
        <QuickExpenseSheet
          isOpen={isExpenseSheetOpen}
          onClose={() => setIsExpenseSheetOpen(false)}
          onAddExpense={onAddExpense}
        />
      )}

      {onAddHabit && (
        <QuickHabitSheet
          isOpen={isHabitSheetOpen}
          onClose={() => setIsHabitSheetOpen(false)}
          onAddHabit={onAddHabit}
        />
      )}

      {onAddDiaryEntry && (
        <QuickNoteSheet
          isOpen={isNoteSheetOpen}
          onClose={() => setIsNoteSheetOpen(false)}
          onAddDiaryEntry={onAddDiaryEntry}
        />
      )}
    </div>
  );
};
