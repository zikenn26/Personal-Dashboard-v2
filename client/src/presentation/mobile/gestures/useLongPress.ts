import { useRef, useCallback } from 'react';
import { nativeService } from '../../../services/nativeService';

export interface UseLongPressOptions {
  threshold?: number; // ms to trigger long press (default: 480)
  onStart?: () => void;
  onFinish?: () => void;
  onCancel?: () => void;
  enableHaptic?: boolean;
}

/**
 * Reusable Android-style long-press interaction hook
 */
export function useLongPress(
  callback: (e: React.TouchEvent | React.MouseEvent) => void,
  options: UseLongPressOptions = {}
) {
  const {
    threshold = 480,
    onStart,
    onFinish,
    onCancel,
    enableHaptic = true,
  } = options;

  const timerRef = useRef<any>(null);
  const isLongPressRef = useRef<boolean>(false);
  const startCoordsRef = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if ('touches' in e && e.touches.length > 1) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startCoordsRef.current = { x: clientX, y: clientY };
      isLongPressRef.current = false;

      if (onStart) onStart();

      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        if (enableHaptic) {
          void nativeService.triggerHaptic('impactMedium');
        }
        callback(e);
        if (onFinish) onFinish();
      }, threshold);
    },
    [callback, threshold, onStart, onFinish, enableHaptic]
  );

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!isLongPressRef.current && onCancel) {
      onCancel();
    }
    startCoordsRef.current = null;
  }, [onCancel]);

  const move = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!startCoordsRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const dx = Math.abs(clientX - startCoordsRef.current.x);
      const dy = Math.abs(clientY - startCoordsRef.current.y);

      // If user moved more than 10px, cancel long-press (they are scrolling or dragging)
      if (dx > 10 || dy > 10) {
        clear();
      }
    },
    [clear]
  );

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: move,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}
