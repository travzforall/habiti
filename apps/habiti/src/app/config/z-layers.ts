/**
 * The stacking order, written down.
 *
 * The app grew a z-index ladder by accident — nav bars at 50, toasts and the
 * level history at 100, the template picker at 120, and one outlier at 9999.
 * Nothing recorded which number meant what, so every new overlay picked a
 * bigger number and hoped.
 *
 * IMPORTANT: these constants are DOCUMENTATION, not a live source of truth.
 * Tailwind's JIT compiler scans source files for literal class strings, so a
 * class assembled from a constant (`z-[${Z_LAYERS.tourTooltip}]`) produces no
 * CSS at all. Templates therefore keep the literal `z-[132]` and cite this file
 * in a comment. If you change a number here you must change the literal too.
 */
export const Z_LAYERS = {
  /** Top bar, side nav, bottom nav. */
  nav: 50,
  /** Toast host, level history, challenge modals, status picker. */
  toast: 100,
  /** Template picker and other content modals. */
  modal: 120,
  /** The onboarding wizard — above every modal it may embed. */
  onboarding: 130,
  /**
   * The tour's transparent click blocker. Same level as the wizard because the
   * two are never open at once: the wizard hands off to the tour only after it
   * has closed.
   */
  tourBlocker: 130,
  /** The spotlight cut-out. Above the blocker so its ring is never dimmed. */
  tourSpotlight: 131,
  /** The tip card. Always the topmost thing on screen. */
  tourTooltip: 132
} as const;

/**
 * The nightly planner sits at z-[9999], above everything here.
 *
 * It cannot collide in practice: the planner is only reachable from the top-nav
 * button, which sits behind the tour's blocker, and the wizard opens at sign-in
 * before the user can open anything. Left alone rather than renumbered, since
 * changing it risks a regression for no present benefit.
 */
export const Z_UNMANAGED_NIGHTLY_PLANNER = 9999;
