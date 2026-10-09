#!/usr/bin/env node
/**
 * Turns a project's tasks into sub-projects of it.
 *
 * The same operation the task page offers, done in bulk for a project that was
 * built as a flat list and turned out to be a set of jobs — "Downstairs A" with
 * ten tasks that are each a project's worth of work.
 *
 * ── WHAT IT CARRIES ───────────────────────────────────────────────────────
 *
 * A new project takes the task's title, description, budget, priority and due
 * date; its items and expenses move over (keeping every figure, so nothing
 * falls out of the roll-up); then the task row is deleted. Anything the task
 * held that is not moved would be orphaned, so it is reported rather than
 * silently left behind.
 *
 * ── SAFETY ────────────────────────────────────────────────────────────────
 *
 * Dry run by default, and it REFUSES a project that is already at the deepest
 * level rather than creating projects that cannot be nested. Deleting the task
 * happens last, after everything it owns has a new home.
 *
 *   node scripts/promote-tasks.mjs 20            # dry run
 *   node scripts/promote-tasks.mjs 20 --apply
 *   node scripts/promote-tasks.mjs 20 --apply --only "Floors,Stairs"
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENVIRONMENT = join(ROOT, 'apps/habiti/src/environments/environment.ts');

const APPLY = process.argv.includes('--apply');
const PROJECT_ID = process.argv[2];
const onlyFlag = process.argv.indexOf('--only');
const ONLY = onlyFlag !== -1 ? process.argv[onlyFlag + 1].split(',').map(t => t.trim()) : null;

if (!PROJECT_ID || PROJECT_ID.startsWith('--')) {
  console.error('\n  Usage: node scripts/promote-tasks.mjs <projectId> [--apply] [--only "A,B"]\n');
  process.exit(1);
}

function fromEnvironment(pattern, name) {
  const match = readFileSync(ENVIRONMENT, 'utf8').match(pattern);
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
const ITEMS_TABLE = Number(fromEnvironment(/projectItems:\s*(\d+)/, 'tables.projectItems'));
const EXPENSES_TABLE = Number(fromEnvironment(/projectExpenses:\s*(\d+)/, 'tables.projectExpenses'));

const MAX_DEPTH = 3;

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
  if (!response.ok) throw new Error(`POST ${table} → ${response.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function patchRow(table, id, data) {
  const response = await fetch(`${API}/${table}/${id}/?user_field_names=true`, {
    method: 'PATCH',
    headers: { Authorization: `Token ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`PATCH ${table}/${id} → ${response.status}`);
}

async function deleteRow(table, id) {
  const response = await fetch(`${API}/${table}/${id}/`, {
    method: 'DELETE',
    headers: { Authorization: `Token ${TOKEN}` }
  });
  if (!response.ok) throw new Error(`DELETE ${table}/${id} → ${response.status}`);
}

/** How deep a project sits, counting from 1. Mirrors config/project-tree.ts. */
function depthOf(project, byId) {
  let depth = 1;
  let current = project.parent_id ? byId.get(String(project.parent_id)) : undefined;
  const seen = new Set([String(project.id)]);

  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    depth++;
    current = current.parent_id ? byId.get(String(current.parent_id)) : undefined;
  }
  return depth;
}

function selectValue(value) {
  return value && typeof value === 'object' ? value.value : value;
}

async function run() {
  const projects = await rowsOf(PROJECTS_TABLE);
  const byId = new Map(projects.map(row => [String(row.id), row]));
  const parent = byId.get(String(PROJECT_ID));

  if (!parent) {
    console.error(`\n  No project with id ${PROJECT_ID}.\n`);
    process.exit(1);
  }

  const depth = depthOf(parent, byId);
  if (depth >= MAX_DEPTH) {
    console.error(
      `\n  "${parent.title}" is already at level ${depth}. Projects go ${MAX_DEPTH} deep,\n` +
        '  so its tasks cannot become sub-projects. Nothing was written.\n'
    );
    process.exit(1);
  }

  const allTasks = await rowsOf(TASKS_TABLE);
  const tasks = allTasks
    .filter(task => String(task.project_id) === String(PROJECT_ID))
    .filter(task => (ONLY ? ONLY.includes(task.title) : true));

  const items = ITEMS_TABLE ? await rowsOf(ITEMS_TABLE) : [];
  const expenses = EXPENSES_TABLE ? await rowsOf(EXPENSES_TABLE) : [];

  console.log(`\n  ${APPLY ? 'PROMOTING' : 'DRY RUN —'} tasks of "${parent.title}" (level ${depth})`);
  console.log(`  ${tasks.length} would become sub-projects at level ${depth + 1}\n`);

  for (const task of tasks) {
    const mine = items.filter(item => String(item.task_id) === String(task.id));
    const paid = expenses.filter(expense => String(expense.task_id) === String(task.id));
    const carries = [
      task.budget ? `budget ${task.budget}` : null,
      mine.length ? `${mine.length} item(s)` : null,
      paid.length ? `${paid.length} expense(s)` : null
    ].filter(Boolean);

    console.log(`    ${task.title}${carries.length ? '  ← ' + carries.join(', ') : ''}`);
  }

  if (!APPLY) {
    console.log('\n  Nothing was written. Re-run with --apply.\n');
    return;
  }

  console.log('');
  for (const task of tasks) {
    const project = await createRow(PROJECTS_TABLE, {
      title: task.title,
      user_id: task.user_id,
      description: task.description ?? '',
      parent_id: String(PROJECT_ID),
      type: selectValue(parent.type) ?? 'personal',
      status: 'planning',
      priority: selectValue(task.priority) ?? 'medium',
      due_date: task.due_date ?? null,
      progress: 0,
      color: parent.color ?? '',
      icon: parent.icon ?? '',
      currency: parent.currency ?? '',
      budget: task.budget ?? null,
      tags: task.tags ?? '',
      archived: false
    });

    // Everything the task owned moves BEFORE it is deleted, or it is orphaned.
    for (const item of items.filter(row => String(row.task_id) === String(task.id))) {
      await patchRow(ITEMS_TABLE, item.id, { project_id: String(project.id), task_id: '' });
    }
    for (const expense of expenses.filter(row => String(row.task_id) === String(task.id))) {
      await patchRow(EXPENSES_TABLE, expense.id, { project_id: String(project.id), task_id: '' });
    }

    await deleteRow(TASKS_TABLE, task.id);
    console.log(`    + ${task.title} (project ${project.id})`);
  }

  console.log(`\n  Done. ${tasks.length} sub-projects under "${parent.title}". Reload the app.\n`);
}

run().catch(error => {
  console.error(`\n  Failed: ${error.message}\n`);
  process.exit(1);
});
