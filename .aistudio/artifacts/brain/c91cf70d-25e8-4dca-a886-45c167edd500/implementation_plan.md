# Implementation Plan: Permanent Session Persistence, Neon Database Integration & Password Reset Flow

Fix the APK auto-logout and "incorrect credentials" error by removing the legacy auto-purge scripts in `auth.ts`, establishing permanent session persistence until explicit manual sign-out, integrating Neon PostgreSQL database support, and adding a direct "Set or Reset Password" flow on the login screen.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been aligned based on your selections:
> - **Session Persistence**: **Stay logged in indefinitely until explicit manual Sign Out**. Reopening or dismissing the APK will never invalidate your active session.
> - **Database Backend**: **Neon PostgreSQL Database**. Connect and support your Neon database (`postgresql://...`) alongside the local server sync hub to ensure zero-quota restrictions and continuous cross-device sync.
> - **Password Management**: **Direct "Set or Reset Password" on the Login screen**. If a password issue occurs, you can set a fresh password for `gknayak@gmail.com` directly from the login modal and sign in immediately.

---

## 1. Problem Diagnosis & Root Cause Analysis

### Why the APK asked for login again upon dismissal:
1. **Destructive Auto-Purge on Module Init**:
   - `client/src/utils/auth.ts` contained legacy purge functions (`purgeLegacyAccounts` and `enforceGlobalAuthEpoch`) that ran automatically whenever the app initialized.
   - These functions actively scanned for keys matching `gknayak`, removed `notion_os_auth_user_v1`, set `notion_os_auth_signed_out = 'true'`, and wiped the credential records from `localStorage`.
   - When the APK was dismissed and reopened, this code ran on app start and forcibly kicked you out to the login screen.

### Why it showed "incorrect credentials" upon re-login:
1. **Explicit Deletion in Local Credentials Map**:
   - `getLocalCredentialsMap()` in `auth.ts` had hardcoded deletion statements (`delete map['gknayak@gmail.com']; delete map['gknayak'];`), preventing the local fallback from verifying your password.
2. **Upstream Quota/Egress Lockout**:
   - Because the previous Supabase instance was locked by egress quota (HTTP 402), remote verification failed. Combined with the local map deletion, the app had no remaining credential source and returned "Invalid email or password".

---

## 2. Proposed Architecture & Solution

```
┌────────────────────────────────────────────────────────────────────────┐
│               PERMANENT AUTHENTICATION & NEON PIPELINE                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   [Android APK / Web Browser / AI Studio]                              │
│              │                                                         │
│              ├─► Persistent Local Session (No Auto-Purge)              │
│              │   - Stored in localStorage & local DB                   │
│              │   - Immune to app dismiss, backgrounding, or restart    │
│              │   - Only revoked on explicit manual "Sign Out"          │
│              │                                                         │
│              ├─► Direct Password Set / Reset Flow                      │
│              │   - Available directly on AuthModal login screen        │
│              │   - Updates local durable hash & cloud credentials      │
│              │                                                         │
│              └─► Multi-Tier Cloud Sync & Storage Engine                │
│                  ├─► Neon PostgreSQL Database (Primary Cloud)          │
│                  │   - Connection string / Neon serverless driver      │
│                  │   - Durable workspace & device persistence          │
│                  ├─► Applet Sync Relay (/api/sync)                     │
│                  │   - Fast zero-quota local relay                     │
│                  └─► APK-Authoritative Merge                           │
│                      - Preserves ₹2,53,691.45 master transactions      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Step 1: Eliminate Destructive Purge & Fix Credential Map (`client/src/utils/auth.ts`)
- **Remove `purgeLegacyAccounts()` and `enforceGlobalAuthEpoch()`**:
  - Stop wiping `gknayak@gmail.com` sessions, storage keys, and credentials on startup.
- **Remove hardcoded deletion in `getLocalCredentialsMap()`**:
  - Allow `gknayak@gmail.com` and your password hash to be securely stored and retrieved in local credentials storage.
- **Harden `verifyCurrentSession()`**:
  - Prevent `verifyCurrentSession` from logging out the user if the cloud is offline, unreachable, or in transition. Only log out if the user explicitly clicks "Sign Out".
- **Ensure default master credentials exist**:
  - Pre-seed standard fallback password hash for `gknayak@gmail.com` so offline and initial sign-ins succeed immediately without friction.

### Step 2: Implement Direct "Set / Reset Password" on Login Screen (`client/src/components/AuthModal.tsx`)
- Add a visible **"Set / Reset Password"** toggle/tab in `AuthModal.tsx`:
  - Allows entering the email address (`gknayak@gmail.com`) and setting a new password (min 8 characters).
  - Updates the credential record both locally and in the database.
  - Automatically signs the user in upon successful password update.
  - Displays instant visual feedback (success toast, progress spinner).

### Step 3: Neon PostgreSQL Backend Integration (`server/syncService.ts` & `SettingsModal.tsx`)
- Support Neon PostgreSQL database connection:
  - Add `NEON_DATABASE_URL` / `DATABASE_URL` support in the server sync engine (`server/syncService.ts`).
  - Provide a **Neon Database Configuration** section in the Settings modal where you can paste your Neon connection string (`postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`).
  - When configured, the backend automatically creates tables and syncs workspace and device records directly to your Neon database instance.

### Step 4: Permanent APK Session Retention
- Ensure `App.tsx` respects the persistent user session:
  - Do not trigger sign-out on app focus or app resume.
  - Retain `notion_os_auth_user_v1` across cold starts and app dismissals.

---

## 4. Verification Plan

### Automated Checks
1. `npm run check` (`tsc --noEmit`): Verify complete TypeScript type safety.
2. `compile_applet`: Verify that the entire client and server bundle cleanly.

### Functional Verification
1. **Session Survival on App Dismissal**:
   - Sign in as `gknayak@gmail.com`.
   - Simulate closing/reloading the app (trigger module re-initialization).
   - Verify that the app opens directly into your workspace without prompting for login.
2. **Password Verification**:
   - Verify that entering your credentials for `gknayak@gmail.com` successfully signs in without "incorrect credentials" error.
3. **Set / Reset Password Flow**:
   - Open AuthModal, click "Set / Reset Password", enter new password, and verify immediate successful login.
4. **Neon Database Sync**:
   - Verify that the server can persist workspace data and devices to the configured database.
