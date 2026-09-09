import {
  TodoItem,
  HabitItem,
  GoalItem,
  VaultCredential,
  ExpenseItem,
  JournalEntry,
  MediaItem,
  AchievementItem,
  DoodleItem,
  LifeMilestone,
  PortfolioProject,
  SkillCategory,
  UserProfile,
  AppSettings,
  DashboardSection,
  ResumeDocument,
  QuoteItem,
  EducationRecord,
  JobExperience,
  HobbyItem,
  ExamItem,
} from '../types';
import { STOCK_IMAGES } from '../assets/stockImages';
import { decryptJson, encryptJson, isEncryptedPayload, EncryptedPayload } from './crypto';
import { INITIAL_USER_EXAMS } from '../data/defaultExams';

const STORAGE_KEYS = {
  TODOS: 'notion_os_v4_todos',
  HABITS: 'notion_os_v4_habits',
  GOALS: 'notion_os_v4_goals',
  VAULT: 'notion_os_v4_vault',
  EXPENSES: 'notion_os_v4_expenses',
  JOURNAL: 'notion_os_v4_journal',
  MEDIA: 'notion_os_v4_media',
  ACHIEVEMENTS: 'notion_os_v4_achievements',
  DOODLES: 'notion_os_v4_doodles',
  TIMELINE: 'notion_os_v4_timeline',
  PROJECTS: 'notion_os_v4_projects',
  SKILLS: 'notion_os_v4_skills',
  PROFILE: 'notion_os_v4_profile',
  SETTINGS: 'notion_os_v4_settings',
  SECTIONS: 'notion_os_v4_sections',
  PHOTOS: 'notion_os_v4_photos',
  RESUME: 'notion_os_v4_resume',
  QUOTES: 'notion_os_v4_quotes',
  EXAMS: 'notion_os_v5_my_exams',
};

export const INITIAL_EDUCATION_RECORDS: EducationRecord[] = [];

export const INITIAL_JOB_EXPERIENCES: JobExperience[] = [];

export const INITIAL_HOBBIES: HobbyItem[] = [];

export const INITIAL_CERTIFICATIONS: Array<{ id: string; name: string; issuer: string; year: string; link?: string }> = [];

export const INITIAL_LANGUAGES: Array<{ id: string; name: string; proficiency: string }> = [];

// Clean Base User Profile for any new user
export const INITIAL_PROFILE: UserProfile = {
  name: '',
  caption: '',
  handle: '',
  title: '',
  bio: '',
  location: '',
  statusText: '',
  statusEmoji: '✨',
  avatarUrl: STOCK_IMAGES.avatar,
  avatarEnabled: false,
  bannerType: 'gradient',
  bannerBg: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #FDF4FF 100%)',
  staticCoverImage: STOCK_IMAGES.workspaceCover,
  coverImageEnabled: true,
  contactEmail: '',
  phone: '',
  github: '',
  linkedin: '',
  twitter: '',
  website: '',
  resumeAvailable: false,
  services: [],
  tools: [],
  educationRecords: [],
  jobExperiences: [],
  hobbies: [],
  certifications: [],
  languages: [],
  professionalSummary: '',
  careerObjective: '',
  availabilityStatus: 'Open to opportunities',
  yearsOfExperience: '',
  currentCompany: '',
  currentDesignation: '',
};

// Empty Clean State Collections (No fake/mock data for new accounts)
export const INITIAL_TODOS: TodoItem[] = [];
export const INITIAL_HABITS: HabitItem[] = [];
export const INITIAL_GOALS: GoalItem[] = [];
export const INITIAL_VAULT: VaultCredential[] = [];

let vaultCache: VaultCredential[] = [];

const getVaultStorageKey = () => getScopedKey(STORAGE_KEYS.VAULT);
export const INITIAL_EXPENSES: ExpenseItem[] = [];
export const INITIAL_JOURNAL: JournalEntry[] = [];
export const INITIAL_MEDIA: MediaItem[] = [];
export const INITIAL_ACHIEVEMENTS: AchievementItem[] = [];
export const INITIAL_TIMELINE: LifeMilestone[] = [];
export const INITIAL_PROJECTS: PortfolioProject[] = [];
export const INITIAL_SKILLS: SkillCategory[] = [];

