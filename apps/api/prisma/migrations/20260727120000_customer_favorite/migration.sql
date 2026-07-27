-- Star a customer so the accounts that matter stay reachable from any device.
--
-- Additive and defaulted: existing rows get `false` without a table rewrite of
-- user data, and an older API image keeps running against this schema, so the
-- migration is safe to apply before the new image finishes rolling out.
ALTER TABLE "customers" ADD COLUMN "isFavorite" BOOLEAN NOT NULL DEFAULT false;
