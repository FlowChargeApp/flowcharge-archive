// The pre-paint entry point. It applies the stored theme before the browser's
// first paint, so neither page ever flashes the wrong palette.
//
// This is a separate bundled file rather than an inline <head> script because
// src/server.ts:31-34 sets `script-src 'self'` with no `'unsafe-inline'`: an
// inline script would simply be refused. Its own entry point in
// tools/bundle-public.mjs emits dist/public/theme-init.js, which both pages
// load with a plain synchronous <script src> in <head>.
//
// It runs before <body> exists, so it touches no element and wires no control.
// src/public/theme-toggle.ts owns the `.seg` control, later, on DOM ready.
import { readMode, resolveMode, applyResolved, watchSystemPreference } from './theme';

applyResolved(resolveMode(readMode()));
watchSystemPreference();
