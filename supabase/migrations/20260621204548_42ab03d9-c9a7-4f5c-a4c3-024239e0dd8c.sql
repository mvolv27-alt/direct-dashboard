-- Hosted Supabase projects own realtime.messages with an internal service role.
-- Postgres Changes subscriptions for public tables do not require application
-- policies on that internal table, so this historical migration is a safe no-op.
select 1;
