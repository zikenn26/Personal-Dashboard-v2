import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Plus,
  ShieldCheck,
  ShieldAlert,
  Search,
  Trash2,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { VaultCredential } from '../types';
import { Sound } from '../utils/audio';

interface PasswordVaultProps {
  credentials: VaultCredential[];
  masterPin: string;
  onAddCredential: (cred: Omit<VaultCredential, 'id' | 'updatedAt'>) => void;
  onDeleteCredential: (id: string) => void;
  soundEnabled: boolean;
  onOpenSettings?: () => void;
}

export const PasswordVault: React.FC<PasswordVaultProps> = ({
  credentials,
  masterPin,
  onAddCredential,
  onDeleteCredential,
  soundEnabled,
  onOpenSettings,
}) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);

  // New credential state
  const [newService, setNewService] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newCategory, setNewCategory] = useState<VaultCredential['category']>('API Keys');
  const [newNotes, setNewNotes] = useState('');

  const generateSecurePassword = (length = 20) => {
    Sound.click(soundEnabled);
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[array[i] % charset.length];
    }
    setNewSecret(result);
  };

  const calculateStrength = (val: string): VaultCredential['strength'] => {
    if (!val || val.length < 8) return 'weak';
    const hasUpper = /[A-Z]/.test(val);
    const hasLower = /[a-z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const hasSpecial = /[^A-Za-z0-9]/.test(val);
    const poolScore = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);
    if (val.length >= 16 && poolScore >= 3) return 'strong';
    if (val.length >= 10 && poolScore >= 2) return 'good';
    return 'fair';
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === masterPin) {
      Sound.success(soundEnabled);
      setIsUnlocked(true);
      setPinError(false);
      setPinInput('');
    } else {
      Sound.click(soundEnabled);
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  const handleLock = () => {
    Sound.click(soundEnabled);
    setIsUnlocked(false);
    setRevealedIds({});
  };

  const toggleReveal = (id: string) => {
    Sound.click(soundEnabled);
    setRevealedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopy = (id: string, secret: string) => {
    Sound.click(soundEnabled);
    navigator.clipboard.writeText(secret);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.trim() || !newSecret.trim()) return;

    Sound.success(soundEnabled);
    const strength = calculateStrength(newSecret);

    onAddCredential({
      service: newService.trim(),
      username: newUsername.trim(),
      maskedSecret: newSecret.trim(),
      category: newCategory,
      notes: newNotes.trim() || undefined,
      strength,
    });

    setNewService('');
    setNewUsername('');
    setNewSecret('');
    setNewNotes('');
    setShowAddModal(false);
  };

  const filteredCredentials = credentials.filter((c) => {
    if (selectedCategory !== 'All' && c.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.service.toLowerCase().includes(q) ||
        c.username.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="rounded-xl border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] p-5 shadow-xs transition-colors notion-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-[#F3F4F6] dark:border-[#1F2937]">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <KeyRound className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-1.5">
              <span>Password Vault Gateway</span>
              <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                LOCAL ONLY
              </span>
            </h3>
            <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
              AES-GCM encrypted local secret repository
            </p>
          </div>
        </div>

        {isUnlocked ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                Sound.click(soundEnabled);
                setShowAddModal(true);
              }}
              className="px-2.5 py-1 text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] hover:opacity-90 rounded-lg transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Secret</span>
            </button>
            <button
              onClick={handleLock}
              className="px-2.5 py-1 text-xs font-semibold bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#E5E7EB] hover:bg-[#F3F4F6] dark:hover:bg-[#374151] rounded-lg transition-all flex items-center gap-1 cursor-pointer"
              title="Lock Vault"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Locked State Gateway View */}
      {!isUnlocked ? (
        <div className="py-6 px-4 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] flex items-center justify-center mx-auto text-[#6B7280] dark:text-[#9CA3AF] shadow-2xs">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="max-w-xs mx-auto space-y-1">
            <h4 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider">
              Protected by Local PIN
            </h4>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
              {masterPin ? 'Unlock with your vault PIN. Secrets are decrypted only in this browser session.' : 'Set a vault PIN in Account settings before storing or opening secrets.'}
            </p>
            {!masterPin && onOpenSettings && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Configure Master PIN</span>
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleUnlock} className="max-w-xs mx-auto space-y-2.5">
            <div className="relative">
              <input
                type="password"
                maxLength={8}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter 4-digit PIN"
                autoComplete="off"
                className={`w-full px-3 py-2 text-center text-sm font-mono tracking-widest rounded-lg bg-white dark:bg-[#111827] border ${
                  pinError
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-[#E5E7EB] dark:border-[#374151]'
                } text-[#111827] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#6366F1]`}
              />
            </div>

            {pinError && (
              <p className="text-[11px] text-rose-500 font-medium">
                Incorrect PIN. Please try again.
              </p>
            )}

            <button
              type="submit"
              disabled={!pinInput || !masterPin}
              className="w-full py-2 rounded-lg text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Unlock Gateway</span>
            </button>
          </form>
        </div>
      ) : (
        /* Unlocked Credentials List */
        <div className="space-y-3">
          {/* Filter & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['All', 'API Keys', 'Servers', 'Accounts', 'Finance'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    Sound.click(soundEnabled);
                    setSelectedCategory(cat);
                  }}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#111827] text-white dark:bg-white dark:text-[#111827] shadow-2xs'
                      : 'text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-36">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search vault..."
                className="w-full pl-8 pr-2 py-1 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-white placeholder:text-[#9CA3AF] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>
          </div>

          {/* Credentials cards */}
          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {filteredCredentials.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#9CA3AF]">
                No credentials stored in this category.
              </div>
            ) : (
              filteredCredentials.map((cred) => {
                const isRevealed = !!revealedIds[cred.id];
                const isCopied = copiedId === cred.id;

                return (
                  <div
                    key={cred.id}
                    className="p-3 rounded-lg bg-[#F9FAFB] dark:bg-[#1F2937]/50 border border-[#E5E7EB] dark:border-[#374151] hover:border-[#D1D5DB] dark:hover:border-[#4B5563] transition-colors space-y-2 group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-semibold text-[#111827] dark:text-neutral-100 truncate">
                          {cred.service}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-mono font-medium">
                          {cred.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            Sound.click(soundEnabled);
                            onDeleteCredential(cred.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-[#9CA3AF] hover:text-rose-500 rounded transition-opacity cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {cred.username && (
                      <p className="text-[11px] font-mono text-[#6B7280] dark:text-[#9CA3AF] truncate">
                        user: {cred.username}
                      </p>
                    )}

                    {/* Masked / Unmasked Key Display */}
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151]">
                      <div className="font-mono text-xs text-[#111827] dark:text-[#E5E7EB] truncate flex-1 select-all">
                        {isRevealed ? cred.maskedSecret : '••••••••••••••••••••'}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleReveal(cred.id)}
                          className="p-1 text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white rounded cursor-pointer transition-colors"
                          title={isRevealed ? 'Hide secret' : 'Reveal secret'}
                        >
                          {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleCopy(cred.id, cred.maskedSecret)}
                          className="p-1 text-[#9CA3AF] hover:text-[#6366F1] dark:hover:text-[#818CF8] rounded cursor-pointer transition-colors"
                          title="Copy to clipboard"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {cred.notes && (
                      <p className="text-[10px] text-[#9CA3AF] italic">
                        {cred.notes}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Add Credential Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleAddSubmit}
            className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#1F2937] p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6] dark:border-[#1F2937]">
              <h4 className="text-sm font-bold text-[#111827] dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#6366F1]" />
                <span>Add Local Secret</span>
              </h4>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-[#9CA3AF] hover:text-[#111827] dark:hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Service / Label
              </label>
              <input
                type="text"
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                placeholder="e.g. AWS Production Key, GitHub Token"
                autoFocus
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Username / Identifier
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="admin@domain.io"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                  Category
                </label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as VaultCredential['category'])}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
                >
                  <option value="API Keys">API Keys</option>
                  <option value="Servers">Servers / SSH</option>
                  <option value="Accounts">Accounts</option>
                  <option value="Finance">Finance</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
                  Password / Secret Token
                </label>
                <button
                  type="button"
                  onClick={() => generateSecurePassword(20)}
                  className="text-[10px] font-semibold text-[#6366F1] dark:text-[#818CF8] hover:underline flex items-center gap-1 cursor-pointer"
                  title="Generate cryptographically secure 20-character password"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Generate Strong</span>
                </button>
              </div>
              <input
                type="text"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder="Secret key string..."
                className="w-full px-3 py-1.5 rounded-lg text-xs font-mono bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
              />
              {newSecret && (
                <div className="mt-1 flex items-center justify-between text-[10px]">
                  <span className="text-[#9CA3AF]">Strength:</span>
                  <span
                    className={`font-semibold capitalize ${
                      calculateStrength(newSecret) === 'strong'
                        ? 'text-emerald-500'
                        : calculateStrength(newSecret) === 'good'
                        ? 'text-blue-500'
                        : calculateStrength(newSecret) === 'fair'
                        ? 'text-amber-500'
                        : 'text-rose-500'
                    }`}
                  >
                    {calculateStrength(newSecret)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold block mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Scoped to us-west-2 cluster"
                className="w-full px-3 py-1.5 rounded-lg text-xs bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newService.trim() || !newSecret.trim()}
                className="px-4 py-1.5 text-xs font-semibold bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg disabled:opacity-40 cursor-pointer shadow-2xs"
              >
                Save Secret
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
