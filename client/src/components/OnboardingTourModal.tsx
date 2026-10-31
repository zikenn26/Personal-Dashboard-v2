import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Command,
  Cloud,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Keyboard,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface OnboardingTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCommandPalette?: () => void;
}

interface TourStep {
  title: string;
  badge: string;
  icon: React.ReactNode;
  heading: string;
  description: string;
  features: { icon: React.ReactNode; text: string }[];
}

export const ONBOARDING_STORAGE_KEY = 'has_seen_onboarding';

export const OnboardingTourModal: React.FC<OnboardingTourModalProps> = ({
  isOpen,
  onClose,
  onOpenCommandPalette,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        handleFinish();
      } else if (e.key === 'ArrowRight' && currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else if (e.key === 'ArrowLeft' && currentStep > 0) {
        setCurrentStep((prev) => prev - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const handleFinish = () => {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    onClose();
  };

  const steps: TourStep[] = [
    {
      title: 'Welcome',
      badge: 'Step 1 of 3',
      icon: <Sparkles className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />,
      heading: 'Welcome to Your Unified Personal OS',
      description:
        'A distraction-free, privacy-first command center for your life. Manage daily tasks, build lasting habits, and track personal expenses with zero cloud lock-in.',
      features: [
        {
          icon: <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />,
          text: 'Offline-first architecture: Your data is always saved locally first.',
        },
        {
          icon: <Zap className="w-4 h-4 text-amber-500 shrink-0" />,
          text: 'Instant load times and native performance across Web and Android APK.',
        },
      ],
    },
    {
      title: 'Command Palette',
      badge: 'Step 2 of 3',
      icon: <Command className="w-6 h-6 text-indigo-500 dark:text-indigo-400" />,
      heading: 'Master Navigation with Command + K',
      description:
        'Hit ⌘K (or Ctrl+K) anywhere to instantly search across all modules, trigger quick task capture, toggle views, or switch between light and dark themes.',
      features: [
        {
          icon: <Keyboard className="w-4 h-4 text-indigo-500 shrink-0" />,
          text: 'Press ⌘K / Ctrl+K anytime or click the search bar at the top.',
        },
        {
          icon: <Zap className="w-4 h-4 text-indigo-500 shrink-0" />,
          text: 'Jump directly to Expenses, Habits, Goals, or quick capture in 1 keystroke.',
        },
      ],
    },
    {
      title: 'Realtime Sync',
      badge: 'Step 3 of 3',
      icon: <Cloud className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />,
      heading: 'Seamless Multi-Device Auto-Sync',
      description:
        'Your workspace automatically synchronizes in real time across all logged-in devices. Edits made on your phone or web browser update everywhere instantly without manual save buttons.',
      features: [
        {
          icon: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
          text: 'Conflict-free cloud updates with automatic retry and local caching.',
        },
        {
          icon: <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />,
          text: 'Strict account isolation guarantees your data stays private and consistent.',
        },
      ],
    },
  ];

  const step = steps[currentStep];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
        {/* Top Header / Progress */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              {step.badge}
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500">
              • {step.title}
            </span>
          </div>

          <button
            type="button"
            onClick={handleFinish}
            aria-label="Close tour"
            className="p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700/80 flex items-center justify-center mb-4">
            {step.icon}
          </div>

          <h2
            id="onboarding-tour-title"
            className="text-lg font-bold text-neutral-900 dark:text-neutral-100 mb-2"
          >
            {step.heading}
          </h2>

          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-5">
            {step.description}
          </p>

          <div className="space-y-2.5 bg-neutral-50 dark:bg-neutral-800/40 p-4 rounded-xl border border-neutral-200/60 dark:border-neutral-800">
            {step.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-neutral-700 dark:text-neutral-300">
                {f.icon}
                <span className="leading-snug">{f.text}</span>
              </div>
            ))}
          </div>

          {currentStep === 1 && onOpenCommandPalette && (
            <div className="mt-4 flex items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  handleFinish();
                  onOpenCommandPalette();
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1.5 cursor-pointer py-1"
              >
                <Keyboard className="w-3.5 h-3.5" />
                <span>Try pressing ⌘K or click here to test it now</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50/80 dark:bg-neutral-800/30 border-t border-neutral-100 dark:border-neutral-800">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={`Go to step ${index + 1}`}
                onClick={() => setCurrentStep(index)}
                className={`h-1.5 rounded-full transition-all cursor-pointer ${
                  currentStep === index
                    ? 'w-6 bg-indigo-600 dark:bg-indigo-400'
                    : 'w-1.5 bg-neutral-300 dark:bg-neutral-700 hover:bg-neutral-400'
                }`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
              >
                Skip
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Get Started</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
