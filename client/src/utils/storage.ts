import {
  AuthUser,
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
  WeeklyScheduleData,
  ScheduleActivity,
  DayOfWeek,
  DayScheduleOverride,
  QuickAlarm,
  CommandMapping,
  ApiUsageMonthlyRecord,
  ApiMonthlyStats,
  PublicationItem,
  ResumeSectionConfig,
  ResumeThemeStyle,
  SmsTransactionLogItem,
  SmsWriteRetryItem,
  TrashItem,
  TrashModule,
  ScreenTimeData,
  AppUsageItem,
} from '../types';
import { STOCK_IMAGES } from '../assets/stockImages';
import { decryptJson, encryptJson, isEncryptedPayload, EncryptedPayload } from './crypto';
import { INITIAL_USER_EXAMS } from '../data/defaultExams';
import { getMondayOfWeek, getWeekId, formatWeekRange } from './habitWeekManager';
import { normalizeExpenseDateKey, getLocalDateKey, mergeExpenseLists as mergeExpenseListsUtil } from './expenseUtils';
import { scratchpadWidgetService } from '../services/scratchpadWidgetService';
import { spendingWidgetService } from '../services/spendingWidgetService';
import { getLocalDateString, resolveCleanAppName } from './screenTimeCalculator';
import { isDummyMockAvatar, isAvatarMatchingUserEmailDomain, getUserWorkspaceKey } from './userUtils';
import { Capacitor } from '@capacitor/core';

export const STORAGE_KEYS = {
  TODOS: 'notion_os_v4_todos',
  HABITS: 'notion_os_v4_habits',
  HABIT_HISTORY: 'notion_os_v4_habit_history',
  HABIT_ACTIVE_WEEK: 'notion_os_v4_habit_active_week',
  HABIT_ACTIVITIES: 'notion_os_v4_habit_activities',
  GOALS: 'notion_os_v4_goals',
  VAULT: 'notion_os_v4_vault',
  EXPENSES: 'notion_os_v4_expenses',
  DELETED_EXPENSE_IDS: 'notion_os_v4_deleted_expense_ids',
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
  SCHEDULE: 'notion_os_v4_schedule',
  HOME_GRID_ORDER: 'notion_os_v4_home_grid_order',
  EXCEL_IMPORT_LOGS: 'notion_os_v4_excel_import_logs',
  ALARM: 'notion_os_v4_active_alarm',
  ALARM_SNOOZE: 'notion_os_v4_alarm_snooze_interval',
  COMMAND_MAPPINGS: 'notion_os_v4_command_mappings',
  API_REQUEST_COUNTS: 'notion_os_v4_api_request_counts',
  API_MONTHLY_THRESHOLD: 'notion_os_v4_api_monthly_threshold',
  SMS_AUTO_TRACKING_ENABLED: 'notion_os_v4_sms_auto_tracking_enabled',
  SMS_PROCESSED_FINGERPRINTS: 'notion_os_v4_sms_processed_fingerprints',
  SMS_TRANSACTION_LOGS: 'notion_os_v4_sms_transaction_logs',
  DELETED_SHEET_IDS: 'notion_os_v4_deleted_sheet_ids',
  TRASH: 'notion_os_v4_trash',
  SCRATCHPAD: 'lifeos_scratchpad_notes',
  SCREEN_TIME: 'notion_os_v4_screentime',
  SCREEN_TIME_HISTORY: 'notion_os_v4_screentime_history',
  SMS_WRITE_RETRY_QUEUE: 'notion_os_v4_sms_write_retry_queue',
};

