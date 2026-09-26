import React, { useState, useEffect } from 'react';
import { ArrowLeft, Sparkles } from 'lucide-react';
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
  AppSettings,
  GoalItem,
  MediaItem,
  VaultCredential,
  ExcelImportLog,
  ResumeDocument,
  ExamItem,
  PortfolioProject,
  LifeMilestone,
  SkillCategory,
} from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { AndroidTopAppBar } from '../navigation/AndroidTopAppBar';
import { AndroidBottomNav } from '../navigation/AndroidBottomNav';
import { AndroidMoreSheet } from '../navigation/AndroidMoreSheet';
import { AndroidHomeScreen } from '../screens/home/AndroidHomeScreen';

// Android-first dedicated presentation screens
import { AndroidTasksScreen } from '../screens/tasks/AndroidTasksScreen';
import { AndroidMoneyScreen } from '../screens/money/AndroidMoneyScreen';
import { AndroidHabitsScreen } from '../screens/habits/AndroidHabitsScreen';
import { AndroidGoalsScreen } from '../screens/goals/AndroidGoalsScreen';
import { AndroidExamsScreen } from '../screens/exams/AndroidExamsScreen';
import { AndroidLifeMapScreen } from '../screens/lifemap/AndroidLifeMapScreen';
import { AndroidJournalScreen } from '../screens/journal/AndroidJournalScreen';
import { AndroidQuotesScreen } from '../screens/quotes/AndroidQuotesScreen';
import { AndroidLibraryScreen } from '../screens/library/AndroidLibraryScreen';
import { AndroidPortfolioScreen } from '../screens/portfolio/AndroidPortfolioScreen';
import { AndroidVaultScreen } from '../screens/vault/AndroidVaultScreen';
import { AndroidBackupScreen } from '../screens/backup/AndroidBackupScreen';

// Search and Profile overlays
import { AndroidSearchOverlay } from '../components/AndroidSearchOverlay';
import { AndroidProfileSheet } from '../components/AndroidProfileSheet';
import { AndroidAssistantSheet } from '../components/AndroidAssistantSheet';

export interface AndroidShellProps {
  // Navigation & View state
  activeView: MainNavView;
  onNavigate: (view: MainNavView) => void;

  // Global App State
  profile: UserProfile;
  todos: TodoItem[];
  habits: HabitItem[];
  quotes: QuoteItem[];
  expenses: ExpenseItem[];
  schedule?: WeeklyScheduleData;
  journal: JournalEntry[];
  goals: GoalItem[];
  media: MediaItem[];
  vault: VaultCredential[];
  settings: AppSettings;
  excelImportLogs?: ExcelImportLog[];
  resume?: ResumeDocument;
  exams?: ExamItem[];
  projects?: PortfolioProject[];
  milestones?: LifeMilestone[];
  skills?: SkillCategory[];

  // Mutators
  onToggleTodo: (id: string) => void;
  onAddTodo?: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onUpdateTodo?: (id: string, updates: Partial<TodoItem>) => void;
  onUpdateTaskStatus?: (id: string, status: TaskStatus) => void;
  onDeleteTodo?: (id: string) => void;
  onClearCompletedTodos?: () => void;

  onAddExpense?: (item: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updates: Partial<ExpenseItem>) => void;
  onBatchAddExpenses?: (items: Omit<ExpenseItem, 'id'>[]) => void;
  onToggleExpense?: (id: string) => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteBatchExpenses?: (batchId: any) => void;
  onDeleteImportLog?: (logId: string) => void;

  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit?: (title: string, category: string, icon: string, color: string) => void;
  onDeleteHabit?: (habitId: string) => void;
  onResetHabitWeek?: () => void;
  onSimulateMondayRollover?: () => void;
  onToggleHistoricalHabitDay?: (habitId: string, weekId: string, dayIndex: number) => void;
  onAddHistoricalHabit?: (weekId: string, title: string, category: string, icon: string, color: string) => void;
  onDeleteHistoricalHabit?: (habitId: string, weekId: string) => void;
  habitHistory?: any[];
  habitActivities?: any[];

  onAddDiaryEntry?: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  onDeleteDiaryEntry?: (id: string) => void;

