import https from 'https';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.warn('[MIGRATION] SUPABASE_URL or SUPABASE_SECRET_KEY is missing from environment.');
}

function fetchSupabase(endpoint: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
    const req = https.get(
      url,
      {
        headers: {
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              reject(new Error(`Failed to parse response: ${e}`));
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
  });
}

async function run() {
  console.log('--- STARTING COMPLETE SUPABASE TO NEON MIGRATION ---');

  // 1. Fetch all user_workspaces from Supabase
  console.log('Fetching all user_workspaces rows from Supabase...');
  const remoteWorkspaces = await fetchSupabase('user_workspaces?select=*');
  console.log(`Fetched ${remoteWorkspaces.length} workspace records from Supabase.`);

  // Find GKN master record (user_036fe7d3-6a13-4740-b028-afb55e81e00e has 517 expenses + habits + profile)
  const gknRecord = remoteWorkspaces.find(
    (r: any) => r.user_identifier === 'user_036fe7d3-6a13-4740-b028-afb55e81e00e'
  ) || remoteWorkspaces.find((r: any) => r.user_email === 'gknayak@gmail.com' && r.workspace_data?.expenses?.length > 0);

  // Find Arpita master record (user_9e637e3b-c199-4611-8af9-c16c1fa942d5 has 25 expenses + profile)
  const arpitaRecord = remoteWorkspaces.find(
    (r: any) => r.user_identifier === 'user_9e637e3b-c199-4611-8af9-c16c1fa942d5'
  ) || remoteWorkspaces.find((r: any) => r.user_email === 'arpitapri125@gmail.com' && r.workspace_data?.expenses?.length > 0);

  // Find Gulshan 1206 record
  const gul1206Record = remoteWorkspaces.find(
    (r: any) => r.user_identifier === 'user_gulnayak1206@gmail.com'
  );

  if (!gknRecord) {
    throw new Error('Could not find master workspace record for gknayak@gmail.com in Supabase!');
  }
  if (!arpitaRecord) {
    throw new Error('Could not find master workspace record for arpitapri125@gmail.com in Supabase!');
  }

  const gknData = gknRecord.workspace_data;
  const arpitaData = arpitaRecord.workspace_data;

  const gknExpenses: any[] = gknData.expenses || [];
  const arpitaExpenses: any[] = arpitaData.expenses || [];

  console.log(`\nAuthoritative Data Verified:`);
  console.log(`- GKN (gknayak@gmail.com): ${gknExpenses.length} authentic expenses, ${(gknData.habits || []).length} habits`);
  console.log(`- Arpita (arpitapri125@gmail.com): ${arpitaExpenses.length} authentic expenses, Profile: ${arpitaData.profile?.name}`);

  // Calculate totals
  let gknDebit = 0, gknCredit = 0;
  for (const e of gknExpenses) {
    const amt = Number(e.amount) || 0;
    const isDebit = e.direction === 'DEBIT' || e.transactionType === 'expense' || !e.direction;
    if (isDebit) gknDebit += amt; else gknCredit += amt;
  }
  console.log(`  GKN Spending: Debit: ₹${gknDebit.toFixed(2)}, Credit: ₹${gknCredit.toFixed(2)}, Net: ₹${(gknCredit - gknDebit).toFixed(2)}`);

  let arpDebit = 0, arpCredit = 0;
  for (const e of arpitaExpenses) {
    const amt = Number(e.amount) || 0;
    const isDebit = e.direction === 'DEBIT' || e.transactionType === 'expense' || !e.direction;
    if (isDebit) arpDebit += amt; else arpCredit += amt;
  }
  console.log(`  Arpita Spending: Debit: ₹${arpDebit.toFixed(2)}, Credit: ₹${arpCredit.toFixed(2)}, Net: ₹${(arpCredit - arpDebit).toFixed(2)}`);

  // 2. Insert GKN workspace snapshots for all canonical identifiers
  const gknKeys = [
    'user_036fe7d3-6a13-4740-b028-afb55e81e00e',
    'user_usr_gknayak_gmail_com',
    'user_gknayak_gmail_com',
    'user_gknayak@gmail.com',
    'user_gknayak',
  ];

  console.log('\nMigrating workspaces to Neon DB...');
  const now = new Date().toISOString();
  const version = Date.now();

  for (const key of gknKeys) {
    await pool.query(
      `INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_identifier) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         workspace_data = EXCLUDED.workspace_data,
         updated_at = EXCLUDED.updated_at,
         sync_version = EXCLUDED.sync_version`,
      [key, 'gknayak@gmail.com', JSON.stringify(gknData), now, version]
    );
  }
  console.log(`Inserted ${gknKeys.length} workspace partitions for gknayak@gmail.com.`);

  // 3. Insert Arpita workspace snapshots for all canonical identifiers
  const arpitaKeys = [
    'user_9e637e3b-c199-4611-8af9-c16c1fa942d5',
    'user_usr_arpitapri125_gmail_com',
    'user_arpitapri125_gmail_com',
    'user_arpitapri125@gmail.com',
  ];

  for (const key of arpitaKeys) {
    await pool.query(
      `INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_identifier) DO UPDATE SET
         user_email = EXCLUDED.user_email,
         workspace_data = EXCLUDED.workspace_data,
         updated_at = EXCLUDED.updated_at,
         sync_version = EXCLUDED.sync_version`,
      [key, 'arpitapri125@gmail.com', JSON.stringify(arpitaData), now, version]
    );
  }
  console.log(`Inserted ${arpitaKeys.length} workspace partitions for arpitapri125@gmail.com.`);

  // 4. Insert Gulshan 1206 workspace snapshots if present
  if (gul1206Record) {
    const gul1206Keys = [
      'user_gulnayak1206@gmail.com',
      'user_usr_gulnayak1206_gmail_com',
    ];
    for (const key of gul1206Keys) {
      await pool.query(
        `INSERT INTO workspaces (user_identifier, user_email, workspace_data, updated_at, sync_version)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_identifier) DO UPDATE SET
           user_email = EXCLUDED.user_email,
           workspace_data = EXCLUDED.workspace_data,
           updated_at = EXCLUDED.updated_at,
           sync_version = EXCLUDED.sync_version`,
        [key, 'gulnayak1206@gmail.com', JSON.stringify(gul1206Record.workspace_data), now, version]
      );
    }
    console.log(`Inserted ${gul1206Keys.length} workspace partitions for gulnayak1206@gmail.com.`);
  }

  // 5. Migrate individual transactions into Neon `transactions` table
  console.log('\nMigrating individual transactions into Neon `transactions` table...');

  async function insertTransactions(expenses: any[], defaultWorkspaceKey: string, userEmail: string) {
    let inserted = 0;
    for (const exp of expenses) {
      if (!exp || !exp.id) continue;
      const expId = String(exp.id).trim();
      const amount = Number(exp.amount) || 0;
      const name = String(exp.name || 'Expense').trim();
      const category = String(exp.category || 'Other').trim();
      const date = String(exp.date || now.split('T')[0]);
      const direction = String(exp.direction || 'DEBIT').toUpperCase();

      const upsertTxQuery = `
        INSERT INTO transactions (
          id, workspace_identifier, user_email, name, amount, category, date, time,
          direction, payment_method, billing_cycle, notes, bank_name, masked_account,
          account_last4, reference_id, sms_reference_id, upi_reference, raw_sms_text,
          merchant, payee, source, source_file, import_batch_id, active, is_deleted,
          client_updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, $24, $25, $26,
          $27
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          amount = EXCLUDED.amount,
          category = EXCLUDED.category,
          date = EXCLUDED.date,
          time = EXCLUDED.time,
          direction = EXCLUDED.direction,
          payment_method = EXCLUDED.payment_method,
          billing_cycle = EXCLUDED.billing_cycle,
          notes = EXCLUDED.notes,
          bank_name = EXCLUDED.bank_name,
          masked_account = EXCLUDED.masked_account,
          account_last4 = EXCLUDED.account_last4,
          reference_id = EXCLUDED.reference_id,
          sms_reference_id = EXCLUDED.sms_reference_id,
          upi_reference = EXCLUDED.upi_reference,
          raw_sms_text = EXCLUDED.raw_sms_text,
          merchant = EXCLUDED.merchant,
          payee = EXCLUDED.payee,
          source = EXCLUDED.source,
          active = EXCLUDED.active,
          is_deleted = EXCLUDED.is_deleted,
          client_updated_at = EXCLUDED.client_updated_at,
          updated_at = CURRENT_TIMESTAMP
      `;

      await pool.query(upsertTxQuery, [
        expId,
        defaultWorkspaceKey,
        userEmail,
        name,
        amount,
        category,
        date,
        exp.time || null,
        direction,
        exp.paymentMethod || null,
        exp.billingCycle || null,
        exp.notes || null,
        exp.bankName || exp.bank || null,
        exp.maskedAccount || null,
        exp.accountLast4 || null,
        exp.referenceId || null,
        exp.smsReferenceId || null,
        exp.upiReference || null,
        exp.rawSmsText || null,
        exp.merchant || null,
        exp.payee || null,
        exp.source || 'sms_auto',
        exp.sourceFile || null,
        exp.importBatchId || null,
        exp.active !== false,
        Boolean(exp.isDeleted),
        Number(exp.updatedAt || exp.createdAt || Date.now()),
      ]);

      // Also upsert into expense_authority
      await pool.query(`
        INSERT INTO expense_authority (
          expense_id, workspace_identifier, source_device_type, is_synced_to_all_devices
        ) VALUES ($1, $2, 'apk', true)
        ON CONFLICT (expense_id) DO UPDATE SET
          is_synced_to_all_devices = true,
          updated_at = CURRENT_TIMESTAMP
      `, [expId, defaultWorkspaceKey]);

      inserted++;
    }
    return inserted;
  }

  const gknTxCount = await insertTransactions(gknExpenses, 'user_usr_gknayak_gmail_com', 'gknayak@gmail.com');
  console.log(`Inserted/Updated ${gknTxCount} transactions for gknayak@gmail.com.`);

  const arpTxCount = await insertTransactions(arpitaExpenses, 'user_usr_arpitapri125_gmail_com', 'arpitapri125@gmail.com');
  console.log(`Inserted/Updated ${arpTxCount} transactions for arpitapri125@gmail.com.`);

  if (gul1206Record?.workspace_data?.expenses?.length > 0) {
    const gulTxCount = await insertTransactions(gul1206Record.workspace_data.expenses, 'user_usr_gulnayak1206_gmail_com', 'gulnayak1206@gmail.com');
    console.log(`Inserted/Updated ${gulTxCount} transactions for gulnayak1206@gmail.com.`);
  }

  // 6. Write GKN authentic expenses to client/src/data/ownerGknExpenses.json
  const dataDir = path.resolve(process.cwd(), 'client', 'src', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const gknJsonPath = path.join(dataDir, 'ownerGknExpenses.json');
  fs.writeFileSync(gknJsonPath, JSON.stringify(gknExpenses, null, 2), 'utf-8');
  console.log(`Wrote ${gknExpenses.length} authentic expenses to ${gknJsonPath}.`);

  // 7. Verify Neon DB contents
  console.log('\n--- VERIFYING NEON DATABASE STATE ---');
  const wsCountRes = await pool.query('SELECT user_identifier, user_email, jsonb_array_length(workspace_data->\'expenses\') as expense_count, jsonb_array_length(workspace_data->\'habits\') as habit_count FROM workspaces ORDER BY user_email, user_identifier');
  console.log('Workspaces in Neon DB:');
  for (const r of wsCountRes.rows) {
    console.log(`- ${r.user_identifier} (${r.user_email}): ${r.expense_count} expenses, ${r.habit_count} habits`);
  }

  const txSumRes = await pool.query(`
    SELECT
      user_email,
      COUNT(*) as total_txs,
      SUM(CASE WHEN direction = 'DEBIT' THEN amount ELSE 0 END) as total_debit,
      SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE 0 END) as total_credit
    FROM transactions
    WHERE is_deleted = false
    GROUP BY user_email
    ORDER BY user_email
  `);
  console.log('\nTransaction Totals in Neon DB:');
  for (const r of txSumRes.rows) {
    console.log(`- ${r.user_email}: ${r.total_txs} transactions, Debit: ₹${Number(r.total_debit).toFixed(2)}, Credit: ₹${Number(r.total_credit).toFixed(2)}`);
  }

  const authCountRes = await pool.query('SELECT COUNT(*) as count FROM expense_authority');
  console.log(`\nExpense Authority records in Neon DB: ${authCountRes.rows[0].count}`);

  console.log('\n--- SUPABASE TO NEON MIGRATION COMPLETED SUCCESSFULLY ---');
  await pool.end();
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
