import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { nativeService } from '../../../services/nativeService';

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  showCloseButton?: boolean;
  maxHeight?: string; // default: 'max-h-[85vh]'
  className?: string;
}

/**
 * Material You Android Bottom Sheet
 * Automatically registers with hardware back button listener.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  showCloseButton = true,
  maxHeight = 'max-h-[88vh]',
  className = '',
}) => {
  const [dragY, setDragY] = useState(0);
  const touchStartY = useRef<number | null>(null);

  // Register with Android hardware back button
  useEffect(() => {
    if (!isOpen) return;
    const unregister = nativeService.registerBackButtonHandler(() => {
      onClose();
      return true; // handled
    });
    return unregister;
  }, [isOpen, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) {
      // Dragging down
      setDragY(delta);
    } else {
      // Dragging up (resist)
      setDragY(delta * 0.15);
    }
  };

  const handleTouchEnd = () => {
    if (dragY > 90) {
      void nativeService.triggerHaptic('impactLight');
      onClose();
    }
    setDragY(0);
    touchStartY.current = null;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs"
          />

          {/* Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: dragY > 0 ? dragY : 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            style={{ touchAction: 'pan-y' }}
            className={`relative z-10 w-full bg-white dark:bg-[#121826] rounded-t-[28px] shadow-2xl border-t border-[#E8E5F3] dark:border-[#242D40] flex flex-col ${maxHeight} ${className}`}
          >
            {/* Drag Handle Bar */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="w-full pt-3 pb-2 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none"
            >
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 mb-1" />
            </div>

            {/* Header (if title exists) */}
            {(title || showCloseButton) && (
              <div className="px-5 py-2.5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80">
                <div className="min-w-0 flex-1 pr-2">
                  {typeof title === 'string' ? (
                    <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {subtitle}
                    </p>
                  )}
                </div>

                {showCloseButton && (
                  <button
                    type="button"
                    onClick={() => {
                      void nativeService.triggerHaptic('selection');
                      onClose();
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 transition-colors cursor-pointer"
                    aria-label="Close sheet"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
