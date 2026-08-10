/**
 * `@habiti/util` — the domain-free utilities.
 *
 * WHAT BELONGS HERE: anything any app in the workspace could want, that knows
 * nothing about habits, skills, challenges or levels. Age arithmetic, popover
 * anchoring, local date keys.
 *
 * WHAT DOES NOT, and stayed in apps/habiti/src/app/utils/:
 *
 *   skill-progress.util     imports the skill catalogue and skill models
 *   status-derivation.util  imports dashboard.config
 *   level-derivation.util   encodes Habiti's level rules
 *
 * A kiosk needs date keys and an admin portal needs popover anchoring; neither
 * has any use for a skill tier. This barrel stays honest by what it leaves out
 * — a "shared" library that accretes domain logic is how a monorepo ends up
 * with one giant module everything depends on.
 *
 * No Angular, no DOM globals beyond what anchor-position needs for measurement,
 * so this is tagged platform:agnostic and the API can use it too.
 */
export * from './lib/age.util';
export * from './lib/anchor-position.util';
export * from './lib/date-key.util';
