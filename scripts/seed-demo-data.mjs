#!/usr/bin/env node
/**
 * Fills an account with a realistic project, so the features can be seen
 * working against something other than "First sub task".
 *
 * ── EVERYTHING IS A ROW ───────────────────────────────────────────────────
 *
 * Projects, tasks, milestones, the mind map and its nodes are all rows created
 * over the API, so a seeded account survives a cache clear and looks the same
 * on a second device.
 *
 * It was not always so. Milestones and the map used to be written out as a
 * localStorage snippet to paste into a console, because their tables did not
 * exist. They do now (638, 636, 637), and `npm run db:setup` creates them.
 * Nothing here touches localStorage any more.
 *
 * ── SAFETY ────────────────────────────────────────────────────────────────
 *
 * Dry run by default: it prints what it would create and writes nothing. It
 * only ever ADDS rows — nothing here updates or deletes anything that already
 * exists, so the worst a mistaken run does is leave a project to delete.
 *
 *   node scripts/seed-demo-data.mjs                  # dry run
 *   node scripts/seed-demo-data.mjs --apply          # create it
 *   node scripts/seed-demo-data.mjs --apply --user 6 # for another account
 *   node scripts/seed-demo-data.mjs --apply --reset  # replace an earlier seed
 *   node scripts/seed-demo-data.mjs --apply --reset-only  # remove it and stop
 *   node scripts/seed-demo-data.mjs --apply --map-only  # just the mind map
 *   node scripts/seed-demo-data.mjs --apply --milestones-only  # just milestones
 *
 * --reset deletes only rows tagged `seed`, which nothing but this script
 * writes. Hand-made rows are never touched.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENVIRONMENT = join(ROOT, 'apps/habiti/src/environments/environment.ts');

const APPLY = process.argv.includes('--apply');
const RESET = process.argv.includes('--reset') || process.argv.includes('--reset-only');
/** `--reset` on its own removes the seed and stops; with nothing else it does not re-create it. */
const ONLY_RESET = process.argv.includes('--reset-only');
const MAP_ONLY = process.argv.includes('--map-only');
const MILESTONES_ONLY = process.argv.includes('--milestones-only');
const userFlag = process.argv.indexOf('--user');
const USER_ID = userFlag !== -1 ? process.argv[userFlag + 1] : '1';

/**
 * Configuration comes from environment.ts, and a miss is fatal.
 *
 * Reading the source is the same shortcut add-baserow-field.mjs warns about —
 * but its warning is specifically about FALLING BACK to a default when the read
 * fails, which is how you write to the wrong database without noticing. There
 * is no fallback here: a missing value exits.
 */
function fromEnvironment(pattern, name) {
  const source = readFileSync(ENVIRONMENT, 'utf8');
  const match = source.match(pattern);
  if (!match) {
    console.error(`\n  Could not find ${name} in environment.ts. Nothing was written.\n`);
    process.exit(1);
  }
  return match[1];
}

const API = fromEnvironment(/apiUrl:\s*'([^']+)'/, 'baserow.apiUrl');
const TOKEN = fromEnvironment(/token:\s*'([^']+)'/, 'baserow.token');
const PROJECTS_TABLE = Number(fromEnvironment(/userProjects:\s*(\d+)/, 'tables.userProjects'));
const TASKS_TABLE = Number(fromEnvironment(/userTasks:\s*(\d+)/, 'tables.userTasks'));
const MAPS_TABLE = Number(fromEnvironment(/mindMaps:\s*(\d+)/, 'tables.mindMaps'));
const MAP_NODES_TABLE = Number(fromEnvironment(/mindMapNodes:\s*(\d+)/, 'tables.mindMapNodes'));
const MILESTONES_TABLE = Number(
  fromEnvironment(/projectMilestones:\s*(\d+)/, 'tables.projectMilestones')
);

// ---------------------------------------------------------------------------
// The content
// ---------------------------------------------------------------------------

