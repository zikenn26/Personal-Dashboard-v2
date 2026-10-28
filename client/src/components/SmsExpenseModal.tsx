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
        className="relative w-[calc(100vw-2.5rem)] max-w-[340px] max-h-[85vh] bg-white dark:bg-[#111827] rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col my-auto mx-auto"
      >
        {/* Compact Header */}
        <div className="px-3.5 py-2.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-emerald-500/5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Smartphone className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
              Enable SMS
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Compact & Clean */}
        <div className="p-3.5 space-y-2.5 overflow-y-auto overscroll-contain flex-1">
          {/* SMS Permission Action */}
          <div className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                  SMS Permission
                </span>
              </div>
              <span
                className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                  isGranted
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                }`}
              >
                {isGranted ? 'Granted' : 'Required'}
              </span>
            </div>

            {!isGranted ? (
              <button
                type="button"
                onClick={handleGrantPermission}
                disabled={isRequesting}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs active:scale-98"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{isRequesting ? 'Requesting...' : 'Grant SMS Permission'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 py-1 px-2 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Active & ready</span>
              </div>
            )}
          </div>

          {/* SMS Auto-Logging Switch */}
          <div className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121826] flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white block">
                Auto-Log Expenses
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block truncate">
                Track incoming bank SMS
              </span>
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

          {/* Privacy Note */}
          <div className="flex items-center gap-1.5 px-0.5 text-[10px] text-gray-400 dark:text-gray-500">
            <Lock className="w-3 h-3 shrink-0" />
            <span>100% on-device. SMS data never leaves your phone.</span>
          </div>
        </div>

        {/* Compact Footer */}
        <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SmsExpenseModal;
