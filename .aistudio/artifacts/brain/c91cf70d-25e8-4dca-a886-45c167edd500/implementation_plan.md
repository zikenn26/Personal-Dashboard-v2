# Implementation Plan: Fresh Supabase Project Migration & Master Dataset Seeding

Migrate the backend infrastructure to a fresh, unrestricted Supabase cloud project by generating a production SQL schema initialization script with strict JWT Row Level Security (RLS), verifying dynamic configuration across client and server runtimes, providing a 1-click Migration Studio in Settings, and establishing automatic authoritative master seeding from the Android APK.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been aligned based on your preferences:
> - **Row Level Security (RLS) Policy**: **Strict RLS requiring authenticated Supabase JWT tokens**. Unauthenticated anonymous requests are blocked; all reads, inserts, and updates are bound strictly to `auth.uid() = user_id`.
> - **Schema Script Accessibility**: **Dedicated Migration tab in Settings plus repository file**. You will have a 1-click "Copy SQL Script" button, a "Download schema.sql" action in the Settings modal, and a persistent `/supabase/schema.sql` file in the codebase.
> - **APK Master Repopulation**: **Automatic seamless push upon detecting empty database**. When the Android APK connects to the new Supabase instance and detects no existing workspace, it will automatically publish its full master dataset (including the ₹2,53,691.45 transaction history) to the cloud without requiring manual intervention.

---

## 1. System Architecture & Migration Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                   SUPABASE FRESH PROJECT MIGRATION                     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   Step 1: SQL Schema Initialization (New Supabase SQL Editor)          │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ /supabase/schema.sql & Settings Migration Tab                │     │
│   │ - user_workspaces (JSONB, indexes, updated_at trigger)       │     │
│   │ - user_devices (UUID, device_id UNIQUE, presence tracking)   │     │
│   │ - Strict RLS: auth.uid() = user_id on SELECT/INSERT/UPDATE   │     │
│   │ - supabase_realtime publication enabled                      │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  │                                     │
│   Step 2: Connect Fresh Project in Applet Settings                     │
│   ┌──────────────────────────────▼───────────────────────────────┐     │
│   │ Dynamic Config (supabaseConfig.ts & SettingsModal.tsx)       │     │
│   │ - Enter New Project URL & Anon Key                           │     │
│   │ - Instant 1-tap connection handshake test                    │     │
│   │ - Server Relay keeps sync alive during switchover            │     │
│   └──────────────────────────────┬───────────────────────────────┘     │
│                                  │                                     │
│   Step 3: Authoritative Master Seeding (Android APK)                   │
│   ┌──────────────────────────────▼───────────────────────────────┐     │
│   │ APK Master Seed Engine (client/src/utils/supabase.ts)        │     │
│   │ - Detects native APK environment & empty cloud database      │     │
│   │ - Automatically uploads master ₹2.53 Lakh dataset            │     │
│   │ - Deduplicates by primary ID and SMS/UPI reference hashes    │     │
│   │ - Peer Web/AI Studio instances pull fresh seeded dataset     │     │
│   └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Technical Implementation

### Step 1: Complete SQL Initialization Script (`/supabase/schema.sql`)
- Create a complete, self-contained SQL file runnable in the Supabase SQL Editor:
  1. **UUID & Cryptographic Extensions**: Ensure `pgcrypto` is available.
  2. **`user_workspaces` Table**:
     - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
     - `user_id` UUID REFERENCES auth.users(id) ON DELETE CASCADE
     - `user_identifier` TEXT NOT NULL UNIQUE
     - `user_email` TEXT NOT NULL
     - `workspace_data` JSONB NOT NULL DEFAULT '{}'::jsonb
     - `created_at` TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
     - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
     - B-tree indexes on `user_id`, `user_identifier`, `user_email`, and `updated_at`.
  3. **`user_devices` Table**:
     - `id` UUID PRIMARY KEY DEFAULT gen_random_uuid()
     - `user_id` UUID REFERENCES auth.users(id) ON DELETE CASCADE
     - `device_id` TEXT NOT NULL
     - `device_name` TEXT NOT NULL
     - `device_type` TEXT DEFAULT 'web'
     - `platform` TEXT DEFAULT 'web'
     - `browser_info` TEXT
     - `is_active` BOOLEAN DEFAULT true
     - `first_login_at` TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
     - `last_seen_at` TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
     - `created_at` TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
     - `updated_at` TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
     - UNIQUE constraint on `(user_id, device_id)`.
  4. **Strict JWT Row Level Security (RLS)**:
     - Enable RLS on both tables.
     - Policies verifying `auth.uid() = user_id` for `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
  5. **Realtime Replication**:
     - `ALTER PUBLICATION supabase_realtime ADD TABLE user_workspaces;`
     - `ALTER PUBLICATION supabase_realtime ADD TABLE user_devices;`
  6. **Automated Timestamp Triggers**:
     - Trigger function updating `updated_at` on every row modification.

### Step 2: Dedicated Migration Tab in Settings (`SettingsModal.tsx`)
- Add a dedicated **Database Migration & SQL** tab/section in the Settings modal:
  - **1-Click Copy**: Copies the exact SQL initialization script directly to the user's clipboard.
  - **Download `.sql`**: Generates `supabase_schema_init.sql` for offline backup or command-line execution.
  - **Supabase Console Quick Link**: Direct button opening the Supabase Dashboard SQL Editor.
  - **Connection Switcher**: Input fields for Project URL and Anon Key with immediate health validation check and clear success/error feedback.

### Step 3: APK Master Seed Engine (`client/src/utils/supabase.ts` & `client/src/App.tsx`)
- Implement automatic detection and seeding logic:
  - When the app starts or connects to the new Supabase project:
    1. Query `user_workspaces` for the active account.
    2. If the cloud returns `data: null` or `workspace_data.expenses: []`:
    3. Check if the current device is the Android Native APK (or holds the master local expense dataset).
    4. Automatically trigger an atomic `syncWorkspaceToSupabase(masterPayload)` tagged with `_meta.isMasterApkSeed: true`.
    5. Deduplicate transactions using stable IDs and normalized SMS/UPI references (`mergeExpenseLists`) so no item is ever duplicated or lost.
    6. Emit a confirmation notification confirming the master repopulation.

---

## 3. Verification & Validation Plan

### Automated Checks
1. `npm run check` (`tsc --noEmit`): Verify strict TypeScript type compliance.
2. `compile_applet`: Verify that the entire app builds with zero errors.

### Manual Verification
1. **SQL Script Integrity**: Verify that `/supabase/schema.sql` syntax is valid PostgreSQL and adheres to Supabase RLS conventions.
2. **Settings Migration Tab**: Verify that the Migration UI renders cleanly, copies the SQL script to clipboard, and triggers `.sql` download.
3. **Connection Handshake**: Test URL and anon key validation logic with simulated input.
4. **Master Seeding Flow**: Verify that when remote storage reports an empty database, the APK automatically seeds the full transaction dataset without duplicates.
