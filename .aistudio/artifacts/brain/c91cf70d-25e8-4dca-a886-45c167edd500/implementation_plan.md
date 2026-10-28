# Expense & Habit Data Recovery and Partition Consolidation Plan

Recover the user's 2,61,662.90 SMS-derived spending data and authoritative habit tracking records for `gknayak@gmail.com` across partitioned workspace storage, persistent offline caches, and SMS rescan deduplication pipelines.

### User Review & Critical Decisions

> [!IMPORTANT]
> The investigation revealed why `gknayak@gmail.com` displayed 0 expenses despite having ₹2,61,662.90 logged from the SMS bank scanner:
> 1. **Multi-Tenant Partition Mismatch**: When the SMS scanner initially processed bank SMS on Android, the transactions were saved to local storage under the prior partition (such as `user_guest_notion_os_v4_expenses`, `notion_os_v4_expenses`, or `user_usr_gulnayak1206_gmail_com_notion_os_v4_expenses`). When signing in as `gknayak@gmail.com` (`user_036fe7d3-6a13-4740-b028-afb55e81e00e`), the app looked only in the new empty scoped key without migrating or checking the prior partitions.
> 2. **Ghost Fingerprint Deduplication Block**: When the user attempted to rescan SMS to restore the transactions, `smsExpenseService.ts` checked `processedFingerprints.includes(refKey)` and marked every SMS as a "duplicate_skipped" even though the actual expense items were absent from the active `getExpenses()` list.
> 3. **Habit Fallback Protection**: Habit storage for `gknayak@gmail.com` returned an empty array if the scoped key was present with an empty list instead of falling back to persistent cache backups or the authoritative `OWNER_GKN_HABITS`.

- **Confirmed Decision 1**: Implement comprehensive cross-partition expense recovery in `Storage.getExpenses()` to inspect all historical keys (`user_guest`, `notion_os_v4_expenses`, `user_usr_gulnayak1206_gmail_com`, `lifeos_expenses_backup`, etc.) and seamlessly hydrate the active `gknayak@gmail.com` partition with the full ₹2,61,662.90 historical ledger.
- **Confirmed Decision 2**: Fix `smsExpenseService.ts` deduplication logic so that a processed fingerprint does NOT block rescan if the transaction is absent from `existingExpenses` (unless actively tombstoned or trashed).
- **Confirmed Decision 3**: Ensure `Storage.getHabits()` and habit check-in handlers permanently preserve and hydrate the user's authoritative habits without zeroing out.

---

### 1. Overview & Core Concept

- **What It Does**: Safely un-blanks and consolidates historical SMS-scanned expenses and habits into the `gknayak@gmail.com` workspace, ensuring that all ₹2,61,662.90 in transactions are immediately visible under "All Time" and "This Month" spending views.
- **Target Persona**: Gulshan Kumar Nayak (`gknayak@gmail.com`), ensuring continuity of all financial and habit records across Android APK and Web.
- **Key Value**: Immediate restoration of the ₹2,61,662.90 spending ledger without data loss or duplicate conflicts.

---

### 2. Architecture & Data Flow

```
┌────────────────────────────────────────────────────────┐
│             Cross-Partition Storage Inspection         │
│                                                        │
│  Check:                                                │
│  - user_guest_notion_os_v4_expenses                   │
│  - notion_os_v4_expenses (legacy unscoped)             │
│  - user_usr_gulnayak1206_gmail_com_notion_os_v4_expenses
│  - user_036fe7d3-6a13-4740-b028-afb55e81e00e_*        │
│  - lifeos_expenses_backup / offline caches             │
│                                                        │
│  ===> Hydrate gknayak@gmail.com scoped partition       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│            SMS Deduplication Safeguard Fix             │
│                                                        │
│  In checkIsDuplicate():                                │
│  - If transaction reference exists in processed keys   │
│    BUT is missing from existingExpenses, allow rescan  │
│    to restore the transaction into Spending.           │
└────────────────────────────────────────────────────────┘
```

#### Key Technical Modifications
1. **`client/src/utils/storage.ts` (`getExpenses`)**:
   - Expand `offlineCacheKeys` for `isGknUser` to search all legacy, guest, and alternate workspace keys.
   - If current scoped list has 0 items and any candidate partition has valid expenses (> 0), automatically merge and persist into the active workspace.
2. **`client/src/services/smsExpenseService.ts` (`checkIsDuplicate`)**:
   - Only treat a transaction as duplicate if it is *actually present* in `existingExpenses` or explicitly tombstoned. Fingerprints from past scans must not prevent rescan recovery.
3. **`client/src/utils/storage.ts` (`getHabits`)**:
   - Ensure habits never resolve to an empty list for `isGknUser`; hydrate from cache or `OWNER_GKN_HABITS`.

---

### 3. Verification Plan

1. Verify cross-partition recovery logic with targeted tests.
2. Run full Vitest suite (`npm test`) and compilation verification (`compile_applet`, `lint_applet`).
3. Confirm that `gknayak@gmail.com` immediately loads all historical expenses and habits.
