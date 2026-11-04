# Personal Dashboard Architecture Handoff

This document describes the architecture currently implemented in this repository and the follow-up work an incoming agent should verify before changing storage or sync behavior.

## System overview

- The browser and Android app are local-first. Expense data is stored in IndexedDB, with a localStorage fallback; workspace snapshots and sync metadata have durable local queues.
- Neon PostgreSQL is the server-owned source of truth. The Express API authenticates requests and scopes reads and writes to the account workspace.
- Client workspace reads and writes use the authenticated versioned `/api/sync/v2` endpoint. There is no client Supabase database path.
- Expenses sync as individual entities. Other workspace modules currently sync as a versioned root snapshot.
- `workspaces` and `transactions` are server-maintained compatibility/reporting projections. They should not be used as client fallback sources.

## Versioned sync contract

The client saves edits locally first and records durable outbox mutations. Each mutation carries an id, entity/module, operation, base revision, and payload. The server serializes writes in PostgreSQL transactions, checks the current revision, and deduplicates retries by mutation ID. It returns accepted mutation IDs, conflicts, ordered changes, and a cursor. Clients acknowledge accepted mutations only; rejected mutations remain queued for resolution/retry.

Independent fields merge automatically. When both devices change the same field, the client retains the conflict values for review. The selected value is synced before the conflict is cleared. Snapshot retries and per-expense outboxes are stored locally for offline operation.

“Work Offline” pauses automatic workspace sync. A network outage without that setting leaves local edits queued for retry. Guest workspaces should not fetch an authenticated server snapshot.

## Identity, sessions, and reset generation

- Account records and password hashes live in `app_users`; credentials are not accepted from browser-local password stores.
- `user_active_sessions` enforces the current singleton session per email and stores its generation.
- `app_state` contains the singleton generation and schema version. Auth and write paths validate the session against the current generation.
- A global reset increments the generation and clears application tables in a single transaction. Old-generation requests and outbox mutations must be rejected; clients clear local state when authentication discovers a generation change.
- `GET /api/storage/diagnostic` is an authenticated database identity/schema diagnostic and should be compared with the intended Neon database before any destructive reset.

## Database setup

`server/db.ts` defines the application schema and initializes it when the server starts. At minimum, current auth/reset flows require:

- `app_users(id, email, display_name, password_hash, created_at, updated_at)`
- `app_state(singleton, generation, schema_version, updated_at)` with one singleton row

Other sync tables include `sync_entities`, `sync_mutations`, `sync_queues`, `data_versions`, `data_conflicts`, `transactions`, and `workspaces`. Device/session tables include `devices`, `connected_devices`, and `user_active_sessions`; `expense_authority` supports expense reconciliation. See `server/db.ts` for the authoritative definitions. Avoid ad hoc schema changes; update the initializer and schema documentation together.

The guarded global reset script is `server/resetApplicationData.ts`, invoked by `npm run reset:app-data -- "<database-label>"`. It requires explicit target, fingerprint, and confirmation environment values. Never put database URLs or credentials in this repository, logs, or commits.

## Degraded local backup rules

The expense repository may store a degraded localStorage backup when IndexedDB is unavailable. These backups are tagged with the workspace key and the last authenticated generation. The repository must not restore them in its constructor: it waits until authentication has selected the workspace. It restores only when both workspace and generation match; missing, malformed, legacy, or stale-generation metadata causes the backup to be discarded. This preserves same-account offline recovery while preventing stale backups from crossing a reset or account boundary.

Related code: `client/src/repositories/expenseRepository.ts`, `client/src/utils/auth.ts`, `client/src/utils/storage.ts`, and `client/src/services/syncProtocol.ts`.

## Existing limitations and review items

1. **Degraded-backup race while offline:** a device that has not contacted the server since a remote reset cannot know the generation changed. It may restore its last matching local-generation backup during offline use. On the next successful auth/session verification, a generation mismatch must purge local state and prevent the stale queue from syncing. Preserve this limitation explicitly or redesign with a stricter online-validation gate.
2. **Explicit backup restore UI:** the app has a user-initiated restore feature. Confirm that restoring a file is an explicit user action and cannot happen automatically during startup or cloud sync.
3. **Schema initialization errors:** `initDb()` currently logs initialization errors rather than propagating them. Confirm startup health checks fail closed if required schema initialization fails; otherwise the service can appear live while sync/auth tables are missing.
4. **Cross-device production acceptance:** verify reset, fresh registration, empty workspace, offline edits, stale outbox rejection, and conflict review across Chrome and the Android APK against the intended deployed Neon branch.
5. **Credential hygiene:** rotate credentials if exposed; configure production secrets in the deployment environment and keep local `.env` files ignored.

## Verification history

Recent local verification passed the full suite (784 tests), TypeScript check, production build, and `git diff --check`. The degraded-backup generation change subsequently passed its focused expense repository suite (30 tests), `npm run check`, and `git diff --check`. A Neon connection smoke test used a temporary table and rolled back its insert; it left no persistent test row.

Re-run checks after architecture changes. Do not claim production reset or Chrome/APK acceptance until those actions have actually been verified on the deployed service.
