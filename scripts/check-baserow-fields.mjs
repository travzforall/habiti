#!/usr/bin/env node
/**
 * Does the code write columns the tables actually have?
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Baserow, with `user_field_names=true`, IGNORES a field name it does not
 * recognise. It does not 400, it does not warn: the row is written without that
 * column and the request returns 200.
 *
 * So when `fromProject` wrote `name` at a table whose column is `title`, every
 * save succeeded and every project on the server had a null title. Nine rows,
 * no error, nothing in the logs. Task completion went the same way — written as
 * a `status` select at a table with a `completed` boolean — so ticking a task
 * simply did not persist, and the bug survived a typecheck, a lint, 653 unit
 * tests and a production build.
 *
 * A browser spec cannot catch this: it can check the mappers agree with a list
 * of column names in the source, but not that the list matches the table. This
 * script closes that last link by reading the schema JSON in database-schemas/,
 * which is what the table was created from.
 *
 * ── WHAT IT CHECKS ────────────────────────────────────────────────────────
 *
 * For each pairing below: every column name declared in the mapper source must
 * exist as a field in the schema file. The reverse is NOT an error — a column
 * the app does not use yet is fine.
 *
 * It reads the source as TEXT rather than importing it, for the same reason
 * check-legal.mjs does: these are .ts files and this is a plain node script.
 *
 * Usage:  node scripts/check-baserow-fields.mjs      # exits 1 on a mismatch
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * `pending` lists columns the app writes that the LIVE table does not have yet
 * — they are in the schema file, but `add-baserow-field.mjs` (which needs a
 * user JWT) has not been run. Writing them is harmless because of the very
 * behaviour described above, and they are listed here so the gap is visible
 * rather than folklore.
 *
 * A hand-maintained list of what is missing from a database goes stale the
 * moment someone adds a column — this one claimed `status`, `progress_pct`,
 * `milestone_id` and `type` were missing for weeks after they existed. So when
 * a `table` id is given and the network is there, the list is CHECKED against
 * the live row shape and a wrong claim fails the build. Offline, it is simply
 * skipped: this must not be the reason a build fails on a train.
 */
const PAIRINGS = [
  {
    label: 'user_tasks (631)',
    schema: 'database-schemas/28-user-tasks.json',
    source: 'apps/habiti/src/app/models/task-row.models.ts',
    constant: 'USER_TASK_COLUMNS',
    table: 631,
    pending: []
  },
  {
    label: 'user_projects (630)',
    schema: 'database-schemas/27-user-projects.json',
    source: 'apps/habiti/src/app/models/task-row.models.ts',
    constant: 'USER_PROJECT_COLUMNS',
    table: 630,
    pending: []
  },
  {
    label: 'task_attachments (31)',
    schema: 'database-schemas/31-task-attachments.json',
    source: 'apps/habiti/src/app/models/attachment-row.models.ts',
    constant: 'ATTACHMENT_COLUMNS',
    pending: []
  },
  {
    label: 'inspiration_items (33)',
    schema: 'database-schemas/33-inspiration-items.json',
    source: 'apps/habiti/src/app/models/inspiration.models.ts',
    constant: 'INSPIRATION_COLUMNS',
    pending: []
  },
  {
    label: 'mind_maps (34)',
    schema: 'database-schemas/34-mind-maps.json',
    source: 'apps/habiti/src/app/models/mind-map.models.ts',
    constant: 'MIND_MAP_COLUMNS',
    pending: []
  },
  {
    label: 'mind_map_nodes (35)',
    schema: 'database-schemas/35-mind-map-nodes.json',
    source: 'apps/habiti/src/app/models/mind-map.models.ts',
    constant: 'MIND_MAP_NODE_COLUMNS',
    pending: []
  },
  {
    label: 'project_milestones (638)',
    schema: 'database-schemas/36-project-milestones.json',
    source: 'apps/habiti/src/app/models/milestone-row.models.ts',
    constant: 'MILESTONE_COLUMNS',
    table: 638,
    pending: []
  },
  {
    label: 'project_items (639)',
    schema: 'database-schemas/37-project-items.json',
    source: 'apps/habiti/src/app/models/budget.models.ts',
    constant: 'PROJECT_ITEM_COLUMNS',
    table: 639,
    pending: []
  },
  {
    label: 'project_expenses (640)',
    schema: 'database-schemas/38-project-expenses.json',
    source: 'apps/habiti/src/app/models/budget.models.ts',
    constant: 'PROJECT_EXPENSE_COLUMNS',
    table: 640,
    pending: []
  },
  {
    label: 'project_plans (641)',
    schema: 'database-schemas/39-project-plans.json',
    source: 'apps/habiti/src/app/models/plan.models.ts',
    constant: 'PROJECT_PLAN_COLUMNS',
    table: 641,
    pending: []
  },
  {
    label: 'project_tools (40)',
    schema: 'database-schemas/40-project-tools.json',
    source: 'apps/habiti/src/app/models/tool.models.ts',
    constant: 'PROJECT_TOOL_COLUMNS',
    pending: []
  },
  {
    label: 'user_supplies (41)',
    schema: 'database-schemas/41-user-supplies.json',
    source: 'apps/habiti/src/app/models/supply.models.ts',
    constant: 'USER_SUPPLY_COLUMNS',
    pending: []
  },
  {
    label: 'task_checklist_items (32)',
    schema: 'database-schemas/32-task-checklist-items.json',
    source: 'apps/habiti/src/app/models/attachment-row.models.ts',
    constant: 'CHECKLIST_COLUMNS',
    pending: []
  }
];

