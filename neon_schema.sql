-- =========================================================================
-- NEON (SERVERLESS POSTGRESQL) PRODUCTION SCHEMA FOR PERSONAL DASHBOARD
-- =========================================================================
-- Use this script in the Neon SQL Editor (Console -> SQL Editor) to initialize
-- all tables, indexes, views, and concurrency control functions.
-- Connection String format:
-- DATABASE_URL="postgresql://[USER]:[PASSWORD]@[HOST]/[DB_NAME]?sslmode=require&channel_binding=require"
-- =========================================================================

-- Enable pgcrypto for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================================
-- 1. WORKSPACES TABLE (Master JSONB Snapshots & State Hydration)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.workspaces (
    user_identifier TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sync_version BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_workspaces_user_email ON public.workspaces(user_email);
CREATE INDEX IF NOT EXISTS idx_workspaces_updated_at ON public.workspaces(updated_at DESC);

-- Backward-compatibility view for user_workspaces
CREATE OR REPLACE VIEW public.user_workspaces AS
SELECT
    user_identifier AS id,
    user_identifier,
    user_email,
    workspace_data,
    updated_at,
    sync_version
FROM public.workspaces;

-- =========================================================================
-- 2. TRANSACTIONS TABLE (Relational Financial Dataset & SMS Log)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.transactions (
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
    active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    client_updated_at BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_transactions_workspace ON public.transactions(workspace_identifier);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(workspace_identifier, date);
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON public.transactions(workspace_identifier, updated_at);
CREATE INDEX IF NOT EXISTS idx_transactions_sms_ref ON public.transactions(workspace_identifier, sms_reference_id);
CREATE INDEX IF NOT EXISTS idx_transactions_upi_ref ON public.transactions(workspace_identifier, upi_reference);
CREATE INDEX IF NOT EXISTS idx_transactions_is_deleted ON public.transactions(workspace_identifier, is_deleted);

-- Dual-naming view for user_expenses
CREATE OR REPLACE VIEW public.user_expenses AS
SELECT * FROM public.transactions;

-- =========================================================================
-- 3. CONNECTED DEVICES TABLE (Device Registry & Presence Tracking)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.connected_devices (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_identifier TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT NOT NULL DEFAULT 'web',
    platform TEXT NOT NULL DEFAULT 'unknown',
    environment TEXT,
    app_version TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at BIGINT NOT NULL,
    last_active BIGINT NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connected_devices_email ON public.connected_devices(user_email);
CREATE INDEX IF NOT EXISTS idx_connected_devices_identifier ON public.connected_devices(user_identifier);
CREATE INDEX IF NOT EXISTS idx_connected_devices_last_active ON public.connected_devices(last_active DESC);

-- Compatibility views for devices and user_devices
CREATE OR REPLACE VIEW public.devices AS SELECT * FROM public.connected_devices;
CREATE OR REPLACE VIEW public.user_devices AS SELECT * FROM public.connected_devices;

-- =========================================================================
-- 4. SYNC QUEUES TABLE (Offline Outbox Mutations & Sync Queue)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.sync_queues (
    id TEXT PRIMARY KEY,
    workspace_identifier TEXT NOT NULL,
    device_id TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'expenses',
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL, -- 'create', 'update', 'delete'
    payload JSONB,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'synced', 'conflict', 'failed'
    attempts INT NOT NULL DEFAULT 0,
    error_message TEXT,
    logical_clock BIGINT NOT NULL DEFAULT 0,
    wall_clock_ms BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_queues_status ON public.sync_queues(workspace_identifier, status);
CREATE INDEX IF NOT EXISTS idx_sync_queues_device ON public.sync_queues(device_id, logical_clock);

-- Data versions table for causality and Lamport clock tracking
CREATE TABLE IF NOT EXISTS public.data_versions (
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

CREATE INDEX IF NOT EXISTS idx_data_versions_lookup ON public.data_versions(workspace_identifier, module, entity_id);

-- Versioned sync protocol: optimistic revisions + idempotent mutation log.
CREATE TABLE IF NOT EXISTS public.sync_entities (
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

CREATE TABLE IF NOT EXISTS public.sync_mutations (
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
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    payload_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_mutations_workspace_cursor
    ON public.sync_mutations(workspace_identifier, server_cursor);

-- =========================================================================
-- 5. EXPENSE AUTHORITY TABLE (Android APK Master Reconciliation)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.expense_authority (
    expense_id TEXT PRIMARY KEY REFERENCES public.transactions(id) ON DELETE CASCADE,
    workspace_identifier TEXT NOT NULL,
    source_device_type TEXT NOT NULL DEFAULT 'apk', -- 'apk' (Android Master), 'web'
    authoritative_device_id TEXT,
    last_authoritative_modification_ms BIGINT,
    requires_platform_reconciliation BOOLEAN DEFAULT FALSE,
    is_synced_to_all_devices BOOLEAN DEFAULT FALSE,
    apk_version BIGINT DEFAULT 1,
    web_version BIGINT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_expense_authority_workspace ON public.expense_authority(workspace_identifier);
CREATE INDEX IF NOT EXISTS idx_expense_authority_reconcile ON public.expense_authority(requires_platform_reconciliation);

-- Conflict resolution audit log
CREATE TABLE IF NOT EXISTS public.data_conflicts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    workspace_identifier TEXT NOT NULL,
    module TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    device_a_id TEXT,
    device_b_id TEXT,
    device_a_value JSONB,
    device_b_value JSONB,
    resolution TEXT, -- 'apk_master_won', 'newer_timestamp_won', 'merged'
    resolved_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================
-- 6. AUTOMATIC TIMESTAMP & CONCURRENCY TRIGGERS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trg_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();

DROP TRIGGER IF EXISTS trg_connected_devices_updated_at ON public.connected_devices;
CREATE TRIGGER trg_connected_devices_updated_at
BEFORE UPDATE ON public.connected_devices
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();

DROP TRIGGER IF EXISTS trg_sync_queues_updated_at ON public.sync_queues;
CREATE TRIGGER trg_sync_queues_updated_at
BEFORE UPDATE ON public.sync_queues
FOR EACH ROW EXECUTE FUNCTION public.handle_update_timestamp();

-- Anti-resurrection and optimistic concurrency control for transactions
CREATE OR REPLACE FUNCTION public.handle_transaction_upsert()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- 1. Anti-resurrection: Stale write must never revive a deleted record
        IF (OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE AND COALESCE(NEW.client_updated_at, 0) <= COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        -- 2. Stale write rejection: Never overwrite newer record with older timestamp
        IF (COALESCE(NEW.client_updated_at, 0) < COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        -- 3. Idempotent write: If identical payload, no-op
        IF (NEW.client_updated_at = OLD.client_updated_at AND NEW.is_deleted = OLD.is_deleted AND NEW.amount = OLD.amount AND NEW.name = OLD.name) THEN
            RETURN OLD;
        END IF;

        -- 4. Preserve critical financial fields on soft-deletion
        IF (NEW.is_deleted = TRUE) THEN
            IF (NEW.amount = 0 AND OLD.amount > 0) THEN
                NEW.amount := OLD.amount;
            END IF;
            IF ((NEW.name IS NULL OR NEW.name = '' OR NEW.name = 'Deleted Expense') AND (OLD.name IS NOT NULL AND OLD.name <> 'Deleted Expense')) THEN
                NEW.name := OLD.name;
            END IF;
            IF (NEW.category IS NULL OR NEW.category = '') THEN
                NEW.category := OLD.category;
            END IF;
            IF (NEW.bank_name IS NULL) THEN
                NEW.bank_name := OLD.bank_name;
            END IF;
            IF (NEW.sms_reference_id IS NULL) THEN
                NEW.sms_reference_id := OLD.sms_reference_id;
            END IF;
            IF (NEW.upi_reference IS NULL) THEN
                NEW.upi_reference := OLD.upi_reference;
            END IF;
            NEW.deleted_at := COALESCE(NEW.deleted_at, CURRENT_TIMESTAMP);
        END IF;

        NEW.version := COALESCE(OLD.version, 1) + 1;
        NEW.updated_at := CURRENT_TIMESTAMP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_upsert ON public.transactions;
CREATE TRIGGER trg_transactions_upsert
BEFORE UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_upsert();
