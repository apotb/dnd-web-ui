# Database migrations

Migration files in `supabase/migrations/` are the **source of truth** for schema changes. They live in git so you (and anyone else) can reproduce the database on a fresh Supabase project.

You do **not** re-run old migrations on a database that already applied them. Supabase tracks what's been applied in `supabase_migrations.schema_migrations` and only runs **new** files.

## One-time setup

1. Install project dependencies (includes the Supabase CLI):

   ```bash
   npm install
   ```

   There is **no global `supabase` command** unless you install one separately. Use `npm run …` or `npx supabase …` from this repo.

2. Log in and link this repo to your cloud project:

   ```bash
   npm run db:login
   npm run db:link
   # paste your project ref when prompted (dashboard URL: …/project/<ref>)
   ```

   Or the equivalent: `npx supabase login` and `npx supabase link`.

   `YOUR_PROJECT_REF` is the ID in the Supabase dashboard URL:  
   `https://supabase.com/dashboard/project/<project-ref>`

## Apply pending migrations (normal workflow)

From the repo root:

```bash
npm run db:push
```

Preview without applying:

```bash
npm run db:push:dry
```

See local vs remote status:

```bash
npm run db:migration:list
```

## If you previously pasted SQL in the Dashboard

If migrations were applied manually in the SQL Editor, the CLI history table may be empty or out of sync. **Do not** paste all migration files again — that will error on "already exists".

Instead, mark already-applied migrations as applied, then push:

```bash
npm run db:repair-baseline   # marks 001–009 as applied (one-time, if you used the SQL Editor before)
npm run db:push              # applies only new migrations (e.g. 010)
```

Or manually (version is the numeric prefix, e.g. `001` not `001_initial_schema`):

```bash
npx supabase migration repair 001 --status applied
# … through 009 …
npm run db:push
```

Or run `npm run db:migration:list` to see what's missing on remote vs local.

## Day-to-day: adding a change

1. Add a new file: `supabase/migrations/011_something.sql`
2. Commit it to git
3. Run `npm run db:push`

Avoid editing old migration files after they've been applied to production — add a new migration instead.

## Local database (optional)

For a throwaway Postgres that mirrors migrations:

```bash
npx supabase start
npx supabase db reset   # replays all migrations from scratch
```

Not required for the Next.js app if you point `.env.local` at your cloud project.
