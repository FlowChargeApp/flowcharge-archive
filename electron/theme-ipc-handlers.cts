// Main-process IPC bridge for the theme choice, and the whole of the main
// process's theme surface. It answers one channel, setThemeSource, and does
// exactly one thing with it: assign Electron's own nativeTheme.themeSource, so
// the native chrome this process draws — the folder-picker dialog, the window
// frame, the menus — follows the choice the renderer already applied to the
// page.
//
// It stores nothing and reads nothing back. localStorage in the renderer stays
// the single source of truth for the mode, and this process is told the mode
// afresh on every change rather than remembering one. There is no getter
// channel, because nothing in the renderer asks this process what the theme is.
//
// The argument is validated against the three literals at the boundary before
// it reaches nativeTheme, so the renderer cannot set an arbitrary value. An
// unrecognised value is a silent no-op: nothing is assigned and nothing throws.
//
// Unlike the two async registrars beside it, this one is synchronous. It needs
// no dynamic-import shim, because it imports nothing from src/lib/* — value or
// type — and needs nothing from there. That import boundary is the rule the
// headers of electron/agentic-tools-ipc-handlers.cts and
// electron/update-check-ipc-handlers.cts set out at length: a .cts file
// compiles to CommonJS and cannot require() the ESM output in dist/lib, and
// this project's narrow rootDir cannot reach the src tree.

import { ipcMain, nativeTheme } from 'electron';

// Electron's own themeSource accepts exactly these three strings, which are
// also the three the renderer stores, so no mapping table is needed here.
type ThemeSource = 'system' | 'light' | 'dark';

function isThemeSource(value: unknown): value is ThemeSource {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function registerThemeIpcHandlers(): void {
  // Returns nothing. The renderer has already repainted itself by the time it
  // calls this, and it treats the call as fire-and-forget, so there is no
  // outcome for this process to report.
  ipcMain.handle('setThemeSource', (_event, mode: unknown): void => {
    if (!isThemeSource(mode)) return;
    nativeTheme.themeSource = mode;
  });
}
