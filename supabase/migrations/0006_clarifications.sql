-- Suri step 9B migration: 0006_clarifications.sql
--
-- Suri asks before it flags: Filipino name probably-same checks may ask one
-- short confirmation question per unique name pair, at most 3 per submission.
-- This migration lets answers survive re-checks.
--
-- Changes (idempotent, grants like 0005):
--   1. clarifications.submission_id uuid REFERENCES submissions(id) ON DELETE CASCADE
--   2. clarifications.pair_key text  (field_key + "|" + sorted normalized pair)
--   3. clarifications.check_result_id becomes nullable ON DELETE SET NULL
--      (old deletes in runChecksForDocument wipe check_results; clarifications stay)
--   4. UNIQUE (submission_id, pair_key) where both not null
--   5. CHECK char_length(question) 1..160 and answer 1..200
--   6. RLS via submission_id (own rows only)
--   7. Grants: authenticated SELECT only; service_role full
-- Writes still happen only in server code via lib/supabase/admin.js
-- (SUPABASE_SECRET_KEY, bypasses RLS) AFTER getClaims() + ownership check.
-- Run this in the Supabase SQL editor (Singapore project).
-- Tell the assistant when it is done so Act 3 can start.

-- New columns (idempotent)
ALTER TABLE public.clarifications ADD COLUMN IF NOT EXISTS submission_id uuid REFERENCES public.submissions (id) ON DELETE CASCADE;
ALTER TABLE public.clarifications ADD COLUMN IF NOT EXISTS pair_key text;
ALTER TABLE public.clarifications ALTER COLUMN submission_id SET NOT NULL;
ALTER TABLE public.clarifications ALTER COLUMN pair_key SET NOT NULL;

-- Make check_result_id nullable and ON DELETE SET NULL (was NOT NULL CASCADE)
-- Drop existing FK if present (Postgres auto-name is clarifications_check_result_id_fkey)
ALTER TABLE public.clarifications DROP CONSTRAINT IF EXISTS clarifications_check_result_id_fkey;
ALTER TABLE public.clarifications ALTER COLUMN check_result_id DROP NOT NULL;
ALTER TABLE public.clarifications ADD CONSTRAINT clarifications_check_result_id_fkey
  FOREIGN KEY (check_result_id) REFERENCES public.check_results (id) ON DELETE SET NULL;

-- Unique pair per submission (only where both columns are present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clarifications_unique_pair
  ON public.clarifications (submission_id, pair_key)
  WHERE submission_id IS NOT NULL AND pair_key IS NOT NULL;

-- Keep old index for lookup via check_result_id (from 0001)
CREATE INDEX IF NOT EXISTS idx_clarifications_check_result_id ON public.clarifications (check_result_id);
CREATE INDEX IF NOT EXISTS idx_clarifications_submission_id ON public.clarifications (submission_id);

-- Question / answer length checks (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clarifications_question_length_check'
      AND conrelid = 'public.clarifications'::regclass
  ) THEN
    ALTER TABLE public.clarifications ADD CONSTRAINT clarifications_question_length_check
      CHECK (char_length(question) BETWEEN 1 AND 160);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'clarifications_answer_length_check'
      AND conrelid = 'public.clarifications'::regclass
  ) THEN
    ALTER TABLE public.clarifications ADD CONSTRAINT clarifications_answer_length_check
      CHECK (answer IS NULL OR char_length(answer) BETWEEN 1 AND 200);
  END IF;
END $$;

-- RLS: own rows via submission_id (replaces old check_results->documents->submissions chain)
ALTER TABLE public.clarifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS clarifications_select_own ON public.clarifications;
CREATE POLICY clarifications_select_own ON public.clarifications
  FOR SELECT TO authenticated USING (
    submission_id IN (SELECT id FROM public.submissions WHERE user_id = (select auth.uid()))
  );

-- Privileges: browser read-only (SELECT only). Server admin full (like 0001/0004/0005)
REVOKE ALL ON public.clarifications FROM anon, authenticated;
GRANT SELECT ON public.clarifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clarifications TO service_role;
