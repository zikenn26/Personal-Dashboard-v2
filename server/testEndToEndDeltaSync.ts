import crypto from 'crypto';
import { pool } from './db.js';
import { handleDeltaSync } from './syncService.js';

interface MockResponse {
  statusCode: number;
  data: any;
  status(code: number): MockResponse;
  json(payload: any): MockResponse;
}

function mockRes(): MockResponse {
  const r: MockResponse = {
    statusCode: 200,
    data: null,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    json(p: any) {
      this.data = p;
      return this;
    },
  };
  return r;
}

async function runEndToEndVerification() {
  console.log('================================================================');
  console.log('   FULL-STACK END-TO-END DELTA SYNC & UUID VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const ws = `e2e_ws_${Date.now()}`;
  const userEmail = `e2e_tester_${Date.now()}@example.com`;

  try {
    // -------------------------------------------------------------
    // PHASE 1: Verify Live Neon PostgreSQL Schema & Constraints
    // -------------------------------------------------------------
    console.log('▶ [PHASE 1] Verifying Neon PostgreSQL Schema Integrity...');
    const colRes = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'transactions'
      ORDER BY ordinal_position;
    `);

    const colMap = new Map(colRes.rows.map((c: any) => [c.column_name, c]));

    const idCol = colMap.get('id');
    console.log(`  - Column 'id': ${idCol?.data_type} (Default: ${idCol?.column_default})`);
    if (idCol?.data_type !== 'uuid') {
      throw new Error(`Expected 'id' to be uuid, got ${idCol?.data_type}`);
    }

    const updatedCol = colMap.get('updated_at');
    console.log(`  - Column 'updated_at': ${updatedCol?.data_type} (Default: ${updatedCol?.column_default})`);
    if (!updatedCol?.data_type?.includes('timestamp')) {
      throw new Error(`Expected 'updated_at' to be timestamp, got ${updatedCol?.data_type}`);
    }

    const deletedCol = colMap.get('is_deleted');
    console.log(`  - Column 'is_deleted': ${deletedCol?.data_type} (Default: ${deletedCol?.column_default})`);
    if (deletedCol?.data_type !== 'boolean') {
      throw new Error(`Expected 'is_deleted' to be boolean, got ${deletedCol?.data_type}`);
    }

    // Verify compatibility view
    const viewRes = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('transactions', 'user_expenses', 'expenses');
    `);
    console.log('  - Registered Tables/Views in Neon:', viewRes.rows.map((t: any) => `${t.table_name} (${t.table_type})`).join(', '));
    console.log('  ✓ Schema verification PASSED!\n');

    // -------------------------------------------------------------
    // PHASE 2: Multi-Device Simulated Flow (Android APK + Web Chrome)
    // -------------------------------------------------------------
    console.log('▶ [PHASE 2] Multi-Device Delta Sync Simulation...');

    // Device A (Android APK): Auto-logs SMS expense
    const apkSmsExpenseId = crypto.randomUUID();
    const apkTime1 = new Date('2026-11-02T12:00:00.000Z').toISOString();
    console.log(`  - [Device A (APK)] SMS auto-logged: Swiggy ₹450 with UUID ${apkSmsExpenseId}`);

    const apkPushReq = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        last_sync_timestamp: null,
        records: [
          {
            id: apkSmsExpenseId,
            name: 'SWIGGY',
            amount: 450,
            category: 'Food',
            date: '2026-11-02',
            direction: 'DEBIT',
            source: 'sms_auto',
            referenceId: 'UPI429384928342',
            smsReferenceId: 'UPI429384928342',
            upiReference: 'UPI429384928342',
            rawSmsText: 'Rs 450.00 debited to SWIGGY. UPI: 429384928342.',
            is_deleted: false,
            updated_at: apkTime1,
          },
        ],
      },
    };
    const apkPushRes = mockRes();
    await handleDeltaSync(apkPushReq, apkPushRes);

    const deviceASyncCheckpoint1 = apkPushRes.data.server_timestamp;
    console.log(`  - [Device A (APK)] PUSH response: status=${apkPushRes.statusCode}, pushed=${apkPushRes.data?.pushed_count}, server_ts=${deviceASyncCheckpoint1}`);
    if (apkPushRes.data?.pushed_count !== 1) throw new Error('Device A push failed');

    // Device B (Web Browser): Pulls delta since epoch 0
    console.log('\n  - [Device B (Web)] Initial sync: pulling records from cloud...');
    const webPullReq1 = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        last_sync_timestamp: '1970-01-01T00:00:00.000Z',
        records: [],
      },
    };
    const webPullRes1 = mockRes();
    await handleDeltaSync(webPullReq1, webPullRes1);
    const deviceBSyncCheckpoint1 = webPullRes1.data.server_timestamp;

    console.log(`  - [Device B (Web)] Pulled count: ${webPullRes1.data?.pulled_count}`);
    const webRecords = webPullRes1.data?.pulled_records || [];
    if (webRecords.length !== 1 || webRecords[0].id !== apkSmsExpenseId) {
      throw new Error('Device B failed to receive Device A SMS expense');
    }
    console.log(`  ✓ Device B received: ${webRecords[0].name} (₹${webRecords[0].amount}, Ref: ${webRecords[0].referenceId})`);

    // Device B logs a manual transaction on the web
    const webExpenseId = crypto.randomUUID();
    const webTime1 = new Date('2026-11-02T12:05:00.000Z').toISOString();
    console.log(`\n  - [Device B (Web)] Logging manual expense: Organic Milk ₹120 with UUID ${webExpenseId}`);

    const webPushReq1 = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        last_sync_timestamp: deviceBSyncCheckpoint1,
        records: [
          {
            id: webExpenseId,
            name: 'Organic Milk',
            amount: 120,
            category: 'Groceries',
            date: '2026-11-02',
            direction: 'DEBIT',
            source: 'manual',
            is_deleted: false,
            updated_at: webTime1,
          },
        ],
      },
    };
    const webPushRes1 = mockRes();
    await handleDeltaSync(webPushReq1, webPushRes1);
    const deviceBSyncCheckpoint2 = webPushRes1.data.server_timestamp;
    console.log(`  - [Device B (Web)] Pushed manual expense. New server_ts: ${deviceBSyncCheckpoint2}`);

    // Device A (APK) now performs an INCREMENTAL DELTA PULL using deviceASyncCheckpoint1
    console.log('\n  - [Device A (APK)] Background delta sync: pulling updates since checkpoint 1...');
    const apkDeltaPullReq = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        last_sync_timestamp: deviceASyncCheckpoint1,
        records: [],
      },
    };
    const apkDeltaPullRes = mockRes();
    await handleDeltaSync(apkDeltaPullReq, apkDeltaPullRes);

    const apkPulled = apkDeltaPullRes.data?.pulled_records || [];
    console.log(`  - [Device A (APK)] Incremental pulled count: ${apkPulled.length}`);
    // Device A should ONLY receive the new web expense, NOT its own previous expense!
    if (apkPulled.length !== 1 || apkPulled[0].id !== webExpenseId) {
      throw new Error(`Device A delta pull expected 1 record (webExpenseId), got ${apkPulled.length}`);
    }
    console.log(`  ✓ Incremental delta sync verified: Device A received ONLY the new item: ${apkPulled[0].name}`);

    // -------------------------------------------------------------
    // PHASE 3: Timestamp-Based Conflict Resolution
    // -------------------------------------------------------------
    console.log('\n▶ [PHASE 3] Concurrency & Conflict Resolution Test (Last-Write-Wins)...');

    // Device B updates the Swiggy expense at 12:10:00
    const conflictTimeNewer = new Date('2026-11-02T12:10:00.000Z').toISOString();
    console.log('  - [Device B (Web)] Updates Swiggy to ₹480 (Tip added) at 12:10:00...');
    const webConflictPush = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        records: [
          {
            id: apkSmsExpenseId,
            name: 'SWIGGY (With Tip)',
            amount: 480,
            category: 'Food',
            date: '2026-11-02',
            is_deleted: false,
            updated_at: conflictTimeNewer,
          },
        ],
      },
    };
    const webConflictRes = mockRes();
    await handleDeltaSync(webConflictPush, webConflictRes);
    if (!webConflictRes.data?.applied_ids?.includes(apkSmsExpenseId)) {
      throw new Error('Device B valid update was not applied');
    }

    // Device A had an offline stale edit at 12:02:00 (older than 12:10:00)
    const conflictTimeStale = new Date('2026-11-02T12:02:00.000Z').toISOString();
    console.log('  - [Device A (APK)] Offline stale edit arrives with timestamp 12:02:00 (attempting to set ₹400)...');
    const apkStalePush = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        records: [
          {
            id: apkSmsExpenseId,
            name: 'SWIGGY (Stale Overwrite)',
            amount: 400,
            category: 'Food',
            date: '2026-11-02',
            is_deleted: false,
            updated_at: conflictTimeStale,
          },
        ],
      },
    };
    const apkStaleRes = mockRes();
    await handleDeltaSync(apkStalePush, apkStaleRes);

    console.log(`  - [Conflict Result] Pushed count: ${apkStaleRes.data?.pushed_count}, Skipped IDs: ${apkStaleRes.data?.skipped_ids}`);
    if (!apkStaleRes.data?.skipped_ids?.includes(apkSmsExpenseId)) {
      throw new Error('Server failed to reject/skip stale edit!');
    }

    // Verify in database that Device B's newer update is preserved
    const checkDbRow = await pool.query('SELECT name, amount FROM transactions WHERE id = $1', [apkSmsExpenseId]);
    console.log(`  - [Neon DB Current State] Name: '${checkDbRow.rows[0].name}', Amount: ₹${checkDbRow.rows[0].amount}`);
    if (checkDbRow.rows[0].name !== 'SWIGGY (With Tip)' || Number(checkDbRow.rows[0].amount) !== 480) {
      throw new Error('Neon DB did not preserve the winning timestamp record!');
    }
    console.log('  ✓ Timestamp collision resolution verified: Newer write WON, stale write SKIPPED!');

    // -------------------------------------------------------------
    // PHASE 4: Soft-Deletion & Remote Tombstone Propagation
    // -------------------------------------------------------------
    console.log('\n▶ [PHASE 4] Soft-Deletion & Tombstone Propagation...');
    const deleteTime = new Date('2026-11-02T12:20:00.000Z').toISOString();
    console.log(`  - [Device B (Web)] Deletes expense '${webExpenseId}' at 12:20:00...`);

    const deletePushReq = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        records: [
          {
            id: webExpenseId,
            name: 'Organic Milk',
            amount: 120,
            is_deleted: true,
            updated_at: deleteTime,
          },
        ],
      },
    };
    const deletePushRes = mockRes();
    await handleDeltaSync(deletePushReq, deletePushRes);
    const deleteServerCheckpoint = deletePushRes.data.server_timestamp;

    // Check Neon DB directly
    const dbDeletedRow = await pool.query('SELECT id, is_deleted, deleted_at FROM transactions WHERE id = $1', [webExpenseId]);
    console.log(`  - [Neon DB] is_deleted: ${dbDeletedRow.rows[0].is_deleted}, deleted_at: ${dbDeletedRow.rows[0].deleted_at}`);
    if (dbDeletedRow.rows[0].is_deleted !== true) {
      throw new Error('Record in Neon DB is not marked is_deleted=true');
    }

    // Device A (APK) pulls delta updates
    console.log('  - [Device A (APK)] Delta pull for deletions...');
    const apkDeletePullReq = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        last_sync_timestamp: conflictTimeNewer,
        records: [],
      },
    };
    const apkDeletePullRes = mockRes();
    await handleDeltaSync(apkDeletePullReq, apkDeletePullRes);

    const pulledDeleted = apkDeletePullRes.data?.pulled_records || [];
    const targetDeleted = pulledDeleted.find((r: any) => r.id === webExpenseId);
    console.log(`  - [Device A (APK)] Pulled record for ${webExpenseId}: is_deleted=${targetDeleted?.is_deleted}`);
    if (!targetDeleted || targetDeleted.is_deleted !== true) {
      throw new Error('Soft-deleted record not returned with is_deleted=true during delta sync');
    }
    console.log('  ✓ Soft-deletion propagation verified: Tombstone successfully received by peer device!');

    // -------------------------------------------------------------
    // PHASE 5: Resiliency & Edge Cases
    // -------------------------------------------------------------
    console.log('\n▶ [PHASE 5] Edge Case & Non-UUID Auto-Conversion Resiliency...');

    // Non-UUID input auto-conversion test
    const legacyExpPush = {
      method: 'POST',
      body: {
        workspace_identifier: ws,
        user_email: userEmail,
        records: [
          {
            id: 'legacy-exp-not-a-uuid-12345',
            name: 'Legacy Item Conversion',
            amount: 99,
            category: 'Testing',
            date: '2026-11-02',
            is_deleted: false,
            updated_at: new Date().toISOString(),
          },
        ],
      },
    };
    const legacyExpRes = mockRes();
    await handleDeltaSync(legacyExpPush, legacyExpRes);
    console.log(`  - Non-UUID auto-conversion: status=${legacyExpRes.statusCode}, pushed=${legacyExpRes.data?.pushed_count}`);
    if (legacyExpRes.data?.pushed_count !== 1) {
      throw new Error('Failed to auto-convert non-UUID into UUID v4');
    }

    // Missing workspace parameter validation
    const invalidReq = { method: 'POST', body: {} };
    const invalidRes = mockRes();
    await handleDeltaSync(invalidReq, invalidRes);
    console.log(`  - Missing workspace 400 guard: status=${invalidRes.statusCode}`);
    if (invalidRes.statusCode !== 400) {
      throw new Error('Missing workspace parameter did not return 400');
    }

    console.log('\n================================================================');
    console.log('   >>> ALL PHASES OF DELTA SYNC VERIFICATION PASSED 100%! <<<   ');
    console.log('================================================================\n');
  } finally {
    // Clean up test workspace rows
    await pool.query('DELETE FROM transactions WHERE workspace_identifier = $1', [ws]);
    await pool.end();
  }
}

runEndToEndVerification().catch((err) => {
  console.error('\n❌ [E2E FAILURE]:', err);
  process.exit(1);
});
