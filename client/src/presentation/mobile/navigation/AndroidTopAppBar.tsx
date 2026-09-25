import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { UserProfile } from '../../../types';
import { nativeService } from '../../../services/nativeService';

export interface AndroidTopAppBarProps {
  profile: UserProfile;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  title?: string;
  className?: string;
}

/**
 * Material You Android Top App Bar
 * Reproducing Screen B: compact single-line bar with small brand icon, compact title, Search, and Avatar.
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
      className={`sticky top-0 z-40 w-full bg-[#F7F6FC]/95 dark:bg-[#0B0F19]/95 backdrop-blur-md border-b border-[#E8E5F3] dark:border-[#1E2638] pt-[env(safe-area-inset-top,0px)] px-4 transition-colors shrink-0 ${className}`}
    >
      <div className="h-11 sm:h-12 flex items-center justify-between gap-3 max-w-lg mx-auto">
        {/* Left: Small Brand Icon + Compact Single-Line Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[15px] font-semibold text-gray-900 dark:text-gray-100 tracking-tight truncate leading-none">
            {title}
          </span>
        </div>

        {/* Right: Search Icon + Profile Avatar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearchClick}
            aria-label="Search dashboard"
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/40 active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Profile / Avatar Button */}
          <button
            type="button"
            onClick={handleProfileClick}
            aria-label="Open profile settings"
            className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-violet-500/40 shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-bold text-xs"
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
              <span>{profile.name ? profile.name.charAt(0).toUpperCase() : 'G'}</span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
