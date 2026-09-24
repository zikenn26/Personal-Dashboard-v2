import React, { useState, useMemo } from 'react';
import { Shield, Lock, Unlock, Copy, Check, Eye, EyeOff, Plus, Trash2, KeyRound } from 'lucide-react';
import { VaultCredential } from '../../../../types';
import { nativeService } from '../../../../services/nativeService';
import { BottomSheet } from '../../gestures/BottomSheet';
import { AndroidActionSheet, ActionSheetItem } from '../../components/AndroidActionSheet';

export interface AndroidVaultScreenProps {
  credentials: VaultCredential[];
  masterPin?: string;
  onAddCredential?: (cred: Omit<VaultCredential, 'id' | 'updatedAt'>) => void;
  onDeleteCredential?: (id: string) => void;
}

export const AndroidVaultScreen: React.FC<AndroidVaultScreenProps> = ({
  credentials,
  masterPin,
  onAddCredential,
  onDeleteCredential,
}) => {
  const [isLocked, setIsLocked] = useState<boolean>(Boolean(masterPin));
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [activeActionCred, setActiveActionCred] = useState<VaultCredential | null>(null);

  // Form states
  const [newService, setNewService] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newCategory, setNewCategory] = useState<'Accounts' | 'API Keys' | 'Servers' | 'Finance'>('Accounts');

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (enteredPin === masterPin) {
      void nativeService.triggerHaptic('success');
      setIsLocked(false);
      setPinError(false);
    } else {
      void nativeService.triggerHaptic('error');
      setPinError(true);
      setEnteredPin('');
    }
  };

  const handleCopy = (text: string, key: string) => {
    void nativeService.triggerHaptic('success');
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const toggleReveal = (id: string) => {
    void nativeService.triggerHaptic('selection');
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.trim() || !newSecret.trim() || !onAddCredential) return;
    void nativeService.triggerHaptic('success');
    onAddCredential({
      service: newService.trim(),
      username: newUsername.trim(),
      maskedSecret: newSecret.trim(),
      category: newCategory,
      strength: newSecret.length > 12 ? 'strong' : newSecret.length > 8 ? 'good' : 'fair',
    });
    setNewService('');
    setNewUsername('');
    setNewSecret('');
    setIsAddSheetOpen(false);
  };

  const handleDelete = (id: string) => {
    void nativeService.triggerHaptic('warning');
    if (onDeleteCredential) onDeleteCredential(id);
  };

  const filteredCredentials = useMemo(() => {
    if (!searchQuery.trim()) return credentials;
    const q = searchQuery.toLowerCase();
    return credentials.filter(
      (c) =>
        c.service.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [credentials, searchQuery]);

  const actionItems: ActionSheetItem[] = activeActionCred
    ? [
        {
          label: 'Copy Password',
          icon: <Copy className="w-4 h-4" />,
          onClick: () => handleCopy(activeActionCred.maskedSecret, `${activeActionCred.id}-pwd`),
        },
        {
          label: 'Delete Credential',
          icon: <Trash2 className="w-4 h-4" />,
          isDestructive: true,
          onClick: () => handleDelete(activeActionCred.id),
        },
      ]
    : [];

  if (isLocked) {
    return (
      <div className="w-full max-w-lg mx-auto px-4 py-12 flex flex-col items-center justify-center text-center select-none">
        <div className="w-14 h-14 rounded-3xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center mb-4 shadow-sm">
          <Shield className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-black text-gray-900 dark:text-white">
          Password Vault is Locked
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs">
          Enter your Master PIN to access your stored passwords and private credentials.
        </p>

        <form onSubmit={handleUnlock} className="w-full max-w-xs mt-6 space-y-3">
          <input
            type="password"
            maxLength={6}
            value={enteredPin}
            onChange={(e) => setEnteredPin(e.target.value)}
            placeholder="Enter Master PIN"
            className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] text-center text-lg tracking-widest font-mono text-gray-900 dark:text-white focus:outline-none focus:border-violet-500 shadow-2xs"
          />
          {pinError && (
            <p className="text-xs font-bold text-rose-600">Incorrect PIN. Try again.</p>
          )}
          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Unlock Vault
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-3.5 pb-24 pt-2 space-y-3.5">
      {/* Top Banner */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Password Vault
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {credentials.length} encrypted credentials
          </p>
        </div>

        {onAddCredential && (
          <button
            type="button"
            onClick={() => {
              void nativeService.triggerHaptic('selection');
              setIsAddSheetOpen(true);
            }}
            className="px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Secret</span>
          </button>
        )}
      </div>

      {/* Credentials List */}
      <div className="space-y-2.5">
        {filteredCredentials.length === 0 ? (
          <div className="p-8 text-center rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40]">
            <KeyRound className="w-10 h-10 text-violet-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              No credentials stored
            </p>
          </div>
        ) : (
          filteredCredentials.map((c) => {
            const isRevealed = Boolean(revealedIds[c.id]);
            return (
              <div
                key={c.id}
                className="p-3.5 rounded-3xl bg-white dark:bg-[#121826] border border-[#E8E5F3] dark:border-[#242D40] shadow-2xs space-y-2 select-none"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs">
                      {c.service.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                        {c.service}
                      </h4>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {c.username}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#1A2234] text-gray-600 dark:text-gray-400">
                    {c.category}
                  </span>
                </div>

                {/* Secret Row */}
                <div className="flex items-center justify-between p-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40]">
                  <span className="font-mono text-xs text-gray-800 dark:text-gray-200 truncate pr-2">
                    {isRevealed ? c.maskedSecret : '••••••••••••'}
                  </span>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleReveal(c.id)}
                      className="p-1 text-gray-400 hover:text-violet-600 active:scale-95 transition-all"
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(c.maskedSecret, `${c.id}-pwd`)}
                      className="p-1 text-gray-400 hover:text-emerald-600 active:scale-95 transition-all"
                    >
                      {copiedKey === `${c.id}-pwd` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Credential Sheet */}
      <BottomSheet
        isOpen={isAddSheetOpen}
        onClose={() => setIsAddSheetOpen(false)}
        title="Add Vault Secret"
        subtitle="Secure local password storage"
      >
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Service / Application
            </label>
            <input
              type="text"
              required
              value={newService}
              onChange={(e) => setNewService(e.target.value)}
              placeholder="e.g. GitHub, AWS, Netflix"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-sm text-gray-900 dark:text-white focus:outline-none focus:border-violet-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Username / Email
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
              Password / API Key
            </label>
            <input
              type="password"
              required
              value={newSecret}
              onChange={(e) => setNewSecret(e.target.value)}
              placeholder="Secret value"
              className="w-full px-3.5 py-2 rounded-2xl bg-gray-50 dark:bg-[#1A2234] border border-[#E8E5F3] dark:border-[#242D40] text-xs text-gray-900 dark:text-white font-mono"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md active:scale-95 transition-all cursor-pointer"
          >
            Save Credential
          </button>
        </form>
      </BottomSheet>
    </div>
  );
};
