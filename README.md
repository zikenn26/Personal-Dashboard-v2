# Personalized Dashboard

A private-first, local-first personal productivity workspace, dashboard, and portfolio system built with modern React, TypeScript, Tailwind CSS, Web Cryptography, and Supabase Realtime.

Designed to serve as a unified digital headquarters for daily planning, competitive examination prep, habit building, financial management, creative journaling, and professional career showcases.

---

## 🌟 Core Modules & Capabilities

The application is structured into interconnected personal productivity, organization, and career modules:

### 🏠 1. Command Center & Dynamic Home Dashboard
- **Customizable Modular Grid**: Reorderable 3-column widget layout with intuitive drag-and-drop handles and persistent arrangement presets.
- **Flip Clock & Cross-Device Alarm**:
  - Three distinct aesthetic display modes: **Chronometer**, **Analog Dial**, and **Soft Cards**.
  - One-tap minute presets (`+5m`, `+10m`, `+15m`, `+25m`, `+45m`) and a precise 24-hour time selector.
  - Sub-30ms cross-device synchronization: setting, snoozing (configurable 5m / 10m intervals), dismissing, or deleting alarms instantly mirrors across all active sessions and devices.
  - Soft harmonic chime alerts, browser push notifications, and visual pulsing overlays.
- **Dynamic Daily Routine & Schedule**:
  - Interactive timeline showing daily routines, current active block highlights, and progress tracking.
  - Weekday and Weekend master templates with granular per-day overrides.
- **Indian Cultural & Gregorian Calendar**:
  - Integrated Hindu Panchang metrics (Tithi, Paksha, Nakshatra, Rashi) and auspicious festive reminders alongside standard Gregorian calendar navigation.
- **Rapid Quick Capture**: Floating command input for instant task logging, diary entries, expenses, habits, or media captures without leaving the screen.
- **Inspiration Slideshow**: Curated quotes carousel with author attribution, randomizer, and one-click copy to clipboard.
- **Visual Photo Ribbon**: Aesthetic gallery slideshow for personal vision boards and memorable snapshots.

---

