import React, { useState, useEffect, useRef } from 'react';
import { Storage } from './utils/storage';
import { Sound } from './utils/audio';
import { triggerConfetti } from './utils/confetti';
import {
  UserProfile,
  TodoItem,
  HabitItem,
  GoalItem,
  VaultCredential,
  ExpenseItem,
  JournalEntry,
  MediaItem,
  LifeMilestone,
  PortfolioProject,
  SkillCategory,
  AchievementItem,
  DoodleItem,
  AppSettings,
  DashboardSection,
  ResumeDocument,
  Priority,
  TaskStatus,
  QuoteItem,
  MainNavView,
  ExamItem,
} from './types';

// Component Imports
import { DashboardHomeView } from './components/DashboardHomeView';
import { WorkfolioView } from './components/WorkfolioView';
import { TasksKanbanView } from './components/TasksKanbanView';
import { DearDiaryView } from './components/DearDiaryView';
import { HabitTracker } from './components/HabitTracker';
import { PasswordVault } from './components/PasswordVault';
import { ExpenseTracker } from './components/ExpenseTracker';
import { MediaGallery } from './components/MediaGallery';
import { AchievementsWall } from './components/AchievementsWall';
import { LifeTimeline } from './components/LifeTimeline';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal } from './components/SettingsModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { QuickCaptureBar } from './components/QuickCaptureBar';
import { BackupRestoreView } from './components/BackupRestoreView';
import { GoalsView } from './components/GoalsView';
import { QuotesManagerView } from './components/QuotesManagerView';
import { ExamsSection } from './components/ExamsSection';
import { AuthModal } from './components/AuthModal';
import LandingPage from './components/LandingPage';
import { Auth, getUserWorkspaceKey } from './utils/auth';
import { registerCurrentDevice } from './utils/devices';
import { AuthUser } from './types';
import {
  isSupabaseConfigured,
  syncWorkspaceToSupabase,
  fetchWorkspaceFromSupabase,
  scheduleAutoSyncToSupabase,
  flushAutoSyncImmediately,
  subscribeToRealtimeWorkspace,
  subscribeToSyncStatus,
  getAutoSyncStatus,
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
} from './utils/supabase';

import {
  Moon,
  Sun,
  Volume2,
  VolumeX,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Home,
  FileText,
  CheckSquare,
  Shield,
  CreditCard,
  Film,
  Award,
  Calendar,
  Menu,
  X,
  Flame,
  Briefcase,
  Sparkles,
  ArrowLeft,
  Pin,
  PinOff,
  Database,
  Star,
  Quote,
  Book,
  GraduationCap,
  BookOpen,
  Target,
  Compass,
  FolderGit2,
  Layers,
  Repeat,
  ChevronDown,
  Cloud,
  RefreshCw,
  LogIn,
  LogOut,
  UserCheck,
  KeyRound,
} from 'lucide-react';

