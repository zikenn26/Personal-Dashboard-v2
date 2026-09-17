import React from 'react';
import { motion } from 'motion/react';

interface WaveformVisualizerProps {
  isActive: boolean;
  barCount?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  volume?: number; // 0 to 1
  colorTheme?: 'cyan' | 'indigo' | 'white' | 'emerald';
  className?: string;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isActive,
  barCount = 5,
  size = 'md',
  volume = 0,
  colorTheme = 'cyan',
  className = '',
}) => {
  // Dimension presets
  const dimensions = {
    xs: { containerHeight: 'h-3.5', barWidth: 'w-0.5', minHeight: 4, maxHeight: 14, gap: 'gap-0.5' },
    sm: { containerHeight: 'h-4', barWidth: 'w-1', minHeight: 5, maxHeight: 16, gap: 'gap-0.5' },
    md: { containerHeight: 'h-5', barWidth: 'w-1', minHeight: 6, maxHeight: 20, gap: 'gap-1' },
    lg: { containerHeight: 'h-7', barWidth: 'w-1.5', minHeight: 8, maxHeight: 28, gap: 'gap-1.5' },
  }[size];

  // Color gradient mappings
  const colorClasses = {
    cyan: 'bg-gradient-to-t from-cyan-400 to-sky-200 shadow-cyan-400/50',
    indigo: 'bg-gradient-to-t from-indigo-500 to-purple-300 shadow-indigo-500/50',
    emerald: 'bg-gradient-to-t from-emerald-400 to-teal-200 shadow-emerald-400/50',
    white: 'bg-gradient-to-t from-white/90 to-cyan-100 shadow-white/50',
  }[colorTheme];

  // Scale multipliers for natural organic soundwave curves
  const scaleMultipliers = [0.35, 0.75, 1.0, 0.65, 0.45, 0.85, 0.5];

  return (
    <div
      className={`inline-flex items-center justify-center ${dimensions.containerHeight} ${dimensions.gap} ${className}`}
      aria-label={isActive ? 'Microphone actively listening' : 'Microphone idle'}
    >
      {Array.from({ length: barCount }).map((_, index) => {
        const multiplier = scaleMultipliers[index % scaleMultipliers.length];
        const boost = volume > 0 ? Math.min(1.8, 1 + volume * 2.5) : 1;
        const targetHigh = Math.min(dimensions.maxHeight, Math.max(dimensions.minHeight, dimensions.maxHeight * multiplier * boost));
        const targetLow = Math.max(dimensions.minHeight, dimensions.minHeight * (1 + (index % 2) * 0.4));

        return (
          <motion.span
            key={index}
            className={`rounded-full ${dimensions.barWidth} ${colorClasses} shadow-xs`}
            animate={
              isActive
                ? {
                    height: [
                      `${targetLow}px`,
                      `${targetHigh}px`,
                      `${Math.round((targetLow + targetHigh) / 2)}px`,
                      `${targetLow}px`,
                    ],
                    opacity: [0.75, 1, 0.85, 0.75],
                  }
                : {
                    height: `${dimensions.minHeight}px`,
                    opacity: 0.4,
                  }
            }
            transition={
              isActive
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
    </div>
  );
};
