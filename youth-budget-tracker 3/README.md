[README.md](https://github.com/user-attachments/files/31855840/README.md)
# Youth Budget Tracker — setup & deploy

This is a full (small) Next.js project, not just loose files — it needs
`package.json` and a few config files to actually run, which is why it's
more than one file this time.

## 1. Create the GitHub repo
- GitHub → New repository → name it e.g. `youth-budget-tracker` → Create

## 2. Upload the files
Unzip this package on your device first. On the empty repo page, click
**"uploading an existing file"**, then drag in the **contents** of the
unzipped folder — not the folder itself. When you're done, your repo's
root should look like this:

```
youth-budget-tracker/
  app/
    login/page.tsx
    log-expense/page.tsx
    signup/page.tsx
    layout.tsx
    globals.css
    page.tsx
  lib/
    supabase.ts
  package.json
  next.config.js
  tailwind.config.js
  postcss.config.js
  tsconfig.json
  next-env.d.ts
  netlify.toml
  .gitignore
  .env.local.example
```

You do **not** need to upload a `node_modules` folder — it doesn't exist
yet, and Netlify generates it automatically during deploy by reading
`package.json`.

Commit changes.

## 3. Connect Netlify
- Netlify → Add new site → Import an existing project → GitHub → pick
  `youth-budget-tracker`
- Build command: `npm run build` (already set in `netlify.toml`, so this
  should autofill)
- Publish directory: leave whatever Netlify autodetects for Next.js —
  don't set this manually

## 4. Add environment variables in Netlify
This is the one thing that can't live in the GitHub repo (it's in
`.gitignore` on purpose, so your Supabase keys never get committed
publicly). In Netlify: **Site settings → Environment variables**, add:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

Both values are in Supabase Dashboard → Project Settings → API.

## 5. Deploy
Trigger a deploy (Netlify usually does this automatically after step 3).
First build takes a bit longer than the static site did, since it's
actually running `npm install` + `npm run build` this time.

## 6. Storage bucket for receipts
In Supabase Dashboard → Storage, create a bucket named `receipts`.

## 7. Run the RLS fixes (required — do this before using /admin)
`supabase-admin-rls-fixes.sql` is included in this package. Building the
admin screen surfaced two gaps in the original schema: `profiles` and
`organizations` had no RLS protection at all (any logged-in user could
technically read every organization's staff list), and none of the
tables the admin screen writes to had insert policies yet, which means
RLS would have silently blocked every admin action. Run this file once
in the Supabase SQL editor before testing `/admin`.

## 8. Auto-fill organization_id (important — run once in Supabase)
The expense form never sends `organization_id` from the browser — a
worker's device shouldn't be trusted to state its own org. Run this once
in the Supabase SQL editor so the database fills it in automatically:

```sql
alter table expenses
  alter column organization_id set default get_user_org_id();

alter table youth
  alter column organization_id set default get_user_org_id();

alter table budget_allocations
  alter column organization_id set default get_user_org_id();
```
(The other two tables that need this — `budget_categories` and
`youth_assignments` — already have it set by `supabase-admin-rls-fixes.sql`
in step 7, so you don't need to repeat those here.)

## Testing the flow once it's live
1. Manually create one row in `organizations` via Supabase Table Editor
   (this one step still has to be done directly in Supabase — everything
   after it can be done through the app).
2. Visit `/signup?org=<that-id>&orgName=Test+Org&role=admin` on your live
   site, and create an account.
3. Confirm the email (check your inbox — Supabase sends this by default).
4. Log in at `/login`.
5. Go to `/admin` — add a youth, a budget category, assign yourself
   (or another worker) to that youth, and set a budget allocation, all
   from the admin screen.
6. Generate an invite link from `/admin` and use it to create a worker
   account, or just visit `/log-expense` yourself if you assigned
   yourself as the worker.

## Not built yet
- The supervisor approval dashboard (reviewing pending expenses)
- The invite-link emailer — right now `/admin` generates the link and
  you copy/paste it yourself; automatically emailing it is a good fit
  for an n8n workflow
