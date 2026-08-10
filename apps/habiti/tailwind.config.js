const { join } = require('path');
const { createGlobPatternsForDependencies } = require('@nx/angular/tailwind');

/**
 * Tailwind for the Habiti app.
 *
 * THE `content` GLOBS ARE LOAD-BEARING AND FAIL SILENTLY.
 *
 * This config used to sit at the repo root with `content: ['./src/**\/*.{html,ts}']`.
 * The moment the app moved to apps/habiti, that glob matched nothing: Tailwind
 * emitted a stylesheet with no utility classes in it, the build stayed green,
 * every unit test passed, and every page would have rendered completely
 * unstyled. Measured, not theorised — the stylesheet went from 70.16 kB to
 * 4.64 kB, and the initial bundle *shrank*, so a size budget reads it as an
 * improvement.
 *
 * Two globs, and both matter:
 *
 *   join(__dirname, ...)   — relative to THIS file, not to the process's
 *                            working directory, so it survives the next move.
 *   createGlobPatternsForDependencies — walks the Nx project graph and adds a
 *                            glob for every library this app depends on. Without
 *                            it, a class used only inside a shared component
 *                            gets purged, which is the same failure again but
 *                            confined to one component and therefore harder to
 *                            spot.
 */
module.exports = {
  presets: [require('../../tailwind-preset.js')],
  content: [
    join(__dirname, 'src/**/*.{html,ts}'),
    ...createGlobPatternsForDependencies(__dirname)
  ]
};
