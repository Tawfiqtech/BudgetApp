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

## 7. Auto-fill organization_id (important — run once in Supabase)
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

## Testing the flow once it's live
1. Manually create one row in `organizations` via Supabase Table Editor.
2. Visit `/signup?org=<that-id>&orgName=Test+Org&role=admin` on your live
   site, and create an account.
3. Confirm the email (check your inbox — Supabase sends this by default).
4. Log in at `/login`.
5. Manually assign yourself a test `youth` row + a `youth_assignments`
   row in Table Editor (there's no admin UI for this yet).
6. Visit `/log-expense` — your test youth should now appear.

## Not built yet
- The supervisor approval dashboard (reviewing pending expenses)
- An admin screen for creating organizations, youth, and assignments
  without touching Supabase's Table Editor directly
- The invite-link generator/emailer (a good fit for an n8n workflow)
