import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { nativeService } from '../../../services/nativeService';

export interface HorizontalPagerProps {
  children: React.ReactNode[];
  initialPage?: number;
  onPageChange?: (page: number) => void;
  className?: string;
  showDots?: boolean;
  autoPlayInterval?: number; // Optional ms, 0 or undefined = off
}

/**
 * Android-First Horizontal Pager (Carousel)
 * Features fluid swipe gestures, spring transitions, and Material You dot indicators.
 */
export const HorizontalPager: React.FC<HorizontalPagerProps> = ({
  children,
  initialPage = 0,
  onPageChange,
  className = '',
  showDots = true,
  autoPlayInterval = 0,
}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [direction, setDirection] = useState<1 | -1>(1);
  const totalPages = children.length;

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaRef = useRef<number>(0);

  const goToPage = (pageIndex: number) => {
    if (pageIndex < 0 || pageIndex >= totalPages || pageIndex === currentPage) return;
    setDirection(pageIndex > currentPage ? 1 : -1);
    setCurrentPage(pageIndex);
    void nativeService.triggerHaptic('selection');
    if (onPageChange) onPageChange(pageIndex);
  };

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      goToPage(currentPage + 1);
    } else if (autoPlayInterval > 0) {
      goToPage(0);
    }
  };

  const handlePrev = () => {
    if (currentPage > 0) {
      goToPage(currentPage - 1);
    }
  };

  // Optional auto-play
  useEffect(() => {
    if (!autoPlayInterval || autoPlayInterval <= 0 || totalPages <= 1) return;
    const timer = setInterval(handleNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlayInterval, currentPage, totalPages]);

  // Touch handlers for fluid swiping
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
    touchDeltaRef.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    touchDeltaRef.current = deltaX;
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const deltaX = touchDeltaRef.current;
    const threshold = 40; // Pixels to switch page

    if (deltaX < -threshold) {
      handleNext();
    } else if (deltaX > threshold) {
      handlePrev();
    }

    touchStartRef.current = null;
    touchDeltaRef.current = 0;
  };

  if (totalPages === 0) return null;

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Pager viewport */}
      <div
        className="relative overflow-hidden w-full touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentPage}
            custom={direction}
            variants={{
              enter: (dir: number) => ({
                x: dir > 0 ? '100%' : '-100%',
                opacity: 0,
              }),
              center: {
                x: 0,
                opacity: 1,
                transition: {
                  x: { type: 'spring', stiffness: 320, damping: 32 },
                  opacity: { duration: 0.2 },
                },
              },
              exit: (dir: number) => ({
                x: dir > 0 ? '-100%' : '100%',
                opacity: 0,
                transition: {
                  x: { type: 'spring', stiffness: 320, damping: 32 },
                  opacity: { duration: 0.15 },
                },
              }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full"
          >
            {children[currentPage]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Material You pagination indicator dots */}
      {showDots && totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {children.map((_, idx) => {
            const isActive = idx === currentPage;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => goToPage(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  isActive
                    ? 'w-6 h-2 bg-violet-600 dark:bg-violet-400'
                    : 'w-2 h-2 bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'
                }`}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
