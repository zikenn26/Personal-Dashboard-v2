# Production-Grade Multi-Device Presence & Primary Payload Synchronization Plan

Adopt the architecture used by WhatsApp Web, Instagram, and Telegram: store device sessions directly inside the primary workspace payload (`workspace_data.devices`), integrate native Supabase Realtime Presence (`channel.track`), and provide a unified device list with live presence indicators across all connected instances.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Clarification (Phase 1)**:
> 1. **Primary Workspace Storage**: Store device session records directly inside `workspace_data.devices` within the primary `user_workspaces` document (`user_usr_${cleanEmail}`). This eliminates auxiliary row lookups, prevents RLS/402 isolation failures, and guarantees that device lists synchronize atomically alongside all workspace data (todos, habits, expenses).
> 2. **Native Realtime Presence (WhatsApp/Telegram Architecture)**: Utilize Supabase Realtime Channel Presence (`channel.track`) so that as soon as any device or browser tab opens, its live presence is broadcast instantly to all other open instances.
> 3. **Unified Display with Live Indicators**: Render a unified device list in `ConnectedDevices.tsx` showing all authorized devices, with an animated emerald pulse badge for instances currently connected online ("Active now • Online") and relative timestamps for recent instances ("Last seen 10m ago").

---

### 1. Root Cause & Architectural Shift

- **The Problem with the Old Approach**:
  - The old implementation attempted to write devices to a separate auxiliary row `account_devices_${cleanEmail}` via standalone unauthenticated calls and separate ad-hoc channels.
  - When Supabase queries or channels were isolated or restricted, this auxiliary row was never fetched or updated by the peer device, forcing both devices to fall back to their own isolated `localStorage` cache (`Logged in on 1 device`).
- **The Modern Production Solution**:
  - **Embedded in Primary Workspace**: The `devices` array is stored directly in `workspace_data.devices` and `Storage.getDevices()`. Whenever any device syncs or broadcasts its workspace, the active device list travels with it automatically.
  - **Realtime Presence Channel**: Connect to `activeRealtimeChannel.track({ deviceId, deviceName, ... })`. When Device B opens, Device A receives `presence.sync` and immediately displays Device B online in real time without waiting for periodic polling.

---

### 2. User Experience & Visual Flow

- **Settings Modal (`ConnectedDevices`)**:
  - Header: `Active Connected Devices` with live badge: `2 instances online`.
  - **Device 1 (Your Current Session)**:
    - Title: `Google Chrome (Web • Cloudflare)` (or `Google Chrome (AI Studio Preview)`)
    - Badges: `This Device` (Indigo) + `Active now • Online` (Emerald Pulse)
    - Browser & OS details
  - **Device 2 (Peer Session)**:
    - Title: `Google Chrome (AI Studio Preview)` (or `Google Chrome (Web • Cloudflare)`)
    - Badges: `Active now • Online` (Emerald Pulse) + `Remote`
    - Action: `Log Out` button with confirmation guard
  - **Sign Out All Others**:
    - Quick 1-click action to revoke all peer sessions instantly.

---

### 3. Key Technical Decisions & Data Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                      Multi-Device Synchronization                      │
│                                                                        │
│   Device A (Cloudflare Pages)                Device B (AI Studio)     │
│   ID: dev_cf_abc123                          ID: dev_ais_xyz789       │
│                                                                        │
│   1. channel.track({ id, name, ... })        1. channel.track(...)    │
│            │                                          │                │
│            ▼                                          ▼                │
│   ┌────────────────────────────────────────────────────────┐           │
│   │           Supabase Realtime Channel Presence            │           │
│   │   presenceState: {                                     │           │
│   │     "dev_cf_abc123": [{ name: "Web • Cloudflare" }],   │           │
│   │     "dev_ais_xyz789": [{ name: "AI Studio Preview" }]  │           │
│   │   }                                                    │           │
│   └──────────────────────────┬─────────────────────────────┘           │
│                              │                                         │
│                              ▼                                         │
│   2. Embedded in Primary Workspace Row (`user_usr_${cleanEmail}`):     │
│      workspace_data.devices: [                                         │
│        { id: "dev_cf_abc123", deviceName: "Web • Cloudflare", ... },   │
│        { id: "dev_ais_xyz789", deviceName: "AI Studio Preview", ... }  │
│      ]                                                                 │
│                              │                                         │
│                              ▼                                         │
│   3. Both devices render unified list with live presence status!       │
└────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Implementation Steps:
1. **Extend `Storage` in `client/src/utils/storage.ts`**:
   - Add `devices` collection to default workspace state, `getAllDataPayload()`, and `importAllDataPayload()`.
   - Maintain `Storage.getDevices()` and `Storage.saveDevices()`.
2. **Integrate Realtime Presence in `client/src/utils/supabase.ts`**:
   - In `subscribeToRealtimeWorkspace`, call `channel.track(...)` with current device information.
   - Listen for `presence.sync` and notify presence listeners.
   - In `syncWorkspaceToSupabase`, ensure `workspacePayload.devices` always contains the current device and merges existing remote devices.
3. **Refactor `client/src/utils/devices.ts`**:
   - Wire `fetchAccountDevices` and `registerCurrentDevice` directly to `Storage` and primary workspace syncing.
   - Export `subscribeToDevicePresence` linked to Supabase channel presence.
4. **Update `ConnectedDevices.tsx`**:
   - Highlight devices with live green indicator when present in active presence state.
   - Support remote revocation via realtime broadcast command.
5. **Verification**:
   - Run vitest suite across all tests.
   - Run linter and compiler.
