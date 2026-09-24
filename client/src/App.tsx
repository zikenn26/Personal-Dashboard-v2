import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'motion/react';
import { Storage, STORAGE_KEYS, getScopedKey } from './utils/storage';
import { Sound } from './utils/audio';
import { triggerConfetti } from './utils/confetti';
import {
  UserProfile,
  TodoItem,
  HabitItem,
  HabitWeekRecord,
  HabitActivityLog,
  GoalItem,
  VaultCredential,
  ExpenseItem,
  ExcelImportLog,
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
  WeeklyScheduleData,
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
import { SmsExpenseModal } from './components/SmsExpenseModal';
import { ApiKeySettingsModal } from './components/ApiKeySettingsModal';
import { smsExpenseService } from './services/smsExpenseService';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { QuickCaptureBar } from './components/QuickCaptureBar';
import { BackupRestoreView } from './components/BackupRestoreView';
import { AIAssistantView } from './components/AIAssistantView';
import { AISecretaryWidget } from './components/AISecretaryWidget';
import { GeminiLiveVoiceModal } from './components/GeminiLiveVoiceModal';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { CommandMappingModal } from './components/CommandMappingModal';
import { registerAppHandlers } from './services/commandMappingService';
import { GoalsView } from './components/GoalsView';
import { QuotesManagerView } from './components/QuotesManagerView';
import { ExamsSection } from './components/ExamsSection';
import { AuthModal } from './components/AuthModal';
import { AvatarPickerModal } from './components/AvatarPickerModal';
import { STOCK_IMAGES } from './assets/stockImages';
import LandingPage from './components/LandingPage';
import { usePlatformMode } from './presentation/mobile/shell/usePlatformMode';
import { AndroidShell } from './presentation/mobile/shell/AndroidShell';
import {
  checkAndRollOverHabits,
  getMondayOfWeek,
  getWeekId,
  formatDateIso,
  formatWeekRange,
  getWeekDaysInfo,
  archiveCurrentWeekRecord,
  DAYS_OF_WEEK,
  parseIsoDate,
} from './utils/habitWeekManager';
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
import { nativeService } from './services/nativeService';

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
  Camera,
  Bot,
  Sparkle,
  RotateCcw,
  Trash2,
  Mic,
  Radio,
  AlertTriangle,
} from 'lucide-react';

// Framer Motion Page Transition Variants for Main Content View Area
const pageTransitionVariants: Variants = {
  initial: {
    opacity: 0,
    y: 10,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1] as const, // fluid easeOut
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: 0.16,
      ease: 'easeIn',
    },
  },
};

