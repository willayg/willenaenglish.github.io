Deploying `refresh_leaderboard_cache` as a Supabase Edge Function

This function computes the global leaderboards and upserts JSON payloads into `public.leaderboard_cache`.

Prerequisites
- Supabase CLI installed and authenticated.
- Project `SUPABASE_URL` and a Service Role key (`SUPABASE_SERVICE_ROLE_KEY`). Keep the service key secret.

Steps
1. Add the function to your repo (already present at `supabase/functions/refresh_leaderboard_cache`).
2. Login with the Supabase CLI:

   supabase login

3. Deploy the function:

   supabase functions deploy refresh_leaderboard_cache --project-ref <project-ref>

4. Set the required secret for the function (do this only once):

   supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"

   (You can also set SUPABASE_URL in the function's environment if needed.)

5. Test the function manually:

   supabase functions invoke refresh_leaderboard_cache --project-ref <project-ref>

   The function should return HTTP 200 and after a successful run you should see rows in `public.leaderboard_cache`.

6. Schedule the function to run every 2 minutes (cron: `*/2 * * * *`):
   - Open Supabase Dashboard → Functions / Jobs → Create a scheduled job.
   - Or use the Supabase UI to create a Cron job that invokes the function URL on the schedule.

Notes
- The function includes a 100s guard to avoid overlapping runs.
- If you prefer GitHub Actions or an external cron, see alternatives in the project README.

If you want, I can also generate a GitHub Actions workflow that invokes the function every 2 minutes instead of using Supabase's scheduler.
