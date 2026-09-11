// The entry module for index.html. esbuild bundles this file and everything it
// imports into dist/public/home.js, the page's only script.
//
// The import order below is load-bearing. './browser-ipc-shim' comes first, so its
// fallback installs window.praxisAPI before any other module body runs, and
// './app-version', './update-banner' and './theme-toggle' follow as side-effect
// imports with no binding, reproducing the order their script tags used to give
// them.
//
// The skill-install surface's shapes are not declared here. './lib/agentic-tools-api'
// owns them, because browser-ipc-shim.ts needs the same shapes and neither file can
// own what the other also imports. That module also carries the window.praxisSkillInstallAPI
// augmentation, inside a global-augmentation block so it merges with the Window that
// lib.dom.d.ts declares. InstallScope comes from './lib/agentic-tools-scope'.

import './browser-ipc-shim';
import './app-version';
import './update-banner';
import './theme-toggle';
import { unwrapIpc } from './ipc-adapter';
import type { PraxisIpcResult } from './ipc-adapter';
import { resolveBasePathForScope, isEligibleAtScope } from './lib/agentic-tools-scope';
import type { InstallScope } from './lib/agentic-tools-scope';
import type {
  DetectionConfidence,
  InstallRecord,
  InstallResult,
  PraxisSkillInstallAPI,
  SkillPresenceResponse,
  SkillReleaseSummary,
  ToolDetectionRow
} from './lib/agentic-tools-api';

