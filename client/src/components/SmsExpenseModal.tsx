import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  X,
  MessageSquare,
  Lock,
} from 'lucide-react';
import { motion } from 'motion/react';
import { smsExpenseService } from '../services/smsExpenseService';
import { Sound } from '../utils/audio';

export interface SmsExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  soundEnabled: boolean;
  onOpenRescan?: () => void;
}

export const SmsExpenseModal: React.FC<SmsExpenseModalProps> = ({
  isOpen,
  onClose,
  soundEnabled,
}) => {
  const [enabled, setEnabled] = useState(smsExpenseService.isAutoTrackingEnabled());
  const [permissionStatus, setPermissionStatus] = useState<string>('prompt');
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEnabled(smsExpenseService.isAutoTrackingEnabled());
      smsExpenseService.checkPermission().then(setPermissionStatus);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleEnable = async () => {
    Sound.click(soundEnabled);
    const next = !enabled;
    setEnabled(next);
    await smsExpenseService.setAutoTrackingEnabled(next);
  };

  const handleGrantPermission = async () => {
    Sound.click(soundEnabled);
    setIsRequesting(true);
    try {
      const res = await smsExpenseService.requestPermission();
      setPermissionStatus(res);
      if (res === 'granted') {
        setEnabled(true);
        await smsExpenseService.setAutoTrackingEnabled(true);
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const isGranted = permissionStatus === 'granted';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-xs select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        className="relative w-full max-w-sm max-h-[85vh] bg-white dark:bg-[#111827] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col"
      >
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 to-transparent shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                SMS Permissions
              </h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Android Transaction Auto-Logging
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Compact, scrollable if screen is very short */}
        <div className="p-4 space-y-3 overflow-y-auto overscroll-contain flex-1">
          {/* SMS Permission Card */}
          <div className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  READ_SMS Permission
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isGranted
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                }`}
              >
                {isGranted ? 'Granted' : 'Required'}
              </span>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
              Allows LifeOS to read incoming and recent bank transaction SMS directly on your phone.
            </p>

            {!isGranted ? (
              <button
                type="button"
                onClick={handleGrantPermission}
                disabled={isRequesting}
                className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isRequesting ? 'Requesting...' : 'Grant SMS Permission'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 py-1.5 px-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Permission is active and operational</span>
              </div>
            )}
          </div>

          {/* SMS Auto-Logging Switch */}
          <div className="p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121826] flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Auto-Log Expenses
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold ${
                    enabled
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}
                >
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug truncate">
                Automatically record transactions when bank SMS arrives.
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleEnable}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              title={enabled ? 'Disable auto-logging' : 'Enable auto-logging'}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* On-Device Privacy Note */}
          <div className="flex items-center gap-1.5 px-1 text-[10px] text-gray-400 dark:text-gray-500">
            <Lock className="w-3 h-3 shrink-0" />
            <span>100% on-device processing. No SMS data ever leaves your phone.</span>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SmsExpenseModal;
