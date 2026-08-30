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
  InstallResult,
  PraxisSkillInstallAPI,
  SkillPresenceResult,
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
          'Remove "' + p.name + '" from the dashboard?\n\n' +
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
  // Open/close, tab-switch, scope-toggle, project-picker population, and (from Task
  // 4.1 on) real detectTools() row rendering. No installSelected() call lives here
  // yet — that starts at Task 5.1.

  // byId returns HTMLElement; showModal()/close() need the dialog type — same cast
  // pattern app.ts:353 uses for #ws-modal.
  var integrationsModal = byId('integrations-modal') as HTMLDialogElement;
  var integrationsTabsEl = byId('integrations-tabs');
  var integrationsScopeSeg = byId('integrations-scope-seg');
  var integrationsProjectSelect = byId('integrations-project-select') as HTMLSelectElement;

  // Declared once, in tablist order — selectIntegrationsTab and the tablist keydown
  // handler both drive off this list, matching app.ts:358-362's own TABS pattern,
  // adapted from three tabs down to these two.
  var INTEGRATIONS_TABS = [
    { name: 'cli', btn: integrationsTabsEl.querySelector('[data-tab="cli"]') as HTMLButtonElement,
      panel: byId('integrations-panel-cli') },
    { name: 'gui-app', btn: integrationsTabsEl.querySelector('[data-tab="gui-app"]') as HTMLButtonElement,
      panel: byId('integrations-panel-gui-app') }
  ];
  var currentIntegrationsTab = 'cli';

  // aria-selected, the roving tabindex and the panel's hidden attribute always move
  // together, exactly like app.ts:378-394's own selectTab.
  function selectIntegrationsTab(name: string, focusTab: boolean) {
    var idx = 0;
    for (var i = 0; i < INTEGRATIONS_TABS.length; i++) {
      if (INTEGRATIONS_TABS[i].name === name) { idx = i; break; }
    }
    for (var j = 0; j < INTEGRATIONS_TABS.length; j++) {
      var on = j === idx;
      INTEGRATIONS_TABS[j].btn.setAttribute('aria-selected', on ? 'true' : 'false');
      INTEGRATIONS_TABS[j].btn.tabIndex = on ? 0 : -1;
      INTEGRATIONS_TABS[j].panel.hidden = !on;
    }
    currentIntegrationsTab = INTEGRATIONS_TABS[idx].name;
    if (focusTab) INTEGRATIONS_TABS[idx].btn.focus();
  }

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

  type IntegrationsRowEntry = {
    row: ToolDetectionRow;
    rowEl: HTMLElement;
    checkbox: HTMLInputElement;
    notes: HTMLElement;
    installChip: HTMLElement;
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
  // A scope toggle re-derives chip visibility from this map client-side; it never
  // triggers a new checkInstalledSkills() call. Only ever populated at Global scope —
  // see applyIntegrationsRowEligibility's currentIntegrationsScope.kind === 'global'
  // gate, and task list Divergence 2.
  var integrationsSkillPresence: Record<string, SkillPresenceResult> = {};

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

    var notes = el('div', 'integrations-row-notes');
    rowEl.appendChild(notes);

    return {
      row: row,
      rowEl: rowEl,
      checkbox: checkbox,
      notes: notes,
      installChip: installChip,
      hasLiveResult: false
    };
  }

  // Visible text only, never a hover-only title — both the ineligibility label and
  // the unverified-path note must be readable without hovering.
  function applyIntegrationsRowEligibility(entry: IntegrationsRowEntry) {
    var eligible = isEligibleAtScope(currentIntegrationsScope, entry.row.detection);
    entry.checkbox.disabled = !eligible;
    entry.notes.innerHTML = '';
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
      // checkInstalledSkills is only ever fetched at Global scope (loadIntegrationsDetection,
      // below) — showing its result under Project scope would be a stale, wrong-scope
      // result mislabelled as current. Hide the chip outright at Project scope instead
      // (a deliberate, bounded scope limit — see task list Divergence 2 — not a bug).
      var presence = currentIntegrationsScope.kind === 'global'
        ? integrationsSkillPresence[entry.row.toolId]
        : undefined;
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

  // Rebuilds both tabpanels from a fresh detectTools() payload — one row per
  // TOOL_CATALOGUE entry, placed into its own category's panel, matching the four
  // rows the handler always returns (electron/agentic-tools-ipc-handlers.cts maps
  // every catalogue entry, not just the ones a DetectionResult was found for).
  function renderIntegrationsRows(rows: ToolDetectionRow[]) {
    var panelCli = byId('integrations-panel-cli');
    var panelGuiApp = byId('integrations-panel-gui-app');
    panelCli.innerHTML = '';
    panelGuiApp.innerHTML = '';

    integrationsRowEntries = rows.map(buildIntegrationsRow);
    integrationsRowEntries.forEach(function (entry) {
      var panel = entry.row.category === 'gui-app' ? panelGuiApp : panelCli;
      panel.appendChild(entry.rowEl);
      applyIntegrationsRowEligibility(entry);
    });
    // Every freshly-built row starts unchecked, but a stale disabled state from a
    // previous render must not linger on the button either way.
    updateInstallSelectedButtonState();
  }

  // Called on dialog open and on #integrations-rescan click — the only two places
  // that call window.praxisSkillInstallAPI.detectTools(). Also fetches a real
  // filesystem presence check (checkInstalledSkills) per eligible-at-Global-scope row,
  // so an already-installed target shows its status immediately without requiring
  // installSelected() to run first (ISS-11-sbxv53), and independent of this app's own
  // install-tracking ledger (ISS-12-yngl4x). Rows render as soon as detectTools()
  // resolves; the presence checks fill in their chips once all resolve. A scope toggle
  // re-derives eligibility and chip visibility from the last-fetched rows/presence map
  // instead (refreshIntegrationsEligibility) — never a new IPC call.
  function loadIntegrationsDetection() {
    return window.praxisSkillInstallAPI.detectTools().then(unwrapIpc).then(function (rows) {
      renderIntegrationsRows(rows);
      var checks = rows.map(function (row) {
        var basePath = resolveBasePathForScope({ kind: 'global' }, row.detection);
        if (basePath === null) return null;
        return window.praxisSkillInstallAPI.checkInstalledSkills(
          { toolId: row.toolId, basePath: basePath, scope: { kind: 'global' } }
        )
          .then(unwrapIpc)
          .then(function (result) {
            integrationsSkillPresence[row.toolId] = result;
          });
      });
      return Promise.all(checks).then(refreshIntegrationsEligibility);
    })
      .catch(function (err) {
        integrationsRowEntries = [];
        integrationsSkillPresence = {};
        var panelCli = byId('integrations-panel-cli');
        var panelGuiApp = byId('integrations-panel-gui-app');
        panelCli.innerHTML = '';
        panelGuiApp.innerHTML = '';
        var box = el('div', 'tiles-empty');
        box.appendChild(el('h3', null, "Couldn't detect installed tools"));
        box.appendChild(el('p', null, 'Detail: ' + err.message));
        panelCli.appendChild(box);
        updateInstallSelectedButtonState();
      });
  }

  // Collects every checked, eligible row and calls installSelected() with them, then
  // renders each returned InstallResult.status onto that row's own install-status chip.
  //
  // GOTCHA (carried forward from this task's spec, not softened): once WS-42's engine is
  // real, clicking this performs REAL FILE WRITES on whatever machine runs the app — into
  // the real config directory a detected tool's catalogue entry resolves to (e.g.
  // ~/.cursor/, ~/.codeium/windsurf/, ~/.claude/, or opencode's real config dir), with
  // WS-42's placeholder/fixture getInstallContent, since real skill content is WS-44's job.
  // This is a genuine, user-visible filesystem side effect, not a simulated one — verify
  // only against a disposable/throwaway target, never a real, important tool config.
  function installIntegrationsSelected() {
    var eligibleEntries = integrationsRowEntries.filter(function (entry) {
      return entry.checkbox.checked && !entry.checkbox.disabled;
    });
    if (!eligibleEntries.length) return;

    var targets = eligibleEntries.map(function (entry) {
      // Non-null: every entry here passed isEligibleAtScope (checkbox not disabled),
      // which is defined as resolveBasePathForScope(...) !== null.
      var basePath = resolveBasePathForScope(currentIntegrationsScope, entry.row.detection)!;
      return { toolId: entry.row.toolId, basePath: basePath, scope: currentIntegrationsScope };
    });

    integrationsInstallSelectedButton.disabled = true;
    window.praxisSkillInstallAPI.installSelected(targets)
      .then(unwrapIpc)
      .then(function (results) {
        results.forEach(function (result) {
          var entry = eligibleEntries.filter(function (e) { return e.row.toolId === result.toolId; })[0];
          if (!entry) return;
          entry.installChip.textContent = INSTALL_STATUS_LABEL[result.status];
          entry.installChip.hidden = false;
          entry.hasLiveResult = true;
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
  // torn down along with each row (integrationsRowEntries/panel innerHTML, below), and
  // the install-selected button is put back into its default disabled state.
  function resetIntegrationsModalState() {
    selectIntegrationsTab('cli', false);
    setIntegrationsScope('global');
    integrationsRowEntries = [];
    integrationsSkillPresence = {};
    byId('integrations-panel-cli').innerHTML = '';
    byId('integrations-panel-gui-app').innerHTML = '';
    integrationsInstallSelectedButton.disabled = true;
  }

  byId('manage-integrations-button').addEventListener('click', function () {
    populateIntegrationsProjectSelect();
    integrationsModal.showModal();
    loadIntegrationsDetection();
  });

  integrationsTabsEl.addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button');
    if (!btn || !btn.dataset.tab) return;
    selectIntegrationsTab(btn.dataset.tab, true);
  });
  integrationsTabsEl.addEventListener('keydown', function (e) {
    var idx = 0;
    for (var i = 0; i < INTEGRATIONS_TABS.length; i++) {
      if (INTEGRATIONS_TABS[i].name === currentIntegrationsTab) { idx = i; break; }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      // + (INTEGRATIONS_TABS.length - 1) is a left step that stays non-negative, so
      // one modulo wraps in both directions — same arithmetic as app.ts:895-900.
      var step = e.key === 'ArrowRight' ? 1 : INTEGRATIONS_TABS.length - 1;
      selectIntegrationsTab(INTEGRATIONS_TABS[(idx + step) % INTEGRATIONS_TABS.length].name, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectIntegrationsTab(INTEGRATIONS_TABS[0].name, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectIntegrationsTab(INTEGRATIONS_TABS[INTEGRATIONS_TABS.length - 1].name, true);
    }
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
    installIntegrationsSelected();
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