/** Dates are relative to today, so the seed is never stale. */
const today = new Date();
const day = (offset) => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const PROJECTS = [
  {
    key: 'plus',
    title: 'Launch Habiti Plus',
    type: 'business',
    icon: '🚀',
    colour: '#8b5cf6',
    description: 'Paid tier: payments, the upgrade path, and telling people about it.',
    status: 'active',
    priority: 'high',
    start: day(-45),
    due: day(75),
    milestones: [
      { key: 'foundations', title: 'Foundations', start: day(-45), target: day(-5), colour: '#0ea5e9', status: 'done', done: true, owner: 'Travon', dod: 'Payments working end to end in test' },
      { key: 'mvp', title: 'MVP Release', start: day(-4), target: day(30), colour: '#8b5cf6', status: 'active', owner: 'Travon', dod: 'A stranger can pay and get the features', waitsFor: ['foundations'] },
      { key: 'launch', title: 'First launch', start: day(31), target: day(72), colour: '#f59e0b', status: 'planned', dod: 'Announced, and the first ten paying users are in', waitsFor: ['mvp'] }
    ],
    tasks: [
      { key: 'stripe', title: 'Wire up Stripe checkout', milestone: 'foundations', due: day(-30), done: true, status: 'done', hours: [6, 7], priority: 'high', tags: 'payments' },
      { key: 'webhooks', title: 'Handle payment webhooks', milestone: 'foundations', due: day(-18), done: true, status: 'done', hours: [4, 5.5], priority: 'high', tags: 'payments', waitsFor: ['stripe'] },
      { key: 'gate', title: 'Gate the paid features behind the plan', milestone: 'mvp', due: day(6), status: 'in_progress', hours: [5, 2], priority: 'high', tags: 'payments', waitsFor: ['webhooks'] },
      { key: 'upgrade', title: 'Build the upgrade screen', milestone: 'mvp', due: day(12), status: 'todo', hours: [4], priority: 'medium', tags: 'ui', waitsFor: ['gate'] },
      { key: 'receipts', title: 'Email receipts', milestone: 'mvp', due: day(20), status: 'blocked', hours: [3], priority: 'medium', tags: 'payments,email' },
      { key: 'pricing', title: 'Decide the pricing', milestone: 'mvp', due: day(-2), status: 'todo', priority: 'urgent', tags: 'decision' },
      { key: 'beta', title: 'Run a two-week beta', milestone: 'launch', due: day(45), status: 'todo', hours: [10], priority: 'high', waitsFor: ['upgrade'] },
      { key: 'post', title: 'Write the launch post', milestone: 'launch', due: day(60), status: 'todo', hours: [3], priority: 'medium', tags: 'writing' },
      { key: 'listing', title: 'Update the app store listing', milestone: 'launch', due: day(66), status: 'todo', hours: [2], priority: 'low' }
    ]
  },
  {
    key: 'kitchen',
    title: 'Kitchen refit',
    type: 'home',
    icon: '🏠',
    colour: '#0ea5e9',
    description: 'Two weekends. It will not be two weekends.',
    status: 'active',
    priority: 'medium',
    start: day(-20),
    due: day(50),
    milestones: [
      { key: 'design', title: 'Design and quotes', start: day(-20), target: day(4), colour: '#0ea5e9', status: 'at_risk', owner: 'Me', dod: 'Three quotes in, one chosen' },
      { key: 'strip', title: 'Strip out', start: day(8), target: day(20), colour: '#f59e0b', status: 'planned', waitsFor: ['design'] },
      { key: 'fit', title: 'Fit and finish', start: day(21), target: day(48), colour: '#16a34a', status: 'planned', waitsFor: ['strip'] }
    ],
    tasks: [
      { key: 'measure', title: 'Measure everything twice', milestone: 'design', due: day(-14), done: true, status: 'done', hours: [2, 3] },
      { key: 'quotes', title: 'Get three quotes', milestone: 'design', due: day(-1), status: 'in_progress', priority: 'high', waitsFor: ['measure'] },
      { key: 'choose', title: 'Choose a fitter', milestone: 'design', due: day(3), status: 'todo', priority: 'high', waitsFor: ['quotes'] },
      { key: 'skip', title: 'Book the skip', milestone: 'strip', due: day(9), status: 'todo', priority: 'medium', waitsFor: ['choose'] },
      { key: 'appliances', title: 'Order the appliances', milestone: 'strip', due: day(14), status: 'todo', priority: 'medium', hours: [1] },
      { key: 'tiles', title: 'Pick tiles', milestone: 'fit', due: day(30), status: 'todo', priority: 'low' }
    ]
  },
  {
    key: 'cert',
    title: 'AWS certification',
    type: 'study',
    icon: '📚',
    colour: '#f59e0b',
    description: 'Solutions Architect Associate, before the voucher expires.',
    status: 'planning',
    priority: 'medium',
    start: day(-10),
    due: day(90),
    milestones: [
      { key: 'plan', title: 'Study plan', start: day(-10), target: day(2), colour: '#f59e0b', status: 'active', dod: 'A week-by-week plan I will actually follow' },
      { key: 'practice', title: 'Practice exams', start: day(20), target: day(70), colour: '#8b5cf6', status: 'planned', waitsFor: ['plan'] },
      { key: 'exam', title: 'Sit the exam', target: day(88), colour: '#16a34a', status: 'planned', waitsFor: ['practice'] }
    ],
    tasks: [
      { key: 'syllabus', title: 'Read the exam guide', milestone: 'plan', due: day(-3), done: true, status: 'done', hours: [1, 1] },
      { key: 'schedule', title: 'Block out study evenings', milestone: 'plan', due: day(1), status: 'todo', priority: 'high' },
      { key: 'mock1', title: 'First mock exam', milestone: 'practice', due: day(28), status: 'todo', hours: [3], waitsFor: ['schedule'] },
      { key: 'weak', title: 'Drill the weak areas', milestone: 'practice', due: day(55), status: 'todo', hours: [8], waitsFor: ['mock1'] },
      { key: 'book', title: 'Book the exam slot', milestone: 'exam', due: day(75), status: 'todo', priority: 'high' }
    ]
  }
];

