# Implementation Plan: Singular & Synchronized Multi-Device Data Architecture

Eliminate cross-device data divergence for `gknayak@gmail.com` across Android APK, Web browser, and AI Studio environments by addressing the Supabase egress quota lockout, establishing a fresh cloud database connection with high-availability fallback, implementing APK-authoritative data reconciliation, and enabling seamless background synchronization.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions have been finalized based on your answers:
> - **Sync Backend Infrastructure**: Configure a **fresh cloud database instance with zero quota restrictions**, coupled with an automatic applet-hosted cloud sync relay (`/api/sync`) so devices remain synchronized even if external third-party quotas are exceeded.
> - **Authoritative Merge Strategy**: **APK as Master Source**. Financial transactions, SMS-derived expenses (such as the current ₹2,53,691.45 balance), and native records originating from the Android APK will always be treated as authoritative and will never be overwritten, downgraded, or zeroed out by web sessions.
> - **User Interface Experience**: **Auto-sync in background only** without extra header buttons to keep the top navigation clean, minimal, and non-intrusive. Sync health and credentials can be inspected and updated in the Settings modal.

---

## 1. Problem Diagnosis & Root Cause Analysis

### Why different devices currently show different data for `gknayak@gmail.com`:

1. **Supabase Cloud Quota Lockout (`HTTP 402 exceed_egress_quota`)**:
   - The current configured Supabase project (`amlegmbvqzbhqqqbrvjx.supabase.co`) has exceeded its bandwidth egress quota.
   - Every read and write request sent to Supabase fails with:
     ```json
     {"message":"Service for this project is restricted due to the following violations: exceed_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service."}
     ```
   - Because the cloud database rejects all connections, **the APK cannot push its ₹2,53,691.45 dataset to the cloud**, and **the Web/AI Studio browser cannot pull it**.
   - As a result, each device remains partitioned in its local storage cache, appearing as disconnected silos.

2. **Presence & Heartbeat Isolation**:
   - Because Supabase Realtime channels fail to establish due to the project lockout, presence pulses are not delivered between the APK and Web sessions. Each client only sees itself (`1 instance`).

---

## 2. Proposed Architecture & System Design

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│              UNIFIED MULTI-DEVICE CLOUD SYNCHRONIZATION ENGINE                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   [Android Native APK]               [Web Browser]            [AI Studio]        │
│   - Holds Master ₹2.53 Lakh          - Local Cache            - Preview Tab      │
│   - SMS Auto-Capture Engine          - Realtime Listener      - Diagnostic View  │
│            │                               │                        │            │
│            └───────────────────────┬───────┴────────────────────────┘            │
│                                    │                                             │
│               ┌────────────────────▼────────────────────┐                        │
│               │   Multi-Tier Cloud Transport Router     │                        │
│               │   - Primary: Fresh Cloud Database       │                        │
│               │   - Secondary: Applet Relay (/api/sync) │                        │
│               └────────────────────┬────────────────────┘                        │
│                                    │                                             │
│               ┌────────────────────▼────────────────────┐                        │
│               │ APK-Authoritative Reconciliation Engine │                        │
│               │ - Preserves ₹2,53,691.45 Master Data    │                        │
│               │ - Merges Web manual additions           │                        │
│               │ - Reconciles Connected Devices & Heart  │                        │
│               └────────────────────┬────────────────────┘                        │
│                                    │                                             │
│                     ┌──────────────┴──────────────┐                              │
│                     ▼                             ▼                              │
│         [Fresh Cloud Database]          [Local Durable Storage]                  │
│         - Unrestricted Quota            - IndexedDB & LocalStorage               │
│         - Realtime Broadcast            - Zero-Loss Local Cache                  │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Step 1: Fresh Cloud Database Configuration & Connection Switcher
- **File**: `client/src/utils/supabaseConfig.ts` & `client/src/utils/supabase.ts`
- Implement dynamic cloud database configuration supporting:
  1. A fresh Supabase project URL and anon key (configurable in Settings or via environment).
  2. Automatic failover to the local applet backend endpoint `/api/sync/workspace` when external Supabase endpoints report `exceed_egress_quota` (HTTP 402).
  3. Add Cloud Database settings panel in `SettingsModal.tsx` allowing the user to view cloud status and input fresh database credentials at any time.

