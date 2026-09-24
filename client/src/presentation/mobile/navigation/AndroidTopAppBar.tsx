import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { UserProfile } from '../../../types';
import { nativeService } from '../../../services/nativeService';

export interface AndroidTopAppBarProps {
  profile: UserProfile;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

/**
 * Material You Android Top App Bar
 * Compact, modern, featuring brand badge, title, search, and avatar.
 */
export const AndroidTopAppBar: React.FC<AndroidTopAppBarProps> = ({
  profile,
  onOpenSearch,
  onOpenProfile,
  title = 'Personal Dashboard',
  className = '',
}) => {
  const handleSearchClick = () => {
    void nativeService.triggerHaptic('selection');
    onOpenSearch();
  };

  const handleProfileClick = () => {
    void nativeService.triggerHaptic('selection');
    onOpenProfile();
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full bg-[#F7F6FC]/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-[#E8E5F3] dark:border-[#1E2638] pt-[env(safe-area-inset-top)] px-4 transition-colors ${className}`}
    >
      <div className="h-14 flex items-center justify-between gap-3 max-w-lg mx-auto">
        {/* Left: Brand / Icon + App Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-sm shadow-violet-500/20 shrink-0">
            <Sparkles className="w-4 h-4 text-violet-100" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight truncate leading-tight">
              {title}
            </h1>
          </div>
        </div>

        {/* Right: Search Icon + Profile Avatar */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearchClick}
            aria-label="Search dashboard"
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-700 dark:text-gray-200 bg-white dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs hover:bg-violet-50 dark:hover:bg-violet-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </button>

          {/* Profile / Avatar Button */}
          <button
            type="button"
            onClick={handleProfileClick}
            aria-label="Open profile settings"
            className="w-9 h-9 rounded-full overflow-hidden border-2 border-violet-500/40 dark:border-violet-400/40 shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold text-xs"
          >
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.name || 'User'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <span>{(profile.name || 'U').charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
