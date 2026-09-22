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
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
);

CREATE POLICY "Users can insert own workspace"
ON public.user_workspaces
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
);

CREATE POLICY "Users can update own workspace"
ON public.user_workspaces
FOR UPDATE
TO authenticated
USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
)
WITH CHECK (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
);

CREATE POLICY "Users can delete own workspace"
ON public.user_workspaces
FOR DELETE
TO authenticated
USING (
    auth.uid() = user_id
    OR (user_id IS NULL AND user_email = auth.jwt()->>'email')
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
