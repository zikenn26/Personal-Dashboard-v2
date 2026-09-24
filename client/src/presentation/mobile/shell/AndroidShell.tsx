import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
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
import { PullToRefresh } from '../gestures/PullToRefresh';

// Existing Feature Views for seamless non-home view rendering
import { TasksKanbanView } from '../../../components/TasksKanbanView';
import { ExpenseTracker } from '../../../components/ExpenseTracker';
import { HabitTracker } from '../../../components/HabitTracker';
import { DearDiaryView } from '../../../components/DearDiaryView';
import { QuotesManagerView } from '../../../components/QuotesManagerView';
import { GoalsView } from '../../../components/GoalsView';
import { ExamsSection } from '../../../components/ExamsSection';
import { WorkfolioView } from '../../../components/WorkfolioView';
import { MediaGallery } from '../../../components/MediaGallery';
import { PasswordVault } from '../../../components/PasswordVault';
import { BackupRestoreView } from '../../../components/BackupRestoreView';
import { AIAssistantView } from '../../../components/AIAssistantView';

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
  onAddTodo: (title: string, priority: Priority, category: string, dueDate?: string, status?: TaskStatus) => void;
  onUpdateTodo?: (id: string, updatedFields: Partial<TodoItem>) => void;
  onUpdateTaskStatus?: (id: string, status: TaskStatus) => void;
  onDeleteTodo?: (id: string) => void;
  onClearCompletedTodos?: () => void;

  onAddExpense: (item: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (id: string, updated: Partial<ExpenseItem>) => void;
  onBatchAddExpenses?: (newItems: Array<Omit<ExpenseItem, 'id'>>, newLog?: ExcelImportLog) => void;
  onToggleExpense?: (id: string) => void;
  onDeleteExpense?: (id: string) => void;
  onDeleteBatchExpenses?: (ids: string[]) => void;
  onDeleteImportLog?: (logId: string) => void;

  onToggleHabitDay: (habitId: string, dayIndex: number) => void;
  onAddHabit: (title: string, category: string, icon: string, color: string) => void;
  onDeleteHabit?: (id: string) => void;
  onResetHabitWeek?: () => void;
  onSimulateMondayRollover?: () => void;
  onToggleHistoricalHabitDay?: (weekId: string, habitId: string, dayIndex: number) => void;
  onAddHistoricalHabit?: (weekId: string, title: string, category: string, icon: string, color: string) => void;
  onDeleteHistoricalHabit?: (weekId: string, habitId: string) => void;
  habitHistory?: any[];
  habitActivities?: any[];

  onAddDiaryEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => void;
  onDeleteDiaryEntry?: (id: string) => void;

  onAddQuote?: (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => void;
  onUpdateQuote?: (id: string, updatedFields: Partial<QuoteItem>) => void;
  onDeleteQuote?: (id: string) => void;

  onAddGoal?: (goal: Omit<GoalItem, 'id'>) => void;
  onUpdateGoal?: (id: string, updated: Partial<GoalItem>) => void;
  onDeleteGoal?: (id: string) => void;

  onUpdateExams?: (updatedExams: ExamItem[]) => void;
  onUpdateProfile?: (updated: UserProfile) => void;
  onUpdateProjects?: (updated: PortfolioProject[]) => void;
  onUpdateSkills?: (updated: SkillCategory[]) => void;
  onUpdateResume?: (updated: ResumeDocument) => void;
  onAddProject?: (project: Omit<PortfolioProject, 'id'>) => void;
  onDeleteProject?: (id: string) => void;

  onAddMedia?: (media: Omit<MediaItem, 'id' | 'createdAt'>) => void;
  onUpdateMediaRating?: (id: string, rating: number) => void;
  onDeleteMedia?: (id: string) => void;

  onAddVaultSecret?: (secret: Omit<VaultCredential, 'id' | 'updatedAt'>) => void;
  onDeleteVaultSecret?: (id: string) => void;

  onExportData?: () => void;
  onImportData?: (imported: any) => void;
  onResetData?: () => void;

  // Settings & Modals
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onToggleDarkMode: () => void;
  onToggleSound: () => void;
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
  onToggleDarkMode,
  onToggleSound,
  onRefresh,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Android hardware back button handler
  useEffect(() => {
    const unregister = nativeService.registerBackButtonHandler(() => {
      // 1. If "More" bottom sheet is open, close it
      if (isMoreOpen) {
        setIsMoreOpen(false);
        return true;
      }
      // 2. If not on 'home', return to 'home'
      if (activeView !== 'home') {
        onNavigate('home');
        return true;
      }
      // 3. At home root level: return false to let Android minimize or exit app
      return false;
    });

    return unregister;
  }, [isMoreOpen, activeView, onNavigate]);

  const pendingTodosCount = todos.filter((t) => !t.completed && t.status !== 'complete').length;

  // View title helper for non-home views
  const getViewHeaderTitle = (): string => {
    switch (activeView) {
      case 'tasks':
        return 'Tasks & Kanban';
      case 'expenses':
      case 'subscriptions':
        return 'Money & Spending';
      case 'habits':
        return 'Routines & Habits';
      case 'journal':
        return 'Dear Diary';
      case 'quotes':
        return 'Quotes & Mantras';
      case 'goals':
        return 'Goals & Targets';
      case 'timeline':
        return 'Life Timeline';
      case 'exams':
        return 'Competitive Exams';
      case 'workfolio':
      case 'portfolio':
      case 'resume':
      case 'projects':
        return 'Portfolio & Resume';
      case 'media':
        return 'Media Library';
      case 'vault':
        return 'Password Vault';
      case 'assistant':
        return 'AI Assistant';
      case 'backup':
        return 'Backup & Restore';
      default:
        return 'Personal Dashboard';
    }
  };

  const handlePullRefresh = async () => {
    if (onRefresh) {
      await Promise.resolve(onRefresh());
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F6FC] dark:bg-[#0B0F19] text-gray-900 dark:text-gray-100 flex flex-col selection:bg-violet-500 selection:text-white">
      {/* 1. ANDROID TOP APP BAR */}
      <AndroidTopAppBar
        profile={profile}
        onOpenSearch={onOpenSearch}
        onOpenProfile={onOpenProfile}
        title={activeView === 'home' ? 'Personal Dashboard' : getViewHeaderTitle()}
      />

      {/* Non-home return navigation bar */}
      {activeView !== 'home' && (
        <div className="bg-white/80 dark:bg-[#121826]/80 backdrop-blur-xs border-b border-[#E8E5F3] dark:border-[#242D40] px-4 py-2">
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onNavigate('home');
            }}
            className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400 hover:text-violet-700 active:scale-95 transition-transform cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>
        </div>
      )}

      {/* 2. SCROLLABLE CONTENT AREA WITH PULL-TO-REFRESH */}
      <main className="flex-1 w-full overflow-y-auto">
        <PullToRefresh onRefresh={handlePullRefresh}>
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
              onToggleHabitDay={onToggleHabitDay}
              onAddTodo={onAddTodo}
              onAddExpense={onAddExpense}
              onAddHabit={onAddHabit}
              onAddDiaryEntry={onAddDiaryEntry}
            />
          )}

          {/* TASKS VIEW */}
          {(activeView === 'tasks' || (activeView as string) === 'todos' || (activeView as string) === 'todo') && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <TasksKanbanView
                todos={todos}
                onToggleTodo={onToggleTodo}
                onAddTodo={onAddTodo}
                onUpdateTodo={onUpdateTodo || (() => {})}
                onUpdateStatus={onUpdateTaskStatus || (() => {})}
                onDeleteTodo={onDeleteTodo || (() => {})}
                onClearCompleted={onClearCompletedTodos || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* MONEY / EXPENSES VIEW */}
          {(activeView === 'expenses' || activeView === 'subscriptions') && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <ExpenseTracker
                expenses={expenses}
                importLogs={excelImportLogs}
                onAddExpense={onAddExpense}
                onUpdateExpense={onUpdateExpense || (() => {})}
                onBatchAddExpenses={onBatchAddExpenses || (() => {})}
                onToggleActive={onToggleExpense || (() => {})}
                onDeleteExpense={onDeleteExpense || (() => {})}
                onDeleteBatchExpenses={onDeleteBatchExpenses || (() => {})}
                onDeleteImportLog={onDeleteImportLog || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* HABITS VIEW */}
          {activeView === 'habits' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <HabitTracker
                habits={habits}
                habitHistory={habitHistory}
                habitActivities={habitActivities}
                onToggleHabitDay={onToggleHabitDay}
                onAddHabit={onAddHabit}
                onDeleteHabit={onDeleteHabit || (() => {})}
                onResetWeek={onResetHabitWeek || (() => {})}
                onSimulateMondayRollover={onSimulateMondayRollover || (() => {})}
                onToggleHistoricalHabitDay={onToggleHistoricalHabitDay || (() => {})}
                onAddHistoricalHabit={onAddHistoricalHabit || (() => {})}
                onDeleteHistoricalHabit={onDeleteHistoricalHabit || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* JOURNAL / DEAR DIARY VIEW */}
          {activeView === 'journal' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <DearDiaryView
                entries={journal}
                masterPin={settings.masterPin}
                onAddEntry={onAddDiaryEntry}
                onDeleteEntry={onDeleteDiaryEntry || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* QUOTES VIEW */}
          {activeView === 'quotes' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <QuotesManagerView
                quotes={quotes}
                onAddQuote={onAddQuote || (() => {})}
                onUpdateQuote={onUpdateQuote || (() => {})}
                onDeleteQuote={onDeleteQuote || (() => {})}
                onNavigate={onNavigate}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* GOALS VIEW */}
          {activeView === 'goals' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <GoalsView
                goals={goals}
                onAddGoal={onAddGoal || (() => {})}
                onUpdateGoal={onUpdateGoal || (() => {})}
                onDeleteGoal={onDeleteGoal || (() => {})}
                onNavigate={onNavigate}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* EXAMS VIEW */}
          {activeView === 'exams' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <ExamsSection
                exams={exams}
                onUpdateExams={onUpdateExams || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* WORKFOLIO VIEW */}
          {(activeView === 'workfolio' || activeView === 'portfolio' || activeView === 'resume' || activeView === 'projects') && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <WorkfolioView
                profile={profile}
                projects={projects}
                skills={skills}
                resume={
                  resume || {
                    fileName: 'Resume.pdf',
                    fileSize: '0 KB',
                    uploadedAt: new Date().toISOString(),
                    summary: '',
                    experiences: [],
                    education: [],
                    skills: [],
                  }
                }
                onUpdateProfile={onUpdateProfile || (() => {})}
                onUpdateProjects={onUpdateProjects || (() => {})}
                onUpdateSkills={onUpdateSkills || (() => {})}
                onUpdateResume={onUpdateResume || (() => {})}
                onAddProject={onAddProject || (() => {})}
                onDeleteProject={onDeleteProject || (() => {})}
                onNavigate={onNavigate}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* MEDIA LIBRARY VIEW */}
          {activeView === 'media' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <MediaGallery
                media={media}
                initialFilterType="all"
                onAddMedia={onAddMedia || (() => {})}
                onUpdateRating={onUpdateMediaRating || (() => {})}
                onDeleteMedia={onDeleteMedia || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}

          {/* PASSWORD VAULT VIEW */}
          {activeView === 'vault' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <PasswordVault
                credentials={vault}
                masterPin={settings.masterPin}
                onAddCredential={onAddVaultSecret || (() => {})}
                onDeleteCredential={onDeleteVaultSecret || (() => {})}
                soundEnabled={settings.soundEnabled}
                onOpenSettings={onOpenSettings}
              />
            </div>
          )}

          {/* AI ASSISTANT VIEW */}
          {activeView === 'assistant' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <AIAssistantView
                activeView={activeView}
                onNavigate={onNavigate}
                onOpenCommandMappings={onOpenSettings}
              />
            </div>
          )}

          {/* BACKUP & RESTORE VIEW */}
          {activeView === 'backup' && (
            <div className="p-3 max-w-lg mx-auto pb-24">
              <BackupRestoreView
                onExportData={onExportData || (() => {})}
                onImportData={onImportData || (() => {})}
                onResetData={onResetData || (() => {})}
                soundEnabled={settings.soundEnabled}
              />
            </div>
          )}
        </PullToRefresh>
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
        onOpenSettings={onOpenSettings}
        settings={settings}
        onToggleDarkMode={onToggleDarkMode}
        onToggleSound={onToggleSound}
      />
    </div>
  );
};
