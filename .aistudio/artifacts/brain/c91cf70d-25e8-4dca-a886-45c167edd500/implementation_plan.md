# Multi-Device Session Coexistence & Realtime Presence Plan

Fix the multi-device consistency issue where sessions on Laptop Chrome (Cloudflare Pages) and AI Studio Preview overwrote each other and showed only 1 connected device, by identifying sessions strictly by their unique persistent session ID, adding environment context tags, and broadcasting presence updates in real time.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed Choices from Clarification (Phase 1)**:
> 1. **Environment-Aware Device Naming**: Include clear environment tags in device names (e.g. `Google Chrome (Web • Cloudflare)` vs `Google Chrome (AI Studio Preview)`) so the user can easily distinguish different sessions from the same browser/OS.
> 2. **Realtime Presence Updates**: Broadcast device registrations and disconnections over the Supabase Realtime channel so that open Settings dialogs on other devices update instantly (<30ms) without needing a manual refresh click.
> 3. **Session Uniqueness by Persistent ID**: Eliminate the flawed `os + browser + deviceType` grouping that collapsed distinct sessions into a single item, keying device records strictly by persistent `DEVICE_SESSION_ID`.

---

### 1. Root Cause Analysis

- **Why were both devices showing "Logged in on 1 device"?**:
  1. In `client/src/utils/devices.ts`, `registerCurrentDevice` used:
     ```ts
     const existingIdx = existingDevices.findIndex(d =>
       d.id === DEVICE_SESSION_ID ||
       (d.os === info.os && d.browser === info.browser && d.deviceType === info.deviceType)
     );
     ```
     Because both Laptop Chrome (`personal-dashboard-3ag.pages.dev`) and AI Studio Preview were accessed on Google Chrome on Windows, `existingIdx` matched the other device and overwrote its ID and record!
  2. In `deduplicateDevices`, sessions were keyed as:
     ```ts
     const key = `${d.os}___${d.browser}___${d.deviceType}`;
     ```
     This deliberately pruned any two sessions sharing the same browser and OS down to a single device.
  3. Device registration was isolated in an asynchronous row without realtime broadcast, meaning neither device was alerted when the other logged in.

---

### 2. User Experience & Visual Presentation

- **Connected Devices List in Settings**:
  - Device 1: `Google Chrome (Web • Cloudflare)` — `This Device` (if viewing from laptop) / `Active now`
  - Device 2: `Google Chrome (AI Studio Preview)` — `Active now • Remote` with `Sign out` button
  - Badge dynamically reflects: `Logged in on 2 devices`
- **Instant Updates**:
  - When you log into AI Studio or Cloudflare Pages, the other screen's Settings modal immediately displays the new device without clicking refresh.
  - Clicking `Sign out` on a remote device sends an immediate command that logs out that remote session and updates both lists.

---

### 3. Key Technical Decisions & Trade-Offs

- **Decision 1: Persistent ID (`d.id`) as Primary Key**:
  - *Chosen Approach*: Only update an existing device if its exact `d.id === DEVICE_SESSION_ID`.
  - *Why*: Allows multiple sessions of the same browser (different tabs, profiles, preview environments, or physical computers with identical OS) to coexist harmoniously.
- **Decision 2: Stale Session Expiration**:
  - *Chosen Approach*: Sessions inactive for more than 30 days are automatically pruned during registration.
  - *Why*: Prevents ghost devices from lingering indefinitely if a browser session is permanently deleted without logging out.

---

### 4. Technical Architecture & Component Mapping

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Device Registration Flow                        │
│                                                                        │
│   Device A (Cloudflare Pages)                Device B (AI Studio)     │
│   ID: dev_cf_abc123                          ID: dev_ais_xyz789       │
│   Name: Google Chrome (Web • Cloudflare)     Name: Google Chrome (AI Studio)
│            │                                          │                │
│            ▼                                          ▼                │
│   ┌────────────────────────────────────────────────────────┐           │
│   │   Supabase `account_devices_${cleanEmail}` Row          │           │
│   │   devices: [                                           │           │
│   │     { id: dev_cf_abc123, name: "Web • Cloudflare" },   │           │
│   │     { id: dev_ais_xyz789, name: "AI Studio Preview" }  │           │
│   │   ]                                                    │           │
│   └──────────────────────────┬─────────────────────────────┘           │
│                              │                                         │
│                              ▼                                         │
│        Supabase Realtime Broadcast: `device_presence_update`           │
│          ├── Device A receives event ──► Updates UI: 2 devices         │
│          └── Device B receives event ──► Updates UI: 2 devices         │
└────────────────────────────────────────────────────────────────────────┘
```

#### Files to Modify:
1. `client/src/utils/devices.ts`:
   - Enhance `getDeviceInfo()` to append environment tags (`Web • Cloudflare`, `AI Studio Preview`, `Localhost`, `Android Native APK`).
   - Fix `registerCurrentDevice` and `deduplicateDevices` to key strictly by `d.id`.
   - Broadcast `device_presence_update` on Realtime channel when devices register or change.
2. `client/src/components/SettingsModal.tsx`:
   - Subscribe to `device_presence_update` events via Supabase channel when modal is open to update device list live.
3. Verification:
   - Run vitest across all test files.
   - Run linter and compiler.
