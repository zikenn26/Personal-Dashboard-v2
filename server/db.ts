import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.NEON_DB_URL || 'postgresql://neondb_owner:npg_G9a4qZEpMUty@ep-curly-glitter-b4fsklnq-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const pool = new Pool({
  connectionString,
});

export const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        user_identifier TEXT PRIMARY KEY,
        user_email TEXT NOT NULL,
        workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TEXT NOT NULL,
        sync_version BIGINT NOT NULL DEFAULT 0
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
    `);
    console.log('[DB] Neon DB tables initialized successfully.');
  } catch (error) {
    console.error('[DB] Failed to initialize tables:', error);
  } finally {
    client.release();
  }
};
export const dbPool = pool;
