import React from 'react';
import { Home, CheckSquare, CreditCard, LayoutGrid } from 'lucide-react';
import { MainNavView } from '../../../types';
import { nativeService } from '../../../services/nativeService';

export interface AndroidBottomNavProps {
  activeView: MainNavView;
  onNavigate: (view: MainNavView) => void;
  onOpenMore: () => void;
  isMoreOpen?: boolean;
  pendingTasksCount?: number;
  className?: string;
}

export interface NavTabItem {
  id: 'home' | 'tasks' | 'money' | 'more';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  viewTarget?: MainNavView;
  badge?: number;
}

/**
 * Android-First Bottom Navigation Bar
 * Material You active pill indicator, thumb-friendly 64px height, safe-area padding.
 */
export const AndroidBottomNav: React.FC<AndroidBottomNavProps> = ({
  activeView,
  onNavigate,
  onOpenMore,
  isMoreOpen = false,
  pendingTasksCount = 0,
  className = '',
}) => {
  const tabs: NavTabItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      viewTarget: 'home',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      viewTarget: 'tasks',
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
    },
    {
      id: 'money',
      label: 'Money',
      icon: CreditCard,
      viewTarget: 'expenses',
    },
    {
      id: 'more',
      label: 'More',
      icon: LayoutGrid,
    },
  ];

  const handleTabClick = (tab: NavTabItem) => {
    void nativeService.triggerHaptic('selection');
    if (tab.id === 'more') {
      onOpenMore();
    } else if (tab.viewTarget) {
      onNavigate(tab.viewTarget);
    }
  };

  const isTabActive = (tab: NavTabItem): boolean => {
    if (tab.id === 'more') return isMoreOpen;
    if (tab.id === 'home') return activeView === 'home';
    if (tab.id === 'tasks') return activeView === 'tasks';
    if (tab.id === 'money') return activeView === 'expenses';
    return false;
  };

  return (
    <nav
      className={`fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#121826]/95 backdrop-blur-md border-t border-[#E8E5F3] dark:border-[#242D40] pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_12px_rgba(0,0,0,0.05)] transition-colors ${className}`}
    >
      <div className="h-16 max-w-lg mx-auto px-3 flex items-center justify-around">
        {tabs.map((tab) => {
          const active = isTabActive(tab);
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab)}
              className="flex-1 flex flex-col items-center justify-center py-1 group active:scale-95 transition-transform cursor-pointer relative"
              aria-label={tab.label}
            >
              {/* Material You Active Pill Highlight */}
              <div
                className={`relative px-4 py-1 rounded-full transition-all duration-200 flex items-center justify-center ${
                  active
                    ? 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300'
                    : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    active ? 'scale-105 stroke-[2.2]' : 'stroke-[1.8]'
                  }`}
                />

                {/* Badge if available */}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-xs">
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`text-[11px] mt-0.5 tracking-tight transition-colors ${
                  active
                    ? 'font-bold text-violet-700 dark:text-violet-300'
                    : 'font-medium text-gray-500 dark:text-gray-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
