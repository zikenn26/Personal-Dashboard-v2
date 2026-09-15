# 🌟 Personalized Dashboard

> **Design your days with intention. Cultivate momentum, preserve mental clarity, and build a harmonious, balanced life.**

A private-first, local-first personal productivity headquarters, daily command center, and career showcase built with modern React 19, TypeScript, Tailwind CSS, Web Cryptography, and Supabase Realtime.

Personalized Dashboard is crafted to eliminate digital chaos and fragmentation. By unifying daily routines, intelligent goal tracking, competitive study, financial health, reflective journaling, and zero-knowledge privacy into one harmonious workspace, it empowers you to stay organized, calm, and purposeful every single day.

---

## 🧭 The Philosophy of Balanced Living

Modern life demands juggling career milestones, personal health, financial prudence, and mindfulness. Personalized Dashboard acts as your central compass:

- 🧘 **Mental Peace & Focus**: Replace frantic multi-tab switching with an elegant, clutter-free sanctuary designed for calm productivity.
- ⚡ **Consistent Daily Momentum**: Transform ambitious dreams into bite-sized daily habits, time-blocked schedules, and visual streaks.
- 🔒 **Sovereignty & Privacy**: Absolute data ownership. Your private thoughts and credentials stay protected by client-side, zero-knowledge encryption.
- 📱 **Seamless Continuity**: Real-time multi-device synchronization ensures that your agenda, habits, and alarms follow you smoothly across every screen.

---

## 🏆 Priority Features Matrix (Most Important First)

The table below outlines the core pillars of Personalized Dashboard, arranged by daily impact and priority:

| Rank | Module & Focus | Key Capabilities | Life & Balance Impact |
|:---:|:---|:---|:---|
| **1** | 🏠 **Command Center & Dynamic Home**<br>*(Daily Nerve Center)* | • Modular 3-column draggable grid<br>• 24H Flip Clock with sub-30ms cross-device alarms<br>• Dynamic time-blocked daily schedule<br>• Indian Panchang & Gregorian calendars<br>• Rapid quick capture & quote carousel | Ground your morning with immediate clarity. Know exactly what matters today without overwhelm. |
| **2** | 🤖 **Zikenn AI Assistant & Secretary**<br>*(Intelligent Co-Pilot)* | • Groq-accelerated LLM reasoning<br>• Autonomous tool calling (creates/edits tasks, habits, expenses, journal)<br>• Compact AI Secretary home drawer<br>• Contextual follow-up action chips | Offload cognitive fatigue. Organize your thoughts and update your entire life through natural conversation. |
| **3** | ☑️ **Tasks & Kanban Command Board**<br>*(Flow & Execution)* | • 4-stage kanban workflow (*To Do* ➔ *Done*)<br>• 4 priority tiers (*Urgent* to *Low*)<br>• Due date indicators & subtask checklists<br>• Audio-haptic feedback & celebratory confetti | Keep stress at bay. Break daunting workloads into manageable chunks and celebrate tangible progress. |
| **4** | ⚡ **Habits Tracker & Routine Matrix**<br>*(Habitual Momentum)* | • 7-day Monday–Sunday visual matrix<br>• Automated Monday streak rollover engine<br>• Weekly completion percentage analytics<br>• Category grouping & icon customizer | Consistency over intensity. Build sustainable wellness, reading, and fitness routines that last. |
| **5** | 🎯 **Goals & Milestones Hub**<br>*(Long-Term Direction)* | • Short-term & long-term objective boards<br>• Dynamic 0–100% milestone progress bars<br>• Target completion deadlines & impact ratings<br>• Active, completed, and on-hold filtering | Align daily actions with your broader life vision so you never lose sight of your true aspirations. |
| **6** | 🎓 **Competitive Exams & Syllabus Hub**<br>*(Academic Mastery)* | • Multi-phase exam organizer (Prelims, Mains, Interview)<br>• Hierarchical Subjects ➔ Chapters ➔ Topics<br>• Dynamic status tracking & syllabus completion %<br>• Book reading tracker & live target countdown | Conquer rigorous exams with structured syllabus mastery, removing exam anxiety through methodical preparation. |
| **7** | 💼 **Workfolio & Career Showcase**<br>*(Professional Identity)* | • Embedded PDF resume sheet & custom uploads<br>• Featured project gallery with GitHub & demo links<br>• Domain-categorized skills matrix<br>• Education, career timeline, certs & hobbies | Proudly reflect on your professional growth and present a polished portfolio ready for any opportunity. |
| **8** | 💳 **Spending & Financial Intelligence**<br>*(Financial Wellness)* | • Multi-currency expense ledger (₹, $, €, £)<br>• Recurring subscription tracker & renewal alerts<br>• Smart Excel/CSV bank statement parser<br>• Audit logs & instant accidental deletion undo | Achieve financial peace of mind. Understand your monthly cash flow, subscriptions, and savings habits. |
| **9** | 🔐 **Encrypted Password Vault**<br>*(Zero-Knowledge Security)* | • AES-GCM-256 authenticated encryption<br>• PBKDF2-SHA-256 with 210,000 iterations (OWASP)<br>• Master PIN lock & client-side random keygen<br>• Secure password generator & strength analyzer | Safeguard your digital footprint with bank-grade client-side encryption. Plaintext never leaves your machine. |
| **10** | 📖 **Dear Diary & Reflective Journal**<br>*(Mindful Introspection)* | • Aesthetic themes (*Parchment*, *Midnight*, *Lavender*)<br>• Daily mood, weather, and energy level logs<br>• Zero-knowledge PIN lock for private entries<br>• Expressive typography for stream-of-consciousness | Unpack emotions, process daily events, and cultivate gratitude in a private, beautiful sanctuary. |
| **11** | 🎬 **Media Library & Reading Lounge**<br>*(Enriching Leisure)* | • Books, movies, TV series, games & podcasts<br>• 4-tier consumption status tracking<br>• 5-star rating system & personal review notes<br>• Cover artwork showcase | Foster intentional downtime. Curate what you read and watch instead of succumbing to endless doomscrolling. |
| **12** | 🗺️ **Life Map & Achievements Wall**<br>*(Lifelong Milestones)* | • Chronological life achievement roadmap<br>• Digital trophy wall for certificates and awards<br>• Interactive doodle sketchpad with saved snapshots | Honor your personal journey. Look back at how far you have come and celebrate major life milestones. |
| **13** | ⌘ **Command Palette (⌘K / Ctrl+K)**<br>*(Instant Navigation)* | • Lightning-fast fuzzy search across all modules<br>• Direct keyboard shortcuts for themes and audio<br>• Quick-action data export and search triggers | Glide through your digital workspace effortlessly without reaching for the mouse. |
| **14** | 🔄 **Realtime Multi-Device Synchronization**<br>*(Everywhere Continuity)* | • Local-first instant offline persistence<br>• Sub-30ms Supabase WebSocket broadcast<br>• Synchronized alarms, tasks, and habits<br>• Active device session manager with remote revoke | Seamless harmony between phone, tablet, and desktop. Your life system stays unified everywhere. |