/** Tasks that belong to no project at all. */
const STANDALONE = [
  { title: 'Call the insurance company', due: day(-2), priority: 'urgent', tags: 'admin', hours: [0.5] },
  { title: 'Dentist — six month check', due: day(9), priority: 'low', tags: 'health' },
  { title: 'Renew the passport', due: day(21), priority: 'high', tags: 'admin', hours: [1] },
  { title: 'Grocery shop', due: day(1), priority: 'low', tags: 'home' },
  { title: 'Fix the bike puncture', due: day(4), priority: 'medium', tags: 'home' },
  { title: 'Read the chapter on TCP', status: 'in_progress', due: day(6), priority: 'low', tags: 'learning', hours: [2, 0.5] }
];

/**
 * The mind map: four levels, and some of it real work.
 *
 * Nodes marked with `task` point at a task created above, so the map shows
 * status stripes and "turn this branch into tasks" has something to do.
 */
const MAP = {
  title: 'Launch Habiti Plus — thinking',
  board: 'plus',
  root: 'Habiti Plus',
  branches: [
    {
      text: 'Positioning', side: 'right', colour: '#8b5cf6',
      children: [
        { text: 'Who is it for?', children: [
          { text: 'People already tracking habits' },
          { text: 'People who bounced off Notion' }
        ]},
        { text: 'Pricing', children: [
          { text: '£4 a month', children: [{ text: 'Cheaper than a coffee' }] },
          { text: '£36 a year' },
          { text: 'Decide the pricing', task: 'pricing' }
        ]}
      ]
    },
    {
      text: 'Build', side: 'right', colour: '#0ea5e9',
      children: [
        { text: 'Payments', children: [
          { text: 'Wire up Stripe checkout', task: 'stripe' },
          { text: 'Handle payment webhooks', task: 'webhooks' },
          { text: 'Email receipts', task: 'receipts' }
        ]},
        { text: 'Entitlements', children: [
          { text: 'Gate the paid features behind the plan', task: 'gate' },
          { text: 'What happens when they stop paying?', children: [
            { text: 'Keep the data, lock the features' }
          ]}
        ]}
      ]
    },
    {
      text: 'Launch', side: 'left', colour: '#f59e0b',
      children: [
        { text: 'Run a two-week beta', task: 'beta' },
        { text: 'Write the launch post', task: 'post' },
        { text: 'Where to announce', children: [
          { text: 'The mailing list' },
          { text: 'One forum, not ten' }
        ]}
      ]
    },
    {
      text: 'Risks', side: 'left', colour: '#ef4444',
      children: [
        { text: 'Nobody pays', children: [{ text: 'Ask ten people first' }] },
        { text: 'Support load', children: [{ text: 'One inbox, answered daily' }] }
      ]
    }
  ]
};

