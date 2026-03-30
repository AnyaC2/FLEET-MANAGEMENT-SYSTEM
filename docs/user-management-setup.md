# User Management Setup

To let a `system_admin` create and delete user accounts from the app:

1. Make sure you already ran [rbac-policies.sql](/Users/milaxs/Desktop/my-react-app%20codex/supabase/rbac-policies.sql).
2. Make sure the function config exists in [config.toml](/Users/milaxs/Desktop/my-react-app%20codex/supabase/config.toml) with `verify_jwt = false` for both `create-user` and `delete-user`.
3. Deploy the Edge Functions from the project root:

```bash
cd "/Users/milaxs/Desktop/my-react-app codex"
npx supabase functions deploy create-user --project-ref tobpvfichoieucnvgdqf --use-api
npx supabase functions deploy delete-user --project-ref tobpvfichoieucnvgdqf --use-api
```

4. Test from the app:
   - open `Users`
   - click `Create User`
   - enter name, email, password, and role
   - try deleting a non-admin user from the user list

Notes:
- The function checks that the caller is a `system_admin`.
- The function reads the caller access token from the request and verifies the caller's role from `public.profiles`.
- The function creates the Auth user, then upserts the matching `profiles` row with the selected app role.
- The delete flow removes the user from Supabase Auth, which also removes the linked `profiles` row through the existing foreign-key cascade.
- A system admin cannot delete their own account or the last remaining system admin.
- `SUPABASE_SERVICE_ROLE_KEY` is provided by Supabase inside the hosted Edge Function runtime. Do not put the service role key in the React app.
