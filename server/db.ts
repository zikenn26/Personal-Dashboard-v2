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
    '';

  if (!connectionString) {
    console.warn(
      '[DB] Warning: No DATABASE_URL found in environment. Please define DATABASE_URL in your .env or host environment variables.'
    );
  }

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
        sync_version NUMERIC(30, 0) NOT NULL DEFAULT 0
      );

      -- Credentials are server-owned; workspace snapshots never contain passwords.
      CREATE TABLE IF NOT EXISTS app_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Monotonic generation survives global data resets. Every authenticated
      -- write holds a shared row lock while checking this state; reset takes an
      -- exclusive lock before incrementing and truncating application data.
      CREATE TABLE IF NOT EXISTS app_state (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        generation BIGINT NOT NULL DEFAULT 1,
        schema_version INTEGER NOT NULL DEFAULT 2,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO app_state (singleton, generation, schema_version)
      VALUES (TRUE, 1, 2) ON CONFLICT (singleton) DO UPDATE
        SET schema_version = GREATEST(app_state.schema_version, EXCLUDED.schema_version);

      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
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
        client_updated_at NUMERIC(30, 0) NOT NULL DEFAULT 0,
        version NUMERIC(30, 0) NOT NULL DEFAULT 1
      );

      -- Drop views first so PostgreSQL allows column type alterations
      DROP VIEW IF EXISTS expenses CASCADE;
      DROP VIEW IF EXISTS user_workspaces CASCADE;
      DROP VIEW IF EXISTS user_expenses CASCADE;

      -- Migration: Safely widen bigint columns to numeric(30,0) for high-precision nanosecond/microsecond timestamps
      ALTER TABLE workspaces ALTER COLUMN sync_version TYPE NUMERIC(30, 0);
      ALTER TABLE transactions ALTER COLUMN client_updated_at TYPE NUMERIC(30, 0);
      ALTER TABLE transactions ALTER COLUMN version TYPE NUMERIC(30, 0);
      ALTER TABLE transactions ALTER COLUMN id TYPE TEXT USING id::text;

      CREATE TABLE IF NOT EXISTS connected_devices (
        id TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        user_identifier TEXT NOT NULL,
        device_name TEXT,
        device_type TEXT NOT NULL DEFAULT 'web',
        platform TEXT,
        environment TEXT,
        app_version TEXT,
        created_at NUMERIC(30, 0) NOT NULL,
        last_active NUMERIC(30, 0) NOT NULL,
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
        created_at NUMERIC(30, 0) NOT NULL,
        last_active NUMERIC(30, 0) NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        is_revoked BOOLEAN NOT NULL DEFAULT false
      );

      CREATE TABLE IF NOT EXISTS user_active_sessions (
        user_email TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        device_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        created_at NUMERIC(30, 0) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        generation BIGINT NOT NULL DEFAULT 1
      );
      ALTER TABLE user_active_sessions ADD COLUMN IF NOT EXISTS generation BIGINT NOT NULL DEFAULT 1;

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
        logical_clock NUMERIC(30, 0) NOT NULL DEFAULT 0,
        wall_clock_ms NUMERIC(30, 0) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Append-only sync protocol v2. mutation_id makes retries idempotent;
      -- server_cursor provides stable pull ordering independent of client clocks.
      CREATE TABLE IF NOT EXISTS sync_mutations (
        server_cursor BIGSERIAL PRIMARY KEY,
        mutation_id TEXT NOT NULL UNIQUE,
        workspace_identifier TEXT NOT NULL,
        user_email TEXT NOT NULL DEFAULT '',
        device_id TEXT NOT NULL DEFAULT '',
        module TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        base_revision BIGINT,
        revision BIGINT NOT NULL,
        payload JSONB NOT NULL,
        payload_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sync_mutations_workspace_cursor
        ON sync_mutations(workspace_identifier, server_cursor);
      CREATE TABLE IF NOT EXISTS sync_entities (
        workspace_identifier TEXT NOT NULL,
        user_email TEXT NOT NULL,
        module TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        revision BIGINT NOT NULL DEFAULT 1,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_deleted BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_identifier, module, entity_id)
      );

      CREATE TABLE IF NOT EXISTS expense_authority (
        expense_id TEXT PRIMARY KEY,
        workspace_identifier TEXT NOT NULL,
        source_device_type TEXT NOT NULL DEFAULT 'apk',
        authoritative_device_id TEXT,
        last_authoritative_modification_ms NUMERIC(30, 0),
        requires_platform_reconciliation BOOLEAN DEFAULT false,
        is_synced_to_all_devices BOOLEAN DEFAULT false,
        apk_version NUMERIC(30, 0) DEFAULT 1,
        web_version NUMERIC(30, 0) DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS data_versions (
        id TEXT PRIMARY KEY,
        workspace_identifier TEXT NOT NULL,
        device_id TEXT NOT NULL,
        module TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        logical_clock NUMERIC(30, 0) NOT NULL,
        wall_clock_ms NUMERIC(30, 0) NOT NULL,
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
      DROP VIEW IF EXISTS expenses CASCADE;
      DROP VIEW IF EXISTS user_workspaces CASCADE;
      DROP VIEW IF EXISTS user_expenses CASCADE;

      CREATE VIEW user_workspaces AS SELECT * FROM workspaces;
      CREATE VIEW user_expenses AS SELECT * FROM transactions;
      CREATE VIEW expenses AS SELECT * FROM transactions;
    `);

    console.log('[DB] Neon Serverless Postgres tables and views verified successfully.');
  } catch (error: any) {
    console.warn('[DB] Notice during table initialization:', error?.message || error);
  } finally {
    if (client) client.release();
  }
};

export const dbPool = pool;
