import React from 'react';
import { motion } from 'motion/react';
import { Check } from 'lucide-react';

export interface WaveformVisualizerProps {
  isActive: boolean;
  barCount?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  volume?: number; // 0 to 1
  colorTheme?: 'cyan' | 'indigo' | 'white' | 'emerald' | 'amber';
  /**
   * Subtle visual indicator or color change when voice input has been successfully processed into a command
   */
  isProcessed?: boolean;
  hasProcessedCommand?: boolean;
  showSuccessBadge?: boolean;
  className?: string;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isActive,
  barCount = 5,
  size = 'md',
  volume = 0,
  colorTheme = 'cyan',
  isProcessed = false,
  hasProcessedCommand = false,
  showSuccessBadge = true,
  className = '',
}) => {
  const isCommandProcessed = isProcessed || hasProcessedCommand;

  // Dimension presets
  const dimensions = {
    xs: { containerHeight: 'h-3.5', barWidth: 'w-0.5', minHeight: 4, maxHeight: 14, gap: 'gap-0.5', badgeSize: 'w-2.5 h-2.5 text-[8px]' },
    sm: { containerHeight: 'h-4', barWidth: 'w-1', minHeight: 5, maxHeight: 16, gap: 'gap-0.5', badgeSize: 'w-3 h-3 text-[9px]' },
    md: { containerHeight: 'h-5', barWidth: 'w-1', minHeight: 6, maxHeight: 20, gap: 'gap-1', badgeSize: 'w-3.5 h-3.5 text-[10px]' },
    lg: { containerHeight: 'h-7', barWidth: 'w-1.5', minHeight: 8, maxHeight: 28, gap: 'gap-1.5', badgeSize: 'w-4 h-4 text-xs' },
  }[size];

  // Color gradient mappings - shifts dynamically to vibrant emerald glow when processed
  const activeColorTheme = isCommandProcessed ? 'emerald' : colorTheme;
  const colorClasses = {
    cyan: 'bg-gradient-to-t from-cyan-400 to-sky-200 shadow-cyan-400/50',
    indigo: 'bg-gradient-to-t from-indigo-500 to-purple-300 shadow-indigo-500/50',
    emerald: 'bg-gradient-to-t from-emerald-400 via-teal-300 to-emerald-100 shadow-emerald-400/80',
    white: 'bg-gradient-to-t from-white/90 to-cyan-100 shadow-white/50',
    amber: 'bg-gradient-to-t from-amber-400 to-yellow-200 shadow-amber-400/60',
  }[activeColorTheme];

  // Scale multipliers for natural organic soundwave curves
  const scaleMultipliers = [0.35, 0.75, 1.0, 0.65, 0.45, 0.85, 0.5];

  return (
    <div
      className={`inline-flex items-center justify-center ${dimensions.containerHeight} ${dimensions.gap} ${className} relative`}
      aria-label={
        isCommandProcessed
          ? 'Voice input successfully processed into command'
          : isActive
          ? 'Microphone actively listening'
          : 'Microphone idle'
      }
    >
      {Array.from({ length: barCount }).map((_, index) => {
        const multiplier = scaleMultipliers[index % scaleMultipliers.length];
        const boost = volume > 0 ? Math.min(1.8, 1 + volume * 2.5) : 1;
        const targetHigh = Math.min(
          dimensions.maxHeight,
          Math.max(dimensions.minHeight, dimensions.maxHeight * multiplier * boost)
        );
        const targetLow = Math.max(
          dimensions.minHeight,
          dimensions.minHeight * (1 + (index % 2) * 0.4)
        );

        // Harmonic success wave heights
        const successHeight = Math.min(
          dimensions.maxHeight,
          Math.max(dimensions.minHeight * 1.5, dimensions.maxHeight * (0.5 + 0.5 * Math.sin((index / barCount) * Math.PI)))
        );

        return (
          <motion.span
            key={index}
            className={`rounded-full ${dimensions.barWidth} ${colorClasses} shadow-xs transition-colors duration-300`}
            animate={
              isCommandProcessed
                ? {
                    height: [
                      `${targetLow}px`,
                      `${successHeight}px`,
                      `${targetLow + 2}px`,
                    ],
                    opacity: [0.8, 1, 0.95],
                    scale: [1, 1.15, 1.05],
                  }
                : isActive
                ? {
                    height: [
                      `${targetLow}px`,
                      `${targetHigh}px`,
                      `${Math.round((targetLow + targetHigh) / 2)}px`,
                      `${targetLow}px`,
                    ],
                    opacity: [0.75, 1, 0.85, 0.75],
                    scale: 1,
                  }
                : {
                    height: `${dimensions.minHeight}px`,
                    opacity: 0.4,
                    scale: 1,
                  }
            }
            transition={
              isCommandProcessed
                ? {
                    duration: 0.45,
                    ease: 'easeOut',
                    delay: index * 0.05,
                  }
                : isActive
                ? {
                    duration: 0.55 + (index % 3) * 0.15,
                    repeat: Infinity,
                    repeatType: 'reverse',
                    ease: 'easeInOut',
                    delay: (index * 0.08) % 0.4,
                  }
                : {
                    duration: 0.25,
                  }
            }
            style={{
              minHeight: `${dimensions.minHeight}px`,
            }}
          />
        );
      })}

      {/* Subtle Success Check Indicator Badge */}
      {isCommandProcessed && showSuccessBadge && (
        <motion.span
          initial={{ scale: 0, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={{ type: 'spring', damping: 15, stiffness: 350 }}
          className={`ml-1 inline-flex items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-400/50 shadow-xs shadow-emerald-500/50 ${dimensions.badgeSize}`}
          title="Command executed successfully"
        >
          <Check className="w-full h-full p-0.5" strokeWidth={3} />
        </motion.span>
      )}
    </div>
  );
};
