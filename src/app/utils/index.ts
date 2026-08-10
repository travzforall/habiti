/**
 * The domain-free utilities — the public surface of `@habiti/util`.
 *
 * WHAT IS DELIBERATELY NOT HERE, and why:
 *
 *   skill-progress.util   imports the skill catalogue and skill models
 *   status-derivation.util imports dashboard.config
 *   level-derivation.util  encodes Habiti's level rules
 *
 * Those are Habiti's, not everyone's. A kiosk needs date keys and an admin
 * portal needs popover anchoring; neither has any use for a skill tier. Import
 * them by their own path — this barrel exists to define what is genuinely
 * shared, so it stays honest by leaving things out.
 */
export * from './age.util';
export * from './anchor-position.util';
export * from './date-key.util';