(function () {
  var ABSOLUTE_PATH_MESSAGE = 'Path must be absolute — enter a full path starting with /';
  var TILDE_MESSAGE = '~ is not expanded — enter the full absolute path instead';

  // Lucide square-pen, drawn as path data only.
  var SQUARE_PEN_PATHS = [
    'M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7',
    'M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z'
  ];
  // Lucide trash-2, drawn as path data only.
  var TRASH_2_PATHS = [
    'M10 11v6',
    'M14 11v6',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M3 6h18',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'
  ];

  function el(tag: string, cls?: string | null, text?: string | null): HTMLElement {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  // el() cannot build this: document.createElement cannot make an SVG element, it returns
  // an HTMLUnknownElement that never renders. Every node in an SVG subtree therefore needs
  // document.createElementNS. The namespace stays a string literal at each call site,
  // because the typed overload keys on that literal and a variable widens it to string.
  function iconSvg(paths: string[]): SVGSVGElement {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    paths.forEach(function (d) {
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    });
    return svg;
  }
  function byId(id: string): HTMLElement { return document.getElementById(id)!; }

  // The file's only reader of the skill-install global. The surface is optional —
  // the Electron preload installs it, and browser-ipc-shim.ts installs a fetch-backed
  // one in a plain tab — so every caller must handle a null here rather than throw.
  function skillInstallAPI(): PraxisSkillInstallAPI | null {
    return window.praxisSkillInstallAPI ?? null;
  }

  function setError(message: string) {
    byId('add-error').textContent = message;
  }

  // The most recently loaded project list. renderTiles() consumes it for the home
  // tiles; the integrations dialog's project <select> (below) reuses the same list
  // rather than issuing its own listProjects() call.
  var lastKnownProjects: ProjectEntry[] = [];

  // Clears its container before appending: this runs again after every successful add.
  function renderTiles(projects: ProjectEntry[]) {
    var host = byId('project-tiles');
    host.innerHTML = '';

    if (!projects.length) {
      var empty = el('div', 'tiles-empty');
      empty.appendChild(el('h3', null, 'No projects yet'));
      empty.appendChild(el('p', null,
        'Add the absolute path of any directory that contains a flowcharge/ folder (a legacy prxwork/ folder is still accepted), using the form below.'));
      host.appendChild(empty);
      return;
    }

    // The tile is a container, not a link: a button cannot sit inside a link, so the
    // link is one child of the card and the action buttons are another.
    projects.forEach(function (p) {
      var tile = el('div', 'tile');

      var link = el('a', 'tile-link') as HTMLAnchorElement;
      link.href = '/board.html?project=' + encodeURIComponent(p.id);
      var nameSpan = el('span', 'tile-name', p.name);
      link.appendChild(nameSpan);
      link.appendChild(el('span', 'tile-path', p.path));
      link.appendChild(el('span', 'tile-added', 'Added ' + p.added));
      tile.appendChild(link);

      var actions = el('div', 'tile-actions');
      var renameButton = el('button', 'tile-action') as HTMLButtonElement;
      renameButton.type = 'button';
      renameButton.setAttribute('aria-label', 'Rename ' + p.name);
      renameButton.title = 'Rename ' + p.name;
      renameButton.appendChild(iconSvg(SQUARE_PEN_PATHS));
      var deleteButton = el('button', 'tile-action') as HTMLButtonElement;
      deleteButton.type = 'button';
      deleteButton.setAttribute('aria-label', 'Delete ' + p.name);
      deleteButton.title = 'Delete ' + p.name;
      deleteButton.appendChild(iconSvg(TRASH_2_PATHS));
      actions.appendChild(renameButton);
      actions.appendChild(deleteButton);
      tile.appendChild(actions);

      var errorLine = el('div', 'tile-error');
      tile.appendChild(errorLine);

      // This tile's own error line. #add-error stays the add form's error line.
      function setTileError(message: string) {
        errorLine.textContent = message;
      }

      // Edit mode swaps this one tile in place. Only one tile is ever in edit mode,
      // because a save calls loadProjects(), which re-renders every tile and would
      // throw away another tile's half-typed name.
      var editRow: HTMLElement | null = null;

      function exitEditMode() {
        if (!editRow) return;
        tile.removeChild(editRow);
        editRow = null;
        nameSpan.style.display = '';
      }

      renameButton.addEventListener('click', function () {
        if (editRow) return;
        setTileError('');

        var row = el('div', 'tile-edit');
        var nameInput = el('input') as HTMLInputElement;
        nameInput.type = 'text';
        // Through .value, never innerHTML: a name containing markup is never parsed.
        nameInput.value = p.name;
        nameInput.setAttribute('aria-label', 'New name for ' + p.name);
        var saveButton = el('button', 'tile-action', 'Save') as HTMLButtonElement;
        saveButton.type = 'button';
        saveButton.setAttribute('aria-label', 'Save the new name for ' + p.name);
        var cancelButton = el('button', 'tile-action', 'Cancel') as HTMLButtonElement;
        cancelButton.type = 'button';
        cancelButton.setAttribute('aria-label', 'Cancel renaming ' + p.name);
        row.appendChild(nameInput);
        row.appendChild(saveButton);
        row.appendChild(cancelButton);

        function save() {
          setTileError('');
          window.praxisAPI.renameProject(p.id, nameInput.value)
            .then(unwrapIpc)
            .then(function () {
              return loadProjects();
            })
            .catch(function (err) {
              // Stays in edit mode, so the user can correct the name rather than retype it.
              setTileError(err.message);
            });
        }

        saveButton.addEventListener('click', save);
        cancelButton.addEventListener('click', exitEditMode);
        // Escape does not bubble as a form event here, so the key is read on the input
        // itself. Enter is stopped as well, or it can submit an enclosing form.
        nameInput.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            save();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            exitEditMode();
          }
        });

        nameSpan.style.display = 'none';
        tile.insertBefore(row, actions);
        editRow = row;
        nameInput.focus();
        nameInput.select();
      });

      deleteButton.addEventListener('click', function () {
        setTileError('');
        var confirmed = window.confirm(
          'Remove "' + p.name + '" from FlowCharge?\n\n' +
          'This removes the project from the list only. The project\'s own files on disk are not touched.');
        if (!confirmed) return;

        window.praxisAPI.removeProject(p.id)
          .then(unwrapIpc)
          .then(function () {
            return loadProjects();
          })
          .catch(function (err) {
            // Leaves the tile on the page, with the failure attached to the tile that failed.
            setTileError(err.message);
            // A 404 is the one failure where the tile itself is wrong: the row is already
            // gone, deleted by another tab, so this list is stale. Refresh it, which drops
            // the dead tile and the message with it. Every other failure keeps both.
            if (err.status === 404) return loadProjects();
          });
      });

      host.appendChild(tile);
    });
  }

  function loadProjects() {
    return window.praxisAPI.listProjects()
      .then(unwrapIpc)
      .then(function (list: ProjectList) {
        lastKnownProjects = list.projects || [];
        renderTiles(lastKnownProjects);
      })
      .catch(function (err) {
        var host = byId('project-tiles');
        host.innerHTML = '';
        var box = el('div', 'tiles-empty');
        box.appendChild(el('h3', null, "Couldn't load the project list"));
        box.appendChild(el('p', null, 'Detail: ' + err.message));
        host.appendChild(box);
      });
  }

  function submitPath() {
    var input = byId('project-path') as HTMLInputElement;
    var value = input.value.trim();

    setError('');
    if (!value) {
      setError('Enter the absolute path of a directory containing a flowcharge/ folder (a legacy prxwork/ folder is still accepted)');
      return;
    }
    // Instant feedback only — the server remains the authority. Both messages are the
    // server's own strings, so a client-side rejection reads exactly like a server one.
    if (value.charAt(0) === '~') {
      setError(TILDE_MESSAGE);
      return;
    }
    if (value.charAt(0) !== '/') {
      setError(ABSOLUTE_PATH_MESSAGE);
      return;
    }

    window.praxisAPI.addProject(value)
      .then(unwrapIpc)
      .then(function () {
        input.value = '';
        return loadProjects();
      })
      .catch(function (err) {
        // Leaves the input value alone, so the user can correct it rather than retype it.
        setError(err.message);
      });
  }

  byId('add-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    submitPath();
  });

  // Runs once, at script-load/init time — never per-submit, never per-click.
  // pickProjectFolder is optional on PraxisAPI (ipc-adapter.ts Decision 3); a typeof
  // check is the correct feature-detect for an optional method, and is NOT the same as
  // `if (window.praxisAPI)`, which WS-45's browser-ipc-shim.ts makes true unconditionally
  // in a plain browser tab.
  function initAddProjectControl() {
    if (typeof window.praxisAPI.pickProjectFolder === 'function') {
      byId('add-form').hidden = true;
      byId('choose-folder-button').hidden = false;
    } else {
      byId('choose-folder-button').hidden = true;
      byId('add-form').hidden = false;
    }
  }

  byId('choose-folder-button').addEventListener('click', function () {
    setError('');
    // Non-null assertion is safe here: this listener only ever fires while the button is
    // visible, which initAddProjectControl() only allows when the method is present.
    window.praxisAPI.pickProjectFolder!()
      .then(function (path) {
        if (path == null) return; // cancelled — silent no-op, per acceptance criterion 3
        return window.praxisAPI.addProject(path).then(unwrapIpc).then(function () {
          return loadProjects();
        });
      })
      .catch(function (err) {
        setError(err.message);
      });
  });

  // ---------- Manage integrations dialog ----------
  // Open/close, scope-toggle, project-picker population, and (from Task 4.1 on) real
  // detectTools() row rendering into the single tool list. No installSelected() call
  // lives here yet — that starts at Task 5.1.

  // byId returns HTMLElement; showModal()/close() need the dialog type — same cast
  // pattern app.ts:353 uses for #ws-modal.
  var integrationsModal = byId('integrations-modal') as HTMLDialogElement;
  var integrationsList = byId('integrations-list');
  var integrationsScopeSeg = byId('integrations-scope-seg');
  var integrationsProjectSelect = byId('integrations-project-select') as HTMLSelectElement;

  // Structurally identical to agentic-tools-scope.ts's InstallScope (Task 3.2), and
  // deliberately left as its own inline literal rather than switched over to the
  // imported type — substituting it is out of scope here.
  var currentIntegrationsScope: { kind: 'global' } | { kind: 'project'; projectPath: string } =
    { kind: 'global' };

  // Populates the project <select> from the same list renderTiles() already consumes
  // (lastKnownProjects, above) — no separate listProjects() call. With zero projects
  // registered, the Project scope button stays disabled with a pointer at "Add a
  // project", per acceptance criterion 8.
  function populateIntegrationsProjectSelect() {
    var projectBtn = integrationsScopeSeg.querySelector('[data-scope="project"]') as HTMLButtonElement;
    integrationsProjectSelect.innerHTML = '';
    if (!lastKnownProjects.length) {
      projectBtn.disabled = true;
      projectBtn.title = 'Add a project first, using the form on this page';
      return;
    }
    projectBtn.disabled = false;
    projectBtn.removeAttribute('title');
    lastKnownProjects.forEach(function (p) {
      var opt = document.createElement('option');
      opt.value = p.path;
      opt.textContent = p.name;
      integrationsProjectSelect.appendChild(opt);
    });
  }

  function setIntegrationsScope(kind: 'global' | 'project') {
    var segButtons = integrationsScopeSeg.querySelectorAll('button');
    segButtons.forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.scope === kind);
    });
    if (kind === 'project') {
      integrationsProjectSelect.hidden = false;
      currentIntegrationsScope = {
        kind: 'project',
        projectPath: integrationsProjectSelect.value || (lastKnownProjects[0] ? lastKnownProjects[0].path : '')
      };
    } else {
      integrationsProjectSelect.hidden = true;
      currentIntegrationsScope = { kind: 'global' };
    }
    // Re-derives eligibility/labels for whatever rows are already rendered — no new
    // detectTools() call, since a scope change never changes what's actually detected,
    // only which of those results are usable at the newly-selected scope.
    refreshIntegrationsEligibility();
  }

  var DETECTION_CONFIDENCE_LABEL: Record<DetectionConfidence, string> = {
    confirmed: 'Confirmed',
    likely: 'Likely',
    weak: 'Weak signal',
    'not-detected': 'Not detected'
  };

  // Read the real InstallResult.status value returned per target — never a placeholder
  // message — and shown only as a friendly label for that same value.
  var INSTALL_STATUS_LABEL: Record<InstallResult['status'], string> = {
    installed: 'Installed',
    updated: 'Updated',
    'up-to-date': 'Up to date',
    'skipped-no-format': 'No format for this tool'
  };

  // Label for a real filesystem presence check (checkInstalledSkills) finding every
  // canonical skill already present on disk — never a live InstallResult, so never
  // drawn from INSTALL_STATUS_LABEL's map (see gotcha in TL-45-s0t4ii task 1). No
  // longer describes a persisted-ledger match (ISS-11's original fix); task 3
  // (ISS-12) replaced that ledger join with this strictly-more-accurate fs check.
  var ALREADY_INSTALLED_LABEL = 'Already installed';

  // Label for a checkInstalledSkills 'per-skill'/'missing-incomplete' result — some
  // but not all canonical skills are present on disk for this tool.
  var INCOMPLETE_INSTALL_LABEL = 'Missing skills';

  // Version-chip labels. The version comes from the installed skill files first and
  // the install record second. No version at either source, or a version the semver
  // rule below cannot read, shows UNKNOWN_VERSION_LABEL and never an empty chip.
  var VERSION_LABEL_PREFIX = 'v';
  var UNKNOWN_VERSION_LABEL = 'Version unknown';

  // Rides on that same resolved version: shown only when the newest published release
  // is STRICTLY newer than it. An equal tag shows the version chip and no update chip,
  // and an unreadable or absent version shows neither. A row with nothing installed
  // hides this chip outright, along with the version chip and the Update button.
  var UPDATE_AVAILABLE_LABEL = 'Update available';

  // Accepts `v?MAJOR.MINOR.PATCH` and ignores whatever follows the patch number,
  // matching src/lib/update-check.ts's rule exactly. Re-authored here rather than
  // imported: that module uses the Node-only Buffer global and is excluded from this
  // page's type-check and bundle (see task list Divergence 2).
  var SEMVER_RE = /^v?(\d+)\.(\d+)\.(\d+)/;

  function parseSemver(raw: string): { major: number; minor: number; patch: number } | null {
    if (typeof raw !== 'string') return null;
    var m = raw.trim().match(SEMVER_RE);
    if (m === null) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
  }

  // True only when candidate is strictly greater than running, comparing major,
  // then minor, then patch. An unreadable version on either side returns false: a
  // version we cannot read must never prompt an update. Same semantics as
  // src/lib/update-check.ts's isNewer, re-authored here for the same reason
  // parseSemver above is (see task list Divergence 2).
  function isNewer(candidate: string, running: string): boolean {
    var a = parseSemver(candidate);
    var b = parseSemver(running);
    if (a === null || b === null) return false;
    if (a.major !== b.major) return a.major > b.major;
    if (a.minor !== b.minor) return a.minor > b.minor;
    return a.patch > b.patch;
  }

  type IntegrationsRowEntry = {
    row: ToolDetectionRow;
    rowEl: HTMLElement;
    checkbox: HTMLInputElement;
    notes: HTMLElement;
    installChip: HTMLElement;
    versionChip: HTMLElement;
    updateChip: HTMLElement;
    updateButton: HTMLButtonElement;
    // True once a live installSelected() result (this dialog session) has written a
    // real InstallResult onto installChip — guards applyIntegrationsRowEligibility's
    // persisted-registry join from clobbering that fresh chip on a later scope toggle.
    hasLiveResult: boolean;
  };

  // One entry per rendered row, built fresh on every detectTools() call
  // (loadIntegrationsDetection, below) and left alone by a scope toggle — only each
  // entry's disabled state and note text are re-derived then, via
  // applyIntegrationsRowEligibility, so a checkbox already ticked survives a scope
  // toggle for as long as that row stays eligible.
  var integrationsRowEntries: IntegrationsRowEntry[] = [];

  // Real filesystem presence results (checkInstalledSkills), keyed by toolId, fetched
  // once at dialog open at Global scope only (loadIntegrationsDetection, below) —
  // fetched-once / cleared-on-close, same lifecycle as integrationsRowEntries above.
  // Each entry also carries installedVersion, the version the route read off the
  // installed skill files, so this map drives the version chip as well as the install
  // chip. A scope toggle re-derives chip visibility from this map client-side; it never
  // triggers a new checkInstalledSkills() call. Only ever populated at Global scope —
  // see applyIntegrationsRowEligibility's currentIntegrationsScope.kind === 'global'
  // gate, and task list Divergence 2.
  var integrationsSkillPresence: Record<string, SkillPresenceResponse> = {};

  // The newest published release, or null when none was found. Always the FIRST entry
  // of the list listSkillReleases() returns: parseReleases already sorted that list
  // newest-first, so re-sorting here would duplicate a rule that could then drift.
  var latestRelease: SkillReleaseSummary | null = null;

  // Persisted install records (getInstallStatus), keyed by toolId AND scope, fetched
  // once at dialog open — fetched-once / cleared-on-close, same lifecycle as
  // integrationsSkillPresence above. Keying on scope as well as toolId is what lets a
  // scope toggle re-derive the version chip client-side with no second call, and is
  // what stops two projects' records from colliding.
  //
  // This is the FALLBACK version source, read only when the presence response above
  // carries no installedVersion — at project scope, and for a global row whose
  // installed files hold no readable version. The 'Already installed' chip
  // deliberately does NOT read this map — ISS-12-yngl4x replaced that ledger join with
  // the strictly more accurate filesystem presence check above, and this must not
  // restore it.
  var integrationsInstallRecords: Record<string, InstallRecord> = {};

  // The map key. A project-scoped record carries its project path, so two projects'
  // records for the same tool never overwrite one another.
  function installRecordKey(toolId: string, scope: InstallScope): string {
    return scope.kind === 'project' ? toolId + ' project ' + scope.projectPath : toolId + ' global';
  }

  function buildIntegrationsRow(row: ToolDetectionRow): IntegrationsRowEntry {
    var rowEl = el('div', 'integrations-row');

    var checkbox = el('input') as HTMLInputElement;
    checkbox.type = 'checkbox';
    checkbox.setAttribute('aria-label', 'Select ' + row.displayName);
    checkbox.addEventListener('change', updateInstallSelectedButtonState);
    rowEl.appendChild(checkbox);

    rowEl.appendChild(el('span', 'integrations-row-name', row.displayName));
    rowEl.appendChild(el('span', 'chip', DETECTION_CONFIDENCE_LABEL[row.detection.confidence]));

    // Install-status chip: hidden until a real InstallResult for this row's toolId
    // comes back from installSelected() (installIntegrationsSelected, below).
    var installChip = el('span', 'chip');
    installChip.hidden = true;
    rowEl.appendChild(installChip);

    // Version chip: applyIntegrationsRowEligibility fills it on the first pass, from
    // the install record for this row's toolId at the current scope.
    var versionChip = el('span', 'chip');
    versionChip.hidden = true;
    rowEl.appendChild(versionChip);

    // Update chip: reuses the same .chip class as every other pill in this row.
    // applyIntegrationsRowEligibility decides its visibility from the recorded
    // version and the newest release tag.
    var updateChip = el('span', 'chip', UPDATE_AVAILABLE_LABEL);
    updateChip.hidden = true;
    rowEl.appendChild(updateChip);

    // Update button: shown by exactly the same condition as the update chip above,
    // so the prompt and the action it offers can never disagree. Its aria-label
    // names the tool, matching the per-row pattern the checkbox already uses,
    // because 'Update' alone is ambiguous once four rows carry the same button.
    var updateButton = el('button', 'integrations-row-update', 'Update') as HTMLButtonElement;
    updateButton.type = 'button';
    updateButton.setAttribute('aria-label', 'Update ' + row.displayName);
    updateButton.hidden = true;
    rowEl.appendChild(updateButton);

    var notes = el('div', 'integrations-row-notes');
    rowEl.appendChild(notes);

    var entry: IntegrationsRowEntry = {
      row: row,
      rowEl: rowEl,
      checkbox: checkbox,
      notes: notes,
      installChip: installChip,
      versionChip: versionChip,
      updateChip: updateChip,
      updateButton: updateButton,
      hasLiveResult: false
    };

    // One row, the same install path the Install selected button uses — so the
    // result lands on this row's own install chip and the failure alert is shared.
    updateButton.addEventListener('click', function () {
      installIntegrationsSelected([entry]);
    });

    return entry;
  }

  // Visible text only, never a hover-only title — both the ineligibility label and
  // the unverified-path note must be readable without hovering.
  function applyIntegrationsRowEligibility(entry: IntegrationsRowEntry) {
    var eligible = isEligibleAtScope(currentIntegrationsScope, entry.row.detection);
    entry.checkbox.disabled = !eligible;
    entry.notes.innerHTML = '';

    // checkInstalledSkills is only ever fetched at Global scope (loadIntegrationsDetection,
    // below) — showing its result under Project scope would be a stale, wrong-scope
    // result mislabelled as current. Hide the install chip outright at Project scope
    // instead (a deliberate, bounded scope limit — see task list Divergence 2 — not a
    // bug), and leave the ledger driving the version chip there.
    var presence = currentIntegrationsScope.kind === 'global'
      ? integrationsSkillPresence[entry.row.toolId]
      : undefined;

    // Version chip, re-derived on every scope toggle. The version is read disk-first
    // and ledger-second: presence.installedVersion, the version the route read off the
    // installed skill files, wins; the once-fetched record map supplies it only when
    // the presence response carries none. No version at either source, and a version
    // the semver rule cannot read, both read 'Version unknown'.
    //
    // A row with zero skills installed hides all three of the version chip, the update
    // chip and the Update button: there is no installation to carry a version.
    // PLN-89-wpi985 Assumption 6: a failed or pending presence probe leaves no entry in
    // the map, so zeroInstalled stays false there and the chip stays visible reading
    // 'Version unknown'.
    var zeroInstalled = presence !== undefined
      && presence.checkKind === 'per-skill'
      && presence.status === 'not-installed';
    var recordKey = installRecordKey(entry.row.toolId, currentIntegrationsScope);
    var record = integrationsInstallRecords[recordKey];
    var recordedVersion = record === undefined ? undefined : record.version;
    var diskVersion = presence !== undefined
      && typeof presence.installedVersion === 'string'
      && presence.installedVersion !== ''
      ? presence.installedVersion
      : undefined;
    var effectiveVersion = diskVersion === undefined ? recordedVersion : diskVersion;
    var parsed = effectiveVersion === undefined ? null : parseSemver(effectiveVersion);
    entry.versionChip.textContent = parsed === null
      ? UNKNOWN_VERSION_LABEL
      : VERSION_LABEL_PREFIX + parsed.major + '.' + parsed.minor + '.' + parsed.patch;
    entry.versionChip.hidden = zeroInstalled;

    // Update chip. Hidden outright when the row has nothing installed. Otherwise
    // strict comparison only: an equal tag shows no chip, and an absent version or a
    // version either side cannot read shows no chip either — isNewer returns false for
    // every unreadable input, so an unparseable tag can never prompt an update.
    var updateAvailable = !zeroInstalled
      && effectiveVersion !== undefined
      && latestRelease !== null
      && isNewer(latestRelease.tag, effectiveVersion);
    entry.updateChip.hidden = !updateAvailable;
    // The button rides on the chip's condition, and expresses ineligibility the
    // way the checkbox does — disabled, not hidden. A row with no resolvable base
    // path at this scope has no installable target, so clicking it would only
    // produce a refused install from the transport.
    entry.updateButton.hidden = !updateAvailable;
    entry.updateButton.disabled = !eligible;

    if (!eligible) {
      var scopeLabel = currentIntegrationsScope.kind === 'project' ? 'project scope' : 'global scope';
      entry.notes.appendChild(el('span', 'integrations-row-note', 'Not supported at ' + scopeLabel));
    }
    if (entry.row.detection.needsManualVerification) {
      entry.notes.appendChild(el('span', 'integrations-row-note', 'Path unverified for your OS'));
    }
    // A live installSelected() result already reflects real, current install state —
    // never overwrite it with the fs-presence check below, which is fetched once at
    // dialog open and cannot see a live install that happened afterward.
    if (!entry.hasLiveResult) {
      var fullyPresent = presence !== undefined && (
        (presence.checkKind === 'per-skill' && presence.status === 'fully-installed') ||
        (presence.checkKind === 'shared-file' && presence.exists)
      );
      var incompletePresent = presence !== undefined
        && presence.checkKind === 'per-skill' && presence.status === 'missing-incomplete';
      if (fullyPresent) {
        entry.installChip.textContent = ALREADY_INSTALLED_LABEL;
        entry.installChip.hidden = false;
      } else if (incompletePresent) {
        entry.installChip.textContent = INCOMPLETE_INSTALL_LABEL;
        entry.installChip.hidden = false;
      } else {
        entry.installChip.hidden = true;
      }
    }
  }

  function refreshIntegrationsEligibility() {
    integrationsRowEntries.forEach(applyIntegrationsRowEligibility);
    // A row that just became ineligible no longer counts toward "at least one eligible
    // row checked", even if its checkbox is still (harmlessly) checked underneath.
    updateInstallSelectedButtonState();
  }

  var integrationsInstallSelectedButton = byId('integrations-install-selected') as HTMLButtonElement;

  // Disabled whenever zero eligible (checked AND enabled) rows are selected — recomputed
  // on every checkbox change and every scope toggle, never left stale.
  function updateInstallSelectedButtonState() {
    var hasEligibleChecked = integrationsRowEntries.some(function (entry) {
      return entry.checkbox.checked && !entry.checkbox.disabled;
    });
    integrationsInstallSelectedButton.disabled = !hasEligibleChecked;
  }

  // Rebuilds the one tool list from a fresh detectTools() payload — one row per
  // TOOL_CATALOGUE entry, in payload order, matching the four rows the handler always
  // returns (electron/agentic-tools-ipc-handlers.cts maps every catalogue entry, not
  // just the ones a DetectionResult was found for).
  function renderIntegrationsRows(rows: ToolDetectionRow[]) {
    integrationsList.innerHTML = '';

    integrationsRowEntries = rows.map(buildIntegrationsRow);
    integrationsRowEntries.forEach(function (entry) {
      integrationsList.appendChild(entry.rowEl);
      applyIntegrationsRowEligibility(entry);
    });
    // Every freshly-built row starts unchecked, but a stale disabled state from a
    // previous render must not linger on the button either way.
    updateInstallSelectedButtonState();
  }

  // The single failure renderer for the integrations modal: both the missing-surface
  // guard and loadIntegrationsDetection's .catch render this same box, so the two
  // failure paths cannot drift apart. It takes plain strings, so each caller keeps
  // ownership of where its detail text comes from.
  function renderIntegrationsFailure(heading: string, detail: string) {
    integrationsRowEntries = [];
    integrationsSkillPresence = {};
    integrationsList.innerHTML = '';
    var box = el('div', 'tiles-empty');
    box.appendChild(el('h3', null, heading));
    box.appendChild(el('p', null, 'Detail: ' + detail));
    integrationsList.appendChild(box);
    updateInstallSelectedButtonState();
  }

  // Fills the dialog header's latest-release line. Called on dialog open only.
  //
  // The dialog must stay fully usable when no release is found, so an empty list, a
  // failed call and an absent surface all render the same short note rather than a
  // failure box. That note is now also a warning that an install would fail, but the
  // user-facing message for that is the one the install path itself throws.
  //
  // The tag and the name arrive from a remote API, so both are written with
  // textContent, which never parses markup.
  function loadLatestRelease(): Promise<void> {
    var releaseEl = byId('integrations-release');
    var api = skillInstallAPI();
    if (api === null) {
      latestRelease = null;
      releaseEl.textContent = 'No published release found';
      return Promise.resolve();
    }
    return api.listSkillReleases().then(unwrapIpc).then(function (releases) {
      // First entry, not a re-sorted one: parseReleases already ordered the list
      // newest-first, and a second sort here would be a duplicated rule.
      latestRelease = releases.length > 0 ? releases[0] : null;
      if (latestRelease === null) {
        releaseEl.textContent = 'No published release found';
        return;
      }
      releaseEl.textContent = latestRelease.name === ''
        ? latestRelease.tag
        : latestRelease.tag + ' — ' + latestRelease.name;
    })
      .catch(function () {
        latestRelease = null;
        releaseEl.textContent = 'No published release found';
      })
      // latestRelease is the update chip's second input, and this call races the
      // record and detection fetches that also render rows. Whichever of the three
      // finishes last has to re-derive the rows, or an update chip is silently
      // dropped whenever this one resolves after them. Runs on the empty-list and
      // failure paths too, so a release that went away also clears the prompt.
      .then(function () {
        refreshIntegrationsEligibility();
      });
  }

  // Fetches the persisted install registry once per dialog open, for the per-row
  // version chips only. Records are keyed by toolId AND scope here, so a later scope
  // toggle re-derives every chip from this map with no second call. A failure leaves
  // the map empty, which shows no version chip at all rather than a wrong one.
  function loadIntegrationsInstallRecords(): Promise<void> {
    var api = skillInstallAPI();
    if (api === null) {
      integrationsInstallRecords = {};
      return Promise.resolve();
    }
    return api.getInstallStatus().then(unwrapIpc).then(function (records) {
      var next: Record<string, InstallRecord> = {};
      records.forEach(function (record) {
        next[installRecordKey(record.toolId, record.scope)] = record;
      });
      integrationsInstallRecords = next;
      refreshIntegrationsEligibility();
    })
      .catch(function () {
        integrationsInstallRecords = {};
      });
  }

  // Called on dialog open and on #integrations-rescan click — the only two places
  // that call skillInstallAPI().detectTools(). When the accessor returns null the
  // surface is absent in this build, so the failure box is rendered and a resolved
  // promise is returned, keeping both callers thenable. Also fetches a real
  // filesystem presence check (checkInstalledSkills) per eligible-at-Global-scope row,
  // so an already-installed target shows its status immediately without requiring
  // installSelected() to run first (ISS-11-sbxv53), and independent of this app's own
  // install-tracking ledger (ISS-12-yngl4x). Rows render as soon as detectTools()
  // resolves; each presence check is isolated behind its own .catch, so a failed probe
  // leaves that one tool without a presence entry while every other row keeps its own
  // result and stays on screen. A scope toggle
  // re-derives eligibility and chip visibility from the last-fetched rows/presence map
  // instead (refreshIntegrationsEligibility) — never a new IPC call.
  function loadIntegrationsDetection() {
    // `const`, not this file's usual `var`: TypeScript only keeps a null-narrowing
    // alive inside the nested .then callbacks below for an immutable binding.
    const api = skillInstallAPI();
    if (api === null) {
      renderIntegrationsFailure(
        "Couldn't detect installed tools",
        'The integrations service is not available in this build'
      );
      return Promise.resolve();
    }
    return api.detectTools().then(unwrapIpc).then(function (rows) {
      renderIntegrationsRows(rows);
      var checks = rows.map(function (row) {
        var basePath = resolveBasePathForScope({ kind: 'global' }, row.detection);
        if (basePath === null) return null;
        return api.checkInstalledSkills(
          { toolId: row.toolId, basePath: basePath, scope: { kind: 'global' } }
        )
          .then(unwrapIpc)
          .then(function (result) {
            integrationsSkillPresence[row.toolId] = result;
          })
          // ISS-26-abmbhc: one probe's failure must not reject the aggregate below
          // and route into the outer .catch, which would discard every correct row
          // that already rendered. A failed probe records no presence entry, so that
          // one tool falls back to the same unknown-presence state a tool with no
          // basePath already has: its install chip stays hidden. Every other row,
          // and Install selected, are untouched.
          .catch(function () { /* unknown presence for this tool only */ });
      });
      return Promise.all(checks).then(refreshIntegrationsEligibility);
    })
      .catch(function (err) {
        renderIntegrationsFailure("Couldn't detect installed tools", err.message);
      });
  }

  // Installs exactly the entries it is handed and renders each returned
  // InstallResult.status onto that row's own install-status chip. The caller owns
  // the selection: the Install selected button passes every checked, eligible row,
  // and a per-row Update button passes that one row, so both share one install path.
  //
  // GOTCHA (carried forward from this task's spec, not softened): once WS-42's engine is
  // real, clicking this performs REAL FILE WRITES on whatever machine runs the app — into
  // the real config directory a detected tool's catalogue entry resolves to (e.g.
  // ~/.cursor/, ~/.codeium/windsurf/, ~/.claude/, or opencode's real config dir), with
  // WS-42's placeholder/fixture getInstallContent, since real skill content is WS-44's job.
  // This is a genuine, user-visible filesystem side effect, not a simulated one — verify
  // only against a disposable/throwaway target, never a real, important tool config.
  function installIntegrationsSelected(entries: IntegrationsRowEntry[]) {
    // Guarded before the button is disabled, so an absent surface cannot leave
    // Install selected permanently disabled with nothing to re-enable it.
    var api = skillInstallAPI();
    if (api === null) {
      window.alert(
        "Couldn't install the selected tools. Detail: "
        + 'The integrations service is not available in this build'
      );
      return;
    }

    if (!entries.length) return;

    var targets = entries.map(function (entry) {
      // Non-null: every entry here passed isEligibleAtScope (checkbox not disabled),
      // which is defined as resolveBasePathForScope(...) !== null.
      var basePath = resolveBasePathForScope(currentIntegrationsScope, entry.row.detection)!;
      return { toolId: entry.row.toolId, basePath: basePath, scope: currentIntegrationsScope };
    });

    integrationsInstallSelectedButton.disabled = true;
    api.installSelected(targets)
      .then(unwrapIpc)
      .then(function (results) {
        results.forEach(function (result) {
          var entry = entries.filter(function (e) { return e.row.toolId === result.toolId; })[0];
          if (!entry) return;
          entry.installChip.textContent = INSTALL_STATUS_LABEL[result.status];
          entry.installChip.hidden = false;
          entry.hasLiveResult = true;
          // A successful install always installs the newest release, so that
          // release's tag is this row's version from here on. Only the SUCCESS
          // branch reaches this point — a rejected install leaves the map
          // untouched — and 'skipped-no-format' installed nothing, so it must not
          // move the version either. Re-deriving the row refreshes its version
          // chip and drops the update chip and button; hasLiveResult above already
          // guards the install chip from being overwritten.
          if (result.status !== 'skipped-no-format' && latestRelease !== null) {
            var installed = integrationsInstallRecords[
              installRecordKey(entry.row.toolId, currentIntegrationsScope)
            ];
            if (installed !== undefined) installed.version = latestRelease.tag;
            applyIntegrationsRowEligibility(entry);
          }
        });
      })
      .catch(function (err) {
        window.alert("Couldn't install the selected tools. Detail: " + err.message);
      })
      .then(function () {
        updateInstallSelectedButtonState();
      });
  }

  // Resets every piece of state this task owns, so nothing persists across a
  // close+reopen cycle (acceptance criterion 6). Task 5.1 extends this same
  // function for its own state: install-status chips and the checked selection are
  // torn down along with each row (integrationsRowEntries and the list's innerHTML,
  // below), and the install-selected button is put back into its default disabled
  // state.
  function resetIntegrationsModalState() {
    setIntegrationsScope('global');
    integrationsRowEntries = [];
    integrationsSkillPresence = {};
    // The update chip is derived state: latestRelease and integrationsInstallRecords
    // are its only two inputs, and both are cleared here, so a reopened dialog can
    // never show a stale 'Update available' before its fresh fetches land.
    latestRelease = null;
    byId('integrations-release').textContent = '';
    integrationsInstallRecords = {};
    integrationsList.innerHTML = '';
    integrationsInstallSelectedButton.disabled = true;
  }

  byId('manage-integrations-button').addEventListener('click', function () {
    populateIntegrationsProjectSelect();
    integrationsModal.showModal();
    loadLatestRelease();
    loadIntegrationsInstallRecords();
    loadIntegrationsDetection();
  });

  byId('integrations-modal-close').addEventListener('click', function () { integrationsModal.close(); });
  // Backdrop dismissal: a backdrop click targets the dialog element itself — same
  // e.target === modal check as app.ts:913's #ws-modal.
  integrationsModal.addEventListener('click', function (e) {
    if (e.target === integrationsModal) integrationsModal.close();
  });

  byId('integrations-rescan').addEventListener('click', function () {
    loadIntegrationsDetection();
  });

  integrationsInstallSelectedButton.addEventListener('click', function () {
    // The selection filter lives here, with the button that owns it — the install
    // function itself takes whatever row list its caller decides on.
    installIntegrationsSelected(integrationsRowEntries.filter(function (entry) {
      return entry.checkbox.checked && !entry.checkbox.disabled;
    }));
  });

  integrationsScopeSeg.addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button');
    if (!btn || !btn.dataset.scope) return;
    setIntegrationsScope(btn.dataset.scope as 'global' | 'project');
  });
  integrationsProjectSelect.addEventListener('change', function () {
    if (currentIntegrationsScope.kind === 'project') setIntegrationsScope('project');
  });

  // The dialog's native 'close' event fires uniformly for the close button, Escape,
  // and modal.close() from the backdrop handler above — one hook resets every path.
  integrationsModal.addEventListener('close', function () {
    resetIntegrationsModalState();
  });

  initAddProjectControl();
  loadProjects();
})();
