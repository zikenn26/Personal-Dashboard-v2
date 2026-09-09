import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  MapPin,
  RefreshCw,
  Copy,
  Check,
  Globe,
  Github,
  Linkedin,
  Twitter,
  Mail,
  Edit3,
  Calendar,
  CheckCircle2,
  Zap,
  TrendingUp,
} from 'lucide-react';
import { UserProfile, TodoItem, HabitItem, ExpenseItem, LifeMilestone } from '../types';
import { Sound } from '../utils/audio';

interface HeaderBannerProps {
  profile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  todos: TodoItem[];
  habits: HabitItem[];
  expenses: ExpenseItem[];
  milestones: LifeMilestone[];
  soundEnabled: boolean;
}

const DAILY_QUOTES = [
  { text: 'Simplicity is the prerequisite for reliability.', author: 'Edsger W. Dijkstra', tag: 'Architecture' },
  { text: 'The details are not the details. They make the design.', author: 'Charles Eames', tag: 'Design' },
  { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck', tag: 'Engineering' },
  { text: 'Premature optimization is the root of all evil.', author: 'Donald Knuth', tag: 'Performance' },
  { text: 'Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away.', author: 'Antoine de Saint-Exupéry', tag: 'Craft' },
  { text: 'First, solve the problem. Then, write the code.', author: 'John Johnson', tag: 'Problem Solving' },
  { text: 'Any fool can write code that a computer can understand. Good programmers write code that humans can understand.', author: 'Martin Fowler', tag: 'Craft' },
];

const BANNER_PRESETS = [
  { id: 'gradient-slate', name: 'Deep Space', bg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' },
  { id: 'gradient-emerald', name: 'Forest Twilight', bg: 'linear-gradient(135deg, #064e3b 0%, #0f172a 60%, #1e293b 100%)' },
  { id: 'gradient-indigo', name: 'Midnight Violet', bg: 'linear-gradient(135deg, #312e81 0%, #1e1b4b 60%, #0f172a 100%)' },
  { id: 'gradient-minimal', name: 'Minimal Neutral', bg: 'linear-gradient(135deg, #262626 0%, #171717 100%)' },
  { id: 'gradient-warm', name: 'Amber Glow', bg: 'linear-gradient(135deg, #78350f 0%, #1e1b4b 70%, #0f172a 100%)' },
];

export const HeaderBanner: React.FC<HeaderBannerProps> = ({
  profile,
  onUpdateProfile,
  todos,
  habits,
  expenses,
  milestones,
  soundEnabled,
}) => {
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(profile.bio);
  const [statusInput, setStatusInput] = useState(profile.statusText);
  const [showBannerPicker, setShowBannerPicker] = useState(false);

  useEffect(() => {
    // Pick daily quote based on day of month
    const day = new Date().getDate();
    setQuoteIndex(day % DAILY_QUOTES.length);
  }, []);

  const handleNextQuote = () => {
    Sound.click(soundEnabled);
    setQuoteIndex((prev) => (prev + 1) % DAILY_QUOTES.length);
  };

  const handleCopyQuote = () => {
    Sound.click(soundEnabled);
    const q = DAILY_QUOTES[quoteIndex];
    navigator.clipboard.writeText(`"${q.text}" — ${q.author}`);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  const handleSaveBio = () => {
    Sound.success(soundEnabled);
    onUpdateProfile({
      ...profile,
      bio: bioInput,
      statusText: statusInput,
    });
    setIsEditingBio(false);
  };

  // Quick live stats calculations
  const pendingTodos = todos.filter((t) => !t.completed).length;
  const completedTodayHabits = habits.filter((h) => h.completedDays[h.completedDays.length - 1] || h.completedDays[3]).length;
  const habitRate = habits.length > 0 ? Math.round((completedTodayHabits / habits.length) * 100) : 0;
  const monthlyBurn = expenses
    .filter((e) => e.active)
    .reduce((acc, curr) => {
      if (curr.billingCycle === 'monthly') return acc + curr.amount;
      if (curr.billingCycle === 'yearly') return acc + curr.amount / 12;
      return acc;
    }, 0);

  const currentQuote = DAILY_QUOTES[quoteIndex];

  return (
    <header className="relative w-full rounded-2xl overflow-hidden border border-[#E5E7EB] dark:border-[#1F2937] bg-white dark:bg-[#111827] shadow-xs transition-all duration-200">
      {/* Banner Canvas */}
      <div
        className="relative h-36 sm:h-44 w-full transition-all duration-300 border-b border-[#E5E7EB] dark:border-[#1F2937]"
        style={{ background: profile.bannerBg || 'linear-gradient(to right, #F9FAFB, #F3F4F6)' }}
      >
        {/* Subtle grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99,102,241,0.5) 1px, transparent 0)`,
            backgroundSize: '20px 20px',
          }}
        />

        {/* Banner Preset Selector Button */}
        <div className="absolute top-3 right-4 flex items-center gap-2">
          <button
            id="btn-banner-picker"
            onClick={() => {
              Sound.click(soundEnabled);
              setShowBannerPicker(!showBannerPicker);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/80 hover:bg-white dark:bg-[#111827]/80 dark:hover:bg-[#111827] text-[#374151] dark:text-[#E5E7EB] backdrop-blur-md border border-[#E5E7EB] dark:border-[#374151] transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#6366F1]" />
            <span>Customize Banner</span>
          </button>
        </div>

        {/* Banner Picker Dropdown */}
        {showBannerPicker && (
          <div className="absolute top-12 right-4 p-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] shadow-xl z-30 flex flex-col gap-2 min-w-[200px]">
            <span className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-widest">
              Banner Themes
            </span>
            <div className="flex flex-col gap-1.5">
              {BANNER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    Sound.click(soundEnabled);
                    onUpdateProfile({ ...profile, bannerBg: preset.bg });
                    setShowBannerPicker(false);
                  }}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs text-left hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors text-[#374151] dark:text-[#E5E7EB]"
                >
                  <span
                    className="w-4 h-4 rounded-full border border-[#E5E7EB] dark:border-[#374151] shrink-0 shadow-2xs"
                    style={{ background: preset.bg }}
                  />
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Profile & Metadata Section */}
      <div className="px-6 sm:px-8 pb-6 pt-0">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-12 sm:-mt-14 relative z-10 mb-6">
          {/* Avatar and Identity */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl border border-[#E5E7EB] dark:border-[#374151] bg-white dark:bg-[#111827] p-1 overflow-hidden shadow-sm flex items-center justify-center">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.name}
                    className="w-full h-full object-cover rounded-xl"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-2xl flex items-center justify-center">
                    {(profile.name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {/* Online Pulse Status */}
              <div
                className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111827] flex items-center justify-center shadow-2xs"
                title="Active Now"
              >
                <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="workspace-heading font-semibold tracking-tight text-[#111827] dark:text-white">
                  {profile.name}
                </h1>
                <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-[#F3F4F6] dark:bg-[#1F2937] text-[#6B7280] dark:text-[#9CA3AF] border border-[#E5E7EB] dark:border-[#374151]">
                  {profile.handle}
                </span>
                {/* Live Status Chip */}
                <div className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] border border-[#E0E7FF] dark:border-[#3730A3] font-medium">
                  <span>{profile.statusEmoji}</span>
                  <span className="truncate max-w-[220px]">{profile.statusText}</span>
                </div>
              </div>
              <p className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF]">
                {profile.title}
              </p>
              <div className="flex items-center gap-4 text-xs text-[#6B7280] dark:text-[#9CA3AF] pt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  {profile.location}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#9CA3AF]" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>

          {/* Social & Contact Bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <a
              href={`mailto:${profile.contactEmail}`}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F9FAFB] hover:bg-[#F3F4F6] dark:bg-[#1F2937] dark:hover:bg-[#374151] text-[#374151] dark:text-[#E5E7EB] transition-colors flex items-center gap-1.5 border border-[#E5E7EB] dark:border-[#374151]"
              title="Email me"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </a>
            <a
              href={profile.github}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors border border-[#E5E7EB] dark:border-[#374151]"
              title="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href={profile.linkedin}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors border border-[#E5E7EB] dark:border-[#374151]"
              title="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            <a
              href={profile.website}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#F3F4F6] dark:hover:bg-[#1F2937] transition-colors border border-[#E5E7EB] dark:border-[#374151]"
              title="Personal Website"
            >
              <Globe className="w-4 h-4" />
            </a>
            <button
              id="btn-edit-profile-bio"
              onClick={() => {
                Sound.click(soundEnabled);
                setIsEditingBio(!isEditingBio);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] hover:bg-[#E0E7FF] dark:hover:bg-[#312E81] border border-[#E0E7FF] dark:border-[#3730A3] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Status</span>
            </button>
          </div>
        </div>

        {/* Bio Edit Modal / Drawer */}
        {isEditingBio && (
          <div className="mb-6 p-4 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937] border border-[#E5E7EB] dark:border-[#374151] space-y-3">
            <h4 className="text-xs font-bold text-[#9CA3AF] uppercase tracking-widest">
              Update Bio & Focus
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                  Status Message
                </label>
                <input
                  type="text"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  placeholder="What are you currently focused on?"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] block mb-1">
                  Bio / Subtitle
                </label>
                <input
                  type="text"
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-[#111827] border border-[#E5E7EB] dark:border-[#374151] text-[#111827] dark:text-[#F3F4F6] focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
                  placeholder="A short description of your work"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setIsEditingBio(false)}
                className="px-3 py-1 text-xs text-[#6B7280] dark:text-[#9CA3AF] hover:bg-[#E5E7EB] dark:hover:bg-[#374151] rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBio}
                className="px-3.5 py-1 text-xs font-semibold bg-[#111827] dark:bg-white text-white dark:text-[#111827] rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Bio Text */}
        <p className="text-sm text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed max-w-3xl mb-6 font-normal">
          {profile.bio}
        </p>

        {/* Bottom Bar: Daily Quote Block & Live Metrics Pill Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-4 border-t border-[#E5E7EB] dark:border-[#1F2937]">
          {/* Daily Quote Block */}
          <div className="lg:col-span-7 flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/60 border border-[#E5E7EB] dark:border-[#374151]">
            <div className="flex items-start gap-3 overflow-hidden">
              <span className="text-[#6366F1] text-base shrink-0 mt-0.5">✦</span>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs italic text-[#374151] dark:text-[#E5E7EB] font-serif leading-snug truncate sm:whitespace-normal">
                  "{currentQuote.text}"
                </p>
                <div className="flex items-center gap-2 text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">
                  <span className="font-semibold">— {currentQuote.author}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] text-[10px] uppercase font-mono font-medium">
                    {currentQuote.tag}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCopyQuote}
                className="p-1.5 rounded-md hover:bg-[#E5E7EB] dark:hover:bg-[#374151] text-[#6B7280] dark:text-[#9CA3AF] transition-colors cursor-pointer"
                title="Copy quote"
              >
                {copiedQuote ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={handleNextQuote}
                className="p-1.5 rounded-md hover:bg-[#E5E7EB] dark:hover:bg-[#374151] text-[#6B7280] dark:text-[#9CA3AF] transition-colors cursor-pointer"
                title="New quote"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics Ticker */}
          <div className="lg:col-span-5 grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/60 border border-[#E5E7EB] dark:border-[#374151] flex flex-col justify-center">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
                <CheckCircle2 className="w-3 h-3 text-[#6366F1]" />
                <span>Action Items</span>
              </div>
              <span className="text-lg font-bold text-[#111827] dark:text-white font-mono mt-0.5">
                {pendingTodos}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/60 border border-[#E5E7EB] dark:border-[#374151] flex flex-col justify-center">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
                <Zap className="w-3 h-3 text-amber-500" />
                <span>Habit Streak</span>
              </div>
              <span className="text-lg font-bold text-[#111827] dark:text-white font-mono mt-0.5">
                {habitRate}%
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-[#1F2937]/60 border border-[#E5E7EB] dark:border-[#374151] flex flex-col justify-center">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold">
                <TrendingUp className="w-3 h-3 text-emerald-500" />
                <span>Monthly Burn</span>
              </div>
              <span className="text-lg font-bold text-[#111827] dark:text-white font-mono mt-0.5">
                ${Math.round(monthlyBurn)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
