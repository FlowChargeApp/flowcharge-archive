// The renderer half of the update check, and the whole of it. This script
// reveals the banner element that index.html and board.html both ship carrying
// the `hidden` attribute, and wires its three buttons back to the four
// zero-argument channels electron/update-check-ipc-handlers.cts registers.
//
// It knows nothing beyond that. It never makes the network call, never sees a
// URL it could act on, and never learns the policy that decided whether a
// check was due — the main process answers with a notice object or null, and
// this file only shows what it is handed. In a plain browser tab
// window.praxisUpdateAPI is absent, so the guard below returns immediately:
// nothing renders, nothing logs, and no external request is made.
//
// An ES module, exactly like app-version.ts: the empty declaration at the foot
// of the file is what makes it one. It carries no named binding and nothing
// imports anything from it. It reaches both pages inside the home.js and app.js
// bundles, pulled in by a side-effect import in each entry file, so it has no
// script tag and no output file of its own. The Window augmentation below sits
// inside `declare global` because a bare top-level `interface Window` in a
// module is a local interface and never merges with lib.dom.d.ts's Window.

declare global {
  interface Window {
    // Optional on purpose. A required property would make the browser-tab guard
    // below unreachable to the type checker, and this is the only thing that
    // distinguishes an Electron renderer from a plain tab.
    praxisUpdateAPI?: {
      getUpdateNotice(): Promise<{ version: string; hasReleaseUrl: boolean } | null>;
      dismissUpdate(): Promise<void>;
      disableUpdateChecks(): Promise<void>;
      openReleasePage(): Promise<void>;
    };
  }
}

// Everything below lives inside an IIFE, kept from when this file was a classic
// script sharing one global scope with the other renderer files. The bundle
// gives each module its own scope now, so the wrapper is no longer required,
// but it is harmless and removing it would change code this task must not touch.
(function () {
  // Six hours. This value cannot cause an extra request on its own: the main
  // process decides whether a check is actually due, and answers from its own
  // cached response when it is not.
  const ASK_INTERVAL_MS = 6 * 60 * 60 * 1000;

  // A plain browser tab has no bridge. Leave before anything is queried, so
  // the page behaves exactly as it did before this script existed.
  if (!window.praxisUpdateAPI) {
    return;
  }

  // Captured once, after the guard. A const holds the narrowed non-undefined
  // type inside the callbacks below, where re-reading the optional property
  // would not stay narrowed across an await or a closure boundary.
  const api = window.praxisUpdateAPI;

  const banner = document.getElementById('update-banner');
  const text = document.getElementById('update-banner-text');
  const viewButton = document.getElementById('update-banner-view');
  const offButton = document.getElementById('update-banner-off');
  const dismissButton = document.getElementById('update-banner-dismiss');

  // These five ids are the only elements this script knows about. If any is
  // missing the page is not one this banner belongs on, so do nothing.
  if (!banner || !text || !viewButton || !offButton || !dismissButton) {
    return;
  }

  // A const function expression, not a hoisted `function ask()` declaration:
  // a declaration could in principle be called before the five guards above
  // ran, so the checker drops their narrowing inside its body and the three
  // element reads become "possibly null". An expression created here keeps it.
  const ask = function (): void {
    api.getUpdateNotice()
      .then(function (notice) {
        if (!notice) {
          return;
        }
        text.textContent = 'FlowCharge ' + notice.version + ' is available.';
        // "View release" can do nothing when main holds no release URL, so the
        // button is removed from the row rather than left as a dead control.
        viewButton.hidden = !notice.hasReleaseUrl;
        banner.hidden = false;
      })
      .catch(function () {
        // Swallowed on purpose. Every failure mode of this feature is "show
        // nothing" — a rejected invoke must never surface to the user.
      });
  };

  viewButton.addEventListener('click', function () {
    // Fire and forget. Main decides whether the held URL is openable at all.
    api.openReleasePage().catch(function () {
      // Ignored, as above.
    });
  });

  offButton.addEventListener('click', function () {
    api.disableUpdateChecks().catch(function () {
      // Ignored, as above.
    });
    banner.hidden = true;
  });

  dismissButton.addEventListener('click', function () {
    api.dismissUpdate().catch(function () {
      // Ignored, as above.
    });
    banner.hidden = true;
  });

  ask();
  setInterval(ask, ASK_INTERVAL_MS);
})();

export {};
