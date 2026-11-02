/**
 * Complete SQL Initialization Scripts for Neon Serverless PostgreSQL and Supabase
 * Ready for 1-click copy and execution in Neon Console or Supabase SQL Editor.
 */

export const NEON_SCHEMA_SQL = `-- =========================================================================
-- NEON POSTGRESQL PRODUCTION INITIALIZATION SCHEMA
-- Run directly in your Neon Console SQL Editor (https://console.neon.tech)
-- Fully compatible with Neon serverless Postgres (no Supabase auth dependencies)
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USER WORKSPACES TABLE
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    user_identifier TEXT UNIQUE NOT NULL,
    user_email TEXT,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_neon_workspaces_identifier ON public.user_workspaces(user_identifier);
CREATE INDEX IF NOT EXISTS idx_neon_workspaces_user_id ON public.user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_neon_workspaces_email ON public.user_workspaces(user_email);

-- 2. DEDICATED EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.user_expenses (
    id TEXT PRIMARY KEY,
    user_id TEXT,
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
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_updated_at BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_neon_expenses_ws ON public.user_expenses(workspace_identifier);
CREATE INDEX IF NOT EXISTS idx_neon_expenses_date ON public.user_expenses(workspace_identifier, date);
CREATE INDEX IF NOT EXISTS idx_neon_expenses_ref ON public.user_expenses(workspace_identifier, sms_reference_id);
CREATE INDEX IF NOT EXISTS idx_neon_expenses_updated ON public.user_expenses(workspace_identifier, updated_at);

-- 3. USER DEVICES TABLE
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT NOT NULL DEFAULT 'web',
    platform TEXT NOT NULL DEFAULT 'unknown',
    browser_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    first_login_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_neon_user_device UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_neon_devices_user ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_neon_devices_device_id ON public.user_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_neon_devices_last_seen ON public.user_devices(user_id, last_seen_at);

-- 4. EXPENSE AUTHORITY TABLE
CREATE TABLE IF NOT EXISTS public.expense_authority (
    expense_id TEXT PRIMARY KEY,
    user_id TEXT,
    workspace_identifier TEXT NOT NULL,
    source_device_type TEXT NOT NULL DEFAULT 'apk',
    authoritative_device_id TEXT,
    last_authoritative_modification_ms BIGINT,
    requires_platform_reconciliation BOOLEAN DEFAULT false,
    is_synced_to_all_devices BOOLEAN DEFAULT false,
    apk_version BIGINT DEFAULT 1,
    web_version BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_neon_exp_authority_ws ON public.expense_authority(user_id, workspace_identifier);

-- 5. DATA VERSIONS TABLE
CREATE TABLE IF NOT EXISTS public.data_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    device_id TEXT NOT NULL,
    module TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    logical_clock BIGINT NOT NULL,
    wall_clock_ms BIGINT NOT NULL,
    operation TEXT NOT NULL,
    payload_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_neon_versions_user_module ON public.data_versions(user_id, module, entity_id);

-- 6. AUTOMATIC UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION update_updated_at_column() 
RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at = timezone('utc'::text, now()); 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_neon_workspaces_updated ON public.user_workspaces;
CREATE TRIGGER trg_neon_workspaces_updated 
BEFORE UPDATE ON public.user_workspaces 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_neon_devices_updated ON public.user_devices;
CREATE TRIGGER trg_neon_devices_updated 
BEFORE UPDATE ON public.user_devices 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_neon_authority_updated ON public.expense_authority;
CREATE TRIGGER trg_neon_authority_updated 
BEFORE UPDATE ON public.expense_authority 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 7. CONCURRENCY & SOFT-DELETE RESOLUTION TRIGGER
CREATE OR REPLACE FUNCTION public.handle_user_expense_upsert()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (COALESCE(NEW.client_updated_at, 0) < COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        IF (NEW.is_deleted = TRUE) THEN
            IF (NEW.amount = 0 AND OLD.amount > 0) THEN
                NEW.amount := OLD.amount;
            END IF;
            IF ((NEW.name IS NULL OR NEW.name = '') AND OLD.name IS NOT NULL) THEN
                NEW.name := OLD.name;
            END IF;
            NEW.deleted_at := COALESCE(NEW.deleted_at, timezone('utc'::text, now()));
        END IF;

        NEW.version := COALESCE(OLD.version, 1) + 1;
        NEW.updated_at := timezone('utc'::text, now());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_neon_expenses_upsert ON public.user_expenses;
CREATE TRIGGER trg_neon_expenses_upsert
BEFORE UPDATE ON public.user_expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_user_expense_upsert();
`;

