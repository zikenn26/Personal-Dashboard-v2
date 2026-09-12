import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckSquare,
  Flame,
  CreditCard,
  Target,
  BookOpen,
  Film,
  Shield,
  HelpCircle,
  Zap,
} from 'lucide-react';
import { AISecretaryWidget } from './AISecretaryWidget';
import { Storage } from '../utils/storage';

interface AIAssistantViewProps {
  onNavigate: (view: any) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    tasks: 0,
    habits: 0,
    spending: 0,
    goals: 0,
  });

  const loadStats = () => {
    const todos = Storage.getTodos();
    const habits = Storage.getHabits();
    const expenses = Storage.getExpenses();
    const goals = Storage.getGoals();
    const totalSpent = expenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    setStats({
      tasks: todos.filter((t) => !t.completed).length,
      habits: habits.length,
      spending: totalSpent,
      goals: goals.filter((g) => g.status === 'active').length,
    });
  };

  useEffect(() => {
    loadStats();
    const handler = () => loadStats();
    window.addEventListener('dashboard-data-updated', handler);
    return () => window.removeEventListener('dashboard-data-updated', handler);
  }, []);

  const capabilities = [
    {
      icon: CheckSquare,
      title: 'Tasks Management',
      desc: 'Fetch, add, prioritize, and complete todos.',
      example: 'Add high-priority task "File quarterly taxes"',
    },
    {
      icon: Flame,
      title: 'Habit Tracking',
      desc: 'Check habits, view streaks, and add routines.',
      example: 'Did I complete my habits today?',
    },
    {
      icon: CreditCard,
      title: 'Spending & Analysis',
      desc: 'Log expenses and run breakdown reports.',
      example: 'Log ₹450 for lunch and analyze my spending',
    },
    {
      icon: Target,
      title: 'Goals & Milestones',
      desc: 'Track goal progression and update milestones.',
      example: 'Show my active goals and progress',
    },
    {
      icon: BookOpen,
      title: 'Daily Journal',
      desc: 'Dictate or write thoughts into your journal.',
      example: 'Record journal entry about today’s achievements',
    },
    {
      icon: Film,
      title: 'Media Watchlist',
      desc: 'Manage watchlist, reading list, and ratings.',
      example: 'Add book "Atomic Habits" to my reading list',
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155]">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/60 dark:border-indigo-900/40 flex items-center justify-center text-[#6366F1] dark:text-[#818CF8] shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-[#111827] dark:text-white">
                Executive AI Secretary
              </h1>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-100/70 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                Groq AI
              </span>
            </div>
            <p className="text-xs text-[#787774] dark:text-gray-400 mt-0.5">
              Autonomous lazy context fetching & direct CRUD operations across all modules
            </p>
          </div>
        </div>

        {/* Live Metrics Pill Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-indigo-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {stats.tasks}
            </span>
            <span className="text-gray-400">Tasks</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-orange-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {stats.habits}
            </span>
            <span className="text-gray-400">Habits</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              ₹{stats.spending.toLocaleString()}
            </span>
            <span className="text-gray-400">Spent</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#E5E5E2] dark:border-[#334155] flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-purple-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              {stats.goals}
            </span>
            <span className="text-gray-400">Goals</span>
          </div>
        </div>
      </div>

      {/* Main Layout: Left = Full Chat Secretary, Right = Capabilities & Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Chat Console (Expanded) */}
        <div className="lg:col-span-8">
          <AISecretaryWidget isExpandedView={true} onNavigate={onNavigate} />
        </div>

        {/* Sidebar Capabilities */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-4 sm:p-5 rounded-2xl bg-[#F7F7F5] dark:bg-[#1E293B] border border-[#E5E5E2] dark:border-[#334155] space-y-3.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#37352F] dark:text-white">
              <Zap className="w-3.5 h-3.5 text-indigo-500" />
              <span>Secretary Capabilities</span>
            </div>
            <p className="text-[11px] text-[#787774] dark:text-gray-400 leading-relaxed">
              The AI Secretary fetches real-time data on demand using OpenAI-compatible schema tools, executing commands directly without altering your existing themes.
            </p>

            <div className="space-y-2.5 pt-1">
              {capabilities.map((cap, i) => {
                const Icon = cap.icon;
                return (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white dark:bg-[#0F172A] border border-[#EDECE9] dark:border-[#334155] text-xs space-y-1"
                  >
                    <div className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                      <Icon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{cap.title}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {cap.desc}
                    </p>
                    <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono bg-indigo-50/50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md mt-1">
                      "{cap.example}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Privacy & Guardrails Callout */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0F172A] border border-[#EDECE9] dark:border-[#334155] flex items-start gap-3 text-xs text-gray-500 dark:text-gray-400">
            <Shield className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-gray-900 dark:text-white block">
                Zero Vault Disclosure Guardrail
              </span>
              <span className="text-[11px]">
                Vault passwords remain strictly encrypted client-side. The AI Secretary only receives high-level metadata (account service name and security strength).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
