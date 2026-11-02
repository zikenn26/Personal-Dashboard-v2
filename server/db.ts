import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Standard PostgreSQL connection configuration parsed from DATABASE_URL
 * Supports Neon (Serverless Postgres) with SSL and connection pooling.
 */
function getDatabaseConfig(): PoolConfig {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_DB_URL ||
    'postgresql://neondb_owner:npg_G9a4qZEpMUty@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

  const isPlaceholder =
    connectionString.includes('[USER]') ||
    connectionString.includes('[PASSWORD]') ||
    connectionString.includes('[HOST]');

  if (isPlaceholder) {
    console.warn(
      '[DB] Warning: DATABASE_URL contains placeholder values ([USER]:[PASSWORD]). Please set active Neon connection credentials in your environment.'
    );
  }

  const isSslRequired =
    connectionString.includes('sslmode=require') ||
    connectionString.includes('neon.tech') ||
    process.env.NODE_ENV === 'production';

  return {
    connectionString,
    ssl: isSslRequired ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new Pool(getDatabaseConfig());

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle PostgreSQL client:', err);
});

export const initDb = async (): Promise<void> => {
  let client;
  try {
    client = await pool.connect();

    // 1. Core tables
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";

      CREATE TABLE IF NOT EXISTS workspaces (
        user_identifier TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TEXT NOT NULL,
        sync_version BIGINT NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_identifier TEXT NOT NULL,
        user_email TEXT,
        name TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        direction TEXT NOT NULL DEFAULT 'DEBIT',
        payment_method TEXT,
        billing_cycle TEXT,
        notes TEXT,
        bank_name TEXT,
        masked_account TEXT,
        account_last4 TEXT,
        reference_id TEXT,
        sms_reference_id TEXT,
        upi_reference TEXT,
        raw_sms_text TEXT,
        merchant TEXT,
        payee TEXT,
        source TEXT,
        source_file TEXT,
        import_batch_id TEXT,
        active BOOLEAN NOT NULL DEFAULT true,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        deleted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        client_updated_at BIGINT NOT NULL DEFAULT 0,
        version BIGINT NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS connected_devices (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        user_identifier TEXT NOT NULL,
        device_name TEXT,
        device_type TEXT NOT NULL DEFAULT 'web',
        platform TEXT,
        environment TEXT,
        app_version TEXT,
        created_at BIGINT NOT NULL,
        last_active BIGINT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        user_identifier TEXT NOT NULL,
        device_name TEXT,
        platform TEXT,
        environment TEXT,
        app_version TEXT,
        created_at BIGINT NOT NULL,
        last_active BIGINT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        is_revoked BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS sync_queues (
        id TEXT PRIMARY KEY,
        workspace_identifier TEXT NOT NULL,
        device_id TEXT NOT NULL,
        module TEXT NOT NULL DEFAULT 'expenses',
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload JSONB,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        error_message TEXT,
        logical_clock BIGINT NOT NULL DEFAULT 0,
        wall_clock_ms BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expense_authority (
        expense_id TEXT PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
        workspace_identifier TEXT NOT NULL,
        source_device_type TEXT NOT NULL DEFAULT 'apk',
        authoritative_device_id TEXT,
        last_authoritative_modification_ms BIGINT,
        requires_platform_reconciliation BOOLEAN DEFAULT false,
        is_synced_to_all_devices BOOLEAN DEFAULT false,
        apk_version BIGINT DEFAULT 1,
        web_version BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS data_versions (
        id TEXT PRIMARY KEY,
        workspace_identifier TEXT NOT NULL,
        device_id TEXT NOT NULL,
        module TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        logical_clock BIGINT NOT NULL,
        wall_clock_ms BIGINT NOT NULL,
        operation TEXT NOT NULL,
        payload_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS data_conflicts (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        workspace_identifier TEXT NOT NULL,
        module TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        device_a_id TEXT,
        device_b_id TEXT,
        device_a_value JSONB,
        device_b_value JSONB,
        resolution TEXT,
        resolved_value JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Dual-compatibility views (safely recreated)
    await client.query(`
      DROP VIEW IF EXISTS user_workspaces CASCADE;
      CREATE VIEW user_workspaces AS SELECT * FROM workspaces;

      DROP VIEW IF EXISTS user_expenses CASCADE;
      CREATE VIEW user_expenses AS SELECT * FROM transactions;
    `);

    console.log('[DB] Neon Serverless Postgres tables and views verified successfully.');
  } catch (error: any) {
    console.warn('[DB] Notice during table initialization:', error?.message || error);
  } finally {
    if (client) client.release();
  }
};

export const dbPool = pool;
