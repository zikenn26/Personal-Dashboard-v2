# Data Integrity & Habit/Expense Reliability Plan

Fix habit check-in failures, habit data editing, permanent expense deletion without resurrection, and establish cross-device parity between Android APK and Chrome web clients.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed by the user in Phase 1:
> - **Cross-Device Sync Strategy**: Direct backup export and import bridge between Android APK and Chrome/PC, accompanied by background cloud sync retry.
> - **Expense Deletion Safety**: Purge deleted items from all offline caches and historical backup snapshots, backed by permanent local and cloud tombstones.
> - **Habit Scope**: Fix habit check-in and edit persistence uniformly across both Android mobile app and desktop Chrome browser.

---

### 1. Overview & Core Concept

- **What It Does**:
  1. **Habit Section Fixes**: Makes habit check-ins instant and persistent on Today, Week, and Month views on both mobile and desktop. Allows users to freely edit habit titles, categories, icons, and colors with immediate visual feedback and durable persistence.
  2. **Expense Deletion & Resurrection Fix**: Eliminates the resurrection bug where deleted expenses reappeared upon app reload or cache rehydration by purging deleted items from all multi-tier offline cache keys (`lifeos_expenses_backup`, `offline_expenses_cache`, etc.) and enforcing persistent tombstones.
  3. **Cross-Device Parity & Cloud Sync**: Provides an instant 1-click JSON backup export/import bridge to synchronize the Android APK and Chrome/PC directly without data loss while Supabase cloud egress quota (HTTP 402) is active, while continuing background cloud sync with clear status indicators.
- **Target Persona**: Gulshan Kumar Nayak (`gulnayak1206@gmail.com` / `gknayak@gmail.com`) using LifeOS across an Android mobile APK and desktop Chrome.
- **Key Value**: Total data integrity, immediate interactive habit check-ins, permanent deletions without ghost records, and seamless cross-device consistency.

---

### 2. User Experience & Visual Design

- **Habit Check-In & Edit Experience**:
  - **Today View**: Tapping the circular check button immediately marks the habit done with smooth feedback, increments today's progress bar, records a discrete activity entry, and remains checked across reloads.
  - **Week View**: Tapping any day in the 7-day strip toggles that day with active styling (`bg-[#7b2cbf] text-white`) and updates weekly streak calculations.
  - **Month View & Calendar Popup**: Tapping any calendar day cell toggles that specific date and updates monthly consistency metrics.
  - **Edit Habit Sheet / Modal**: Accessible from both mobile (HabitCard edit icon & Month view) and desktop (Edit2 icon). Modifying habit name, category, icon, or accent color updates the card and header icon immediately upon saving.
- **Expense Deletion & Device Parity Experience**:
  - Deleting an expense removes it from the list immediately with an undo snackbar option. The item is permanently excluded from all cache recovery paths so it never reappears on restart.
  - **Device Sync Bridge (Sync with Chrome / APK)**: A clean banner and quick-action button in the Money/Expense view allowing the user to "Export Sync File" and "Import Sync File", creating an instant bridge between the APK and Chrome desktop.
- **Visual Design Discipline**:
  - Follows the *Universal Frontend Design Constitution* and *Mobile Touch-First Design Reference*: clean unboxed metadata (`·` typographic separators), 44px+ touch targets, zero pill-badge clutter, no decorative pulsing dots, and standard Tailwind tokens.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Cache Purging on Expense Deletion**:
  - *Chosen Approach*: When an expense is deleted, it is removed from the active storage partition, recorded in permanent tombstones (`deletedExpenseIds` and `tombstonedRefs`), AND stripped from all offline cache recovery keys (`lifeos_expenses_backup`, `${activeEmail}_offline_expenses_cache`, `${ws}_offline_expenses_cache`, etc.).
  - *Why*: Previously, `getExpenses()` recovered "missing historical" items from unpurged offline backup keys, inadvertently resurrecting deleted transactions.
  - *Alternatives Considered*: Retaining soft deletes without cache purging; rejected because cache merges consistently resurrected deleted items.
- **Decision 2: Direct Backup Bridge for Cross-Device Consistency**:
  - *Chosen Approach*: Provide a 1-click sync file export/import in the Expense page alongside the existing cloud sync.
  - *Why*: The Supabase cloud project is currently in an HTTP 402 egress-quota exhaustion state, blocking REST API writes from syncing between APK and Chrome over the cloud. A direct file bridge ensures immediate device parity without waiting for cloud quota reset.
  - *Alternatives Considered*: Cloud-only sync; rejected because HTTP 402 prevents remote synchronization across devices until quota is upgraded.