// ---------------------------------------------------------------------------

/**
 * Deletes ONLY what this script created.
 *
 * Every seeded row carries a `seed` tag, and nothing else does — so the match
 * is exact rather than "everything in the table". Hand-made rows are invisible
 * to this, which is the point: re-seeding while building must never be able to
 * take real work with it.
 */
async function rowsOf(table) {
  const response = await fetch(`${API}/${table}/?user_field_names=true&size=200`, {
    headers: { Authorization: `Token ${TOKEN}` }
  });
  if (!response.ok) throw new Error(`GET table ${table} → ${response.status}`);
  return (await response.json()).results;
}

async function deleteRow(table, id) {
  const gone = await fetch(`${API}/${table}/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Token ${TOKEN}` }
  });
  if (!gone.ok) throw new Error(`DELETE ${table}/${id} → ${gone.status}`);
}

/**
 * Removes everything a previous run created — including the things that carry
 * no tag.
 *
 * Milestones and map nodes have no `tags` column to mark, so they are found by
 * what they hang off: a milestone by its project, a node by its map. Tasks and
 * projects are found by the `seed` tag, which nothing but this script writes.
 * Anything made by hand is invisible to all of it.
 */
async function resetSeed() {
  const projects = (await rowsOf(PROJECTS_TABLE)).filter(row => tagged(row));
  const projectIds = new Set(projects.map(row => String(row.id)));

  const tasks = (await rowsOf(TASKS_TABLE)).filter(row => tagged(row));

  const milestones = MILESTONES_TABLE
    ? (await rowsOf(MILESTONES_TABLE)).filter(row => projectIds.has(String(row.project_id)))
    : [];

  const maps = MAPS_TABLE
    ? (await rowsOf(MAPS_TABLE)).filter(
        row => row.title === MAP.title || projectIds.has(String(row.board))
      )
    : [];
  const mapIds = new Set(maps.map(row => String(row.id)));
  const nodes = MAP_NODES_TABLE
    ? (await rowsOf(MAP_NODES_TABLE)).filter(row => mapIds.has(String(row.map_id)))
    : [];

  // Children before parents, so nothing is orphaned if this stops halfway.
  for (const row of nodes) await deleteRow(MAP_NODES_TABLE, row.id);
  for (const row of maps) await deleteRow(MAPS_TABLE, row.id);
  for (const row of milestones) await deleteRow(MILESTONES_TABLE, row.id);
  for (const row of tasks) await deleteRow(TASKS_TABLE, row.id);
  for (const row of projects) await deleteRow(PROJECTS_TABLE, row.id);

  console.log(
    `    - removed ${projects.length} projects, ${tasks.length} tasks, ` +
      `${milestones.length} milestones, ${maps.length} map(s) and ${nodes.length} nodes\n`
  );
}

function tagged(row) {
  return String(row.tags ?? '')
    .split(',')
    .map(tag => tag.trim())
    .includes('seed');
}

async function deleteSeeded(table) {
  const response = await fetch(`${API}/${table}/?user_field_names=true&size=200`, {
    headers: { Authorization: `Token ${TOKEN}` }
  });
  if (!response.ok) throw new Error(`GET table ${table} → ${response.status}`);
  const { results } = await response.json();

  const mine = results.filter(row =>
    String(row.tags ?? '')
      .split(',')
      .map(tag => tag.trim())
      .includes('seed')
  );

  for (const row of mine) {
    const gone = await fetch(`${API}/${table}/${row.id}/`, {
      method: 'DELETE',
      headers: { Authorization: `Token ${TOKEN}` }
    });
    if (!gone.ok) throw new Error(`DELETE ${table}/${row.id} → ${gone.status}`);
  }
  return mine.length;
}

