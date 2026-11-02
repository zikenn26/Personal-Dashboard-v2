-- =========================================================================
-- NEON POSTGRESQL DELTA SYNC SCHEMA MIGRATION SCRIPT
-- =========================================================================
-- Refactors expense/transaction tables to use UUID v4 as primary key,
-- adds updated_at (TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP) and
-- is_deleted (BOOLEAN DEFAULT FALSE) to support timestamp-based delta sync.
-- =========================================================================

-- 1. Ensure cryptographic extensions for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop dependent views temporarily so column types can be altered cleanly
DROP VIEW IF EXISTS public.user_expenses CASCADE;
DROP VIEW IF EXISTS public.expenses CASCADE;

-- 3. Refactor public.transactions table to use UUID v4 as primary key
DO $$
BEGIN
    -- Check if transactions table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'transactions'
    ) THEN
        -- Check if id is not of uuid type
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'transactions'
              AND column_name = 'id'
              AND data_type != 'uuid'
        ) THEN
            -- Drop existing primary key constraint if any
            ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey CASCADE;

            -- Alter id column to UUID type, generating a fresh v4 UUID for non-uuid strings
            ALTER TABLE public.transactions
                ALTER COLUMN id DROP DEFAULT;

            ALTER TABLE public.transactions
                ALTER COLUMN id TYPE UUID
                USING (
                    CASE
                        WHEN id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN id::uuid
                        ELSE gen_random_uuid()
                    END
                );

            -- Restore Primary Key and set default to gen_random_uuid()
            ALTER TABLE public.transactions
                ALTER COLUMN id SET DEFAULT gen_random_uuid();

            ALTER TABLE public.transactions
                ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);
        END IF;
    ELSE
        -- Create table from scratch if it did not exist
        CREATE TABLE public.transactions (
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
    END IF;
END $$;

-- 4. Ensure updated_at and is_deleted columns exist with appropriate defaults
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Ensure default on updated_at is CURRENT_TIMESTAMP (NOW())
ALTER TABLE public.transactions
    ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public.transactions
    ALTER COLUMN is_deleted SET DEFAULT FALSE;

-- 5. Optimization Indexes for Delta Sync
CREATE INDEX IF NOT EXISTS idx_transactions_delta_sync
    ON public.transactions(workspace_identifier, updated_at);

CREATE INDEX IF NOT EXISTS idx_transactions_active_sync
    ON public.transactions(workspace_identifier, is_deleted);

CREATE INDEX IF NOT EXISTS idx_transactions_user_updated
    ON public.transactions(user_email, updated_at);

-- 6. Restore compatibility views
CREATE OR REPLACE VIEW public.user_expenses AS
SELECT * FROM public.transactions;

CREATE OR REPLACE VIEW public.expenses AS
SELECT * FROM public.transactions;

-- 7. Trigger to automatically keep updated_at current on server-side modifications
CREATE OR REPLACE FUNCTION update_transactions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION update_transactions_timestamp();
