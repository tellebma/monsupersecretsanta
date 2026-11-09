-- Préparer dans Vault les secrets santa_app_origin (origine HTTPS) et santa_schedule_secret.
-- Le second doit correspondre à SCHEDULE_SECRET sur Vercel.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('mon-super-secret-santa', '* * * * *', $cron$
  select net.http_post(
    url := rtrim(origin.decrypted_secret, '/') || '/api/schedule',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret.decrypted_secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  )
  from vault.decrypted_secrets origin cross join vault.decrypted_secrets secret
  where origin.name='santa_app_origin' and secret.name='santa_schedule_secret';
$cron$);
