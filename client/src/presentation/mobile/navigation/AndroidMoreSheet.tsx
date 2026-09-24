import React from 'react';
import {
  Flame,
  BookOpen,
  Quote,
  Target,
  Compass,
  GraduationCap,
  Briefcase,
  Film,
  Shield,
  Database,
  Bot,
  Settings,
  Moon,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { BottomSheet } from '../gestures/BottomSheet';
import { MainNavView, AppSettings } from '../../../types';
import { nativeService } from '../../../services/nativeService';

export interface AndroidMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: MainNavView) => void;
  onOpenSettings: () => void;
  settings: AppSettings;
  onToggleDarkMode: () => void;
  onToggleSound: () => void;
}

interface MoreSectionItem {
  id: MainNavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // Tailwind color class for icon container
  desc: string;
}

export const AndroidMoreSheet: React.FC<AndroidMoreSheetProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSettings,
  settings,
  onToggleDarkMode,
  onToggleSound,
}) => {
  const sections: MoreSectionItem[] = [
    {
      id: 'habits',
      label: 'Habits',
      icon: Flame,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
      desc: 'Daily routines & streaks',
    },
    {
      id: 'journal',
      label: 'Dear Diary',
      icon: BookOpen,
      color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400',
      desc: 'Personal notes & reflections',
    },
    {
      id: 'quotes',
      label: 'Quotes',
      icon: Quote,
      color: 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400',
      desc: 'Daily inspiration & mantras',
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: Target,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
      desc: 'Targets & milestone tracking',
    },
    {
      id: 'timeline',
      label: 'Timeline',
      icon: Compass,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
      desc: 'Life milestones & journey',
    },
    {
      id: 'exams',
      label: 'Exams Hub',
      icon: GraduationCap,
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
      desc: 'Syllabus & test prep',
    },
    {
      id: 'workfolio',
      label: 'Portfolio & Bio',
      icon: Briefcase,
      color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
      desc: 'Resume & professional work',
    },
    {
      id: 'media',
      label: 'Media Library',
      icon: Film,
      color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/80 dark:text-fuchsia-400',
      desc: 'Books, movies & watchlist',
    },
    {
      id: 'vault',
      label: 'Password Vault',
      icon: Shield,
      color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/80 dark:text-cyan-400',
      desc: 'PIN-secured credentials',
    },
    {
      id: 'assistant',
      label: 'AI Assistant',
      icon: Bot,
      color: 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400',
      desc: 'Smart dashboard assistant',
    },
    {
      id: 'backup',
      label: 'Data & Backup',
      icon: Database,
      color: 'bg-teal-100 text-teal-600 dark:bg-teal-950/80 dark:text-teal-400',
      desc: 'Export, restore & sync',
    },
  ];

  const handleSelect = (view: MainNavView) => {
    void nativeService.triggerHaptic('selection');
    onClose();
    onNavigate(view);
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Dashboard Sections"
      subtitle="Explore all tools and life modules"
      maxHeight="max-h-[85vh]"
    >
      <div className="space-y-4">
        {/* Quick Quick System Toggles */}
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]">
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('click');
              onToggleDarkMode();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            {settings.darkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5 text-violet-600" />}
            <span>{settings.darkMode ? 'Light Theme' : 'Dark Theme'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('click');
              onToggleSound();
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 active:scale-95 transition-all cursor-pointer shadow-2xs"
          >
            {settings.soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-500" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
            <span>{settings.soundEnabled ? 'Sound On' : 'Sound Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              onClose();
              onOpenSettings();
            }}
            className="p-2 rounded-xl bg-white dark:bg-[#121826] border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 active:scale-95 transition-all cursor-pointer shadow-2xs"
            aria-label="Settings"
          >
            <Settings className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </button>
        </div>

        {/* Section Grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {sections.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] hover:border-violet-300 dark:hover:border-violet-600/50 shadow-2xs active:scale-[0.98] transition-all text-left cursor-pointer group"
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color} shadow-2xs`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {item.label}
                  </span>
                  <span className="block text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {item.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
};
