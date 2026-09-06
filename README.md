# Youth Budget Tracker — setup & deploy

This is a full (small) Next.js project, not just loose files — it needs
`package.json` and a few config files to actually run.

## 1. Run the database schema FIRST
Before touching GitHub, open Supabase SQL Editor and run
**`schema-v2-residence-model.sql`**. This replaces any earlier schema
files you may have run before — it drops and recreates everything with
the corrected structure (workers are assigned to **houses**, not
individual youth, matching how staffing actually works).

If you already ran the earlier multi-tenant schema or the RLS-fixes
file, don't worry — this file safely drops those tables first since no
real data has been entered yet.

## 2. Create the GitHub repo
- GitHub → New repository → name it e.g. `youth-budget-tracker` → Create

## 3. Upload the files
Unzip this package on your device first. On the empty repo page, click
**"uploading an existing file"**, then drag in the **contents** of the
unzipped folder — not the folder itself, and not the `.sql` file (that
one's Supabase-only, not part of the deployed app). Your repo's root
should look like this:

```
youth-budget-tracker/
  app/
    admin/page.tsx
    approvals/page.tsx
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

You do **not** need to upload a `node_modules` folder — Netlify
generates it automatically during deploy by reading `package.json`.

Commit changes.

## 4. Connect Netlify
- Netlify → Add new site → Import an existing project → GitHub → pick
  `youth-budget-tracker`
- Build command: `npm run build` (already set in `netlify.toml`)
- Publish directory: leave whatever Netlify autodetects for Next.js

## 5. Add environment variables in Netlify
This can't live in the GitHub repo (it's in `.gitignore` on purpose).
In Netlify: **Site settings → Environment variables**, add:

```
NEXT_PUBLIC_SUPABASE_URL = https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = your-anon-key
```

Both values are in Supabase Dashboard → Project Settings → API.

## 6. Deploy
Trigger a deploy (Netlify usually does this automatically after step 4).

## 7. Storage bucket for receipts
In Supabase Dashboard → Storage, create a bucket named `receipts`.
Recommended: make it **private**, not public, since receipts may
contain identifying info you don't want publicly linkable.

If you chose private, also run **`storage-policies.sql`** in the SQL
editor — private buckets block all access by default, so this sets up
org-scoped policies (workers can upload/view only within their own
organization's folder).

## Testing the flow once it's live
1. Manually create one row in `organizations` via Supabase Table Editor
   (this one step still has to be done directly in Supabase — everything
   after it can be done through the app).
2. Visit `/signup?org=<that-id>&orgName=Test+Org&role=admin` on your live
   site, and create an account.
3. Confirm the email, then log in at `/login`.
4. Go to `/admin`:
   - Add a house (e.g. "Bear House")
   - Add a youth, assigning them to that house
   - Add a budget category
   - Assign a worker to that house
   - Set a budget allocation for the youth
5. Generate an invite link from `/admin` to create a worker account, or
   just visit `/log-expense` yourself if you assigned yourself to the
   house as a worker.
6. Log an expense as that worker, then log back in as your admin
   account (which also has supervisor-level access) and visit
   `/approvals` to see it waiting for a decision.

## Not built yet
- The invite-link emailer — right now `/admin` generates the link and
  you copy/paste it yourself; automatically emailing it is a good fit
  for an n8n workflow
- A worker home dashboard showing budget balances before logging a new
  expense
- Shared navigation between pages (each screen is still standalone)