// Rich Curated Quotes Collection (Consistent across Quotes Section and Dashboard)
export const INITIAL_QUOTES: QuoteItem[] = [
  {
    id: 'q-1',
    text: 'Small daily improvements over time lead to stunning results.',
    author: 'Robin Sharma',
    category: 'Growth',
    createdAt: Date.now() - 1000000,
  },
  {
    id: 'q-2',
    text: 'Discipline is the bridge between goals and accomplishment.',
    author: 'Jim Rohn',
    category: 'Discipline',
    createdAt: Date.now() - 900000,
  },
  {
    id: 'q-3',
    text: 'Focus on being productive instead of busy.',
    author: 'Tim Ferriss',
    category: 'Productivity',
    createdAt: Date.now() - 800000,
  },
  {
    id: 'q-4',
    text: 'You do not rise to the level of your goals. You fall to the level of your systems.',
    author: 'James Clear',
    category: 'Systems',
    createdAt: Date.now() - 700000,
  },
  {
    id: 'q-5',
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
    category: 'Action',
    createdAt: Date.now() - 600000,
  },
  {
    id: 'q-6',
    text: 'Simplicity is the prerequisite for reliability.',
    author: 'Edsger W. Dijkstra',
    category: 'Engineering',
    createdAt: Date.now() - 500000,
  },
  {
    id: 'q-7',
    text: 'First, solve the problem. Then, write the code.',
    author: 'John Johnson',
    category: 'Coding',
    createdAt: Date.now() - 400000,
  },
  {
    id: 'q-8',
    text: 'Consistency is the DNA of mastery.',
    author: 'Robin Sharma',
    category: 'Mastery',
    createdAt: Date.now() - 300000,
  },
  {
    id: 'q-9',
    text: 'It always seems impossible until it is done.',
    author: 'Nelson Mandela',
    category: 'Inspiration',
    createdAt: Date.now() - 200000,
  },
  {
    id: 'q-10',
    text: 'The best way to predict the future is to create it.',
    author: 'Peter Drucker',
    category: 'Vision',
    createdAt: Date.now() - 100000,
  },
];

// Demo Mock Data for the test account.
export const DEMO_TODOS: TodoItem[] = [
  {
    id: 'td-1',
    title: 'Review LifeOS real-time synchronization & mobile UI',
    completed: true,
    status: 'complete',
    priority: 'urgent',
    category: 'Tech',
    dueDate: new Date().toISOString().split('T')[0],
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'td-2',
    title: 'Architect distributed database indexing schema',
    completed: false,
    status: 'in_progress',
    priority: 'high',
    category: 'Engineering',
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    createdAt: Date.now() - 43200000,
  },
  {
    id: 'td-3',
    title: 'Prepare quarterly engineering milestones & roadmap',
    completed: false,
    status: 'todo',
    priority: 'medium',
    category: 'Career',
    dueDate: new Date(Date.now() + 172800000).toISOString().split('T')[0],
    createdAt: Date.now() - 21600000,
  },
];

export const DEMO_HABITS: HabitItem[] = [
  {
    id: 'hb-1',
    title: 'Deep Focus Coding',
    category: 'Work',
    icon: '⚡',
    completedDays: [true, true, true, true, true, false, false],
    streak: 12,
    color: '#6366F1',
  },
  {
    id: 'hb-2',
    title: 'Daily Workout & Cardio',
    category: 'Health',
    icon: '🏃',
    completedDays: [true, true, false, true, true, true, false],
    streak: 7,
    color: '#10B981',
  },
  {
    id: 'hb-3',
    title: 'Evening Tech Reading',
    category: 'Growth',
    icon: '📚',
    completedDays: [true, true, true, true, false, false, false],
    streak: 5,
    color: '#F59E0B',
  },
];

export const DEMO_EXPENSES: ExpenseItem[] = [
  {
    id: 'exp-1',
    name: 'Grocery & Nutrition Mart',
    amount: 350,
    category: 'Groceries & Food',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Credit Card',
  },
  {
    id: 'exp-2',
    name: 'Metro Transit Pass',
    amount: 120,
    category: 'Taxi & Transit',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Apple / Google Pay',
  },
  {
    id: 'exp-3',
    name: 'Cloud Server & Dev Hosting',
    amount: 240,
    category: 'Tech & Subscriptions',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    paymentMethod: 'Credit Card',
  },
  {
    id: 'exp-4',
    name: 'Coffee & Team Refreshments',
    amount: 95,
    category: 'Snacks & Coffee',
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    paymentMethod: 'Debit Card',
  },
];