### Step 2: Applet-Hosted Cloud Sync Relay Server (`/api/sync`)
- **File**: `server/syncService.ts` & `server/index.ts`
- Implement durable server-side workspace persistence in Node/Express:
  - `GET /api/sync/workspace`: Retrieves the latest authoritative workspace snapshot for `user_identifier` / `user_email`.
  - `POST /api/sync/workspace`: Atomically stores and updates the workspace snapshot with optimistic concurrency control and monotonic sync versions.
  - `GET /api/sync/devices`: Returns all active devices with real-time heartbeat status for the user account.
- This gives `gknayak@gmail.com` an immediate, unrestricted, zero-egress cloud sync pipeline accessible by all browser and mobile instances.

### Step 3: APK-Authoritative Master Reconciliation Engine
- **File**: `client/src/utils/supabase.ts` & `client/src/utils/expenseUtils.ts`
- When syncing data across devices:
  - Detect whether the payload originates from an Android Native APK (via Capacitor platform check or `_meta.apkInstalled: true`).
  - If a device is APK-identified, its financial transactions (including the ₹2,53,691.45 balance) are treated as the master dataset.
  - Non-native web clients fetching remote data will never discard or zero out SMS-derived transactions.
  - Tombstoned (deleted) records are tracked in a persistent tombstone set (`_meta.deletedExpenseIds`) so deleted items stay deleted across all devices without causing resurrection loops.

### Step 4: Silent Background Auto-Sync Engine
- **File**: `client/src/App.tsx` & `client/src/utils/supabase.ts`
- As requested, no extra header button will be added. Auto-sync operates completely in the background:
  - **On Application Focus / Resume**: Automatically pulls the latest cloud workspace snapshot and synchronizes local state.
  - **On Local Changes**: Debounces local changes by 500ms and sends an optimistic push to the cloud backend.
  - **Periodic Pulse**: Runs a lightweight background sync check every 30 seconds to catch remote changes from other active instances.
  - **Anti-Overwrite Guard**: Prevents an empty or unhydrated snapshot from replacing existing local expenses.

### Step 5: Enhanced Connected Devices Presence Diagnostics
- **File**: `client/src/components/ConnectedDevices.tsx` & `client/src/services/deviceService.ts`
- Unify device tracking using both WebSocket presence and server-backed heartbeat records:
  - Display all connected sessions for `gknayak@gmail.com` (APK, Desktop Chrome, AI Studio Preview) with live green indicators.
  - Provide a clear tag showing device type: `Android Native APK`, `Web Browser`, `AI Studio`.
  - Include last active timestamp and sync state.

---

## 4. Verification Plan

### Automated Checks
1. `npm run check` (`tsc --noEmit`): Verify strict TypeScript compilation with zero type errors.
2. `compile_applet`: Verify that the entire frontend and backend build cleanly without bundling errors.

### Cross-Device Sync Verification
1. **Cloud Egress Bypass Verification**:
   - Test sync push/pull to verify that HTTP 402 egress errors no longer block data persistence.
   - Verify that data submitted on one device is persisted to the server/cloud database.
2. **Authoritative Expense Preservation**:
   - Verify that the APK expense dataset (e.g. ₹2,53,691.45) is properly recognized as the master source and is not wiped out on web app load.
   - Verify that transactions added on the APK sync across to Web sessions, and manual additions on Web reconcile smoothly into the APK.
3. **Background Sync Behavior**:
   - Confirm that synchronization occurs smoothly in the background without requiring user intervention or cluttering the header UI.
4. **Connected Devices List**:
   - Verify that the Connected Devices modal correctly lists multiple active instances when multiple browsers/apps are open with the same email (`gknayak@gmail.com`).
