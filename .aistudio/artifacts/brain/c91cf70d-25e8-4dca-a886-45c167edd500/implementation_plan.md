# Persistent Bearer Session Token, Startup Restoration & Complete Neon Renaming Plan

Establish immediate synchronous authentication session restoration from persistent local storage on app startup, implement a persistent bearer session token independent of cloud network latency, wire backend login validation against the Neon PostgreSQL pool, and rename all legacy Supabase files (`supabase.ts`, `supabaseConfig.ts`) to `neonSync.ts` and `neonConfig.ts`.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed in Phase 1:
> - **File Renaming**: Rename `client/src/utils/supabase.ts` to `client/src/utils/neonSync.ts` and `client/src/utils/supabaseConfig.ts` to `client/src/utils/neonConfig.ts`. Rename or purge the legacy `/supabase` directory.
> - **Session Token Architecture**: Implement a persistent bearer session token (`notion_os_auth_token_v1`) stored in `localStorage` with synchronous startup restoration.
> - **Startup Race-Condition Fix**: `App.tsx` checks the local bearer session token synchronously during component initialization, ensuring valid sessions are preserved immediately without waiting for remote network calls.
> - **Neon DB Credential Validation**: Backend authentication route (`/api/auth/login`) validates user credentials directly against the Neon DB pool (`workspaces` & `user_workspaces` tables) and issues signed session tokens.

---

## 1. Overview & Core Concept

- **What It Does**:
  - **Instant Startup Session Restore**: When the user opens or resumes the APK / Web app, the local bearer session token is read synchronously before any network requests occur. The user stays permanently logged in without flashing login modals or false "incorrect credentials" errors.
  - **Token-Based Session Persistence**: Stores an authenticated bearer token and user profile in `localStorage` (`notion_os_auth_token_v1` and `notion_os_auth_user_v1`).
  - **Neon DB Backend Auth**: Provides a dedicated `/api/auth/login` and `/api/auth/verify` endpoint in the server runtime that verifies passwords with salted PBKDF2 hashes against the Neon PostgreSQL database pool.
  - **Complete Renaming & Logic Migration**: Renames `client/src/utils/supabase.ts` to `neonSync.ts` and `client/src/utils/supabaseConfig.ts` to `neonConfig.ts`, updating all import references across the entire codebase.

---

## 2. User Experience & Visual Design

- **App Resume & Cold Start**:
  - The app launches directly into the authenticated dashboard (Home / Tasks / Spending / Habits) for logged-in accounts like `gknayak@gmail.com`.
  - Zero false "incorrect credentials" alerts or unwanted login modals when switching apps or resuming from background.
- **Login & Sign In Flow**:
  - When explicitly logged out, signing in validates directly against the local device cache and the server-side Neon DB pool.
  - Returns a persistent bearer token with smooth transition into the workspace.
- **Clean Architecture**:
  - Zero UI references to Supabase; fully unified under Neon Serverless PostgreSQL.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Synchronous Token Initialization in `App.tsx`**
  - *Chosen Approach*: Initialize `currentUser` state strictly from `Auth.getCurrentUser()` synchronously in the `useState` initializer (`useState<AuthUser | null>(() => Auth.getCurrentUser())`), and only show the login modal if `!currentUser && !Auth.getAuthToken()`.
  - *Why*: Eliminates race conditions where asynchronous network calls or missing Supabase GoTrue responses prematurely flag credentials as invalid.
- **Decision 2: Rename `supabase.ts` and `supabaseConfig.ts` to `neonSync.ts` and `neonConfig.ts`**
  - *Chosen Approach*: Complete file renaming and global import refactoring to eliminate misleading legacy file names.
  - *Why*: Ensures codebase clarity and eliminates confusion about remaining dependencies.
- **Decision 3: Server-Authoritative Neon DB Login Endpoint**
  - *Chosen Approach*: Handle `/api/auth/login` and `/api/auth/register` on the server using `pg.Pool` with SSL, keeping database connection strings and credentials strictly on the server backend.
  - *Why*: Fulfills zero-leak security while providing authoritative cross-device credential validation.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│               (React 19 + TypeScript + Vite)                │
│                                                             │
│   App.tsx (Synchronous token check on mount)                │
│   ├── Auth.ts (Bearer token generator & session cache)      │
│   ├── neonSync.ts (Relay client to /api/sync/*)             │
│   └── neonConfig.ts (Client config & offline fallbacks)     │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
    HTTP /api/auth/login              Persistent Local Token
    HTTP /api/sync/workspace          (notion_os_auth_token_v1)
                │                             │
                ▼                             │
┌───────────────────────────────┐             │
│    Express Server & Hub       │◄────────────┘
│    • server/syncService.ts    │
│    • server/db.ts (pg.Pool)   │
└───────────────┬───────────────┘
                │
                │ Direct PostgreSQL Connection (SSL)
                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Neon Serverless PostgreSQL                  │
│       ep-curly-glitter-b4fsklnq-pooler.aws.neon.tech        │
│                                                             │
│   • workspaces (user_identifier, workspace_data JSONB)      │
│   • user_workspaces (account_auth partition)                │
│   • transactions (authoritative SMS records)                │
└─────────────────────────────────────────────────────────────┘
```

### Execution Steps

1. **Backend Auth Endpoints (`server/syncService.ts`)**:
   - Add `handlePostLogin` and `handlePostRegister` routes (`/api/auth/login` and `/api/auth/register`).
   - Query Neon DB pool for `account_auth_${cleanId}` or email in `workspaces` and `user_workspaces`.
   - Validate PBKDF2 password hashes server-side and return `{ success: true, token, user }`.

2. **Client Auth Service (`client/src/utils/auth.ts`)**:
   - Add bearer session token helpers: `Auth.getAuthToken()`, `Auth.setAuthToken(token)`, and `Auth.clearAuthToken()`.
   - Update `Auth.getCurrentUser()` to ensure that when a valid token or saved user exists, session is never treated as signed out on cold starts.
   - Update `Auth.signIn()` to validate against local cache and call `/api/auth/login` on Neon DB backend.

3. **File Renaming**:
   - Move `client/src/utils/supabase.ts` -> `client/src/utils/neonSync.ts`.
   - Move `client/src/utils/supabaseConfig.ts` -> `client/src/utils/neonConfig.ts`.
   - Update all imports in `App.tsx`, `auth.ts`, `devices.ts`, `storage.ts`, `smsExpenseService.ts`, etc.
   - Rename root `/supabase` directory to `/db_scripts` or remove redundant legacy files.

4. **App Startup Logic (`client/src/App.tsx`)**:
   - Remove obsolete Supabase `onAuthStateChange` and `getSession` effects (lines 750-825).
   - Ensure `isAuthModalOpen` initializes to `false` whenever a valid token/session exists in local storage.
   - Synchronously load user workspace partition before background sync pings run.

5. **Verification**:
   - Run `lint_applet` (`tsc --noEmit`) to verify zero TypeScript errors.
   - Run `compile_applet` (`npm run build`) to verify clean production build.
   - Test `/api/auth/login` and `/api/sync/workspace` via curl to verify Neon DB connectivity.
