import React, { useState, useRef } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Download,
  Upload,
  RotateCcw,
  KeyRound,
  Shield,
  Check,
  AlertTriangle,
  Cloud,
} from 'lucide-react';
import { AppSettings } from '../types';
import { Sound } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onExportData: () => void;
  onImportData: (jsonStr: string) => boolean;
  onResetData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onExportData,
  onImportData,
  onResetData,
}) => {
  const [newPin, setNewPin] = useState(settings.masterPin);
  const [pinSaved, setPinSaved] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length >= 4) {
      Sound.success(settings.soundEnabled);
      onUpdateSettings({ ...settings, masterPin: newPin });
      setPinSaved(true);
      setTimeout(() => setPinSaved(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = onImportData(content);
        if (success) {
          Sound.success(settings.soundEnabled);
          setImportStatus('success');
          setTimeout(() => {
            setImportStatus('idle');
            onClose();
          }, 1500);
        } else {
          setImportStatus('error');
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] shadow-2xl p-6 space-y-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#F9FAFB] dark:bg-[#1F2937] text-[#6366F1] dark:text-[#818CF8]">
              <Settings className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-[#111827] dark:text-white">
              Dashboard Settings & Storage Engine
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Section 1: Appearance & Sound */}
        <div className="space-y-3">
          <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
            Preferences
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Theme Card */}
            <div
              onClick={() => {
                Sound.toggle(settings.soundEnabled);
                onUpdateSettings({ ...settings, darkMode: !settings.darkMode });
              }}
              className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/50 flex items-center justify-between cursor-pointer hover:border-[#D1D5DB] dark:hover:border-[#374151] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {settings.darkMode ? <Moon className="w-4 h-4 text-purple-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                <div>
                  <p className="text-xs font-bold text-[#111827] dark:text-white">Workspace Theme</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{settings.darkMode ? 'Dark Theme' : 'Professional Polish Light'}</p>
                </div>
              </div>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${settings.darkMode ? 'bg-[#6366F1]' : 'bg-[#D1D5DB]'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${settings.darkMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>

            {/* Audio Feedback Card */}
            <div
              onClick={() => {
                Sound.click(!settings.soundEnabled);
                onUpdateSettings({ ...settings, soundEnabled: !settings.soundEnabled });
              }}
              className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] dark:bg-[#1F2937]/50 flex items-center justify-between cursor-pointer hover:border-[#D1D5DB] dark:hover:border-[#374151] transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {settings.soundEnabled ? <Volume2 className="w-4 h-4 text-[#6366F1] dark:text-[#818CF8]" /> : <VolumeX className="w-4 h-4 text-[#9CA3AF]" />}
                <div>
                  <p className="text-xs font-bold text-[#111827] dark:text-white">Tactile Web Audio</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{settings.soundEnabled ? '0ms Audio Enabled' : 'Muted'}</p>
                </div>
              </div>
              <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${settings.soundEnabled ? 'bg-[#6366F1]' : 'bg-[#D1D5DB]'}`}>
                <div className={`w-3 h-3 rounded-full bg-white transition-transform ${settings.soundEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Password Vault PIN */}
        <div className="space-y-3 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
          <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
            Security & Vault Master PIN
          </span>

          <form onSubmit={handleSavePin} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="password"
                maxLength={8}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Set a vault PIN (4–8 digits)"
                className="w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              {pinSaved ? <Check className="w-3.5 h-3.5" /> : <KeyRound className="w-3.5 h-3.5" />}
              <span>{pinSaved ? 'Saved' : 'Update PIN'}</span>
            </button>
          </form>
        </div>

        {/* Section 3: Client-Side Storage & Backup */}
        <div className="space-y-3 pt-2 border-t border-[#F3F4F6] dark:border-[#1F2937]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block">
              Storage Engine &amp; Cloud Migration
            </span>
            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
              <Shield className="w-3 h-3" />
              LocalStorage + Auto Cloud Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                Sound.success(settings.soundEnabled);
                onExportData();
              }}
              className="p-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-[#1F2937]/50 dark:hover:bg-[#1F2937] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#111827] dark:text-white">Export Full JSON</p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Download offline backup</p>
              </div>
            </button>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-3 rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-[#1F2937]/50 dark:hover:bg-[#1F2937] flex items-center gap-2.5 text-left transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-[#6366F1] dark:text-[#818CF8] shrink-0" />
                <div>
                  <p className="text-xs font-bold text-[#111827] dark:text-white">Import Backup JSON</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Restore from file</p>
                </div>
              </button>
            </div>
          </div>

          {importStatus === 'success' && (
            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              Backup successfully imported! Reloading state...
            </p>
          )}

          {importStatus === 'error' && (
            <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              Invalid JSON format. Please verify the backup file.
            </p>
          )}
        </div>

        {/* Reset to Default */}
        <div className="pt-3 border-t border-[#F3F4F6] dark:border-[#1F2937] flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              if (confirm('Are you sure you want to reset all dashboard data back to initial sample state?')) {
                Sound.click(settings.soundEnabled);
                onResetData();
                onClose();
              }
            }}
            className="text-xs text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default Demo State</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
