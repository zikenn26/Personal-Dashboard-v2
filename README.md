<div align="center">

# 🪐 Zikenn Dashboard (LifeOS v4)

**Your life, career, finances, and digital wellbeing in one private, unified command center.**

[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.5-119EFF?style=for-the-badge&logo=capacitor&logoColor=white)](https://capacitorjs.com/)
[![Neon Postgres](https://img.shields.io/badge/Neon-Serverless%20Postgres-00E599?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-795%20Passed-22C55E?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<br/>

[✨ Features](#-core-features) • [⚡ Offline-First Sync](#-offline-first-sync-and-consistency) • [📱 Android Native APK](#-android-native-deep-integration) • [🚀 Quick Start](#-quick-start-guide) • [🛠️ Tech Stack](#%EF%B8%8F-technology-stack) • [🧪 Testing](#-testing--quality-assurance)

<br/>

</div>

---

## 💡 What is Zikenn Dashboard?

**Zikenn Dashboard** is a local-first personal productivity, life operating system, and financial tracking hub. Built with **React 19**, **TypeScript**, **Capacitor 8**, and backed by a high-performance **Node.js / Express** server connected to **Neon Serverless PostgreSQL**.

It solves productivity fragmentation by combining:
- 💰 **Automated SMS Financial Ledger** with bank auto-logging on Android.
- ⚡ **Offline-First Sync** with durable local outboxes, revision-checked server writes, and reviewable multi-device conflicts.
- ⏱️ **Real Hardware Screen Time Tracking** via Android's native `UsageStatsManager`.
- 🔐 **Military-Grade Vault** protected by client-side AES-GCM-256 encryption.
- 🎯 **Habits, Tasks & Milestone Roadmaps** with streak analytics.
- 🧠 **AI Copilot** powered by Google Gemini (Live WebSocket & Tool Calling) and Groq.
- 📅 **Dual Gregorian & Indian Panchang Calendars** with festival notifications.

Available simultaneously as a high-speed **Progressive Web App** and an installable **Native Android APK**.

---

## 🌟 Key Highlights & Why It's Different

| Feature | Standard Productivity Apps | Zikenn Dashboard |
| :--- | :--- | :--- |
| **Data Ownership** | 🔒 Cloud lock-in, vendor databases | 🏠 **Local-first durability**, works 100% offline |
| **Financial Logging** | ✍️ Manual entry or paid aggregators | ⚡ **Automatic bank SMS logging** on Android (Free & Private) |
| **Sync Architecture** | 🐢 Full-snapshot overwrites, collisions | 🚀 **Revisioned, idempotent sync** on Neon Postgres |
| **Digital Wellbeing** | 📱 Inaccurate browser estimates | 📊 **Hardware-level Android `UsageStatsManager`** statistics |
| **Security** | 🔑 Server-side plaintext or reversible hashes | 🛡️ **Zero-knowledge AES-GCM-256 client encryption** |
| **AI Integration** | 🤖 Chatbots disconnected from app state | 🧠 **Structured AI tool-calling engine** mapped to actions |

---

## 🎁 Core Features

### 💰 Financial Command Center & SMS Auto-Logging
* **Native Android SMS Auto-Parsing:** Background capture of transactional bank SMS messages (ICICI, HDFC, SBI, Axis, Kotak, UPI, credit/debit cards).
* **Instant Device-Side UUID v4 Assignment:** Transactions are assigned an RFC 4122 v4 UUID the moment they arrive on device, preventing duplicate generation or cloud race conditions.
* **Deterministic Deduplication:** Multi-stage fingerprinting combining transaction timestamp, reference IDs (UTR, UPI, SMS Reference), and merchant matching.
* **Dual-Direction Bookkeeping:** Automatic classification of `DEBIT` and `CREDIT` cash flows, salary deposits, refunds, and investments.
* **Excel / CSV Statement Importer:** Bulk upload bank statements with automated column mapping, preview reconciliation, and sheet batch management.
* **Smart Analytics:** Spending breakdown by category, monthly trend forecasts, and home-screen spending widgets.

### ⚡ Offline-First Sync
* **Local-first reads and writes:** The UI uses locally persisted data immediately. Expense records and mutations are stored in IndexedDB, with a localStorage fallback when IndexedDB is unavailable.
* **Durable retry queues:** Workspace snapshots are queued locally during a network outage. Expense changes use a durable per-record outbox and tombstones.
* **Revisioned sync API:** Signed-in clients use `POST /api/sync/v2` to submit idempotent mutations with base revisions and pull server-ordered changes using cursors. PostgreSQL transactions serialize concurrent writes and reject stale revisions.
* **Domain boundaries:** Expenses sync as individual entities. Other workspace data is currently synchronized as one versioned root snapshot.
* **Conflict review:** Independent field changes merge automatically. If both devices changed the same field while offline, both values are retained locally and the app asks the user which to keep; the selected value is synced before the conflict is cleared.
* **Explicit Work Offline:** This setting pauses automatic workspace sync and cancels scheduled sync timers. Device disconnection without this setting queues the latest workspace snapshot for retry after reconnection. Local edits continue to persist in either case.
* **Legacy compatibility:** The timestamp-based `/api/sync` delta endpoint remains available for clients without a versioned account session and during expense migration.

### Sync flow

```mermaid
sequenceDiagram
    autonumber
    participant App as Web or Android app
    participant Local as Local storage and outbox
    participant API as Express /api/sync/v2
    participant DB as Neon PostgreSQL

    App->>Local: Save edit and durable mutation locally
    App->>API: Push mutation with id, base revision, and cursor
    API->>DB: Validate session and serialize entity write
    alt Revision matches
        DB-->>API: Commit entity and mutation log entry
        API-->>App: Accepted ids and ordered changes
        App->>Local: Apply changes, then acknowledge outbox
    else Revision is stale
        DB-->>API: Return current server value and revision
        API-->>App: Conflict details
        App->>Local: Three-way merge; save conflicting fields for review
    end
```

### Sync storage tables

`sync_entities` stores each entity's current payload and revision. `sync_mutations` records accepted operations with cursors for ordered pulls and idempotent retries. The existing `workspaces` and `transactions` tables remain materialized for compatibility with older clients. Schema definitions are in [`server/db.ts`](server/db.ts) and [`neon_schema.sql`](neon_schema.sql).

### 📱 Android Native Deep Integration (Capacitor 8)
* **Real Hardware Screen Time:** Powered by a native Capacitor plugin invoking Android's `UsageStatsManager` for true app usage, unlocks, and digital wellbeing trends.
* **Native Home-Screen Widgets:** Quick expense logger, real-time screen time widget, and sticky ScratchPad note.
* **SMS Broadcast Receiver:** Background Android service that detects incoming SMS notifications and triggers local storage persistence.
* **Native Haptic Feedback:** Tactile haptic confirmations for button taps, completed habits, and expense entries.

### 🧠 AI Productivity Copilot
* **Google Gemini Integration:** Gemini Live WebSocket streaming and structured multi-turn conversation.
* **Groq Ultra-Fast Execution:** Sub-second command parsing using LLaMA models on Groq LPUs.
* **Intent Routing Engine:** Converts plain English commands into validated dashboard operations (e.g., *"Log 350 for dinner with Arpita via UPI"* or *"Add gym workout to daily schedule"*).

### 🎯 Habits, Tasks & Life Goals
* **Weekly Habit Matrix:** 7-day completion grid with automated Monday rollover, streak preservation, and activity history.
* **Visual Kanban Task Board:** Drag-and-drop tasks with priorities, status columns (`Todo`, `In Progress`, `Review`, `Done`), and due-date filters.
* **Milestone Roadmaps:** Break down multi-year goals into actionable milestones with visual progress indicators.

### 🔐 Zero-Knowledge Encrypted Vault
* **AES-GCM-256 Encryption:** Vault passwords, API credentials, and recovery codes are encrypted on the client before being written to disk or synced.
* **PBKDF2 Key Derivation:** Master PIN/passwords derived with salt and thousands of hashing iterations.

---

## 🔄 Legacy Delta Sync Compatibility

The timestamp-based /api/sync endpoint remains available for older clients and clients without a versioned account session. It transfers transaction changes using last_sync_timestamp and preserves soft-delete tombstones. Signed-in clients use the revisioned /api/sync/v2 path described above.

The existing transactions table remains the compatibility projection for expense records; sync_entities and sync_mutations support revision checks and ordered change delivery. See server/db.ts and neon_schema.sql for the schema.

---

## 🛠️ Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                       🎨 FRONTEND LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  React 19 • TypeScript 5.8 • Vite 7.3 • Tailwind CSS 4.0        │
│  Radix UI Primitives • Lucide Icons • SheetJS (xlsx) • Sonner   │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                   📱 NATIVE ANDROID RUNTIME                     │
├─────────────────────────────────────────────────────────────────┤
│  Capacitor 8.5 • Android SDK 34 • UsageStatsManager Screen Time  │
│  Custom SMS BroadcastReceiver • AppWidgets • Native Haptics     │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                   ⚡ BACKEND & CLOUD HUB                         │
├─────────────────────────────────────────────────────────────────┤
│  Node.js 20+ • Express.js • WebSocket (ws) • Google GenAI SDK   │
│  Bidirectional Delta Sync (/api/sync) • Gemini Live Proxy       │
└────────────────┬────────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────────┐
│                    🐘 DATABASE & PERSISTENCE                    │
├─────────────────────────────────────────────────────────────────┤
│  Neon Serverless PostgreSQL (pgcrypto, UUID v4, TIMESTAMPTZ)    │
│  IndexedDB & LocalStorage Client Cache • Client AES-GCM Vault   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher, Node 20+ recommended)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- For Android builds: [Android Studio](https://developer.android.com/studio) with Android SDK 34+

### 1. Clone the Repository
```bash
git clone https://github.com/zikenn26/Personal-Dashboard-v2.git
cd Personal-Dashboard-v2
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the project root:
```env
# Server & Database Configuration
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]/[DB_NAME]?sslmode=require&channel_binding=require

# AI Copilot Keys
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Optional: CORS allowed origins (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 4. Initialize the Database (Neon PostgreSQL)
The server initializes required tables from `server/db.ts` at startup. For a manual schema review or database setup, apply [`neon_schema.sql`](neon_schema.sql) in the Neon SQL Editor. Configure `DATABASE_URL` before starting the server.

### 5. Run the Application in Development Mode
```bash
# Starts the Vite client and Express API proxy
npm run dev
```
Open your browser at `http://localhost:3000`.

### 6. Build for Production
```bash
# Compiles React via Vite and bundles Express backend via esbuild
npm run build

# Start production server
npm start
```

---

## 📱 Building the Native Android APK

The project includes a complete native Android application configured with Capacitor.

### 1. Synchronize Web Assets to Android
```bash
npm run cap:build
```
*This runs `vite build` and copies the compiled bundle to `android/app/src/main/assets/public`.*

### 2. Open in Android Studio
```bash
npm run cap:open
```

### 3. Build & Run
- Connect your Android device via USB (or start an Android Virtual Device).
- Click **Run (Shift + F10)** in Android Studio.
- Grant **SMS Read Permission** and **Usage Access Permission** in Android Settings when prompted to enable automatic transaction tracking and hardware screen time stats.

---

## 🧪 Testing & Quality Assurance

The automated suite covers unit behavior, client/server integration paths, UI regressions, offline persistence, sync conflicts, multi-user isolation, session revocation, and expense integrity.

```bash
# Run the full Vitest suite (50 test files, 795 tests)
npm test

# Run TypeScript type check
npm run check

# Build the client and server for production
npm run build

# Run the Neon-backed legacy delta sync integration scenario (requires DATABASE_URL)
npx tsx server/testEndToEndDeltaSync.ts
```

### Test Coverage Highlights
- ✅ **Revisioned Sync & Conflicts:** Accepted/rejected mutations, three-way merges, and review choices ([`deltaSyncArchitecture.test.ts`](client/src/tests/deltaSyncArchitecture.test.ts), [`workspaceConflictResolution.test.ts`](client/src/tests/workspaceConflictResolution.test.ts)).
- ✅ **Offline Behavior:** Explicit Work Offline suppression, disconnected-device snapshot retry, and durable expense outboxes ([`workOfflineFeature.test.ts`](client/src/tests/workOfflineFeature.test.ts), [`localFirstExpenseSync.test.ts`](client/src/tests/localFirstExpenseSync.test.ts)).
- ✅ **Security & Account Isolation:** Session expiry/revocation, cryptography, and multi-user workspace separation ([`singletonSessionArchitecture.test.ts`](client/src/tests/singletonSessionArchitecture.test.ts), [`multiUserWorkspaceIsolation.test.ts`](client/src/tests/multiUserWorkspaceIsolation.test.ts)).
- ✅ **Storage Integrity:** Expense tombstones, persistence round-trips, and cross-platform sync behavior ([`localFirstExpenseSync.test.ts`](client/src/tests/localFirstExpenseSync.test.ts), [`screenTimeCrossPlatformSync.test.ts`](client/src/tests/screenTimeCrossPlatformSync.test.ts)).
- ✅ **SMS Transaction Parser:** Indian bank SMS formats verified for debit/credit accuracy ([`bankFormatRegression.test.ts`](client/src/tests/bankFormatRegression.test.ts)).
- ✅ **Hardware Screen Time:** App duration parsing, unlock count tracking, and device reconciliation ([`screenTimeCalculation.test.ts`](client/src/tests/screenTimeCalculation.test.ts)).
- ✅ **Client Cryptography:** Zero-knowledge password verification and AES-GCM vault security ([`crypto.test.ts`](client/src/utils/crypto.test.ts)).

---

## 📂 Project Directory Structure

```
Personal-Dashboard-App-GitHub/
├── android/                         # Capacitor Native Android Project
│   ├── app/src/main/java/           # Native Plugins, AppWidgets, & Receivers
│   └── app/src/main/assets/public/  # Synced Web Production Assets
├── client/                          # Frontend Application
│   ├── src/
│   │   ├── components/              # Modular UI Widgets & Section Panels
│   │   ├── presentation/mobile/     # Responsive Mobile Screens & Sheets
│   │   ├── repositories/            # Local-First IndexedDB Expense Repository
│   │   ├── services/                # Sync, Screen Time, Native & SMS Services
│   │   ├── tests/                   # Automated Vitest Test Suites
│   │   ├── utils/                   # Storage, Crypto, UUID, & Export Helpers
│   │   ├── types.ts                 # Central TypeScript Definitions
│   │   └── App.tsx                  # Root Application Component
│   ├── public/                      # Static Assets, Icons & Schema Scripts
│   └── index.html                   # HTML Entrypoint
├── server/                          # Backend Cloud Hub
│   ├── db.ts                        # Neon PostgreSQL Connection Pool
│   ├── syncService.ts               # Bidirectional Delta Sync & Device Hub
│   ├── screenTimeService.ts         # Screen Time Sync Relay
│   ├── geminiService.ts             # Google Gemini Live WebSocket Server
│   ├── security.ts                  # Security Headers & Rate Limiting
│   └── index.ts                     # Main Express Entrypoint
├── neon_schema.sql                  # Production Neon Postgres Schema
├── neon_delta_sync_migration.sql    # UUID Delta Sync SQL Migration
├── package.json                     # Scripts & Dependencies
├── vite.config.ts                   # Vite & PWA Build Configuration
└── README.md                        # Documentation
```

---

## 🔒 Security & Privacy Practices

1. **Zero Data Snooping:** No tracking scripts, no Google Analytics, no third-party telemetry.
2. **Encrypted Vault Storage:** All credentials stored in the Vault are encrypted using standard **AES-GCM (256-bit)** before touching storage or wire.
3. **Optimistic Concurrency Control:** Write mutations include timestamp checks to prevent accidental overwrites when multiple devices update simultaneously.
4. **Authoritative Master Protection:** APK device entries originating from native SMS parsing are protected against destructive browser snapshot overwrites.

---

## 🤝 Contributing

Contributions, feedback, and pull requests are warmly welcome!

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`).
4. Ensure all tests pass (`npm test && npm run check`).
5. Push to the Branch (`git push origin feature/AmazingFeature`).
6. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.

---

<div align="center">

Made with ❤️ for high-performance personal productivity.

</div>
