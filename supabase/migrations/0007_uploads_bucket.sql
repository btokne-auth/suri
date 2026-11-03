-- Suri migration: 0007_uploads_bucket.sql
--
-- Creates the private `uploads` storage bucket in code, so a fresh local
-- Supabase (npx supabase start / db reset) has it too. On the hosted
-- project the bucket was made in the dashboard; ON CONFLICT DO NOTHING
-- makes this a no-op there.
-- Still NO policies on storage.objects: uploads only go through the server
-- upload API with the admin client, and images are shown via signed URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('uploads', 'uploads', false)
ON CONFLICT (id) DO NOTHING;
