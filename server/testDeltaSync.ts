import crypto from 'crypto';
import { pool } from './db.js';
import { handleDeltaSync } from './syncService.js';

interface MockResponse {
  statusCode: number;
  data: any;
  status(code: number): MockResponse;
  json(payload: any): MockResponse;
}

function createMockResponse(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.data = payload;
      return this;
    },
  };
  return res;
}

async function runTests() {
  console.log('=== TEST DELTA SYNC ARCHITECTURE (Neon Postgres + Express) ===\n');

  const testWs = `test_ws_${Date.now()}`;
  const testEmail = `delta_tester_${Date.now()}@example.com`;

  try {
    // -------------------------------------------------------------
    // Test 1: PUSH new records with UUID v4, updated_at, is_deleted
    // -------------------------------------------------------------
    console.log('[Test 1] PUSH initial batch of 2 new transactions with UUIDs...');
    const uuid1 = crypto.randomUUID();
    const uuid2 = crypto.randomUUID();
    const t1Time = new Date('2026-11-02T10:00:00.000Z').toISOString();

    const pushReq1 = {
      method: 'POST',
      body: {
        workspace_identifier: testWs,
        user_email: testEmail,
        last_sync_timestamp: null,
        records: [
          {
            id: uuid1,
            name: 'MacBook M3 Pro',
            amount: 145000,
            category: 'Electronics',
            date: '2026-11-02',
            direction: 'DEBIT',
            is_deleted: false,
            updated_at: t1Time,
          },
          {
            id: uuid2,
            name: 'Consulting Fee Credit',
            amount: 85000,
            category: 'Income',
            date: '2026-11-02',
            direction: 'CREDIT',
            is_deleted: false,
            updated_at: t1Time,
          },
        ],
      },
    };

    const pushRes1 = createMockResponse();
    await handleDeltaSync(pushReq1, pushRes1);

    console.log('  Response status:', pushRes1.statusCode);
    console.log('  Pushed count:', pushRes1.data?.pushed_count);
    console.log('  Server timestamp:', pushRes1.data?.server_timestamp);
    if (pushRes1.data?.pushed_count !== 2) {
      throw new Error(`Expected 2 pushed records, got ${pushRes1.data?.pushed_count}`);
    }

    const checkpoint1 = pushRes1.data.server_timestamp;

    // -------------------------------------------------------------
    // Test 2: PULL records with last_sync_timestamp = null (Full delta)
    // -------------------------------------------------------------
    console.log('\n[Test 2] PULL delta records since epoch...');
    const pullReq1 = {
      method: 'POST',
      body: {
        workspace_identifier: testWs,
        user_email: testEmail,
        last_sync_timestamp: '1970-01-01T00:00:00.000Z',
        records: [],
      },
    };
    const pullRes1 = createMockResponse();
    await handleDeltaSync(pullReq1, pullRes1);

    console.log('  Pulled count:', pullRes1.data?.pulled_count);
    const pulledTxs = pullRes1.data?.pulled_records || [];
    console.log('  Pulled items:', pulledTxs.map((t: any) => `${t.name} (₹${t.amount}, ${t.direction})`));
    if (pulledTxs.length !== 2) {
      throw new Error(`Expected 2 pulled records, got ${pulledTxs.length}`);
    }

    // -------------------------------------------------------------
    // Test 3: Concurrency Conflict Resolution
    // Case A: PUSH with STALE updated_at should be IGNORED
    // -------------------------------------------------------------
    console.log('\n[Test 3A] Concurrency: PUSH with older updated_at (stale client write)...');
    const staleTime = new Date('2026-11-01T00:00:00.000Z').toISOString();
    const pushStaleReq = {
      method: 'POST',
      body: {
        workspace_identifier: testWs,
        user_email: testEmail,
        records: [
          {
            id: uuid1,
            name: 'MacBook M3 Pro - Stale Overwrite Attempt',
            amount: 999999,
            updated_at: staleTime,
          },
        ],
      },
    };
    const pushStaleRes = createMockResponse();
    await handleDeltaSync(pushStaleReq, pushStaleRes);
    console.log('  Pushed count:', pushStaleRes.data?.pushed_count);
    console.log('  Skipped IDs:', pushStaleRes.data?.skipped_ids);
    if (pushStaleRes.data?.skipped_ids?.includes(uuid1) !== true) {
      throw new Error('Stale update should have been skipped!');
    }

    // Verify row was NOT changed in DB
    const dbCheck1 = await pool.query('SELECT name, amount FROM transactions WHERE id = $1', [uuid1]);
    console.log('  DB row after stale attempt:', dbCheck1.rows[0]);
    if (dbCheck1.rows[0].name !== 'MacBook M3 Pro') {
      throw new Error('Row was incorrectly overwritten by stale write!');
    }

    // -------------------------------------------------------------
    // Test 3B: PUSH with NEWER updated_at should WIN
    // -------------------------------------------------------------
    console.log('\n[Test 3B] Concurrency: PUSH with newer updated_at (valid update)...');
    const newerTime = new Date('2026-11-02T12:30:00.000Z').toISOString();
    const pushNewerReq = {
      method: 'POST',
      body: {
        workspace_identifier: testWs,
        user_email: testEmail,
        records: [
          {
            id: uuid1,
            name: 'MacBook M3 Pro (Updated)',
            amount: 140000,
            category: 'Electronics',
            date: '2026-11-02',
            direction: 'DEBIT',
            is_deleted: false,
            updated_at: newerTime,
          },
        ],
      },
    };
    const pushNewerRes = createMockResponse();
    await handleDeltaSync(pushNewerReq, pushNewerRes);
    console.log('  Pushed count:', pushNewerRes.data?.pushed_count);
    console.log('  Applied IDs:', pushNewerRes.data?.applied_ids);
    if (pushNewerRes.data?.applied_ids?.includes(uuid1) !== true) {
      throw new Error('Newer update should have been applied!');
    }

    const dbCheck2 = await pool.query('SELECT name, amount FROM transactions WHERE id = $1', [uuid1]);
    console.log('  DB row after valid update:', dbCheck2.rows[0]);
    if (dbCheck2.rows[0].name !== 'MacBook M3 Pro (Updated)') {
      throw new Error('Row was not updated by valid newer write!');
    }

    // -------------------------------------------------------------
    // Test 4: Soft-Delete with is_deleted = true
    // -------------------------------------------------------------
    console.log('\n[Test 4] Soft-delete record uuid2...');
    const deleteTime = new Date('2026-11-02T13:00:00.000Z').toISOString();
    const deleteReq = {
      method: 'POST',
      body: {
        workspace_identifier: testWs,
        user_email: testEmail,
        records: [
          {
            id: uuid2,
            name: 'Consulting Fee Credit',
            amount: 85000,
            is_deleted: true,
            updated_at: deleteTime,
          },
        ],
      },
    };
    const deleteRes = createMockResponse();
    await handleDeltaSync(deleteReq, deleteRes);
    console.log('  Pushed count:', deleteRes.data?.pushed_count);
    console.log('  Applied IDs:', deleteRes.data?.applied_ids);

    const dbCheck3 = await pool.query('SELECT id, is_deleted, updated_at FROM transactions WHERE id = $1', [uuid2]);
    console.log('  DB row after soft-delete:', dbCheck3.rows[0]);
    if (dbCheck3.rows[0].is_deleted !== true) {
      throw new Error('Row is_deleted flag is not true in DB!');
    }

    // -------------------------------------------------------------
    // Test 5: Incremental PULL using last_sync_timestamp
    // -------------------------------------------------------------
    console.log('\n[Test 5] Incremental PULL using checkpoint timestamp...');
    const pullReq2 = {
      method: 'POST',
      body: {
        workspace_identifier: testWs,
        user_email: testEmail,
        last_sync_timestamp: checkpoint1,
        records: [],
      },
    };
    const pullRes2 = createMockResponse();
    await handleDeltaSync(pullReq2, pullRes2);

    console.log('  Incremental Pulled count:', pullRes2.data?.pulled_count);
    const incrementalPulled = pullRes2.data?.pulled_records || [];
    console.log('  Incremental Pulled items:', incrementalPulled.map((t: any) => `${t.name} (is_deleted: ${t.is_deleted})`));

    // Both uuid1 (updated) and uuid2 (soft deleted) had updated_at > checkpoint1
    if (incrementalPulled.length !== 2) {
      throw new Error(`Expected 2 modified records in delta, got ${incrementalPulled.length}`);
    }

    const softDeletedItem = incrementalPulled.find((t: any) => t.id === uuid2);
    if (!softDeletedItem || softDeletedItem.is_deleted !== true) {
      throw new Error('Soft-deleted item was not correctly returned with is_deleted=true in delta pull!');
    }

    console.log('\n>>> ALL 5 DELTA SYNC ARCHITECTURE TESTS PASSED SUCCESSFULLY! <<<\n');
  } finally {
    // Cleanup test workspace transactions
    await pool.query('DELETE FROM transactions WHERE workspace_identifier = $1', [testWs]);
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('[TEST FAILURE]', err);
  process.exit(1);
});
