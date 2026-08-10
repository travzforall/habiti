# Baserow import files

Import-ready row data for the Friends, Campaigns, Challenges and Levels tables.

Each `*.rows.json` is a **flat array of row objects** — the shape Baserow's
importer expects. The matching `../NN-name.json` in the parent folder is the
*specification* (field types, options, notes); it is not importable on its own.

## Why the sample rows look the way they do

**Baserow builds a dropdown's options from the values it finds in the data.**
If no row ever uses `status: "disputed"`, that option will not exist in the
imported table, and you would only discover it the first time the app tried to
write it.

So every row set here **uses every option of every dropdown at least once** —
that is why `22-campaign-events` has 24 rows (one per event type) and
`16-campaigns` has 10 (one per status). The rows are written as a coherent
narrative rather than filler, so the tables are also readable as example data.

Verify it at any time:

```bash
node database-schemas/baserow-import/verify-coverage.js
```

It checks every option is used, no value is outside the schema, required fields
are non-empty, every row has the same columns, and booleans are real booleans.
Exits non-zero on a problem.

## Import order

Import these **after** `01`–`14` (the habit tables, already live) and in this
order, because the campaign children reference their parent by `campaign_key`:

| # | File | Rows |
|---|---|---|
| 15 | `15-friendships.rows.json` | 5 |
| 16 | `16-campaigns.rows.json` | 10 |
| 17 | `17-campaign-participants.rows.json` | 7 |
| 18 | `18-campaign-rule-versions.rows.json` | 3 |
| 19 | `19-campaign-reports.rows.json` | 6 |
| 20 | `20-campaign-pledges.rows.json` | 4 |
| 21 | `21-campaign-settlements.rows.json` | 6 |
| 22 | `22-campaign-events.rows.json` | 24 |
| 23 | `23-daily-content.rows.json` | 14 |
| 24 | `24-level-records.rows.json` | 6 |
| 25 | `25-challenge-templates.rows.json` | 8 |

## Two auth types — this is the thing that trips people up

Baserow has two kinds of credential, and the one in `environment.ts` is the
weaker of them:

| | Database token (what we have) | JWT (user login) |
|---|---|---|
| Read/write **rows** | ✅ | ✅ |
| Read **fields** | ✅ | ✅ |
| **Create tables / fields** | ❌ 401 | ✅ |

Verified against `db.jollycares.com`: `GET /api/database/fields/table/521/`
returns 200, `POST /api/database/tables/database/128/` returns 401.

So **tables and fields must be created in the UI** (or by a script that logs in
for a JWT). Once a table exists, `import-rows.js` loads the rows with the token
we already have.

## How to import

1. In Baserow: **Create table → Import a file → JSON**, paste or upload the file.
2. Name the table exactly as the schema's `table_name` (e.g. `campaign_events`).
3. Baserow creates every column as **text**. Convert the ones that need it:
   - `single_select` fields — convert the field type; Baserow offers to create
     the options from the existing values. Because every option is present in
     the data, you get the complete list in one go.
   - `boolean`, `number`, `date`, `date_time`, `url` — convert per the spec file.
4. **After** all tables exist, add the `link` fields listed in each spec
   (`campaign_id`, `participant_id`, `pledge_id`) and populate them from the
   `campaign_key` column. They are deliberately absent from the import data —
   a link field cannot be created by an import, and including it would force
   the tables to be imported in a strict order.
5. Record each table's numeric id in `src/environments/environment.ts` under
   `baserow.tables`. They all ship as `0`, and the services no-op with a console
   warning until real ids are filled in.

### Loading rows into a table that already exists

Once the table and its fields exist, skip the UI and use the script — it reads
the token from `environment.ts`, batches at 200 rows, and checks your columns
against the table's real fields first.

```bash
cd database-schemas/baserow-import

# Always dry-run first. Sends nothing.
node import-rows.js --table 531 --file 23-daily-content.rows.json --dry-run

# Then for real
node import-rows.js --table 531 --file 23-daily-content.rows.json
```

The dry run reports three things worth knowing before you commit:

- **Columns that would be dropped** — Baserow silently ignores keys that don't
  match a field, so a typo otherwise looks like a clean import. The script
  refuses to run for real while any exist.
- **Table fields with no data** in the file.
- **Select values not yet defined on the field** — Baserow rejects unknown
  options, so add them to the field first.

⚠ There is no transaction across batches. If batch 3 of 5 fails, the first two
are already written; delete them before retrying or you get duplicates. The
error message tells you how many landed.

## Things worth knowing

- **Users are not a Baserow table.** They live in Xano. Every user reference here
  is a plain text field holding the Xano id as a string — never a link field.
- **`campaign_key` is duplicated onto every child row** on purpose. Baserow's
  link-row filter needs a numeric parent id, which a client may not have during
  optimistic creation; filtering on `campaign_key` always works.
- **`level_records` is append-only.** Rows are never edited or deleted; a
  mistaken award is corrected with a compensating `manual` row. The
  `level_before`/`level_after` pair forms a chain the app checks on load.
- **`challenge_templates` is not authoritative.** The catalogue in
  `src/app/config/challenge-catalogue.seed.ts` is. Level values drive permanent
  awards, so they are version-pinned in the bundle where they get code review.
  This table is for copy edits and previewing, not for changing payouts.
- **The sample data is illustrative, not seed data you want in production.** It
  references users 1–5 and fictional campaigns. Clear it once the field types
  are set, or import into a scratch table first and recreate the fields clean.
- **The API token is client-side.** Anything in these tables can be read and
  written by any user of the app. Do not put anything sensitive here, and see
  the `notes` in `../22-campaign-events.json` and `../24-level-records.json`
  before attaching value to a level or a settlement.