async function createRow(table, data) {
  const response = await fetch(`${API}/${table}/?user_field_names=true`, {
    method: 'POST',
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`POST table ${table} → ${response.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function updateRow(table, id, data) {
  const response = await fetch(`${API}/${table}/${id}/?user_field_names=true`, {
    method: 'PATCH',
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    throw new Error(`PATCH ${table}/${id} → ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

let localId = 0;
const nextLocalId = () => `seed${Date.now().toString(36)}${(localId++).toString(36)}`;

/**
 * Creates the map and its nodes as rows.
 *
 * A node stores its parent's ROW ID, which only exists once the parent has been
 * created — so this walks down the tree a level at a time rather than firing
 * everything off at once. Slower, and the only order that can work.
 */
async function createMap(projectIds, taskIds) {
  if (!MAPS_TABLE || !MAP_NODES_TABLE) {
    console.log('    ! mindMaps / mindMapNodes are 0 in environment.ts — map skipped');
    return null;
  }

  const existing = await fetch(`${API}/${MAPS_TABLE}/?user_field_names=true&size=200`, {
    headers: { Authorization: `Token ${TOKEN}` }
  }).then(response => (response.ok ? response.json() : { results: [] }));

  if (existing.results.some(row => row.title === MAP.title)) {
    console.log(`    = mind map "${MAP.title}" already exists — skipped`);
    return null;
  }

  const map = await createRow(MAPS_TABLE, {
    title: MAP.title,
    user_id: USER_ID,
    board: projectIds[MAP.board],
    description: 'Seeded by scripts/seed-demo-data.mjs',
    theme: 'default',
    node_count: countNodes(MAP),
    archived: false
  });

  const root = await createRow(MAP_NODES_TABLE, {
    title: MAP.root,
    user_id: USER_ID,
    map_id: String(map.id),
    parent_id: '',
    side: 'auto',
    sort_order: 0,
    collapsed: false,
    kind: 'idea'
  });

  let created = 1;
  const addChildren = async (children, parentRowId, side, depth) => {
    let order = 1;
    for (const child of children) {
      const row = await createRow(MAP_NODES_TABLE, {
        title: child.text,
        user_id: USER_ID,
        map_id: String(map.id),
        parent_id: String(parentRowId),
        // Only the first ring picks a side; everything below inherits it.
        side: depth === 1 ? side : 'auto',
        sort_order: order++,
        collapsed: false,
        kind: child.task ? 'task' : 'idea',
        task_id: child.task ? taskIds[child.task] : '',
        colour: child.colour ?? ''
      });
      created++;
      await addChildren(child.children ?? [], row.id, side, depth + 1);
    }
  };

  for (const [index, branch] of MAP.branches.entries()) {
    await addChildren([branch], root.id, branch.side, 1);
    void index;
  }

  console.log(`    + mind map "${MAP.title}" (id ${map.id}, ${created} nodes)`);
  return map;
}

/**
 * Rebuilds the ids from rows that already exist, so the paste file can be
 * re-emitted without writing anything.
 *
 * Every milestone has at least one task, and each task row carries its
 * `milestone_id` — so the whole id map is recoverable from the server. Nothing
 * about the seed lives only in the last run's memory.
 */
/**
 * Creates the milestones as rows, and repoints everything that named them.
 *
 * Their ids were invented by this script when milestones had no table, and the
 * task rows already carry those invented ids. So: create the real row, then
 * rewrite every task's `milestone_id` and every dependency that mentioned the
 * old one. Skipped entirely if the milestone already has a row, so this is safe
 * to run twice.
 */
async function createMilestones(projectIds, taskIds, oldMilestoneIds) {
  if (!MILESTONES_TABLE) {
    console.log('    ! projectMilestones is 0 in environment.ts — run npm run db:setup first');
    return;
  }

  const existing = await fetch(`${API}/${MILESTONES_TABLE}/?user_field_names=true&size=200`, {
    headers: { Authorization: `Token ${TOKEN}` }
  }).then(response => (response.ok ? response.json() : { results: [] }));

  const realIds = {};
  let made = 0;

  for (const project of PROJECTS) {
    for (const [index, milestone] of project.milestones.entries()) {
      const key = `${project.key}:${milestone.key}`;
      const already = existing.results.find(
        row => row.title === milestone.title && String(row.project_id) === projectIds[project.key]
      );

      if (already) {
        realIds[key] = String(already.id);
        continue;
      }

      const row = await createRow(MILESTONES_TABLE, {
        title: milestone.title,
        user_id: USER_ID,
        project_id: projectIds[project.key],
        description: '',
        start_date: milestone.start ?? null,
        target_date: milestone.target,
        completed: !!milestone.done,
        status: milestone.status,
        owner: milestone.owner ?? '',
        definition_of_done: milestone.dod ?? '',
        colour: milestone.colour,
        sort_order: index + 1,
        progress: 0,
        depends_on: ''
      });
      realIds[key] = String(row.id);
      made++;
    }
  }

  // Prerequisites, once every milestone has a real id to point at.
  for (const project of PROJECTS) {
    for (const milestone of project.milestones) {
      if (!milestone.waitsFor?.length) continue;
      await updateRow(MILESTONES_TABLE, realIds[`${project.key}:${milestone.key}`], {
        depends_on: milestone.waitsFor.map(key => realIds[`${project.key}:${key}`]).join(',')
      });
    }
  }

  // The tasks named the invented ids. Move them onto the real ones, and write
  // the task chains now that depends_on exists.
  let moved = 0;
  for (const project of PROJECTS) {
    for (const task of project.tasks) {
      const data = {};
      if (task.milestone) {
        const real = realIds[`${project.key}:${task.milestone}`];
        const old = oldMilestoneIds[`${project.key}:${task.milestone}`];
        if (real && real !== old) data.milestone_id = real;
      }
      if (task.waitsFor?.length) {
        data.depends_on = task.waitsFor.map(key => taskIds[key]).join(',');
      }
      if (Object.keys(data).length === 0) continue;

      await updateRow(TASKS_TABLE, taskIds[task.key], data);
      moved++;
    }
  }

  console.log(`    + ${made} milestone rows, ${moved} tasks repointed`);
}

async function recoverIds() {
  const get = async (table) => {
    const response = await fetch(`${API}/${table}/?user_field_names=true&size=200`, {
      headers: { Authorization: `Token ${TOKEN}` }
    });
    if (!response.ok) throw new Error(`GET table ${table} → ${response.status}`);
    return (await response.json()).results;
  };

  const projectRows = await get(PROJECTS_TABLE);
  const taskRows = await get(TASKS_TABLE);

  const projectIds = {};
  const taskIds = {};
  const milestoneIds = {};

  for (const project of PROJECTS) {
    const row = projectRows.find(candidate => candidate.title === project.title);
    if (!row) throw new Error(`No project row named "${project.title}". Run --apply first.`);
    projectIds[project.key] = String(row.id);

    for (const task of project.tasks) {
      const taskRow = taskRows.find(
        candidate => candidate.title === task.title && String(candidate.project_id) === String(row.id)
      );
      if (!taskRow) throw new Error(`No task row named "${task.title}".`);
      taskIds[task.key] = String(taskRow.id);

      if (task.milestone && taskRow.milestone_id) {
        milestoneIds[`${project.key}:${task.milestone}`] = taskRow.milestone_id;
      }
    }

    for (const milestone of project.milestones) {
      if (!milestoneIds[`${project.key}:${milestone.key}`]) {
        throw new Error(`Could not recover the id for milestone "${milestone.title}".`);
      }
    }
  }

  return { projectIds, taskIds, milestoneIds };
}

async function run() {
  const taskCount = PROJECTS.reduce((sum, p) => sum + p.tasks.length, 0) + STANDALONE.length;
  const milestoneCount = PROJECTS.reduce((sum, p) => sum + p.milestones.length, 0);
  const nodeCount = countNodes(MAP);

  console.log(`\n  ${APPLY ? 'CREATING' : 'DRY RUN —'} demo data for user_id ${USER_ID}`);
  console.log(`  ${API}\n`);
  console.log(`  ${PROJECTS.length} projects → table ${PROJECTS_TABLE}`);
  for (const project of PROJECTS) {
    console.log(`    ${project.icon} ${project.title.padEnd(22)} ${project.tasks.length} tasks, ${project.milestones.length} milestones`);
  }
  console.log(`  ${taskCount} tasks → table ${TASKS_TABLE} (${STANDALONE.length} standalone)`);
  console.log(`  a ${nodeCount}-node mind map → tables ${MAPS_TABLE}/${MAP_NODES_TABLE}`);
  console.log(`  ${milestoneCount} milestones → table ${MILESTONES_TABLE}\n`);

  /**
   * The partial runs: each one recovers the ids from rows that already exist,
   * so a piece can be redone without creating a second copy of everything.
   */
  if (MILESTONES_ONLY || MAP_ONLY) {
    const only = MILESTONES_ONLY ? '--milestones-only' : '--map-only';
    if (!APPLY) {
      console.log(`  Nothing was written. Re-run with --apply ${only}.\n`);
      return;
    }

    const { projectIds, taskIds, milestoneIds } = await recoverIds();
    if (MILESTONES_ONLY) await createMilestones(projectIds, taskIds, milestoneIds);
    if (MAP_ONLY) await createMap(projectIds, taskIds);
    return;
  }

  if (!APPLY) {
    console.log(`  Nothing was written. Re-run with --apply${RESET ? ' --reset' : ''}.\n`);
    return;
  }

  if (RESET) await resetSeed();
  if (RESET && ONLY_RESET) return;

  const projectIds = {};
  const taskIds = {};

  /**
   * Milestone ids are decided here, before anything is written.
   *
   * `milestone_id` DOES exist in the live table, so which milestone a task
   * belongs to is real data on the server — but the milestones themselves are
   * still local. The ids therefore have to be minted first and used by both
   * halves, or the task rows would point at milestones that never get created.
   */
  const milestoneIds = {};
  for (const project of PROJECTS) {
    for (const milestone of project.milestones) {
      milestoneIds[`${project.key}:${milestone.key}`] = nextLocalId();
    }
  }

  for (const project of PROJECTS) {
    const row = await createRow(PROJECTS_TABLE, {
      title: project.title,
      user_id: USER_ID,
      description: project.description,
      type: project.type,
      status: project.status,
      priority: project.priority,
      start_date: project.start,
      due_date: project.due,
      progress: 0,
      color: project.colour,
      icon: project.icon,
      tags: 'seed',
      archived: false
    });
    projectIds[project.key] = String(row.id);
    console.log(`    + project ${project.title} (id ${row.id})`);

    for (const task of project.tasks) {
      const created = await createRow(TASKS_TABLE, {
        title: task.title,
        user_id: USER_ID,
        project_id: projectIds[project.key],
        description: '',
        completed: !!task.done,
        status: task.status ?? 'todo',
        priority: task.priority ?? 'medium',
        due_date: task.due ?? null,
        estimated_hours: task.hours?.[0] ?? null,
        actual_hours: task.hours?.[1] ?? null,
        milestone_id: task.milestone ? milestoneIds[`${project.key}:${task.milestone}`] : '',
        tags: [task.tags, 'seed'].filter(Boolean).join(','),
        assignee: ''
      });
      taskIds[task.key] = String(created.id);
    }
    console.log(`      + ${project.tasks.length} tasks`);
  }

  for (const task of STANDALONE) {
    await createRow(TASKS_TABLE, {
      title: task.title,
      user_id: USER_ID,
      project_id: 'standalone',
      completed: false,
      status: task.status ?? 'todo',
      priority: task.priority ?? 'medium',
      due_date: task.due ?? null,
      estimated_hours: task.hours?.[0] ?? null,
      actual_hours: task.hours?.[1] ?? null,
      tags: [task.tags, 'seed'].filter(Boolean).join(',')
    });
  }
  console.log(`    + ${STANDALONE.length} standalone tasks`);

  await createMilestones(projectIds, taskIds, milestoneIds);
  await createMap(projectIds, taskIds);

  console.log('\n  Done. Everything is on the server — reload the app.\n');
}

function countNodes(map) {
  const count = (branch) => 1 + (branch.children ?? []).reduce((sum, child) => sum + count(child), 0);
  return 1 + map.branches.reduce((sum, branch) => sum + count(branch), 0);
}

run().catch(error => {
  console.error(`\n  Failed: ${error.message}\n`);
  process.exit(1);
});
