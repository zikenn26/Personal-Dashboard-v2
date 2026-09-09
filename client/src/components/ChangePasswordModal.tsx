import React, { useState } from 'react';
import {
  KeyRound,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { Auth } from '../utils/auth';
import { Sound } from '../utils/audio';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  soundEnabled?: boolean;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  soundEnabled = true,
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleReset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword.trim()) {
      setErrorMsg('Please enter your current password.');
      Sound.error(soundEnabled);
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      Sound.error(soundEnabled);
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMsg('New password cannot be the same as your current password.');
      Sound.error(soundEnabled);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match. Please re-enter.');
      Sound.error(soundEnabled);
      return;
    }

    setLoading(true);
    Sound.click(soundEnabled);

    try {
      const res = await Auth.changePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccessMsg(res.message);
        Sound.success(soundEnabled);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setErrorMsg(res.message);
        Sound.error(soundEnabled);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to change password. Please try again.');
      Sound.error(soundEnabled);
    } finally {
      setLoading(false);
    }
  };

  // Password strength calculation
  const getStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-gray-200' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score, label: 'Weak', color: 'bg-amber-400' };
    if (score <= 4) return { score, label: 'Good', color: 'bg-blue-500' };
    return { score, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getStrength(newPassword);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-[#6366F1] dark:text-[#818CF8] border border-indigo-100 dark:border-indigo-900/50">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#111827] dark:text-white flex items-center gap-2">
                Change Password
              </h3>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                {userEmail ? (
                  <span>For <strong className="text-[#374151] dark:text-[#D1D5DB]">{userEmail}</strong></span>
                ) : (
                  'Update your secure account password'
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Success Message */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2 animate-in fade-in">
              <Check className="w-4 h-4 shrink-0 text-emerald-500" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          {/* Current Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] flex items-center justify-between">
              <span>Current Password</span>
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                className="w-full pl-9 pr-10 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1] transition-all"
              />
              <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                title={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB] flex items-center justify-between">
              <span>New Password</span>
              {newPassword && (
                <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                  Strength: {strength.label}
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                required
                minLength={6}
                className="w-full pl-9 pr-10 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1] transition-all"
              />
              <KeyRound className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                title={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Strength bar */}
            {newPassword && (
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-1 rounded-full overflow-hidden mt-1 flex gap-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.color}`}
                  style={{ width: `${Math.min(100, (strength.score / 5) * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Confirm New Password Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#374151] dark:text-[#D1D5DB]">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                required
                minLength={6}
                className="w-full pl-9 pr-10 py-2 rounded-xl text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#6366F1] transition-all"
              />
              <ShieldCheck className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer"
                title={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            {confirmPassword && newPassword && confirmPassword !== newPassword && (
              <p className="text-[10px] text-rose-500 font-medium">Passwords do not match</p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !!successMsg}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-[#6366F1] hover:bg-[#4F46E5] text-white transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>Updating...</span>
              ) : successMsg ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Updated!</span>
                </>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
