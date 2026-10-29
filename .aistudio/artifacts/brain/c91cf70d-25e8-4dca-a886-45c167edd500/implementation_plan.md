# Automated Cross-Device Real-Time Sync & Offline Read-Only Consistency Plan

Streamline the data synchronization architecture by eliminating all manual sync controls ("Cloud Sync", "Device Sync", and "Work Offline" toggle), preventing stale multi-device write conflicts via an **Offline Read-Only** mode with visible UI guardrails, and establishing a zero-touch real-time sync pipeline where Android APK SMS auto-logging instantly propagates to Chrome web clients.

---

### User Decisions & Architecture Blueprint

> [!IMPORTANT]
> - **Zero Manual Buttons**: Completely remove the "Cloud Sync", "Device Sync", and "Work Offline" controls across Web (Chrome) and Android APK.
> - **No Offline Writes (Stale Conflict Prevention)**: In offline mode, the app is strictly **Read-Only**. Users can read all cached local data, but write operations (adding/editing/deleting habits, expenses, categories, or budgets) are disabled with a clear "Offline (Read-Only)" banner and disabled action states.
> - **Native SMS Offline Ingestion Guard**: When the Android device receives bank SMS while offline, raw SMS messages are preserved in a persistent native pending inbox. They are processed and dispatched to Supabase immediately upon reconnection.
> - **Instant Real-Time Reflection**: Android APK commits new transactions to Supabase, which fires an instant Realtime broadcast. Chrome web sessions immediately consume this event to update the UI without user refresh. An automated 30-second heartbeat polling + window focus listener acts as a failsafe fallback.

---

### 1. User Interface Streamlining & Cleanups

1. **Remove Sync & Offline UI Controls**:
   - `client/src/components/ExpenseTracker.tsx` and `client/src/presentation/mobile/screens/money/AndroidMoneyScreen.tsx`:
     - Remove "Device Sync" and "Cloud Sync" buttons, along with any manual sync modals.
   - `client/src/components/SettingsModal.tsx`:
     - Remove the "Work Offline" toggle and any manual cloud backup/sync buttons.
   - `client/src/App.tsx`:
     - Clean up header navigation to remove any sync triggers or sync status popups.

2. **Offline Read-Only UI Experience**:
   - Introduce an **Offline Read-Only Banner**: A subtle, non-intrusive status strip displaying "Offline Mode — Viewing Cached Data (Read-Only to prevent device conflicts)".
   - **Action Disablement**: Disable the "Add Expense", "Add Habit", "Edit", and delete buttons when offline (`!navigator.onLine` or connection policy offline), displaying helpful tooltips explaining that writes will re-enable once reconnected.

---

### 2. Consistency & Write-Protection Engine

1. **Write Gate in Storage / Repository Layer**:
   - Centralize write verification in `connectionPolicy.ts` and core repositories (`expenseRepository.ts`, `habitRepository.ts`, `Storage.ts`).
   - If offline, user-initiated mutation requests are gracefully rejected with a user-friendly toast (`"Cannot create or edit while offline. Please reconnect to sync changes."`).
   - Cached data remains fully available for reading via IndexedDB/localStorage.

2. **Android SMS Pending Inbox**:
   - When the APK receives SMS broadcasts via the Android native SMS receiver while offline:
     - Store the unprocessed SMS envelope in a durable local SQLite/Storage queue (`pending_sms_inbox`).
     - On network restoration (`online` event or connection restored), trigger the parsing pipeline to log the expenses and push them directly to Supabase.

---

### 3. Automated Real-Time Cross-Device Synchronization

1. **APK Publisher Pipeline**:
   - When an expense is parsed and logged from SMS on Android:
     - Saves locally to durable store.
     - Automatically pushes to Supabase via `expenseRepository.save()` / `upsert_expense` RPC.
     - Emits a lightweight broadcast event on the Supabase Realtime channel for the workspace.

2. **Chrome / Web Subscriber Pipeline**:
   - Active web clients subscribe to the workspace's Supabase Realtime broadcast channel (`workspace_realtime_${workspaceId}`).
   - On broadcast receipt:
     - Automatically trigger incremental pull from Supabase to update local store and trigger React state re-render.
   - **Fallback & Reconnect Engine**:
     - Automated 30-second interval polling fallback for background safety.
     - Window `focus` and `visibilitychange` listeners to fetch updates immediately when the user switches tabs or wakes their computer.

3. **Dirty-Read & Race Condition Mitigation**:
   - Last-write-wins timestamps (`updated_at` / `sync_timestamp`) on all models.
   - Workspace-level version tracking to avoid concurrent write collisions.

---

### 4. Verification & Testing Plan

1. **Automated Unit & Integration Tests**:
   - Verify UI components do not render Cloud Sync, Device Sync, or Work Offline controls.
   - Verify offline write guard prevents direct mutations and returns read-only warnings.
   - Test SMS offline inbox queuing and reconnection flush.
   - Verify Supabase Realtime broadcast handler correctly invalidates and re-queries state.
2. **Regression Testing**:
   - Run `npm test` across all existing suites (ensure all 43 test suites and 750+ tests pass).
   - Validate with `lint_applet` and `compile_applet`.
