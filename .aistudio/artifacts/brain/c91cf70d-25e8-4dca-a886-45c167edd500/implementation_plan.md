# Realtime Synchronization Hardening & Monotonic Timestamp Integrity Plan

Harden multi-device synchronization in `client/src/utils/supabase.ts` and `client/src/App.tsx` by introducing monotonic timestamp validation on incoming realtime payloads, preventing stale local overwrites, and establishing an atomic queue for `flushAutoSyncImmediately` to eliminate race conditions across concurrent devices.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Clarification (Phase 1)**:
> 1. **Realtime Event Presentation**: Silently apply newer remote state in place and seamlessly re-render UI components without page refreshes or disruptive banners.
> 2. **Concurrency Control in `flushAutoSyncImmediately`**: Atomic promise queue with a monotonic timestamp guard to serialize in-flight writes, preventing parallel race conditions when multiple devices are logged in simultaneously.
> 3. **Strict Timestamp Precedence**: Compare incoming payload timestamps against local state (`lastLocalMutationTimestamp` and `_meta.syncVersion`); discard any incoming remote updates that are older than or equal to current local state.
> 4. **Deduplication Safeguards**: Ensure list imports (expenses, habits, tasks) strictly maintain unique entity IDs so that repeated cloud synchronizations never produce duplicated records.

---

### 1. Overview & Core Concept

- **The Problem**:
  - `subscribeToRealtimeWorkspace` previously received remote workspace snapshots and applied them directly to localStorage and React state without verifying whether the incoming payload was newer than the local state. A delayed broadcast or echo event from an older device state could overwrite a newer local edit.
  - `flushAutoSyncImmediately` could be invoked in quick succession (e.g. rapid edits or tab changes across devices), potentially issuing concurrent HTTP requests that race against each other.
- **The Solution**:
  - **Timestamp Guard in `App.tsx`**: Track the authoritative local mutation timestamp. In `subscribeToRealtimeWorkspace`, parse the incoming payload's timestamp (`_meta.syncVersion` / `updatedAt`) and strictly reject any payload where `remoteTimestamp <= localTimestamp`.
  - **Atomic Sync Queue in `supabase.ts`**: Wrap `flushAutoSyncImmediately` and `syncWorkspaceToSupabase` in a serialized execution queue (`syncExecutionPromiseChain`) with monotonic timestamps (`Math.max(Date.now(), latestKnownRemoteTimestamp + 1)`).
  - **Deduplicated Ingestion in `Storage.importAllDataPayload`**: Ensure array reconciliations enforce set-based ID uniqueness across all collections.

---

### 2. User Experience & Visual Flow

- **Silent & Seamless In-Place Updates**:
  - When you add a task or mark a habit on your phone, your desktop screen reflects the update within milliseconds (<30ms).
  - No page reload, no scroll position loss, and no interruption to your active work.
  - If a device receives a stale update (e.g. from an offline device syncing late), the stale payload is discarded silently without resetting your current progress.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Monotonic Sequence + Millisecond Timestamp Comparison**:
  - *Chosen Approach*: Compare `Math.max(remoteSyncVersion, remoteUpdatedAtMs)` against `Math.max(localSyncVersion, localMutationMs)`.
  - *Why*: Accommodates small clock skews between devices by using the payload's embedded `_meta.syncVersion` as a logical sequence counter.
- **Decision 2: Serialized Promise Chain Queue for Immediate Flushes**:
  - *Chosen Approach*: Chain `flushAutoSyncImmediately` operations into an atomic task queue.
  - *Why*: Guarantees that even if three quick capture operations or device sync triggers fire within 10ms of each other, they execute strictly in order with increasing sync versions rather than colliding on the network.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Incoming Realtime Event                         │
│                                                                        │
│   Incoming: remoteData (_meta.syncVersion, updatedAt)                  │
│                     │                                                  │
│   Compare: remoteTimestamp vs localMutationTimestamp                   │
│                     │                                                  │
│         Is remoteTimestamp > localTimestamp?                           │
│         ├── NO: Discard silently (stale snapshot / echo)               │
│         │                                                              │
│         └── YES: Apply newer remote state                              │
│             1. Storage.importAllDataPayload(remoteData)                │
│             2. handleHydrateAllFromStorage(false)                      │
│             3. localMutationTimestamp = remoteTimestamp                │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                        Atomic flushAutoSyncImmediately                 │
│                                                                        │
│   Caller triggers: flushAutoSyncImmediately(payload)                   │
│                     │                                                  │
│   Enqueue onto serialized syncExecutionQueue                           │
│   ├── Assign Monotonic Version: syncVersion = Math.max(now, lastVersion+1)│
│   ├── Execute write to Supabase user_workspaces                       │
│   └── Update latestKnownRemoteTimestamp upon success                   │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Execution Steps:
1. **Export Timestamp Extraction Utility**:
   - Ensure `getPayloadSyncTimestamp` in `client/src/utils/supabase.ts` is exported and handles all timestamp formats (`_meta.syncVersion`, `updated_at`, `updatedAt`, numeric or ISO string).
2. **Implement Atomic Sync Queue in `client/src/utils/supabase.ts`**:
   - Implement `syncExecutionQueue` serialization so rapid calls to `flushAutoSyncImmediately` execute sequentially and atomically.
3. **Enhance Realtime Subscriber in `client/src/App.tsx`**:
   - Track `lastLocalMutationTimestamp` ref.
   - In `subscribeToRealtimeWorkspace`, extract `remoteTimestamp` and compare against `localTimestamp`.
   - Apply only strictly newer remote updates.
4. **Verification**:
   - Run vitest across all test files.
   - Run linter and compiler.