/** Pulls the string literals out of `export const NAME = [ ... ] as const;`. */
function readColumnConstant(source, constant) {
  const match = source.match(new RegExp(`export const ${constant} = \\[([\\s\\S]*?)\\]`));
  if (!match) return null;
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

/**
 * The live column names, or null when they cannot be read.
 *
 * Read from a row rather than the fields endpoint, which needs a user JWT the
 * database token cannot stand in for. An empty table therefore tells us
 * nothing — null, not "no columns", so an empty table never invents failures.
 */
async function liveColumns(table) {
  const api = fromEnvironment(/apiUrl:\s*'([^']+)'/);
  const token = fromEnvironment(/token:\s*'([^']+)'/);
  if (!api || !token) return null;

  try {
    const response = await fetch(`${api}/${table}/?user_field_names=true&size=1`, {
      headers: { Authorization: `Token ${token}` },
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) return null;

    const { results } = await response.json();
    if (!results?.length) return null;

    // Baserow's own bookkeeping is not a column the app can write.
    return Object.keys(results[0]).filter(key => key !== 'id' && key !== 'order');
  } catch {
    return null;
  }
}

function fromEnvironment(pattern) {
  try {
    const source = readFileSync(join(ROOT, 'apps/habiti/src/environments/environment.ts'), 'utf8');
    return source.match(pattern)?.[1] ?? null;
  } catch {
    return null;
  }
}

let failures = 0;
let checked = 0;

for (const pairing of PAIRINGS) {
  const schema = JSON.parse(readFileSync(join(ROOT, pairing.schema), 'utf8'));
  const source = readFileSync(join(ROOT, pairing.source), 'utf8');

  const columns = readColumnConstant(source, pairing.constant);
  if (!columns) {
    console.error(`✗ ${pairing.label}: ${pairing.constant} not found in ${pairing.source}`);
    failures++;
    continue;
  }

  const fields = Object.keys(schema.fields ?? {});
  const missing = columns.filter(column => !fields.includes(column));

  if (missing.length > 0) {
    console.error(
      `✗ ${pairing.label}: the app writes ${missing.map(m => `\`${m}\``).join(', ')}, ` +
        `which ${schema.table_name} does not have. Baserow would DROP these silently.`
    );
    failures++;
  } else {
    const pending = pairing.pending.length
      ? ` (pending in the live table: ${pairing.pending.join(', ')})`
      : '';
    console.log(`✓ ${pairing.label}: ${columns.length} columns all exist${pending}`);

    // Is the `pending` note still true? Only askable when the table is reachable.
    const live = pairing.table ? await liveColumns(pairing.table) : null;
    if (live) {
      const actuallyMissing = columns.filter(column => !live.includes(column));
      const claimed = [...pairing.pending].sort().join(',');
      const actual = [...actuallyMissing].sort().join(',');

      if (claimed !== actual) {
        console.error(
          `✗ ${pairing.label}: the pending list is out of date. ` +
            `It says [${claimed || 'nothing'}] but the live table is missing ` +
            `[${actual || 'nothing'}]. Update PAIRINGS in this file.`
        );
        failures++;
      }
    }
  }
  checked++;
}

if (failures > 0) {
  console.error(`\n${failures} mismatch(es). Fix the mapper or the schema before shipping.`);
  process.exit(1);
}

console.log(`\nAll ${checked} table mappings match their schema.`);
