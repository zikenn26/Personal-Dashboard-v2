# Global Cross-Device Logout & Pristine Data Reset Plan

Enforce an immediate, global sign-out for `gknayak@gmail.com` across all devices (Chrome web, Android APK, and mobile browsers), thoroughly wipe all legacy fragmented caches, and initialize a completely fresh, blank workspace upon re-login to resolve all account and data consistency issues.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Clarification (Phase 1)**:
> 1. **Cache Purge Strategy**: Thoroughly wipe all legacy device caches (`offline_expenses_cache`, `lifeos_expenses_backup`, old partition keys, and historical transaction stores).
> 2. **Global Cross-Device Invalidation**: Increment a global authentication epoch (`GLOBAL_AUTH_EPOCH`) so any existing session on any phone, browser, or device automatically detects the epoch mismatch, terminates the session, wipes local device caches, and redirects to the sign-in screen.
> 3. **Workspace State on Re-Login**: Initialize a **completely blank workspace** (`expenses: []`, `habits: []`, `todos: []`, `goals: []`) with a clean profile ("Gulshan Kumar Nayak" / `gknayak@gmail.com`), ensuring zero residual or synthetic transactions carry over.
> 4. **Strict Two-Account Whitelist**: Only `gknayak@gmail.com` and `arpitapri125@gmail.com` are permitted; all other accounts and `gulnayak1206` remain permanently purged.

---

### 1. Overview & Core Concept

- **The Problem**: Over multiple test cycles and device logins (Chrome, Android APK, mobile), multiple cache layers (`user_036fe7d3...`, `user_usr_gknayak...`, `gknayak@gmail.com_offline_expenses_cache`, `lifeos_offline_expenses_cache`, `lifeos_expenses_backup`) accumulated conflicting or phantom historical states.
- **The Solution**:
  1. **Global Epoch Invalidation**: Set a new authoritative epoch constant (`GLOBAL_AUTH_EPOCH = '2026_10_30_epoch_v5_clean'`). On load or network sync, any device with an older epoch is forced to sign out immediately, deleting all local cached records.
  2. **Pristine Reset on Fresh Login**: When `gknayak@gmail.com` signs back in, a clean, blank workspace partition is initialized with empty arrays across all modules.
  3. **Strict Partition Consistency**: Single, immutable storage partition for `gknayak@gmail.com` (`user_036fe7d3-6a13-4740-b028-afb55e81e00e`) and `arpitapri125@gmail.com` (`user_usr_arpitapri125_gmail_com`), completely eliminating multi-device key divergence.

---

### 2. User Experience & Visual Design

- **Global Invalidation & Logout Experience**:
  - Any device currently running an active session for `gknayak@gmail.com` will immediately recognize the epoch transition on page load or focus.
  - The session is cleanly cleared, all cached transaction fragments are purged, and the clean centered Sign-In modal is presented.
  - An informational notice confirms: *"Session reset across all devices. Please sign in to access your fresh workspace."*

- **Fresh Sign-In Experience**:
  - User signs in with `gknayak@gmail.com` and password `Gulshan@12345!`.
  - The dashboard opens into a pristine, zero-clutter workspace:
    - Profile: Gulshan Kumar Nayak (`gknayak@gmail.com`) with clean initials/avatar.
    - Money / Expense Tracker: Completely clean state (0 expenses, ₹0 spent, ready for real transactions).
    - Habits: Fresh blank slate ready for custom habit creation.
    - Tasks & Goals: Clean empty states with inviting zero-state illustrations.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Global Auth Epoch Mechanism**:
  - *Chosen Approach*: Embed a high-watermark version string `GLOBAL_AUTH_EPOCH` verified at app initialization in `Auth.getCurrentUser()` and `App.tsx`.
  - *Why*: Instantly invalidates sessions on all devices without requiring Supabase server-side tokens to be individually revoked.
  - *Alternatives Considered*: Waiting for remote Supabase token expiry. Rejected because Supabase egress quota is restricted (HTTP 402), which would fail to push remote invalidation to offline or cached devices.

- **Decision 2: Blank Workspace vs Seed Data**:
  - *Chosen Approach*: Completely blank workspace (`expenses: []`, `habits: []`), as explicitly requested by the user.
  - *Why*: Eliminates all confusion from synthetic or historical mock items and guarantees that every transaction visible going forward is authentic and user-created.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        App Initialization & Auth Check                 │
│                                                                        │
│   Check: localStorage.getItem('notion_os_auth_epoch')                  │
│                     │                                                  │
│         Does it match GLOBAL_AUTH_EPOCH?                               │
│         ├── NO (Stale Device / Previous Code Session):                 │
│         │   1. Auth.setCurrentUser(null) (Forced Sign-Out)             │
│         │   2. localStorage.clear() (Purge all legacy cache keys)      │
│         │   3. Set 'notion_os_auth_epoch' = GLOBAL_AUTH_EPOCH          │
│         │   4. Display clean AuthModal                                 │
│         │                                                              │
│         └── YES (Clean Epoch):                                         │
│             Proceed to standard authenticated flow                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Fresh Login (gknayak@gmail.com)                 │
│                                                                        │
│   Credentials: gknayak@gmail.com / Gulshan@12345!                     │
│   Workspace Key: user_036fe7d3-6a13-4740-b028-afb55e81e00e             │
│                                                                        │
│   Initialized State:                                                   │
│   ├── Profile: Gulshan Kumar Nayak (gknayak@gmail.com)                 │
│   ├── Expenses: [] (Clean blank slate)                                 │
│   ├── Habits: [] (Clean blank slate)                                   │
│   ├── Todos: []                                                        │
│   └── Offline Caches: Initialized with pristine []                     │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Execution Steps:
1. **Define `GLOBAL_AUTH_EPOCH` in `client/src/utils/auth.ts`**:
   - Add `GLOBAL_AUTH_EPOCH = '2026_10_30_epoch_v5_clean'`.
   - On initialization, if the device's epoch doesn't match, force `Auth.setCurrentUser(null)` and purge all legacy keys.
2. **Update Storage Defaults in `client/src/utils/storage.ts`**:
   - Ensure `getExpenses()` and `getHabits()` for fresh logins initialize with clean blank arrays `[]` when no user data exists.
   - Remove synthetic seed fallback in favor of the requested blank slate.
3. **Update `supabase_cleanup_and_purge.sql`**:
   - Include SQL to reset the cloud workspace row for `gknayak@gmail.com` to the blank initial state.
4. **Verification**:
   - Run tests to confirm zero regressions and verify compilation via `compile_applet`.
