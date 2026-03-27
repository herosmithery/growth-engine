-- Enable pg_cron extension (already enabled in Supabase)
-- Run this SQL in Supabase Dashboard > SQL Editor

-- Schedule the Growth Engine cron scheduler to run every 15 minutes
SELECT cron.schedule(
  'growth-engine-scheduler',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT
    net.http_post(
      url:='https://tsvuzkdrtquzuseaezjk.supabase.co/functions/v1/cron-scheduler',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer sb_secret_YF6q558n3XJpGpkk3Gkl-w_hsupc-d8"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- To verify the job was created:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('growth-engine-scheduler');

-- To view recent job runs:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
