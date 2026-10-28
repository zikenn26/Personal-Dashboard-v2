import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { nativeService } from '../../../services/nativeService';

export interface SwipeActionRowProps {
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  leftActionContent?: React.ReactNode;
  rightActionContent?: React.ReactNode;
  leftActionColor?: string; // e.g. 'bg-emerald-500'
  rightActionColor?: string; // e.g. 'bg-rose-500'
  threshold?: number; // Distance in px to trigger action
  className?: string;
  disabled?: boolean;
}

/**
 * Android-First Swipe Action Row
 * Allows users to swipe left/right to reveal or trigger actions (e.g. complete task, archive, delete).
 */
export const SwipeActionRow: React.FC<SwipeActionRowProps> = ({
  children,
  onSwipeLeft,
  onSwipeRight,
  leftActionContent,
  rightActionContent,
  leftActionColor = 'bg-emerald-500',
  rightActionColor = 'bg-rose-500',
  threshold = 95,
  className = '',
  disabled = false,
}) => {
  const x = useMotionValue(0);
  const hasTriggeredRef = useRef(false);

  // Background action opacity: reveals gradually and smoothly
  const leftOpacity = useTransform(x, [20, threshold], [0.15, 1]);
  const rightOpacity = useTransform(x, [-threshold, -20], [1, 0.15]);

  const handleDragEnd = (_: any, info: any) => {
    if (disabled) return;

    const offset = info.offset.x;
    // Firm, deliberate threshold check
    if (offset >= threshold && onSwipeRight) {
      void nativeService.triggerHaptic('selection');
      onSwipeRight();
    } else if (offset <= -threshold && onSwipeLeft) {
      void nativeService.triggerHaptic('selection');
      onSwipeLeft();
    }
    // Any accidental partial swipe automatically snaps back without firing anything
    hasTriggeredRef.current = false;
  };

  const handleDrag = (_: any, info: any) => {
    if (disabled) return;
    const offset = Math.abs(info.offset.x);
    if (offset >= threshold && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      void nativeService.triggerHaptic('selection');
    } else if (offset < threshold && hasTriggeredRef.current) {
      hasTriggeredRef.current = false;
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      {/* Left Action Background (revealed when swiping right) */}
      {leftActionContent && (
        <motion.div
          style={{ opacity: leftOpacity }}
          className={`absolute inset-y-0 left-0 w-24 flex items-center justify-center text-white ${leftActionColor} rounded-l-2xl z-0`}
        >
          {leftActionContent}
        </motion.div>
      )}

      {/* Right Action Background (revealed when swiping left) */}
      {rightActionContent && (
        <motion.div
          style={{ opacity: rightOpacity }}
          className={`absolute inset-y-0 right-0 w-24 flex items-center justify-center text-white ${rightActionColor} rounded-r-2xl z-0`}
        >
          {rightActionContent}
        </motion.div>
      )}

      {/* Foreground Draggable Content with snap-back to origin */}
      <motion.div
        drag={disabled ? false : 'x'}
        dragSnapToOrigin={true}
        dragConstraints={{ left: rightActionContent ? -110 : 0, right: leftActionContent ? 110 : 0 }}
        dragElastic={0.12}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 35 }}
        style={{ x }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        className="relative z-10 bg-white dark:bg-[#121826] rounded-2xl touch-pan-y"
      >
        {children}
      </motion.div>
    </div>
  );
};
