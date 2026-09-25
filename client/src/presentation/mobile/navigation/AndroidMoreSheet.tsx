import React, { useState } from 'react';
import {
  Flame,
  Target,
  Compass,
  GraduationCap,
  Shield,
  Database,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { BottomSheet } from '../gestures/BottomSheet';
import { MainNavView, AppSettings } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { ViewModeToggle, ViewMode } from '../components/ViewModeToggle';

export interface AndroidMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: MainNavView) => void;
  onOpenSettings: () => void;
  settings: AppSettings;
  onToggleDarkMode: () => void;
  onToggleSound: () => void;
}

interface MoreFeatureItem {
  id: MainNavView | 'settings';
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
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('lifeos_more_view_mode') as ViewMode) || 'tiles';
    } catch {
      return 'tiles';
    }
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('lifeos_more_view_mode', mode);
    } catch {
      // Ignore storage errors
    }
  };

  /**
   * Only features NOT already represented by:
   * - Home
   * - Tasks
   * - Money
   * - Quick Access (Add Task, Add Expense, Add Habit, Add Note, Journal, Quotes, Library, Portfolio)
   */
  const features: MoreFeatureItem[] = [
    {
      id: 'habits',
      label: 'Habits & Streaks',
      icon: Flame,
      color: 'bg-amber-100 text-amber-600 dark:bg-amber-950/80 dark:text-amber-400',
      desc: 'Build better habits & momentum',
    },
    {
      id: 'goals',
      label: 'Goals',
      icon: Target,
      color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-400',
      desc: 'Track your goals & progress',
    },
    {
      id: 'exams',
      label: 'Competitive Exams',
      icon: GraduationCap,
      color: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-400',
      desc: 'Prepare for exams & syllabus',
    },
    {
      id: 'timeline',
      label: 'Life Map',
      icon: Compass,
      color: 'bg-blue-100 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400',
      desc: 'Career milestones & life story',
    },
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
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      color: 'bg-violet-100 text-violet-600 dark:bg-violet-950/80 dark:text-violet-400',
      desc: 'System preferences & theme',
    },
  ];

  const handleSelect = (item: MoreFeatureItem) => {
    void nativeService.triggerHaptic('selection');
    onClose();
    if (item.id === 'settings') {
      onOpenSettings();
    } else {
      onNavigate(item.id as MainNavView);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="More"
      subtitle="Application feature launcher"
      maxHeight="max-h-[85vh]"
    >
      <div className="p-4 pb-12 overflow-y-auto space-y-3">
        {/* Top Control Bar with List ↔ Tiles Toggle */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 tracking-wider uppercase">
            {viewMode === 'tiles' ? 'App Tiles' : 'List View'}
          </span>
          <ViewModeToggle mode={viewMode} onChange={handleViewModeChange} size="sm" />
        </div>

        {/* 1. TILES VIEW: Android Application Launcher Grid */}
        {viewMode === 'tiles' ? (
          <div className="grid grid-cols-2 gap-2.5">
            {features.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full p-3.5 rounded-3xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] flex flex-col items-start justify-between shadow-2xs hover:border-violet-300 dark:hover:border-violet-600/50 active:scale-[0.97] transition-all cursor-pointer group text-left min-h-[104px]"
                >
                  <div
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs mb-2 group-hover:scale-105 transition-transform ${item.color}`}
                  >
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div className="w-full min-w-0">
                    <span className="text-xs font-bold text-gray-900 dark:text-white block truncate">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* 2. LIST VIEW: Compact Android List Rows */
          <div className="rounded-3xl bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] overflow-hidden divide-y divide-[#E8E5F3] dark:divide-[#242D40]">
            {features.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
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
        )}
      </div>
    </BottomSheet>
  );
};
