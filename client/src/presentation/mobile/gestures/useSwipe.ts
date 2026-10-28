import { useRef, useCallback } from 'react';

export interface SwipeInput {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number; // Minimum pixels to trigger swipe (default: 45)
  velocityThreshold?: number; // Minimum px/ms (default: 0.3)
}

export interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onTouchCancel: () => void;
}

/**
 * Hook to detect horizontal and vertical swipes with touch event handlers
 */
export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onSwipeDown,
  threshold = 45,
  velocityThreshold = 0.25,
}: SwipeInput): SwipeHandlers {
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchCurrentRef = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchCurrentRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchCurrentRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !touchCurrentRef.current) {
      touchStartRef.current = null;
      touchCurrentRef.current = null;
      return;
    }

    const deltaX = touchCurrentRef.current.x - touchStartRef.current.x;
    const deltaY = touchCurrentRef.current.y - touchStartRef.current.y;
    const deltaTime = Math.max(1, Date.now() - touchStartRef.current.time);
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const velocityX = absX / deltaTime;
    const velocityY = absY / deltaTime;

    // Determine primary axis
    if (absX > absY) {
      // Horizontal swipe
      if (absX >= threshold || velocityX >= velocityThreshold) {
        if (deltaX > 0 && onSwipeRight) {
          onSwipeRight();
        } else if (deltaX < 0 && onSwipeLeft) {
          onSwipeLeft();
        }
      }
    } else {
      // Vertical swipe
      if (absY >= threshold || velocityY >= velocityThreshold) {
        if (deltaY > 0 && onSwipeDown) {
          onSwipeDown();
        } else if (deltaY < 0 && onSwipeUp) {
          onSwipeUp();
        }
      }
    }

    touchStartRef.current = null;
    touchCurrentRef.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, velocityThreshold]);

  const onTouchCancel = useCallback(() => {
    touchStartRef.current = null;
    touchCurrentRef.current = null;
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
}
