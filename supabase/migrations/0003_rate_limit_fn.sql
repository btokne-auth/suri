-- Suri step 5 fix: 0003_rate_limit_fn.sql
--
-- Atomic rate-limit counter. Two uploads at the same second used to both
-- read count=9 then both write 10. This function runs the read+write as
-- one step inside Postgres, so the count is always right.
-- Run this in the Supabase SQL editor (Singapore project).
-- Server calls it with the admin client (SUPABASE_SECRET_KEY).
-- Browser roles get nothing: no policies, no grants, no EXECUTE.

CREATE OR REPLACE FUNCTION public.increment_usage(p_key text, p_window_start timestamptz)
RETURNS integer
LANGUAGE sql
SET search_path = ''
AS $$
  INSERT INTO public.usage_counters AS uc (key, window_start, count)
  VALUES (p_key, p_window_start, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = uc.count + 1
  RETURNING count;
$$;

-- Only service_role (the server) may call it. Browser gets nothing.
REVOKE ALL ON FUNCTION public.increment_usage(text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(text, timestamptz) TO service_role;