export const DEFAULT_COMMAND_MAPPINGS: CommandMapping[] = [
  {
    id: 'cmd-1',
    triggerPhrase: 'log breakfast',
    actionType: 'add_expense',
    parameters: {
      expenseName: 'Breakfast',
      expenseAmount: 150,
      expenseCategory: 'Dining Out',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddExpense to log ₹150 for Breakfast',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-2',
    triggerPhrase: 'log lunch',
    actionType: 'add_expense',
    parameters: {
      expenseName: 'Lunch',
      expenseAmount: 250,
      expenseCategory: 'Dining Out',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddExpense to log ₹250 for Lunch',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-3',
    triggerPhrase: 'morning coffee',
    actionType: 'add_expense',
    parameters: {
      expenseName: 'Coffee',
      expenseAmount: 80,
      expenseCategory: 'Snacks & Coffee',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddExpense to log ₹80 for Coffee',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-4',
    triggerPhrase: 'buy groceries',
    actionType: 'add_todo',
    parameters: {
      todoTitle: 'Buy groceries & essential supplies',
      todoPriority: 'medium',
      todoCategory: 'Errands',
      todoDueDate: 'today',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddTodo to add groceries errand',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-5',
    triggerPhrase: 'workout task',
    actionType: 'add_todo',
    parameters: {
      todoTitle: 'Daily workout & physical stretching',
      todoPriority: 'high',
      todoCategory: 'Health',
      todoDueDate: 'today',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Directly calls handleAddTodo to add daily workout task',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-6',
    triggerPhrase: 'go to expenses',
    actionType: 'navigate_view',
    parameters: {
      view: 'expenses',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to the Expense Tracker view',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-7',
    triggerPhrase: 'go to tasks',
    actionType: 'navigate_view',
    parameters: {
      view: 'tasks',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to the Tasks view',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-8',
    triggerPhrase: 'add task',
    actionType: 'add_todo',
    parameters: {
      todoTitle: '',
      todoPriority: 'medium',
      todoCategory: 'General',
      todoDueDate: 'today',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Directly creates a task from spoken words (e.g. "add task revise geography")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-9',
    triggerPhrase: 'create task',
    actionType: 'add_todo',
    parameters: {
      todoTitle: '',
      todoPriority: 'medium',
      todoCategory: 'General',
      todoDueDate: 'today',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Creates a new task (e.g. "create task prepare presentation")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-10',
    triggerPhrase: 'log expense',
    actionType: 'add_expense',
    parameters: {
      expenseName: '',
      expenseAmount: 100,
      expenseCategory: 'Dining Out',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Logs an expense with amount & item (e.g. "log expense 350 for books")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-11',
    triggerPhrase: 'add expense',
    actionType: 'add_expense',
    parameters: {
      expenseName: '',
      expenseAmount: 100,
      expenseCategory: 'Dining Out',
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Logs an expense (e.g. "add expense 120 coffee")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-11-del',
    triggerPhrase: 'delete expense',
    actionType: 'delete_expense',
    parameters: {
      expenseName: '',
      expenseAmount: 0,
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Deletes an expense by name or amount (e.g. "delete expense 29 lunch")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-11-rem',
    triggerPhrase: 'remove expense',
    actionType: 'delete_expense',
    parameters: {
      expenseName: '',
      expenseAmount: 0,
    },
    matchType: 'starts_with',
    enabled: true,
    description: 'Removes an expense (e.g. "remove expense lunch")',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-12',
    triggerPhrase: 'open habits',
    actionType: 'navigate_view',
    parameters: {
      view: 'habits',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to Habits Tracker',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-13',
    triggerPhrase: 'open diary',
    actionType: 'navigate_view',
    parameters: {
      view: 'diary',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to Diary & Journal',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-14',
    triggerPhrase: 'open exams',
    actionType: 'navigate_view',
    parameters: {
      view: 'exams',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates directly to Competitive Exams Hub',
    createdAt: 1710000000000,
    executionCount: 0,
  },
  {
    id: 'cmd-15',
    triggerPhrase: 'open dashboard',
    actionType: 'navigate_view',
    parameters: {
      view: 'dashboard',
    },
    matchType: 'contains',
    enabled: true,
    description: 'Navigates back to the main dashboard',
    createdAt: 1710000000000,
    executionCount: 0,
  },
];

export const DEFAULT_HOME_GRID_ORDER: string[] = [
  'calendar',
  'habits',
  'tasks',
  'expenses',
  'screentime',
  'schedule',
  'scratchpad',
];

export const DEFAULT_HOME_COLUMNS: [string[], string[], string[]] = [
  ['calendar', 'habits'],
  ['tasks', 'expenses', 'screentime'],
  ['schedule', 'scratchpad'],
];

export const DEFAULT_SCHEDULE_ACTIVITIES: ScheduleActivity[] = [
  { id: 'sch-1', time: '7:00 AM', title: 'wake up' },
  { id: 'sch-2', time: '8:00 AM', title: 'breakfast' },
  { id: 'sch-3', time: '9:00 AM', title: 'study' },
  { id: 'sch-4', time: '12:00 PM', title: 'lunch' },
  { id: 'sch-5', time: '3:00 PM', title: 'gym' },
  { id: 'sch-6', time: '5:00 PM', title: 'shower time' },
  { id: 'sch-7', time: '6:00 PM', title: 'chill time' },
  { id: 'sch-8', time: '7:00 PM', title: 'dinner' },
  { id: 'sch-9', time: '9:00 PM', title: 'movie time' },
  { id: 'sch-10', time: '10:00 PM', title: 'tomorrow plan' },
  { id: 'sch-11', time: '11:00 PM', title: 'bed time' },
];

export const INITIAL_SCHEDULE: WeeklyScheduleData = {
  version: '2.0',
  weekdayTemplate: [...DEFAULT_SCHEDULE_ACTIVITIES],
  weekendTemplate: [...DEFAULT_SCHEDULE_ACTIVITIES],
  days: {
    monday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    tuesday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    wednesday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    thursday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    friday: { isCustomized: false, activities: [], inheritedFrom: 'weekday' },
    saturday: { isCustomized: false, activities: [], inheritedFrom: 'weekend' },
    sunday: { isCustomized: false, activities: [], inheritedFrom: 'weekend' },
  },
};

export const INITIAL_EDUCATION_RECORDS: EducationRecord[] = [
  {
    id: 'edu-nit-raipur',
    degree: 'M.Tech in Information Technology',
    level: 'postgraduation',
    levelTitle: 'Postgraduate (M.Tech)',
    institution: 'NIT Raipur',
    boardOrUniversity: 'NIT Raipur',
    location: 'Raipur, India',
    year: '2024 – 2026',
    score: 'CGPA: 8.9/10',
    specialization: 'Information Technology',
    highlights: ['Advanced Distributed Systems, AI Architectures & Data Engineering'],
  },
  {
    id: 'edu-vssut-burla',
    degree: 'B.Tech in Information Technology',
    level: 'graduation',
    levelTitle: 'Undergraduate (B.Tech)',
    institution: 'VSSUT Burla',
    boardOrUniversity: 'VSSUT Burla',
    location: 'Burla, India',
    year: '2020 – 2024',
    score: 'CGPA: 8.7/10',
    specialization: 'Information Technology',
    highlights: ['Core IT Engineering, Algorithms, Database Management & Full-Stack Systems'],
  },
];

export const INITIAL_JOB_EXPERIENCES: JobExperience[] = [
  {
    id: 'exp-tech-2026',
    role: 'Software Engineer',
    company: 'Enterprise Tech Solutions',
    startDate: 'Jun 2026',
    endDate: 'Present',
    location: 'Noida, India',
    description:
      'Working on distributed automation, systems architecture, and tooling.',
    keyAchievements: [
      'Engineered automated diagnostics and enterprise management workflows.',
      'Developed and maintained high-throughput enterprise tools.',
      'Collaborated with cross-functional product and infrastructure teams.',
    ],
    techStack: ['Automation', 'Enterprise Tools', 'Python', 'C++', 'TypeScript'],
  },
  {
    id: 'exp-nit-raipur-research',
    role: 'Research Intern',
    company: 'NIT Raipur',
    startDate: 'Jan 2025',
    endDate: 'May 2026',
    location: 'Raipur, India',
    description:
      'Worked on UAV network security and adversarial ML.',
    keyAchievements: [
      'Worked on UAV network security and adversarial ML.',
      'Published research in peer-reviewed conference.',
    ],
    techStack: ['Adversarial ML', 'UAV Security', 'PyTorch', 'Network Security'],
  },
];

export const INITIAL_HOBBIES: HobbyItem[] = [
  {
    id: 'hb-1',
    title: 'Tech Innovation & Open Source',
    icon: '🚀',
    category: 'Tech & Gaming',
    description: 'Exploring modern frameworks, system designs, and contributing to open-source.',
    passionLevel: 'Active Passion',
  },
  {
    id: 'hb-2',
    title: 'Data Analytics & Modeling',
    icon: '📊',
    category: 'Intellectual',
    description: 'Building analytical pipelines, statistical dashboards, and machine learning models.',
    passionLevel: 'Active Passion',
  },
  {
    id: 'hb-3',
    title: 'Competitive Coding & Problem Solving',
    icon: '⚡',
    category: 'Intellectual',
    description: 'Algorithmic problem solving, data structure optimization, and clean architecture.',
    passionLevel: 'Active Passion',
  },
  {
    id: 'hb-4',
    title: 'Continuous Learning',
    icon: '📚',
    category: 'Lifestyle',
    description: 'Reading technical publications, research papers, and software architecture deep dives.',
    passionLevel: 'Active Passion',
  },
];

export const INITIAL_CERTIFICATIONS: Array<{ id: string; name: string; issuer: string; year: string; link?: string }> = [
  { id: 'cert-1', name: 'Power BI', issuer: 'Simplilearn', year: '2024' },
  { id: 'cert-2', name: 'Cisco CCNAv7 Networks', issuer: 'Cisco Networking Academy', year: '2023' },
  { id: 'cert-3', name: 'AWS Machine Learning', issuer: 'Amazon Web Services', year: '2024' },
  { id: 'cert-4', name: 'Data Analysis Using Python', issuer: 'IBM', year: '2023' },
];

export const INITIAL_PUBLICATIONS: PublicationItem[] = [
  {
    id: 'pub-1',
    title: 'Real-Time Pothole and Lane Detection Using Deep Convolutional Neural Networks',
    publisher: 'International Conference on Smart Computing & Systems',
    year: '2024',
    link: 'https://github.com',
    description: 'Designed an edge-optimized computer vision pipeline with YOLOv8 achieving 80% accuracy in road anomaly detection under varying illumination.',
  },
];

export const INITIAL_ACHIEVEMENTS_LIST: AchievementItem[] = [
  {
    id: 'ach-1',
    title: 'Top 5% Graduate Ranking in Information Technology',
    issuer: 'VSSUT Burla',
    date: '2024',
    category: 'Award',
    badgeIcon: 'Award',
    description: 'Graduated with 8.62 CGPA with distinction in core Computer Science & IT engineering curriculum.',
  },
  {
    id: 'ach-2',
    title: 'Qualified GATE in Computer Science & Information Technology',
    issuer: 'Ministry of Education, Govt. of India',
    date: '2024',
    category: 'Award',
    badgeIcon: 'CheckCircle2',
    description: 'Secured national competitive rank qualifying for M.Tech IT program at NIT Raipur.',
  },
];

export const DEFAULT_RESUME_SECTION_CONFIG: ResumeSectionConfig[] = [
  { id: 'summary', label: 'Professional Summary', visible: true, order: 1 },
  { id: 'experience', label: 'Work Experience', visible: true, order: 2 },
  { id: 'education', label: 'Education', visible: true, order: 3 },
  { id: 'skills', label: 'Technical Skills', visible: true, order: 4 },
  { id: 'projects', label: 'Projects', visible: true, order: 5 },
  { id: 'certifications', label: 'Certifications', visible: true, order: 6 },
  { id: 'publications', label: 'Research & Publications', visible: true, order: 7 },
  { id: 'achievements', label: 'Achievements & Honors', visible: true, order: 8 },
];

export const INITIAL_LANGUAGES: Array<{ id: string; name: string; proficiency: string }> = [
  { id: 'lang-1', name: 'English', proficiency: 'Professional' },
  { id: 'lang-2', name: 'Hindi', proficiency: 'Native / Fluent' },
  { id: 'lang-3', name: 'Odia', proficiency: 'Native' },
];

// Blank User Profile for new isolated accounts
export const BLANK_PROFILE: UserProfile = {
  name: '',
  caption: '',
  handle: '',
  title: '',
  bio: '',
  location: '',
  statusText: 'Active',
  statusEmoji: '✨',
  avatarUrl: '',
  avatarEnabled: true,
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
  publications: [],
  achievementsList: [],
  resumeSectionConfig: DEFAULT_RESUME_SECTION_CONFIG,
  resumeThemeStyle: 'modern',
  professionalSummary: '',
  careerObjective: '',
  availabilityStatus: 'Open to opportunities',
  yearsOfExperience: '',
  currentCompany: '',
  currentDesignation: '',
};

// Verified Base User Profile for primary account (Gulshan Kumar Nayak)
export const INITIAL_PROFILE: UserProfile = {
  name: 'Gulshan Kumar Nayak',
  caption: 'Data & AI Engineer | Researcher | Problem Solver',
  handle: '@gknayak',
  title: 'Data & AI Engineer | Researcher | Problem Solver',
  bio: 'I build data-driven systems, AI applications and intelligent solutions to solve real-world problems.',
  location: 'San Francisco, CA',
  statusText: 'Open to opportunities',
  statusEmoji: '💼',
  avatarUrl: 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp',
  avatarEnabled: true,
  bannerType: 'gradient',
  bannerBg: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #FDF4FF 100%)',
  staticCoverImage: STOCK_IMAGES.workspaceCover,
  coverImageEnabled: true,
  contactEmail: 'gknayak@gmail.com',
  phone: '+1 (555) 234-5678',
  github: 'github.com/gknayak',
  linkedin: 'linkedin.com/in/gknayak',
  twitter: '',
  website: 'gknayak.dev',
  resumeAvailable: true,
  services: ['Data & AI Systems', 'Machine Learning & LLMs', 'Full-Stack Engineering', 'Distributed Computing'],
  tools: ['Python', 'PyTorch', 'Java', 'Spring Boot', 'React', 'TypeScript', 'SQL', 'Git'],
  educationRecords: INITIAL_EDUCATION_RECORDS,
  jobExperiences: INITIAL_JOB_EXPERIENCES,
  hobbies: INITIAL_HOBBIES,
  certifications: INITIAL_CERTIFICATIONS,
  languages: INITIAL_LANGUAGES,
  publications: INITIAL_PUBLICATIONS,
  achievementsList: INITIAL_ACHIEVEMENTS_LIST,
  resumeSectionConfig: DEFAULT_RESUME_SECTION_CONFIG,
  resumeThemeStyle: 'modern',
  professionalSummary:
    'Data and AI enthusiast with a strong academic background and hands-on experience in building intelligent systems. Passionate about solving real-world problems through data, machine learning and scalable software solutions.',
  careerObjective:
    'Aspiring to contribute as a Software Engineer and Data Analyst, leveraging robust backend skills, AI integrations, and high-impact analytics.',
  availabilityStatus: 'Open to opportunities',
  yearsOfExperience: '2+',
  currentCompany: 'Enterprise Tech Solutions',
  currentDesignation: 'Software Engineer',
};

// Empty Clean State Collections (No fake/mock data for new accounts)
export const INITIAL_TODOS: TodoItem[] = [];
export const INITIAL_HABITS: HabitItem[] = [];
export const INITIAL_GOALS: GoalItem[] = [];
export const INITIAL_VAULT: VaultCredential[] = [];

// Authoritative Study & Gym habits for primary user Gulshan Kumar Nayak (gknayak@gmail.com & gulnayak1206@gmail.com)
export const OWNER_GKN_HABITS: HabitItem[] = [
  {
    id: 'hb-1790839137566',
    icon: '🏋️',
    color: '#6366F1',
    title: 'Gym',
    streak: 1,
    category: 'Health & Fitness',
    updatedAt: 1791912673006,
    completedDays: [false, false, false, false, false, false, false],
    completedDates: [
      '2026-10-01',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-12',
      '2026-10-13',
    ],
  },
  {
    id: 'hb-1790936989123-g51jr',
    icon: '📚',
    color: '#10B981',
    title: 'Study',
    streak: 3,
    category: 'Learning',
    updatedAt: 1792578312789,
    completedDays: [false, false, true, false, false, false, false],
    completedDates: [
      '2026-10-01',
      '2026-10-02',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-21',
    ],
  },
];

let vaultCache: VaultCredential[] = [];
let memoryExpensesCache: ExpenseItem[] | null = null;

const getVaultStorageKey = () => getScopedKey(STORAGE_KEYS.VAULT);
export const INITIAL_EXPENSES: ExpenseItem[] = [];
export const INITIAL_JOURNAL: JournalEntry[] = [];
export const INITIAL_MEDIA: MediaItem[] = [];
export const INITIAL_ACHIEVEMENTS: AchievementItem[] = [];
export const INITIAL_TIMELINE: LifeMilestone[] = [];
export const INITIAL_PROJECTS: PortfolioProject[] = [
  {
    id: 'proj-exam-dashboard',
    title: 'My Exam Dashboard – Full Stack Application',
    tagLine: 'Exam Management Platform with AI & Real-time Updates',
    startDate: 'Jan 2024',
    endDate: 'May 2024',
    date: 'Jan 2024 – May 2024',
    role: 'Lead Full-Stack Architect',
    description:
      'Developed a full-stack system with JWT-based authentication, complete CRUD operations for exams and categories, and responsive UI with dark/light mode. Integrated AI-powered ChatBot, real-time exam news, live countdown timers and smart recommendations.',
    expandedDescription:
      'Engineered an enterprise-grade academic preparation dashboard that unifies schedule planning, mock assessments, and personalized study paths. Built using Next.js and Node.js with secure token-based authentication, dynamic route caching, and low-latency API handlers.\n\nThe system integrates conversational AI to parse user queries about upcoming exam dates, pattern changes, and preparation metrics, converting unstructured educational notices into structured timeline feeds.',
    techStack: ['Next.js', 'React.js', 'Node.js', 'Tailwind CSS', 'JWT', 'RESTful APIs', 'Gemini API'],
    category: 'Fullstack',
    featured: true,
    keyResult: 'Empowered 500+ student users with real-time syllabus tracking and reduced support queries by 40% with AI chatbot.',
    imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1200&q=80',
    highlights: [
      'Engineered microservices-based API endpoints with JWT session validation.',
      'Constructed responsive fluid UI with custom Dark/Light theme switching.',
      'Implemented real-time countdown alerts and intelligent automated study schedules.',
    ],
    githubUrl: 'https://github.com',
    liveUrl: 'https://github.com',
  },
  {
    id: 'proj-data-analytics',
    title: 'Cross-Functional Data Analytics Initiative',
    tagLine: 'Enterprise BI Solutions & Executive Dashboards',
    startDate: 'Jun 2023',
    endDate: 'Dec 2023',
    date: 'Jun 2023 – Dec 2023',
    role: 'Data & BI Engineer',
    description:
      'Integrated academic, research, and open-source data to create cross-domain analytics solutions using DAX calculations supported by robust data pipelines with SQL and Power BI tools. Developed dynamic dashboards and reports in Power BI to present insights and enable decision-making across multiple domains.',
    expandedDescription:
      'Designed end-to-end Extract-Transform-Load (ETL) pipelines unifying multi-source telemetry, academic benchmark datasets, and institutional operational figures into consolidated Star Schema data marts.\n\nDeveloped custom DAX calculations, cumulative retention algorithms, and interactive slicers enabling senior executive leadership to conduct deep multidimensional slice-and-dice analyses in seconds.',
    techStack: ['Power BI', 'SQL', 'MS Excel', 'Microsoft Office Suite', 'DAX'],
    category: 'Systems',
    featured: true,
    keyResult: 'Automated 12+ executive KPI dashboards, slashing monthly reporting turnaround from 3 days to under 15 minutes.',
    imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1200&q=80',
    highlights: [
      'Normalized relational datasets into high-performance analytical star schemas.',
      'Programmed advanced DAX measures for period-over-period trend analysis.',
      'Eliminated manual spreadsheet reconciliation across 6 departments.',
    ],
    githubUrl: 'https://github.com',
  },
  {
    id: 'proj-pothole-lane',
    title: 'Real-Time Pothole and Lane Detection System',
    tagLine: 'Computer Vision & Deep Learning for Autonomous Driving',
    startDate: 'Jan 2023',
    endDate: 'May 2023',
    date: 'Jan 2023 – May 2023',
    role: 'Computer Vision Engineer',
    description:
      'Developed a computer vision system to enhance autonomous driving safety by detecting road potholes and lane markings in real time. Utilized Python, OpenCV, and PyTorch, implementing YOLOv8 and Torchvision for deep learning-based detection with 80% road damage detection accuracy.',
    expandedDescription:
      'Formulated a resilient dual-stream perception pipeline tailored for edge-embedded automotive hardware. Trained custom YOLOv8 models on challenging annotated road surface datasets spanning varied weather, lighting conditions, and pavement degradation patterns.\n\nOptimized TensorRT inference weights to sustain real-time 30+ FPS throughput while transmitting synchronized GPS-tagged hazard telemetry to backend servers.',
    techStack: ['Python', 'OpenCV', 'PyTorch', 'YOLOv8', 'Torchvision'],
    category: 'Systems',
    featured: true,
    keyResult: 'Attained 80% road hazard detection accuracy with sub-30ms frame inference speeds on edge devices.',
    imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    highlights: [
      'Trained and validated deep convolutional object detection networks using PyTorch & YOLOv8.',
      'Implemented OpenCV spatial filtering and inverse perspective mapping for accurate lane boundaries.',
      'Achieved reliable sub-30ms latency suitable for edge device inference.',
    ],
    githubUrl: 'https://github.com',
  },
];

export const INITIAL_SKILLS: SkillCategory[] = [
  {
    category: 'Programming Languages',
    skills: [
      { name: 'Java', level: 95, experience: 'Proficient', highlight: true },
      { name: 'Python', level: 92, experience: 'Proficient', highlight: true },
      { name: 'C', level: 85, experience: 'Core Language', highlight: false },
      { name: 'C++', level: 88, experience: 'DSA & Systems', highlight: true },
      { name: 'SQL', level: 90, experience: 'Queries & Schemas', highlight: true },
      { name: 'JavaScript', level: 90, experience: 'Web & Node', highlight: true },
      { name: 'HTML', level: 95, experience: 'Frontend', highlight: false },
    ],
  },
  {
    category: 'Tools and Technical Skills',
    skills: [
      { name: 'Spring Boot', level: 92, experience: 'Backend APIs', highlight: true },
      { name: 'Git', level: 95, experience: 'Version Control', highlight: true },
      { name: 'GitHub', level: 95, experience: 'Collaboration & CI', highlight: true },
      { name: 'Postman', level: 90, experience: 'API Testing', highlight: false },
      { name: 'Web Sockets', level: 85, experience: 'Realtime', highlight: false },
      { name: 'Generative AI', level: 90, experience: 'AI Integrations', highlight: true },
      { name: 'LLM', level: 88, experience: 'Prompt & SDKs', highlight: true },
    ],
  },
  {
    category: 'Computer Science Fundamentals',
    skills: [
      { name: 'Data Structures and Algorithms', level: 92, experience: 'Core DSA', highlight: true },
      { name: 'OOP', level: 95, experience: 'Design Patterns', highlight: true },
      { name: 'DBMS', level: 90, experience: 'Relational Design', highlight: true },
      { name: 'Networking', level: 88, experience: 'Protocols & Routing', highlight: false },
    ],
  },
  {
    category: 'Data Visualization & BI',
    skills: [
      { name: 'Power BI', level: 95, experience: 'Calculations & Modeling', highlight: true },
      { name: 'Dashboard Design', level: 92, experience: 'Executive BI', highlight: true },
      { name: 'Data Engineering', level: 88, experience: 'Pipelines & ETL', highlight: false },
      { name: 'Data Mining', level: 86, experience: 'Extraction', highlight: false },
      { name: 'Interactive Visualizations', level: 90, experience: 'Analytics', highlight: true },
    ],
  },
  {
    category: 'Advanced MS Excel',
    skills: [
      { name: 'Pivot Tables', level: 92, experience: 'Data Summarization', highlight: true },
      { name: 'Macros', level: 88, experience: 'VBA Automation', highlight: false },
      { name: 'Lookups', level: 95, experience: 'VLOOKUP / XLOOKUP', highlight: true },
      { name: 'Data Functions', level: 90, experience: 'Formulas & Auditing', highlight: false },
    ],
  },
  {
    category: 'Data Analysis Core Competencies',
    skills: [
      { name: 'Data Visualization & Analytics', level: 92, experience: 'High Impact', highlight: true },
      { name: 'Compliance Tracking', level: 88, experience: 'Governance', highlight: false },
      { name: 'Metrics Analysis', level: 90, experience: 'KPI Tracking', highlight: true },
      { name: 'Data Collection & Integration', level: 88, experience: 'ETL Pipelines', highlight: false },
      { name: 'Cross-functional Teamwork', level: 95, experience: 'Collaboration', highlight: true },
      { name: 'Attention to Detail & Data Accuracy', level: 95, experience: 'Data Integrity', highlight: true },
    ],
  },
];

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
    title: 'Software Engineer at Enterprise Systems',
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

export const DEFAULT_ATS_RESUME: ResumeDocument = {
  fileName: 'Resume_Template.pdf',
  fileSize: '128 KB',
  uploadedAt: 'Verified ATS Format',
  summary:
    'Passionate and goal-driven software engineer with a strong academic foundation and hands-on experience in backend development, full-stack applications, Data Science and Analytics, and AI-integrated systems. Skilled in a wide range of technologies including Java, Spring Boot, React, Python, Networking, Power BI, Generative AI, LLM, and APIs. Strong problem solving skills, leadership qualities, and commitment to continuous learning and development.',
  contact: {
    name: 'GULSHAN KUMAR NAYAK',
    phone: '+1 (555) 234-5678',
    email: 'gknayak@gmail.com',
    github: 'https://github.com/gknayak',
    linkedin: 'https://linkedin.com/in/gknayak',
    location: 'Raipur, India',
    portfolio: 'https://gknayak.dev',
  },
  skills: [
    'Java', 'Spring Boot', 'Python', 'C', 'C++', 'SQL', 'JavaScript', 'HTML', 'React',
    'Power BI', 'Git', 'GitHub', 'Postman', 'Web Sockets', 'Generative AI', 'LLM',
    'Data Structures and Algorithms', 'OOP', 'DBMS', 'Networking', 'Advanced MS Excel'
  ],
  skillsByCategory: [
    {
      category: 'Programming Languages',
      items: ['C', 'C++', 'HTML', 'JavaScript', 'Java', 'Python', 'SQL'],
    },
    {
      category: 'Tools and Technical Skills',
      items: ['Git', 'GitHub', 'Spring Boot', 'Postman', 'Web Sockets', 'Generative AI', 'LLM'],
    },
    {
      category: 'Computer Science Fundamentals',
      items: ['Data Structures and Algorithms', 'OOP', 'DBMS', 'Networking'],
    },
    {
      category: 'Data Visualization & BI',
      items: [
        'Power BI (calculations, dashboard design, data engineering, data mining, interactive visualizations)',
      ],
    },
    {
      category: 'Advanced MS Excel',
      items: ['Pivot Tables', 'Macros', 'Lookups', 'Data Functions'],
    },
    {
      category: 'Data Analysis Core Competencies',
      items: [
        'Data Visualization & Analytics',
        'Compliance Tracking',
        'Metrics Analysis',
        'Data Collection & Integration',
        'Cross-functional Teamwork',
        'Attention to Detail & Data Accuracy',
      ],
    },
  ],
  education: [
    {
      school: 'National Institute of Technology Raipur, Chhattisgarh',
      degree: 'M.Tech in Information Technology',
      year: '2024–2026',
      score: '8.55 CGPA',
      location: 'Raipur, Chhattisgarh',
      specialization: 'Information Technology',
      highlights: ['Advanced Distributed Systems, AI Architectures & Data Engineering'],
    },
    {
      school: 'Veer Surendra Sai University of Technology Burla, Odisha',
      degree: 'B.Tech in Information Technology',
      year: '2020–2024',
      score: '8.62 CGPA',
      location: 'Burla, Odisha',
      specialization: 'Information Technology',
      highlights: ['Core IT Engineering, Algorithms, Database Management & Full-Stack Systems'],
    },
  ],
  experiences: [
    {
      role: 'Trainee / Intern',
      company: 'GNANIG Technologies',
      period: '2023',
      details:
        'Designed and developed a Spring Boot backend application to manage insurance policies, clients, and claims via RESTful APIs.',
      achievements: [
        'Designed and developed a Spring Boot backend application to manage insurance policies, clients, and claims via RESTful APIs.',
        'Implemented robust CRUD operations and integrated MySQL with Spring Data JPA for efficient data storage and retrieval.',
        'Utilized Swagger for comprehensive API documentation, enhancing usability and simplifying testing processes.',
      ],
      techStack: ['Spring Boot', 'Java', 'RESTful APIs', 'MySQL', 'Spring Data JPA', 'Swagger'],
    },
  ],
  projects: [
    {
      title: 'My Exam Dashboard– Full Stack Application',
      subtitle: 'Exam management platform with AI-powered features, real-time updates, and intelligent chatbot assistance.',
      period: '2025',
      description:
        'Developed a full-stack system with JWT-based authentication, complete CRUD operations for exams and categories, and responsive UI with dark/light mode. Integrated AI-powered ChatBot, real-time exam news, live countdown timers and smart recommendations for users.',
      techStack: ['Next.js', 'React.js', 'Node.js', 'Tailwind CSS', 'JWT', 'RESTful APIs', 'Gemini API'],
      points: [
        'Tools & technologies used: Next.js, React.js, Node.js, Tailwind CSS, JWT, RESTful APIs, Gemini API.',
        'Developed a full-stack system with JWT-based authentication, complete CRUD operations for exams and categories, and responsive UI with dark/light mode.',
        'AI-powered ChatBot, real-time exam news, live countdown timers and smart recommendations for users.',
      ],
    },
    {
      title: 'Cross-Functional Data Analytics Initiative',
      subtitle: 'Tech Stack: Power BI, SQL, MS Excel, Microsoft Office Suite',
      period: '2025',
      description:
        'Integrated academic, research, and open-source data to create cross-domain analytics solutions using DAX calculations supported by robust data pipelines with SQL and Power BI tools.',
      techStack: ['Power BI', 'SQL', 'MS Excel', 'Microsoft Office Suite', 'DAX'],
      points: [
        'Integrated academic, research, and open-source data to create cross-domain analytics solutions using DAX calculations supported by robust data pipelines with SQL and Power BI tools',
        'Developed dynamic dashboards and reports in Power BI to present insights and enable decision-making across multiple domains',
        'Authored clear project documentation in Word, PowerPoint, demonstrating adaptability to evolving requirements',
      ],
    },
    {
      title: 'Real-Time Pothole and Lane Detection System',
      subtitle: 'Tech Stack: Python, OpenCV, PyTorch, YOLOv8, Torchvision',
      period: '2024',
      description:
        'Developed a computer vision system to enhance autonomous driving safety by detecting road potholes and lane markings in real time.',
      techStack: ['Python', 'OpenCV', 'PyTorch', 'YOLOv8', 'Torchvision'],
      points: [
        'Developed a computer vision system to enhance autonomous driving safety by detecting road potholes and lane markings in real time',
        'Utilized Python, OpenCV, and PyTorch, implementing YOLOv8 and Torchvision for deep learning-based detection',
        'Achieved 80% accuracy in road damage detection on custom datasets, and integrated robust lane detection using OpenCV line detection and perspective transformation techniques',
      ],
    },
  ],
  certifications: [
    { name: 'Power BI', issuer: 'Simplilearn', year: '2024' },
    { name: 'Cisco CCNAv7 Networks', issuer: 'Cisco Networking Academy', year: '2023' },
    { name: 'AWS Machine Learning', issuer: 'Amazon Web Services', year: '2024' },
    { name: 'Data Analysis Using Python', issuer: 'IBM', year: '2023' },
  ],
  additionalInfo: [
    'Fast learner—comfortable mastering new technologies according to the project needs.',
    'Excellent written and verbal communication skills.',
  ],
};

export const INITIAL_RESUME: ResumeDocument = DEFAULT_ATS_RESUME;

export const INITIAL_SECTIONS: DashboardSection[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  darkMode: false,
  soundEnabled: true,
  accentColor: '#2563eb',
  masterPin: '',
  groqApiKey: '',
  groqModel: 'llama-3.3-70b-versatile',
};

import {
  getCustomWorkspaceIdentifier,
  getCustomWorkspaceEmail,
  setCustomWorkspaceIdentifier,
  setCustomWorkspaceEmail,
} from './supabase';

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
    return fallback;
  } catch (err) {
    console.warn(`Error reading key ${baseKey} from localStorage:`, err);
    return fallback;
  }
}

export function saveToStorage<T>(baseKey: string, value: T): void {
  try {
    const scopedKey = getScopedKey(baseKey);
    const serialized = JSON.stringify(value);
    localStorage.setItem(scopedKey, serialized);
  } catch (err) {
    console.warn(`Error writing key ${baseKey} to localStorage:`, err);
  }
}

export function sanitizeScreenTimeForStorage(data: ScreenTimeData): ScreenTimeData {
  if (!data) return data;
  const clone = { ...data };
  if (Array.isArray(clone.apps)) {
    clone.apps = clone.apps.map((app, idx) => {
      const clean = { ...app };
      if (idx >= 5 || (clean.icon && clean.icon.length > 2048)) {
        delete clean.icon;
      }
      return clean;
    });
  }
  if (Array.isArray(clone.topApps)) {
    clone.topApps = clone.topApps.map((app, idx) => {
      const clean = { ...app };
      if (idx >= 5 || (clean.icon && clean.icon.length > 2048)) {
        delete clean.icon;
      }
      return clean;
    });
  }
  return clone;
}

// Concrete Loaders & Getters
export const Storage = {
  getTodos: (): TodoItem[] => loadFromStorage(STORAGE_KEYS.TODOS, INITIAL_TODOS),
  setTodos: (items: TodoItem[]) => saveToStorage(STORAGE_KEYS.TODOS, items),

  getHabits: (): HabitItem[] => {
    const activeEmail = getCustomWorkspaceEmail();
    const isGknUser = activeEmail === 'gknayak@gmail.com' || activeEmail === 'gulnayak1206@gmail.com';
    const loaded = loadFromStorage<HabitItem[]>(STORAGE_KEYS.HABITS, isGknUser ? OWNER_GKN_HABITS : INITIAL_HABITS);
    if (isGknUser && (!Array.isArray(loaded) || loaded.length === 0)) {
      saveToStorage(STORAGE_KEYS.HABITS, OWNER_GKN_HABITS);
      return [...OWNER_GKN_HABITS];
    }
    return Array.isArray(loaded) ? loaded : [];
  },
  setHabits: (items: HabitItem[]) => saveToStorage(STORAGE_KEYS.HABITS, items),
  updateHabit: (habit: HabitItem): HabitItem[] => {
    const current = Storage.getHabits();
    const updated = current.map((h) => (h.id === habit.id ? { ...h, ...habit } : h));
    Storage.setHabits(updated);
    return updated;
  },

  getHabitHistory: (): HabitWeekRecord[] => {
    const raw = loadFromStorage<HabitWeekRecord[]>(STORAGE_KEYS.HABIT_HISTORY, []);
    if (!Array.isArray(raw)) return [];
    const currentMonday = getMondayOfWeek();
    const currentWeekId = getWeekId(currentMonday);
    const currentWeekLabel = formatWeekRange(currentMonday);
    return raw.filter((w) => {
      if (!w) return false;
      const isSameId = w.id === `week-${currentWeekId}` || w.id === currentWeekId;
      const isSameStart = w.weekStart === currentWeekId;
      const isSameLabel =
        w.label?.trim().toLowerCase() === currentWeekLabel?.trim().toLowerCase() ||
        (w.label?.toLowerCase().includes('sep 14') && currentWeekLabel?.toLowerCase().includes('sep 14'));
      return !isSameId && !isSameStart && !isSameLabel;
    });
  },
  setHabitHistory: (items: HabitWeekRecord[]) => saveToStorage(STORAGE_KEYS.HABIT_HISTORY, items),

  getHabitActiveWeek: (): string => loadFromStorage(STORAGE_KEYS.HABIT_ACTIVE_WEEK, ''),
  setHabitActiveWeek: (weekId: string) => saveToStorage(STORAGE_KEYS.HABIT_ACTIVE_WEEK, weekId),

  getHabitActivities: (): HabitActivityLog[] => loadFromStorage(STORAGE_KEYS.HABIT_ACTIVITIES, []),
  setHabitActivities: (items: HabitActivityLog[]) => saveToStorage(STORAGE_KEYS.HABIT_ACTIVITIES, items),

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

  getExpenses: (): ExpenseItem[] => {
    const scopedKey = getScopedKey(STORAGE_KEYS.EXPENSES);
    const hasScopedItem = localStorage.getItem(scopedKey) !== null;
    const raw = loadFromStorage<ExpenseItem[]>(STORAGE_KEYS.EXPENSES, []);
    let list: ExpenseItem[] = Array.isArray(raw) ? raw.filter((e) => e && typeof e === 'object' && e.id) : [];

    const activeEmail = (getCustomWorkspaceEmail() || '').toLowerCase().trim();
    const ws = getCustomWorkspaceIdentifier();
    const isGuest = !activeEmail || activeEmail === 'guest@workspace.local' || ws === 'user_guest';

    // Strictly user-scoped offline cache recovery:
    // If the scoped key is completely absent (cold startup / app restart offline), recover from persistent offline cache
    if (!hasScopedItem || list.length === 0) {
      const offlineCacheKeys: string[] = [];
      if (!isGuest) {
        offlineCacheKeys.push(
          `${activeEmail}_offline_expenses_cache`,
          `${ws}_offline_expenses_cache`,
          `${ws}_lifeos_expenses_backup`
        );

        const isGknUser = activeEmail === 'gknayak@gmail.com' || activeEmail === 'gulnayak1206@gmail.com';
        if (isGknUser) {
          offlineCacheKeys.push(
            'gknayak@gmail.com_offline_expenses_cache',
            'gulnayak1206@gmail.com_offline_expenses_cache',
            'lifeos_offline_expenses_cache',
            'user_usr_gulnayak1206_gmail_com_notion_os_v4_expenses',
            'user_usr_gknayak_gmail_com_notion_os_v4_expenses',
            'account_auth_gulnayak1206_gmail_com_notion_os_v4_expenses',
            'account_auth_gknayak_gmail_com_notion_os_v4_expenses'
          );
        }
      } else {
        offlineCacheKeys.push(
          'user_guest_offline_expenses_cache',
          'user_guest_lifeos_expenses_backup'
        );
      }

      let recoveredFromCache: ExpenseItem[] = [];
      for (const key of offlineCacheKeys) {
        try {
          const cachedRaw = localStorage.getItem(key);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validParsed = parsed.filter((e: any) => e && typeof e === 'object' && e.id);
              if (validParsed.length > recoveredFromCache.length) {
                recoveredFromCache = validParsed;
              }
            }
          }
        } catch {}
      }

      if (recoveredFromCache.length > 0 && !hasScopedItem) {
        list = recoveredFromCache;
        saveToStorage(STORAGE_KEYS.EXPENSES, list);
      }
    }

    // Ensure immediate read-after-write consistency if memory cache contains newly committed items
    if (memoryExpensesCache && memoryExpensesCache.length > 0) {
      const listIds = new Set(list.map((e) => e.id));
      const unpersistedFromMemory = memoryExpensesCache.filter((e) => !listIds.has(e.id));
      if (unpersistedFromMemory.length > 0) {
        list = [...unpersistedFromMemory, ...list];
        saveToStorage(STORAGE_KEYS.EXPENSES, list);
      }
    }

    // Date healing: Ensure every expense in list has normalized YYYY-MM-DD date key
    const deletedIds = new Set(Storage.getDeletedExpenseIds().map((id) => String(id).trim()));
    list = list
      .filter((e) => !deletedIds.has(String(e.id).trim()))
      .map((e) => {
        const normalizedDate = normalizeExpenseDateKey(e.date) || e.date || getLocalDateKey();
        if (e.date !== normalizedDate) {
          return { ...e, date: normalizedDate };
        }
        return e;
      });

    return list;
  },

  clearMemoryExpensesCache: () => {
    memoryExpensesCache = null;
  },

  clearMemoryCaches: () => {
    memoryExpensesCache = null;
    vaultCache = [];
  },

  hasUserData: (user: AuthUser | null): boolean => {
    if (!user || !user.email) return false;
    const ws = getUserWorkspaceKey(user);
    return (
      localStorage.getItem(`${ws}_${STORAGE_KEYS.PROFILE}`) !== null ||
      localStorage.getItem(`${ws}_${STORAGE_KEYS.EXPENSES}`) !== null ||
      localStorage.getItem(`${ws}_${STORAGE_KEYS.TODOS}`) !== null
    );
  },

  resetToCleanUserWorkspace: (user: AuthUser | null) => {
    Storage.clearMemoryCaches();
    if (!user || !user.email) return;
    const cleanEmail = user.email.toLowerCase().trim();
    const isGknUser = cleanEmail === 'gknayak@gmail.com' || cleanEmail === 'gulnayak1206@gmail.com';
    const cleanName = isGknUser
      ? (user.name && user.name !== 'Gknayak' ? user.name : 'Gulshan Kumar Nayak')
      : (user.name || cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

    const wsKey = getUserWorkspaceKey(user);
    setCustomWorkspaceIdentifier(wsKey);
    setCustomWorkspaceEmail(cleanEmail);

    const defaultGknAvatar = 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp';
    const cleanProfile: UserProfile = {
      ...BLANK_PROFILE,
      name: cleanName,
      caption: '',
      handle: `@${cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      title: '',
      bio: '',
      location: '',
      statusText: 'Active',
      statusEmoji: '✨',
      avatarUrl: isGknUser
        ? (user.avatarUrl && isAvatarMatchingUserEmailDomain(user.avatarUrl, cleanEmail) ? user.avatarUrl : defaultGknAvatar)
        : (user.avatarUrl && isAvatarMatchingUserEmailDomain(user.avatarUrl, cleanEmail) ? user.avatarUrl : ''),
      avatarEnabled: true,
      bannerType: 'gradient',
      bannerBg: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 50%, #FDF4FF 100%)',
      staticCoverImage: STOCK_IMAGES.workspaceCover,
      coverImageEnabled: true,
      contactEmail: cleanEmail,
      phone: '',
      github: '',
      linkedin: '',
      twitter: '',
      website: '',
      resumeAvailable: false,
      educationRecords: [],
      jobExperiences: [],
      certifications: [],
      hobbies: [],
      languages: [],
      services: [],
      tools: [],
      achievementsList: [],
      publications: [],
    };

    Storage.setProfile(cleanProfile);
    Storage.setTodos([]);
    Storage.setHabits(isGknUser ? [...OWNER_GKN_HABITS] : []);
    Storage.setHabitHistory([]);
    Storage.setHabitActiveWeek('');
    Storage.setHabitActivities([]);
    Storage.setGoals([]);
    Storage.setExpenses([]);
    Storage.setJournal([]);
    Storage.setMedia([]);
    Storage.setAchievements([]);
    Storage.setDoodles([]);
    Storage.setTimeline([]);
    Storage.setProjects([]);
    Storage.setSkills([]);
    Storage.setSettings(INITIAL_SETTINGS);
    Storage.setSections([]);
    Storage.setPhotos([]);
    Storage.setResume({
      fileName: 'Resume.pdf',
      fileSize: '0 KB',
      uploadedAt: '',
      summary: '',
      contact: {
        name: cleanName,
        phone: '',
        email: cleanEmail,
        github: '',
        linkedin: '',
        location: '',
        portfolio: '',
      },
      skills: [],
      skillsByCategory: [],
      education: [],
      experiences: [],
      projects: [],
      certifications: [],
      additionalInfo: [],
    });
    Storage.setQuotes([]);
    Storage.setExams([]);
    Storage.setSchedule(INITIAL_SCHEDULE);
    Storage.setTrash([]);
    Storage.setDeletedExpenseIds([]);
    Storage.setDeletedSheetIds([]);

    // Clear user-scoped offline expense caches
    try {
      localStorage.removeItem(`${cleanEmail}_offline_expenses_cache`);
      localStorage.removeItem(`${wsKey}_offline_expenses_cache`);
      localStorage.removeItem(`${wsKey}_lifeos_expenses_backup`);
      if (cleanEmail === 'guest@workspace.local' || wsKey === 'user_guest') {
        localStorage.removeItem('user_guest_offline_expenses_cache');
        localStorage.removeItem('user_guest_lifeos_expenses_backup');
      }
    } catch {}
  },

  setExpenses: (items: ExpenseItem[]): ExpenseItem[] => {
    if (!Array.isArray(items)) {
      items = [];
    }
    const nowMs = Date.now();
    const seenIds = new Set<string>();
    const sanitized: ExpenseItem[] = [];

    for (const raw of items) {
      if (!raw || typeof raw !== 'object') continue;
      const id = String(raw.id || `exp-${nowMs}-${Math.random().toString(36).slice(2, 7)}`).trim();
      if (!id || seenIds.has(id)) continue;
      seenIds.add(id);

      const isCredit =
        raw.direction === 'CREDIT' ||
        raw.transactionType === 'CREDIT' ||
        raw.transactionType === 'income' ||
        (raw as any).type === 'income' ||
        (raw as any).type === 'CREDIT' ||
        (raw as any).type === 'credit';
      const direction: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';

      const rawAmount = Number(raw.amount);
      const safeAmount = Number.isFinite(rawAmount) ? Math.round(Math.abs(rawAmount) * 100) / 100 : 0;

      const dateStr = normalizeExpenseDateKey(raw.date) || getLocalDateKey();

      sanitized.push({
        ...raw,
        id,
        amount: safeAmount,
        name: (raw.name || 'Expense').trim() || 'Expense',
        category: (raw.category || 'Other').trim() || 'Other',
        date: dateStr,
        direction,
        transactionType: direction,
        active: raw.active !== false,
        createdAt: raw.createdAt || nowMs,
        updatedAt: raw.updatedAt || nowMs,
      });
    }

    memoryExpensesCache = sanitized;
    saveToStorage(STORAGE_KEYS.EXPENSES, sanitized);
    saveToStorage('lifeos_expenses_backup', sanitized);

    // Multi-tier persistent offline caching (strictly scoped to current user workspace):
    // Guarantees spending data is always readable offline and never blanked by network reconnection
    try {
      const activeEmail = (getCustomWorkspaceEmail() || '').toLowerCase().trim();
      const ws = getCustomWorkspaceIdentifier();
      const isGuest = !activeEmail || activeEmail === 'guest@workspace.local' || ws === 'user_guest';
      const serialized = JSON.stringify(sanitized);

      if (sanitized.length > 0) {
        if (!isGuest) {
          localStorage.setItem(`${activeEmail}_offline_expenses_cache`, serialized);
          localStorage.setItem(`${ws}_offline_expenses_cache`, serialized);
          const isGknUser = activeEmail === 'gknayak@gmail.com' || activeEmail === 'gulnayak1206@gmail.com';
          if (isGknUser) {
            localStorage.setItem('lifeos_offline_expenses_cache', serialized);
            localStorage.setItem('lifeos_expenses_backup', serialized);
          }
        } else {
          localStorage.setItem('user_guest_offline_expenses_cache', serialized);
          localStorage.setItem('user_guest_lifeos_expenses_backup', serialized);
        }
      } else {
        if (!isGuest) {
          localStorage.removeItem(`${activeEmail}_offline_expenses_cache`);
          localStorage.removeItem(`${ws}_offline_expenses_cache`);
          const isGknUser = activeEmail === 'gknayak@gmail.com' || activeEmail === 'gulnayak1206@gmail.com';
          if (isGknUser) {
            localStorage.removeItem('lifeos_offline_expenses_cache');
            localStorage.removeItem('lifeos_expenses_backup');
          }
        } else {
          localStorage.removeItem('user_guest_offline_expenses_cache');
          localStorage.removeItem('user_guest_lifeos_expenses_backup');
        }
      }
    } catch (e) {
      console.warn('Failed to persist offline expense cache:', e);
    }

    void spendingWidgetService.syncToNativeWidget(sanitized);
    return sanitized;
  },
  getDeletedExpenseIds: (): string[] => loadFromStorage<string[]>(STORAGE_KEYS.DELETED_EXPENSE_IDS, []),
  setDeletedExpenseIds: (ids: string[]) => saveToStorage(STORAGE_KEYS.DELETED_EXPENSE_IDS, ids),
  recordDeletedExpenseId: (idOrIds: string | string[]): string[] => {
    const toAdd = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const current = Storage.getDeletedExpenseIds();
    const set = new Set(current.map((s) => String(s).trim()));
    toAdd.forEach((id) => {
      if (id && String(id).trim()) {
        set.add(String(id).trim());
      }
    });
    const updated = Array.from(set).slice(-1000);
    Storage.setDeletedExpenseIds(updated);
    return updated;
  },
  isExpenseDeleted: (id?: string | null): boolean => {
    if (!id || !String(id).trim()) return false;
    const clean = String(id).trim();
    const current = Storage.getDeletedExpenseIds();
    return current.some((d) => String(d).trim() === clean);
  },
  /**
   * Safely merges two expense lists by ID while preserving local transaction IDs,
   * deduping by primary ID and secondary transaction/SMS references, and strictly
   * respecting explicit user deletions (trash, deleted sheets, and deleted expense tombstones).
   */
  mergeExpenseLists: (baseList: ExpenseItem[], incomingList: ExpenseItem[]): ExpenseItem[] => {
    const trash = Storage.getTrash().filter((t) => t.module === 'expenses');
    const trashedIds = new Set<string>();
    trash.forEach((t) => {
      if (t.data?.id) trashedIds.add(String(t.data.id).trim());
      if (typeof t.data === 'string' && t.data.trim()) trashedIds.add(t.data.trim());
      if (t.id) trashedIds.add(String(t.id).trim());
    });
    Storage.getDeletedExpenseIds().forEach((id) => {
      if (id) trashedIds.add(String(id).trim());
    });
    return mergeExpenseListsUtil(baseList, incomingList, trashedIds, (importBatchId, sourceFile) => {
      return Storage.isSheetDeleted(importBatchId) || Storage.isSheetDeleted(sourceFile);
    });
  },
  addExpense: (expense: ExpenseItem): ExpenseItem[] => {
    const current = Storage.getExpenses();
    const nowMs = Date.now();
    const isCredit =
      expense.direction === 'CREDIT' ||
      expense.transactionType === 'CREDIT' ||
      expense.transactionType === 'income' ||
      (expense as any).type === 'income' ||
      (expense as any).type === 'CREDIT' ||
      (expense as any).type === 'credit';
    const direction: 'DEBIT' | 'CREDIT' = isCredit ? 'CREDIT' : 'DEBIT';
    const rawAmount = Number(expense.amount);
    const safeAmount = Number.isFinite(rawAmount) ? Math.round(Math.abs(rawAmount) * 100) / 100 : 0;

    const expenseWithTimestamps: ExpenseItem = {
      ...expense,
      id: String(expense.id || `exp-${nowMs}-${Math.random().toString(36).slice(2, 7)}`).trim(),
      amount: safeAmount,
      name: (expense.name || 'Expense').trim() || 'Expense',
      category: (expense.category || 'Other').trim() || 'Other',
      date: normalizeExpenseDateKey(expense.date) || getLocalDateKey(),
      direction,
      transactionType: direction,
      active: expense.active !== false,
      createdAt: expense.createdAt || nowMs,
      updatedAt: expense.updatedAt || nowMs,
    };
    const cleanRef = (expenseWithTimestamps.smsReferenceId || expenseWithTimestamps.referenceId || expenseWithTimestamps.upiReference || '').trim();
    const existingIndex = current.findIndex(
      (e) =>
        e.id === expenseWithTimestamps.id ||
        (cleanRef &&
          cleanRef.length >= 4 &&
          ((e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === cleanRef.toUpperCase()) ||
            (e.referenceId && e.referenceId.trim().toUpperCase() === cleanRef.toUpperCase()) ||
            (e.upiReference && e.upiReference.trim().toUpperCase() === cleanRef.toUpperCase())))
    );
    let updated: ExpenseItem[];
    if (existingIndex >= 0) {
      updated = [...current];
      const preservedId = current[existingIndex].id;
      expenseWithTimestamps.id = preservedId;
      expense.id = preservedId;
      updated[existingIndex] = { ...updated[existingIndex], ...expenseWithTimestamps, id: preservedId };
    } else {
      expense.id = expenseWithTimestamps.id;
      updated = [expenseWithTimestamps, ...current];
    }
    Storage.setExpenses(updated);

    // Immediate persistence verification
    const verified = Storage.getExpenses();
    const cleanRefUpper = cleanRef.toUpperCase();
    const isSaved = verified.some(
      (e) =>
        e.id === expenseWithTimestamps.id ||
        (cleanRefUpper &&
          cleanRefUpper.length >= 4 &&
          ((e.referenceId && e.referenceId.trim().toUpperCase() === cleanRefUpper) ||
            (e.smsReferenceId && e.smsReferenceId.trim().toUpperCase() === cleanRefUpper) ||
            (e.upiReference && e.upiReference.trim().toUpperCase() === cleanRefUpper))) ||
        (expenseWithTimestamps.rawSmsText && e.rawSmsText && e.rawSmsText.trim().toLowerCase() === expenseWithTimestamps.rawSmsText.trim().toLowerCase())
    );
    if (!isSaved) {
      console.error('[STORAGE_ERROR] Storage.addExpense: Expense failed to verify in storage after write!', expenseWithTimestamps);
    }
    return updated;
  },
  deleteExpense: (id: string): ExpenseItem[] => {
    const current = Storage.getExpenses();
    const target = current.find((e) => e.id === id);
    if (target) {
      Storage.moveToTrash('expenses', target, `${target.name} (₹${Number(target.amount).toLocaleString()})`);
    }
    const updated = current.filter((e) => e.id !== id);
    Storage.setExpenses(updated);
    return updated;
  },
  deleteExpenses: (ids: string[]): ExpenseItem[] => {
    const idSet = new Set(ids.map((id) => String(id).trim()));
    const current = Storage.getExpenses();
    const toDelete = current.filter((e) => idSet.has(String(e.id).trim()));
    toDelete.forEach((target) => {
      Storage.moveToTrash('expenses', target, `${target.name} (₹${Number(target.amount).toLocaleString()})`);
    });
    const updated = current.filter((e) => !idSet.has(String(e.id).trim()));
    Storage.setExpenses(updated);
    return updated;
  },
  clearAllExpenses: (): void => {
    const current = Storage.getExpenses();
    current.forEach((target) => {
      Storage.moveToTrash('expenses', target, `${target.name} (₹${Number(target.amount).toLocaleString()})`);
    });
    Storage.setExpenses([]);
    Storage.setExcelImportLogs([]);
    try {
      localStorage.removeItem(getScopedKey('lifeos_last_imported_sheet_expenses'));
      localStorage.removeItem(getScopedKey('lifeos_expenses_backup'));
      localStorage.removeItem('lifeos_last_imported_sheet_expenses');
      localStorage.removeItem('lifeos_expenses_backup');
    } catch {}
  },

  getExcelImportLogs: (): ExcelImportLog[] => {
    const logs = loadFromStorage<ExcelImportLog[]>(STORAGE_KEYS.EXCEL_IMPORT_LOGS, []);
    return Array.isArray(logs) ? logs : [];
  },
  setExcelImportLogs: (logs: ExcelImportLog[]) => saveToStorage(STORAGE_KEYS.EXCEL_IMPORT_LOGS, logs),
  addExcelImportLog: (log: ExcelImportLog) => {
    const logs = Storage.getExcelImportLogs();
    const updated = [log, ...logs.filter((l) => l.id !== log.id)];
    Storage.setExcelImportLogs(updated);
    return updated;
  },
  deleteExcelImportLog: (id: string) => {
    const logs = Storage.getExcelImportLogs();
    const target = logs.find((l) => l.id === id);
    if (target) {
      Storage.addDeletedSheet(target.id, target.fileName);
    } else {
      Storage.addDeletedSheet(id);
    }
    const updated = logs.filter((l) => l.id !== id);
    Storage.setExcelImportLogs(updated);
    return updated;
  },

  getDeletedSheetIds: (): string[] => {
    const raw = loadFromStorage<string[]>(STORAGE_KEYS.DELETED_SHEET_IDS, []);
    return Array.isArray(raw) ? raw : [];
  },
  setDeletedSheetIds: (ids: string[]) => saveToStorage(STORAGE_KEYS.DELETED_SHEET_IDS, ids),
  addDeletedSheet: (id: string, fileName?: string) => {
    const current = Storage.getDeletedSheetIds();
    const next = new Set(current.map((s) => s.toLowerCase()));
    if (id && id.trim()) next.add(id.trim().toLowerCase());
    if (fileName && fileName.trim()) {
      const lower = fileName.trim().toLowerCase();
      next.add(lower);
      const base = lower.replace(/\.[^/.]+$/, '');
      if (base) next.add(base);
    }
    const arr = Array.from(next);
    Storage.setDeletedSheetIds(arr);
    return arr;
  },
  removeDeletedSheet: (id: string, fileName?: string) => {
    const current = Storage.getDeletedSheetIds();
    const toRemove = new Set<string>();
    if (id && id.trim()) toRemove.add(id.trim().toLowerCase());
    if (fileName && fileName.trim()) {
      const lower = fileName.trim().toLowerCase();
      toRemove.add(lower);
      const base = lower.replace(/\.[^/.]+$/, '');
      if (base) toRemove.add(base);
    }
    const filtered = current.filter((item) => !toRemove.has(item.toLowerCase()));
    Storage.setDeletedSheetIds(filtered);
    return filtered;
  },
  isSheetDeleted: (idOrFileName?: string | null): boolean => {
    if (!idOrFileName || !idOrFileName.trim()) return false;
    const term = idOrFileName.trim().toLowerCase();
    const base = term.replace(/\.[^/.]+$/, '');

    // Never consider an active sheet deleted!
    const activeLogs = Storage.getExcelImportLogs();
    const isActive = activeLogs.some((l) => {
      if (l.id && l.id.toLowerCase() === term) return true;
      const logFileLower = (l.fileName || '').trim().toLowerCase();
      const logBase = logFileLower.replace(/\.[^/.]+$/, '');
      return logFileLower === term || (base && logBase === base);
    });
    if (isActive) return false;

    const current = Storage.getDeletedSheetIds();
    return current.some((s) => {
      const lower = s.toLowerCase();
      return lower === term || (base && lower === base);
    });
  },

  getJournal: (): JournalEntry[] => loadFromStorage(STORAGE_KEYS.JOURNAL, INITIAL_JOURNAL),
  setJournal: (items: JournalEntry[]) => saveToStorage(STORAGE_KEYS.JOURNAL, items),

  getMedia: (): MediaItem[] => loadFromStorage(STORAGE_KEYS.MEDIA, INITIAL_MEDIA),
  setMedia: (items: MediaItem[]) => saveToStorage(STORAGE_KEYS.MEDIA, items),

  getAchievements: (): AchievementItem[] => loadFromStorage(STORAGE_KEYS.ACHIEVEMENTS, INITIAL_ACHIEVEMENTS),
  setAchievements: (items: AchievementItem[]) => saveToStorage(STORAGE_KEYS.ACHIEVEMENTS, items),

  // Trash: soft-deleted items from any module, auto-purged after 30 days
  getTrash: (): TrashItem[] => {
    const raw = loadFromStorage<TrashItem[]>(STORAGE_KEYS.TRASH, []);
    if (!Array.isArray(raw)) return [];
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const fresh = raw.filter((t) => now - t.deletedAt < THIRTY_DAYS_MS);
    if (fresh.length !== raw.length) {
      saveToStorage(STORAGE_KEYS.TRASH, fresh);
    }
    return fresh;
  },
  setTrash: (items: TrashItem[]) => saveToStorage(STORAGE_KEYS.TRASH, items),

  moveToTrash: (module: TrashModule, data: any, label: string): TrashItem => {
    const entry: TrashItem = {
      id: `trash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      module,
      label,
      data,
      deletedAt: Date.now(),
    };
    const current = Storage.getTrash();
    Storage.setTrash([entry, ...current]);
    return entry;
  },

  removeFromTrash: (trashId: string) => {
    const current = Storage.getTrash();
    Storage.setTrash(current.filter((t) => t.id !== trashId));
  },

  emptyTrash: () => {
    Storage.setTrash([]);
  },

  /**
   * Rescues any accidentally trashed expenses for a target month (e.g. "2026-10")
   * that were lost during sheet deletion or cache overwrites, restoring them to active expenses.
   */
  rescueTrashedExpensesForMonth: (monthPrefix: string): number => {
    try {
      const trash = Storage.getTrash();
      const currentExpenses = Storage.getExpenses();
      const currentIds = new Set(currentExpenses.map((e) => e.id));
      const seenFp = new Set(
        currentExpenses.map(
          (e) => `${normalizeExpenseDateKey(e.date)}_${e.amount}_${(e.name || '').trim().toLowerCase()}`
        )
      );

      const rescuedItems: ExpenseItem[] = [];
      const remainingTrash: TrashItem[] = [];

      for (const t of trash) {
        if (t.module === 'expenses' && t.data) {
          const item = t.data as ExpenseItem;
          const dateKey = normalizeExpenseDateKey(item.date);
          const fp = `${dateKey}_${item.amount}_${(item.name || '').trim().toLowerCase()}`;
          if (dateKey.startsWith(monthPrefix)) {
            if (!currentIds.has(item.id) && !seenFp.has(fp)) {
              rescuedItems.push({ ...item, active: true });
              currentIds.add(item.id);
              seenFp.add(fp);
              continue; // Restored, remove from trash
            }
          }
        }
        remainingTrash.push(t);
      }

      if (rescuedItems.length > 0) {
        const updated = [...rescuedItems, ...currentExpenses];
        Storage.setExpenses(updated);
        Storage.setTrash(remainingTrash);
        return rescuedItems.length;
      }
    } catch (err) {
      console.warn('Failed to rescue trashed expenses:', err);
    }
    return 0;
  },

  /**
   * Restores current month expenses from authoritative local backups (lifeos_last_imported_sheet_expenses
   * or lifeos_expenses_backup) if a cloud hydration or cache wipe removed them.
   */
  restoreAuthoritativeMonthExpenses: (monthPrefix: string): number => {
    try {
      let restoredCount = 0;
      const currentExpenses = Storage.getExpenses();
      const currentIds = new Set(currentExpenses.map((e) => e.id));
      const seenFp = new Set(
        currentExpenses.map(
          (e) => `${normalizeExpenseDateKey(e.date)}_${e.amount}_${(e.name || '').trim().toLowerCase()}`
        )
      );

      const toAdd: ExpenseItem[] = [];

      // 1. Check user-scoped lifeos_last_imported_sheet_expenses backup
      try {
        const rawImported = localStorage.getItem(getScopedKey('lifeos_last_imported_sheet_expenses'));
        if (rawImported) {
          const parsed = JSON.parse(rawImported);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id) {
                const dateKey = normalizeExpenseDateKey(item.date);
                const fp = `${dateKey}_${item.amount}_${(item.name || '').trim().toLowerCase()}`;
                if (dateKey.startsWith(monthPrefix) && !currentIds.has(item.id) && !seenFp.has(fp)) {
                  toAdd.push({ ...item, active: true });
                  currentIds.add(item.id);
                  seenFp.add(fp);
                  restoredCount++;
                }
              }
            }
          }
        }
      } catch {}

      // 2. Check user-scoped lifeos_expenses_backup
      try {
        const rawBackup = localStorage.getItem(getScopedKey('lifeos_expenses_backup'));
        if (rawBackup) {
          const parsed = JSON.parse(rawBackup);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id) {
                const dateKey = normalizeExpenseDateKey(item.date);
                const fp = `${dateKey}_${item.amount}_${(item.name || '').trim().toLowerCase()}`;
                if (dateKey.startsWith(monthPrefix) && !currentIds.has(item.id) && !seenFp.has(fp)) {
                  toAdd.push({ ...item, active: true });
                  currentIds.add(item.id);
                  seenFp.add(fp);
                  restoredCount++;
                }
              }
            }
          }
        }
      } catch {}

      if (toAdd.length > 0) {
        const updated = [...toAdd, ...currentExpenses];
        Storage.setExpenses(updated);
        return restoredCount;
      }
    } catch (err) {
      console.warn('Failed to restore authoritative month expenses:', err);
    }
    return 0;
  },

  getDoodles: (): DoodleItem[] => loadFromStorage(STORAGE_KEYS.DOODLES, []),

  setDoodles: (items: DoodleItem[]) => saveToStorage(STORAGE_KEYS.DOODLES, items),

  getTimeline: (): LifeMilestone[] => {
    return loadFromStorage(STORAGE_KEYS.TIMELINE, []);
  },
  setTimeline: (items: LifeMilestone[]) => saveToStorage(STORAGE_KEYS.TIMELINE, items),

  getProjects: (): PortfolioProject[] => {
    const loaded = loadFromStorage(STORAGE_KEYS.PROJECTS, []);
    if (!loaded || !Array.isArray(loaded)) {
      return [];
    }
    return loaded;
  },
  setProjects: (items: PortfolioProject[]) => saveToStorage(STORAGE_KEYS.PROJECTS, items),

  getSkills: (): SkillCategory[] => {
    const loaded = loadFromStorage(STORAGE_KEYS.SKILLS, []);
    if (!loaded || !Array.isArray(loaded)) {
      return [];
    }
    return loaded;
  },
  setSkills: (items: SkillCategory[]) => saveToStorage(STORAGE_KEYS.SKILLS, items),

  getProfile: (): UserProfile => {
    const fallbackProfile: UserProfile = JSON.parse(JSON.stringify(BLANK_PROFILE));
    const rawData = loadFromStorage(STORAGE_KEYS.PROFILE, fallbackProfile);
    const data: UserProfile = { ...rawData };
    const activeEmail = getCustomWorkspaceEmail();
    const isGknUser = activeEmail === 'gknayak@gmail.com' || activeEmail === 'gulnayak1206@gmail.com';

    if (!data.name || !data.name.trim() || (isGknUser && (data.name.toLowerCase() === 'gknayak' || data.name === 'Gknayak'))) {
      if (isGknUser) {
        data.name = 'Gulshan Kumar Nayak';
        data.contactEmail = activeEmail;
        data.handle = '@gulshankumarnayak';
      } else if (activeEmail && activeEmail !== 'guest@workspace.local') {
        const derivedName = activeEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        data.name = derivedName;
        data.contactEmail = activeEmail;
        data.handle = `@${activeEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      } else {
        data.name = '';
        data.contactEmail = '';
        data.handle = '';
      }
    }

    if (
      data.avatarUrl &&
      (!isAvatarMatchingUserEmailDomain(data.avatarUrl, activeEmail) ||
        isDummyMockAvatar(data.avatarUrl, activeEmail))
    ) {
      data.avatarUrl = '';
    }

    const defaultGknAvatar = 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp';
    if (isGknUser && !data.avatarUrl) {
      data.avatarUrl = defaultGknAvatar;
    }
    if (!data.educationRecords) data.educationRecords = [];
    if (!data.jobExperiences) data.jobExperiences = [];
    if (!data.hobbies) data.hobbies = [];
    if (!data.certifications) data.certifications = [];
    if (!data.languages) data.languages = [];
    if (!data.services) data.services = [];
    if (!data.tools) data.tools = [];
    return data;
  },
  setProfile: (profile: UserProfile) => {
    const cleanProfile = { ...profile };
    const activeEmail = cleanProfile.contactEmail || getCustomWorkspaceEmail() || '';
    if (
      cleanProfile.avatarUrl &&
      (!isAvatarMatchingUserEmailDomain(cleanProfile.avatarUrl, activeEmail) ||
        isDummyMockAvatar(cleanProfile.avatarUrl, activeEmail))
    ) {
      console.warn('[STORAGE_TRACE] Cleared avatarUrl in setProfile because it did not match:', {
        avatarUrl: cleanProfile.avatarUrl.slice(0, 50),
        activeEmail,
      });
      cleanProfile.avatarUrl = '';
    }
    return saveToStorage(STORAGE_KEYS.PROFILE, cleanProfile);
  },

  getSettings: (): AppSettings => {
    const s = loadFromStorage<AppSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
    const DEPRECATED = ['mixtral-8x7b-32768', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma-7b-it', 'gemma2-9b-it'];
    if (s && s.groqModel && DEPRECATED.includes(s.groqModel.trim())) {
      s.groqModel = 'llama-3.3-70b-versatile';
      saveToStorage(STORAGE_KEYS.SETTINGS, s);
    }
    return s;
  },
  setSettings: (settings: AppSettings) => saveToStorage(STORAGE_KEYS.SETTINGS, settings),

  getGroqModel: (): string => {
    const settings = Storage.getSettings();
    const DEPRECATED = ['mixtral-8x7b-32768', 'llama3-70b-8192', 'llama3-8b-8192', 'gemma-7b-it', 'gemma2-9b-it'];
    if (settings?.groqModel && !DEPRECATED.includes(settings.groqModel.trim())) {
      return settings.groqModel.trim();
    }
    const directModel = localStorage.getItem('groq_model');
    if (directModel && !DEPRECATED.includes(directModel.trim())) {
      return directModel.trim();
    }
    return 'llama-3.3-70b-versatile';
  },
  setGroqModel: (model: string): void => {
    const settings = Storage.getSettings();
    const cleanModel = model.trim() || 'llama-3.3-70b-versatile';
    Storage.setSettings({ ...settings, groqModel: cleanModel });
    localStorage.setItem('groq_model', cleanModel);
  },

  getGeminiApiKey: (): string => {
    const scopedKey = getScopedKey('gemini_api_key');
    const directKey = localStorage.getItem(scopedKey);
    if (directKey?.trim()) return directKey.trim();
    const settings = Storage.getSettings();
    if (settings?.geminiApiKey?.trim()) return settings.geminiApiKey.trim();
    const profile = Storage.getProfile();
    if (profile?.geminiApiKey?.trim()) return profile.geminiApiKey.trim();
    return '';
  },
  setGeminiApiKey: (key: string): void => {
    const trimmed = key.trim();
    const scopedKey = getScopedKey('gemini_api_key');
    if (trimmed) {
      localStorage.setItem(scopedKey, trimmed);
    } else {
      localStorage.removeItem(scopedKey);
    }
    const settings = Storage.getSettings();
    Storage.setSettings({ ...settings, geminiApiKey: trimmed });
    const profile = Storage.getProfile();
    if (profile) {
      Storage.setProfile({ ...profile, geminiApiKey: trimmed });
    }
  },
  removeGeminiApiKey: (): void => {
    Storage.setGeminiApiKey('');
  },

  getGroqApiKey: (): string => {
    const scopedKey = getScopedKey('groq_api_key');
    const directKey = localStorage.getItem(scopedKey);
    if (directKey?.trim()) return directKey.trim();
    const settings = Storage.getSettings();
    if (settings?.groqApiKey?.trim()) return settings.groqApiKey.trim();
    const profile = Storage.getProfile();
    if (profile?.groqApiKey?.trim()) return profile.groqApiKey.trim();
    return '';
  },
  setGroqApiKey: (key: string): void => {
    const trimmed = key.trim();
    const scopedKey = getScopedKey('groq_api_key');
    if (trimmed) {
      localStorage.setItem(scopedKey, trimmed);
    } else {
      localStorage.removeItem(scopedKey);
    }
    const settings = Storage.getSettings();
    Storage.setSettings({ ...settings, groqApiKey: trimmed });
    const profile = Storage.getProfile();
    if (profile) {
      Storage.setProfile({ ...profile, groqApiKey: trimmed });
    }
  },
  removeGroqApiKey: (): void => {
    Storage.setGroqApiKey('');
  },

  getSections: (): DashboardSection[] => loadFromStorage(STORAGE_KEYS.SECTIONS, INITIAL_SECTIONS),
  setSections: (sections: DashboardSection[]) => saveToStorage(STORAGE_KEYS.SECTIONS, sections),

  getPhotos: (): Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }> =>
    loadFromStorage(STORAGE_KEYS.PHOTOS, []),
  setPhotos: (photos: Array<{ id: string; url: string; title: string; subtitle?: string; tag?: string }>) =>
    saveToStorage(STORAGE_KEYS.PHOTOS, photos),

  getResume: (): ResumeDocument => {
    const loaded = loadFromStorage<ResumeDocument | null>(STORAGE_KEYS.RESUME, null);
    if (!loaded) {
      const activeEmail = getCustomWorkspaceEmail();
      const cleanEmail = activeEmail && activeEmail !== 'guest@workspace.local' ? activeEmail : '';
      const cleanName = cleanEmail ? cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
      return {
        fileName: 'Resume.pdf',
        fileSize: '0 KB',
        uploadedAt: '',
        summary: '',
        contact: {
          name: cleanName,
          phone: '',
          email: cleanEmail,
          github: '',
          linkedin: '',
          location: '',
          portfolio: '',
        },
        skills: [],
        skillsByCategory: [],
        education: [],
        experiences: [],
        projects: [],
        certifications: [],
        additionalInfo: [],
      };
    }
    return loaded;
  },
  setResume: (resume: ResumeDocument) => saveToStorage(STORAGE_KEYS.RESUME, resume),

  getQuotes: (): QuoteItem[] => {
    const loaded = loadFromStorage<QuoteItem[]>(STORAGE_KEYS.QUOTES, []);
    return Array.isArray(loaded) ? loaded : [];
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

  getSchedule: (): WeeklyScheduleData => {
    const loaded = loadFromStorage<WeeklyScheduleData | null>(STORAGE_KEYS.SCHEDULE, null);
    if (!loaded || typeof loaded !== 'object' || loaded.version !== '2.0') {
      return INITIAL_SCHEDULE;
    }
    return {
      version: '2.0',
      weekdayTemplate: Array.isArray(loaded.weekdayTemplate) && loaded.weekdayTemplate.length > 0
        ? loaded.weekdayTemplate
        : INITIAL_SCHEDULE.weekdayTemplate,
      weekendTemplate: Array.isArray(loaded.weekendTemplate) && loaded.weekendTemplate.length > 0
        ? loaded.weekendTemplate
        : INITIAL_SCHEDULE.weekendTemplate,
      days: {
        monday: loaded.days?.monday || INITIAL_SCHEDULE.days.monday,
        tuesday: loaded.days?.tuesday || INITIAL_SCHEDULE.days.tuesday,
        wednesday: loaded.days?.wednesday || INITIAL_SCHEDULE.days.wednesday,
        thursday: loaded.days?.thursday || INITIAL_SCHEDULE.days.thursday,
        friday: loaded.days?.friday || INITIAL_SCHEDULE.days.friday,
        saturday: loaded.days?.saturday || INITIAL_SCHEDULE.days.saturday,
        sunday: loaded.days?.sunday || INITIAL_SCHEDULE.days.sunday,
      },
    };
  },
  setSchedule: (schedule: WeeklyScheduleData) => saveToStorage(STORAGE_KEYS.SCHEDULE, schedule),

  getHomeGridColumns: (): [string[], string[], string[]] => {
    const raw = loadFromStorage<any>(STORAGE_KEYS.HOME_GRID_ORDER, null);
    const validWidgets = new Set(['calendar', 'schedule', 'expenses', 'habits', 'tasks', 'scratchpad', 'screentime']);

    if (Array.isArray(raw) && raw.length === 3 && Array.isArray(raw[0]) && Array.isArray(raw[1]) && Array.isArray(raw[2])) {
      const col0 = raw[0].filter((w: string) => validWidgets.has(w));
      const col1 = raw[1].filter((w: string) => validWidgets.has(w));
      const col2 = raw[2].filter((w: string) => validWidgets.has(w));

      const present = new Set([...col0, ...col1, ...col2]);
      validWidgets.forEach((w) => {
        if (!present.has(w)) {
          if (w === 'tasks' || w === 'expenses' || w === 'screentime') col1.push(w);
          else if (w === 'schedule' || w === 'scratchpad') col2.push(w);
          else col0.push(w);
        }
      });
      return [col0, col1, col2];
    }

    // If stored as flat array from prior version, smartly distribute
    if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === 'string') {
      const flatItems = raw.filter((w: string) => validWidgets.has(w));
      validWidgets.forEach((w) => {
        if (!flatItems.includes(w)) flatItems.push(w);
      });
      const col0: string[] = ['calendar', 'habits'].filter((w) => flatItems.includes(w));
      const col1: string[] = ['tasks', 'expenses', 'screentime'].filter((w) => flatItems.includes(w));
      const col2: string[] = ['schedule', 'scratchpad'].filter((w) => flatItems.includes(w));
      return [col0, col1, col2];
    }

    return [
      [...DEFAULT_HOME_COLUMNS[0]],
      [...DEFAULT_HOME_COLUMNS[1]],
      [...DEFAULT_HOME_COLUMNS[2]],
    ];
  },
  setHomeGridColumns: (columns: [string[], string[], string[]]) => {
    saveToStorage(STORAGE_KEYS.HOME_GRID_ORDER, columns);
  },

  getHomeGridOrder: (): string[] => {
    const columns = Storage.getHomeGridColumns();
    return [...columns[0], ...columns[1], ...columns[2]];
  },
  setHomeGridOrder: (order: string[]) => {
    const col0: string[] = order.includes('calendar') ? ['calendar'] : [];
    const col1: string[] = order.includes('schedule') ? ['schedule'] : [];
    const col2: string[] = order.filter((w) => w !== 'calendar' && w !== 'schedule');
    Storage.setHomeGridColumns([col0, col1, col2]);
  },

  getHomeGridLayoutPreset: (): 'executive' | 'schedule-hero' | 'calendar-hero' | 'custom' => {
    return loadFromStorage<any>('notion_os_v4_home_grid_preset', 'executive');
  },
  setHomeGridLayoutPreset: (preset: 'executive' | 'schedule-hero' | 'calendar-hero' | 'custom') => {
    saveToStorage('notion_os_v4_home_grid_preset', preset);
  },

  getActiveAlarm: (): QuickAlarm | null => {
    return loadFromStorage<QuickAlarm | null>(STORAGE_KEYS.ALARM, null);
  },
  setActiveAlarm: (alarm: QuickAlarm | null) => {
    saveToStorage(STORAGE_KEYS.ALARM, alarm);
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('alarm-data-updated', { detail: { alarm } }));
      }
    } catch {}
  },

  getAlarmSnoozeInterval: (): number => {
    return loadFromStorage<number>(STORAGE_KEYS.ALARM_SNOOZE, 5);
  },
  setAlarmSnoozeInterval: (mins: number) => {
    saveToStorage(STORAGE_KEYS.ALARM_SNOOZE, mins);
  },

  // Command Mapping Storage
  getCommandMappings: (): CommandMapping[] => {
    try {
      const parsed = loadFromStorage<CommandMapping[] | null>(STORAGE_KEYS.COMMAND_MAPPINGS, null);
      if (!parsed) {
        saveToStorage(STORAGE_KEYS.COMMAND_MAPPINGS, DEFAULT_COMMAND_MAPPINGS);
        return DEFAULT_COMMAND_MAPPINGS;
      }
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingIds = new Set(parsed.map((m: any) => m.id));
        const missing = DEFAULT_COMMAND_MAPPINGS.filter((d) => !existingIds.has(d.id));
        if (missing.length > 0) {
          const merged = [...parsed, ...missing];
          saveToStorage(STORAGE_KEYS.COMMAND_MAPPINGS, merged);
          return merged;
        }
        return parsed;
      }
      return DEFAULT_COMMAND_MAPPINGS;
    } catch {
      return DEFAULT_COMMAND_MAPPINGS;
    }
  },
  setCommandMappings: (mappings: CommandMapping[]) => {
    try {
      saveToStorage(STORAGE_KEYS.COMMAND_MAPPINGS, mappings);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('command-mappings-updated', { detail: { mappings } }));
        window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: { module: 'command_mappings' } }));
      }
    } catch (e) {
      console.error('Failed to persist command mappings:', e);
    }
  },

  getScratchpad: (): string => {
    try {
      const saved = loadFromStorage<string>(STORAGE_KEYS.SCRATCHPAD, '');
      if (!saved) return '';
      // Cleanse legacy default sample notes if present so user never loses their clean state
      if (
        saved.includes('Jot down quick ideas') ||
        saved.includes('Auto-indented sticky note')
      ) {
        const cleaned = saved
          .replace(/- Jot down quick ideas, daily thoughts, or links\n?/g, '')
          .replace(/- Auto-indented sticky note for your flow\n?/g, '')
          .replace(/^- \n?$/g, '')
          .trim();
        const finalContent = (!cleaned || cleaned === '-') ? '' : cleaned;
        saveToStorage(STORAGE_KEYS.SCRATCHPAD, finalContent);
        return finalContent;
      }
      return saved;
    } catch {
      return '';
    }
  },
  setScratchpad: (content: string) => {
    try {
      saveToStorage(STORAGE_KEYS.SCRATCHPAD, content);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('scratchpad-updated', { detail: { content } }));
        window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: { module: 'scratchpad' } }));
      }
      void scratchpadWidgetService.syncToNativeWidget(content);
    } catch (e) {
      console.error('Failed to persist scratchpad:', e);
    }
  },

  sanitizeScreenTime: (data: ScreenTimeData): ScreenTimeData => {
    return sanitizeScreenTimeForStorage(data);
  },

  getScreenTimeData: (): ScreenTimeData | null => {
    const data = loadFromStorage<ScreenTimeData | null>(STORAGE_KEYS.SCREEN_TIME, null);
    if (data) {
      if (data.dataSource === 'simulatedBaseline') return null;
      // Filter out stale unverified mock 185m data with single Instagram app
      if (
        data.totalMinutes === 185 &&
        Array.isArray(data.apps) &&
        data.apps.length === 1 &&
        data.apps[0]?.packageName === 'com.instagram.android'
      ) {
        return null;
      }
    }
    return data;
  },
  setScreenTimeData: (data: ScreenTimeData): void => {
    try {
      if (
        data &&
        data.totalMinutes === 185 &&
        Array.isArray(data.apps) &&
        data.apps.length === 1 &&
        data.apps[0]?.packageName === 'com.instagram.android'
      ) {
        return;
      }
      const sanitized = sanitizeScreenTimeForStorage(data);
      saveToStorage(STORAGE_KEYS.SCREEN_TIME, sanitized);
      if (sanitized?.date) {
        const history = Storage.getScreenTimeHistory();
        history[sanitized.date] = sanitized;
        saveToStorage(STORAGE_KEYS.SCREEN_TIME_HISTORY, history);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('screentime-updated', { detail: { data: sanitized } }));
        window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: { module: 'screentime' } }));
      }
    } catch (e) {
      console.error('Failed to persist screen time:', e);
    }
  },
  getDailyScreenTime: (date: string): ScreenTimeData | null => {
    const history = Storage.getScreenTimeHistory();
    const item = history[date];
    if (item && item.dataSource !== 'simulatedBaseline') {
      if (
        !(item.totalMinutes === 185 &&
          Array.isArray(item.apps) &&
          item.apps.length === 1 &&
          item.apps[0]?.packageName === 'com.instagram.android')
      ) {
        return item;
      }
    }
    const latest = Storage.getScreenTimeData();
    if (latest && latest.dataSource !== 'simulatedBaseline') {
      if (
        !(latest.totalMinutes === 185 &&
          Array.isArray(latest.apps) &&
          latest.apps.length === 1 &&
          latest.apps[0]?.packageName === 'com.instagram.android')
      ) {
        if (latest.date === date) return latest;
        if (Array.isArray(latest.past7Days)) {
          const match = latest.past7Days.find((d) => d.date === date);
          if (match) {
            // Reconstruct apps list from match.appMinutes if present
            let reconstructedApps: AppUsageItem[] = [];
            if (match.appMinutes && typeof match.appMinutes === 'object') {
              const knownAppsMap = new Map<string, AppUsageItem>();
              (latest.apps || []).forEach((a) => {
                if (a.packageName) knownAppsMap.set(a.packageName, a);
              });

              reconstructedApps = Object.entries(match.appMinutes)
                .map(([pkg, mins]: [string, any], idx) => {
                  const m = Number(mins) || 0;
                  const known = knownAppsMap.get(pkg);
                  return {
                    packageName: pkg,
                    appName: known?.appName || resolveCleanAppName(pkg),
                    rank: idx + 1,
                    durationMinutes: m,
                    durationMillis: m * 60 * 1000,
                    sessionCount: known?.sessionCount || 1,
                    percentageOfTotal: match.totalMinutes > 0 ? Math.round((m / match.totalMinutes) * 100) : 0,
                    category: known?.category,
                    icon: known?.icon,
                    isSystemApp: known?.isSystemApp,
                  };
                })
                .filter((a) => a.durationMinutes > 0)
                .sort((a, b) => b.durationMinutes - a.durationMinutes);

              reconstructedApps.forEach((a, idx) => {
                a.rank = idx + 1;
              });
            }

            const formattedDate = new Date(date + 'T12:00:00').toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            });

            return {
              granted: true,
              isNativeAndroid: false,
              isFromApk: true,
              hasData: match.totalMinutes > 0,
              date,
              formattedDate,
              totalMinutes: match.totalMinutes,
              totalMillis: match.totalMillis || (match.totalMinutes * 60 * 1000),
              apps: reconstructedApps,
              topApps: reconstructedApps.slice(0, 5),
              hourlyUsage: [],
              past7Days: latest.past7Days,
              dailyAverageMinutes: latest.dailyAverageMinutes,
              lastSyncedTimestamp: latest.lastSyncedTimestamp,
              dataSource: (match as any).dataSource || 'usageEventsUnion',
            };
          }
        }
      }
    }
    return null;
  },
  setDailyScreenTime: (date: string, data: ScreenTimeData): void => {
    try {
      if (
        data &&
        data.totalMinutes === 185 &&
        Array.isArray(data.apps) &&
        data.apps.length === 1 &&
        data.apps[0]?.packageName === 'com.instagram.android'
      ) {
        return;
      }
      const sanitized = sanitizeScreenTimeForStorage(data);
      const history = Storage.getScreenTimeHistory();
      history[date] = sanitized;
      saveToStorage(STORAGE_KEYS.SCREEN_TIME_HISTORY, history);

      const today = getLocalDateString();
      // Only overwrite today's screen time if the date being set is today or if no screen time exists yet
      if (date === today || !Storage.getScreenTimeData()) {
        saveToStorage(STORAGE_KEYS.SCREEN_TIME, sanitized);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('screentime-updated', { detail: { data: sanitized } }));
        }
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dashboard-data-updated', { detail: { module: 'screentime' } }));
      }
    } catch (e) {
      console.error('Failed to persist daily screen time:', e);
    }
  },
  getScreenTimeHistory: (): Record<string, ScreenTimeData> => {
    const rawHistory = loadFromStorage<Record<string, ScreenTimeData>>(STORAGE_KEYS.SCREEN_TIME_HISTORY, {});
    const cleanHistory: Record<string, ScreenTimeData> = {};
    Object.entries(rawHistory || {}).forEach(([k, v]) => {
      if (v && v.dataSource !== 'simulatedBaseline') {
        cleanHistory[k] = v;
      }
    });
    return cleanHistory;
  },
  setScreenTimeHistory: (history: Record<string, ScreenTimeData>): void => {
    try {
      const sanitizedHistory: Record<string, ScreenTimeData> = {};
      Object.entries(history || {}).forEach(([k, v]) => {
        if (v) sanitizedHistory[k] = sanitizeScreenTimeForStorage(v);
      });
      saveToStorage(STORAGE_KEYS.SCREEN_TIME_HISTORY, sanitizedHistory);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('screentime-history-updated', { detail: { history: sanitizedHistory } }));
      }
    } catch (e) {
      console.error('Failed to persist screen time history:', e);
    }
  },

  getAllDataPayload: () => {
    return {
      version: '4.0.0',
      exportedAt: new Date().toISOString(),
      profile: Storage.getProfile(),
      todos: Storage.getTodos(),
      habits: Storage.getHabits(),
      habitHistory: Storage.getHabitHistory(),
      habitActiveWeek: Storage.getHabitActiveWeek(),
      habitActivities: Storage.getHabitActivities(),
      scratchpad: Storage.getScratchpad(),
      screenTime: Storage.getScreenTimeData(),
      screenTimeHistory: Storage.getScreenTimeHistory(),
      goals: Storage.getGoals(),
      vaultEncrypted: Storage.getEncryptedVaultBackup(),
      expenses: Storage.getExpenses(),
      excelImportLogs: Storage.getExcelImportLogs(),
      deletedSheetIds: Storage.getDeletedSheetIds(),
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
      schedule: Storage.getSchedule(),
      activeAlarm: Storage.getActiveAlarm(),
      alarmSnoozeInterval: Storage.getAlarmSnoozeInterval(),
      commandMappings: Storage.getCommandMappings(),
      trash: Storage.getTrash(),
      deletedExpenseIds: Storage.getDeletedExpenseIds(),
    };
  },

  importAllDataPayload: (data: any): boolean => {
    try {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
      const knownKeys = [
        'profile', 'todos', 'habits', 'goals', 'vaultEncrypted', 'vault',
        'expenses', 'excelImportLogs', 'deletedSheetIds', 'deletedExpenseIds', 'journal', 'media', 'achievements', 'doodles',
        'timeline', 'projects', 'skills', 'settings', 'sections',
        'photos', 'resume', 'quotes', 'exams', 'schedule', 'version', 'activeAlarm', 'alarmSnoozeInterval',
        'commandMappings', 'trash', 'scratchpad', 'screenTime', 'screenTimeHistory'
      ];
      const hasKnownKey = knownKeys.some((k) => k in data && data[k] !== undefined);
      if (!hasKnownKey) return false;

      const activeEmail = getCustomWorkspaceEmail();
      if (
        data.profile?.contactEmail &&
        activeEmail &&
        activeEmail !== 'guest@workspace.local' &&
        data.profile.contactEmail.toLowerCase().trim() !== activeEmail.toLowerCase().trim()
      ) {
        console.warn('[STORAGE_SECURITY] Ignored workspace payload for different user:', {
          payloadEmail: data.profile.contactEmail,
          activeEmail,
        });
        return false;
      }

      const remoteMeta = data._meta || {};
      const remoteTimestamp = Number(remoteMeta.syncVersion || remoteMeta.clientTimestamp || 0);

      if (Array.isArray(data.deletedSheetIds)) {
        const currentDeleted = Storage.getDeletedSheetIds();
        // Collect active log IDs and fileNames from both local and incoming
        const activeIds = new Set<string>();
        const activeNames = new Set<string>();
        Storage.getExcelImportLogs().forEach((l) => {
          if (l.id) activeIds.add(l.id.toLowerCase());
          if (l.fileName) {
            const lower = l.fileName.trim().toLowerCase();
            activeNames.add(lower);
            const base = lower.replace(/\.[^/.]+$/, '');
            if (base) activeNames.add(base);
          }
        });
        if (Array.isArray(data.excelImportLogs)) {
          data.excelImportLogs.forEach((l: any) => {
            if (l?.id) activeIds.add(String(l.id).toLowerCase());
            if (l?.fileName) {
              const lower = String(l.fileName).trim().toLowerCase();
              activeNames.add(lower);
              const base = lower.replace(/\.[^/.]+$/, '');
              if (base) activeNames.add(base);
            }
          });
        }

        const mergedDeleted = new Set(
          [...currentDeleted, ...data.deletedSheetIds].filter((idOrName) => {
            if (!idOrName || typeof idOrName !== 'string') return false;
            const lower = idOrName.trim().toLowerCase();
            const base = lower.replace(/\.[^/.]+$/, '');
            // Do not keep in deleted list if currently active
            if (activeIds.has(lower) || activeNames.has(lower) || (base && activeNames.has(base))) {
              return false;
            }
            return true;
          })
        );
        Storage.setDeletedSheetIds(Array.from(mergedDeleted));
      }

      if (data.profile) {
        const currentProfile = Storage.getProfile();
        const incomingAvatar = data.profile.avatarUrl;
        const currentAvatar = currentProfile.avatarUrl;
        const currentEmail = (currentProfile.contactEmail || activeEmail || getCustomWorkspaceEmail() || '').toLowerCase().trim();
        const incomingEmail = (data.profile.contactEmail || '').toLowerCase().trim();
        const isSameUser = Boolean(
          (!incomingEmail || !currentEmail || currentEmail === incomingEmail || (
            (currentEmail === 'gknayak@gmail.com' || currentEmail === 'gulnayak1206@gmail.com') &&
            (incomingEmail === 'gknayak@gmail.com' || incomingEmail === 'gulnayak1206@gmail.com')
          ))
        );

        const targetEmail = data.profile.contactEmail || currentEmail || '';
        const isGknUser = targetEmail === 'gknayak@gmail.com' || targetEmail === 'gulnayak1206@gmail.com' ||
                          currentEmail === 'gknayak@gmail.com' || currentEmail === 'gulnayak1206@gmail.com';

        const mergedProfile = isSameUser
          ? { ...data.profile, ...currentProfile }
          : { ...data.profile };

        const isGenericHandle = (str?: string | null) => {
          if (!str) return true;
          const s = str.trim().toLowerCase();
          return s === 'gknayak' || s === 'user' || s === 'guest' || s === '' || s === 'admin';
        };

        // Retain customized user name if current profile has a real non-generic name
        // and do not allow an older snapshot with "gknayak" or empty to revert it
        if (currentProfile.name && !isGenericHandle(currentProfile.name)) {
          mergedProfile.name = currentProfile.name.trim();
        } else if (data.profile.name && !isGenericHandle(data.profile.name)) {
          mergedProfile.name = data.profile.name.trim();
        } else if (isGknUser) {
          mergedProfile.name = 'Gulshan Kumar Nayak';
        }

        const defaultGknAvatar = 'https://amlegmbvqzbhqqqbrvjx.supabase.co/storage/v1/object/public/avatars/avatar_gknayak_gmail_com_1792214229699.webp';
        if (currentAvatar && isAvatarMatchingUserEmailDomain(currentAvatar, targetEmail)) {
          mergedProfile.avatarUrl = currentAvatar;
        } else if (incomingAvatar && isAvatarMatchingUserEmailDomain(incomingAvatar, targetEmail)) {
          mergedProfile.avatarUrl = incomingAvatar;
        } else if (isGknUser) {
          mergedProfile.avatarUrl = defaultGknAvatar;
        } else {
          mergedProfile.avatarUrl = '';
        }

        console.info('[PROFILE_TRACE] Storage.importAllDataPayload merged profile:', {
          incomingName: data.profile.name,
          currentName: currentProfile.name,
          resolvedName: mergedProfile.name,
          resolvedAvatar: mergedProfile.avatarUrl ? (mergedProfile.avatarUrl.slice(0, 30) + '...') : '',
        });

        Storage.setProfile(mergedProfile);
      }
      if (data.todos) Storage.setTodos(data.todos);
      if (Array.isArray(data.habits)) {
        const targetEmail = activeEmail || getCustomWorkspaceEmail() || '';
        const isGknUser = targetEmail === 'gknayak@gmail.com' || targetEmail === 'gulnayak1206@gmail.com';
        const localHabits = Storage.getHabits();
        const trash = Storage.getTrash().filter((t) => t.module === 'habits');
        const trashedIds = new Set<string>();
        trash.forEach((t) => {
          if (t.data?.id) trashedIds.add(String(t.data.id).trim());
          if (typeof t.data === 'string' && t.data.trim()) trashedIds.add(t.data.trim());
          if (t.id) trashedIds.add(String(t.id).trim());
        });

        // Filter out trashed habits from cloud
        const validCloudHabits = data.habits.filter((h: any) => h && h.id && !trashedIds.has(String(h.id).trim()));

        // Merge localHabits and validCloudHabits
        const habitMap = new Map<string, HabitItem>();
        // Add valid local habits that are not trashed
        localHabits.forEach((h) => {
          if (h && h.id && !trashedIds.has(String(h.id).trim())) {
            habitMap.set(h.id, h);
          }
        });

        // Merge cloud habits
        validCloudHabits.forEach((ch: any) => {
          if (!ch || !ch.id) return;
          const existing = habitMap.get(ch.id);
          if (existing) {
            const localUpdated = Number(existing.updatedAt || 0);
            const cloudUpdated = Number(ch.updatedAt || remoteTimestamp || 0);
            if (cloudUpdated > localUpdated) {
              // Newer cloud habit takes precedence for completion/streak, preserving local title/category if missing in cloud
              habitMap.set(ch.id, {
                ...existing,
                ...ch,
                title: ch.title || existing.title,
                category: ch.category || existing.category,
              });
            } else {
              // Local is newer or equal: preserve local edits and merge completedDays
              const mergedDays = [false, false, false, false, false, false, false];
              for (let i = 0; i < 7; i++) {
                mergedDays[i] = Boolean(existing.completedDays?.[i] || ch.completedDays?.[i]);
              }
              habitMap.set(ch.id, {
                ...ch,
                ...existing,
                completedDays: mergedDays,
                streak: Math.max(existing.streak || 0, ch.streak || 0),
              });
            }
          } else {
            habitMap.set(ch.id, ch);
          }
        });

        if (habitMap.size === 0 && isGknUser) {
          OWNER_GKN_HABITS.forEach((h) => habitMap.set(h.id, h));
        }

        Storage.setHabits(Array.from(habitMap.values()));
      }
      if (Array.isArray(data.habitHistory)) {
        Storage.setHabitHistory(data.habitHistory);
      }
      if (typeof data.habitActiveWeek === 'string' && data.habitActiveWeek.trim()) {
        const localWeek = Storage.getHabitActiveWeek().replace(/^week-/, '').trim();
        const cleanCloudWeek = data.habitActiveWeek.replace(/^week-/, '').trim();
        const currentWeekMonday = getWeekId(new Date()).replace(/^week-/, '').trim();
        if (!localWeek) {
          Storage.setHabitActiveWeek(cleanCloudWeek);
        } else if (cleanCloudWeek < currentWeekMonday && localWeek >= currentWeekMonday) {
          // Local is already on current calendar week; NEVER revert to older week from cloud
        } else if (cleanCloudWeek >= localWeek) {
          Storage.setHabitActiveWeek(cleanCloudWeek);
        }
      }
      if (Array.isArray(data.habitActivities)) {
        if (remoteTimestamp > 0) {
          const cloudActIds = new Set(data.habitActivities.map((a: any) => a?.id).filter(Boolean));
          const localActs = Storage.getHabitActivities();
          // Keep only newly recorded local activities created strictly after remote snapshot
          const newLocalActs = localActs.filter((a) => {
            return !cloudActIds.has(a.id) && (a.timestamp || 0) > remoteTimestamp;
          });
          const merged = [...data.habitActivities, ...newLocalActs];
          Storage.setHabitActivities(merged.slice(0, 500));
        } else {
          const localActs = Storage.getHabitActivities();
          const actMap = new Map<string, HabitActivityLog>();
          localActs.forEach((a) => { if (a && a.id) actMap.set(a.id, a); });
          data.habitActivities.forEach((a: any) => {
            if (a && a.id && !actMap.has(a.id)) {
              actMap.set(a.id, a);
            }
          });
          Storage.setHabitActivities(Array.from(actMap.values()).slice(0, 500));
        }
      }
      if (typeof data.scratchpad === 'string') {
        Storage.setScratchpad(data.scratchpad);
      }
      if (data.goals) Storage.setGoals(data.goals);
      if (data.vaultEncrypted) Storage.restoreEncryptedVault(data.vaultEncrypted);
      else if (data.vault) Storage.restoreEncryptedVault(null);

      if (Array.isArray(data.trash)) {
        const localTrash = Storage.getTrash();
        const trashMap = new Map<string, TrashItem>();
        localTrash.forEach((t) => { if (t && t.id) trashMap.set(t.id, t); });
        data.trash.forEach((t: any) => { if (t && t.id) trashMap.set(t.id, t); });
        Storage.setTrash(Array.from(trashMap.values()).slice(0, 200));
      }

      if (Array.isArray(data.expenses)) {
        const currentLocal = Storage.getExpenses();
        const trash = Storage.getTrash().filter((t) => t.module === 'expenses');
        const trashedIds = new Set<string>();
        trash.forEach((t) => {
          if (t.data?.id) trashedIds.add(String(t.data.id).trim());
          if (typeof t.data === 'string' && t.data.trim()) trashedIds.add(t.data.trim());
          if (t.id) trashedIds.add(String(t.id).trim());
        });

        // Also incorporate any explicit deletedExpenseIds from metadata or payload
        const metaDeleted = data._meta?.deletedExpenseIds || data.deletedExpenseIds;
        if (Array.isArray(metaDeleted)) {
          Storage.recordDeletedExpenseId(metaDeleted);
          metaDeleted.forEach((id: string) => {
            if (id) trashedIds.add(String(id).trim());
          });
        }
        Storage.getDeletedExpenseIds().forEach((id) => {
          if (id) trashedIds.add(String(id).trim());
        });

        const remoteMeta = data._meta || {};
        const remoteTimestamp = Number(remoteMeta.syncVersion || remoteMeta.clientTimestamp || 0);
        const isRemoteClearAll = Boolean(remoteMeta.clearedAllExpenses);

        if (isRemoteClearAll) {
          // Authoritative remote clear-all: only preserve items created locally AFTER clear-all
          const preservedLocal = currentLocal.filter((localExp) => {
            if (!localExp || !localExp.id) return false;
            const id = String(localExp.id).trim();
            if (trashedIds.has(id) || Storage.isExpenseDeleted(id)) return false;
            const localCreated = Number(localExp.createdAt || 0);
            return localCreated > remoteTimestamp;
          });
          Storage.setExpenses(preservedLocal);
        } else {
          // Authoritative cloud expenses, strictly excluding any trashed IDs OR deleted sheet items OR deleted expense tombstones
          const validCloudExpenses = data.expenses.filter((e: any) => {
            if (!e || !e.id) return false;
            const id = String(e.id).trim();
            if (trashedIds.has(id)) return false;
            if (Storage.isExpenseDeleted(id)) return false;
            if (Storage.isSheetDeleted(e.importBatchId) || Storage.isSheetDeleted(e.sourceFile)) {
              return false;
            }
            return true;
          });

          const finalExpenses = Storage.mergeExpenseLists(currentLocal, validCloudExpenses);
          Storage.setExpenses(finalExpenses);
        }
      }
      if (Array.isArray(data.excelImportLogs)) {
        // Merge spreadsheet logs so local sheet uploads are not wiped by older cloud snapshots
        // and NEVER revive sheets that have been deleted
        const currentLogs = Storage.getExcelImportLogs();
        const logMap = new Map<string, ExcelImportLog>();
        currentLogs.forEach((l) => {
          if (l && l.id && !Storage.isSheetDeleted(l.id) && !Storage.isSheetDeleted(l.fileName)) {
            logMap.set(l.id, l);
          }
        });
        data.excelImportLogs.forEach((l: any) => {
          if (l && l.id && !logMap.has(l.id) && !Storage.isSheetDeleted(l.id) && !Storage.isSheetDeleted(l.fileName)) {
            logMap.set(l.id, l);
          }
        });
        Storage.setExcelImportLogs(Array.from(logMap.values()));
      }

      if (Array.isArray(data.journal)) Storage.setJournal(data.journal);
      if (Array.isArray(data.media)) Storage.setMedia(data.media);
      if (Array.isArray(data.achievements)) Storage.setAchievements(data.achievements);
      if (Array.isArray(data.doodles)) Storage.setDoodles(data.doodles);
      if (Array.isArray(data.timeline)) Storage.setTimeline(data.timeline);
      if (Array.isArray(data.projects)) Storage.setProjects(data.projects);
      if (Array.isArray(data.skills)) Storage.setSkills(data.skills);
      if (data.settings && typeof data.settings === 'object') Storage.setSettings(data.settings);
      if (Array.isArray(data.sections)) Storage.setSections(data.sections);
      if (Array.isArray(data.photos)) Storage.setPhotos(data.photos);
      if (data.resume && typeof data.resume === 'object') Storage.setResume(data.resume);
      if (Array.isArray(data.quotes)) Storage.setQuotes(data.quotes);
      if (Array.isArray(data.exams)) Storage.setExams(data.exams);
      if (data.schedule && typeof data.schedule === 'object') Storage.setSchedule(data.schedule);
      if ('activeAlarm' in data) {
        Storage.setActiveAlarm(data.activeAlarm ?? null);
      }
      if ('alarmSnoozeInterval' in data && typeof data.alarmSnoozeInterval === 'number') {
        Storage.setAlarmSnoozeInterval(data.alarmSnoozeInterval);
      }
      if (Array.isArray(data.commandMappings)) {
        Storage.setCommandMappings(data.commandMappings);
      }
      if (data.screenTime && typeof data.screenTime === 'object') {
        const isCurrentNativeApk =
          typeof Capacitor !== 'undefined' &&
          Capacitor.isNativePlatform() &&
          Capacitor.getPlatform() === 'android';

        const currentLocal = Storage.getScreenTimeData();
        const incoming = data.screenTime;
        const isIncomingFromApk = Boolean(
          incoming.isFromApk ||
          incoming.isNativeAndroid ||
          incoming.dataSource === 'usageEventsUnion' ||
          incoming.dataSource === 'usageStatsFallback' ||
          incoming.dataSource === 'android_native_apk' ||
          incoming.dataSource === 'usageStats' ||
          incoming.dataSource === 'synced' ||
          (Array.isArray(incoming.apps) && incoming.apps.some((a: any) => a?.packageName && a.packageName.includes('.'))) ||
          (Array.isArray(incoming.past7Days) && incoming.past7Days.length > 0)
        );

        if (isCurrentNativeApk) {
          // Native APK device is the authoritative source; only update if incoming is confirmed APK and strictly newer
          if (isIncomingFromApk && (incoming.lastSyncedTimestamp || 0) > (currentLocal?.lastSyncedTimestamp || 0)) {
            Storage.setScreenTimeData(incoming);
          }
        } else {
          // Chrome/Web version: fetch recent details from APK version; ignore non-APK screen times
          if (isIncomingFromApk) {
            if (!currentLocal || (incoming.lastSyncedTimestamp || 0) >= (currentLocal.lastSyncedTimestamp || 0)) {
              Storage.setScreenTimeData(incoming);
            }
          }
        }
      }
      if (data.screenTimeHistory && typeof data.screenTimeHistory === 'object') {
        const currentHistory = Storage.getScreenTimeHistory();
        const mergedHistory = { ...currentHistory };
        Object.entries(data.screenTimeHistory).forEach(([d, val]: [string, any]) => {
          if (val && typeof val === 'object') {
            const isEntryFromApk = Boolean(
              val.isFromApk ||
              val.isNativeAndroid ||
              val.dataSource === 'usageEventsUnion' ||
              val.dataSource === 'usageStatsFallback' ||
              val.dataSource === 'android_native_apk' ||
              val.dataSource === 'usageStats' ||
              val.dataSource === 'synced' ||
              (Array.isArray(val.apps) && val.apps.some((a: any) => a?.packageName && a.packageName.includes('.'))) ||
              (Array.isArray(val.past7Days) && val.past7Days.length > 0)
            );
            if (isEntryFromApk) {
              const existing = mergedHistory[d];
              if (!existing || (val.lastSyncedTimestamp || 0) >= (existing.lastSyncedTimestamp || 0)) {
                mergedHistory[d] = sanitizeScreenTimeForStorage(val);
              }
            }
          }
        });
        Storage.setScreenTimeHistory(mergedHistory);
      }
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
    const activeEmail = getCustomWorkspaceEmail();
    const cleanEmail = activeEmail && activeEmail !== 'guest@workspace.local' ? activeEmail.toLowerCase().trim() : '';
    const cleanName = cleanEmail ? cleanEmail.split('@')[0].replace(/[\._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    Storage.setProfile({
      ...BLANK_PROFILE,
      name: cleanName,
      contactEmail: cleanEmail,
      handle: cleanEmail ? `@${cleanEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '')}` : '',
      avatarUrl: '',
    });
    Storage.setTodos([]);
    Storage.setHabits([]);
    Storage.setHabitHistory([]);
    Storage.setHabitActiveWeek('');
    Storage.setHabitActivities([]);
    Storage.setGoals([]);
    localStorage.removeItem(getVaultStorageKey());
    vaultCache = [];
    Storage.setExpenses([]);
    Storage.setJournal([]);
    Storage.setMedia([]);
    Storage.setAchievements([]);
    Storage.setDoodles([]);
    Storage.setTimeline([]);
    Storage.setProjects([]);
    Storage.setSkills([]);
    Storage.setSettings(INITIAL_SETTINGS);
    Storage.setSections([]);
    Storage.setPhotos([]);
    Storage.setResume({
      fileName: 'Resume.pdf',
      fileSize: '0 KB',
      uploadedAt: '',
      summary: '',
      contact: {
        name: cleanName,
        phone: '',
        email: cleanEmail,
        github: '',
        linkedin: '',
        location: '',
        portfolio: '',
      },
      skills: [],
      skillsByCategory: [],
      education: [],
      experiences: [],
      projects: [],
      certifications: [],
      additionalInfo: [],
    });
    Storage.setQuotes([]);
    Storage.setExams([]);
    Storage.setSchedule(INITIAL_SCHEDULE);
    Storage.setCommandMappings(DEFAULT_COMMAND_MAPPINGS);
  },

  recordApiRequest: (provider: 'gemini' | 'groq'): void => {
    try {
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const allRecords = loadFromStorage<Record<string, ApiUsageMonthlyRecord>>(
        STORAGE_KEYS.API_REQUEST_COUNTS,
        {}
      );
      const monthRecord = allRecords[monthKey] || { gemini: 0, groq: 0 };
      if (provider === 'gemini') {
        monthRecord.gemini = (monthRecord.gemini || 0) + 1;
        monthRecord.lastGeminiTime = Date.now();
      } else {
        monthRecord.groq = (monthRecord.groq || 0) + 1;
        monthRecord.lastGroqTime = Date.now();
      }
      monthRecord.lastUsed = Date.now();
      allRecords[monthKey] = monthRecord;
      saveToStorage(STORAGE_KEYS.API_REQUEST_COUNTS, allRecords);

      const threshold = Storage.getApiMonthlyThreshold();
      const currentTotal = (monthRecord.gemini || 0) + (monthRecord.groq || 0);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('lifeos_api_request_recorded', {
            detail: { provider, monthKey, counts: monthRecord, threshold, total: currentTotal },
          })
        );

        if (threshold && threshold > 0) {
          const percent = Math.round((currentTotal / threshold) * 100);
          if (currentTotal >= threshold) {
            window.dispatchEvent(
              new CustomEvent('lifeos_api_threshold_warning', {
                detail: {
                  level: 'limit_reached',
                  current: currentTotal,
                  limit: threshold,
                  percent,
                  message: `Monthly API usage limit reached: ${currentTotal} of ${threshold} requests used (${percent}%).`,
                },
              })
            );
          } else if (currentTotal >= Math.floor(threshold * 0.8)) {
            window.dispatchEvent(
              new CustomEvent('lifeos_api_threshold_warning', {
                detail: {
                  level: 'approaching',
                  current: currentTotal,
                  limit: threshold,
                  percent,
                  message: `Approaching monthly API usage threshold: ${currentTotal} of ${threshold} requests used (${percent}%).`,
                },
              })
            );
          }
        }
      }
    } catch (err) {
      console.warn('Failed to record API request:', err);
    }
  },

  getApiMonthlyThreshold: (): number | null => {
    const raw = loadFromStorage<number | null>(STORAGE_KEYS.API_MONTHLY_THRESHOLD, null);
    if (typeof raw === 'number' && raw > 0) return raw;
    return null;
  },

  setApiMonthlyThreshold: (threshold: number | null): void => {
    saveToStorage(STORAGE_KEYS.API_MONTHLY_THRESHOLD, threshold && threshold > 0 ? threshold : null);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('lifeos_api_threshold_changed', {
          detail: { threshold },
        })
      );
    }
  },

  getApiRequestCountsThisMonth: (): ApiMonthlyStats => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthName = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

    const allRecords = loadFromStorage<Record<string, ApiUsageMonthlyRecord>>(
      STORAGE_KEYS.API_REQUEST_COUNTS,
      {}
    );
    const rec = allRecords[monthKey] || { gemini: 0, groq: 0 };
    const gemini = rec.gemini || 0;
    const groq = rec.groq || 0;
    const total = gemini + groq;
    const threshold = Storage.getApiMonthlyThreshold();
    const percentUsed = threshold && threshold > 0 ? Math.round((total / threshold) * 100) : undefined;
    const isApproachingLimit = threshold && threshold > 0 ? total >= Math.floor(threshold * 0.8) && total < threshold : false;
    const isLimitReached = threshold && threshold > 0 ? total >= threshold : false;
    const remainingRequests = threshold && threshold > 0 ? Math.max(0, threshold - total) : undefined;

    return {
      monthKey,
      monthName,
      gemini,
      groq,
      total,
      threshold,
      percentUsed,
      isApproachingLimit,
      isLimitReached,
      remainingRequests,
      lastGeminiTime: rec.lastGeminiTime,
      lastGroqTime: rec.lastGroqTime,
    };
  },

  resetApiRequestCounts: (provider?: 'gemini' | 'groq'): void => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const allRecords = loadFromStorage<Record<string, ApiUsageMonthlyRecord>>(
      STORAGE_KEYS.API_REQUEST_COUNTS,
      {}
    );
    if (!allRecords[monthKey]) return;
    if (!provider) {
      allRecords[monthKey].gemini = 0;
      allRecords[monthKey].groq = 0;
    } else if (provider === 'gemini') {
      allRecords[monthKey].gemini = 0;
    } else if (provider === 'groq') {
      allRecords[monthKey].groq = 0;
    }
    saveToStorage(STORAGE_KEYS.API_REQUEST_COUNTS, allRecords);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lifeos_api_request_recorded', { detail: {} }));
    }
  },

  isSmsAutoTrackingEnabled: (): boolean => {
    return loadFromStorage<boolean>(STORAGE_KEYS.SMS_AUTO_TRACKING_ENABLED, false);
  },

  setSmsAutoTrackingEnabled: (enabled: boolean): void => {
    saveToStorage(STORAGE_KEYS.SMS_AUTO_TRACKING_ENABLED, enabled);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sms_tracking_toggled', { detail: { enabled } }));
    }
  },

  getProcessedSmsFingerprints: (): string[] => {
    return loadFromStorage<string[]>(STORAGE_KEYS.SMS_PROCESSED_FINGERPRINTS, []);
  },

  clearProcessedSmsFingerprints: (): void => {
    saveToStorage(STORAGE_KEYS.SMS_PROCESSED_FINGERPRINTS, []);
  },

  addProcessedSmsFingerprint: (fingerprint: string): void => {
    if (!fingerprint) return;
    const current = loadFromStorage<string[]>(STORAGE_KEYS.SMS_PROCESSED_FINGERPRINTS, []);
    if (!current.includes(fingerprint)) {
      const updated = [fingerprint, ...current].slice(0, 500);
      saveToStorage(STORAGE_KEYS.SMS_PROCESSED_FINGERPRINTS, updated);
    }
  },

  getSmsTransactionLogs: (): SmsTransactionLogItem[] => {
    return loadFromStorage<SmsTransactionLogItem[]>(STORAGE_KEYS.SMS_TRANSACTION_LOGS, []);
  },

  addSmsTransactionLog: (logItem: SmsTransactionLogItem): void => {
    const current = loadFromStorage<SmsTransactionLogItem[]>(STORAGE_KEYS.SMS_TRANSACTION_LOGS, []);
    const updated = [logItem, ...current].slice(0, 100);
    saveToStorage(STORAGE_KEYS.SMS_TRANSACTION_LOGS, updated);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sms_transaction_logged', { detail: logItem }));
    }
  },

  clearSmsTransactionLogs: (): void => {
    saveToStorage(STORAGE_KEYS.SMS_TRANSACTION_LOGS, []);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sms_transaction_logged', { detail: null }));
    }
  },

  getSmsWriteRetryQueue: (): SmsWriteRetryItem[] => {
    return loadFromStorage<SmsWriteRetryItem[]>(STORAGE_KEYS.SMS_WRITE_RETRY_QUEUE, []);
  },
  setSmsWriteRetryQueue: (queue: SmsWriteRetryItem[]): void => {
    saveToStorage(STORAGE_KEYS.SMS_WRITE_RETRY_QUEUE, Array.isArray(queue) ? queue : []);
  },
  addSmsWriteRetryItem: (item: SmsWriteRetryItem): void => {
    const current = Storage.getSmsWriteRetryQueue();
    const filtered = current.filter((i) => i.id !== item.id && i.expense?.id !== item.expense?.id);
    Storage.setSmsWriteRetryQueue([...filtered, item].slice(0, 100));
  },
  removeSmsWriteRetryItem: (idOrExpenseId: string): void => {
    const current = Storage.getSmsWriteRetryQueue();
    const updated = current.filter((i) => i.id !== idOrExpenseId && i.expense?.id !== idOrExpenseId);
    Storage.setSmsWriteRetryQueue(updated);
  },
  clearSmsWriteRetryQueue: (): void => {
    Storage.setSmsWriteRetryQueue([]);
  },
};
