-- BingeWyrm: pg_cron job for session expiry
-- Runs every minute, closes sessions past their end_time.

-- Enable the pg_cron extension (idempotent)
create extension if not exists "pg_cron";

-- Schedule the cron job
select cron.schedule(
  'close-expired-sessions',
  '* * * * *',  -- every minute
  $$select public.close_expired_sessions()$$
);
