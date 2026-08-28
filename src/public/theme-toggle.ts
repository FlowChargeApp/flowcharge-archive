// The renderer half of the theme control, and the whole of it. This script
// wires the three-button `.seg` group that index.html and board.html both ship
// — a monitor for 'system', a sun for 'light', a moon for 'dark' — to the
// stored mode src/public/theme.ts owns, and reflects the current choice by
// moving one `active` class between the buttons.
//
// It knows nothing beyond that. It creates no markup, adds no CSS, and holds
// no mode of its own: readMode() and setMode() read and write localStorage on
// every call. It also never registers the operating-system preference listener
// — src/public/theme-init.ts registers that once per page, and a second
// registration here would double-apply on every appearance change.
//
// An ES module, exactly like update-banner.ts: the empty declaration at the
// foot of the file is what makes it one. It carries no named binding and
// nothing imports anything from it. It reaches both pages inside the home.js
// and app.js bundles, pulled in by a side-effect import in each entry file, so
// it has no script tag and no output file of its own. The Window augmentation
// below sits inside `declare global` because a bare top-level `interface
// Window` in a module is a local interface and never merges with
// lib.dom.d.ts's Window.

import { readMode, setMode } from './theme';
import type { ThemeMode } from './theme';

declare global {
  interface Window {
    // Optional on purpose, exactly as update-banner.ts declares
    // praxisUpdateAPI. A required property would make the browser-tab guard
    // below unreachable to the type checker: in a plain tab this bridge is
    // absent, the optional call is skipped, and nothing logs.
    praxisThemeAPI?: {
      setThemeSource(mode: string): Promise<void>;
    };
  }
}

(function () {
  const seg = document.getElementById('theme-seg');

  // Not a page that ships the control. Leave before anything is bound, so this
  // module stays inert wherever the markup is absent.
  if (!seg) {
    return;
  }

  const markActive = function (mode: ThemeMode): void {
    seg.querySelectorAll('button[data-mode]').forEach(function (b) {
      b.classList.toggle('active', (b as HTMLElement).dataset.mode === mode);
    });
  };

  // The served markup marks no button active, so the initial state comes from
  // storage rather than from the HTML. That way the control can never contradict
  // the mode theme-init.js already applied in <head>.
  markActive(readMode());

  // ONE delegated listener on the container, matching the pattern app.ts uses
  // for #sort-key-seg. closest() is required, not a convenience: the buttons
  // are icon-only, so their only child is an <svg> and most real clicks land on
  // that svg or on a path inside it, never on the button element itself.
  // Reading data-mode straight off event.target would make the control dead to
  // the mouse while still working under the keyboard.
  seg.addEventListener('click', function (event) {
    const target = event.target as Element | null;
    const button = target ? target.closest('button[data-mode]') : null;
    if (!button) {
      return;
    }
    // Validated against the three literals at the boundary, before the value
    // reaches setMode or crosses the bridge.
    const raw = (button as HTMLElement).dataset.mode;
    if (raw !== 'system' && raw !== 'light' && raw !== 'dark') {
      return;
    }
    const mode: ThemeMode = raw;

    setMode(mode);
    markActive(mode);

    // Fire and forget. Absent in a plain browser tab, so the optional call is
    // skipped there; a rejection is swallowed rather than left to surface as an
    // unhandled rejection.
    window.praxisThemeAPI?.setThemeSource(mode).catch(function () {
      // Ignored on purpose. The page is already repainted either way.
    });
  });
})();

export {};