export default function App() {
  // 1. Core State loaded from localStorage
  const [profile, setProfile] = useState<UserProfile>(Storage.getProfile);
  const [todos, setTodos] = useState<TodoItem[]>(Storage.getTodos);
  const [habits, setHabits] = useState<HabitItem[]>(Storage.getHabits);
  const [goals, setGoals] = useState<GoalItem[]>(Storage.getGoals);
  const [vault, setVault] = useState<VaultCredential[]>(Storage.getVault);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(Storage.getExpenses);
  const [journal, setJournal] = useState<JournalEntry[]>(Storage.getJournal);
  const [media, setMedia] = useState<MediaItem[]>(Storage.getMedia);
  const [milestones, setMilestones] = useState<LifeMilestone[]>(Storage.getTimeline);
  const [projects, setProjects] = useState<PortfolioProject[]>(Storage.getProjects);
  const [skills] = useState<SkillCategory[]>(Storage.getSkills);
  const [achievements, setAchievements] = useState<AchievementItem[]>(Storage.getAchievements);
  const [doodles, setDoodles] = useState<DoodleItem[]>(Storage.getDoodles);
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings);
  const [sections, setSections] = useState<DashboardSection[]>(Storage.getSections);
  const [photos, setPhotos] = useState(Storage.getPhotos);
  const [resume, setResume] = useState<ResumeDocument>(Storage.getResume);
  const [quotes, setQuotes] = useState<QuoteItem[]>(Storage.getQuotes);
  const [exams, setExams] = useState<ExamItem[]>(Storage.getExams);

  // 2. Navigation & Sidebar State
  const [activeView, setActiveView] = useState<MainNavView>('home');
  const [mediaInitialTab, setMediaInitialTab] = useState<string>('all');

  // Sidebar behavior: Manual Collapse/Expand with bottom toggle button (no auto-collapse)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('lifeos_sidebar_collapsed');
    return saved === 'true';
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    Sound.click(settings.soundEnabled);
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('lifeos_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Modals & Floating Bars
  const authRequest = new URLSearchParams(window.location.search).get('auth');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => authRequest === 'signup' || authRequest === 'signin');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>(() => authRequest === 'signup' ? 'signup' : 'signin');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => Auth.getCurrentUser());

  // High-Speed Realtime Cloud Sync State & Flags
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>(getAutoSyncStatus);
  const isInitialMount = useRef(true);
  const isRemoteUpdating = useRef(false);

  // Handle successful login or account switch
  const handleAuthenticated = (user: AuthUser) => {
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    setCustomWorkspaceIdentifier(getUserWorkspaceKey(user));
    setCustomWorkspaceEmail(user.email);
    
    // Register active device session in cloud & storage
    registerCurrentDevice(user.email);

    // Immediately hydrate state from the user-scoped Storage
    handleHydrateAllFromStorage(false);

    // If user's name is customized, update profile state
    if (user.name) {
      const current = Storage.getProfile();
      const updatedProfile = { ...current, name: user.name, contactEmail: user.email };
      setProfile(updatedProfile);
      Storage.setProfile(updatedProfile);
    }
    
    // Re-fetch user workspace data from Supabase if configured
    fetchWorkspaceFromSupabase().then((res) => {
      if (res.success && res.data) {
        Storage.importAllDataPayload(res.data);
        handleHydrateAllFromStorage(false);
      }
    });
  };

  const handleSignOut = async () => {
    Sound.click(settings.soundEnabled);
    await Auth.signOut();
    setCurrentUser(null);
    setCustomWorkspaceIdentifier('user_guest');
    setCustomWorkspaceEmail('guest@workspace.local');
    handleHydrateAllFromStorage(false);
    setIsAuthModalOpen(false);
  };

  // Subscribe to live sync status changes for the UI
  useEffect(() => {
    const unsub = subscribeToSyncStatus((status) => {
      setSyncStatus(status);
    });
    return unsub;
  }, []);

  // Vault hydration is asynchronous because secrets are decrypted with Web Crypto only after the PIN is available.
  useEffect(() => {
    let mounted = true;
    void Storage.hydrateVault(settings.masterPin).then((items) => {
      if (mounted) setVault(items);
    });
    return () => {
      mounted = false;
    };
  }, [settings.masterPin]);

  // Hydrate all React state cleanly from Storage
  const handleHydrateAllFromStorage = (playEffects = false) => {
    setProfile(Storage.getProfile());
    setTodos(Storage.getTodos());
    setHabits(Storage.getHabits());
    setGoals(Storage.getGoals());
    void Storage.hydrateVault(Storage.getSettings().masterPin).then(setVault);
    setExpenses(Storage.getExpenses());
    setJournal(Storage.getJournal());
    setMedia(Storage.getMedia());
    setMilestones(Storage.getTimeline());
    setProjects(Storage.getProjects());
    setAchievements(Storage.getAchievements());
    setDoodles(Storage.getDoodles());
    setSettings(Storage.getSettings());
    setSections(Storage.getSections());
    setPhotos(Storage.getPhotos());
    setResume(Storage.getResume());
    setQuotes(Storage.getQuotes());
    setExams(Storage.getExams());
    if (playEffects) {
      Sound.success(settings.soundEnabled);
      triggerConfetti();
    }
  };

  // 1. Initial Cloud Hydration & Supabase Realtime WebSocket Listener (Instant Multi-Device Sync)
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let isMounted = true;

    // Fetch initial snapshot from cloud for current user session
    const autoSyncFromCloud = async () => {
      try {
        const result = await fetchWorkspaceFromSupabase();
        if (result.success && result.data && isMounted) {
          isRemoteUpdating.current = true;
          Storage.importAllDataPayload(result.data);
          handleHydrateAllFromStorage(false);
          setTimeout(() => {
            isRemoteUpdating.current = false;
          }, 300);
        }
      } catch (err) {
        console.warn('Initial cloud sync check:', err);
      }
    };

    autoSyncFromCloud();

    // Register active device session for this account
    if (currentUser?.email) {
      registerCurrentDevice(currentUser.email);
    }

    // 2. Realtime WebSocket channel for instant cross-device updates (<30ms delivery, no lag, no refresh)
    const unsubRealtime = subscribeToRealtimeWorkspace(
      (remoteData) => {
        if (remoteData && isMounted) {
          isRemoteUpdating.current = true;
          Storage.importAllDataPayload(remoteData);
          handleHydrateAllFromStorage(false);
          setTimeout(() => {
            isRemoteUpdating.current = false;
          }, 300);
        }
      },
      // Callback triggered when this device session is revoked from another device
      () => {
        if (isMounted) {
          Sound.error(settings.soundEnabled);
          alert('This device session was logged out from your account settings.');
          handleSignOut();
        }
      }
    );

    // Re-verify on window focus for background wakeups
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        autoSyncFromCloud();
      }
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      unsubRealtime();
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser?.id, currentUser?.email]);

  // 3. High-Speed Debounced Auto-Sync to Supabase whenever local data changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    // If state change came from incoming Realtime websocket update, don't echo back
    if (isRemoteUpdating.current) {
      return;
    }

    scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 600);
  }, [
    profile,
    todos,
    habits,
    goals,
    vault,
    expenses,
    journal,
    media,
    milestones,
    projects,
    achievements,
    doodles,
    settings,
    sections,
    photos,
    resume,
    quotes,
    exams,
  ]);

  // 4. Instant flush on tab switch or page close
  useEffect(() => {
    const handleFlush = () => {
      if (!isRemoteUpdating.current) {
        flushAutoSyncImmediately(Storage.getAllDataPayload());
      }
    };

    window.addEventListener('beforeunload', handleFlush);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleFlush();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleFlush);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 3. Sync Dark Mode class on document root cleanly
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    Storage.setSettings(settings);
  }, [settings]);

  // 4. Global Keyboard Shortcuts (Cmd+K / Ctrl+K and Cmd+\ / Ctrl+\)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        Sound.click(settings.soundEnabled);
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        Sound.click(settings.soundEnabled);
        setIsSidebarCollapsed((prev) => {
          const next = !prev;
          localStorage.setItem('lifeos_sidebar_collapsed', String(next));
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [settings.soundEnabled]);

  // Settings update handler
  const handleUpdateSettings = (newSettings: AppSettings) => {
    // If master PIN changed, re-encrypt in-memory vault records with the new PIN
    if (newSettings.masterPin !== settings.masterPin && vault.length > 0) {
      void Storage.setVault(vault, newSettings.masterPin);
    }
    setSettings(newSettings);
    Storage.setSettings(newSettings);
  };

  const handleToggleDarkMode = () => {
    Sound.toggle(settings.soundEnabled);
    const newDarkMode = !settings.darkMode;
    const updated = { ...settings, darkMode: newDarkMode };
    setSettings(updated);
    Storage.setSettings(updated);
    if (newDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleToggleSound = () => {
    Sound.click(!settings.soundEnabled);
    const updated = { ...settings, soundEnabled: !settings.soundEnabled };
    setSettings(updated);
    Storage.setSettings(updated);
  };

  // Profile Handlers
  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    Storage.setProfile(updated);
  };

  const handleUpdateUserName = async (newName: string) => {
    const clean = newName.trim();
    if (!clean) return;
    const updatedProfile = { ...profile, name: clean };
    setProfile(updatedProfile);
    Storage.setProfile(updatedProfile);

    const updatedUser = await Auth.updateCurrentUserName(clean);
    if (updatedUser) {
      setCurrentUser(updatedUser);
    }
  };

  // Sections Handlers
  const handleUpdateSections = (newSections: DashboardSection[]) => {
    setSections(newSections);
    Storage.setSections(newSections);
  };

  // Photos Handlers
  const handleUpdatePhotos = (newPhotos: any[]) => {
    setPhotos(newPhotos);
    Storage.setPhotos(newPhotos);
  };

  // Resume Handler
  const handleUpdateResume = (newResume: ResumeDocument) => {
    setResume(newResume);
    Storage.setResume(newResume);
  };

  // Quotes Handlers
  const handleAddQuote = (quote: Omit<QuoteItem, 'id' | 'createdAt'>) => {
    const newQuote: QuoteItem = {
      id: `q-${Date.now()}`,
      ...quote,
      createdAt: Date.now(),
    };
    const updated = [newQuote, ...quotes];
    setQuotes(updated);
    Storage.setQuotes(updated);
  };

  const handleUpdateQuote = (id: string, updatedFields: Partial<QuoteItem>) => {
    const updated = quotes.map((q) => (q.id === id ? { ...q, ...updatedFields } : q));
    setQuotes(updated);
    Storage.setQuotes(updated);
  };

  const handleDeleteQuote = (id: string) => {
    const updated = quotes.filter((q) => q.id !== id);
    setQuotes(updated);
    Storage.setQuotes(updated);
  };

  // Exams Handlers
  const handleUpdateExams = (updatedExams: ExamItem[]) => {
    setExams(updatedExams);
    Storage.setExams(updatedExams);
  };

  // Task / Todo Handlers
  const handleAddTodo = (
    title: string,
    priority: Priority,
    category: string,
    dueDate?: string,
    status?: TaskStatus
  ) => {
    const newTodo: TodoItem = {
      id: `todo-${Date.now()}`,
      title,
      completed: status === 'complete',
      status: status || 'todo',
      priority,
      category,
      dueDate,
      createdAt: Date.now(),
    };
    const updated = [newTodo, ...todos];
    setTodos(updated);
    Storage.setTodos(updated);
  };

  const handleToggleTodo = (id: string) => {
    const todoToToggle = todos.find((t) => t.id === id);
    const isBecomingDone = todoToToggle && !todoToToggle.completed;

    if (isBecomingDone) {
      Sound.success(settings.soundEnabled);
      triggerConfetti();
    } else {
      Sound.click(settings.soundEnabled);
    }

    const updated = todos.map((t) => {
      if (t.id === id) {
        const nextCompleted = !t.completed;
        return {
          ...t,
          completed: nextCompleted,
          status: (nextCompleted ? 'complete' : 'todo') as TaskStatus,
        };
      }
      return t;
    });
    setTodos(updated);
    Storage.setTodos(updated);
  };

  const handleUpdateTodo = (id: string, updatedFields: Partial<TodoItem>) => {
    Sound.click(settings.soundEnabled);
    const updated = todos.map((t) => {
      if (t.id === id) {
        const next = { ...t, ...updatedFields };
        if (updatedFields.status !== undefined) {
          next.completed = updatedFields.status === 'complete';
        } else if (updatedFields.completed !== undefined) {
          next.status = updatedFields.completed ? 'complete' : 'todo';
        }
        return next;
      }
      return t;
    });
    setTodos(updated);
    Storage.setTodos(updated);
  };

  const handleUpdateTaskStatus = (id: string, status: TaskStatus) => {
    if (status === 'complete') {
      Sound.success(settings.soundEnabled);
      triggerConfetti();
    } else {
      Sound.click(settings.soundEnabled);
    }

    const updated = todos.map((t) =>
      t.id === id ? { ...t, status, completed: status === 'complete' } : t
    );
    setTodos(updated);
    Storage.setTodos(updated);
  };

  const handleDeleteTodo = (id: string) => {
    const updated = todos.filter((t) => t.id !== id);
    setTodos(updated);
    Storage.setTodos(updated);
  };

  const handleClearCompletedTodos = () => {
    const updated = todos.filter((t) => !t.completed);
    setTodos(updated);
    Storage.setTodos(updated);
  };

  // Habit Handlers
  const handleToggleHabitDay = (habitId: string, dayIndex: number) => {
    Sound.click(settings.soundEnabled);
    const updated = habits.map((h) => {
      if (h.id === habitId) {
        const newDays = [...h.completedDays];
        newDays[dayIndex] = !newDays[dayIndex];
        const completedCount = newDays.filter(Boolean).length;
        return {
          ...h,
          completedDays: newDays,
          streak: completedCount > 0 ? h.streak + (newDays[dayIndex] ? 1 : -1) : 0,
        };
      }
      return h;
    });
    setHabits(updated);
    Storage.setHabits(updated);
  };

  const handleAddHabit = (title: string, category: string, icon: string, color: string) => {
    const newHabit: HabitItem = {
      id: `hb-${Date.now()}`,
      title,
      category,
      icon,
      completedDays: [false, false, false, false, false, false, false],
      streak: 0,
      color,
    };
    const updated = [...habits, newHabit];
    setHabits(updated);
    Storage.setHabits(updated);
  };

  const handleDeleteHabit = (id: string) => {
    const updated = habits.filter((h) => h.id !== id);
    setHabits(updated);
    Storage.setHabits(updated);
  };

  const handleResetHabitWeek = () => {
    const updated = habits.map((h) => ({
      ...h,
      completedDays: [false, false, false, false, false, false, false],
    }));
    setHabits(updated);
    Storage.setHabits(updated);
  };

  // Goal Handlers
  const handleAddGoal = (goal: Omit<GoalItem, 'id' | 'createdAt'>) => {
    Sound.success(settings.soundEnabled);
    triggerConfetti();
    const newGoal: GoalItem = {
      id: `goal-${Date.now()}`,
      createdAt: Date.now(),
      ...goal,
    };
    const updated = [newGoal, ...goals];
    setGoals(updated);
    Storage.setGoals(updated);
  };

  const handleUpdateGoal = (id: string, updated: Partial<GoalItem>) => {
    Sound.click(settings.soundEnabled);
    const next = goals.map((g) => (g.id === id ? { ...g, ...updated } : g));
    setGoals(next);
    Storage.setGoals(next);
  };

  const handleDeleteGoal = (id: string) => {
    Sound.click(settings.soundEnabled);
    const next = goals.filter((g) => g.id !== id);
    setGoals(next);
    Storage.setGoals(next);
  };

  // Expense Handlers
  const handleAddExpense = (item: Omit<ExpenseItem, 'id'>) => {
    const newExpense: ExpenseItem = {
      id: `exp-${Date.now()}`,
      ...item,
    };
    const updated = [newExpense, ...expenses];
    setExpenses(updated);
    Storage.setExpenses(updated);
  };

  const handleBatchAddExpenses = (newItems: Array<Omit<ExpenseItem, 'id'>>) => {
    const created: ExpenseItem[] = newItems.map((item, idx) => ({
      id: `exp-${Date.now()}-${idx}`,
      ...item,
    }));
    const updated = [...created, ...expenses];
    setExpenses(updated);
    Storage.setExpenses(updated);
  };

  const handleUpdateExpense = (id: string, updated: Partial<ExpenseItem>) => {
    Sound.click(settings.soundEnabled);
    const next = expenses.map((e) => (e.id === id ? { ...e, ...updated } : e));
    setExpenses(next);
    Storage.setExpenses(next);
  };

  const handleToggleExpense = (id: string) => {
    const updated = expenses.map((e) => (e.id === id ? { ...e, active: !e.active } : e));
    setExpenses(updated);
    Storage.setExpenses(updated);
  };

  const handleDeleteExpense = (id: string) => {
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    Storage.setExpenses(updated);
  };

  // Vault Handlers
  const handleAddVaultSecret = (item: Omit<VaultCredential, 'id'>) => {
    const newCred: VaultCredential = {
      id: `vc-${Date.now()}`,
      ...item,
      updatedAt: new Date().toISOString().split('T')[0],
    };
    const updated = [newCred, ...vault];
    setVault(updated);
    void Storage.setVault(updated, settings.masterPin);
  };

  const handleDeleteVaultSecret = (id: string) => {
    const updated = vault.filter((v) => v.id !== id);
    setVault(updated);
    void Storage.setVault(updated, settings.masterPin);
  };

  // Media Handlers
  const handleAddMedia = (item: Omit<MediaItem, 'id'>) => {
    const newItem: MediaItem = {
      id: `med-${Date.now()}`,
      ...item,
    };
    const updated = [newItem, ...media];
    setMedia(updated);
    Storage.setMedia(updated);
  };

  const handleUpdateMediaRating = (id: string, rating: number) => {
    const updated = media.map((m) => (m.id === id ? { ...m, rating } : m));
    setMedia(updated);
    Storage.setMedia(updated);
  };

  const handleDeleteMedia = (id: string) => {
    const updated = media.filter((m) => m.id !== id);
    setMedia(updated);
    Storage.setMedia(updated);
  };

  // Journal Handlers
  const handleAddJournalEntry = (
    title: string,
    content: string,
    mood: string,
    tags: string[]
  ) => {
    const newEntry: JournalEntry = {
      id: `jn-${Date.now()}`,
      title,
      content,
      mood,
      moodLabel: 'Focus',
      tags,
      date: new Date().toISOString().split('T')[0],
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...journal];
    setJournal(updated);
    Storage.setJournal(updated);
  };

  const handleAddDiaryEntry = (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => {
    const newEntry: JournalEntry = {
      id: `jn-${Date.now()}`,
      ...entry,
      timestamp: Date.now(),
    };
    const updated = [newEntry, ...journal];
    setJournal(updated);
    Storage.setJournal(updated);
  };

  const handleDeleteJournalEntry = (id: string) => {
    const updated = journal.filter((j) => j.id !== id);
    setJournal(updated);
    Storage.setJournal(updated);
  };

  // Project Handlers
  const handleAddProject = (project: Omit<PortfolioProject, 'id'>) => {
    const newProject: PortfolioProject = {
      id: `proj-${Date.now()}`,
      ...project,
    };
    const updated = [newProject, ...projects];
    setProjects(updated);
    Storage.setProjects(updated);
  };

  const handleDeleteProject = (id: string) => {
    const updated = projects.filter((p) => p.id !== id);
    setProjects(updated);
    Storage.setProjects(updated);
  };

  // Milestone Handlers
  const handleAddMilestone = (milestone: Omit<LifeMilestone, 'id'>) => {
    const newMilestone: LifeMilestone = {
      id: `ms-${Date.now()}`,
      ...milestone,
    };
    const updated = [newMilestone, ...milestones].sort((a, b) => b.year - a.year);
    setMilestones(updated);
    Storage.setTimeline(updated);
  };

  const handleUpdateMilestone = (id: string, updated: Partial<LifeMilestone>) => {
    Sound.click(settings.soundEnabled);
    const next = milestones.map((m) => (m.id === id ? { ...m, ...updated } : m));
    setMilestones(next);
    Storage.setTimeline(next);
  };

  const handleDeleteMilestone = (id: string) => {
    const updated = milestones.filter((m) => m.id !== id);
    setMilestones(updated);
    Storage.setTimeline(updated);
  };

  // Achievements Handlers
  const handleAddAchievement = (ach: Omit<AchievementItem, 'id'>) => {
    const newAch: AchievementItem = {
      id: `ach-${Date.now()}`,
      ...ach,
    };
    const updated = [newAch, ...achievements];
    setAchievements(updated);
    Storage.setAchievements(updated);
  };

  const handleDeleteAchievement = (id: string) => {
    const updated = achievements.filter((a) => a.id !== id);
    setAchievements(updated);
    Storage.setAchievements(updated);
  };

  // Doodle Handlers
  const handleSaveDoodle = (title: string, dataUrl: string) => {
    const newDoodle: DoodleItem = {
      id: `doodle-${Date.now()}`,
      title,
      dataUrl,
      createdAt: new Date().toISOString(),
    };
    const updated = [newDoodle, ...doodles];
    setDoodles(updated);
    Storage.setDoodles(updated);
  };

  const handleDeleteDoodle = (id: string) => {
    const updated = doodles.filter((d) => d.id !== id);
    setDoodles(updated);
    Storage.setDoodles(updated);
  };

  // Global Export / Import / Reset
  const handleExportData = () => {
    Sound.click(settings.soundEnabled);
    const jsonStr = Storage.exportAllDataJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Notion_LifeOS_Backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (jsonStr: string) => {
    const success = Storage.importAllDataJSON(jsonStr);
    if (success) {
      setProfile(Storage.getProfile());
      setTodos(Storage.getTodos());
      setHabits(Storage.getHabits());
      setGoals(Storage.getGoals());
      void Storage.hydrateVault(Storage.getSettings().masterPin).then(setVault);
      setExpenses(Storage.getExpenses());
      setJournal(Storage.getJournal());
      setMedia(Storage.getMedia());
      setMilestones(Storage.getTimeline());
      setProjects(Storage.getProjects());
      setAchievements(Storage.getAchievements());
      setDoodles(Storage.getDoodles());
      setSettings(Storage.getSettings());
      setSections(Storage.getSections());
      setPhotos(Storage.getPhotos());
      setResume(Storage.getResume());
      setQuotes(Storage.getQuotes());
      Sound.success(settings.soundEnabled);
      triggerConfetti();
    }
    return success;
  };

  const handleResetData = () => {
    Storage.resetToDefault();
    setProfile(Storage.getProfile());
    setTodos(Storage.getTodos());
    setHabits(Storage.getHabits());
    setGoals(Storage.getGoals());
    void Storage.hydrateVault(Storage.getSettings().masterPin).then(setVault);
    setExpenses(Storage.getExpenses());
    setJournal(Storage.getJournal());
    setMedia(Storage.getMedia());
    setMilestones(Storage.getTimeline());
    setProjects(Storage.getProjects());
    setAchievements(Storage.getAchievements());
    setDoodles(Storage.getDoodles());
    setSettings(Storage.getSettings());
    setSections(Storage.getSections());
    setPhotos(Storage.getPhotos());
    setResume(Storage.getResume());
    setQuotes(Storage.getQuotes());
  };

  // Direct Unified Navigation Router
  const handleNavigate = (view: MainNavView | string, tabOrFilter?: string) => {
    Sound.click(settings.soundEnabled);
    if (view === 'projects' || view === 'portfolio' || view === 'resume') {
      setActiveView('workfolio');
    } else if (view === 'subscriptions') {
      setActiveView('expenses');
    } else if (view === 'docs') {
      setActiveView('journal');
    } else {
      setActiveView(view as MainNavView);
    }
    if (view === 'media' && tabOrFilter) {
      setMediaInitialTab(tabOrFilter);
    }
  };

  interface NavItem {
    id: MainNavView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    emoji: string;
    group: 'top' | 'plan' | 'work' | 'life' | 'money' | 'private' | 'system';
    badge?: string;
  }

  const navItems: NavItem[] = [
    // Top Level
    { id: 'home', label: 'Home / Today', icon: Home, count: undefined, emoji: '🏠', group: 'top' },

    // PLAN
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: todos.filter((t) => !t.completed).length, emoji: '☑️', group: 'plan' },
    { id: 'habits', label: 'Habits', icon: Flame, count: habits.length, emoji: '🔥', group: 'plan' },
    { id: 'goals', label: 'Goals', icon: Target, count: goals.filter((g) => g.status === 'active').length || undefined, emoji: '🎯', group: 'plan' },
    { id: 'exams', label: 'Exams', icon: GraduationCap, count: exams.length, emoji: '🎓', group: 'plan' },
    { id: 'timeline', label: 'Life Map', icon: Compass, count: milestones.length, emoji: '🗺️', group: 'plan' },

    // WORK
    { id: 'workfolio', label: 'Portfolio', icon: Briefcase, count: projects.length, emoji: '💼', group: 'work' },

    // LIFE
    { id: 'journal', label: 'Journal', icon: BookOpen, count: journal.length, emoji: '📖', group: 'life' },
    { id: 'quotes', label: 'Quotes', icon: Quote, count: quotes.length, emoji: '💬', group: 'life' },
    { id: 'media', label: 'Library', icon: Film, count: media.length, emoji: '🎬', group: 'life' },

    // MONEY
    { id: 'expenses', label: 'Spending', icon: CreditCard, count: expenses.length, emoji: '💳', group: 'money' },

    // PRIVATE
    { id: 'vault', label: 'Vault', icon: Shield, count: vault.length, emoji: '🔐', group: 'private' },
    { id: 'backup', label: 'Backup & Restore', icon: Database, count: undefined, emoji: '💾', group: 'private' },
  ];

  const currentNav = navItems.find((n) => n.id === activeView) || navItems[0];
  const isSidebarExpanded = !isSidebarCollapsed;

  if (!currentUser) {
    return (
      <>
        <LandingPage
          onGetStarted={() => {
            setAuthInitialMode('signin');
            setIsAuthModalOpen(true);
          }}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthenticated={handleAuthenticated}
          currentUser={currentUser}
          initialMode={authInitialMode}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFA] dark:bg-[#111827] text-[#37352F] dark:text-[#F3F4F6] selection:bg-[#EEF2FF] selection:text-[#6366F1] dark:selection:bg-[#1E1B4B] dark:selection:text-[#818CF8] transition-colors duration-200 font-sans flex flex-col items-center">
      <div className="w-full min-h-screen bg-white dark:bg-[#111827] flex flex-col">
        {/* ===================================================================== */}
        {/* 1. TOP GLOBAL NAVIGATION HEADER */}
        {/* ===================================================================== */}
        <header className="px-3 sm:px-4 py-2 border-b border-[#EDECE9] dark:border-[#1F2937] bg-white/95 dark:bg-[#111827]/95 backdrop-blur-md flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 z-30 sticky top-0">
          {/* Left: Sidebar Toggle, Mobile Menu & Notion Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {/* Desktop Sidebar Toggle Button */}
            <button
              type="button"
              onClick={handleToggleSidebar}
              className="hidden md:flex p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937] hover:text-[#37352F] dark:hover:text-white cursor-pointer transition-colors shrink-0"
              title={!isSidebarCollapsed ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
            >
              {!isSidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            {/* Mobile Sidebar Toggle Button */}
            <button
              type="button"
              onClick={() => {
                Sound.click(settings.soundEnabled);
                setIsMobileSidebarOpen(true);
              }}
              className="md:hidden p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937] hover:text-[#37352F] dark:hover:text-white cursor-pointer transition-colors shrink-0"
              title="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Breadcrumbs: Compact on mobile (<640px), expanded on desktop */}
            <div className="flex items-center gap-1 text-xs text-[#787774] dark:text-[#9CA3AF] min-w-0">
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="hidden sm:inline font-medium hover:text-[#6366F1] dark:hover:text-white cursor-pointer truncate max-w-[140px]"
              >
                {profile.name}&apos;s Personal Dashboard
              </button>
              <span className="hidden sm:inline text-[#D1D5DB] dark:text-[#4B5563]">/</span>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] text-[#37352F] dark:text-white font-semibold text-xs min-w-0 max-w-[110px] sm:max-w-none">
                <span className="shrink-0">{currentNav.emoji}</span>
                <span className="truncate">{currentNav.label}</span>
              </div>
            </div>
          </div>

          {/* Right: Quick Add (+), Search, Theme, Settings, Auth & Profile */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {/* Top Quick Add Dropdown Menu (+) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  Sound.click(settings.soundEnabled);
                  setIsAddMenuOpen(!isAddMenuOpen);
                }}
                className="flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl bg-[#6366F1] hover:bg-[#4F46E5] text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Quick Add Task, Note, Expense, or Journal Entry"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Add</span>
                <ChevronDown className="w-3 h-3 opacity-80 hidden sm:inline" />
              </button>

              {isAddMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/20 backdrop-blur-2xs"
                    onClick={() => setIsAddMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1E293B] border border-[#EDECE9] dark:border-[#334155] rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        handleNavigate('tasks');
                        setShowQuickCapture(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#37352F] dark:text-white hover:bg-[#EEF2FF] dark:hover:bg-[#312E81] text-left cursor-pointer transition-colors"
                    >
                      <CheckSquare className="w-4 h-4 text-[#6366F1]" />
                      <span>+ Task</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        handleNavigate('goals');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#37352F] dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-left cursor-pointer transition-colors"
                    >
                      <Target className="w-4 h-4 text-emerald-600" />
                      <span>+ Goal</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        handleNavigate('exams');
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#37352F] dark:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-left cursor-pointer transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>+ Exam Prep</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        handleNavigate('expenses');
                        setShowQuickCapture(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#37352F] dark:text-white hover:bg-amber-50 dark:hover:bg-amber-950/60 text-left cursor-pointer transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-amber-600" />
                      <span>+ Expense</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddMenuOpen(false);
                        handleNavigate('journal');
                        setShowQuickCapture(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-[#37352F] dark:text-white hover:bg-purple-50 dark:hover:bg-purple-950/60 text-left cursor-pointer transition-colors"
                    >
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      <span>+ Journal Entry</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Notion Search Bar: Compact icon on mobile, bar on sm+ */}
            <button
              type="button"
              onClick={() => {
                Sound.click(settings.soundEnabled);
                setIsCommandPaletteOpen(true);
              }}
              className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] hover:border-[#D1D5DB] dark:hover:border-[#4B5563] text-xs text-[#787774] dark:text-[#9CA3AF] shadow-2xs cursor-pointer transition-all sm:w-36 md:w-44 justify-between"
              title="Search (⌘K)"
            >
              <div className="flex items-center gap-1.5 truncate">
                <Search className="w-3.5 h-3.5 text-[#9CA3AF]" />
                <span className="hidden sm:inline truncate">Search...</span>
              </div>
              <kbd className="hidden sm:inline px-1.5 py-0.2 rounded bg-white dark:bg-[#111827] border border-[#EDECE9] dark:border-[#374151] text-[9px] font-mono">
                ⌘K
              </kbd>
            </button>

            {/* Theme Toggle (Light / Dark Mode) */}
            <button
              type="button"
              onClick={handleToggleDarkMode}
              className="p-1.5 text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F7F7F5] dark:hover:bg-[#1F2937] rounded-xl border border-[#EDECE9] dark:border-[#374151] transition-colors cursor-pointer"
              title={`Switch to ${settings.darkMode ? 'Light' : 'Dark'} Mode`}
            >
              {settings.darkMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-700" />
              )}
            </button>

            {/* Sound Toggle (Shown on sm+ to keep mobile bar clean) */}
            <button
              type="button"
              onClick={handleToggleSound}
              className="hidden sm:flex p-1.5 text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F7F7F5] dark:hover:bg-[#1F2937] rounded-xl border border-[#EDECE9] dark:border-[#374151] transition-colors cursor-pointer"
              title={`Audio: ${settings.soundEnabled ? 'Enabled' : 'Muted'}`}
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-[#6366F1]" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-[#9CA3AF]" />
              )}
            </button>

            {/* Change Password Icon Button (Top right corner icon button) */}
            <button
              type="button"
              onClick={() => {
                Sound.click(settings.soundEnabled);
                setIsChangePasswordOpen(true);
              }}
              className="p-1.5 text-[#787774] dark:text-[#9CA3AF] hover:text-[#6366F1] dark:hover:text-[#818CF8] hover:bg-[#F7F7F5] dark:hover:bg-[#1F2937] rounded-xl border border-[#EDECE9] dark:border-[#374151] transition-colors cursor-pointer"
              title="Change Password"
              aria-label="Change Password"
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>

            {/* Profile Menu: Account settings, Change Password & Sign out */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((open) => !open)}
                className="w-7 h-7 rounded-lg overflow-hidden border border-[#EDECE9] dark:border-[#374151] cursor-pointer hover:ring-2 hover:ring-[#6366F1] transition-all shrink-0"
                title="Account menu"
                aria-label="Account menu"
              >
                <img src={profile.avatarUrl} alt="Account" className="w-full h-full object-cover" />
              </button>
              {isAccountMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsAccountMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-9 z-50 w-56 rounded-2xl border border-[#EDECE9] dark:border-[#374151] bg-white dark:bg-[#1F2937] p-1.5 shadow-xl animate-in fade-in zoom-in-95">
                    {/* User display name & email */}
                    <div className="px-2.5 py-2 mb-1 rounded-xl bg-gray-50 dark:bg-[#111827] border border-gray-100 dark:border-gray-800">
                      <p className="text-xs font-bold text-[#111827] dark:text-white truncate">
                        {profile.name || currentUser?.name || 'Workspace User'}
                      </p>
                      <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate">
                        {currentUser?.email || profile.contactEmail || 'user@workspace.local'}
                      </p>
                    </div>

                    {/* Change Password inside the icon button menu */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsChangePasswordOpen(true);
                      }}
                      className="account-menu-item flex items-center gap-2 w-full text-left font-medium text-[#111827] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors cursor-pointer text-xs"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#6366F1] dark:text-[#818CF8]" />
                      <span>Change Password</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className="account-menu-item flex items-center gap-2 w-full text-left font-medium text-[#111827] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors cursor-pointer text-xs"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Account settings</span>
                    </button>

                    <div className="my-1 border-t border-[#F3F4F6] dark:border-[#374151]" />

                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        handleSignOut();
                      }}
                      className="account-menu-item flex items-center gap-2 w-full text-left font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg p-2 transition-colors cursor-pointer text-xs"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Quick Capture Expandable Bar */}
        {showQuickCapture && (
          <div className="p-3 bg-[#FBFBFA] dark:bg-[#111827] border-b border-[#EDECE9] dark:border-[#1F2937] animate-in slide-in-from-top-2">
            <QuickCaptureBar
              onCaptureTask={(title, priority, category) => {
                handleAddTodo(title, priority, category, new Date().toISOString().split('T')[0], 'todo');
              }}
              onCaptureJournal={(title, content) => {
                handleAddJournalEntry(title, content, '⚡', ['QuickCapture']);
              }}
              onCaptureExpense={(name, amount, category) => {
                handleAddExpense({
                  name,
                  amount,
                  date: new Date().toISOString().split('T')[0],
                  billingCycle: 'monthly',
                  category: category as any,
                  icon: '💳',
                  active: true,
                });
              }}
              onCaptureMilestone={(title, year, category) => {
                handleAddMilestone({ title, year, category: category as any, dateStr: `${year}-01-01`, description: title, icon: '🚀' });
              }}
              onCaptureHabit={(title, category) => {
                handleAddHabit(title, category, '⚡', '#6366F1');
              }}
              onCaptureQuote={(text, author, category) => {
                handleAddQuote({ text, author, category });
              }}
              onCaptureMedia={(title, creator, type) => {
                handleAddMedia({
                  title,
                  creator,
                  type,
                  rating: 5,
                  status: 'completed',
                  coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&auto=format&fit=crop&q=80',
                  genres: ['Curated'],
                });
              }}
              soundEnabled={settings.soundEnabled}
            />
          </div>
        )}

        {/* ===================================================================== */}
        {/* 2. WORKSPACE BODY: STRUCTURED HIERARCHICAL SIDEBAR + MAIN VIEW */}
        {/* ===================================================================== */}
        <div className="flex-1 flex overflow-hidden">
          {/* Desktop Left Sidebar: Pinned Home/Today at top, categorized nav, Collapse button at bottom */}
          <aside
            className={`hidden md:flex bg-[#F7F7F5] dark:bg-[#111827] border-r border-[#EDECE9] dark:border-[#1F2937] flex-col justify-between shrink-0 select-none transition-all duration-200 ease-in-out z-20 overflow-y-auto overflow-x-hidden ${
              !isSidebarCollapsed ? 'w-60 p-3.5' : 'w-16 p-2 items-center'
            }`}
          >
            <div className="space-y-4 w-full">
              {/* App Brand Header */}
              {!isSidebarCollapsed ? (
                <button type="button" onClick={() => handleNavigate('home')} className="flex items-center gap-2.5 px-2 py-1.5 text-left cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="w-7 h-7 rounded-xl bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                    ✨
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-base font-extrabold text-[#37352F] dark:text-white tracking-tight block truncate">
                      Personal Dashboard
                    </span>
                  </div>
                </button>
              ) : (
                <div
                  onClick={() => handleNavigate('home')}
                  className="w-9 h-9 rounded-xl bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center font-black text-sm shadow-xs mx-auto cursor-pointer hover:opacity-90 transition-opacity"
                  title="Personal Dashboard Home"
                >
                  ✨
                </div>
              )}

              {/* PINNED: HOME / TODAY ITEM */}
              <div className="w-full">
                {navItems
                  .filter((i) => i.group === 'top')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          !isSidebarCollapsed ? 'justify-between px-3 py-2.5' : 'justify-center p-2.5'
                        } ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-bold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: PLAN */}
              <div className="space-y-1 w-full">
                {!isSidebarCollapsed && (
                  <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block">
                    PLAN
                  </span>
                )}
                {navItems
                  .filter((i) => i.group === 'plan')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          !isSidebarCollapsed ? 'justify-between px-2.5 py-1.5' : 'justify-center p-2'
                        } ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isSidebarCollapsed && item.badge && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#EEF2FF] dark:bg-[#312E81] text-[#6366F1] dark:text-[#A5B4FC]">
                            {item.badge}
                          </span>
                        )}
                        {!isSidebarCollapsed && item.count !== undefined && !item.badge && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151]">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: LIFE */}
              <div className="space-y-1 w-full">
                {!isSidebarCollapsed && (
                  <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block">
                    LIFE
                  </span>
                )}
                {navItems
                  .filter((i) => i.group === 'life')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          !isSidebarCollapsed ? 'justify-between px-2.5 py-1.5' : 'justify-center p-2'
                        } ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isSidebarCollapsed && item.count !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151]">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: WORKFOLIO */}
              <div className="space-y-1 w-full">
                {!isSidebarCollapsed && (
                  <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block">
                    WORKFOLIO
                  </span>
                )}
                {navItems
                  .filter((i) => i.group === 'work')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          !isSidebarCollapsed ? 'justify-between px-2.5 py-1.5' : 'justify-center p-2'
                        } ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isSidebarCollapsed && item.count !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151]">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: MONEY */}
              <div className="space-y-1 w-full">
                {!isSidebarCollapsed && (
                  <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block">
                    MONEY
                  </span>
                )}
                {navItems
                  .filter((i) => i.group === 'money')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          !isSidebarCollapsed ? 'justify-between px-2.5 py-1.5' : 'justify-center p-2'
                        } ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isSidebarCollapsed && item.count !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151]">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: PRIVATE */}
              <div className="space-y-1 w-full">
                {!isSidebarCollapsed && (
                  <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block">
                    PRIVATE
                  </span>
                )}
                {navItems
                  .filter((i) => i.group === 'private')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          !isSidebarCollapsed ? 'justify-between px-2.5 py-1.5' : 'justify-center p-2'
                        } ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-base shrink-0">{item.emoji}</span>
                          {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>
                        {!isSidebarCollapsed && item.count !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151]">
                            {item.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>

{/* Sidebar Footer: Dedicated Collapse Toggle Button */}
            <div className="pt-3 border-t border-[#EDECE9] dark:border-[#1F2937] w-full">
              <button
                type="button"
                id="btn-sidebar-collapse-toggle"
                onClick={handleToggleSidebar}
                className={`w-full flex items-center rounded-xl text-xs font-medium text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50 transition-colors cursor-pointer ${
                  !isSidebarCollapsed ? 'gap-2 px-2.5 py-2' : 'justify-center p-2'
                }`}
                title={!isSidebarCollapsed ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
              >
                {!isSidebarCollapsed ? (
                  <>
                    <ChevronLeft className="w-4 h-4 stroke-[2]" />
                    <span>Collapse</span>
                  </>
                ) : (
                  <ChevronRight className="w-4 h-4 stroke-[2]" />
                )}
              </button>
            </div>
          </aside>

          {/* Mobile Navigation Drawer */}
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden flex">
              <div
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
              <div className="relative w-72 max-w-[85vw] bg-[#F7F7F5] dark:bg-[#111827] border-r border-[#EDECE9] dark:border-[#1F2937] flex flex-col justify-between p-4 z-10 animate-in slide-in-from-left overflow-y-auto shadow-2xl">
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EDECE9] dark:border-[#1F2937]">
                    <span className="text-sm font-bold text-[#37352F] dark:text-white truncate">
                      💼 {profile.name}&apos;s Personal Dashboard
                    </span>
                    <button
                      onClick={() => setIsMobileSidebarOpen(false)}
                      className="p-1 text-[#787774] hover:text-[#37352F] dark:hover:text-white cursor-pointer rounded-lg hover:bg-[#E5E7EB] dark:hover:bg-[#1F2937]"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1">
                    {navItems.map((item) => {
                      const isActive = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleNavigate(item.id);
                            setIsMobileSidebarOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium cursor-pointer ${
                            isActive
                              ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold'
                              : 'text-[#37352F] dark:text-[#D1D5DB]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span>{item.emoji}</span>
                            <span>{item.label}</span>
                          </div>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-[#EEF2FF] dark:bg-[#312E81] text-[#6366F1]">
                              {item.badge}
                            </span>
                          )}
                          {item.count !== undefined && !item.badge && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF]">
                              {item.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#EDECE9] dark:border-[#1F2937] flex items-center justify-between text-xs text-[#787774]">
                  <span>Command Center</span>
                  <button
                    onClick={() => {
                      handleNavigate('backup');
                      setIsMobileSidebarOpen(false);
                    }}
                    className="text-[#6366F1] dark:text-[#818CF8] font-semibold hover:underline"
                  >
                    Backup Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Main Document Canvas View */}
          <main className="flex-1 overflow-y-auto workspace-canvas bg-white dark:bg-[#111827] p-1 sm:p-2 lg:p-3">
            <div className="max-w-5xl mx-auto space-y-1">
              {/* Universal Return to Dashboard Shortcut for all sub-views */}
              {activeView !== 'home' && (
                <div className="flex items-center justify-between pb-0 border-b border-[#F3F4F6] dark:border-[#1F2937]">
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="flex items-center gap-1.5 text-xs text-[#6366F1] dark:text-[#818CF8] hover:underline font-semibold cursor-pointer group"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Return to Home / Today</span>
                  </button>
                  <span className="text-[10px] font-mono text-[#9CA3AF]">
                    {currentNav.emoji} {currentNav.label}
                  </span>
                </div>
              )}

              {/* VIEW 0: Interactive Dynamic Notion Home Dashboard */}
              {activeView === 'home' && (
                <DashboardHomeView
                  profile={profile}
                  todos={todos}
                  habits={habits}
                  journal={journal}
                  sections={sections}
                  photos={photos}
                  quotes={quotes}
                  milestones={milestones}
                  expenses={expenses}
                  media={media}
                  onAddQuote={handleAddQuote}
                  onDeleteQuote={handleDeleteQuote}
                  onUpdateSections={handleUpdateSections}
                  onUpdatePhotos={handleUpdatePhotos}
                  onNavigate={handleNavigate}
                  onToggleTodo={handleToggleTodo}
                  onAddTodo={handleAddTodo}
                  onAddExpense={handleAddExpense}
                  onAddHabit={handleAddHabit}
                  onToggleHabitDay={handleToggleHabitDay}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW 1: Workfolio with Resume Upload & Interactive Bio */}
              {(activeView === 'workfolio' || activeView === 'portfolio' || activeView === 'resume' || activeView === 'projects') && (
                <WorkfolioView
                  profile={profile}
                  projects={projects}
                  skills={skills}
                  resume={resume}
                  onUpdateProfile={handleUpdateProfile}
                  onUpdateResume={handleUpdateResume}
                  onAddProject={handleAddProject}
                  onDeleteProject={handleDeleteProject}
                  onNavigate={handleNavigate}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW 2: Tasks Notion Kanban Board */}
              {activeView === 'tasks' && (
                <TasksKanbanView
                  todos={todos}
                  onToggleTodo={handleToggleTodo}
                  onAddTodo={handleAddTodo}
                  onUpdateTodo={handleUpdateTodo}
                  onUpdateStatus={handleUpdateTaskStatus}
                  onDeleteTodo={handleDeleteTodo}
                  onClearCompleted={handleClearCompletedTodos}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Goals Hub */}
              {activeView === 'goals' && (
                <GoalsView
                  goals={goals}
                  onAddGoal={handleAddGoal}
                  onUpdateGoal={handleUpdateGoal}
                  onDeleteGoal={handleDeleteGoal}
                  onNavigate={handleNavigate}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Competitive Examinations & Syllabus Hub */}
              {activeView === 'exams' && (
                <ExamsSection
                  exams={exams}
                  onUpdateExams={handleUpdateExams}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Dear Diary (Themed, Vault-Protected Daily Journal) */}
              {activeView === 'journal' && (
                <DearDiaryView
                  entries={journal}
                  masterPin={settings.masterPin}
                  onAddEntry={handleAddDiaryEntry}
                  onDeleteEntry={handleDeleteJournalEntry}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Quotes & Mantras Lounge */}
              {activeView === 'quotes' && (
                <QuotesManagerView
                  quotes={quotes}
                  onAddQuote={handleAddQuote}
                  onUpdateQuote={handleUpdateQuote}
                  onDeleteQuote={handleDeleteQuote}
                  onNavigate={handleNavigate}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Habits Tracker */}
              {activeView === 'habits' && (
                <div className="space-y-6">
                  <div className="space-y-2 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                    <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
                      <span>⚡</span>
                      <span>Daily Routines & Habits</span>
                    </h1>
                    <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                      Track daily momentum, streaks, and accountability routines
                    </p>
                  </div>
                  <HabitTracker
                    habits={habits}
                    onToggleHabitDay={handleToggleHabitDay}
                    onAddHabit={handleAddHabit}
                    onDeleteHabit={handleDeleteHabit}
                    onResetWeek={handleResetHabitWeek}
                    soundEnabled={settings.soundEnabled}
                  />
                </div>
              )}

              {/* VIEW: Password Vault */}
              {activeView === 'vault' && (
                <div className="space-y-6">
                  <div className="space-y-2 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                    <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
                      <span>🔐</span>
                      <span>Client-Side Password Vault</span>
                    </h1>
                    <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                      Encrypted local credential store with PIN verification & password generator
                    </p>
                  </div>
                  <PasswordVault
                    credentials={vault}
                    masterPin={settings.masterPin}
                    onAddCredential={handleAddVaultSecret}
                    onDeleteCredential={handleDeleteVaultSecret}
                    soundEnabled={settings.soundEnabled}
                    onOpenSettings={() => setIsSettingsOpen(true)}
                  />
                </div>
              )}

              {/* VIEW: Backup & Restore Data Management */}
              {activeView === 'backup' && (
                <BackupRestoreView
                  onExportData={handleExportData}
                  onImportData={handleImportData}
                  onResetData={handleResetData}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Expenses & Subscriptions */}
              {(activeView === 'expenses' || activeView === 'subscriptions') && (
                <ExpenseTracker
                  expenses={expenses}
                  onAddExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onBatchAddExpenses={handleBatchAddExpenses}
                  onToggleActive={handleToggleExpense}
                  onDeleteExpense={handleDeleteExpense}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW: Media Watchlist & Books */}
              {activeView === 'media' && (
                <div className="space-y-6">
                  <div className="space-y-2 pb-4 border-b border-[#E5E7EB] dark:border-[#1F2937]">
                    <h1 className="workspace-heading font-extrabold text-[#37352F] dark:text-white flex items-center gap-2.5">
                      <span>🎬</span>
                      <span>Media Library & Reading Lounge</span>
                    </h1>
                    <p className="text-xs text-[#787774] dark:text-[#9CA3AF]">
                      Curated library of technical books, films, series, and reviews
                    </p>
                  </div>
                  <MediaGallery
                    media={media}
                    initialFilterType={mediaInitialTab}
                    onAddMedia={handleAddMedia}
                    onUpdateRating={handleUpdateMediaRating}
                    onDeleteMedia={handleDeleteMedia}
                    soundEnabled={settings.soundEnabled}
                  />
                </div>
              )}

              {/* VIEW: Life Map */}
              {activeView === 'timeline' && (
                <LifeTimeline
                  milestones={milestones}
                  onAddMilestone={handleAddMilestone}
                  onUpdateMilestone={handleUpdateMilestone}
                  onDeleteMilestone={handleDeleteMilestone}
                  soundEnabled={settings.soundEnabled}
                />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* Super-Powered Command Palette Modal (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
        onQuickAdd={(type) => {
          setShowQuickCapture(true);
        }}
        todos={todos}
        journal={journal}
        media={media}
        milestones={milestones}
        projects={projects}
        vault={vault}
        expenses={expenses}
        habits={habits}
        quotes={quotes}
        darkMode={settings.darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        soundEnabled={settings.soundEnabled}
        onToggleSound={handleToggleSound}
        onExportData={handleExportData}
        onResetData={handleResetData}
      />

      {/* Settings, Multi-Device Sessions & Name Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onResetData={handleResetData}
        currentUser={currentUser}
        userName={profile.name}
        onUpdateUserName={handleUpdateUserName}
        onSignOut={handleSignOut}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        userEmail={currentUser?.email || profile.contactEmail}
        soundEnabled={settings.soundEnabled}
      />

      {/* Global User Authentication & Personalized Workspace Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthenticated={handleAuthenticated}
        currentUser={currentUser}
      />
    </div>
  );
}
