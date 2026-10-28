-- =========================================================================
-- SUPABASE POSTGRESQL PRODUCTION SECURITY SCHEMA FOR PERSONAL DASHBOARD
-- =========================================================================

-- 1. Create the user_workspaces table for cloud synchronization
CREATE TABLE IF NOT EXISTS public.user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_identifier TEXT UNIQUE NOT NULL,
    user_email TEXT,
    workspace_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure user_id column exists if table was previously created without it
ALTER TABLE public.user_workspaces ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Index for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_user_workspaces_user_id ON public.user_workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_user_workspaces_identifier ON public.user_workspaces(user_identifier);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_workspaces ENABLE ROW LEVEL SECURITY;

-- 3. Revoke insecure open policies if previously set
DROP POLICY IF EXISTS "Allow public read of user workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "Allow public insert/update of user workspaces" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can read own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can insert own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can update own workspace" ON public.user_workspaces;
DROP POLICY IF EXISTS "Users can delete own workspace" ON public.user_workspaces;

-- 4. Secure RLS Policies: Authenticated users can only access their own workspace
CREATE POLICY "Users can read own workspace"
ON public.user_workspaces
FOR SELECT
TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can insert own workspace"
ON public.user_workspaces
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

CREATE POLICY "Users can update own workspace"
ON public.user_workspaces
FOR UPDATE
TO authenticated
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
ON public.user_workspaces
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
    OR auth.uid()::text = user_identifier
    OR user_identifier = 'user_' || auth.uid()::text
);

-- 5. Realtime publication for multi-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_workspaces;

