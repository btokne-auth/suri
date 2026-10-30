-- Suri step 9A migration: 0005_quality_wrongdoc.sql
--
-- Photo quality (retake) + wrong-document check.
-- Adds:
--   1. documents.status value 'wrong_document' (before any checks)
--   2. documents.looks_like text (only validated enum values ever stored)
--   3. documents.quality_problems text[] (only validated enum values ever stored)
-- The app validates quality.problems against enum [blurry,dark,glare,cut_off,angle]
-- and document_match.looks_like against known doc ids + 'other'. Only those
-- validated values are written to these columns (code never writes raw model text).
-- Writes still happen only in server code via lib/supabase/admin.js after
-- getClaims() + ownership check + Zod validation.
-- Run this in the Supabase SQL editor (Singapore project). Tell the assistant
-- when it is done so Act B can start.

-- New columns (idempotent)
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS looks_like text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS quality_problems text[];

-- Status CHECK: add 'wrong_document' (retake_needed already existed).
-- The original CHECK was inline without an explicit name; Postgres auto-names it
-- documents_status_check. Drop if exists, then recreate with full list.
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_status_check;
ALTER TABLE public.documents ADD CONSTRAINT documents_status_check
  CHECK (status IN ('uploaded','reading','needs_review','retake_needed','wrong_document','error','approved','rejected'));

-- Privileges: keep browser read-only (SELECT only). Ensure server can write.
-- Like 0001/0004: authenticated keeps SELECT, anon gets nothing.
REVOKE ALL ON public.documents FROM anon, authenticated;
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;

-- Optional: document what valid quality_problems values mean
COMMENT ON COLUMN public.documents.quality_problems IS 'Validated enum subset of [blurry,dark,glare,cut_off,angle]; null or empty means no problem reported.';
COMMENT ON COLUMN public.documents.looks_like IS 'Validated looks_like: known doc id or other; only written when document_match is validated.';
