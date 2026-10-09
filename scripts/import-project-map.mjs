#!/usr/bin/env node
/**
 * Imports a real mind map — and the projects and tasks inside it — from a
 * structure written here.
 *
 * ── HOW THIS DIFFERS FROM seed-demo-data.mjs ──────────────────────────────
 *
 * That one makes DEMO data and tags every row `seed`, so `--reset` can find
 * and delete it. This one imports work someone actually intends to do, so:
 *
 *   - nothing is tagged `seed`, and the demo reset can never touch it;
 *   - it is idempotent BY TITLE — a project, task, map or node that is already
 *     there is left exactly as it is, edits included.
 *
 * That second rule is the important one. Re-running must never overwrite a due
 * date someone set by hand, and must never create a second "Chimney".
 *
 *   node scripts/import-project-map.mjs            # dry run
 *   node scripts/import-project-map.mjs --apply
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENVIRONMENT = join(ROOT, 'apps/habiti/src/environments/environment.ts');

const APPLY = process.argv.includes('--apply');
const userFlag = process.argv.indexOf('--user');
const USER_ID = userFlag !== -1 ? process.argv[userFlag + 1] : '1';

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

// ---------------------------------------------------------------------------
// The map
// ---------------------------------------------------------------------------

/**
 * The house.
 *
 * Each top-level area becomes a PROJECT, and each thing under it a TASK. The
 * deeper nodes — "Missing", "10 bags Quikrete", a video link — stay as map
 * nodes: they are notes about a job, not jobs themselves. Several are materials,
 * and those become items once the item list has somewhere to live.
 */
const MAP_TITLE = 'Projects';

const AREAS = [
  {
    project: 'Outside',
    icon: '🏡',
    colour: '#16a34a',
    side: 'right',
    description: 'Everything outside the walls.',
    tasks: [
      { title: 'Chimney' },
      { title: 'Garden', notes: [{ text: 'Cover' }] },
      { title: 'Fence Around' },
      { title: 'Garage Door Replacement' },
      { title: 'Garage Roof' },
      { title: '4 bed Coverage' },
      { title: 'Clear Trash' }
    ]
  },
  {
    project: 'Upstairs',
    icon: '🪜',
    colour: '#0ea5e9',
    side: 'right',
    description: 'Not scoped yet.',
    tasks: []
  },
  {
    project: 'Downstairs A',
    icon: '🛠️',
    colour: '#8b5cf6',
    side: 'left',
    description: 'The main flat: floors, walls, bathroom, heating.',
    tasks: [
      {
        title: 'Bed',
        notes: [
          { text: 'Missing' },
          { text: 'https://www.youtube.com/watch?v=1biz8_60Aeg', kind: 'link' }
        ]
      },
      { title: 'Wardrobe' },
      {
        title: 'Floors',
        notes: [
          { text: 'Self Level', children: [{ text: 'Missing', children: [{ text: '10 bags Quikrete' }] }] },
          { text: 'Vinyl', children: [{ text: 'Missing', children: [{ text: 'Vinyl' }] }] }
        ]
      },
      { title: 'Stairs' },
      { title: 'Plaster Wall' },
      { title: 'Break wall to redo legally' },
      { title: 'Bathroom Vent' },
      { title: 'Bathroom sliding door' },
      { title: 'AC/Heat' },
      { title: 'Door' }
    ]
  },
  {
    project: 'Downstairs B',
    icon: '🧹',
    colour: '#f59e0b',
    side: 'left',
    description: 'The back.',
    tasks: [{ title: 'Clear at the back' }]
  }
];

// ---------------------------------------------------------------------------