-- 6. Storage Buckets Configuration
-- workspace_media is private; avatars/covers are public for portfolio display
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('workspace_media', 'workspace_media', false),
    ('avatars', 'avatars', true),
    ('covers', 'covers', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Drop legacy storage policies
DROP POLICY IF EXISTS "Public Media Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own media" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own private media" ON storage.objects;
DROP POLICY IF EXISTS "Public can view portfolio assets" ON storage.objects;

-- Storage object policies: Only authenticated users can upload to their own folder path
CREATE POLICY "Authenticated users can upload own media" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id IN ('workspace_media', 'avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own media" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id IN ('workspace_media', 'avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own media" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id IN ('workspace_media', 'avatars', 'covers')
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Workspace media is private to authenticated owner
CREATE POLICY "Users can read own private media" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (
    bucket_id = 'workspace_media'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Public portfolio assets (avatars/covers) can be publicly viewed for web portfolio showcase
CREATE POLICY "Public can view portfolio assets" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id IN ('avatars', 'covers'));

-- =========================================================================
-- 7. DEDICATED EXPENSES TABLE FOR INDIVIDUAL MUTATION SYNCHRONIZATION (OPTION A)
-- =========================================================================

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

-- Helper function to verify workspace ownership securely
CREATE OR REPLACE FUNCTION public.is_authorized_workspace(ws_id TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE AS $$
BEGIN
    IF ws_id IS NULL THEN
        RETURN FALSE;
    END IF;
    -- Primary owner pattern: user_<uuid> or <uuid>
    IF ws_id = 'user_' || auth.uid()::text OR ws_id = auth.uid()::text THEN
        RETURN TRUE;
    END IF;
    -- Workspace membership verification via user_workspaces
    RETURN EXISTS (
        SELECT 1 FROM public.user_workspaces w
        WHERE w.user_identifier = ws_id
          AND (w.user_id = auth.uid() OR w.user_identifier = 'user_' || auth.uid()::text OR w.user_identifier = auth.uid()::text)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.is_authorized_workspace(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_workspace(TEXT) TO authenticated;

DROP POLICY IF EXISTS "Users can read own expenses" ON public.user_expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.user_expenses;
DROP POLICY IF EXISTS "Users can update own expenses" ON public.user_expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.user_expenses;

-- Strict cross-user RLS: The workspace MUST belong to the user AND user_id cannot be forged
CREATE POLICY "Users can read own expenses"
ON public.user_expenses FOR SELECT TO authenticated
USING (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
);

CREATE POLICY "Users can insert own expenses"
ON public.user_expenses FOR INSERT TO authenticated
WITH CHECK (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (user_email IS NULL OR lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
);

CREATE POLICY "Users can update own expenses"
ON public.user_expenses FOR UPDATE TO authenticated
USING (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
)
WITH CHECK (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
    AND (user_email IS NULL OR lower(user_email) = lower(COALESCE(auth.jwt() ->> 'email', '')))
);

CREATE POLICY "Users can delete own expenses"
ON public.user_expenses FOR DELETE TO authenticated
USING (
    public.is_authorized_workspace(workspace_identifier)
    AND (user_id IS NULL OR user_id = auth.uid())
);

-- =========================================================================
-- 8. SERVER-ENFORCED OPTIMISTIC CONCURRENCY, ANTI-RESURRECTION & SOFT-DELETE
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_user_expense_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- 1. Anti-resurrection: A stale update (is_deleted = false) must NEVER revive a deleted record if incoming timestamp is <= deletion timestamp
        IF (OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE AND COALESCE(NEW.client_updated_at, 0) <= COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        -- 2. Stale write rejection: Never overwrite a newer record with an older timestamp
        IF (COALESCE(NEW.client_updated_at, 0) < COALESCE(OLD.client_updated_at, 0)) THEN
            RETURN OLD;
        END IF;

        -- 3. Idempotent retry: If identical timestamps and payload, no-op return
        IF (NEW.client_updated_at = OLD.client_updated_at AND NEW.is_deleted = OLD.is_deleted AND NEW.amount = OLD.amount AND NEW.name = OLD.name) THEN
            RETURN OLD;
        END IF;

        -- 4. Preserve original transaction attributes on soft deletion
        IF (NEW.is_deleted = TRUE) THEN
            IF (NEW.amount = 0 AND OLD.amount > 0) THEN
                NEW.amount := OLD.amount;
            END IF;
            IF ((NEW.name IS NULL OR NEW.name = '' OR NEW.name = 'Deleted Expense') AND (OLD.name IS NOT NULL AND OLD.name <> 'Deleted Expense')) THEN
                NEW.name := OLD.name;
            END IF;
            IF ((NEW.category IS NULL OR NEW.category = '' OR NEW.category = 'Other') AND (OLD.category IS NOT NULL AND OLD.category <> 'Other')) THEN
                NEW.category := OLD.category;
            END IF;
            IF (NEW.date IS NULL OR NEW.date = '') THEN
                NEW.date := OLD.date;
            END IF;
            IF (NEW.direction IS NULL) THEN
                NEW.direction := OLD.direction;
            END IF;
            IF (NEW.bank_name IS NULL) THEN
                NEW.bank_name := OLD.bank_name;
            END IF;
            IF (NEW.account_last4 IS NULL) THEN
                NEW.account_last4 := OLD.account_last4;
            END IF;
            IF (NEW.reference_id IS NULL) THEN
                NEW.reference_id := OLD.reference_id;
            END IF;
            IF (NEW.sms_reference_id IS NULL) THEN
                NEW.sms_reference_id := OLD.sms_reference_id;
            END IF;
            NEW.deleted_at := COALESCE(NEW.deleted_at, timezone('utc'::text, now()));
        END IF;

        -- 5. Monotonically increment server revision and set updated_at
        NEW.version := COALESCE(OLD.version, 1) + 1;
        NEW.updated_at := timezone('utc'::text, now());
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_expenses_upsert ON public.user_expenses;
CREATE TRIGGER trg_user_expenses_upsert
BEFORE UPDATE ON public.user_expenses
FOR EACH ROW EXECUTE FUNCTION public.handle_user_expense_upsert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_expenses;

