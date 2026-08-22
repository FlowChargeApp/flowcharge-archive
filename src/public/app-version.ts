// Writes the running app's own version into the footer of index.html and
// board.html. Both pages carry the same <div id="app-version" hidden> element,
// so one shared script covers both. No import/export keyword, exactly like
// ipc-adapter.ts and browser-ipc-shim.ts — src/public/tsconfig.json sets
// module: "none" and either keyword would turn this file into a module, at
// which point the ambient PraxisAPI declarations stop resolving.
//
// This file knows two things and nothing else: how to ask for the version, and
// where to put it. Every failure path is silent — the element simply stays
// hidden, so a stale tab or an unreachable server shows no error row and logs
// no uncaught exception.

function showAppVersion(): void {
  const target = document.getElementById('app-version');
  if (!target) {
    return;
  }

  window.praxisAPI.getAppVersion()
    .then(function (version) {
      if (typeof version !== 'string' || version === '') {
        return;
      }
      target.textContent = 'Version ' + version;
      target.removeAttribute('hidden');
    })
    .catch(function () {
      // Swallowed on purpose. A rejected invoke leaves the element hidden
      // rather than surfacing an uncaught exception in the console.
    });
}

showAppVersion();
