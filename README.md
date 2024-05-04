# TAPT
### Test Supabase Edge Functions locally
#### Prerequisites
- [supabase cli](https://supabase.com/docs/guides/cli/getting-started) (or if you don't want to install cli version, you can run as a [npx](https://www.npmjs.com/package/supabase) package)
- supabase account to get credentials and configs
>Before running supabase, make sure you've logged in (`supabase login`)

#### Build and run
- initialize supabase under the directory (`tapt/supabase/`)
```bash
supabase start
```
- start the Functions watcher
```bash
supabase functions serve --no-verify-jwt
```
- invoke functions locally
```bash
curl --request POST 'http://localhost:54321/functions/v1/cron-schedule' \
  --header 'Authorization: Bearer SUPABASE_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{ "name":"Functions" }'
```
>If you encountered any problems, you can follow [the steps from official documentation](https://supabase.com/docs/guides/functions/quickstart#running-edge-functions-locally)