- **Decision 3: Unifying Habit Check-In State & Storage Pipeline**:
  - *Chosen Approach*: Read target habit from the active React state or Storage, update both `completedDays` and `completedDates` atomically, persist immediately to `Storage.setHabits()`, update React state, and emit `dashboard-data-updated`.
  - *Why*: Eliminates the race condition where `handleToggleHabitDay` read a stale or mismatched partition from Storage and silently failed if `target` was null.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LIFEOS APPLICATION                              │
│                                                                        │
│   ┌──────────────────────────┐      ┌──────────────────────────────┐   │
│   │   Mobile / Android APK   │      │       Desktop Chrome         │   │
│   │   (AndroidHabitsScreen,  │      │   (HabitTracker,             │   │
│   │    AndroidMoneyScreen)   │      │    ExpenseTracker)           │   │
│   └────────────┬─────────────┘      └──────────────┬───────────────┘   │
│                │                                   │                   │
│                ▼                                   ▼                   │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │           App.tsx Controller & Unified Event Handlers          │   │
│   │   • handleToggleHabitDay / handleToggleHabitDate               │   │
│   │   • handleUpdateHabit / handleAddHabit / handleDeleteHabit     │   │
│   │   • handleDeleteExpense / executeAtomicExpenseDeletion         │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │                                    │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │               Storage Engine (client/src/utils/storage.ts)     │   │
│   │   • Scoped localStorage Partitioning                           │   │
│   │   • Comprehensive Offline Cache Purging on Deletion            │   │
│   │   • Permanent Tombstone Registry (deletedExpenseIds)           │   │
│   │   • Durable IndexedDB / SQLite Repository Integration          │   │
│   └──────────────┬──────────────────────────────────┬──────────────┘   │
│                  │                                  │                  │
│                  ▼                                  ▼                  │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │ Direct Device-to-Device   │      │ Supabase Cloud Auto-Sync    │   │
│   │ Sync File (JSON Bridge)   │      │ • Background Outbox Queue   │   │
│   │ (Instant APK ↔ Chrome)    │      │ • HTTP 402 Resilient Retry  │   │
│   └───────────────────────────┘      └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Step-by-Step Implementation Sequence

1. **Storage Deletion & Cache Purging (`client/src/utils/storage.ts`)**:
   - In `deleteExpense` and `deleteExpenses`:
     - Record `deletedExpenseIds` and `tombstonedRefs` first.
     - Remove target items from active storage.
     - Iterate through all known offline cache keys (`lifeos_expenses_backup`, `offline_expenses_cache`, `user_usr_..._expenses`, etc.) and filter out the deleted IDs so they can never be resurrected.
   - In `getExpenses`:
     - Guarantee that any item whose ID is in `deletedExpenseIds` or whose references match `tombstonedRefs` is strictly rejected from cache recovery.
2. **Supabase Cloud Sync Quota & Resurrection Guard (`client/src/utils/supabase.ts`)**:
   - In `syncWorkspaceToSupabase`:
     - Never re-populate empty or pruned expenses with `lifeos_expenses_backup` or unpurged caches.
     - Never revive remote expenses that match `deletedExpenseIds`.
     - Gracefully handle HTTP 402 without showing confusing false errors or attempting repeated rapid retries.
3. **Habit Check-In & Edit Handlers (`client/src/App.tsx`)**:
   - Update `handleToggleHabitDay` and `handleToggleHabitDate`:
     - Fallback lookup: find target in `habits` state or `Storage.getHabits()`.
     - Atomically toggle both `completedDays` and `completedDates`.
     - Persist immediately to `Storage.setHabits(...)`.
     - Update `habits` state directly without relying on an asynchronous re-read.
     - Dispatch `dashboard-data-updated` event.
   - Update `handleUpdateHabit`:
     - Merge updated fields into target habit.
     - Persist to Storage and React state.
     - Dispatch `dashboard-data-updated` event so all listening views re-render with updated details.
4. **Habit UI Components (`HabitTracker.tsx`, `AndroidHabitsScreen.tsx`, `QuickHabitSheet.tsx`)**:
   - In `AndroidHabitsScreen.tsx`: Add edit trigger in Month view so users can edit habit details from any tab.
   - In `QuickHabitSheet.tsx`: Ensure form submit reliably propagates `onUpdateHabit` with all fields and closes the sheet.
   - In `HabitTracker.tsx`: Ensure the edit modal reliably saves changes and updates UI state.
5. **Cross-Device Parity Bridge**:
   - Add a lightweight "Export / Import Sync Data" bridge in `AndroidMoneyScreen.tsx` and `ExpenseTracker.tsx` allowing instant 1-click sync between the Android APK and Chrome PC while Supabase cloud egress is limited.
6. **Verification & Regression Testing**:
   - Run Vitest automated test suite (`npx vitest run`).
   - Run TypeScript checks (`npm run check`).
   - Run `compile_applet` to confirm zero compilation errors.
