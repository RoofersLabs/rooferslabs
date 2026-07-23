-- =============================================================================
-- RoofersLabs — production data reset
-- =============================================================================
-- DANGER: permanently deletes ALL customer- and development-generated data
-- (companies, users, customers, calls, conversations, appointments, knowledge
-- base, notifications, push subscriptions, audit logs, phone numbers, …).
--
-- PRESERVES the schema, enums, constraints, indexes, and the Prisma migration
-- history (`_prisma_migrations`) — so the database stays valid and migrated,
-- just empty. Run ONLY against a database you intend to wipe to a fresh,
-- never-onboarded state. Read this file in full before running.
--
-- Discovers tables dynamically so a newly-added table is never missed.
-- =============================================================================

DO $$
DECLARE
  tables text;
BEGIN
  SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tables
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename <> '_prisma_migrations';

  IF tables IS NULL THEN
    RAISE NOTICE 'No data tables found — nothing to truncate.';
  ELSE
    EXECUTE 'TRUNCATE TABLE ' || tables || ' RESTART IDENTITY CASCADE';
    RAISE NOTICE 'Truncated (identities reset, cascaded): %', tables;
  END IF;
END $$;
