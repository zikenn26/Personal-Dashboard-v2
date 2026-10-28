import React from 'react';
import { BottomSheet } from '../gestures/BottomSheet';
import { nativeService } from '../../../services/nativeService';

export interface ActionSheetItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  isDestructive?: boolean;
  color?: string;
}

export interface AndroidActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  actions: ActionSheetItem[];
}

/**
 * Reusable Material You Action Sheet for Android long-press contextual actions.
 */
export const AndroidActionSheet: React.FC<AndroidActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  actions,
}) => {
  const handleAction = (item: ActionSheetItem) => {
    void nativeService.triggerHaptic(item.isDestructive ? 'warning' : 'selection');
    onClose();
    item.onClick();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxHeight="max-h-[60vh]"
    >
      <div className="p-3 space-y-1.5 pb-6">
        {actions.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleAction(item)}
            className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all active:scale-[0.98] text-left cursor-pointer ${
              item.isDestructive
                ? 'bg-rose-50/60 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                : 'bg-gray-50 dark:bg-[#1A2234] text-gray-800 dark:text-gray-200 hover:bg-violet-50 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-300'
            }`}
          >
            {item.icon && (
              <span className={`shrink-0 ${item.isDestructive ? 'text-rose-500' : 'text-violet-600 dark:text-violet-400'}`}>
                {item.icon}
              </span>
            )}
            <span className="text-sm font-semibold flex-1 truncate">
              {item.label}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => {
            void nativeService.triggerHaptic('selection');
            onClose();
          }}
          className="w-full mt-2 py-3 rounded-2xl bg-gray-100 dark:bg-[#161E2E] text-gray-600 dark:text-gray-400 text-sm font-semibold text-center hover:bg-gray-200 active:scale-[0.98] cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </BottomSheet>
  );
};
