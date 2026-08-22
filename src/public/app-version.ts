// Writes the running app's own version into the footer of index.html and
// board.html. Both pages carry the same <div id="app-version" hidden> element,
// so one shared module covers both. It is an ES module: the empty declaration
// at the foot of the file is what makes it one. It carries no named binding and
// nothing imports anything from it. It reaches both pages inside the home.js
// and app.js bundles, pulled in by a side-effect import in each entry file, so
// it has no script tag and no output file of its own. It imports nothing, not
// even a type: window.praxisAPI is typed by the `declare global` block in
// ipc-adapter.ts, and a global augmentation applies across the whole program.
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

export {};