export const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- SUPABASE POSTGRESQL PRODUCTION SECURITY SCHEMA
-- Run in your new Supabase Project SQL Editor (https://supabase.com/dashboard)
-- Enforces strict Row Level Security (RLS) with authenticated JWTs
-- =========================================================================

-- 1. Create the user_workspaces table
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_identifier TEXT UNIQUE NOT NULL,
    user_email TEXT,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_workspaces ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_workspaces_user_id ON public.user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_identifier ON public.user_workspaces(user_identifier);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

-- 3. Strict RLS Policies for user_workspaces
DROP POLICY IF EXISTS "Allow public read of user workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "Allow public insert/update of user workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can read own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can insert own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can update own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can delete own workspace" ON public.user_workspaces;

CREATE POLICY "Users can read own workspace"
ON public.user_workspaces FOR SELECT TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can insert own workspace"
ON public.user_workspaces FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can update own workspace"
ON public.user_workspaces FOR UPDATE TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
)
WITH CHECK (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can delete own workspace"
ON public.user_workspaces FOR DELETE TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

-- 4. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_workspaces;

-- 5. Dedicated expenses table
CREATE TABLE IF NOT EXISTS public.user_expenses (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    client_updated_at BIGINT NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_user_expenses_workspace ON public.user_expenses(workspace_identifier);
CREATE INDEX IF NOT EXISTS idx_user_expenses_user_id ON public.user_expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_expenses_date ON public.user_expenses(workspace_identifier, date);
CREATE INDEX IF NOT EXISTS idx_user_expenses_updated_at ON public.user_expenses(workspace_identifier, updated_at);
CREATE INDEX IF NOT EXISTS idx_user_expenses_ref ON public.user_expenses(workspace_identifier, sms_reference_id);

ALTER TABLE public.user_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own expenses"
ON public.user_expenses FOR SELECT TO authenticated
USING (user_id = auth.uid() OR workspace_identifier = 'user_' || auth.uid()::text);

CREATE POLICY "Users can insert own expenses"
ON public.user_expenses FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR workspace_identifier = 'user_' || auth.uid()::text);

CREATE POLICY "Users can update own expenses"
ON public.user_expenses FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR workspace_identifier = 'user_' || auth.uid()::text)
WITH CHECK (user_id = auth.uid() OR workspace_identifier = 'user_' || auth.uid()::text);

CREATE POLICY "Users can delete own expenses"
ON public.user_expenses FOR DELETE TO authenticated
USING (user_id = auth.uid() OR workspace_identifier = 'user_' || auth.uid()::text);

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_expenses;

-- 6. User devices table
CREATE TABLE IF NOT EXISTS public.user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    device_type TEXT NOT NULL DEFAULT 'web',
    platform TEXT NOT NULL DEFAULT 'unknown',
    browser_info TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    first_login_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_seen ON public.user_devices(user_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_user_devices_device_id ON public.user_devices(device_id);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own devices"
ON public.user_devices FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own devices"
ON public.user_devices FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own devices"
ON public.user_devices FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own devices"
ON public.user_devices FOR DELETE TO authenticated
USING (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_devices;

-- 7. Trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at = timezone('utc'::text, now()); 
    RETURN NEW; 
END; 
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_user_workspaces_updated_at ON public.user_workspaces;
CREATE TRIGGER trg_user_workspaces_updated_at BEFORE UPDATE ON public.user_workspaces FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_user_devices_updated_at ON public.user_devices;
CREATE TRIGGER trg_user_devices_updated_at BEFORE UPDATE ON public.user_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;
