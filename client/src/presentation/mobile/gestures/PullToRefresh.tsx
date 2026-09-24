import React, { useState, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { RefreshCw } from 'lucide-react';
import { nativeService } from '../../../services/nativeService';

export interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void> | void;
  className?: string;
  pullThreshold?: number; // Distance in px (default: 70)
}

/**
 * Android-First Pull to Refresh Container
 * Smooth touch-pull gesture with rotating spinner and haptic confirmation.
 */
export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  className = '',
  pullThreshold = 70,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredHaptic = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isRefreshing) return;
    // Only allow pull to refresh if scroll position is at the very top
    const scrollTop = containerRef.current?.scrollTop || window.scrollY || 0;
    if (scrollTop <= 2 && e.touches.length === 1) {
      touchStartY.current = e.touches[0].clientY;
      hasTriggeredHaptic.current = false;
    } else {
      touchStartY.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;

    if (diff > 0) {
      // Apply friction damping curve
      const damped = Math.min(100, Math.pow(diff, 0.85) * 1.5);
      setPullDistance(damped);

      if (damped >= pullThreshold && !hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = true;
        void nativeService.triggerHaptic('impactLight');
      } else if (damped < pullThreshold && hasTriggeredHaptic.current) {
        hasTriggeredHaptic.current = false;
      }
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartY.current === null || isRefreshing) return;

    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true);
      void nativeService.triggerHaptic('selection');
      try {
        await Promise.resolve(onRefresh());
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }

    touchStartY.current = null;
    hasTriggeredHaptic.current = false;
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`relative w-full ${className}`}
    >
      {/* Pull Indicator Area */}
      <div
        style={{
          height: `${Math.max(0, pullDistance || (isRefreshing ? 48 : 0))}px`,
          transition: isRefreshing || pullDistance === 0 ? 'height 0.25s ease-out' : 'none',
        }}
        className="overflow-hidden flex items-center justify-center pointer-events-none"
      >
        <motion.div
          animate={isRefreshing ? { rotate: 360 } : { rotate: pullDistance * 3 }}
          transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
          className="w-9 h-9 rounded-full bg-white dark:bg-[#1E2638] shadow-md border border-[#E8E5F3] dark:border-[#242D40] flex items-center justify-center text-violet-600 dark:text-violet-400"
        >
          <RefreshCw className="w-4 h-4" />
        </motion.div>
      </div>

      {children}
    </div>
  );
};