export const DEMO_JOURNAL: JournalEntry[] = [
  {
    id: 'jr-1',
    date: new Date().toISOString().split('T')[0],
    timestamp: Date.now() - 3600000,
    mood: '🚀',
    moodLabel: 'Productive',
    title: 'Workspace Architecture & System Flow',
    content: 'Great progress today on engineering intuitive cross-device experiences. Clean state isolation and reliable data persistence make the workflow feel instantaneous.',
    tags: ['Architecture', 'Engineering', 'Focus'],
    theme: 'parchment',
    weather: '☀️ Sunny',
    energyLevel: 5,
  },
];

export const DEMO_TIMELINE: LifeMilestone[] = [
  {
    id: 'ms-1',
    year: 2024,
    dateStr: '2024 - Present',
    title: 'Software Engineer at HCL Software',
    description: 'Engineering scalable enterprise systems, modern microservices, and high-performance digital tools.',
    category: 'Career',
    icon: 'Briefcase',
    highlight: true,
  },
  {
    id: 'ms-2',
    year: 2023,
    dateStr: '2023',
    title: 'Full-Stack Architecture & Cloud Specialization',
    description: 'Developed modern cloud-native distributed tooling and reactive frontends.',
    category: 'Project',
    icon: 'Code',
  },
  {
    id: 'ms-3',
    year: 2022,
    dateStr: '2018 - 2022',
    title: 'B.Tech in Computer Science & Engineering',
    description: 'Graduated with First Class Distinction in Computer Science & Software Systems.',
    category: 'Education',
    icon: 'GraduationCap',
  },
];

export const DEMO_PROJECTS: PortfolioProject[] = [
  {
    id: 'proj-1',
    title: 'Workfolio LifeOS Cloud Workspace',
    tagLine: 'Personal productivity & portfolio operating system',
    description: 'Comprehensive personal operating system with real-time sync, journal, timeline, expense tracking, and resume builder.',
    techStack: ['React', 'TypeScript', 'Tailwind', 'Supabase'],
    category: 'Fullstack',
    featured: true,
  },
  {
    id: 'proj-2',
    title: 'Realtime Data Streaming Pipeline',
    tagLine: 'High-throughput event aggregation architecture',
    description: 'Distributed pub/sub engine with sub-50ms message latency and live dashboard telemetry.',
    techStack: ['TypeScript', 'Node.js', 'PostgreSQL', 'WebSockets'],
    category: 'Systems',
    featured: true,
  },
];

export const DEMO_SKILLS: SkillCategory[] = [
  {
    category: 'Languages & Frameworks',
    skills: [
      { name: 'TypeScript', level: 95, experience: '3+ yrs', highlight: true },
      { name: 'React.js', level: 92, experience: '3+ yrs', highlight: true },
      { name: 'Node.js', level: 88, experience: '2+ yrs', highlight: true },
      { name: 'Tailwind CSS', level: 95, experience: '3+ yrs', highlight: false },
    ],
  },
  {
    category: 'Cloud & Database',
    skills: [
      { name: 'PostgreSQL', level: 85, experience: '2+ yrs', highlight: true },
      { name: 'Supabase', level: 90, experience: '2+ yrs', highlight: true },
      { name: 'REST APIs', level: 92, experience: '3+ yrs', highlight: false },
    ],
  },
];

export const INITIAL_PHOTOS = [
  {
    id: 'ph-1',
    url: STOCK_IMAGES.workspaceCover,
    title: 'Minimalist Engineering Studio',
    subtitle: 'Workspace & Focus',
    tag: 'Deep Work',
  },
  {
    id: 'ph-2',
    url: STOCK_IMAGES.mountainsCover,
    title: 'Alpine Sunrise & Dawn Valley',
    subtitle: 'Nature & Atmosphere',
    tag: 'Calm',
  },
  {
    id: 'ph-3',
    url: STOCK_IMAGES.bambooGardenCover,
    title: 'Zen Japanese Bamboo Grove',
    subtitle: 'Mindfulness & Harmony',
    tag: 'Zen Garden',
  },
  {
    id: 'ph-4',
    url: STOCK_IMAGES.architectureCover,
    title: 'Clean Travertine Architecture',
    subtitle: 'Geometry & Minimalism',
    tag: 'Design',
  },
];

