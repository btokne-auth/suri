-- Suri step 4 migration: 0001_suri_step4_tables.sql
--
-- Browser is READ-ONLY at two levels:
--   1. Privileges (grants at the end): authenticated gets SELECT only on the
--      8 visitor tables; usage_counters gets no grant; anon gets nothing.
--   2. RLS: SELECT-only policies for `authenticated`, own rows only.
-- No INSERT/UPDATE/DELETE policies: all writes happen in server code
-- (API routes / server actions) using lib/supabase/admin.js
-- (SUPABASE_SECRET_KEY, bypasses RLS) AFTER getClaims() + ownership
-- check in code + step-3 Zod validation.
-- Storage: NO policies on storage.objects. Uploads only through the
-- server upload API (step 5). Images via server signed URLs.
-- The `uploads` bucket itself is created in the dashboard, not here.
-- Tables refer to settings files by id. No full document text stored.

-- ---------------------------------------------------------------- profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  given_name text,
  middle_name text,
  surname text,
  suffix text,
  birth_date date,
  city_municipality text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------ submissions
CREATE TABLE IF NOT EXISTS public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  process_id text NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'requirement_not_met', 'submitted', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, process_id)
);

-- -------------------------------------------------------------- documents
CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions (id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  storage_path text NOT NULL,
  sha256 text,
  file_type text,
  file_size_bytes bigint,
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'reading', 'needs_review', 'retake_needed', 'error', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------- extracted_fields
CREATE TABLE IF NOT EXISTS public.extracted_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value_text text,
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  unreadable boolean NOT NULL DEFAULT false,
  found_on_page text,
  UNIQUE (document_id, field_key)
);

-- ---------------------------------------------------------- check_results
CREATE TABLE IF NOT EXISTS public.check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  compared_document_id uuid REFERENCES public.documents (id) ON DELETE SET NULL,
  field_key text NOT NULL,
  rule text NOT NULL,
  result text NOT NULL CHECK (result IN ('match', 'check', 'mismatch', 'invalid')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- work_log
CREATE TABLE IF NOT EXISTS public.work_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.submissions (id) ON DELETE CASCADE,
  step_type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------- clarifications
CREATE TABLE IF NOT EXISTS public.clarifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_result_id uuid NOT NULL REFERENCES public.check_results (id) ON DELETE CASCADE,
  field_key text NOT NULL,
  question text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- --------------------------------------------------------- review_actions
CREATE TABLE IF NOT EXISTS public.review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users (id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve', 'correct', 'reject')),
  field_key text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- -------------------------------------------------------- usage_counters
-- No anon/authenticated access (no policies, no grants). Server only.
CREATE TABLE IF NOT EXISTS public.usage_counters (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 1,
  PRIMARY KEY (key, window_start)
);

-- ----------------------------------------------------------------- indexes
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_documents_submission_id ON public.documents (submission_id);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_document_id ON public.extracted_fields (document_id);
CREATE INDEX IF NOT EXISTS idx_check_results_document_id ON public.check_results (document_id);
CREATE INDEX IF NOT EXISTS idx_work_log_submission_id ON public.work_log (submission_id);
CREATE INDEX IF NOT EXISTS idx_clarifications_check_result_id ON public.clarifications (check_result_id);
CREATE INDEX IF NOT EXISTS idx_review_actions_document_id ON public.review_actions (document_id);

-- --------------------------------------------------------------------- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clarifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;

-- SELECT-only, own rows only. No INSERT/UPDATE/DELETE policies.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS submissions_select_own ON public.submissions;
CREATE POLICY submissions_select_own ON public.submissions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS documents_select_own ON public.documents;
CREATE POLICY documents_select_own ON public.documents
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.submissions s
      WHERE s.id = documents.submission_id AND s.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS extracted_fields_select_own ON public.extracted_fields;
CREATE POLICY extracted_fields_select_own ON public.extracted_fields
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents d
      JOIN public.submissions s ON s.id = d.submission_id
      WHERE d.id = extracted_fields.document_id AND s.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS check_results_select_own ON public.check_results;
CREATE POLICY check_results_select_own ON public.check_results
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents d
      JOIN public.submissions s ON s.id = d.submission_id
      WHERE d.id = check_results.document_id AND s.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS work_log_select_own ON public.work_log;
CREATE POLICY work_log_select_own ON public.work_log
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.submissions s
      WHERE s.id = work_log.submission_id AND s.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS clarifications_select_own ON public.clarifications;
CREATE POLICY clarifications_select_own ON public.clarifications
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.check_results cr
      JOIN public.documents d ON d.id = cr.document_id
      JOIN public.submissions s ON s.id = d.submission_id
      WHERE cr.id = clarifications.check_result_id AND s.user_id = (select auth.uid()))
  );

DROP POLICY IF EXISTS review_actions_select_own ON public.review_actions;
CREATE POLICY review_actions_select_own ON public.review_actions
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.documents d
      JOIN public.submissions s ON s.id = d.submission_id
      WHERE d.id = review_actions.document_id AND s.user_id = (select auth.uid()))
  );

-- usage_counters: NO policies. storage.objects: NO policies.

-- ------------------------------------------------------------------ grants
-- Browser read-only at privilege level too. usage_counters: no grant. anon: nothing.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON public.profiles, public.submissions, public.documents, public.extracted_fields, public.check_results, public.work_log, public.clarifications, public.review_actions TO authenticated;

