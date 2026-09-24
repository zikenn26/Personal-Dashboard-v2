import React from 'react';
import { User, Moon, Sun, Volume2, VolumeX, ChevronRight } from 'lucide-react';
import { UserProfile, AppSettings } from '../../../types';
import { nativeService } from '../../../services/nativeService';
import { BottomSheet } from '../gestures/BottomSheet';

export interface AndroidProfileSheetProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  settings: AppSettings;
  onOpenProfile?: () => void;
  onToggleDarkMode?: () => void;
  onToggleSound?: () => void;
}

export const AndroidProfileSheet: React.FC<AndroidProfileSheetProps> = ({
  isOpen,
  onClose,
  profile,
  settings,
  onOpenProfile,
  onToggleDarkMode,
  onToggleSound,
}) => {
  const isDarkMode = settings.darkMode;

  const handleOpenProfile = () => {
    void nativeService.triggerHaptic('selection');
    onClose();
    if (onOpenProfile) {
      onOpenProfile();
    }
  };

  const handleToggleTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    void nativeService.triggerHaptic('selection');
    if (onToggleDarkMode) {
      onToggleDarkMode();
    }
  };

  const handleToggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    void nativeService.triggerHaptic('selection');
    if (onToggleSound) {
      onToggleSound();
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="User Account & Preferences"
      subtitle="Android Quick Settings"
    >
      <div className="p-4 space-y-3.5 pb-8">
        {/* 1. Profile Section Button */}
        <button
          type="button"
          onClick={handleOpenProfile}
          className="w-full flex items-center gap-3 p-3.5 rounded-3xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-left active:scale-[0.98] transition-all cursor-pointer group hover:border-violet-400"
        >
          <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-violet-500/50 shrink-0 bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold flex items-center justify-center text-base">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            ) : (
              profile.name ? profile.name.charAt(0) : 'U'
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-extrabold text-gray-900 dark:text-white truncate">
                {profile.name || 'User Profile'}
              </h3>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300">
                Profile
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
              {profile.handle || '@lifeos'} · View &amp; Edit Details
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all shrink-0" />
        </button>

        {/* Quick Toggles List */}
        <div className="space-y-2">
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300 px-1 uppercase tracking-wider">
            Quick Settings
          </span>

          {/* 2. Dark Mode Toggle (Independent - does NOT open Profile) */}
          <div
            onClick={handleToggleTheme}
            className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Dark Mode
                </span>
                <span className="text-[10px] text-gray-500">
                  {isDarkMode ? 'Night theme active' : 'Day theme active'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleTheme}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                isDarkMode ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              aria-label="Toggle dark mode"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs absolute top-0.5 left-0.5 ${
                  isDarkMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Sound Effects Toggle (Independent - does NOT open Profile) */}
          <div
            onClick={handleToggleSound}
            className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </div>
              <div>
                <span className="text-xs font-bold text-gray-900 dark:text-white block">
                  Sound Effects
                </span>
                <span className="text-[10px] text-gray-500">
                  {settings.soundEnabled ? 'Enabled for interactions' : 'Muted'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                settings.soundEnabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              aria-label="Toggle sound effects"
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform shadow-xs absolute top-0.5 left-0.5 ${
                  settings.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* App Info Footer */}
        <div className="p-3 rounded-2xl bg-gray-50 dark:bg-[#1A2234] text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p className="font-bold text-gray-700 dark:text-gray-300">
            Personal Dashboard (Material You)
          </p>
          <p className="text-[10px]">
            Capacitor Android Native Runtime · All data synchronized
          </p>
        </div>
      </div>
    </BottomSheet>
  );
};