export const INITIAL_RESUME: ResumeDocument = {
  fileName: '',
  fileSize: '',
  uploadedAt: '',
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  fileDataUrl: undefined,
};

export const INITIAL_SECTIONS: DashboardSection[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  darkMode: false,
  soundEnabled: true,
  accentColor: '#2563eb',
  masterPin: '',
};

import { getCustomWorkspaceIdentifier } from './supabase';

// Helper to determine if current workspace is the mock demo account
export const isDemoWorkspace = (): boolean => {
  return false;
};

// Compute workspace-scoped key for complete data isolation between accounts
export function getScopedKey(baseKey: string): string {
  const ws = getCustomWorkspaceIdentifier();
  return `${ws}_${baseKey}`;
}

// Safe Generic Storage Helpers
export function loadFromStorage<T>(baseKey: string, fallback: T): T {
  try {
    const scopedKey = getScopedKey(baseKey);
    const raw = localStorage.getItem(scopedKey);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
    // Also check unscoped legacy key for demo account
    if (isDemoWorkspace()) {
      const legacyRaw = localStorage.getItem(baseKey);
      if (legacyRaw !== null) {
        return JSON.parse(legacyRaw) as T;
      }
    }
    return fallback;
  } catch (err) {
    console.warn(`Error reading key ${baseKey} from localStorage:`, err);
    return fallback;
  }
}