async function rowsOf(table) {
  const response = await fetch(`${API}/${table}/?user_field_names=true&size=200`, {
    headers: { Authorization: `Token ${TOKEN}` }
  });
  if (!response.ok) throw new Error(`GET table ${table} → ${response.status}`);
  return (await response.json()).results;
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

function countNodes() {
  const count = note => 1 + (note.children ?? []).reduce((sum, child) => sum + count(child), 0);
  let total = 1; // the root
  for (const area of AREAS) {
    total += 1;
    for (const task of area.tasks) {
      total += 1;
      total += (task.notes ?? []).reduce((sum, note) => sum + count(note), 0);
    }
  }
  return total;
}

async function run() {
  const taskCount = AREAS.reduce((sum, area) => sum + area.tasks.length, 0);

  console.log(`\n  ${APPLY ? 'IMPORTING' : 'DRY RUN —'} "${MAP_TITLE}" for user_id ${USER_ID}`);
  console.log(`  ${API}\n`);
  for (const area of AREAS) {
    console.log(`    ${area.icon} ${area.project.padEnd(16)} ${area.tasks.length} tasks`);
  }
  console.log(`  ${taskCount} tasks → table ${TASKS_TABLE}`);
  console.log(`  a ${countNodes()}-node map → tables ${MAPS_TABLE}/${MAP_NODES_TABLE}\n`);

  if (!APPLY) {
    console.log('  Nothing was written. Re-run with --apply.\n');
    return;
  }

  const existingProjects = await rowsOf(PROJECTS_TABLE);
  const existingTasks = await rowsOf(TASKS_TABLE);

  const projectIds = {};
  const taskIds = {};

  for (const area of AREAS) {
    const already = existingProjects.find(row => row.title === area.project);
    if (already) {
      projectIds[area.project] = String(already.id);
      console.log(`    = ${area.project} exists (id ${already.id})`);
    } else {
      const row = await createRow(PROJECTS_TABLE, {
        title: area.project,
        user_id: USER_ID,
        description: area.description,
        type: 'home',
        status: 'active',
        priority: 'medium',
        progress: 0,
        color: area.colour,
        icon: area.icon,
        tags: 'house',
        archived: false
      });
      projectIds[area.project] = String(row.id);
      console.log(`    + ${area.project} (id ${row.id})`);
    }

    for (const task of area.tasks) {
      const existing = existingTasks.find(
        row => row.title === task.title && String(row.project_id) === projectIds[area.project]
      );
      if (existing) {
        taskIds[`${area.project}:${task.title}`] = String(existing.id);
        continue;
      }

      const row = await createRow(TASKS_TABLE, {
        title: task.title,
        user_id: USER_ID,
        project_id: projectIds[area.project],
        description: '',
        completed: false,
        status: 'todo',
        priority: 'medium',
        tags: 'house'
      });
      taskIds[`${area.project}:${task.title}`] = String(row.id);
    }
  }

  await buildMap(projectIds, taskIds);
  console.log('\n  Done. Reload the app.\n');
}

async function buildMap(projectIds, taskIds) {
  const existing = await rowsOf(MAPS_TABLE);
  if (existing.some(row => row.title === MAP_TITLE)) {
    console.log(`    = map "${MAP_TITLE}" exists — left alone`);
    return;
  }

  const map = await createRow(MAPS_TABLE, {
    title: MAP_TITLE,
    user_id: USER_ID,
    // The map is about the house as a whole, so it hangs off no single project.
    board: 'personal',
    description: 'The house, area by area.',
    theme: 'default',
    node_count: countNodes(),
    archived: false
  });

  const node = async (data) => createRow(MAP_NODES_TABLE, { user_id: USER_ID, map_id: String(map.id), ...data });

  const root = await node({ title: MAP_TITLE, parent_id: '', side: 'auto', sort_order: 0, kind: 'idea' });

  let made = 1;
  const addNotes = async (notes, parentId) => {
    let order = 1;
    for (const note of notes) {
      const row = await node({
        title: note.text,
        parent_id: String(parentId),
        side: 'auto',
        sort_order: order++,
        kind: note.kind ?? 'note',
        url: note.kind === 'link' ? note.text : ''
      });
      made++;
      await addNotes(note.children ?? [], row.id);
    }
  };

  let areaOrder = 1;
  for (const area of AREAS) {
    const branch = await node({
      title: area.project,
      parent_id: String(root.id),
      side: area.side,
      sort_order: areaOrder++,
      kind: 'idea',
      colour: area.colour,
      icon: area.icon
    });
    made++;

    let taskOrder = 1;
    for (const task of area.tasks) {
      const row = await node({
        title: task.title,
        parent_id: String(branch.id),
        side: 'auto',
        sort_order: taskOrder++,
        kind: 'task',
        task_id: taskIds[`${area.project}:${task.title}`] ?? ''
      });
      made++;
      await addNotes(task.notes ?? [], row.id);
    }
  }

  console.log(`    + map "${MAP_TITLE}" (id ${map.id}, ${made} nodes)`);
}

run().catch(error => {
  console.error(`\n  Failed: ${error.message}\n`);
  process.exit(1);
});