---

## 🔍 Detailed Functional Deep-Dive

### 🏠 1. Command Center & Dynamic Home Dashboard
The home view acts as your morning anchor, bringing together time, routine, and inspiration into a single glance:

| Feature Component | Functionality & Specifications |
|---|---|
| **24H Flip Clock & Alarm** | Features Chronometer, Analog Dial, and Soft Flip Card styles. Includes quick minute presets (`+5m`, `+10m`, `+15m`, `+25m`, `+45m`) and a 24-hour time selector. Synchronizes alerts across all devices in real time with audio chimes, soft pulsing visual rings, and configurable 5m/10m snooze modes. |
| **Dynamic Schedule Card** | Displays time-blocked routine chunks with current block indicators. Supports weekday and weekend master templates with flexible per-day customization. |
| **Indian Cultural Calendar** | Integrated Hindu Panchang showing Tithi, Paksha, Nakshatra, Rashi, and major festival reminders alongside Gregorian dates. |
| **Quick Capture Bar** | Floating shortcut bar to immediately record sudden thoughts, expenses, tasks, habits, or media items without interrupting your train of thought. |
| **Inspiration Ribbon** | Daily revolving quote carousel with author attribution, copy-to-clipboard, and an aesthetic photo slider for personal vision boards. |

---

### 🤖 2. Zikenn AI Assistant & Secretary
An intelligent assistant engineered to act as an executive partner for your life:

