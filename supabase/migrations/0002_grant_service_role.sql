-- Suri step 4 migration: 0002_grant_service_role.sql
--
-- The project's auto-expose is OFF, so new tables got no Postgres
-- privileges at all -- not even for service_role. The server admin
-- client (SUPABASE_SECRET_KEY) was therefore denied on every write.
-- This grants full access on current tables to service_role only.
-- Browser roles are untouched: anon gets nothing, authenticated keeps
-- the SELECT-only grants from 0001. Run again after adding new tables.

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