### 🤖 2. Zikenn AI Assistant & Secretary
- **Conversational Intelligence**: High-speed AI companion powered by Groq-accelerated models (`openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, `qwen/qwen3.6-27b`).
- **Autonomous Tool Calling**: Directly manages workspace data via natural language commands (e.g., adding tasks, logging expenses, toggling habits, creating journal entries, or querying schedule blocks).
- **Interactive Action Chips**: Contextual recommendation pills for rapid follow-up inquiries and quick actions.
- **AI Secretary Widget**: Compact home drawer for swift queries, morning briefings, and agenda summaries.

---

### 🎓 3. Competitive Exams & Syllabus Tracker
- **Multi-Stage Examination Planner**: Organize rigorous exam milestones across Prelims, Mains, and Interview phases.
- **Hierarchical Syllabus Breakdown**:
  - Nested structure covering Subjects, Chapters, and granular Topics.
  - Three-state progress tracking (*Not Started*, *In Progress*, *Completed*) with real-time percentage progress bars.
- **Study Materials & Books Tracker**: Curated repository of reference textbooks, edition tracking, reading progress, and revision notes.
- **Target Countdown Engine**: Precision countdown timers calculating days, hours, and minutes remaining until exam day.

---

### ☑️ 4. Tasks & Kanban Board
- **Fluid Kanban Workflow**: Visual card columns for *To Do*, *In Progress*, *In Review*, and *Completed*.
- **Priority & Due Dates**: Four priority tiers (*Urgent*, *High*, *Medium*, *Low*), categorization tags, and visual due-date alerts.
- **Rich Task Metadata**: Checklist subtasks, descriptions, completion sound feedback, and celebratory confetti effects.
- **Search & Filters**: Instant filtering by status, priority, and category, paired with one-click cleanup of finished tasks.

---

### ⚡ 5. Daily Habits & Routine Matrix
- **7-Day Interactive Matrix**: Monday-to-Sunday weekly habit grid with category tagging and customizable iconography.
- **Automated Monday Rollover**: Intelligently archives each completed week into historical records (`HabitWeekRecord`) while maintaining active streaks without data loss.
- **Accountability Analytics**: Calculates weekly completion percentages, active day streaks, and historical consistency metrics.

---

### 🎯 6. Goals & Milestones Hub
- **Objective Roadmaps**: Categorized short-term and long-term targets with status tracking (*Active*, *Completed*, *On Hold*).
- **Milestone Checklists**: Incremental milestone steps that dynamically drive visual percentage progress bars (0–100%).
- **Target Deadlines**: Clear target dates and impact assessments to maintain focus on high-leverage goals.

---

### 💼 7. Workfolio & Career Showcase
- **Interactive Bio & Profile**: Editable profile with handle, caption, social channels, and custom avatar selection.
- **Embedded Resume Viewer**: Built-in document sheet supporting embedded PDF rendering, zoom controls, and custom resume file uploads.
- **Project Showcase**: Highlight software engineering projects with tech stack badges, live demo URLs, GitHub repository links, and featured tags.
- **Skills Matrix**: Categorized technical proficiencies (Frontend, Backend, Cloud/DevOps, Database, etc.) with mastery ratings.
- **Professional Background**: Structured sections for Education credentials, Job Experience history, Certifications, Languages, and Personal Hobbies.

---

### 📖 8. Dear Diary & Reflective Journal
- **Thematic Canvas Backgrounds**: Choice of aesthetic journal textures (*Parchment*, *Midnight*, *Lavender*, *Lined Paper*, *Dotted Grid*, and *Clean Minimal*).
- **Daily Reflection Metrics**: Integrated tracking for mood, weather indicators, and physical/mental energy levels.
- **Zero-Knowledge PIN Lock**: PIN-protected private entries preventing unauthorized reading during shared screen sessions.

---

### 💳 9. Spending, Subscriptions & Excel Parser
- **Expense & Income Logging**: Comprehensive transaction ledger with categories, payment methods, and multi-currency support (₹, $, €, £).
- **Subscription Management**: Tracks recurring billing cycles (*Monthly*, *Quarterly*, *Yearly*, *One-time*) with upcoming renewal notices and monthly burn rate calculations.
- **Excel & CSV Import Engine**:
  - Direct upload and parsing of `.xlsx` and `.csv` bank statements or custom expense spreadsheets.
  - Smart header detection, category mapping, duplicate prevention, and batch import audit logs.
  - Floating undo toast for instantaneous reversal of accidental deletions.

---

### 🔐 10. Client-Side Encrypted Password Vault
- **Zero-Knowledge Architecture**: Credentials are encrypted client-side using the native Web Cryptography API (`window.crypto.subtle`) before touching storage.
- **Cryptographic Specifications**:
  - **Cipher**: **AES-GCM-256** (Authenticated Encryption with Associated Data).
  - **Key Derivation**: **PBKDF2** with **HMAC-SHA-256** using **210,000 iterations** (OWASP security standard).
  - **Cryptographic Nonce & Salt**: 16-byte cryptographically secure random salt and 12-byte initialization vector (IV) per encryption pass.
- **Credential Tools**: Master PIN authentication, password strength analyzer, copy-to-clipboard with auto-clear, and a cryptographically secure random password generator.
- **Safe Persistence**: Local storage and cloud backups only ever hold ciphertext payloads. Plaintext secrets exist solely in transient memory while the vault is unlocked.

---

### 🎬 11. Media Library & Reading Lounge
- **Multi-Category Entertainment**: Track Books, Movies, TV Series, Video Games, and Podcasts.
- **Status Workflows**: Categorize items as *Want to Consume*, *Currently In Progress*, *Completed*, or *Dropped*.
- **Reviews & Ratings**: 5-star rating system, personalized review notes, and cover artwork displays.

---

### 🗺️ 12. Life Map & Achievements Wall
- **Chronological Milestone Roadmap**: Visual timeline mapping academic, career, personal, and life milestones.
- **Achievements Showcase**: Digital trophy shelf highlighting certifications, awards, and milestones.
- **Interactive Doodle Canvas**: Built-in canvas sketchpad with custom brush sizes, colors, and snapshot saving.

---

### ⌘ 13. Command Palette (Cmd+K / Ctrl+K)
- **Universal Fuzzy Search**: Instantly navigate between every module, find specific tasks, search journal entries, or locate media items.
- **System Controls**: One-stroke dark mode toggling, sound feedback control, quick data export, and direct link navigation.

---

## 🔄 Cloud Synchronization & Multi-Device Sessions

The platform operates on a **Local-First, Cloud-Synchronized** architecture:

1. **Local-First Reliability**: All data is immediately persisted to user-scoped browser `localStorage`. The app works fully offline with zero latency.
2. **Supabase Realtime Sync**:
   - Automated debounced synchronization to PostgreSQL (`public.user_workspaces`).
   - Real-time WebSocket replication: changes made on desktop instantly appear on mobile or tablet in under 30 milliseconds without page refresh.
3. **Multi-Device Session Management**:
   - Device registry tracking active logins (device name, browser type, operating system, last active timestamp).
   - Remote session revocation: log out any stale or foreign device directly from Account Settings.
4. **Data Portability & Zero-Knowledge Backups**:
   - One-click JSON backup export (`Personal_Dashboard_Backup_<YYYY-MM-DD>.json`).
   - Deep schema validation on import with structural integrity checks.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite |
| **Styling & Animation** | Tailwind CSS v4, Motion / Framer Motion, Radix UI primitives |
| **Icons & UI** | Lucide React, Sonner (Toasts), CMDK (Command Palette) |
| **Charts & Graphics** | Recharts, HTML2Canvas, jsPDF |
| **File & Data Parsing** | XLSX (SheetJS) for Excel/CSV parsing |
| **Backend & Server** | Node.js, Express, ESBuild |
| **API Proxies** | Groq AI Proxy, Supabase Proxy (CORS/iframe sandboxing support) |
| **Cryptography** | Native Web Cryptography API (`crypto.subtle`), AES-GCM-256, PBKDF2-SHA-256 |
| **Persistence** | LocalStorage + Supabase PostgreSQL & Realtime Broadcast Channels |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd personal-dashboard
npm install
```

### 2. Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```

Configure your secrets in `.env`:
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Groq AI Service (Optional for Zikenn AI Assistant)
GROQ_API_KEY=your-groq-api-key
```

### 3. Start Development Server
```bash
npm run dev
```
The application will be accessible at `http://0.0.0.0:3000`.

### 4. Build for Production
```bash
npm run build
```
Compiles the client bundle via Vite and bundles the Node.js Express server into `dist/`.

### 5. Run Production Server
```bash
npm start
```

### 6. Code Quality & Testing
```bash
# Type check and lint codebase
npm run lint

# Run automated tests (cryptography, backup verification, Supabase config)
npm test
```

---

## 📄 License
This project is licensed under the MIT License.