export default function App() {
  // Reference to main scrollable container to reset scroll position on page transition
  const mainScrollRef = useRef<HTMLElement>(null);

  // Current logged in user (initialized first to ensure user-scoped storage keys are ready)
  const authRequest = new URLSearchParams(window.location.search).get('auth');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => Auth.getCurrentUser());

  // 1. Core State loaded from user-scoped localStorage
  const [profile, setProfile] = useState<UserProfile>(Storage.getProfile);
  const [todos, setTodos] = useState<TodoItem[]>(Storage.getTodos);
  const [habits, setHabits] = useState<HabitItem[]>(Storage.getHabits);
  const [habitHistory, setHabitHistory] = useState<HabitWeekRecord[]>(Storage.getHabitHistory);
  const [habitActiveWeek, setHabitActiveWeek] = useState<string>(Storage.getHabitActiveWeek);
  const [habitActivities, setHabitActivities] = useState<HabitActivityLog[]>(Storage.getHabitActivities);
  const [goals, setGoals] = useState<GoalItem[]>(Storage.getGoals);
  const [vault, setVault] = useState<VaultCredential[]>(Storage.getVault);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(Storage.getExpenses);
  const [excelImportLogs, setExcelImportLogs] = useState<ExcelImportLog[]>(Storage.getExcelImportLogs);
  const [journal, setJournal] = useState<JournalEntry[]>(Storage.getJournal);
  const [media, setMedia] = useState<MediaItem[]>(Storage.getMedia);
  const [milestones, setMilestones] = useState<LifeMilestone[]>(Storage.getTimeline);
  const [projects, setProjects] = useState<PortfolioProject[]>(Storage.getProjects);
  const [skills, setSkills] = useState<SkillCategory[]>(Storage.getSkills);
  const [achievements, setAchievements] = useState<AchievementItem[]>(Storage.getAchievements);
  const [doodles, setDoodles] = useState<DoodleItem[]>(Storage.getDoodles);
  const [settings, setSettings] = useState<AppSettings>(Storage.getSettings);
  const [sections, setSections] = useState<DashboardSection[]>(Storage.getSections);
  const [photos, setPhotos] = useState(Storage.getPhotos);
  const [resume, setResume] = useState<ResumeDocument>(Storage.getResume);
  const [quotes, setQuotes] = useState<QuoteItem[]>(Storage.getQuotes);
  const [exams, setExams] = useState<ExamItem[]>(Storage.getExams);
  const [schedule, setSchedule] = useState<WeeklyScheduleData>(Storage.getSchedule);

  // 2. Navigation & Sidebar State
  const { isAndroidView } = usePlatformMode();
  const [activeView, setActiveView] = useState<MainNavView>('home');
  const [mediaInitialTab, setMediaInitialTab] = useState<string>('all');

  // Smoothly reset view canvas scroll position on view switch
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [activeView]);

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
  const [isZikennPopupOpen, setIsZikennPopupOpen] = useState(false);
  const [isGlobalVoiceModalOpen, setIsGlobalVoiceModalOpen] = useState(false);
  const [isGlobalVoiceActive, setIsGlobalVoiceActive] = useState(false);
  const [isVoiceCommandProcessed, setIsVoiceCommandProcessed] = useState(false);
  const voiceCommandTimerRef = useRef<any>(null);

  const handleVoiceCommandExecuted = useCallback((_cmdText: string) => {
    setIsVoiceCommandProcessed(true);
    if (voiceCommandTimerRef.current) clearTimeout(voiceCommandTimerRef.current);
    voiceCommandTimerRef.current = setTimeout(() => {
      setIsVoiceCommandProcessed(false);
    }, 3600);
  }, []);

  const handleVoiceListeningChange = useCallback((listening: boolean) => {
    setIsGlobalVoiceActive(listening);
  }, []);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isCommandMappingModalOpen, setIsCommandMappingModalOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isGlobalAvatarPickerOpen, setIsGlobalAvatarPickerOpen] = useState(false);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => authRequest === 'signup' || authRequest === 'signin');
  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'signup'>(() => authRequest === 'signup' ? 'signup' : 'signin');

  // API Usage Threshold Warning Notification Banner
  const [apiThresholdWarning, setApiThresholdWarning] = useState<{
    level: 'approaching' | 'limit_reached';
    current: number;
    limit: number;
    percent: number;
    message: string;
  } | null>(() => {
    const stats = Storage.getApiRequestCountsThisMonth();
    if (stats.threshold && stats.threshold > 0) {
      if (stats.isLimitReached) {
        return {
          level: 'limit_reached',
          current: stats.total,
          limit: stats.threshold,
          percent: stats.percentUsed || 100,
          message: `Monthly API threshold reached: ${stats.total} of ${stats.threshold} requests used (${stats.percentUsed}%).`,
        };
      } else if (stats.isApproachingLimit) {
        return {
          level: 'approaching',
          current: stats.total,
          limit: stats.threshold,
          percent: stats.percentUsed || 80,
          message: `Approaching monthly API usage threshold: ${stats.total} of ${stats.threshold} requests used (${stats.percentUsed}%).`,
        };
      }
    }
    return null;
  });

  // Floating Undo Toast for Deleted Expense
  const [expenseUndoToast, setExpenseUndoToast] = useState<{
    item: ExpenseItem;
    index: number;
  } | null>(null);
  const expenseUndoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Atomic pending state for expense deletion (ensures only that transaction can be confirmed/canceled, blocking all other intents)
  const [atomicPendingDeletion, setAtomicPendingDeletion] = useState<{
    transactionId: string;
    items: ExpenseItem[];
    totalAmount: number;
    label: string;
    isMultiple: boolean;
    timestamp: number;
  } | null>(null);

  // Cleanup undo timer on unmount
  useEffect(() => {
    return () => {
      if (expenseUndoTimerRef.current) {
        clearTimeout(expenseUndoTimerRef.current);
      }
    };
  }, []);

  // High-Speed Realtime Cloud Sync State & Flags
  const [syncStatus, setSyncStatus] = useState<'synced' | 'syncing' | 'error' | 'idle'>(getAutoSyncStatus);
  const isInitialMount = useRef(true);
  const isRemoteUpdating = useRef(false);
  const isCloudReady = useRef(false);

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

    // If user's name or avatar is customized on account, update profile state
    const current = Storage.getProfile();
    let updatedProfile = { ...current };
    let hasProfileChanges = false;
    if (user.name && user.name !== current.name) {
      updatedProfile.name = user.name;
      updatedProfile.contactEmail = user.email;
      hasProfileChanges = true;
    }
    if (user.avatarUrl && (!current.avatarUrl || current.avatarUrl === STOCK_IMAGES.avatar || user.avatarUrl !== current.avatarUrl)) {
      updatedProfile.avatarUrl = user.avatarUrl;
      hasProfileChanges = true;
    }
    if (hasProfileChanges) {
      setProfile(updatedProfile);
      Storage.setProfile(updatedProfile);
    }
    
    // Re-fetch user workspace data from Supabase if configured
    fetchWorkspaceFromSupabase().then((res) => {
      if (res.success && res.data) {
        isRemoteUpdating.current = true;
        Storage.importAllDataPayload(res.data);
        handleHydrateAllFromStorage(false);
        setTimeout(() => {
          isRemoteUpdating.current = false;
          isCloudReady.current = true;
        }, 300);
      } else {
        isCloudReady.current = true;
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
    setHabitHistory(Storage.getHabitHistory());
    setHabitActiveWeek(Storage.getHabitActiveWeek());
    setHabitActivities(Storage.getHabitActivities());
    setGoals(Storage.getGoals());
    void Storage.hydrateVault(Storage.getSettings().masterPin).then(setVault);

    // Force fresh direct read from localStorage for expenses to avoid any stale cached data
    let freshExpenses: ExpenseItem[] = Storage.getExpenses();
    try {
      const raw =
        localStorage.getItem(getScopedKey(STORAGE_KEYS.EXPENSES)) ??
        localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          freshExpenses = parsed;
        }
      }
    } catch {}
    setExpenses([...freshExpenses]);

    setExcelImportLogs(Storage.getExcelImportLogs());
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
    setSchedule(Storage.getSchedule());
    if (playEffects) {
      Sound.success(settings.soundEnabled);
      triggerConfetti();
    }
  };

  // Sync state in real-time whenever AI Secretary or dashboard operations perform CRUD updates
  useEffect(() => {
    const handleDashboardDataUpdated = (e?: Event) => {
      const customEvt = e as CustomEvent<{ module?: string; updatedExpenses?: ExpenseItem[] }>;

      // If custom event provided explicit updatedExpenses array, prefer it; otherwise use direct localStorage read
      if (customEvt?.detail?.updatedExpenses && Array.isArray(customEvt.detail.updatedExpenses)) {
        const fresh = [...customEvt.detail.updatedExpenses];
        setExpenses(fresh);
        Storage.setExpenses(fresh);
      } else {
        const fresh = Storage.getExpenses();
        setExpenses([...fresh]);
      }

      // Hydrate all other modules cleanly without clobbering the fresh expenses
      setProfile(Storage.getProfile());
      setTodos(Storage.getTodos());
      setHabits(Storage.getHabits());
      setHabitHistory(Storage.getHabitHistory());
      setHabitActiveWeek(Storage.getHabitActiveWeek());
      setHabitActivities(Storage.getHabitActivities());
      setGoals(Storage.getGoals());
      void Storage.hydrateVault(Storage.getSettings().masterPin).then(setVault);
      setExcelImportLogs(Storage.getExcelImportLogs());
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
      setSchedule(Storage.getSchedule());

      if (!isRemoteUpdating.current && isSupabaseConfigured()) {
        void flushAutoSyncImmediately(Storage.getAllDataPayload());
      }
    };

    window.addEventListener('dashboard-data-updated', handleDashboardDataUpdated);
    window.addEventListener('storage', handleDashboardDataUpdated);
    return () => {
      window.removeEventListener('dashboard-data-updated', handleDashboardDataUpdated);
      window.removeEventListener('storage', handleDashboardDataUpdated);
    };
  }, []);

  // Listen for external atomic expense deletion requests
  useEffect(() => {
    const handleRequestAtomicExpenseDeletion = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.ids || detail?.id) {
        handleDeleteExpense(detail.ids || detail.id, false);
      }
    };
    window.addEventListener('request-atomic-expense-deletion', handleRequestAtomicExpenseDeletion);
    return () => {
      window.removeEventListener('request-atomic-expense-deletion', handleRequestAtomicExpenseDeletion);
    };
  }, [atomicPendingDeletion, expenses]);

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
      } finally {
        if (isMounted) {
          isCloudReady.current = true;
        }
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
    // Prevent unhydrated local device state from wiping cloud state
    if (!isCloudReady.current) {
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
    excelImportLogs,
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
    schedule,
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

  // 3. Sync Dark Mode class on document root cleanly and native status bar
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    nativeService.updateThemeStatusBar(Boolean(settings.darkMode));
    Storage.setSettings(settings);
  }, [settings]);

  // Hide native splash screen once React UI is mounted and initialize SMS auto-logging
  useEffect(() => {
    nativeService.hideSplashScreen();
    smsExpenseService.initialize();

    const handleSmsExpenseLogged = () => {
      setExpenses(Storage.getExpenses());
    };
    window.addEventListener('sms_expense_auto_logged', handleSmsExpenseLogged);
    return () => {
      window.removeEventListener('sms_expense_auto_logged', handleSmsExpenseLogged);
    };
  }, []);

  // Android Hardware Back Button Handling
  useEffect(() => {
    const unregister = nativeService.registerBackButtonHandler(() => {
      // 1. Close open modals/overlays in priority order
      if (isAuthModalOpen) {
        setIsAuthModalOpen(false);
        return true;
      }
      if (isSettingsOpen) {
        setIsSettingsOpen(false);
        return true;
      }
      if (isSmsModalOpen) {
        setIsSmsModalOpen(false);
        return true;
      }
      if (isCommandPaletteOpen) {
        setIsCommandPaletteOpen(false);
        return true;
      }
      if (isApiKeyModalOpen) {
        setIsApiKeyModalOpen(false);
        return true;
      }
      if (isCommandMappingModalOpen) {
        setIsCommandMappingModalOpen(false);
        return true;
      }
      if (isChangePasswordOpen) {
        setIsChangePasswordOpen(false);
        return true;
      }
      if (isGlobalAvatarPickerOpen) {
        setIsGlobalAvatarPickerOpen(false);
        return true;
      }
      if (isGlobalVoiceModalOpen) {
        setIsGlobalVoiceModalOpen(false);
        return true;
      }
      if (isZikennPopupOpen) {
        setIsZikennPopupOpen(false);
        return true;
      }
      if (isAddMenuOpen) {
        setIsAddMenuOpen(false);
        return true;
      }
      if (isAccountMenuOpen) {
        setIsAccountMenuOpen(false);
        return true;
      }
      if (isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
        return true;
      }
      // 2. If navigated away from home dashboard, return to home view
      if (activeView !== 'home') {
        setActiveView('home');
        return true;
      }
      return false; // Root level: allow system to exit or minimize
    });

    return unregister;
  }, [
    isAuthModalOpen,
    isSettingsOpen,
    isSmsModalOpen,
    isCommandPaletteOpen,
    isApiKeyModalOpen,
    isCommandMappingModalOpen,
    isChangePasswordOpen,
    isGlobalAvatarPickerOpen,
    isGlobalVoiceModalOpen,
    isZikennPopupOpen,
    isAddMenuOpen,
    isAccountMenuOpen,
    isMobileSidebarOpen,
    activeView,
  ]);

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

  // Listen to API monthly usage threshold warnings and changes
  useEffect(() => {
    const handleThresholdWarning = (e: Event) => {
      const customEvent = e as CustomEvent<{
        level: 'approaching' | 'limit_reached';
        current: number;
        limit: number;
        percent: number;
        message: string;
      }>;
      if (customEvent.detail) {
        setApiThresholdWarning(customEvent.detail);
        Sound.error(settings.soundEnabled);
      }
    };

    const handleThresholdChange = () => {
      const stats = Storage.getApiRequestCountsThisMonth();
      if (stats.threshold && stats.threshold > 0) {
        if (stats.isLimitReached) {
          setApiThresholdWarning({
            level: 'limit_reached',
            current: stats.total,
            limit: stats.threshold,
            percent: stats.percentUsed || 100,
            message: `Monthly API threshold reached: ${stats.total} of ${stats.threshold} requests used (${stats.percentUsed}%).`,
          });
        } else if (stats.isApproachingLimit) {
          setApiThresholdWarning({
            level: 'approaching',
            current: stats.total,
            limit: stats.threshold,
            percent: stats.percentUsed || 80,
            message: `Approaching monthly API usage threshold: ${stats.total} of ${stats.threshold} requests used (${stats.percentUsed}%).`,
          });
        } else {
          setApiThresholdWarning(null);
        }
      } else {
        setApiThresholdWarning(null);
      }
    };

    window.addEventListener('lifeos_api_threshold_warning', handleThresholdWarning);
    window.addEventListener('lifeos_api_threshold_changed', handleThresholdChange);
    return () => {
      window.removeEventListener('lifeos_api_threshold_warning', handleThresholdWarning);
      window.removeEventListener('lifeos_api_threshold_changed', handleThresholdChange);
    };
  }, [settings.soundEnabled]);

  // Profile Handlers
  const handleUpdateProfile = (updated: UserProfile) => {
    setProfile(updated);
    Storage.setProfile(updated);

    // If avatar was updated, keep currentUser and account credentials in sync
    if (updated.avatarUrl && updated.avatarUrl !== currentUser?.avatarUrl) {
      void Auth.updateCurrentUserAvatar(updated.avatarUrl).then((updatedUser) => {
        if (updatedUser) setCurrentUser(updatedUser);
      });
    }

    // Immediately flush auto-sync to Supabase Cloud so all peer devices receive the update in real time (<30ms)
    void flushAutoSyncImmediately(Storage.getAllDataPayload());
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
    const updated = todos.filter((t) => !t.completed && t.status !== 'complete');
    setTodos(updated);
    Storage.setTodos(updated);
  };

  // Habit Lifecycle & Automated Monday Rollover Detector
  // Automatically detects when a new week begins on Monday 00:00, archives the previous
  // week's activities into historical records, and starts the habit routine fresh.
  useEffect(() => {
    const runHabitRolloverCheck = () => {
      const activeWeek = Storage.getHabitActiveWeek();
      const storedHabits = Storage.getHabits();
      const storedHistory = Storage.getHabitHistory();

      const result = checkAndRollOverHabits(storedHabits, activeWeek || null, storedHistory);

      if (result.didRollover) {
        setHabits(result.updatedHabits);
        Storage.setHabits(result.updatedHabits);
        setHabitHistory(result.updatedHistory);
        Storage.setHabitHistory(result.updatedHistory);
        setHabitActiveWeek(result.newWeekId);
        Storage.setHabitActiveWeek(result.newWeekId);
      } else if (!activeWeek) {
        // Initial setup on first visit
        setHabitActiveWeek(result.newWeekId);
        Storage.setHabitActiveWeek(result.newWeekId);
        if (result.updatedHistory.length > 0 && storedHistory.length === 0) {
          setHabitHistory(result.updatedHistory);
          Storage.setHabitHistory(result.updatedHistory);
        }
      }
    };

    runHabitRolloverCheck();
    const interval = setInterval(runHabitRolloverCheck, 60000);
    window.addEventListener('focus', runHabitRolloverCheck);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', runHabitRolloverCheck);
    };
  }, []);

  // Data migration & sanitization:
  // 1. Remove any redundant history entry matching the current active week
  // 2. Ensure M.Tech NIT Raipur CGPA is updated to 8.55 CGPA in both profile and resume
  useEffect(() => {
    // 1. Habit History Sanitization
    const currentMonday = getMondayOfWeek();
    const currentWeekId = getWeekId(currentMonday);
    const currentWeekLabel = formatWeekRange(currentMonday);
    const sanitizedHistory = habitHistory.filter(
      (w) =>
        w.id !== `week-${currentWeekId}` &&
        w.id !== currentWeekId &&
        w.weekStart !== currentWeekId &&
        w.label?.trim().toLowerCase() !== currentWeekLabel?.trim().toLowerCase() &&
        !(Boolean(w.label?.toLowerCase().includes('sep 14')) && Boolean(currentWeekLabel?.toLowerCase().includes('sep 14')))
    );
    if (sanitizedHistory.length !== habitHistory.length) {
      setHabitHistory(sanitizedHistory);
      Storage.setHabitHistory(sanitizedHistory);
    }

    // 2. Profile Education M.Tech Result Update to 8.55 CGPA
    let profileUpdated = false;
    const updatedEdu = profile.educationRecords?.map((edu) => {
      if (
        (edu.id === 'edu-nit-raipur' ||
          edu.degree?.toLowerCase().includes('m.tech') ||
          edu.institution?.toLowerCase().includes('raipur')) &&
        (edu.score === '8.18 CGPA' || edu.score === '8.18')
      ) {
        profileUpdated = true;
        return { ...edu, score: '8.55 CGPA' };
      }
      return edu;
    });
    if (profileUpdated && updatedEdu) {
      const nextProf = { ...profile, educationRecords: updatedEdu };
      setProfile(nextProf);
      Storage.setProfile(nextProf);
    }

    // 3. ATS Resume Education M.Tech Result Update to 8.55 CGPA
    let resumeUpdated = false;
    const updatedResumeEdu = resume.education?.map((edu) => {
      if (
        (edu.school?.toLowerCase().includes('raipur') ||
          edu.degree?.toLowerCase().includes('m.tech')) &&
        (edu.score === '8.18 CGPA' || edu.score === '8.18')
      ) {
        resumeUpdated = true;
        return { ...edu, score: '8.55 CGPA' };
      }
      return edu;
    });
    if (resumeUpdated && updatedResumeEdu) {
      const nextResume = { ...resume, education: updatedResumeEdu };
      setResume(nextResume);
      Storage.setResume(nextResume);
    }
  }, []);

  // Habit Handlers
  const handleToggleHabitDay = (habitId: string, dayIndex: number) => {
    Sound.click(settings.soundEnabled);
    let toggledHabit: HabitItem | null = null;
    let isNowCompleted = false;

    const updated = habits.map((h) => {
      if (h.id === habitId) {
        const newDays = [...h.completedDays];
        newDays[dayIndex] = !newDays[dayIndex];
        isNowCompleted = newDays[dayIndex];
        const completedCount = newDays.filter(Boolean).length;
        toggledHabit = {
          ...h,
          completedDays: newDays,
          streak: completedCount > 0 ? h.streak + (newDays[dayIndex] ? 1 : -1) : 0,
        };
        return toggledHabit;
      }
      return h;
    });

    setHabits(updated);
    Storage.setHabits(updated);

    // Record or update the discrete habit activity log
    if (toggledHabit) {
      const currentMonday = getMondayOfWeek();
      const days = getWeekDaysInfo(currentMonday);
      const dayInfo = days[dayIndex];

      if (dayInfo) {
        if (isNowCompleted) {
          const habitToLog = toggledHabit as HabitItem;
          const newActivity: HabitActivityLog = {
            id: `act-${habitId}-${dayInfo.dateStr}-${Date.now()}`,
            habitId,
            habitTitle: habitToLog.title,
            category: habitToLog.category,
            icon: habitToLog.icon,
            color: habitToLog.color,
            dayIndex,
            dayName: DAYS_OF_WEEK[dayIndex],
            date: dayInfo.dateStr,
            completed: true,
            timestamp: Date.now(),
          };
          const nextActs = [
            newActivity,
            ...habitActivities.filter((a) => !(a.habitId === habitId && a.date === dayInfo.dateStr)),
          ];
          setHabitActivities(nextActs);
          Storage.setHabitActivities(nextActs);
        } else {
          const nextActs = habitActivities.filter(
            (a) => !(a.habitId === habitId && a.date === dayInfo.dateStr)
          );
          setHabitActivities(nextActs);
          Storage.setHabitActivities(nextActs);
        }
      }
    }
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

  // Simulates or forces a clean Monday rollover: archives the previous week into past records
  // and starts the habit routine fresh.
  const handleSimulateMondayRollover = () => {
    Sound.success(settings.soundEnabled);
    triggerConfetti();
    const currentMonday = getMondayOfWeek();
    const currentWeekId = getWeekId(currentMonday);
    const currentWeekLabel = formatWeekRange(currentMonday);

    // Archive the prior week (7 days ago) to avoid duplicating the current active week
    const prevMonday = new Date(currentMonday);
    prevMonday.setDate(currentMonday.getDate() - 7);
    const prevWeekId = formatDateIso(prevMonday);

    const archivedWeek = archiveCurrentWeekRecord(habits, prevWeekId, habitActivities);
    const updatedHistory = [
      archivedWeek,
      ...habitHistory.filter(
        (h) =>
          h.id !== archivedWeek.id &&
          h.weekStart !== prevWeekId &&
          h.weekStart !== currentWeekId &&
          h.id !== `week-${currentWeekId}` &&
          h.label?.trim().toLowerCase() !== currentWeekLabel?.trim().toLowerCase()
      ),
    ];

    // Reset habits fresh for the new week
    const freshHabits = habits.map((h) => ({
      ...h,
      completedDays: [false, false, false, false, false, false, false],
    }));

    setHabits(freshHabits);
    Storage.setHabits(freshHabits);
    setHabitHistory(updatedHistory);
    Storage.setHabitHistory(updatedHistory);
  };

  // Historical Habit Handlers (Allows user to edit and toggle habits from previous weeks)
  const handleToggleHistoricalHabitDay = (weekId: string, habitId: string, dayIndex: number) => {
    Sound.click(settings.soundEnabled);
    let isNowDone = false;
    let habitItem: HabitItem | null = null;
    let targetWeekDateStr = '';

    const updatedHistory = habitHistory.map((week) => {
      if (week.id === weekId) {
        const weekMonday = new Date(week.weekStart);
        const days = getWeekDaysInfo(weekMonday);
        const dayInfo = days[dayIndex];
        if (dayInfo) targetWeekDateStr = dayInfo.dateStr;

        const updatedHabits = week.habits.map((h) => {
          if (h.id === habitId) {
            const nextDays = [...h.completedDays];
            nextDays[dayIndex] = !nextDays[dayIndex];
            isNowDone = nextDays[dayIndex];
            habitItem = {
              ...h,
              completedDays: nextDays,
              streak: nextDays.filter(Boolean).length,
            };
            return habitItem;
          }
          return h;
        });

        const totalDone = updatedHabits.reduce(
          (acc, h) => acc + h.completedDays.filter(Boolean).length,
          0
        );
        const totalPossible = updatedHabits.length * 7;
        const completionRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;

        let nextActivities = week.activities ? [...week.activities] : [];
        if (targetWeekDateStr) {
          if (isNowDone && habitItem) {
            const item = habitItem as HabitItem;
            const newAct: HabitActivityLog = {
              id: `act-${habitId}-${targetWeekDateStr}-${Date.now()}`,
              habitId,
              habitTitle: item.title,
              category: item.category,
              icon: item.icon,
              color: item.color,
              dayIndex,
              dayName: DAYS_OF_WEEK[dayIndex],
              date: targetWeekDateStr,
              completed: true,
              timestamp: parseIsoDate(targetWeekDateStr).getTime() + 12 * 3600 * 1000,
            };
            nextActivities = [
              newAct,
              ...nextActivities.filter((a) => !(a.habitId === habitId && a.date === targetWeekDateStr)),
            ];
          } else {
            nextActivities = nextActivities.filter(
              (a) => !(a.habitId === habitId && a.date === targetWeekDateStr)
            );
          }
        }

        return {
          ...week,
          habits: updatedHabits,
          totalDone,
          totalPossible,
          completionRate,
          activities: nextActivities,
        };
      }
      return week;
    });

    setHabitHistory(updatedHistory);
    Storage.setHabitHistory(updatedHistory);

    if (targetWeekDateStr && habitItem) {
      if (isNowDone) {
        const item = habitItem as HabitItem;
        const newAct: HabitActivityLog = {
          id: `act-${habitId}-${targetWeekDateStr}-${Date.now()}`,
          habitId,
          habitTitle: item.title,
          category: item.category,
          icon: item.icon,
          color: item.color,
          dayIndex,
          dayName: DAYS_OF_WEEK[dayIndex],
          date: targetWeekDateStr,
          completed: true,
          timestamp: parseIsoDate(targetWeekDateStr).getTime() + 12 * 3600 * 1000,
        };
        const nextGlobal = [
          newAct,
          ...habitActivities.filter((a) => !(a.habitId === habitId && a.date === targetWeekDateStr)),
        ];
        setHabitActivities(nextGlobal);
        Storage.setHabitActivities(nextGlobal);
      } else {
        const nextGlobal = habitActivities.filter(
          (a) => !(a.habitId === habitId && a.date === targetWeekDateStr)
        );
        setHabitActivities(nextGlobal);
        Storage.setHabitActivities(nextGlobal);
      }
    }
  };

  const handleAddHistoricalHabit = (
    weekId: string,
    title: string,
    category: string,
    icon: string,
    color: string
  ) => {
    Sound.success(settings.soundEnabled);
    const newHabit: HabitItem = {
      id: `hb-hist-${Date.now()}`,
      title,
      category,
      icon,
      completedDays: [false, false, false, false, false, false, false],
      streak: 0,
      color,
    };

    const updatedHistory = habitHistory.map((week) => {
      if (week.id === weekId) {
        const updatedHabits = [...week.habits, newHabit];
        const totalDone = updatedHabits.reduce(
          (acc, h) => acc + h.completedDays.filter(Boolean).length,
          0
        );
        const totalPossible = updatedHabits.length * 7;
        const completionRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
        return {
          ...week,
          habits: updatedHabits,
          totalDone,
          totalPossible,
          completionRate,
        };
      }
      return week;
    });

    setHabitHistory(updatedHistory);
    Storage.setHabitHistory(updatedHistory);
  };

  const handleDeleteHistoricalHabit = (weekId: string, habitId: string) => {
    Sound.click(settings.soundEnabled);
    const updatedHistory = habitHistory.map((week) => {
      if (week.id === weekId) {
        const updatedHabits = week.habits.filter((h) => h.id !== habitId);
        const totalDone = updatedHabits.reduce(
          (acc, h) => acc + h.completedDays.filter(Boolean).length,
          0
        );
        const totalPossible = updatedHabits.length * 7;
        const completionRate = totalPossible > 0 ? Math.round((totalDone / totalPossible) * 100) : 0;
        return {
          ...week,
          habits: updatedHabits,
          totalDone,
          totalPossible,
          completionRate,
        };
      }
      return week;
    });

    setHabitHistory(updatedHistory);
    Storage.setHabitHistory(updatedHistory);
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

  const handleBatchAddExpenses = (
    newItems: Array<Omit<ExpenseItem, 'id'>>,
    newLog?: ExcelImportLog
  ) => {
    const created: ExpenseItem[] = newItems.map((item, idx) => ({
      id: `exp-${Date.now()}-${idx}`,
      ...item,
    }));
    const updated = [...created, ...expenses];
    setExpenses(updated);
    Storage.setExpenses(updated);

    let updatedLogs = excelImportLogs;
    if (newLog) {
      updatedLogs = [newLog, ...excelImportLogs.filter((l) => l.id !== newLog.id)];
      setExcelImportLogs(updatedLogs);
      Storage.setExcelImportLogs(updatedLogs);
    }

    // Force an immediate flush to Supabase cloud and WebSocket broadcast so other devices receive spendings instantly
    flushAutoSyncImmediately({
      ...Storage.getAllDataPayload(),
      expenses: updated,
      excelImportLogs: updatedLogs,
    });
  };

  const handleDeleteImportLog = (logId: string) => {
    const updatedLogs = excelImportLogs.filter((l) => l.id !== logId);
    setExcelImportLogs(updatedLogs);
    Storage.setExcelImportLogs(updatedLogs);
    flushAutoSyncImmediately({
      ...Storage.getAllDataPayload(),
      excelImportLogs: updatedLogs,
    });
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

  const executeAtomicExpenseDeletion = (itemsToDelete: ExpenseItem[]) => {
    const deleteIds = new Set(itemsToDelete.map((e) => String(e.id).trim()));
    const currentStored = Storage.getExpenses();

    const nextExpenses = expenses.filter((e) => !deleteIds.has(String(e.id).trim()));
    const nextStored = currentStored.filter((e) => !deleteIds.has(String(e.id).trim()));

    // 1. Immediately persist synchronously to localStorage (both scoped and unscoped)
    Storage.setExpenses(nextStored);
    try {
      localStorage.setItem(getScopedKey(STORAGE_KEYS.EXPENSES), JSON.stringify(nextStored));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(nextStored));
    } catch {}

    // 2. Clean up spreadsheet logs if all expenses cleared
    if (nextStored.length === 0) {
      Storage.setExcelImportLogs([]);
    }

    // 3. Immediately update React state with fresh array reference
    setExpenses([...nextExpenses]);

    // 4. Dispatch 'dashboard-data-updated' event to notify all listening components
    window.dispatchEvent(
      new CustomEvent('dashboard-data-updated', {
        detail: { module: 'expenses', updatedExpenses: nextExpenses, deletedCount: itemsToDelete.length },
      })
    );

    // 5. Flush auto sync immediately to Supabase
    flushAutoSyncImmediately({
      ...Storage.getAllDataPayload(),
      expenses: nextExpenses,
    });

    // 6. Trigger Undo Toast
    if (expenseUndoTimerRef.current) {
      clearTimeout(expenseUndoTimerRef.current);
    }
    const primaryItem = itemsToDelete[0];
    const itemIndex = expenses.findIndex((e) => e.id === primaryItem.id);
    setExpenseUndoToast({
      item: primaryItem,
      index: itemIndex >= 0 ? itemIndex : 0,
    });
    expenseUndoTimerRef.current = setTimeout(() => {
      setExpenseUndoToast(null);
    }, 6000);
  };

  const handleDeleteExpense = (idOrIds: string | string[], skipConfirm = true) => {
    Sound.click(settings.soundEnabled);

    // 1. ATOMIC LOCK CHECK: Block incoming requests if an atomic transaction is already pending
    if (atomicPendingDeletion) {
      console.warn('Blocked: An expense deletion transaction is currently locked in an atomic pending state.');
      return;
    }

    const targetIds = Array.isArray(idOrIds)
      ? idOrIds.map((s) => String(s).trim()).filter(Boolean)
      : [String(idOrIds).trim()].filter(Boolean);

    if (targetIds.length === 0) return;

    // Locate items across React state and Storage
    const currentStored = Storage.getExpenses();
    const idSet = new Set(targetIds);
    const itemsToDelete: ExpenseItem[] = [];
    const seen = new Set<string>();

    for (const e of expenses) {
      if (idSet.has(String(e.id).trim()) && !seen.has(e.id)) {
        itemsToDelete.push(e);
        seen.add(e.id);
      }
    }
    for (const e of currentStored) {
      if (idSet.has(String(e.id).trim()) && !seen.has(e.id)) {
        itemsToDelete.push(e);
        seen.add(e.id);
      }
    }

    if (itemsToDelete.length === 0) {
      console.warn(`Expense(s) not found for deletion: ${targetIds.join(', ')}`);
      return;
    }

    const isMultiple = itemsToDelete.length > 1;

    // 2. Multi-record deletion or unconfirmed deletion locks the atomic pending confirmation state
    if (isMultiple || !skipConfirm) {
      const totalAmount = itemsToDelete.reduce((sum, e) => sum + Number(e.amount || 0), 0);
      const label = isMultiple
        ? `${itemsToDelete.length} expenses totaling ₹${totalAmount.toLocaleString()}`
        : `"${itemsToDelete[0].name}" (₹${Number(itemsToDelete[0].amount).toLocaleString()})`;

      const transactionId = `tx-del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setAtomicPendingDeletion({
        transactionId,
        items: itemsToDelete,
        totalAmount,
        label,
        isMultiple,
        timestamp: Date.now(),
      });
      return;
    }

    // 3. Single record deletion already confirmed
    executeAtomicExpenseDeletion(itemsToDelete);
  };

  const handleApproveAtomicExpenseDeletion = () => {
    if (!atomicPendingDeletion) return;
    Sound.click(settings.soundEnabled);
    const { items } = atomicPendingDeletion;
    setAtomicPendingDeletion(null);
    executeAtomicExpenseDeletion(items);
  };

  const handleCancelAtomicExpenseDeletion = () => {
    if (!atomicPendingDeletion) return;
    Sound.click(settings.soundEnabled);
    setAtomicPendingDeletion(null);
  };

  const handleUndoDeleteExpense = () => {
    if (!expenseUndoToast) return;
    const { item, index } = expenseUndoToast;

    // Guard against duplicate insertion
    if (expenses.some((e) => e.id === item.id)) {
      setExpenseUndoToast(null);
      return;
    }

    const nextExpenses = [...expenses];
    const insertAt = Math.min(Math.max(0, index), nextExpenses.length);
    nextExpenses.splice(insertAt, 0, item);

    setExpenses(nextExpenses);
    Storage.setExpenses(nextExpenses);
    window.dispatchEvent(
      new CustomEvent('dashboard-data-updated', {
        detail: { module: 'expenses', updatedExpenses: nextExpenses },
      })
    );
    flushAutoSyncImmediately({
      ...Storage.getAllDataPayload(),
      expenses: nextExpenses,
    });
    Sound.complete(settings.soundEnabled);

    if (expenseUndoTimerRef.current) {
      clearTimeout(expenseUndoTimerRef.current);
    }
    setExpenseUndoToast(null);
  };

  const handleDeleteBatchExpenses = (ids: string[]) => {
    Sound.click(settings.soundEnabled);
    const idSet = new Set(ids);
    const updated = expenses.filter((e) => !idSet.has(e.id));
    setExpenses(updated);
    Storage.setExpenses(updated);
    window.dispatchEvent(
      new CustomEvent('dashboard-data-updated', {
        detail: { module: 'expenses', updatedExpenses: updated },
      })
    );
    flushAutoSyncImmediately({
      ...Storage.getAllDataPayload(),
      expenses: updated,
    });
  };

  const handleClearAllExpenses = () => {
    Sound.click(settings.soundEnabled);
    setExpenses([]);
    Storage.setExpenses([]);
    setExcelImportLogs([]);
    Storage.setExcelImportLogs([]);
    window.dispatchEvent(
      new CustomEvent('dashboard-data-updated', {
        detail: { module: 'expenses', updatedExpenses: [] },
      })
    );
    flushAutoSyncImmediately({
      ...Storage.getAllDataPayload(),
      expenses: [],
      excelImportLogs: [],
    });
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

  const handleUpdateProjects = (updatedProjects: PortfolioProject[]) => {
    setProjects(updatedProjects);
    Storage.setProjects(updatedProjects);
  };

  const handleUpdateSkills = (updatedSkills: SkillCategory[]) => {
    setSkills(updatedSkills);
    Storage.setSkills(updatedSkills);
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
      setExams(Storage.getExams());
      setSchedule(Storage.getSchedule());
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
    setExams(Storage.getExams());
    setSchedule(Storage.getSchedule());
  };

  const handleUpdateSchedule = (updatedSchedule: WeeklyScheduleData) => {
    setSchedule(updatedSchedule);
    Storage.setSchedule(updatedSchedule);
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
    } else if (view === 'todos' || view === 'todo' || view === 'tasks') {
      setActiveView('tasks');
    } else {
      setActiveView(view as MainNavView);
    }
    if (view === 'media' && tabOrFilter) {
      setMediaInitialTab(tabOrFilter);
    }

    // Force scroll to top event to ensure the target component is properly mounted and rendered
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        mainEl.scrollTop = 0;
      }
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      window.dispatchEvent(
        new CustomEvent('dashboard-navigate-scroll-top', {
          detail: { view, tabOrFilter },
        })
      );
    }
  };

  // Register unified voice command mapping handlers to real React state functions
  useEffect(() => {
    registerAppHandlers({
      onAddExpense: handleAddExpense,
      onAddTodo: handleAddTodo,
      onToggleTodo: handleToggleTodo,
      onAddHabit: handleAddHabit,
      onToggleHabit: (habitIdOrTitle: string) => {
        const target = habits.find(
          (h) => h.id === habitIdOrTitle || h.title.toLowerCase().includes(habitIdOrTitle.toLowerCase())
        );
        if (target) {
          const todayIndex = (new Date().getDay() + 6) % 7;
          handleToggleHabitDay(target.id, todayIndex);
        }
      },
      onNavigate: handleNavigate,
      onAddJournal: (title, content, mood, tags) => {
        handleAddJournalEntry(title, content, mood || '⚡', tags || ['Voice']);
      },
      onShowToast: (msg) => {
        console.log('[Voice Command Executed]', msg);
      },
    });
  }, [
    handleAddExpense,
    handleAddTodo,
    handleAddHabit,
    habits,
    handleToggleHabitDay,
    handleNavigate,
    handleAddJournalEntry,
  ]);

  interface NavItem {
    id: MainNavView;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    emoji?: string;
    group: 'top' | 'plan' | 'work' | 'life' | 'money' | 'private' | 'system';
    badge?: string;
  }

  const navItems: NavItem[] = [
    // Top Level
    { id: 'home', label: 'Home / Today', icon: Home, count: undefined, group: 'top' },
    { id: 'assistant', label: 'Zikenn AI', icon: Sparkles, count: undefined, group: 'top' },

    // PLAN
    { id: 'tasks', label: 'Tasks', icon: CheckSquare, count: todos.filter((t) => !t.completed).length, group: 'plan' },
    { id: 'habits', label: 'Habits', icon: Flame, count: habits.length, group: 'plan' },
    { id: 'goals', label: 'Goals', icon: Target, count: goals.filter((g) => g.status === 'active').length || undefined, group: 'plan' },
    { id: 'exams', label: 'Exams', icon: GraduationCap, count: exams.length, group: 'plan' },
    { id: 'timeline', label: 'Life Map', icon: Compass, count: milestones.length, group: 'plan' },

    // WORK
    { id: 'workfolio', label: 'Portfolio', icon: Briefcase, count: projects.length, group: 'work' },

    // LIFE
    { id: 'journal', label: 'Journal', icon: BookOpen, count: journal.length, group: 'life' },
    { id: 'quotes', label: 'Quotes', icon: Quote, count: quotes.length, group: 'life' },
    { id: 'media', label: 'Library', icon: Film, count: media.length, group: 'life' },

    // MONEY
    { id: 'expenses', label: 'Spending', icon: CreditCard, count: expenses.length, group: 'money' },

    // PRIVATE
    { id: 'vault', label: 'Vault', icon: Shield, count: vault.length, group: 'private' },
    { id: 'backup', label: 'Backup & Restore', icon: Database, count: undefined, group: 'private' },
  ];

  const currentNav = navItems.find((n) => n.id === activeView) || navItems[0];
  const isSidebarExpanded = !isSidebarCollapsed;

  if (!currentUser) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden bg-[#f8f7f2]">
        <LandingPage
          onSignIn={() => {
            setAuthInitialMode('signin');
            setIsAuthModalOpen(true);
          }}
          onSignUp={() => {
            setAuthInitialMode('signup');
            setIsAuthModalOpen(true);
          }}
          onGetStarted={() => {
            setAuthInitialMode('signup');
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
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#FBFBFA] dark:bg-[#0F172A] text-[#37352F] dark:text-white selection:bg-[#EEF2FF] selection:text-[#6366F1] dark:selection:bg-indigo-900/50 dark:selection:text-indigo-200 transition-colors duration-200 font-sans flex flex-col overflow-hidden">
      {isAndroidView ? (
        <AndroidShell
          activeView={activeView}
          onNavigate={handleNavigate}
          profile={profile}
          todos={todos}
          habits={habits}
          quotes={quotes}
          expenses={expenses}
          schedule={schedule}
          journal={journal}
          goals={goals}
          media={media}
          vault={vault}
          settings={settings}
          excelImportLogs={excelImportLogs}
          resume={resume}
          exams={exams}
          projects={projects}
          milestones={milestones}
          skills={skills}
          onToggleTodo={handleToggleTodo}
          onAddTodo={handleAddTodo}
          onUpdateTodo={handleUpdateTodo}
          onUpdateTaskStatus={handleUpdateTaskStatus}
          onDeleteTodo={handleDeleteTodo}
          onClearCompletedTodos={handleClearCompletedTodos}
          onAddExpense={handleAddExpense}
          onUpdateExpense={handleUpdateExpense}
          onBatchAddExpenses={handleBatchAddExpenses}
          onToggleExpense={handleToggleExpense}
          onDeleteExpense={handleDeleteExpense}
          onDeleteBatchExpenses={handleDeleteBatchExpenses}
          onDeleteImportLog={handleDeleteImportLog}
          onToggleHabitDay={handleToggleHabitDay}
          onAddHabit={handleAddHabit}
          onDeleteHabit={handleDeleteHabit}
          onResetHabitWeek={handleResetHabitWeek}
          onSimulateMondayRollover={handleSimulateMondayRollover}
          onToggleHistoricalHabitDay={handleToggleHistoricalHabitDay}
          onAddHistoricalHabit={handleAddHistoricalHabit}
          onDeleteHistoricalHabit={handleDeleteHistoricalHabit}
          habitHistory={habitHistory}
          habitActivities={habitActivities}
          onAddDiaryEntry={handleAddDiaryEntry}
          onDeleteDiaryEntry={handleDeleteJournalEntry}
          onAddQuote={handleAddQuote}
          onUpdateQuote={handleUpdateQuote}
          onDeleteQuote={handleDeleteQuote}
          onAddGoal={handleAddGoal}
          onUpdateGoal={handleUpdateGoal}
          onDeleteGoal={handleDeleteGoal}
          onUpdateExams={handleUpdateExams}
          onUpdateProfile={handleUpdateProfile}
          onUpdateProjects={handleUpdateProjects}
          onUpdateSkills={handleUpdateSkills}
          onUpdateResume={handleUpdateResume}
          onAddProject={handleAddProject}
          onDeleteProject={handleDeleteProject}
          onAddMedia={handleAddMedia}
          onUpdateMediaRating={handleUpdateMediaRating}
          onDeleteMedia={handleDeleteMedia}
          onAddVaultSecret={handleAddVaultSecret}
          onDeleteVaultSecret={handleDeleteVaultSecret}
          onExportData={handleExportData}
          onImportData={handleImportData}
          onResetData={handleResetData}
          onOpenSearch={() => setIsCommandPaletteOpen(true)}
          onOpenProfile={() => setIsSettingsOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleDarkMode={handleToggleDarkMode}
          onToggleSound={handleToggleSound}
          onRefresh={() => {
            scheduleAutoSyncToSupabase(() => Storage.getAllDataPayload(), 50);
          }}
        />
      ) : (
        <div className="w-full h-full bg-white dark:bg-[#0F172A] flex flex-col overflow-hidden">
        {/* ===================================================================== */}
        {/* 1. TOP GLOBAL NAVIGATION HEADER */}
        {/* ===================================================================== */}
        <header className="px-3 sm:px-4 py-2 border-b border-[#EDECE9] dark:border-[#1E293B] bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-md flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 z-30 sticky top-0">
          {/* Left: Sidebar Toggle, Mobile Menu & Notion Breadcrumb Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
            {/* Desktop Sidebar Toggle Button */}
            <motion.button
              type="button"
              id="btn-desktop-sidebar-toggle"
              onClick={handleToggleSidebar}
              whileTap={{ scale: 0.92 }}
              className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-[#787774] dark:text-[#9CA3AF] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937] hover:text-[#37352F] dark:hover:text-white cursor-pointer transition-colors shrink-0"
              title={!isSidebarCollapsed ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
            >
              <motion.div
                animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}
                transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                className="flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </motion.div>
            </motion.button>

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
                <currentNav.icon className="w-3.5 h-3.5 shrink-0 text-[#6366F1] dark:text-[#818CF8]" />
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

            {/* Profile Menu: Account settings, Change Password & Sign out */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsAccountMenuOpen((open) => !open)}
                className="w-7 h-7 rounded-lg overflow-hidden border border-[#EDECE9] dark:border-[#374151] cursor-pointer hover:ring-2 hover:ring-[#6366F1] transition-all shrink-0 bg-purple-50 dark:bg-purple-950/40 flex items-center justify-center text-xs font-bold text-purple-600 dark:text-purple-300"
                title="Account menu"
                aria-label="Account menu"
              >
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt="Account"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = STOCK_IMAGES.avatar;
                    }}
                  />
                ) : (
                  <span>{(profile.name || currentUser?.name || 'U').charAt(0).toUpperCase()}</span>
                )}
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

                    {/* Change Profile Picture */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsGlobalAvatarPickerOpen(true);
                      }}
                      className="account-menu-item flex items-center gap-2 w-full text-left font-medium text-[#111827] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors cursor-pointer text-xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#6366F1] dark:text-[#818CF8]" />
                      <span>Change profile picture</span>
                    </button>

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

                    {/* Personal AI API Keys (Gemini & Groq) */}
                    <button
                      type="button"
                      id="profile-menu-ai-keys-btn"
                      onClick={() => {
                        setIsAccountMenuOpen(false);
                        setIsApiKeyModalOpen(true);
                      }}
                      className="account-menu-item flex items-center justify-between w-full text-left font-medium text-[#111827] dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-2 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                        <span>AI API Keys (Gemini &amp; Groq)</span>
                      </div>
                      {Boolean(Storage.getGeminiApiKey() || Storage.getGroqApiKey()) ? (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          Set Keys
                        </span>
                      )}
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
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Desktop Left Sidebar: Pinned Home/Today at top, categorized nav, Collapse button at bottom */}
          <motion.aside
            initial={false}
            animate={{
              width: isSidebarCollapsed ? 68 : 240,
            }}
            transition={{
              type: 'spring',
              stiffness: 380,
              damping: 32,
              mass: 0.8,
            }}
            className="hidden md:flex h-full bg-[#F7F7F5] dark:bg-[#111827] border-r border-[#EDECE9] dark:border-[#1E293B] flex-col justify-between shrink-0 select-none z-20 overflow-y-auto overflow-x-hidden p-3"
          >
            <div className="space-y-4 w-full">
              {/* App Brand Header */}
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="flex items-center gap-2.5 px-1 py-1 text-left cursor-pointer hover:opacity-80 transition-opacity w-full overflow-hidden"
                title="Personal Dashboard Home"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center font-black text-sm shadow-xs shrink-0">
                  ✨
                </div>
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, x: -8, width: 0 }}
                      animate={{ opacity: 1, x: 0, width: 'auto' }}
                      exit={{ opacity: 0, x: -8, width: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
                    >
                      <span className="text-base font-extrabold text-[#37352F] dark:text-white tracking-tight block truncate">
                        Personal Dashboard
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

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
                        className={`w-full flex items-center rounded-xl text-xs font-semibold transition-colors cursor-pointer px-2.5 py-2 overflow-hidden ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-bold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                          }`} />
                        </div>
                        <AnimatePresence initial={false}>
                          {!isSidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: 'auto' }}
                              exit={{ opacity: 0, x: -6, width: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="flex items-center justify-between min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap"
                            >
                              <span className="truncate">{item.label}</span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: PLAN */}
              <div className="space-y-1 w-full">
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block py-0.5">
                        PLAN
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {navItems
                  .filter((i) => i.group === 'plan')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 overflow-hidden ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                          }`} />
                        </div>
                        <AnimatePresence initial={false}>
                          {!isSidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: 'auto' }}
                              exit={{ opacity: 0, x: -6, width: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="flex items-center justify-between min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap"
                            >
                              <span className="truncate">{item.label}</span>
                              {item.badge && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-[#EEF2FF] dark:bg-[#312E81] text-[#6366F1] dark:text-[#A5B4FC] shrink-0 ml-1.5">
                                  {item.badge}
                                </span>
                              )}
                              {item.count !== undefined && !item.badge && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151] shrink-0 ml-1.5">
                                  {item.count}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: LIFE */}
              <div className="space-y-1 w-full">
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block py-0.5">
                        LIFE
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {navItems
                  .filter((i) => i.group === 'life')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 overflow-hidden ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                          }`} />
                        </div>
                        <AnimatePresence initial={false}>
                          {!isSidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: 'auto' }}
                              exit={{ opacity: 0, x: -6, width: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="flex items-center justify-between min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap"
                            >
                              <span className="truncate">{item.label}</span>
                              {item.count !== undefined && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151] shrink-0 ml-1.5">
                                  {item.count}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: WORKFOLIO */}
              <div className="space-y-1 w-full">
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block py-0.5">
                        WORKFOLIO
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {navItems
                  .filter((i) => i.group === 'work')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 overflow-hidden ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                          }`} />
                        </div>
                        <AnimatePresence initial={false}>
                          {!isSidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: 'auto' }}
                              exit={{ opacity: 0, x: -6, width: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="flex items-center justify-between min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap"
                            >
                              <span className="truncate">{item.label}</span>
                              {item.count !== undefined && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151] shrink-0 ml-1.5">
                                  {item.count}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: MONEY */}
              <div className="space-y-1 w-full">
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block py-0.5">
                        MONEY
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {navItems
                  .filter((i) => i.group === 'money')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 overflow-hidden ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                          }`} />
                        </div>
                        <AnimatePresence initial={false}>
                          {!isSidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: 'auto' }}
                              exit={{ opacity: 0, x: -6, width: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="flex items-center justify-between min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap"
                            >
                              <span className="truncate">{item.label}</span>
                              {item.count !== undefined && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151] shrink-0 ml-1.5">
                                  {item.count}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
              </div>

              {/* GROUP: PRIVATE */}
              <div className="space-y-1 w-full">
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <span className="text-[10px] uppercase font-bold text-[#787774] dark:text-[#9CA3AF] tracking-wider px-2 block py-0.5">
                        PRIVATE
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                {navItems
                  .filter((i) => i.group === 'private')
                  .map((item) => {
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full flex items-center rounded-xl text-xs font-medium transition-colors cursor-pointer px-2.5 py-1.5 overflow-hidden ${
                          isActive
                            ? 'bg-[#EEF2FF] dark:bg-[#1E1B4B] text-[#6366F1] dark:text-[#818CF8] font-semibold shadow-2xs border border-[#C7D2FE] dark:border-[#374151]'
                            : 'text-[#37352F] dark:text-[#D1D5DB] hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50'
                        }`}
                        title={item.label}
                      >
                        <div className="w-5 h-5 flex items-center justify-center shrink-0">
                          <item.icon className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                          }`} />
                        </div>
                        <AnimatePresence initial={false}>
                          {!isSidebarCollapsed && (
                            <motion.div
                              initial={{ opacity: 0, x: -6, width: 0 }}
                              animate={{ opacity: 1, x: 0, width: 'auto' }}
                              exit={{ opacity: 0, x: -6, width: 0 }}
                              transition={{ duration: 0.18, ease: 'easeInOut' }}
                              className="flex items-center justify-between min-w-0 flex-1 ml-2.5 overflow-hidden whitespace-nowrap"
                            >
                              <span className="truncate">{item.label}</span>
                              {item.count !== undefined && (
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white dark:bg-[#111827] text-[#787774] dark:text-[#9CA3AF] border border-[#EDECE9] dark:border-[#374151] shrink-0 ml-1.5">
                                  {item.count}
                                </span>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Sidebar Footer: Dedicated Collapse Toggle Button */}
            <div className="pt-3 border-t border-[#EDECE9] dark:border-[#1F2937] w-full">
              <motion.button
                type="button"
                id="btn-sidebar-collapse-toggle"
                onClick={handleToggleSidebar}
                whileTap={{ scale: 0.96 }}
                className="w-full flex items-center rounded-xl text-xs font-medium text-[#787774] dark:text-[#9CA3AF] hover:text-[#37352F] dark:hover:text-white hover:bg-[#F1F1EF] dark:hover:bg-[#1F2937]/50 transition-colors cursor-pointer px-2.5 py-2 overflow-hidden"
                title={!isSidebarCollapsed ? 'Collapse sidebar (⌘\\)' : 'Expand sidebar (⌘\\)'}
              >
                <div className="w-5 h-5 flex items-center justify-center shrink-0">
                  <motion.div
                    animate={{ rotate: isSidebarCollapsed ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                    className="flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4 stroke-[2]" />
                  </motion.div>
                </div>
                <AnimatePresence initial={false}>
                  {!isSidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -6, width: 0 }}
                      animate={{ opacity: 1, x: 0, width: 'auto' }}
                      exit={{ opacity: 0, x: -6, width: 0 }}
                      transition={{ duration: 0.18, ease: 'easeInOut' }}
                      className="ml-2.5 overflow-hidden whitespace-nowrap font-medium text-[#787774] dark:text-[#9CA3AF]"
                    >
                      Collapse
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          </motion.aside>

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
                            <item.icon className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-[#6366F1] dark:text-[#818CF8]' : 'text-[#787774] dark:text-[#9CA3AF]'
                            }`} />
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
          <main ref={mainScrollRef} className="flex-1 h-full overflow-y-auto min-h-0 workspace-canvas bg-white dark:bg-[#0F172A] p-2 sm:p-4 lg:p-6">
            <div className="max-w-6xl mx-auto space-y-4 pb-12">
              {/* Global API Monthly Threshold Warning Notification Banner */}
              {apiThresholdWarning && (
                <div
                  id="api-threshold-global-warning-banner"
                  className={`p-3 sm:px-4 rounded-xl border flex items-center justify-between gap-3 shadow-2xs transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                    apiThresholdWarning.level === 'limit_reached'
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-100'
                      : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        apiThresholdWarning.level === 'limit_reached'
                          ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-600 dark:text-rose-300'
                          : 'bg-amber-100 dark:bg-amber-900/80 text-amber-600 dark:text-amber-300'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div className="text-xs leading-tight min-w-0">
                      <span className="font-bold">
                        {apiThresholdWarning.level === 'limit_reached'
                          ? 'Monthly API Limit Reached: '
                          : 'Approaching Monthly API Limit: '}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        You have consumed {apiThresholdWarning.current} of your {apiThresholdWarning.limit} requests ({apiThresholdWarning.percent}%).
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      id="manage-api-threshold-btn"
                      onClick={() => setIsApiKeyModalOpen(true)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer shadow-2xs ${
                        apiThresholdWarning.level === 'limit_reached'
                          ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                          : 'bg-amber-600 text-white border-amber-700 hover:bg-amber-700'
                      }`}
                    >
                      Manage Limit
                    </button>
                    <button
                      type="button"
                      id="dismiss-api-threshold-warning-btn"
                      onClick={() => setApiThresholdWarning(null)}
                      className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer transition-colors"
                      title="Dismiss warning"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeView}
                  variants={pageTransitionVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  className="w-full space-y-4"
                >
                  {/* Universal Return to Dashboard Shortcut for all sub-views */}
                  {activeView !== 'home' && (
                    <div className="pt-2 pb-1.5 print:hidden">
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#F7F7F5] dark:bg-[#1F2937] border border-[#EDECE9] dark:border-[#374151] shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleNavigate('home')}
                          className="flex items-center gap-2.5 text-xs text-[#6366F1] dark:text-[#818CF8] hover:text-[#4F46E5] dark:hover:text-[#A5B4FC] font-semibold cursor-pointer group transition-colors"
                        >
                          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                          <span>Return to Home / Today</span>
                        </button>
                        <span className="flex items-center gap-2 text-xs font-medium text-[#787774] dark:text-[#9CA3AF]">
                          <span className="text-sm">{currentNav.emoji}</span>
                          <span className="font-semibold text-[#37352F] dark:text-white">{currentNav.label}</span>
                        </span>
                      </div>
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
                  schedule={schedule}
                  onUpdateSchedule={handleUpdateSchedule}
                  soundEnabled={settings.soundEnabled}
                  onOpenZikennPopup={() => setIsZikennPopupOpen(true)}
                />
              )}

              {/* VIEW: Personalized Zikenn AI */}
              {activeView === 'assistant' && (
                <AIAssistantView
                  activeView={activeView}
                  onNavigate={handleNavigate}
                  onOpenCommandMappings={() => setIsCommandMappingModalOpen(true)}
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
                  onUpdateProjects={handleUpdateProjects}
                  onUpdateSkills={handleUpdateSkills}
                  onUpdateResume={handleUpdateResume}
                  onAddProject={handleAddProject}
                  onDeleteProject={handleDeleteProject}
                  onNavigate={handleNavigate}
                  soundEnabled={settings.soundEnabled}
                />
              )}

              {/* VIEW 2: Tasks Notion Kanban Board */}
              {(activeView === 'tasks' || (activeView as string) === 'todos' || (activeView as string) === 'todo') && (
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
                    habitHistory={habitHistory}
                    habitActivities={habitActivities}
                    onToggleHabitDay={handleToggleHabitDay}
                    onAddHabit={handleAddHabit}
                    onDeleteHabit={handleDeleteHabit}
                    onResetWeek={handleResetHabitWeek}
                    onSimulateMondayRollover={handleSimulateMondayRollover}
                    onToggleHistoricalHabitDay={handleToggleHistoricalHabitDay}
                    onAddHistoricalHabit={handleAddHistoricalHabit}
                    onDeleteHistoricalHabit={handleDeleteHistoricalHabit}
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
                  importLogs={excelImportLogs}
                  onAddExpense={handleAddExpense}
                  onUpdateExpense={handleUpdateExpense}
                  onBatchAddExpenses={handleBatchAddExpenses}
                  onToggleActive={handleToggleExpense}
                  onDeleteExpense={handleDeleteExpense}
                  onDeleteBatchExpenses={handleDeleteBatchExpenses}
                  onDeleteImportLog={handleDeleteImportLog}
                  onClearAllExpenses={handleClearAllExpenses}
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
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
      )}

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
        avatarUrl={profile.avatarUrl}
        onOpenAvatarPicker={() => setIsGlobalAvatarPickerOpen(true)}
        onSignOut={handleSignOut}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenCommandMappings={() => setIsCommandMappingModalOpen(true)}
        onOpenSmsSettings={() => setIsSmsModalOpen(true)}
      />

      {/* Android SMS Expense Auto-Logger Modal */}
      <SmsExpenseModal
        isOpen={isSmsModalOpen}
        onClose={() => setIsSmsModalOpen(false)}
        soundEnabled={settings.soundEnabled}
      />

      {/* Personal AI API Keys Modal (Per-User Isolated) */}
      <ApiKeySettingsModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        currentUser={currentUser}
        profile={profile}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
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

      {/* Global Profile Photo / Avatar Picker Modal */}
      <AvatarPickerModal
        isOpen={isGlobalAvatarPickerOpen}
        onClose={() => setIsGlobalAvatarPickerOpen(false)}
        currentAvatarUrl={profile.avatarUrl}
        onSelectAvatar={(newUrl) => {
          handleUpdateProfile({
            ...profile,
            avatarUrl: newUrl,
          });
        }}
        soundEnabled={settings.soundEnabled}
        userId={currentUser?.email || profile.contactEmail}
      />

      {/* Floating Bottom-Right Popup: Personalized Zikenn AI */}
      {isZikennPopupOpen && (
        <aside
          id="zikenn-ai-popup"
          role="dialog"
          aria-label="Personalized Zikenn AI Chat"
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[440px] md:w-[460px] h-[580px] max-h-[82vh] rounded-2xl shadow-2xl border border-[#E5E5E2] dark:border-[#334155] overflow-hidden bg-white dark:bg-[#1E293B] flex flex-col animate-in fade-in slide-in-from-bottom-5 duration-200"
        >
          <AISecretaryWidget
            isPopup={true}
            activeView={activeView}
            onClosePopup={() => setIsZikennPopupOpen(false)}
            onNavigate={(view, tabOrFilter) => {
              setIsZikennPopupOpen(false);
              handleNavigate(view, tabOrFilter);
            }}
            onOpenCommandMappings={() => setIsCommandMappingModalOpen(true)}
          />
        </aside>
      )}

      {/* Floating Action Buttons: Live Voice Assist & Zikenn AI (Desktop only - hidden on Android) */}
      {!isAndroidView && !isZikennPopupOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
          {/* Dedicated Live Voice Assist Button with Framer Motion Waveform Visualizer */}
          <button
            type="button"
            id="floating-voice-assist-fab"
            onClick={() => {
              Sound.click(settings.soundEnabled);
              setIsGlobalVoiceModalOpen(true);
            }}
            className={`h-14 px-4 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer group focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800 flex items-center gap-2.5 border ${
              isGlobalVoiceActive || isGlobalVoiceModalOpen
                ? 'ring-4 ring-cyan-400/80 shadow-cyan-500/50 border-cyan-300'
                : 'border-white/20 dark:border-indigo-400/40 hover:shadow-indigo-500/30'
            }`}
            title={
              isGlobalVoiceActive || isGlobalVoiceModalOpen
                ? 'Gemini Live actively listening — click to open controls'
                : 'Launch Real-Time Gemini 3.8 Live Voice Assist'
            }
            aria-label="Open Voice Assistant"
          >
            {isGlobalVoiceActive || isGlobalVoiceModalOpen ? (
              <div className="flex items-center gap-2">
                {/* Framer Motion Waveform Visualizer indicating active listening or command processed */}
                <WaveformVisualizer
                  isActive={true}
                  barCount={5}
                  size="sm"
                  colorTheme={isVoiceCommandProcessed ? 'emerald' : 'cyan'}
                  isProcessed={isVoiceCommandProcessed}
                />
                {isVoiceCommandProcessed ? (
                  <span className="text-xs font-bold text-emerald-300 tracking-wide flex items-center gap-1.5 animate-in fade-in">
                    ✓ Executed
                  </span>
                ) : (
                  <span className="text-xs font-bold text-cyan-200 tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-300 animate-ping inline-block" />
                    Listening
                  </span>
                )}
              </div>
            ) : (
              <>
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
                </span>
                <Mic className="w-5 h-5 text-white animate-pulse" />
                <span className="hidden sm:inline text-xs font-bold tracking-wide">
                  Voice Assist
                </span>
              </>
            )}
          </button>

          {/* Floating Round Action Button for Zikenn AI (Chat Widget) */}
          <button
            type="button"
            id="floating-zikenn-ai-fab"
            onClick={() => {
              Sound.click(settings.soundEnabled);
              setIsZikennPopupOpen(true);
            }}
            className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-xl hover:shadow-2xl hover:shadow-indigo-500/30 border border-white/20 dark:border-indigo-400/40 flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 cursor-pointer group focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-800"
            title="Chat with Personalized Zikenn AI"
            aria-label="Open Zikenn AI"
          >
            <Sparkles className="w-6 h-6 text-white group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>
      )}

      {/* Global Gemini 3.8 Live Voice Modal */}
      <GeminiLiveVoiceModal
        isOpen={isGlobalVoiceModalOpen}
        onClose={() => setIsGlobalVoiceModalOpen(false)}
        onNavigate={handleNavigate}
        activeView={activeView}
        onListeningChange={handleVoiceListeningChange}
        onCommandExecuted={handleVoiceCommandExecuted}
        onOpenCommandMappings={() => setIsCommandMappingModalOpen(true)}
      />

      {/* Voice Command Mapping & Custom Triggers Modal */}
      <CommandMappingModal
        isOpen={isCommandMappingModalOpen}
        onClose={() => setIsCommandMappingModalOpen(false)}
        onNavigate={handleNavigate}
      />

      {/* Floating Toast Notification with Undo for Deleted Expense */}
      {expenseUndoToast && (
        <aside
          id="expense-undo-toast"
          role="status"
          aria-live="polite"
          className="fixed bottom-22 right-6 sm:bottom-24 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-2xl text-xs font-semibold border border-gray-800 dark:border-gray-200 animate-in fade-in slide-in-from-bottom-5 duration-200 max-w-[calc(100vw-2rem)] sm:max-w-md"
        >
          <div className="w-7 h-7 rounded-xl bg-rose-500/20 text-rose-400 dark:text-rose-600 flex items-center justify-center shrink-0">
            <Trash2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0 flex-1 truncate">
            <span className="font-bold">Deleted </span>
            <span className="text-gray-300 dark:text-gray-700">
              &quot;{expenseUndoToast.item.name}&quot; (₹{Number(expenseUndoToast.item.amount).toLocaleString()})
            </span>
          </div>
          <button
            type="button"
            id="expense-undo-button"
            onClick={handleUndoDeleteExpense}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all shadow-xs hover:shadow-sm active:scale-95"
            title="Restore deleted expense"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            id="expense-undo-close-button"
            onClick={() => {
              if (expenseUndoTimerRef.current) {
                clearTimeout(expenseUndoTimerRef.current);
              }
              setExpenseUndoToast(null);
            }}
            className="shrink-0 p-1 text-gray-400 hover:text-white dark:hover:text-gray-900 transition-colors rounded-lg cursor-pointer"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </aside>
      )}

      {/* Atomic Locked Confirmation Dialog for Expense Deletion */}
      {atomicPendingDeletion && (
        <div
          id="atomic-expense-deletion-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="atomic-deletion-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 shadow-2xl p-6 overflow-hidden">
            {/* Locked indicator badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-800/60">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Locked Transaction</span>
              </div>
              <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500">
                {atomicPendingDeletion.transactionId.slice(0, 14)}
              </span>
            </div>

            <h3
              id="atomic-deletion-title"
              className="text-base font-bold text-gray-900 dark:text-white mb-2"
            >
              Confirm {atomicPendingDeletion.isMultiple ? 'Multi-Record' : 'Expense'} Deletion
            </h3>

            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
              {atomicPendingDeletion.isMultiple
                ? `You are about to delete ${atomicPendingDeletion.items.length} expense records. The application is locked in an atomic pending state until this specific transaction is approved or canceled.`
                : `Are you sure you want to delete this expense record? The transaction is locked in an atomic pending state.`}
            </p>

            {/* List of items in atomic transaction */}
            <div className="max-h-48 overflow-y-auto mb-5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-700/60">
              {atomicPendingDeletion.items.map((item) => (
                <div key={item.id} className="py-2 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">
                      {item.category} • {item.date}
                    </p>
                  </div>
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">
                    ₹{Number(item.amount).toLocaleString()}
                  </span>
                </div>
              ))}
              {atomicPendingDeletion.isMultiple && (
                <div className="pt-2.5 flex items-center justify-between text-xs font-bold text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700">
                  <span>Total Amount</span>
                  <span className="text-rose-600 dark:text-rose-400">
                    ₹{atomicPendingDeletion.totalAmount.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="cancel-atomic-expense-deletion"
                onClick={handleCancelAtomicExpenseDeletion}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-atomic-expense-deletion"
                onClick={handleApproveAtomicExpenseDeletion}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {atomicPendingDeletion.isMultiple
                    ? `Delete ${atomicPendingDeletion.items.length} Records`
                    : 'Delete Record'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