export function saveToStorage<T>(baseKey: string, value: T): void {
  try {
    const scopedKey = getScopedKey(baseKey);
    localStorage.setItem(scopedKey, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error writing key ${baseKey} to localStorage:`, err);
  }
}

// Concrete Loaders & Getters
export const Storage = {
  getTodos: (): TodoItem[] => loadFromStorage(STORAGE_KEYS.TODOS, INITIAL_TODOS),
  setTodos: (items: TodoItem[]) => saveToStorage(STORAGE_KEYS.TODOS, items),

  getHabits: (): HabitItem[] => loadFromStorage(STORAGE_KEYS.HABITS, INITIAL_HABITS),
  setHabits: (items: HabitItem[]) => saveToStorage(STORAGE_KEYS.HABITS, items),

  getGoals: (): GoalItem[] => loadFromStorage(STORAGE_KEYS.GOALS, INITIAL_GOALS),
  setGoals: (items: GoalItem[]) => saveToStorage(STORAGE_KEYS.GOALS, items),

  getVault: (): VaultCredential[] => vaultCache,
  setVault: async (items: VaultCredential[], pin: string): Promise<void> => {
    vaultCache = items;
    if (!pin) return;
    const encrypted = await encryptJson(items, pin);
    localStorage.setItem(getVaultStorageKey(), JSON.stringify(encrypted));
  },
  hydrateVault: async (pin: string): Promise<VaultCredential[]> => {
    if (!pin) {
      vaultCache = [];
      return vaultCache;
    }
    const raw = localStorage.getItem(getVaultStorageKey());
    if (!raw) {
      vaultCache = [];
      return vaultCache;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (isEncryptedPayload(parsed)) {
        vaultCache = await decryptJson<VaultCredential[]>(parsed, pin);
      } else if (Array.isArray(parsed)) {
        // One-time migration of legacy plaintext vaults.
        vaultCache = parsed as VaultCredential[];
        await Storage.setVault(vaultCache, pin);
      } else {
        vaultCache = [];
      }
    } catch {
      vaultCache = [];
    }
    return vaultCache;
  },
  getEncryptedVaultBackup: (): EncryptedPayload | null => {
    try {
      const raw = localStorage.getItem(getVaultStorageKey());
      return raw ? JSON.parse(raw) as EncryptedPayload : null;
    } catch {
      return null;
    }
  },
  restoreEncryptedVault: (payload: EncryptedPayload | null) => {
    if (payload && isEncryptedPayload(payload)) {
      localStorage.setItem(getVaultStorageKey(), JSON.stringify(payload));
      vaultCache = [];
    }
  },

  getExpenses: (): ExpenseItem[] => loadFromStorage(STORAGE_KEYS.EXPENSES, INITIAL_EXPENSES),
  setExpenses: (items: ExpenseItem[]) => saveToStorage(STORAGE_KEYS.EXPENSES, items),

  getJournal: (): JournalEntry[] => loadFromStorage(STORAGE_KEYS.JOURNAL, INITIAL_JOURNAL),
  setJournal: (items: JournalEntry[]) => saveToStorage(STORAGE_KEYS.JOURNAL, items),

  getMedia: (): MediaItem[] => loadFromStorage(STORAGE_KEYS.MEDIA, INITIAL_MEDIA),
  setMedia: (items: MediaItem[]) => saveToStorage(STORAGE_KEYS.MEDIA, items),

  getAchievements: (): AchievementItem[] => loadFromStorage(STORAGE_KEYS.ACHIEVEMENTS, INITIAL_ACHIEVEMENTS),
  setAchievements: (items: AchievementItem[]) => saveToStorage(STORAGE_KEYS.ACHIEVEMENTS, items),

  getDoodles: (): DoodleItem[] => loadFromStorage(STORAGE_KEYS.DOODLES, []),
  setDoodles: (items: DoodleItem[]) => saveToStorage(STORAGE_KEYS.DOODLES, items),

  getTimeline: (): LifeMilestone[] => loadFromStorage(STORAGE_KEYS.TIMELINE, INITIAL_TIMELINE),
  setTimeline: (items: LifeMilestone[]) => saveToStorage(STORAGE_KEYS.TIMELINE, items),

  getProjects: (): PortfolioProject[] => loadFromStorage(STORAGE_KEYS.PROJECTS, INITIAL_PROJECTS),
  setProjects: (items: PortfolioProject[]) => saveToStorage(STORAGE_KEYS.PROJECTS, items),

  getSkills: (): SkillCategory[] => loadFromStorage(STORAGE_KEYS.SKILLS, INITIAL_SKILLS),
  setSkills: (items: SkillCategory[]) => saveToStorage(STORAGE_KEYS.SKILLS, items),

  getProfile: (): UserProfile => {
    const data = loadFromStorage(STORAGE_KEYS.PROFILE, INITIAL_PROFILE);
    if (!data.avatarUrl) {
      data.avatarUrl = STOCK_IMAGES.avatar;
    }
    if (!data.educationRecords) {
      data.educationRecords = [];
    }
    if (!data.jobExperiences) {
      data.jobExperiences = [];
    }
    if (!data.hobbies) {
      data.hobbies = [];
    }
    if (!data.certifications) {
      data.certifications = [];
    }
    if (!data.languages) {
      data.languages = [];
    }
    if (!data.services) {
      data.services = [];
    }
    if (!data.tools) {
      data.tools = [];
    }
    return data;
  },
  setProfile: (profile: UserProfile) => {
    return saveToStorage(STORAGE_KEYS.PROFILE, profile);
  },

  getSettings: (): AppSettings => loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS),
  setSettings: (settings: AppSettings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings),

  getSections: (): DashboardSection[] => loadFromStorage(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS),
  setSections: (sections: DashboardSection[]) => saveToStorage(STORAGE_KEYS.SECTIONS, sections),

  getPhotos: (): Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }> =>
    loadFromStorage(STORAGE_KEYS.PHOTOS, INITIAL_PHOTOS),
  setPhotos: (photos: Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }>) =>
    saveToStorage(STORAGE_KEYS.PHOTOS, photos),

  getResume: (): ResumeDocument => loadFromStorage(STORAGE_KEYS.RESUME, INITIAL_RESUME),
  setResume: (resume: ResumeDocument) => saveToStorage(STORAGE_KEYS.RESUME, resume),

  getQuotes: (): QuoteItem[] => {
    const loaded = loadFromStorage<QuoteItem[]>(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
    if (!loaded || !Array.isArray(loaded) || loaded.length === 0) {
      saveToStorage(STORAGE_KEYS.QUOTES, INITIAL_QUOTES);
      return INITIAL_QUOTES;
    }
    return loaded;
  },
  setQuotes: (quotes: QuoteItem[]) => saveToStorage(STORAGE_KEYS.QUOTES, quotes),

  getExams: (): ExamItem[] => {
    const loaded = loadFromStorage<ExamItem[] | null>(STORAGE_KEYS.EXAMS, null);
    if (loaded === null) {
      // By default on clicking exam section, My Exams opens as a clean blank state
      return [];
    }
    return Array.isArray(loaded) ? loaded : [];
  },
  setExams: (exams: ExamItem[]) => saveToStorage(STORAGE_KEYS.EXAMS, exams),

  getAllDataPayload: () => {
    return {
      version: '4.0.0',
      exportedAt: new Date().toISOString(),
      profile: Storage.getProfile(),
      todos: Storage.getTodos(),
      habits: Storage.getHabits(),
      goals: Storage.getGoals(),
      vaultEncrypted: Storage.getEncryptedVaultBackup(),
      expenses: Storage.getExpenses(),
      journal: Storage.getJournal(),
      media: Storage.getMedia(),
      achievements: Storage.getAchievements(),
      doodles: Storage.getDoodles(),
      timeline: Storage.getTimeline(),
      projects: Storage.getProjects(),
      skills: Storage.getSkills(),
      settings: Storage.getSettings(),
      sections: Storage.getSections(),
      photos: Storage.getPhotos(),
      resume: Storage.getResume(),
      quotes: Storage.getQuotes(),
      exams: Storage.getExams(),
    };
  },

  importAllDataPayload: (data: any): boolean => {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      const knownKeys = [
        'profile', 'todos', 'habits', 'goals', 'vaultEncrypted', 'vault',
        'expenses', 'journal', 'media', 'achievements', 'doodles',
        'timeline', 'projects', 'skills', 'settings', 'sections',
        'photos', 'resume', 'quotes', 'exams', 'version'
      ];
      const hasKnownKey = knownKeys.some((k) => k in data && data[k] !== undefined);
      if (!hasKnownKey) return false;

      if (data.profile) Storage.setProfile(data.profile);
      if (data.todos) Storage.setTodos(data.todos);
      if (data.habits) Storage.setHabits(data.habits);
      if (data.goals) Storage.setGoals(data.goals);
      if (data.vaultEncrypted) Storage.restoreEncryptedVault(data.vaultEncrypted);
      else if (data.vault) Storage.restoreEncryptedVault(null);
      if (data.expenses) Storage.setExpenses(data.expenses);
      if (data.journal) Storage.setJournal(data.journal);
      if (data.media) Storage.setMedia(data.media);
      if (data.achievements) Storage.setAchievements(data.achievements);
      if (data.doodles) Storage.setDoodles(data.doodles);
      if (data.timeline) Storage.setTimeline(data.timeline);
      if (data.projects) Storage.setProjects(data.projects);
      if (data.skills) Storage.setSkills(data.skills);
      if (data.settings) Storage.setSettings(data.settings);
      if (data.sections) Storage.setSections(data.sections);
      if (data.photos) Storage.setPhotos(data.photos);
      if (data.resume) Storage.setResume(data.resume);
      if (data.quotes) Storage.setQuotes(data.quotes);
      if (data.exams) Storage.setExams(data.exams);
      return true;
    } catch (err) {
      console.error('Failed to import payload:', err);
      return false;
    }
  },

  exportAllDataJSON: (): string => {
    const fullBackup = Storage.getAllDataPayload();
    return JSON.stringify(fullBackup, null, 2);
  },

  importAllDataJSON: (jsonStr: string): boolean => {
    try {
      const data = JSON.parse(jsonStr);
      return Storage.importAllDataPayload(data);
    } catch (err) {
      console.error('Failed to import JSON data:', err);
      return false;
    }
  },

  resetToDefault: () => {
    Storage.setProfile(INITIAL_PROFILE);
    Storage.setTodos(INITIAL_TODOS);
    Storage.setHabits(INITIAL_HABITS);
    Storage.setGoals(INITIAL_GOALS);
    localStorage.removeItem(getVaultStorageKey());
    vaultCache = [];
    Storage.setExpenses(INITIAL_EXPENSES);
    Storage.setJournal(INITIAL_JOURNAL);
    Storage.setMedia(INITIAL_MEDIA);
    Storage.setAchievements(INITIAL_ACHIEVEMENTS);
    Storage.setDoodles([]);
    Storage.setTimeline(INITIAL_TIMELINE);
    Storage.setProjects(INITIAL_PROJECTS);
    Storage.setSkills(INITIAL_SKILLS);
    Storage.setSettings(INITIAL_SETTINGS);
    Storage.setSections(INITIAL_SECTIONS);
    Storage.setPhotos(INITIAL_PHOTOS);
    Storage.setResume(INITIAL_RESUME);
    Storage.setQuotes(INITIAL_QUOTES);
    Storage.setExams(INITIAL_USER_EXAMS);
  },
};
