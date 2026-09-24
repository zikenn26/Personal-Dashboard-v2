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
  Settings,
  ChevronRight,
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

interface MoreItem {
  id: MainNavView;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  desc: string;
}

export const AndroidMoreSheet: React.FC<AndroidMoreSheetProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onOpenSettings,
}) => {
  const groups: Array<{ title: string; items: MoreItem[] }> = [
    {
      title: 'LIFE & PRODUCTIVITY',
      items: [
        {
          id: 'goals',
          label: 'Goals',
          icon: Target,
          color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
          desc: 'Targets & progress milestones',
        },
        {
          id: 'exams',
          label: 'Competitive Exams',
          icon: GraduationCap,
          color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
          desc: 'Target dates & syllabus tracking',
        },
        {
          id: 'timeline',
          label: 'Life Map & Timeline',
          icon: Compass,
          color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
          desc: 'Career milestones & life story',
        },
        {
          id: 'habits',
          label: 'Habits & Streaks',
          icon: Flame,
          color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
          desc: 'Daily routines & momentum',
        },
      ],
    },
    {
      title: 'PERSONAL',
      items: [
        {
          id: 'journal',
          label: 'Dear Diary & Journal',
          icon: BookOpen,
          color: 'bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400',
          desc: 'Private reflections & memories',
        },
        {
          id: 'quotes',
          label: 'Quotes & Mantras',
          icon: Quote,
          color: 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400',
          desc: 'Wisdom & daily stoic fuel',
        },
        {
          id: 'media',
          label: 'Media Library',
          icon: Film,
          color: 'bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-950/80 dark:text-fuchsia-400',
          desc: 'Books, movies, series & games',
        },
        {
          id: 'workfolio',
          label: 'Portfolio & Bio',
          icon: Briefcase,
          color: 'bg-purple-100 text-purple-600 dark:bg-purple-950/80 dark:text-purple-400',
          desc: 'Projects, skills & resume',
        },
      ],
    },
    {
      title: 'MONEY & SECURITY',
      items: [
        {
          id: 'vault',
          label: 'Password Vault',
          icon: Shield,
          color: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-950/80 dark:text-cyan-400',
          desc: 'Encrypted accounts & secrets',
        },
        {
          id: 'backup',
          label: 'Backup & Restore',
          icon: Database,
          color: 'bg-teal-100 text-teal-600 dark:bg-teal-950/80 dark:text-teal-400',
          desc: 'Export & recover JSON snapshots',
        },
      ],
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
      title="More Features"
      subtitle="Explore secondary hubs and system tools"
      maxHeight="max-h-[85vh]"
    >
      <div className="p-4 space-y-4 pb-12 overflow-y-auto">
        {groups.map((grp, gIdx) => (
          <div key={gIdx} className="space-y-1.5">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider px-2 uppercase">
              {grp.title}
            </span>

            <div className="rounded-3xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] overflow-hidden divide-y divide-[#E8E5F3] dark:divide-[#242D40]">
              {grp.items.map((item) => {
                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className="w-full flex items-center justify-between p-3 hover:bg-violet-50/50 dark:hover:bg-violet-950/30 active:scale-[0.99] transition-all text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${item.color}`}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                          {item.desc}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-violet-500 shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
};
