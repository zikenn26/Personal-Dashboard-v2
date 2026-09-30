# ⚡ Zikenn Dashboard

### Your entire life, career, and finances — organized into one beautiful command center. Available as a **Web App** and a native **Android App**, powered by the same codebase.

> Stop juggling ten different apps for your tasks, habits, goals, money, passwords, journal, and portfolio. Zikenn Dashboard brings it all into a single, elegant, private-first workspace that runs everywhere — in your browser, on your phone, and across every device you own, in perfect real-time sync.

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&logoColor=white">
  <img alt="Capacitor" src="https://img.shields.io/badge/Capacitor-Android-119EFF?logo=capacitor&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Realtime-3ECF8E?logo=supabase&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-black">
</p>

---

## 💡 Why Zikenn Dashboard?

Modern life is scattered across a dozen apps — a to-do list here, a habit tracker there, a budgeting app, a password manager, a journal, and a separate portfolio site for your career. Zikenn Dashboard replaces all of them with **one cohesive product** that feels like it was designed by someone who actually lives the chaos of modern productivity — because it was.

- 🧠 **One app, your whole life** — tasks, habits, goals, exams, finances, passwords, journal, media, and your professional portfolio, all in one place.
- 🤖 **Built-in AI Secretary** — a conversational assistant that can create tasks, log expenses, update habits, and manage your day just by talking to it.
- 🔒 **Bank-grade privacy by design** — your most sensitive data (passwords, private journal entries) is encrypted client-side. Not even the backend can read it.
- 📱 **Truly cross-platform** — the exact same product ships as a fast Progressive Web App *and* a native Android app via Capacitor, sharing 100% of the code.
- ⚡ **Real-time everywhere** — start a task on your laptop, finish it on your phone. Alarms, habits, and schedules sync across devices in under 30ms.
- 🎨 **Delightful, not sterile** — smooth animations, satisfying sound effects, confetti celebrations, and a beautifully crafted dark/light UI make daily use genuinely enjoyable.

---

## 🌐 One Codebase, Two Powerful Products

| | 🖥️ Web App | 📱 Android App |
|---|---|---|
| **Tech** | Vite + React 19 SPA, served via an Express backend | Native Android shell powered by [Capacitor](https://capacitorjs.com/), wrapping the same web UI |
| **Distribution** | Instantly accessible from any browser — no install needed | Installable APK/AAB, ready for the Google Play Store |
| **Device Features** | Web Notifications, Web Crypto, Clipboard | Native Splash Screen, Status Bar theming, Haptics, Geolocation, Network status, native Share sheet |
| **Offline Support** | Local-first storage, works without internet | Full offline-first support with native app resilience |
| **Sync** | Realtime Supabase sync across every session | Same account, same data, instantly synced with the web app |

This means every feature you build or fix benefits **both** platforms simultaneously — no duplicated effort, no feature drift.

---

## 🏆 Everything Your Users Get

| Module | What It Delivers |
|---|---|
| 🏠 **Command Center & Home Dashboard** | A modular, drag-and-drop grid with a flip-clock, cross-device alarms, time-blocked daily schedule, Indian Panchang calendar, and quick-capture bar. |
| 🤖 **Zikenn AI Assistant** | A Groq-powered AI secretary that can autonomously create tasks, log expenses, update habits, and answer questions in natural language. |
| ☑️ **Tasks & Kanban Board** | A 4-stage kanban flow with priorities, due dates, subtasks, sound effects, and confetti celebrations. |
| ⚡ **Habit Tracker** | A visual 7-day matrix with automated weekly rollover, streaks, and completion analytics. |
| 🎯 **Goals & Milestones** | Long-term goal tracking with milestone-driven progress bars and category-based organization. |
| 🎓 **Competitive Exams Hub** | Multi-phase exam prep with hierarchical syllabus tracking, book progress, and live countdowns. |
| 💼 **Workfolio & Portfolio Showcase** | A polished, public-ready résumé and project portfolio — perfect for job hunting or client pitches. |
| 💳 **Expense & Subscription Tracker** | Multi-currency ledger, recurring subscription alerts, and one-click Excel/CSV bank statement import. |
| 🔐 **Encrypted Password Vault** | AES-GCM-256 + PBKDF2-SHA-256 (210,000 iterations) zero-knowledge vault — your passwords never leave your device unencrypted. |
| 📖 **Dear Diary & Journal** | A beautifully themed private journal with mood tracking and PIN-protected entries. |
| 🎬 **Media Library** | Track books, movies, shows, games, and podcasts with ratings and status pipelines. |
| 🗺️ **Life Map & Achievements** | A visual timeline of milestones plus a digital trophy wall and doodle canvas. |
| ⌘ **Command Palette** | Instant `Ctrl+K` fuzzy search across the entire app. |
| 🔄 **Realtime Multi-Device Sync** | Local-first speed with Supabase-powered background sync and remote session management. |

---

## 🛠️ Under the Hood

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7, Wouter (routing) |
| **Styling & Motion** | Tailwind CSS v4, Framer Motion, Radix UI primitives |
| **Mobile Shell** | Capacitor 8 (Android), with native Haptics, Geolocation, Network, Share, Splash Screen & Status Bar plugins |
| **Backend** | Node.js + Express (API proxy & production server) |
| **AI** | Groq (`gpt-oss-120b` / `qwen3` models) via `@google/genai` tool-calling |
| **Data & Sync** | Supabase (PostgreSQL + Realtime WebSockets) with local-first `localStorage` caching |
| **Security** | Web Crypto API — AES-GCM-256 authenticated encryption, PBKDF2-HMAC-SHA256 key derivation |
| **Testing** | Vitest |

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v18+`
- npm `v9+`
- For Android builds: Android Studio + a configured JDK (Gradle wrapper is included in [android/](android/))

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Create a `.env` file with your Supabase and AI credentials:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
GROQ_API_KEY=your-groq-api-key
```

### 3. Run the web app locally
```bash
npm run dev
```
Visit `http://localhost:3000`.

### 4. Build for production (web)
```bash
npm run build
npm start
```

### 5. Build & run the Android app
```bash
npm run cap:build   # builds the web app and syncs it into the Android project
npm run cap:open    # opens the project in Android Studio
```
From Android Studio, run the app on an emulator or a physical device, or generate a signed APK/AAB for the Play Store.

### 6. Verify & test
```bash
npm run lint   # type-checking
npm test       # automated tests (crypto, backup integrity, config validation)
```

---

## 📂 Project Structure

```
client/        → React web app (shared by both Web & Android builds)
server/        → Express backend & AI service proxy
android/       → Native Android project generated & managed by Capacitor
shared/        → Shared constants between client and server
supabase/      → Database schema for cloud sync
patches/       → Dependency patches applied via patch-package
```

---

## 📄 License

Licensed under the **MIT License** — free to use, adapt, and build upon.

---

<p align="center">
  <b>Zikenn Dashboard</b> — one app, every device, your whole life in sync.<br>
  <i>Ready to ditch the app-juggling? Clone it, run it, and see what a truly unified life dashboard feels like.</i>
</p>

