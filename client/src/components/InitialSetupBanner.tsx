import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckSquare,
  Flame,
  CreditCard,
  X,
  ArrowRight,
} from 'lucide-react';

interface InitialSetupBannerProps {
  todosCount: number;
  habitsCount: number;
  expensesCount: number;
  userName?: string;
  onAddTask: () => void;
  onSetupHabits: () => void;
  onTrackSpending: () => void;
}

export const INITIAL_SETUP_BANNER_DISMISSED_KEY = 'has_dismissed_initial_setup_banner';

export const InitialSetupBanner: React.FC<InitialSetupBannerProps> = ({
  todosCount,
  habitsCount,
  expensesCount,
  userName,
  onAddTask,
  onSetupHabits,
  onTrackSpending,
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(INITIAL_SETUP_BANNER_DISMISSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Automatically hide when the workspace is no longer empty
  const isFreshWorkspace = todosCount === 0 && habitsCount === 0 && expensesCount === 0;

  if (!isFreshWorkspace || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(INITIAL_SETUP_BANNER_DISMISSED_KEY, 'true');
    } catch {
      // ignore
    }
    setIsDismissed(true);
  };

  const displayName = userName ? userName.split(' ')[0] : 'there';

  return (
    <div
      role="region"
      aria-label="Welcome and initial setup guide"
      className="relative mb-6 p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/60 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-neutral-900 border border-indigo-100 dark:border-indigo-900/50 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300"
    >
      {/* Decorative background glow */}
      <div className="absolute -right-12 -top-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Greeting & Context */}
        <div className="max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mb-2 rounded-full bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Fresh Workspace Initialized</span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100">
            Welcome, {displayName}! Let&apos;s build your dashboard.
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
            Your workspace is clean and ready. Start adding your priorities, tracking core habits, or logging your expenses to bring your dashboard to life.
          </p>
        </div>

        {/* Dismiss Button (Top Right on Mobile) */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss setup banner"
          className="absolute right-0 top-0 md:relative md:self-start p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Actionable Starter Links */}
      <div className="relative mt-4 pt-4 border-t border-indigo-100/80 dark:border-indigo-900/40 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={onAddTask}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-xs transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                Add your first task
              </div>
              <div className="text-[11px] text-neutral-400">Capture what matters</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          type="button"
          onClick={onSetupHabits}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-xs transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                Set up habits
              </div>
              <div className="text-[11px] text-neutral-400">Build your routine</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
        </button>

        <button
          type="button"
          onClick={onTrackSpending}
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 hover:border-amber-300 dark:hover:border-amber-600 hover:shadow-xs transition-all group text-left cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                Track spending
              </div>
              <div className="text-[11px] text-neutral-400">Log an expense</div>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 text-neutral-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
        </button>
      </div>
    </div>
  );
};
