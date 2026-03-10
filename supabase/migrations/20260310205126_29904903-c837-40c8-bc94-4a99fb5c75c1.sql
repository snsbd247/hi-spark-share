
-- Daily backup at 2:00 AM
SELECT cron.schedule(
  'daily-backup',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url:='https://udxrzqpivtzunnfenmyd.supabase.co/functions/v1/backup-restore',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeHJ6cXBpdnR6dW5uZmVubXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjM3OTAsImV4cCI6MjA4ODUzOTc5MH0.cqupkjIjdIcF-g_WDBtmKpSXqMoL09TVPtWsV5XY0ps"}'::jsonb,
    body:='{"action": "auto", "backup_type": "auto_daily"}'::jsonb
  ) AS request_id;
  $$
);

-- Weekly backup every Sunday at 3:00 AM
SELECT cron.schedule(
  'weekly-backup',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url:='https://udxrzqpivtzunnfenmyd.supabase.co/functions/v1/backup-restore',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeHJ6cXBpdnR6dW5uZmVubXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjM3OTAsImV4cCI6MjA4ODUzOTc5MH0.cqupkjIjdIcF-g_WDBtmKpSXqMoL09TVPtWsV5XY0ps"}'::jsonb,
    body:='{"action": "auto", "backup_type": "auto_weekly"}'::jsonb
  ) AS request_id;
  $$
);

-- Monthly backup on 1st of each month at 4:00 AM
SELECT cron.schedule(
  'monthly-backup',
  '0 4 1 * *',
  $$
  SELECT net.http_post(
    url:='https://udxrzqpivtzunnfenmyd.supabase.co/functions/v1/backup-restore',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeHJ6cXBpdnR6dW5uZmVubXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjM3OTAsImV4cCI6MjA4ODUzOTc5MH0.cqupkjIjdIcF-g_WDBtmKpSXqMoL09TVPtWsV5XY0ps"}'::jsonb,
    body:='{"action": "auto", "backup_type": "auto_monthly"}'::jsonb
  ) AS request_id;
  $$
);

-- Daily cleanup of backups older than 30 days at 5:00 AM
SELECT cron.schedule(
  'backup-cleanup',
  '0 5 * * *',
  $$
  SELECT net.http_post(
    url:='https://udxrzqpivtzunnfenmyd.supabase.co/functions/v1/backup-restore',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkeHJ6cXBpdnR6dW5uZmVubXlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjM3OTAsImV4cCI6MjA4ODUzOTc5MH0.cqupkjIjdIcF-g_WDBtmKpSXqMoL09TVPtWsV5XY0ps"}'::jsonb,
    body:='{"action": "cleanup"}'::jsonb
  ) AS request_id;
  $$
);
