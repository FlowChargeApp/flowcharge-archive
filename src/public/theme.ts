// The whole of the theme logic, and nothing else. This module owns three
// things: the stored mode in localStorage under one key, the resolution of
// that mode to a concrete 'light' or 'dark', and the single DOM write that
// applies the result to document.documentElement.dataset.theme.
//
// It knows nothing beyond that. It never sees the page markup, never queries
// the `.seg` control, never touches Electron, and never calls
// window.praxisThemeAPI — src/public/theme-toggle.ts owns the control and that
// bridge call. Every function here is a pure function over browser globals
// plus, in applyResolved, one attribute write.
//
// It holds no module state on purpose. esbuild inlines this file into every
// bundle that imports it, so home.js, app.js and theme-init.js each carry
// their own copy. A cached mode variable would desynchronise those copies, so
// every function reads localStorage or the DOM afresh on each call.

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'praxis-theme';
export const DEFAULT_MODE: ThemeMode = 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

// Reading localStorage is itself a throwing operation in some privacy modes —
// the access to the property throws, before any value is returned. So the
// try/catch wraps the access, not just the parse. This function never throws.
export function readMode(): ThemeMode {
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    return DEFAULT_MODE;
  }
  if (stored === 'system' || stored === 'light' || stored === 'dark') return stored;
  return DEFAULT_MODE;
}

export function resolveMode(mode: ThemeMode): ResolvedTheme {
  if (mode === 'light' || mode === 'dark') return mode;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

// Always writes a concrete value. The attribute is never removed, so the
// stylesheet's two palette blocks — :root and :root[data-theme="dark"] — are
// the only two states the page can ever be in.
export function applyResolved(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

// A storage write that throws must still leave the page repainted, so the
// try/catch wraps only the write and the apply happens regardless.
export function setMode(mode: ThemeMode): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    // Storage is unavailable. The mode still applies for this page's lifetime.
  }
  const resolved = resolveMode(mode);
  applyResolved(resolved);
  return resolved;
}

// Follows the operating system's appearance while, and only while, the stored
// mode is 'system'. readMode() is called inside the listener rather than
// captured at registration time: a capture would freeze the mode as it stood
// when the page loaded, and a later switch to 'system' from the toggle would
// never be followed.
export function watchSystemPreference(): void {
  window.matchMedia(DARK_QUERY).addEventListener('change', () => {
    const mode = readMode();
    if (mode !== 'system') return;
    applyResolved(resolveMode(mode));
  });
}
