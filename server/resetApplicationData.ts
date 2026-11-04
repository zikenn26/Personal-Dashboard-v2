import { pool, initDb } from './db.js';
import crypto from 'node:crypto';

const requiredConfirmation = 'DELETE_ALL_APPLICATION_DATA';
const configuredTarget = process.env.APP_DATA_RESET_TARGET || '';
const expectedFingerprint = process.env.APP_DATA_RESET_EXPECTED_FINGERPRINT || '';
const suppliedTarget = process.argv[2] || '';

if (process.env.APP_DATA_RESET_CONFIRM !== requiredConfirmation) {
  throw new Error(`Set APP_DATA_RESET_CONFIRM=${requiredConfirmation} to authorize this destructive reset.`);
}

await initDb();
const identity = await pool.query('SELECT current_database() AS database, current_user AS role');
const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.NEON_DB_URL || '';
const databaseHost = connectionString ? new URL(connectionString).hostname : '';
const databaseLabel = `${databaseHost}/${identity.rows[0]?.database}@${identity.rows[0]?.role}`;
const fingerprint = crypto.createHash('sha256')
  .update(`${databaseHost.toLowerCase()}|${identity.rows[0]?.database}|${identity.rows[0]?.role}`)
  .digest('hex').slice(0, 20);
console.log(`Connected database label: ${databaseLabel}`);
console.log(`Connected database fingerprint: ${fingerprint}`);
if (!configuredTarget || suppliedTarget !== configuredTarget || suppliedTarget !== databaseLabel ||
    !expectedFingerprint || expectedFingerprint !== fingerprint) {
  throw new Error('Database target or fingerprint confirmation does not match the connected Neon database. No data was changed.');
}

const tables = [
  'app_users',
  'connected_devices',
  'data_conflicts',
  'data_versions',
  'devices',
  'expense_authority',
  'sync_entities',
  'sync_mutations',
  'sync_queues',
  'transactions',
  'user_active_sessions',
  'workspaces',
];

const present = await pool.query(
  `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = ANY($1::text[])`,
  [tables],
);
const existing = tables.filter((name) => present.rows.some((row: any) => row.tablename === name));
const quoted = existing.map((name) => `public."${name}"`).join(', ');
if (!quoted) throw new Error('No application tables found; refusing to reset.');

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const state = await client.query('SELECT generation FROM public.app_state WHERE singleton = TRUE FOR UPDATE');
  if (!state.rows.length) throw new Error('Application generation marker is missing; refusing to reset.');
  await client.query('UPDATE public.app_state SET generation = generation + 1, updated_at = CURRENT_TIMESTAMP WHERE singleton = TRUE');
  await client.query(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`);
  await client.query('COMMIT');
  const remaining = await pool.query(
    `SELECT ${existing.map((name, index) => `(SELECT COUNT(*)::int FROM public."${name}") AS "${name}"`).join(', ')}`
  );
  const nonEmpty = existing.filter((name) => Number(remaining.rows[0]?.[name] || 0) !== 0);
  if (nonEmpty.length) throw new Error(`Reset verification found remaining rows in: ${nonEmpty.join(', ')}`);
  const newGeneration = Number(state.rows[0].generation) + 1;
  console.log(`Reset completed for ${existing.length} application tables at generation ${newGeneration}: ${existing.join(', ')}`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  throw error;
} finally {
  client.release();
  await pool.end();
}
