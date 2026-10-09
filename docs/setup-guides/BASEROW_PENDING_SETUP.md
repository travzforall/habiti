# Finishing the database

Two features ship switched off because their tables do not exist yet. This is
how to finish it — one command.

> **Most of this is already done.** Eleven of the thirteen tables were created
> on 2026-10-08, and `npm run verify:fields` reports the ids it found. What is
> left is `toolkit_items` and `legal_acceptances`, below.

## Why it needs your password

The token in `environment.ts` is a Baserow **database token**: it reads and
writes rows, and that is all. Creating a table or a column needs a user JWT,
which means a real login. The script reads your credentials from the
environment, uses them for one sign-in, and stores nothing.

## The command

Paste all of this at once — it asks for the password when it needs it:

```bash
export BASEROW_URL=https://db.jollycares.com
export BASEROW_DATABASE_ID=128          # Habiti's database, not the scheduler's 127
export BASEROW_EMAIL=you@example.com

npm run db:setup                        # DRY RUN — says exactly what it would do
```

It prints every table and column it intends to touch, then stops. When that
looks right:

```bash
npm run db:setup -- --apply --write-env # do it, and update environment.ts
```

> **Do not put `read -s BASEROW_PASSWORD` in a pasted block.** `read` takes its
> input from stdin, and in a paste that is the NEXT LINE — so the password
> becomes `npm run db:setup`, the login 401s, and the error blames your
> credentials. That is why the script asks for the password itself. For a run
> with no terminal (CI), set `BASEROW_PASSWORD` or pass
> `--password-file <path>`.

Then:

```bash
npm run verify:fields   # every column the app writes exists
npm start               # restart the dev server so it picks up the new ids
```

**It is safe to re-run.** An existing table is reported and skipped; an existing
column is left alone. It never deletes or alters anything already there.

## What it creates

| Schema | Table | Turns on |
|---|---|---|
| `42-toolkit-items.json` | `toolkit_items` | the standing kit at `/toolkit` |
| `30-legal-acceptances.json` | `legal_acceptances` | a durable record of acceptances and Article 9 consent |

`legal_acceptances` is the one to care about. The acceptance gate, the Article 9
consent prompts and the re-acceptance flow all shipped before the table
existed, so every acceptance so far lives in localStorage — and a cache clear
erases the record that anyone agreed to anything.

Be clear about what a row there is. While the Baserow token ships in the client
bundle a user can write that table directly, so a row is **corroboration** of
an acceptance, not evidence of one. Still worth having: corroboration that
survives a cache clear beats a localStorage key that does not.

The other eleven are already created and re-running is safe — an existing table
is reported and skipped.

## What it adds to existing tables

Nothing outstanding. `status`, `progress_pct` and `milestone_id` on
`user_tasks` and `type` on `user_projects` were added on 2026-10-08 and
`verify:fields` confirms them against the live table.

The column specs come from the schema JSON, not from a copy inside the script,
so they cannot drift from what `npm run verify:fields` checks.

## Until you run it

Nothing is broken and nothing is lost. Every one of those features works from
local storage and warns once in the console — the data simply stays in the
browser that made it. The two pending columns are dropped silently by Baserow
(that is the behaviour `verify:fields` exists to police), and the app falls back:
status is derived from `completed`, and an unknown project type reads as
`personal`.

## If it fails

- **401** — wrong email or password. Try `node scripts/add-baserow-field.mjs
  --check-login` to test credentials without touching a table.
- **404 on the database** — `BASEROW_DATABASE_ID` is wrong. List them with
  `node scripts/create-baserow-table.mjs --list-databases`.
- **A table exists but with the wrong columns** — the script only ADDS. Fix the
  column in Baserow's UI, or delete the table and re-run.
