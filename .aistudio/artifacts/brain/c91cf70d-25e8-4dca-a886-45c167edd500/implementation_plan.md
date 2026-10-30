# Account Sanitization, Expense Recovery & Preview Architecture Plan

Resolve the preview mode data disappearance for `gknayak@gmail.com`, permanently purge `gulnayak1206@gmail.com` and all non-whitelisted accounts from Supabase and local storage, and establish clean, reliable data recovery and account switching strictly between `gknayak@gmail.com` and `arpitapri125@gmail.com`.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Clarification (Phase 1)**:
> 1. **Data Recovery under Egress Quota Restriction**: Automatically recover and merge local device caches into `gknayak@gmail.com` so the app is immediately populated and resilient even when Supabase returns HTTP 402 (`exceed_egress_quota`).
> 2. **Handling `gulnayak1206@gmail.com`**: Permanently delete all `gulnayak1206` records, cache keys, aliases, and Supabase rows.
> 3. **Preview Sign-In Experience**: Require manual email sign-in on every preview launch (no silent guest bypass or automatic credential assumption), presenting a clean, focused sign-in dialog on fresh tabs.
> 4. **Strict Account Whitelist**: The only permitted accounts are `gknayak@gmail.com` (primary dashboard) and `arpitapri125@gmail.com` (secondary isolated account). All other mock, guest, or test accounts are removed.

---

### 1. Overview & Core Concept

- **The Problem**: In preview mode, visitors experienced missing expense data because:
  1. The remote Supabase backend (`amlegmbvqzbhqqqbrvjx.supabase.co`) is currently rejecting all network calls with `HTTP 402 (exceed_egress_quota)`.
  2. Each preview sandbox starts with a fresh, empty browser `localStorage`.
  3. When the cloud fetch failed with 402 and the local store had no prior cache, `Storage.getExpenses()` defaulted to `[]`.
  4. Multiple device logins created fragmented workspace partition keys (`user_036fe7d3...`, `user_usr_gknayak...`, `user_usr_gulnayak1206...`), scattering transactions and causing cross-device confusion.
- **The Solution**:
  1. Unify and standardize `gknayak@gmail.com` storage partitions so all legitimate cached data automatically consolidates into the active workspace.
  2. Provide resilient offline/quota fallback dataset for `gknayak@gmail.com` so that upon sign-in in a fresh preview container, the dashboard, habits (Gym & Study), and expenses display immediately without blanking.
  3. Completely purge `gulnayak1206@gmail.com` and all other accounts from local storage, credential registries, and code aliases.
  4. Generate an idempotent Supabase SQL purge migration script to clean the cloud database tables (`user_workspaces` and `user_expenses`) down to only `gknayak@gmail.com` and `arpitapri125@gmail.com`.
  5. Configure `arpitapri125@gmail.com` as a clean, isolated second account with its own independent credentials and workspace.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Preview Launch**:
     - On cold start in preview mode, the app presents a clean, centered Authentication modal.
     - The sign-in form explicitly highlights the two active whitelisted accounts for convenience (`gknayak@gmail.com` and `arpitapri125@gmail.com`).
  2. **Signing In as `gknayak@gmail.com`**:
     - User signs in with email/username and password.
     - The app loads the authenticated workspace: Gulshan Kumar Nayak profile, Gym & Study habits, and full expense history.
     - If Supabase returns 402, an unobtrusive banner notifies the user: *"Supabase cloud egress quota reached. Operating in full local offline mode with your verified data."* No data is lost and nothing is blanked.
  3. **Signing In as `arpitapri125@gmail.com`**:
     - Signs into an entirely separate, clean workspace partition.
     - No cross-contamination of Gulshan's habits, avatar, or expenses.
  4. **Purge of Legacy Data**:
     - Any old browser keys mentioning `gulnayak1206` or legacy mock accounts are cleanly scrubbed on startup.