  onAddQuote?: (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => void;
  onUpdateQuote?: (id: string, updates: Partial<QuoteItem>) => void;
  onDeleteQuote?: (id: string) => void;

  onAddGoal?: (goal: Omit<GoalItem, 'id' | 'createdAt'>) => void;
  onUpdateGoal?: (id: string, updates: Partial<GoalItem>) => void;
  onDeleteGoal?: (id: string) => void;

  onUpdateExams?: (exams: ExamItem[]) => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
  onUpdateProjects?: (projects: PortfolioProject[]) => void;
  onUpdateSkills?: (skills: SkillCategory[]) => void;
  onUpdateResume?: (resume: ResumeDocument) => void;
  onAddProject?: (project: Omit<PortfolioProject, 'id'>) => void;
  onDeleteProject?: (id: string) => void;

  onAddMedia?: (media: Omit<MediaItem, 'id'>) => void;
  onUpdateMediaRating?: (id: string, rating: number) => void;
  onDeleteMedia?: (id: string) => void;

  onAddVaultSecret?: (secret: Omit<VaultCredential, 'id' | 'updatedAt'>) => void;
  onDeleteVaultSecret?: (id: string) => void;

  onExportData?: () => void;
  onImportData?: (file: any) => void;
  onResetData?: () => void;

  onOpenSearch?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenSmsSettings?: () => void;
  onToggleDarkMode?: () => void;
  onToggleSound?: () => void;
  onRefresh?: () => Promise<void> | void;
}

export const AndroidShell: React.FC<AndroidShellProps> = ({
  activeView,
  onNavigate,
  profile,
  todos,
  habits,
  quotes,
  expenses,
  schedule,
  journal,
  goals,
  media,
  vault,
  settings,
  excelImportLogs = [],
  resume,
  exams = [],
  projects = [],
  milestones = [],
  skills = [],
  onToggleTodo,
  onAddTodo,
  onUpdateTodo,
  onUpdateTaskStatus,
  onDeleteTodo,
  onClearCompletedTodos,
  onAddExpense,
  onUpdateExpense,
  onBatchAddExpenses,
  onToggleExpense,
  onDeleteExpense,
  onDeleteBatchExpenses,
  onDeleteImportLog,
  onToggleHabitDay,
  onAddHabit,
  onDeleteHabit,
  onResetHabitWeek,
  onSimulateMondayRollover,
  onToggleHistoricalHabitDay,
  onAddHistoricalHabit,
  onDeleteHistoricalHabit,
  habitHistory = [],
  habitActivities = [],
  onAddDiaryEntry,
  onDeleteDiaryEntry,
  onAddQuote,
  onUpdateQuote,
  onDeleteQuote,
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  onUpdateExams,
  onUpdateProfile,
  onUpdateProjects,
  onUpdateSkills,
  onUpdateResume,
  onAddProject,
  onDeleteProject,
  onAddMedia,
  onUpdateMediaRating,
  onDeleteMedia,
  onAddVaultSecret,
  onDeleteVaultSecret,
  onExportData,
  onImportData,
  onResetData,
  onOpenSearch,
  onOpenProfile,
  onOpenSettings,
  onOpenSmsSettings,
  onToggleDarkMode,
  onToggleSound,
  onRefresh,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Android hardware back button handler
  useEffect(() => {
    const unregister = nativeService.registerBackButtonHandler(() => {
      // 1. If assistant is open, close it
      if (isAssistantOpen) {
        setIsAssistantOpen(false);
        return true;
      }
      // 2. If search is open, close it
      if (isSearchOpen) {
        setIsSearchOpen(false);
        return true;
      }
      // 3. If profile is open, close it
      if (isProfileOpen) {
        setIsProfileOpen(false);
        return true;
      }
      // 4. If "More" bottom sheet is open, close it
      if (isMoreOpen) {
        setIsMoreOpen(false);
        return true;
      }
      // 5. If not on 'home', return to 'home'
      if (activeView !== 'home') {
        onNavigate('home');
        return true;
      }
      // 6. At home root level: return false to let Android minimize or exit app
      return false;
    });

    return unregister;
  }, [isAssistantOpen, isSearchOpen, isProfileOpen, isMoreOpen, activeView, onNavigate]);

  const pendingTodosCount = todos.filter((t) => !t.completed && t.status !== 'complete').length;

  // View title helper for non-home views
  const getViewHeaderTitle = (): string => {
    switch (activeView) {
      case 'tasks':
        return 'Tasks & To-Dos';
      case 'expenses':
      case 'subscriptions':
        return 'Money & Spending';
      case 'habits':
        return 'Habits & Momentum';
      case 'journal':
        return 'Dear Diary';
      case 'quotes':
        return 'Quotes & Mantras';
      case 'goals':
        return 'Life Goals';
      case 'timeline':
        return 'Life Map';
      case 'exams':
        return 'Competitive Exams';
      case 'workfolio':
      case 'portfolio':
      case 'resume':
      case 'projects':
        return 'Portfolio & Bio';
      case 'media':
        return 'Media Library';
      case 'vault':
        return 'Password Vault';
      case 'backup':
        return 'Backup & Restore';
      default:
        return 'Personal Dashboard';
    }
  };

  return (
    <div className="h-full flex-1 w-full bg-[#F7F6FC] dark:bg-[#0B0F19] text-gray-900 dark:text-gray-100 flex flex-col font-sans select-none antialiased overflow-hidden">
      {/* 1. TOP APP BAR */}
      {activeView === 'home' ? (
        <AndroidTopAppBar
          profile={profile}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenProfile={() => setIsProfileOpen(true)}
          onOpenAssistant={() => setIsAssistantOpen(true)}
          title="Personal Dashboard"
        />
      ) : (
        <header className="sticky top-0 z-40 w-full bg-[#F7F6FC]/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-[#E8E5F3] dark:border-[#1E2638] pt-[env(safe-area-inset-top,0px)] px-4 shrink-0">
          <div className="h-11 sm:h-12 flex items-center justify-between gap-3 max-w-lg mx-auto">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  onNavigate('home');
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 active:scale-95 transition-all cursor-pointer"
                aria-label="Back to home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate leading-none">
                {getViewHeaderTitle()}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* AI Assistant Button */}
              <button
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setIsAssistantOpen(true);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-violet-600 dark:text-violet-400 bg-violet-100/70 dark:bg-violet-950/60 hover:bg-violet-200/80 dark:hover:bg-violet-900/60 active:scale-95 transition-all cursor-pointer shadow-2xs"
                title="Zikenn AI Assistant"
                aria-label="Open Zikenn AI Assistant"
              >
                <Sparkles className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setIsSearchOpen(true);
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-violet-600 active:scale-95 transition-all cursor-pointer"
                aria-label="Search"
              >
                <span className="text-xs">🔍</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void nativeService.triggerHaptic('selection');
                  setIsProfileOpen(true);
                }}
                className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-violet-500/40 shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold text-xs"
                aria-label="Profile"
              >
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{profile.name ? profile.name.charAt(0).toUpperCase() : 'G'}</span>
                )}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* 2. MAIN SCROLLABLE CONTENT */}
      <main className="flex-1 w-full overflow-y-auto">
        {/* HOME SCREEN */}
        {activeView === 'home' && (
          <AndroidHomeScreen
            profile={profile}
            todos={todos}
            habits={habits}
            quotes={quotes}
            expenses={expenses}
            schedule={schedule}
            onNavigate={onNavigate}
            onToggleTodo={onToggleTodo}
            onUpdateTodo={onUpdateTodo}
            onDeleteTodo={onDeleteTodo}
            onToggleHabitDay={onToggleHabitDay}
            onAddTodo={onAddTodo}
            onAddExpense={onAddExpense}
            onAddHabit={onAddHabit}
            onAddDiaryEntry={onAddDiaryEntry}
          />
        )}

        {/* TASKS VIEW */}
        {activeView === 'tasks' && (
          <AndroidTasksScreen
            todos={todos}
            onToggleTodo={onToggleTodo}
            onAddTodo={onAddTodo}
            onUpdateTodo={onUpdateTodo}
            onDeleteTodo={onDeleteTodo}
            onClearCompleted={onClearCompletedTodos}
          />
        )}

        {/* MONEY / EXPENSES VIEW */}
        {(activeView === 'expenses' || activeView === 'subscriptions') && (
          <AndroidMoneyScreen
            expenses={expenses}
            importLogs={excelImportLogs}
            onAddExpense={onAddExpense}
            onUpdateExpense={onUpdateExpense}
            onDeleteExpense={onDeleteExpense}
            onOpenSmsSettings={onOpenSmsSettings}
          />
        )}

        {/* HABITS VIEW */}
          {activeView === 'habits' && (
            <AndroidHabitsScreen
              habits={habits}
              habitHistory={habitHistory}
              onToggleHabitDay={onToggleHabitDay}
              onAddHabit={onAddHabit}
              onDeleteHabit={onDeleteHabit}
              onResetWeek={onResetHabitWeek}
            />
          )}

          {/* GOALS VIEW */}
          {activeView === 'goals' && (
            <AndroidGoalsScreen
              goals={goals}
              onAddGoal={onAddGoal}
              onUpdateGoal={onUpdateGoal}
              onDeleteGoal={onDeleteGoal}
            />
          )}

          {/* EXAMS VIEW */}
          {activeView === 'exams' && (
            <AndroidExamsScreen
              exams={exams}
              onUpdateExams={onUpdateExams}
            />
          )}

          {/* LIFE MAP / TIMELINE VIEW */}
          {activeView === 'timeline' && (
            <AndroidLifeMapScreen
              milestones={milestones}
              profile={profile}
            />
          )}

          {/* JOURNAL / DEAR DIARY VIEW */}
          {activeView === 'journal' && (
            <AndroidJournalScreen
              entries={journal}
              masterPin={settings.masterPin}
              onAddEntry={onAddDiaryEntry}
              onDeleteEntry={onDeleteDiaryEntry}
            />
          )}

          {/* QUOTES VIEW */}
          {activeView === 'quotes' && (
            <AndroidQuotesScreen
              quotes={quotes}
              onAddQuote={onAddQuote}
              onDeleteQuote={onDeleteQuote}
            />
          )}

          {/* MEDIA LIBRARY VIEW */}
          {activeView === 'media' && (
            <AndroidLibraryScreen
              media={media}
              onAddMedia={onAddMedia}
              onUpdateRating={onUpdateMediaRating}
              onDeleteMedia={onDeleteMedia}
            />
          )}

          {/* WORKFOLIO / PORTFOLIO VIEW */}
          {(activeView === 'workfolio' || activeView === 'portfolio' || activeView === 'resume' || activeView === 'projects') && (
            <AndroidPortfolioScreen
              profile={profile}
              projects={projects}
              skills={skills}
              resume={resume}
            />
          )}

          {/* PASSWORD VAULT VIEW */}
          {activeView === 'vault' && (
            <AndroidVaultScreen
              credentials={vault}
              masterPin={settings.masterPin}
              onAddCredential={onAddVaultSecret}
              onDeleteCredential={onDeleteVaultSecret}
            />
          )}

          {/* BACKUP & RESTORE VIEW */}
          {activeView === 'backup' && (
            <AndroidBackupScreen
              onExportData={onExportData}
              onImportData={onImportData}
              onResetData={onResetData}
            />
          )}
      </main>

      {/* 3. ANDROID BOTTOM NAVIGATION (Persistent) */}
      <AndroidBottomNav
        activeView={activeView}
        onNavigate={onNavigate}
        onOpenMore={() => setIsMoreOpen(true)}
        isMoreOpen={isMoreOpen}
        pendingTasksCount={pendingTodosCount}
      />

      {/* 4. MORE BOTTOM SHEET */}
      <AndroidMoreSheet
        isOpen={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        onNavigate={onNavigate}
        onOpenSettings={onOpenSettings || (() => {})}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        settings={settings}
        onToggleDarkMode={onToggleDarkMode || (() => {})}
        onToggleSound={onToggleSound || (() => {})}
      />

      {/* 5. SEARCH OVERLAY */}
      <AndroidSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={onNavigate}
        todos={todos}
        expenses={expenses}
        habits={habits}
        journal={journal}
        quotes={quotes}
        media={media}
        goals={goals}
      />

      {/* 6. PROFILE SHEET (Independent actions) */}
      <AndroidProfileSheet
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        profile={profile}
        settings={settings}
        onOpenProfile={onOpenProfile || onOpenSettings}
        onToggleDarkMode={onToggleDarkMode}
        onToggleSound={onToggleSound}
      />

      {/* 7. ZIKENN AI ASSISTANT SHEET (Native Material You Bottom Sheet) */}
      <AndroidAssistantSheet
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onNavigate={onNavigate}
        profile={profile}
        activeView={activeView}
      />
    </div>
  );
};
