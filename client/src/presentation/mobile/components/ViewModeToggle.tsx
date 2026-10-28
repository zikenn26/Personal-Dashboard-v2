import React from 'react';
import { LayoutList, LayoutGrid } from 'lucide-react';
import { nativeService } from '../../../services/nativeService';

export type ViewMode = 'list' | 'tiles';

export interface ViewModeToggleProps {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  className?: string;
  size?: 'sm' | 'xs';
}

export const ViewModeToggle: React.FC<ViewModeToggleProps> = ({
  mode,
  onChange,
  className = '',
  size = 'sm',
}) => {
  const handleToggle = (newMode: ViewMode) => {
    if (newMode !== mode) {
      void nativeService.triggerHaptic('selection');
      onChange(newMode);
    }
  };

  const isSmall = size === 'xs';

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-xl bg-gray-100 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] select-none ${className}`}
      role="group"
      aria-label="View mode toggle"
    >
      <button
        type="button"
        onClick={() => handleToggle('list')}
        aria-label="List view"
        aria-pressed={mode === 'list'}
        className={`flex items-center gap-1 ${
          isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
        } rounded-lg font-semibold transition-all cursor-pointer ${
          mode === 'list'
            ? 'bg-white dark:bg-[#121826] text-violet-700 dark:text-violet-300 shadow-2xs font-bold'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        <LayoutList className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className="hidden xs:inline">List</span>
      </button>

      <button
        type="button"
        onClick={() => handleToggle('tiles')}
        aria-label="Tiles view"
        aria-pressed={mode === 'tiles'}
        className={`flex items-center gap-1 ${
          isSmall ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
        } rounded-lg font-semibold transition-all cursor-pointer ${
          mode === 'tiles'
            ? 'bg-white dark:bg-[#121826] text-violet-700 dark:text-violet-300 shadow-2xs font-bold'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
        }`}
      >
        <LayoutGrid className={isSmall ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className="hidden xs:inline">Tiles</span>
      </button>
    </div>
  );
};

export default ViewModeToggle;
