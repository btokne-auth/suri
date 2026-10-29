-- Suri step 7c migration: 0004_saved_processes.sql
--
-- Saved (office-drafted) processes. One row per visitor per confirmed process.
-- Only the validated `definition` is stored; the office description is
-- request-scoped only and is never stored here.
-- Writes happen only in server code (POST /api/setup/confirm) using
-- lib/supabase/admin.js (SUPABASE_SECRET_KEY, bypasses RLS) AFTER
-- getClaims() + ownership check + Zod validation.
-- Browser is READ-ONLY at two levels:
--   1. Privileges (grants below): authenticated gets SELECT only; anon gets nothing.
--   2. RLS: SELECT-only policy for `authenticated`, own rows only.
-- No INSERT/UPDATE/DELETE policies.
-- Run this in the Supabase SQL editor (Singapore project).

CREATE TABLE IF NOT EXISTS public.saved_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  process_key text NOT NULL,
  label text NOT NULL,
  definition jsonb NOT NULL,
  draft_attempts jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, process_key)
);

ALTER TABLE public.saved_processes ENABLE ROW LEVEL SECURITY;

-- SELECT-only, own rows only. No INSERT/UPDATE/DELETE policies.
DROP POLICY IF EXISTS saved_processes_select_own ON public.saved_processes;
CREATE POLICY saved_processes_select_own ON public.saved_processes
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

-- Browser read-only at privilege level too (like 0001).
REVOKE ALL ON public.saved_processes FROM anon, authenticated;
GRANT SELECT ON public.saved_processes TO authenticated;

-- Server admin client needs full access. 0002 only covered older tables,
-- so grant explicitly on this new table. Browser roles are untouched.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_processes TO service_role;
