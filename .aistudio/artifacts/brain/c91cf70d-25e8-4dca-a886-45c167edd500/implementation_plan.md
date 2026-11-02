# Complete Neon DB Migration & Supabase Removal Plan

Transition the application to use Neon Serverless PostgreSQL exclusively as the sole cloud persistence, auth, and multi-device synchronization engine, completely removing all Supabase dependencies, configurations, and credentials. Remove the temporary "Set Password" button/mode from the signup and login UI.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The primary database will be Neon Serverless PostgreSQL using the authoritative connection string:
> `postgresql://neondb_owner:npg_G9a4qZEpMUty@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
>
> All client synchronization will route through the high-performance local/server proxy (`/api/sync/*`), which communicates directly with Neon DB. The Supabase cloud client and egress-quota restrictions will be completely eliminated.

- **Neon Connection String**: Configured as the authoritative default in `server/db.ts` and `.env`.
- **AuthModal UI**: Clean two-tab interface (`Sign In` and `Create Account`) with the "Set Password" button and tab completely removed.
- **Supabase Retirement**: All Supabase packages, client initialization, URL/Anon Key fields, and references removed from settings, client utilities, and server config.

---

## 1. Overview & Core Concept

- **What It Does**:
  - Replaces all cloud storage, account verification, and multi-device sync with Neon Serverless Postgres.
  - Replaces Supabase client calls with `/api/sync/workspace`, `/api/sync/transactions`, and `/api/sync/devices`.
  - Simplifies the authentication flow in `AuthModal.tsx` to traditional, clean **Sign In** and **Create Account** tabs.
  - Keeps the Android APK (`gknayak@gmail.com`) as the authoritative source with permanent login retention.

---

## 2. User Experience & Visual Design

### Auth Modal (`AuthModal.tsx`)
- **Tabs**: Clean, minimal 2-tab switcher:
  - `Sign In`
  - `Create Account`
- **Removed**: "Set Password" tab and "Set / Reset Password?" toggle.
- **Sign In Flow**: Enter username/email and password to authenticate. Offline and local credentials map ensures instantaneous access.
- **Sign Up Flow**: Enter First Name, Last Name, Email/Username, and Password to create a private workspace partition in Neon DB.

### Settings & Migration UI (`SettingsModal.tsx`)
- **Migration & Database Tab**:
  - Dedicated **Neon Serverless Postgres** control center showing real-time connection status.
  - Displays the active Neon connection string (`postgresql://neondb_owner:...@ep-curly-glitter...neon.tech/neondb`).
  - 1-Click action: **Copy Neon SQL Schema** and **Download neon_schema.sql**.
  - Supabase Project URL, Anon Key, and Supabase RLS toggle sections are completely removed from the UI.

---

## 3. Key Architectural Changes

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Layer                          │
│   Android APK / Web Client (React 19 + TypeScript + Vite)   │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
    HTTP / JSON API Requests       Local Session & Store
                │                 (IndexedDB / LocalStorage)
                ▼                             │
┌───────────────────────────────┐             │
│    Applet Backend & Relay     │◄────────────┘
│  (/api/sync/workspace, txs)   │
└───────────────┬───────────────┘
                │
                │ pg Pool (SSL require)
                ▼
┌─────────────────────────────────────────────────────────────┐
│                 Neon Serverless PostgreSQL                  │
│       ep-curly-glitter-b4fsklnq-pooler.aws.neon.tech        │
│                                                             │
│   • workspaces (user_identifier, workspace_data JSONB)      │
│   • transactions (reconciled expenses, SMS dataset)         │
│   • devices & connected_devices (multi-device registry)    │
│   • expense_authority & data_versions (concurrency locks)   │
└─────────────────────────────────────────────────────────────┘
```

1. **`client/src/components/AuthModal.tsx`**:
   - Remove `setpassword` mode from `mode` state.
   - Remove "Set Password" tab and "Set / Reset Password?" helper button.
   - Keep clean validation for Sign In and Sign Up.

2. **`client/src/utils/auth.ts`**:
   - Remove Supabase GoTrue Auth API calls (`client.auth.signInWithPassword`, `client.auth.signUp`, `client.auth.updateUser`, etc.).
   - Authenticate against local credentials and sync workspaces directly with `/api/sync/workspace` on Neon.
   - Retain permanent session retention (no auto-logout on APK dismissal).

3. **`client/src/utils/supabase.ts` & `supabaseConfig.ts`**:
   - Refactor `supabase.ts` so all workspace and expense push/pull operations route through `/api/sync/*` to Neon PostgreSQL.
   - Remove dead Supabase endpoints and keys.

4. **`server/db.ts` & `.env`**:
   - Set the exact connection string:
     `postgresql://neondb_owner:npg_G9a4qZEpMUty@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require`
   - Ensure all `sync_version`, `client_updated_at`, and `version` columns are `NUMERIC(30, 0)` to prevent any bigint overflows.

5. **`client/src/components/SettingsModal.tsx`**:
   - Remove all Supabase inputs (URL, Anon Key) and RLS toggle tabs.
   - Streamline the Database tab into a focused Neon Postgres Management panel.

---

## 4. Verification & Testing

- Run `lint_applet` (`tsc --noEmit`) to verify zero type or missing import issues.
- Run `compile_applet` to confirm successful Vite production bundling.
- Execute integration tests via `curl` to confirm:
  - Account sign in & workspace sync against Neon DB.
  - Successful retrieval of `user_workspaces` and `transactions`.
