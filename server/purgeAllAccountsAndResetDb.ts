import https from 'https';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('[RESET] SUPABASE_URL or SUPABASE_SECRET_KEY is missing from environment.');
}

function requestSupabase(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/${endpoint}`);
    const req = https.request(
      url,
      {
        method,
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(raw ? JSON.parse(raw) : { success: true, status: res.statusCode });
            } catch {
              resolve({ success: true, status: res.statusCode, raw });
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function purgeAll() {
  console.log('=== STARTING COMPLETE ACCOUNT PURGE & FRESH DATABASE RESET ===\n');

  // 1. PURGE NEON DATABASE TABLES
  console.log('1. Purging all tables in Neon Serverless Postgres...');

  // Delete all authority and sync conflict records
  await pool.query('TRUNCATE TABLE expense_authority CASCADE');
  console.log('  - Truncated expense_authority');

  await pool.query('TRUNCATE TABLE data_conflicts CASCADE');
  console.log('  - Truncated data_conflicts');

  await pool.query('TRUNCATE TABLE data_versions CASCADE');
  console.log('  - Truncated data_versions');

  await pool.query('TRUNCATE TABLE sync_queues CASCADE');
  console.log('  - Truncated sync_queues');

  await pool.query('TRUNCATE TABLE connected_devices CASCADE');
  console.log('  - Truncated connected_devices');

  // Delete all transactions
  await pool.query('TRUNCATE TABLE transactions CASCADE');
  console.log('  - Truncated transactions');

  // Delete all workspaces
  await pool.query('TRUNCATE TABLE workspaces CASCADE');
  console.log('  - Truncated workspaces');

  console.log('\nVerifying Neon Database is full fresh & empty:');
  const wsCount = await pool.query('SELECT COUNT(*) FROM workspaces');
  const txCount = await pool.query('SELECT COUNT(*) FROM transactions');
  const devCount = await pool.query('SELECT COUNT(*) FROM connected_devices');
  const authCount = await pool.query('SELECT COUNT(*) FROM expense_authority');

  console.log(`  - workspaces rows: ${wsCount.rows[0].count}`);
  console.log(`  - transactions rows: ${txCount.rows[0].count}`);
  console.log(`  - connected_devices rows: ${devCount.rows[0].count}`);
  console.log(`  - expense_authority rows: ${authCount.rows[0].count}`);

  if (
    Number(wsCount.rows[0].count) !== 0 ||
    Number(txCount.rows[0].count) !== 0 ||
    Number(devCount.rows[0].count) !== 0
  ) {
    throw new Error('Neon database tables are not completely empty!');
  }

  // 2. PURGE SUPABASE DATABASE (user_workspaces)
  console.log('\n2. Purging user_workspaces and account records in Supabase...');
  try {
    const delRes = await requestSupabase('rest/v1/user_workspaces?user_email=neq.placeholder_keep_empty', 'DELETE');
    console.log('  - Deleted all rows from Supabase user_workspaces:', delRes);
  } catch (err: any) {
    console.warn('  - Notice deleting from Supabase user_workspaces:', err.message);
  }

  // 3. PURGE SUPABASE AUTH USERS (gknayak@gmail.com, arpitapri125@gmail.com, etc.)
  console.log('\n3. Purging Supabase Auth users via Admin API...');
  try {
    const authUsers = await requestSupabase('auth/v1/admin/users', 'GET');
    const users = authUsers?.users || [];
    console.log(`  - Found ${users.length} users in Supabase Auth.`);

    for (const u of users) {
      const email = (u.email || '').toLowerCase();
      if (
        email.includes('gknayak') ||
        email.includes('arpitapri125') ||
        email.includes('gulnayak')
      ) {
        console.log(`  - Deleting auth user: ${u.id} (${u.email})...`);
        const delRes = await requestSupabase(`auth/v1/admin/users/${u.id}`, 'DELETE');
        console.log(`    Result:`, delRes);
      }
    }
  } catch (err: any) {
    console.warn('  - Notice purging Supabase Auth users:', err.message);
  }

  // Verify Supabase Auth is cleared of targeted accounts
  try {
    const authUsersAfter = await requestSupabase('auth/v1/admin/users', 'GET');
    const remaining = authUsersAfter?.users || [];
    console.log(`  - Remaining users in Supabase Auth: ${remaining.length}`);
    for (const r of remaining) {
      console.log(`    - ${r.id} (${r.email})`);
    }
  } catch (err: any) {
    console.warn('  - Notice verifying Supabase Auth:', err.message);
  }

  console.log('\n=== DATABASE PURGE AND RESET COMPLETED SUCCESSFULLY ===');
  await pool.end();
}

purgeAll().catch((err) => {
  console.error('Fatal purge error:', err);
  process.exit(1);
});
