import React from 'react';
import {
  Sparkle,
  CheckSquare,
  Flame,
  CreditCard,
  Target,
  BookOpen,
  Film,
  Shield,
  Zap,
} from 'lucide-react';
import { AISecretaryWidget } from './AISecretaryWidget';

interface AIAssistantViewProps {
  onNavigate: (view: any) => void;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ onNavigate }) => {
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
      {/* Top Heading matching other sections */}
      <div className="pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
        <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
          <Sparkle className="w-6 h-6 text-indigo-500 fill-indigo-500/20" />
          <span>Personalized Jarvis AI</span>
        </h1>
      </div>

      {/* Main Layout: Left = Full Chat Jarvis AI, Right = Capabilities & Guide */}
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
              <span>Jarvis AI Capabilities</span>
            </div>
            <p className="text-[11px] text-[#787774] dark:text-gray-400 leading-relaxed">
              Ask Jarvis to manage tasks, review spending, log habits, or plan your day with direct action execution.
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
                Vault passwords remain strictly encrypted client-side. Jarvis AI only receives high-level metadata (account service name and security strength).
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