- **Visual Theme & Atmosphere**:
  - Consistent with the Notion-inspired slate & obsidian theme:
    - Neutral dark base (`#0F172A` / `#1E293B`) with indigo/emerald accents (`#6366F1` and `#10B981`).
    - Clean typography (Inter / system sans-serif) with clear visual hierarchy.
    - Zero pills, zero clutter: sharp, intentional card borders and crisp status indicators.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Handling Cloud 402 Egress Quota**:
  - *Chosen Approach*: Resilient local-first fallback. When Supabase responds with 402 or is unreachable, the app operates gracefully from local verified storage and seeds authentic owner data on fresh preview launches.
  - *Why*: Prevents the app from breaking or showing an empty screen when third-party cloud egress limits are hit.
  - *Alternatives Considered*: Blocking the app entirely until quota is upgraded. Rejected because the user needs to inspect and use their data immediately.

- **Decision 2: Complete Purge of `gulnayak1206@gmail.com`**:
  - *Chosen Approach*: Permanent removal from code, credentials map, avatar resolution, and database tables.
  - *Why*: User explicitly confirmed: *"Permanently delete all gulnayak1206 records"*. Eliminates all partition confusion between `gknayak` and `gulnayak1206`.

- **Decision 3: Account Whitelist**:
  - *Chosen Approach*: Strictly allow only `gknayak@gmail.com` and `arpitapri125@gmail.com`.
  - *Why*: User explicitly requested: *"Remove all other accounts and the related data from the supabase storage except: gknayak@gmail.com, arpitapri125@gmail.com."*

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Authentication & Partition Layer                │
│                                                                        │
│   Whitelisted Accounts:                                                │
│   ├── gknayak@gmail.com       ──► Workspace: user_036fe7d3-...         │
│   │                               (Gulshan Kumar Nayak)                │
│   │                               • Gym & Study Habits                 │
│   │                               • Full Expense Ledger                │
│   │                                                                    │
│   └── arpitapri125@gmail.com  ──► Workspace: user_usr_arpitapri125_... │
│                                   (Arpita Priyadar)                    │
│                                   • Independent Isolated Data          │
│                                                                    │
│   Purged / Rejected:                                                   │
│   └── gulnayak1206@gmail.com & all mock/test accounts ──► BLOCKED/PURGED│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Data Storage & Fallback Pipeline                │
│                                                                        │
│   1. Read Scoped Storage ──► 2. Check Local Device Caches              │
│                              • Auto-consolidate gknayak caches         │
│                              • Discard & purge gulnayak1206 caches     │
│                                   │                                    │
│                                   ▼                                    │
│   3. Supabase Cloud Sync ◄── Try Network Request                       │
│      ├── Success (200 OK)    ──► Sync Cloud Rows                       │
│      └── Quota Error (402)   ──► Graceful Local-First Fallback         │
│                                  (Serve cached & seeded owner data)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Supabase Cloud SQL Cleanup Script                │
│                                                                        │
│   DELETE FROM user_workspaces                                          │
│   WHERE user_email NOT IN ('gknayak@gmail.com', 'arpitapri125@gmail.com')│
│      OR user_identifier LIKE '%gulnayak1206%';                         │
│                                                                        │
│   DELETE FROM user_expenses                                            │
│   WHERE user_email NOT IN ('gknayak@gmail.com', 'arpitapri125@gmail.com');│
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Execution Steps:
1. **Clean up `client/src/utils/auth.ts`**:
   - Keep only `DEFAULT_GKN_USER` (`gknayak@gmail.com`) and add default credential for `arpitapri125@gmail.com`.
   - Remove `gulnayak1206@gmail.com` and all other mock accounts from `getLocalCredentialsMap()`.
   - Add a startup cleanup routine that deletes all `localStorage` keys matching `gulnayak1206`.
2. **Standardize Expense Storage in `client/src/utils/storage.ts`**:
   - Provide an authentic seed dataset for `gknayak@gmail.com` when launching in a fresh preview browser so expenses never show empty `[]` when Supabase returns 402.
   - Remove all legacy read/write cache paths for `gulnayak1206`.
   - Ensure cache consolidation merges any existing local `gknayak` caches into the primary workspace.
3. **Update `client/src/utils/userUtils.ts` and `client/src/App.tsx`**:
   - Remove all `gulnayak1206` aliases and references.
   - In `App.tsx`, enforce that cold preview starts on the sign-in modal as requested.
4. **Provide `supabase_cleanup_and_purge.sql`**:
   - Formulate the exact SQL statements to purge all non-whitelisted records from Supabase `user_workspaces` and `user_expenses`.
5. **Validation**:
   - Run tests to confirm zero regressions and verify compilation via `compile_applet`.
