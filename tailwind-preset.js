/**
 * The shared Tailwind theme.
 *
 * Everything except `content` lives here, because `content` is the one part
 * that must be per-app: it is a list of file globs, and each app scans its own
 * source plus the libraries it actually depends on.
 *
 * This file moves to libs/shared/theme/ when that library is extracted. It sits
 * at the root for now so the four apps to come can share it without any of them
 * reaching into another app's directory.
 */
module.exports = {
  theme: {
    extend: {}
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: ['light', 'dark']
  }
};
