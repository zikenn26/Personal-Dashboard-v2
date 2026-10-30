-- ==============================================================================
-- Supabase Cloud Database & Storage Cleanup Script
-- Target Accounts Whitelist:
--   1. gknayak@gmail.com (Gulshan Kumar Nayak - Primary Dashboard)
--   2. arpitapri125@gmail.com (Arpita Priyadar - Secondary Isolated Account)
--
-- Actions:
--   1. Permanently delete all rows in public.user_workspaces not matching whitelist
--   2. Permanently delete all rows in public.user_expenses not matching whitelist
--   3. Delete any partition keys referencing gulnayak1206 or old test accounts
--   4. Delete storage avatar objects belonging to non-whitelisted accounts
--   5. Purge auth.users records for non-whitelisted emails
-- ==============================================================================

BEGIN;

-- 1. Clean public.user_workspaces
DELETE FROM public.user_workspaces
WHERE (
  -- Delete all rows whose user_email is not in the whitelist
  (user_email IS NOT NULL AND LOWER(TRIM(user_email)) NOT IN ('gknayak@gmail.com', 'arpitapri125@gmail.com'))
  OR (user_identifier ILIKE '%gulnayak%')
  OR (user_identifier ILIKE '%mock%')
  OR (user_identifier ILIKE '%guest%')
  OR (user_identifier ILIKE '%test%')
);

-- 2. Clean public.user_expenses (if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'user_expenses'
  ) THEN
    DELETE FROM public.user_expenses
    WHERE (
      (user_email IS NOT NULL AND LOWER(TRIM(user_email)) NOT IN ('gknayak@gmail.com', 'arpitapri125@gmail.com'))
      OR (user_id ILIKE '%gulnayak%')
      OR (user_id ILIKE '%guest%')
      OR (user_id ILIKE '%test%')
    );
  END IF;
END $$;

-- 3. Clean avatars from storage.objects (if storage bucket exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'storage' AND table_name = 'objects'
  ) THEN
    DELETE FROM storage.objects
    WHERE bucket_id = 'avatars'
      AND (
        name ILIKE '%gulnayak%'
        OR name ILIKE '%test%'
        OR name ILIKE '%guest%'
        OR name ILIKE '%mock%'
      );
  END IF;
END $$;

-- 4. Clean auth.users (if executing with service_role permissions in SQL Editor)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    DELETE FROM auth.users
    WHERE email IS NOT NULL
      AND LOWER(TRIM(email)) NOT IN ('gknayak@gmail.com', 'arpitapri125@gmail.com');
  END IF;
END $$;

COMMIT;

-- Verify surviving rows
SELECT id, user_identifier, user_email, updated_at 
FROM public.user_workspaces 
ORDER BY updated_at DESC;