| AI Capability | Implementation Details |
|---|---|
| **High-Performance Models** | Powered by Groq inference using `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `qwen/qwen3.8-27b`, and `qwen/qwen3.6-27b`. |
| **Autonomous Tool Calling** | Capable of reading and writing to your local workspace: creates tasks, updates habit statuses, logs expenses, records diary thoughts, or retrieves schedule items. |
| **AI Secretary Home Drawer** | A collapsible, lightweight widget located right on your dashboard for fast voice-style interactions and day plan summaries. |
| **Contextual Action Chips** | Dynamically suggests relevant next steps, queries, and summaries to keep your planning workflow friction-free. |

---

### ☑️ 3. Tasks & Kanban Command Board
Organize projects and errands using a tactile, responsive kanban flow:

| Kanban Element | Specifications |
|---|---|
| **Workflow Stages** | **To Do** ➔ **In Progress** ➔ **In Review** ➔ **Completed** with smooth drag-and-drop and one-click quick moves. |
| **Priorities & Due Dates** | Color-coded **Urgent**, **High**, **Medium**, and **Low** badges with intelligent due date reminders (*Today*, *Tomorrow*, *Overdue*). |
| **Subtasks & Details** | Add detailed notes, breakdown subtask checklists, and trigger cheerful sound and confetti upon completing milestones. |
| **Batch Hygiene** | One-click clearing of completed cards, instant text search, and category filtering. |

---

### ⚡ 4. Daily Habits & Routine Matrix
Build atomic habits that stack into lifelong discipline:

| Habit Component | Mechanics & Architecture |
|---|---|
| **7-Day Visual Matrix** | Interactive Monday-through-Sunday checkbox grid with custom icons and vibrant category colors. |
| **Monday Rollover Engine** | Automatically archives the completed week into immutable history records (`HabitWeekRecord`) each Monday, preserving streaks without data corruption. |
| **Momentum Analytics** | Displays current day streaks, best streaks, weekly completion rates (e.g., 85%), and historical consistency logs. |

---

### 🎯 5. Goals & Milestones Hub
Bridge the gap between vision and reality:

| Goal Tracking Feature | Details |
|---|---|
| **Categorized Roadmaps** | Group goals by Career, Financial, Personal, Health, and Creative categories. |
| **Dynamic Progress Calculation** | Visual progress indicators driven automatically by the ratio of completed sub-milestones to total steps. |
| **Impact & Target Dates** | Identify high-impact milestones with target completion horizons and active status toggles. |

---

### 🎓 6. Competitive Exams & Syllabus Tracker
A dedicated academic hub tailored for rigorous civil, engineering, medical, or academic examinations:

| Academic Module | Features & Capabilities |
|---|---|
| **Multi-Stage Structure** | Break down complex exams into sequential phases (e.g., *Preliminary*, *Mains*, *Interview / Viva*). |
| **Hierarchical Syllabus** | Nested Subjects ➔ Chapters ➔ Topics hierarchy with status indicators (*Not Started*, *In Progress*, *Completed*) and real-time completion percentages. |
| **Book & Resource Tracker** | Log reference textbooks, current reading editions, pages completed, and subject-wise study notes. |
| **Target Countdown** | High-precision countdown clock calculating days, hours, and minutes remaining until the examination date. |

---

### 💼 7. Workfolio & Career Showcase
A comprehensive, modern portfolio and resume hub:

| Portfolio Element | Highlights |
|---|---|
| **Embedded Resume Viewer** | Seamless in-app PDF document rendering with zoom controls, full-screen mode, and one-click file replacement. |
| **Project Showcase** | Card gallery displaying engineering projects, technology stack badges, live demo URLs, and GitHub repository links. |
| **Skills & Proficiencies** | Categorized competencies (Frontend, Backend, Cloud, Tools) with visual mastery ratings. |
| **Credentials & Experience** | Structured logs for Education history, Job Experience, Professional Certifications, Spoken Languages, and Personal Hobbies. |

---

### 💳 8. Spending, Subscriptions & Excel Financial Parser
Gain full mastery over your finances with intelligent transaction tracking:

| Financial Feature | Description |
|---|---|
| **Multi-Currency Ledger** | Record income and expenditure with support for Indian Rupee (₹), US Dollar ($), Euro (€), and British Pound (£). |
| **Subscription Tracker** | Track recurring monthly and annual software or utility subscriptions with renewal reminders and monthly burn calculations. |
| **Excel & CSV Import** | Direct drag-and-drop parsing of `.xlsx` and `.csv` bank statements with auto-column mapping and batch import history. |
| **Instant Undo Toast** | Safety net: deleted expense items can be restored instantly with a floating undo toast notification. |

---

### 🔐 9. Client-Side Encrypted Password Vault
Zero-knowledge security engineered right in the browser:

| Cryptographic Parameter | Specification |
|---|---|
| **Encryption Algorithm** | **AES-GCM-256** (Authenticated Encryption with Associated Data). |
| **Key Derivation Function** | **PBKDF2-HMAC-SHA256** running **210,000 iterations** (exceeds OWASP minimum recommendations). |
| **Salt & Nonce Generation** | Unique 16-byte cryptographically secure pseudorandom salt and 12-byte IV per encryption pass via `crypto.getRandomValues()`. |
| **Zero-Knowledge Guarantee** | Plaintext credentials exist solely in volatile browser memory during an active session. Local storage and cloud backups only ever store ciphertext payloads. |
| **Vault Utilities** | Master PIN protection, password entropy strength analyzer, and secure random password generator. |

---

### 📖 10. Dear Diary & Reflective Journal
Nurture mental wellness and mindfulness through expressive writing:

| Journal Feature | Aesthetic & Functional Details |
|---|---|
| **Canvas Themes** | Beautiful writing backdrops: *Parchment Paper*, *Midnight Noir*, *Lavender Dream*, *Lined Notebook*, and *Dotted Grid*. |
| **Holistic Daily State** | Track mood emojis, ambient weather indicators, and physical/mental energy levels with each reflection. |
| **PIN Privacy Lock** | Sensitive diary entries can be locked behind your Master PIN to ensure privacy during shared screen use. |

---

### 🎬 11. Media Library & Reading Lounge
Track your intellectual and cultural consumption:

| Media Tracker | Details |
|---|---|
| **Multi-Format Library** | Curate collections across Books, Movies, TV Series, Video Games, and Podcasts. |
| **Status Pipelines** | Filter items by *Want to Consume*, *Currently In Progress*, *Completed*, or *Dropped*. |
| **Ratings & Notes** | Interactive 5-star ratings, custom review thoughts, and visual book cover displays. |

---

### 🗺️ 12. Life Map & Achievements Wall
Celebrate your journey and preserve special milestones:

| Memory Component | Details |
|---|---|
| **Chronological Life Map** | Visual timeline documenting major career breakthroughs, personal milestones, and travel memories. |
| **Achievements Showcase** | Digital trophy case celebrating awards, certifications, and personal accomplishments. |
| **Doodle Canvas** | Built-in interactive drawing canvas with brush sizing, color palettes, and instant snapshot saving. |

---

### ⌘ 13. Command Palette & Universal Shortcuts
Move at the speed of thought:

| Shortcut / Action | Outcome |
|---|---|
| `⌘K` / `Ctrl+K` | Open Universal Command Palette for global fuzzy search across all modules, tasks, notes, and projects. |
| `Dark / Light Mode` | Instantly toggle themes from the command palette or header controls. |
| `Sound Effects` | Toggle subtle auditory clicks and harmonic alert chimes. |
| `Quick Backup` | Trigger an instant JSON export directly from keyboard search. |

---

### 🔄 14. Realtime Cloud Sync & Multi-Device Sessions
A modern local-first foundation backed by cloud synchronization:

| Sync Layer | Architecture & Reliability |
|---|---|
| **Local-First Speed** | Reads and writes directly to browser storage (`localStorage`) for zero latency and complete offline functionality. |
| **Supabase Realtime Sync** | Background debounced synchronization to PostgreSQL (`public.user_workspaces`) with live WebSocket broadcast channels. |
| **Cross-Device Alarms** | Setting, snoozing, or dismissing an alarm on your phone propagates to your laptop in under 30 milliseconds. |
| **Active Session Manager** | View all devices logged into your account in Settings and remotely revoke any foreign or inactive session. |
| **Complete Data Backups** | One-click full JSON backup export (`Personal_Dashboard_Backup_<YYYY-MM-DD>.json`) with schema validation on restore. |

---

## 🛠️ Technology Stack

| Layer | Technologies & Libraries |
|---|---|
| **Frontend Framework** | React 19, TypeScript, Vite 7 |
| **Styling & Layout** | Tailwind CSS v4, Motion (Framer Motion), Radix UI Headless Primitives |
| **UI Components & Icons** | Lucide React, CMDK (Command Palette), Sonner (Toasts) |
| **Data Visualization** | Recharts, HTML2Canvas, jsPDF |
| **Spreadsheet Parsing** | XLSX (SheetJS) for Excel/CSV data import |
| **Backend Service** | Node.js, Express, ESBuild |
| **API Proxies** | Groq AI Proxy, Supabase CORS Proxy |
| **Security & Crypto** | Web Cryptography API (`window.crypto.subtle`), AES-GCM-256, PBKDF2-SHA-256 |
| **Data Persistence** | Local-first LocalStorage + Supabase PostgreSQL & Realtime Broadcast |

---

## 🚀 Quickstart & Setup Guide

### 📋 Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### 1. Clone & Install Dependencies
```bash
git clone <repository-url>
cd personal-dashboard
npm install
```

### 2. Configure Environment Variables
Create your local environment file:
```bash
cp .env.example .env
```

Configure your secrets in `.env`:
```env
# Supabase Cloud Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: Groq AI Assistant Key (for Zikenn AI)
GROQ_API_KEY=your-groq-api-key
```

### 3. Launch Development Server
```bash
npm run dev
```
Open your browser and navigate to `http://0.0.0.0:3000`.

### 4. Build for Production
```bash
npm run build
```
Builds the client application bundle with Vite and bundles the Node.js Express server into `dist/`.

### 5. Launch Production Server
```bash
npm start
```

### 6. Verification & Automated Tests
```bash
# Type-checking and code linting
npm run lint

# Run automated tests (cryptography validation, backup integrity, Supabase config)
npm test
```

---

## 📄 License

This project is licensed under the **MIT License**.

---

<p align="center">
  <b>Personalized Dashboard</b> — <i>Crafted for intentional focus, steady growth, and a beautifully balanced life.</i>
</p>
