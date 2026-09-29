import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  X,
  MessageSquare,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-lg bg-white dark:bg-[#111827] rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  SMS Settings & Permissions
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Android Native
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Manage SMS auto-logging and Android inbox permissions
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Only Permission and Setting content */}
        <div className="p-6 space-y-4">
          {/* Privacy & Regulatory Guarantee Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-xs space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>100% On-Device Privacy Guaranteed</span>
            </div>
            <p className="text-emerald-700/90 dark:text-emerald-400/90 leading-relaxed text-[11px]">
              LifeOS only checks banking transaction confirmations and strictly ignores OTPs, personal SMS, and promotional offers. All SMS parsing runs completely offline on your device—no message content is ever uploaded to any cloud server.
            </p>
          </div>

          {/* SMS Permission Card with Enable SMS Button */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 space-y-3 bg-gray-50/50 dark:bg-gray-900/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  Android SMS Permission (READ_SMS)
                </span>
              </div>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isGranted
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {isGranted ? 'Permission Granted' : 'Permission Required'}
              </span>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Granting READ_SMS permission allows LifeOS to read incoming and recent bank transaction SMS directly on your Android phone.
            </p>

            {!isGranted ? (
              <button
                type="button"
                onClick={handleGrantPermission}
                disabled={isRequesting}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isRequesting ? 'Requesting Permission...' : 'Enable SMS (Grant Permission)'}</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 py-2 px-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>READ_SMS permission is active and operational.</span>
              </div>
            )}
          </div>

          {/* SMS Expense Auto-Logging Toggle Switch */}
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121826] flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-900 dark:text-white">
                  SMS Auto-Logging
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    enabled
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-gray-200/70 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-300 dark:border-gray-700'
                  }`}
                >
                  {enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Automatically create spending entries as soon as new bank or UPI transaction messages arrive.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleEnable}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
              title={enabled ? 'Disable SMS auto-logging' : 'Enable SMS auto-logging'}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-bold transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SmsExpenseModal;
