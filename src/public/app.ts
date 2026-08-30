// The entry module for board.html. esbuild bundles this file and everything it
// imports into dist/public/app.js, the page's only script. './browser-ipc-shim'
// comes first, so its fallback installs window.praxisAPI before any other module
// body runs; './app-version', './update-banner' and './theme-toggle' follow as
// side-effect imports with no binding, reproducing the order their script tags
// used to give them.
import './browser-ipc-shim';
import './app-version';
import './update-banner';
import './theme-toggle';
import { unwrapIpc } from './ipc-adapter';

(function () {
  var STATUS_ORDER = ['backlog', 'ready', 'in-progress', 'done', 'dropped'];
  var STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', ready: 'Ready', 'in-progress': 'In Progress', done: 'Done', dropped: 'Dropped' };
  var SEV_ORDER = ['critical', 'high', 'medium', 'low'];
  var SEV_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  var POLL_MS = 5000;
  // A plan body shows PLAN_BLOCK_LIMIT blocks before the Show more button, and
  // truncates only when it renders MORE than PLAN_TRUNCATE_THRESHOLD blocks.
  // The gap between the two guarantees at least 5 hidden blocks, so the count
  // cue never reads '1 more blocks' and needs no singular form.
  var PLAN_BLOCK_LIMIT = 12;
  var PLAN_TRUNCATE_THRESHOLD = 16;
  // Workstream id tail: a hyphen, the SEQUENCE NUMBER, then an OPTIONAL
  // six-character base-36 suffix, anchored at end of string. The suffix group
  // must stay OPTIONAL, because this app's own prxwork/ tree holds both
  // the bare WS-N and the suffixed WS-N-SUFFIX shape at once. The suffix is
  // non-capturing, so the digits stay at capture position 1. This mirrors
  // artefactIdNumber in src/lib/extract.ts; the shared fragment is not imported
  // here, because src/lib/ is Node-side server code and the browser bundle must
  // stay free of it.
  var WS_ID_TAIL = /-(\d+)(?:-[0-9a-z]{6})?$/;
  // Filter chip thresholds. A tag earns a chip only when at least TAG_MIN_COUNT
  // workstreams carry it AND it stays below TAG_MAX_SHARE of the board, so a
  // near-universal tag — which filters almost nothing out — never takes a slot.
  // At most TAG_MAX_CHIPS ranked chips show; an active tag is pinned on top of
  // that cap by the pin step in refreshFilterTags.
  var TAG_MIN_COUNT = 2;
  var TAG_MAX_SHARE = 0.30;
  var TAG_MAX_CHIPS = 10;
  // WS-57: the filter row is built and wired but stays hidden until WS-56's
  // fixes land. Set to true to reveal it again — this is the only switch.
  var FILTER_ROW_ENABLED = false;

  // module (IIFE) scope — survives every re-render
  var sortKey: string | undefined = 'id';
  var sortDir: string | undefined = 'asc';
  var query = '';
  // Filter state, in memory only — no URL parameter and no storage, exactly
  // like query. A presence map, not an array, so a card costs one property
  // read per render; this mirrors chainSet below.
  var activeTags: Record<string, true> = {};
  var blockedOnly = false;
  var workstreams: PraxisWorkstream[] = [];
  var issues: PraxisIssue[] = [];
  var lastBody: string | null = null;   // raw response text of the last applied payload
  var polling = false;                  // a request is in flight
  type SevMix = { critical: number; high: number; medium: number; low: number };
  var sevMix: Record<string, SevMix> | null = null;
  var flashId: string | null = null;    // card currently flashing after a dependency jump
  var flashTimer: number | null = null; // its pending clear timer
  var dependsOn: Record<string, string[]> = {};   // workstream ID → the IDs it declares
  var dependedBy: Record<string, string[]> = {};  // workstream ID → the IDs that declare it
  var chainRoot: string | null = null;            // clicked card, null when nothing is highlighted
  var chainSet: Record<string, true> | null = null; // its whole chain, null when nothing is highlighted
  var filterTags: { key: string; label: string; count: number }[] = []; // the chips now displayed
  var filterTagSig: string | null = null;         // their signature, null before the first build

  function el(tag: string, cls?: string | null, text?: string | null): HTMLElement {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function byId(id: string): HTMLElement { return document.getElementById(id)!; }
  function fmtDate(iso: string) { return iso || '—'; }
  function daysSince(iso: string) {
    if (!iso) return null;
    var then = new Date(iso + 'T00:00:00Z').getTime();
    return Math.floor((Date.now() - then) / 86400000);
  }

  function showLoadState(heading: string, detail: string) {
    var board = byId('board');
    board.innerHTML = '';
    var box = el('div', 'load-state');
    box.appendChild(el('h2', null, heading));
    box.appendChild(el('p', null, detail));
    var p = el('p');
    var link = el('a', null, '← Back to the project list') as HTMLAnchorElement;
    link.href = '/';
    p.appendChild(link);
    box.appendChild(p);
    board.appendChild(box);
  }

  /* ---------------- Board ---------------- */
  function wsIdNum(id: string) {
    var m = String(id).match(WS_ID_TAIL);
    var n = m ? Number(m[1]) : NaN;
    return Number.isFinite(n) ? n : 0;
  }

  function severityCmp(x: SevMix, y: SevMix) {
    return (x.critical - y.critical) || (x.high - y.high) || (x.medium - y.medium) || (x.low - y.low);
  }

  function dominantSeverity(mix: Record<string, number>): string | null {
    var found = SEV_ORDER.find(function (s) { return mix[s] > 0; });
    return found || null;
  }

  function matches(w: PraxisWorkstream, q: string) {
    if (!q) return true;
    var hay = (w.id + ' ' + w.title + ' ' + w.slug + ' ' + (w.tags || []).join(' ')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function isBlocked(w: PraxisWorkstream): boolean {
    return !!(w.blocked || '').trim();
  }

  // Tags reach the browser exactly as they were written in the frontmatter, so
  // the browser owns normalisation. Trim and lowercase only: no stemming, no
  // singular/plural folding, and no punctuation stripping.
  function tagKey(tag: string): string {
    return String(tag).trim().toLowerCase();
  }

  // The OR inside the tag axis. No active tag matches every workstream;
  // otherwise a workstream needs at least one of its own tags in the set.
  function tagMatch(w: PraxisWorkstream): boolean {
    if (!Object.keys(activeTags).length) return true;
    return (w.tags || []).some(function (t) { return activeTags[tagKey(t)] === true; });
  }

  function artefactTypeLabel(t: string) {
    return ({ plan: 'PLN', issuelist: 'IL', tasklist: 'TL', workstream: 'WS' } as Record<string, string>)[t] || t;
  }

  // The status indicator: a coloured dot and the status word, the pairing the
  // artefact row's plan branch has always used. The CALLER decides WHEN a status
  // deserves one; this decides only how one LOOKS. It names no specific status,
  // so every call site passes its own and no --st-* token name is duplicated
  // across them. The label is the raw status word, matching the plan branch and
  // #ws-modal-status; STATUS_LABEL stays on the column heads and the KPI chips.
  // The wrapper is not decoration: .dot-sm sets no display, so the dot needs a
  // flex parent of its own to keep its box inside the list-item item summary.
  function statusIndicator(status: string): HTMLElement {
    var wrap = el('span', 'st-ind');
    var dot = el('span', 'dot-sm');
    dot.style.background = 'var(--st-' + status + ')';
    wrap.appendChild(dot);
    wrap.appendChild(el('span', 'st-ind-label', status));
    return wrap;
  }

  // Scrolls the board to the card named by a dependency ID and flashes it.
  // A dangling ID — no card on the board — is a silent no-op by design.
  function jumpToDep(id: string): void {
    var target = document.querySelector('#board .card[data-ws="' + id + '"]') as HTMLElement | null;
    if (!target) return;
    // Clear any flash still running, so two rapid clicks leave one outline.
    if (flashTimer !== null) { clearTimeout(flashTimer); flashTimer = null; }
    if (flashId) {
      var prev = document.querySelector('#board .card[data-ws="' + flashId + '"]') as HTMLElement | null;
      if (prev) prev.classList.remove('is-flash');
      flashId = null;
    }
    target.classList.add('is-flash');
    flashId = id;
    flashTimer = setTimeout(function () {
      var still = document.querySelector('#board .card[data-ws="' + id + '"]') as HTMLElement | null;
      if (still) still.classList.remove('is-flash');
      flashId = null;
      flashTimer = null;
    }, 900);
    // One call covers both scrollers: the horizontal .board and the vertical .column-body.
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var behavior: ScrollBehavior = reduce ? 'auto' : 'smooth';
    target.scrollIntoView({ behavior: behavior, block: 'nearest', inline: 'nearest' });
  }

  // Rebuilds both edge maps from `workstreams` in one pass. An edge is recorded
  // only when both ends name a workstream that exists, so a dangling depends_on
  // entry never enters the graph. It touches no DOM.
  function buildDepIndex(): void {
    dependsOn = {};
    dependedBy = {};
    var known: Record<string, true> = {};
    workstreams.forEach(function (w) { known[w.id] = true; });
    workstreams.forEach(function (w) {
      if (!w.depends_on || !w.depends_on.length) return;
      w.depends_on.forEach(function (d) {
        if (!known[d]) return;
        if (!dependsOn[w.id]) dependsOn[w.id] = [];
        dependsOn[w.id].push(d);
        if (!dependedBy[d]) dependedBy[d] = [];
        dependedBy[d].push(w.id);
      });
    });
  }

  // Every ID reachable from `id` along dependsOn and dependedBy edges, in both
  // directions, `id` itself included. The visited map is consulted before every
  // push, so a cycle or a self-reference terminates. An ID with no edge — which
  // includes an ID that names no workstream — gives an empty but non-null map.
  // It touches no DOM and knows nothing about the highlight.
  function chainOf(id: string): Record<string, true> {
    var seen: Record<string, true> = {};
    if (!id || (!dependsOn[id] && !dependedBy[id])) return seen;
    seen[id] = true;
    var queue = [id];
    while (queue.length) {
      var cur = queue.shift()!;
      var next = (dependsOn[cur] || []).concat(dependedBy[cur] || []);
      next.forEach(function (n) {
        if (seen[n]) return;
        seen[n] = true;
        queue.push(n);
      });
    }
    return seen;
  }

  // The only writer of chainRoot and chainSet. It repaints the classes and never
  // calls renderBoard, which would rebuild the board under the click that ran it.
  function setChain(id: string | null): void {
    chainRoot = id;
    chainSet = id ? chainOf(id) : null;
    paintChain();
  }

  // Class-only pass over the cards currently on the board. It never re-renders,
  // never walks the graph and never opens the modal.
  function paintChain(): void {
    var cards = document.querySelectorAll('#board .card');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i] as HTMLElement;
      var id = card.dataset.ws || '';
      card.classList.toggle('is-chain', !!(id && chainSet && chainSet[id]));
      card.classList.toggle('is-chain-root', !!id && id === chainRoot);
    }
  }

  function buildCard(w: PraxisWorkstream) {
    // The highlight classes are seeded here, so a sort, search or data-change
    // re-render restores them with no post-render fix-up. buildCard only reads
    // this state; setChain is its only writer.
    var cls = 'card' + (w.status === 'dropped' ? ' is-dropped' : '');
    if (chainSet && chainSet[w.id]) cls += ' is-chain';
    if (w.id === chainRoot) cls += ' is-chain-root';
    var card = el('div', cls);
    card.tabIndex = 0;
    card.dataset.ws = w.id;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');

    var top = el('div', 'card-top');
    var idWrap = el('div', 'card-id');
    idWrap.style.display = 'flex';
    idWrap.style.alignItems = 'center';
    idWrap.style.gap = '4px';
    var dominant = dominantSeverity(sevMix![w.id]);
    if (dominant) {
      var sevDot = el('span', 'dot-sm');
      sevDot.style.background = 'var(--sev-' + dominant + ')';
      sevDot.title = SEV_LABEL[dominant] + ' severity (open issues)';
      idWrap.appendChild(sevDot);
    }
    idWrap.appendChild(document.createTextNode(w.id));
    top.appendChild(idWrap);
    var upd = el('div', 'card-id', fmtDate(w.updated));
    upd.style.fontWeight = '400';
    upd.style.color = 'var(--ink-faint)';
    top.appendChild(upd);
    card.appendChild(top);

    if (isBlocked(w)) {
      var blockedRow = el('div', 'card-blocked');
      var blockedPill = el('span', 'blocked-pill', 'Blocked');
      blockedPill.title = String(w.blocked).trim();
      blockedRow.appendChild(blockedPill);
      card.appendChild(blockedRow);
    }

    card.appendChild(el('div', 'card-title', w.title));

    if (w.tags && w.tags.length) {
      var tags = el('div', 'card-tags');
      w.tags.forEach(function (t) { tags.appendChild(el('span', 'tag', t)); });
      card.appendChild(tags);
    }

    if (w.artefacts && w.artefacts.length) {
      var arts = el('div', 'card-artefacts');
      w.artefacts.forEach(function (a) {
        var row = el('div', 'artefact-row');
        // The only new data the deep link needs. The row stays non-interactive:
        // no listener, no role and no tabIndex — the board's one delegated click
        // listener reads this attribute after it has resolved the card.
        row.dataset.artefactType = a.type;
        row.appendChild(el('span', 'a-id', artefactTypeLabel(a.type) + '·' + a.id.split('-')[1]));
        if (a.type === 'issuelist' || a.type === 'tasklist') {
          var barWrap = el('div', 'a-bar');
          var pct = a.total ? Math.round(100 * a.done! / a.total) : 0;
          var seg = el('span'); seg.style.width = pct + '%';
          if (a.status === 'dropped') seg.style.background = 'var(--st-dropped)';
          barWrap.appendChild(seg);
          row.appendChild(barWrap);
          row.appendChild(el('span', 'a-frac tab', a.done! + '/' + a.total!));
          // At 0 of N the bar's filled segment has zero width, so the badge and
          // the faded fraction are the only cue a dropped list gets here.
          if (a.status === 'dropped') {
            row.classList.add('is-dropped');
            row.appendChild(statusIndicator('dropped'));
          }
        } else {
          var dot = el('span', 'dot-sm');
          dot.style.background = 'var(--st-' + a.status + ')';
          row.appendChild(dot);
          row.appendChild(el('span', 'a-frac', a.status));
        }
        arts.appendChild(row);
      });
      card.appendChild(arts);
    }

    var foot = el('div', 'card-foot');
    foot.appendChild(el('span', 'updated', 'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated)));
    if (w.depends_on && w.depends_on.length) {
      // One clickable link per ID. The glyph and the separators are text nodes
      // inside the container, so only the IDs themselves are clickable.
      var deps = el('span', 'deps');
      deps.appendChild(document.createTextNode('⤷ '));
      w.depends_on.forEach(function (d, i) {
        if (i > 0) deps.appendChild(document.createTextNode(', '));
        var link = el('span', 'dep-link', d);
        link.dataset.dep = d;
        link.setAttribute('role', 'link');
        link.tabIndex = 0;
        deps.appendChild(link);
      });
      foot.appendChild(deps);
    }
    card.appendChild(foot);

    return card;
  }

  // Repaints the active class over the buttons already in the row. Active state
  // is always a class refresh, never a rebuild, so a chip rebuilt for a tag that
  // is still active comes back active.
  function syncFilterActive(): void {
    byId('filter-chips').querySelectorAll('button').forEach(function (b) {
      if (b.id === 'filter-blocked') b.classList.toggle('active', blockedOnly);
      else if (b.id === 'filter-clear') b.classList.remove('active');
      else b.classList.toggle('active', activeTags[b.dataset.tag || ''] === true);
    });
  }

  // Derives the chip row from the workstream data and nothing else. It is called
  // from applyData only — never from renderBoard, which runs on every keystroke
  // in the search box and on every sort click.
  function refreshFilterTags(): void {
    var counts: Record<string, number> = {};
    var labels: Record<string, string> = {};
    workstreams.forEach(function (w) {
      var seen: Record<string, true> = {};
      (w.tags || []).forEach(function (raw) {
        var key = tagKey(raw);
        if (!key || seen[key]) return;   // a repeated tag counts once per workstream
        seen[key] = true;
        counts[key] = (counts[key] || 0) + 1;
        if (labels[key] === undefined) labels[key] = String(raw);  // first raw form wins
      });
    });

    // PRUNE. A poll can drop a tag out of the data altogether. An active key with
    // no workstream behind it would filter the board to nothing, so clear it —
    // the same safety applyData already applies to chainRoot.
    Object.keys(activeTags).forEach(function (k) {
      if (counts[k] === undefined) delete activeTags[k];
    });

    var shown = Object.keys(counts).filter(function (k) {
      return counts[k] >= TAG_MIN_COUNT && counts[k] / workstreams.length < TAG_MAX_SHARE;
    });
    shown.sort(function (a, b) { return (counts[b] - counts[a]) || (a < b ? -1 : a > b ? 1 : 0); });
    shown = shown.slice(0, TAG_MAX_CHIPS);

    // PIN. A surviving active key keeps its chip even when it ranks below the cap
    // or under the count floor, so an applied filter is never left unclearable.
    // It is appended after the ranked set, which leaves that ranking undisturbed.
    Object.keys(activeTags).forEach(function (k) {
      if (shown.indexOf(k) === -1) shown.push(k);
    });

    filterTags = shown.map(function (k) { return { key: k, label: labels[k], count: counts[k] }; });

    // GUARD. Rebuild only when the displayed set itself changed. A poll that
    // changes something unrelated — an updated date — must leave this DOM alone,
    // so a chip under the pointer keeps its hover and its focus.
    var sig = shown.join('\n');
    if (sig !== filterTagSig) {
      filterTagSig = sig;
      var host = byId('filter-tags');
      host.textContent = '';
      filterTags.forEach(function (t) {
        var b = el('button', null, t.label) as HTMLButtonElement;
        b.type = 'button';
        b.dataset.tag = t.key;
        host.appendChild(b);
      });
    }
    syncFilterActive();
  }

  function renderBoard() {
    var board = byId('board');
    board.innerHTML = '';
    var q = query.trim().toLowerCase();
    // True when ANY axis is filtering, which is what an emptied column reports on.
    var filtering = !!q || blockedOnly || Object.keys(activeTags).length > 0;
    var visibleTotal = 0;

    var byStatus: Record<string, PraxisWorkstream[]> = {};
    STATUS_ORDER.forEach(function (s) { byStatus[s] = []; });
    workstreams.forEach(function (w) { (byStatus[w.status] || byStatus.backlog).push(w); });

    sevMix = {};
    workstreams.forEach(function (w) { sevMix![w.id] = { critical: 0, high: 0, medium: 0, low: 0 }; });
    issues.forEach(function (i) {
      if (i.status !== 'ready' && i.status !== 'in-progress') return;
      var mix = i.severity != null ? sevMix![i.workstream] : null;
      if (mix && mix[i.severity as keyof SevMix] !== undefined) mix[i.severity as keyof SevMix]++;
    });

    STATUS_ORDER.forEach(function (status) {
      // The three axes combine with AND; the OR lives inside tagMatch.
      var items = byStatus[status].filter(function (w) {
        return matches(w, q) && tagMatch(w) && (!blockedOnly || isBlocked(w));
      });
      visibleTotal += items.length;

      items.sort(function (a, b) {
        var cmp;
        if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
        else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
        else if (sortKey === 'created') cmp = a.created.localeCompare(b.created);
        else if (sortKey === 'updated') cmp = a.updated.localeCompare(b.updated);
        else cmp = severityCmp(sevMix![a.id], sevMix![b.id]);
        return sortDir === 'asc' ? cmp : -cmp;
      });

      var col = el('div', 'column');
      var head = el('div', 'column-head');
      var dot = el('span', 'dot'); dot.style.background = 'var(--st-' + status + ')';
      head.appendChild(dot);
      head.appendChild(el('span', 'name', STATUS_LABEL[status]));
      head.appendChild(el('span', 'count tab', String(items.length)));
      col.appendChild(head);

      var body = el('div', 'column-body');
      if (!items.length) {
        body.appendChild(el('div', 'column-empty', filtering ? 'No matches' : 'Empty'));
      } else {
        items.forEach(function (w) { body.appendChild(buildCard(w)); });
      }
      col.appendChild(body);
      board.appendChild(col);
    });

    byId('result-count').textContent = visibleTotal + ' / ' + workstreams.length + ' workstreams shown';
  }

  byId('sort-key-seg').addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    sortKey = btn.dataset.key;
    this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
    renderBoard();
  });
  byId('sort-dir-seg').addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button');
    if (!btn) return;
    sortDir = btn.dataset.dir;
    this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('active', b === btn); });
    renderBoard();
  });
  byId('search').addEventListener('input', function (e) {
    query = (e.target as HTMLInputElement).value;
    renderBoard();
  });
  // One delegated listener for the whole row, bound once. The chips are rebuilt
  // whenever the data changes, so a per-chip listener would have to be rebound
  // every time and would leak a handler on every rebuild.
  byId('filter-chips').addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!btn) return;
    if (btn.id === 'filter-clear') {
      // Both chip axes only. The search box keeps its text and the sort controls
      // keep their state; clearing with nothing active is a harmless re-render.
      activeTags = {};
      blockedOnly = false;
    } else if (btn.id === 'filter-blocked') {
      blockedOnly = !blockedOnly;
    } else if (btn.dataset.tag) {
      var key = btn.dataset.tag;
      if (activeTags[key]) delete activeTags[key];
      else activeTags[key] = true;
    } else {
      return;
    }
    syncFilterActive();
    renderBoard();
  });
  // The row ships hidden in board.html so it can land before it is wired. It is
  // wired now, so it becomes visible here — but only when the switch declared
  // at the top of this file is on. WS-57 holds the reveal back until WS-56's
  // fixes land, so the row stays hidden for the whole session while it is off.
  if (FILTER_ROW_ENABLED) byId('filter-chips').hidden = false;

  // A backgrounded tab is throttled by the browser (assumption 8, accepted):
  // this is the whole answer to it — one immediate poll on return, no worker,
  // no keepalive. The interval keeps running underneath; it is never cleared.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') pollOnce();
  });

  /* ---------------- Card detail modal ---------------- */
  // byId returns HTMLElement; showModal()/close() need the dialog type.
  var modal = byId('ws-modal') as HTMLDialogElement;
  var modalTabs = byId('ws-modal-tabs');
  // The tabs are declared exactly once, here, in tablist order. selectTab and
  // the tablist keydown handler both drive off this list, so neither carries a
  // literal tab name and neither is tied to a fixed number of tabs.
  var TABS = [
    { name: 'plan',   btn: byId('ws-tab-plan'),   panel: byId('ws-panel-plan') },
    { name: 'issues', btn: byId('ws-tab-issues'), panel: byId('ws-panel-issues') },
    { name: 'tasks',  btn: byId('ws-tab-tasks'),  panel: byId('ws-panel-tasks') }
  ];
  // Mirrors the initial ARIA state shipped in board.html: Issues is the default
  // selection even though Plan is first in the tablist.
  var currentTab = 'issues';
  var tabIssues = TABS[1].btn;
  var tabTasks = TABS[2].btn;
  var panelPlan = TABS[0].panel;
  var panelIssues = TABS[1].panel;
  var panelTasks = TABS[2].panel;

  // aria-selected, the roving tabindex and the panels' hidden attribute always
  // move together — the markup ships the initial state, this only toggles it.
  // One loop body sets all three, so that invariant is structural rather than
  // three pairs of assignments that can drift apart.
  // An unknown name falls back to index 0, which is now Plan rather than Issues.
  // No caller passes an unknown name, so no reachable behaviour changes.
  function selectTab(name: string, focusTab: boolean) {
    var idx = 0;
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].name === name) { idx = i; break; }
    }
    for (var j = 0; j < TABS.length; j++) {
      var on = j === idx;
      TABS[j].btn.setAttribute('aria-selected', on ? 'true' : 'false');
      TABS[j].btn.tabIndex = on ? 0 : -1;
      TABS[j].panel.hidden = !on;
    }
    currentTab = TABS[idx].name;
    if (focusTab) TABS[idx].btn.focus();
    // A deep link selects the tab before the fetch resolves; this is the call
    // site that covers that ordering.
    maybeBuildPlan();
  }

  function setPanelMessage(panel: HTMLElement, message: string) {
    panel.innerHTML = '';
    panel.appendChild(el('div', 'ws-modal-empty', message));
  }

  function setTabLabels(issueCount: number, taskCount: number) {
    tabIssues.textContent = 'Issues (' + issueCount + ')';
    tabTasks.textContent = 'Tasks (' + taskCount + ')';
  }

  // Presentation only — the underlying keys are never rewritten.
  function humanise(key: string) {
    var s = key.replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // Generic over PraxisYamlValue and deliberately blind to field names: the
  // Tasks tab reuses this unchanged, so a special case for `description` or
  // `severity` would be a bug the moment the prx schema grows a key.
  function renderValue(v: PraxisYamlValue): HTMLElement {
    if (typeof v === 'string') return el('p', 'ws-val', v);
    if (Array.isArray(v)) {
      var ul = el('ul', 'ws-list');
      v.forEach(function (entry) {
        var li = el('li');
        li.appendChild(renderValue(entry));
        ul.appendChild(li);
      });
      return ul;
    }
    return renderMap(v);
  }

  function renderMap(map: { [key: string]: PraxisYamlValue }): HTMLElement {
    var dl = el('dl', 'ws-fields');
    Object.keys(map).forEach(function (key) {
      // _raw is the parser's committed failure mode, not a debug affordance:
      // a shape the grammar could not read is shown rather than hidden.
      if (key === '_raw') {
        var rawVal = map[key];
        dl.appendChild(el('dt', 'ws-raw-label', 'Unparsed'));
        var rawDd = el('dd');
        rawDd.appendChild(el('pre', 'ws-raw', Array.isArray(rawVal) ? rawVal.join('\n') : String(rawVal)));
        dl.appendChild(rawDd);
        return;
      }
      dl.appendChild(el('dt', null, humanise(key)));
      var dd = el('dd');
      // A nested <dl> is valid HTML only inside a <dd>, never directly in a <dl>.
      dd.appendChild(renderValue(map[key]));
      dl.appendChild(dd);
    });
    return dl;
  }

  // `toggle` fires on every open AND every close, so the guard is the whole
  // point: an unguarded handler rebuilds the body each time and undoes the
  // reason <details> was chosen. Nothing is in the DOM until the first expand.
  function lazyBody(details: HTMLElement, build: () => HTMLElement) {
    var built = false;
    details.addEventListener('toggle', function () {
      if (built) return;
      built = true;
      details.appendChild(build());
    });
  }

  function buildSection(artefact: PraxisDetailArtefact): HTMLElement {
    var sec = el('section', 'ws-section');
    var head = el('div', 'ws-section-head');
    head.appendChild(el('span', 'ws-section-id', artefact.id));
    head.appendChild(el('h3', 'ws-section-title', artefact.title));
    if (artefact.status === 'dropped') {
      sec.classList.add('is-dropped');
      head.appendChild(statusIndicator('dropped'));
    }
    sec.appendChild(head);
    return sec;
  }

  // Shared summary row for every collapsible item, issue or task alike.
  function buildItem(checked: boolean, id: string, title: string, fields: Record<string, PraxisYamlValue>, status?: string): HTMLElement {
    var d = el('details', 'ws-item');
    var sum = el('summary', 'ws-item-summary');
    sum.appendChild(el('span', 'ws-check' + (checked ? ' is-checked' : ''), checked ? '✓' : '○'));
    sum.appendChild(el('span', 'ws-item-id', id));
    sum.appendChild(el('span', 'ws-item-title', title));
    if (status === 'dropped') {
      d.classList.add('is-dropped');
      sum.appendChild(statusIndicator('dropped'));
    }
    d.appendChild(sum);
    lazyBody(d, function () { return renderMap(fields); });
    return d;
  }

  // Deferred build. A plan body is the largest thing this modal can hold, so it
  // is built only once the Plan tab is actually shown. null means the detail has
  // not been fetched yet; [] means it was fetched and held no plan.
  var planData: PraxisPlanDetail[] | null = null;
  var planBuilt = false;

  // Called from both renderDetail and selectTab, because either can happen
  // first. The planBuilt guard makes it build exactly once per modal open.
  function maybeBuildPlan() {
    if (planBuilt || planData === null || currentTab !== 'plan') return;
    planBuilt = true;
    renderPlanPanel(planData);
  }

  // A block-level Markdown SUBSET, and nothing more. It takes a string and
  // returns one element: it knows nothing about tabs, panels, artefacts,
  // fetching or the modal. Every node is emitted through el(), so textContent
  // stays the only path from file content to the DOM — there is no innerHTML
  // content write and no string-built markup anywhere below.
  // Deliberately NOT parsed: inline markup, so backticks, `**` pairs and link
  // brackets survive as literal characters; and pipe tables, which fall through
  // as one paragraph per row rather than becoming a real <table>.
  // One forward pass, no backtracking, so it stays linear in file size — the
  // corpus maximum is 1570 lines and 90 KB. collectItems() in
  // src/lib/detail.ts is the precedent for the walk.
  function renderPlanBlocks(body: string): HTMLElement {
    var root = el('div', 'ws-plan');
    var lines = body.split('\n');
    var para: string[] = [];              // the open paragraph run, if any
    var list: HTMLElement | null = null;  // the open <ul> or <ol>, if any

    // Plan prose is hard-wrapped near 100 characters, so the source line ends
    // are presentational. Joining with a single space lets the panel width
    // decide where the text breaks instead.
    function flushPara() {
      if (!para.length) return;
      root.appendChild(el('p', null, para.join(' ')));
      para = [];
    }
    function flushAll() { flushPara(); list = null; }

    var i = 0;
    while (i < lines.length) {
      var line = lines[i];

      // Fence state is tested BEFORE anything else. Inside a fence no line is
      // interpreted, which is the whole defence against a bash `# comment` in a
      // code block reading as a heading.
      if (/^\s*```/.test(line)) {
        flushAll();
        var start = i + 1;
        var end = start;
        while (end < lines.length && !/^\s*```\s*$/.test(lines[end])) end++;
        // The fence info string is dropped rather than written to a class: a
        // language tag is file content, and file content must never reach an
        // attribute — it would also collide with the page's own CSS names.
        // .ws-raw is the code treatment this file already ships; the plan body
        // reuses it rather than inventing a second one.
        root.appendChild(el('pre', 'ws-raw', lines.slice(start, end).join('\n')));
        // An unterminated fence runs to the end of the body. collectItems() in
        // src/lib/detail.ts deliberately does the opposite and treats such an
        // opener as ordinary text; that rule exists there to stop an opener
        // swallowing item lines, and there are no item lines here. Running to
        // the end matches CommonMark. Both rules are lossless.
        i = end + 1;
        continue;
      }

      // A blank line closes any open run.
      if (!line.trim()) { flushAll(); i++; continue; }

      // Headings start at <h4>: the section header above is already an <h3>
      // inside the modal's <h2>. Three source levels map to three output
      // levels, so the visual hierarchy survives.
      var h = /^\s*(#{1,6})\s+(.*)$/.exec(line);
      if (h) {
        flushAll();
        var tag = h[1].length <= 2 ? 'h4' : (h[1].length === 3 ? 'h5' : 'h6');
        root.appendChild(el(tag, null, h[2].trim()));
        i++;
        continue;
      }

      // The rule is tested BEFORE the list rules, so `* * *` cannot be read as
      // a list item. `---` could not match a list rule anyway, because the list
      // rules below require a space after the marker.
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.replace(/\s+/g, ''))) {
        flushAll();
        root.appendChild(el('hr'));
        i++;
        continue;
      }

      // Nested list indentation is flattened: a run becomes ONE flat list, and
      // only 73 of 1559 corpus list lines are indented at all.
      var ul = /^\s*[-*+]\s+(.*)$/.exec(line);
      if (ul) {
        flushPara();
        if (!list || list.tagName !== 'UL') { list = el('ul'); root.appendChild(list); }
        list.appendChild(el('li', null, ul[1].trim()));
        i++;
        continue;
      }
      var ol = /^\s*(\d+)[.)]\s+(.*)$/.exec(line);
      if (ol) {
        flushPara();
        if (!list || list.tagName !== 'OL') {
          list = el('ol');
          // start comes from the first number, or a list that does not begin at
          // 1 is silently renumbered.
          (list as HTMLOListElement).start = parseInt(ol[1], 10) || 1;
          root.appendChild(list);
        }
        list.appendChild(el('li', null, ol[2].trim()));
        i++;
        continue;
      }

      // A pipe line ends the current run and becomes its own paragraph.
      // Without this break the paragraph joiner fuses a whole table into one
      // unreadable line of pipes.
      if (line.trim().charAt(0) === '|') {
        flushAll();
        root.appendChild(el('p', null, line.trim()));
        i++;
        continue;
      }

      // Everything else joins the paragraph run. A `> ` blockquote line lands
      // here too and keeps its literal `> `.
      list = null;
      para.push(line.trim());
      i++;
    }

    flushAll();
    return root;
  }

  // Truncation lives here and not in renderPlanBlocks, so the renderer keeps
  // its single responsibility. This helper knows only a section and a .ws-plan
  // root — nothing about plans, markdown, tabs, panels or the modal.
  function appendPlanBody(sec: HTMLElement, root: HTMLElement): void {
    sec.appendChild(root);
    // A short plan renders whole and gets no button.
    if (root.children.length <= PLAN_TRUNCATE_THRESHOLD) return;
    // root.children is a live HTMLCollection. Collect the surplus in one loop,
    // then remove it in a second one — removing while reading skips nodes.
    var held: Element[] = [];
    var k = 0;
    for (k = PLAN_BLOCK_LIMIT; k < root.children.length; k++) held.push(root.children[k]);
    for (k = 0; k < held.length; k++) root.removeChild(held[k]);
    var more = el('button', 'ws-plan-more', 'Show more');
    more.setAttribute('type', 'button');
    more.appendChild(el('span', 'ws-plan-more-count', held.length + ' more blocks'));
    // One shot: the held nodes go back into root, never into sec, because every
    // plan-body rule in styles.css is scoped under .ws-plan.
    more.addEventListener('click', function () {
      for (var j = 0; j < held.length; j++) root.appendChild(held[j]);
      more.remove();
    });
    sec.appendChild(more);
  }

  // Two plan files means two sections in the ONE Plan tab, matching the Issues
  // and Tasks panels.
  function renderPlanPanel(plans: PraxisPlanDetail[]) {
    panelPlan.innerHTML = '';
    // No plan file at all — the majority case, and not an error.
    if (!plans.length) {
      setPanelMessage(panelPlan, 'No plan in this workstream. The modal looked for a plan file in its folder and found none.');
      return;
    }
    plans.forEach(function (item) {
      var sec = buildSection(item.artefact);
      appendPlanBody(sec, renderPlanBlocks(item.body));
      panelPlan.appendChild(sec);
    });
  }

  // Two files means two sections in the ONE Issues tab — never a third tab.
  function renderIssuesPanel(lists: PraxisIssueListDetail[]) {
    panelIssues.innerHTML = '';
    // (a) No issue-list file at all — the common case, and not an error.
    if (!lists.length) {
      setPanelMessage(panelIssues, 'No issue list in this workstream. The modal looked for an issue list file in its folder and found none.');
      return;
    }
    lists.forEach(function (list) {
      var sec = buildSection(list.artefact);
      var body = el('div', 'ws-items');
      // (b) The file is there but yielded nothing — worth saying plainly,
      // because it is the signal that item recognition failed on real input.
      if (!list.items.length) {
        body.appendChild(el('div', 'ws-modal-empty', 'This issue list is present but produced no items — nothing in it was recognised as an issue entry.'));
      } else {
        list.items.forEach(function (item) {
          body.appendChild(buildItem(item.checked, item.id, item.title, item.fields, item.status));
        });
      }
      sec.appendChild(body);
      panelIssues.appendChild(sec);
    });
  }

  // A parent group. Its description renders inline through the same generic
  // renderer — parents carry description only, so there is no field set to
  // build — and its children follow as summary rows. Both are deferred to the
  // first expand: building 27 child rows up front for a fixture nobody has
  // opened yet is exactly what the <details> discipline exists to avoid.
  function buildTaskGroup(task: PraxisTaskDetail): HTMLElement {
    var d = el('details', 'ws-item ws-task-group');
    var sum = el('summary', 'ws-item-summary');
    sum.appendChild(el('span', 'ws-check' + (task.checked ? ' is-checked' : ''), task.checked ? '✓' : '○'));
    sum.appendChild(el('span', 'ws-item-id', task.number));
    sum.appendChild(el('span', 'ws-item-title', task.title));
    // renderTasksPanel is the only caller and reaches here only when
    // task.children.length is non-zero, so the cue never reads '0 subtasks'
    // and needs no guard of its own.
    var n = task.children.length;
    sum.appendChild(el('span', 'ws-task-count', n + (n === 1 ? ' subtask' : ' subtasks')));
    d.appendChild(sum);
    lazyBody(d, function () {
      var body = el('div', 'ws-task-group-body');
      var desc = task.fields.description;
      if (desc !== undefined) {
        var box = el('div', 'ws-task-desc');
        box.appendChild(renderValue(desc));
        body.appendChild(box);
      }
      var kids = el('div', 'ws-task-children');
      task.children.forEach(function (child) {
        // buildItem, unchanged — a child's own body stays unbuilt until that
        // child is expanded, so expanding a parent costs rows, not field sets.
        kids.appendChild(buildItem(child.checked, child.number, child.title, child.fields));
      });
      body.appendChild(kids);
      return body;
    });
    return d;
  }

  // Two task lists in one workstream means two sections in the ONE Tasks tab.
  function renderTasksPanel(lists: PraxisTaskListDetail[]) {
    panelTasks.innerHTML = '';
    // (c) No task-list file at all — the common case, and not an error.
    if (!lists.length) {
      setPanelMessage(panelTasks, 'No task list in this workstream. The modal looked for a task list file in its folder and found none.');
      return;
    }
    lists.forEach(function (list) {
      var sec = buildSection(list.artefact);
      var body = el('div', 'ws-items');
      // (d) The file is there but yielded nothing — the same diagnostic
      // signal as (b), for the task side.
      if (!list.tasks.length) {
        body.appendChild(el('div', 'ws-modal-empty', 'This task list is present but produced no items — nothing in it was recognised as a task line.'));
      } else {
        list.tasks.forEach(function (task) {
          // A top-level entry with no children — a flat file's task, or a
          // promoted orphan — renders as an ordinary item so its full field
          // set stays reachable. Only a real parent becomes a group.
          body.appendChild(task.children.length
            ? buildTaskGroup(task)
            : buildItem(task.checked, task.number, task.title, task.fields));
        });
      }
      sec.appendChild(body);
      panelTasks.appendChild(sec);
    });
  }

  // Parents and children alike, which is the same set of lines countChecks
  // counts for the card's done/total fraction — counting only leaves would put
  // one number in the modal and a different one on the card behind it.
  function countTasks(lists: PraxisTaskListDetail[]): number {
    var n = 0;
    lists.forEach(function (list) {
      list.tasks.forEach(function (task) { n += 1 + task.children.length; });
    });
    return n;
  }

  function renderDetail(detail: PraxisWorkstreamDetail) {
    // textContent everywhere — every value here came out of a file.
    byId('ws-modal-id').textContent = detail.id;
    byId('ws-modal-title').textContent = detail.title;
    byId('ws-modal-status').textContent = detail.archived ? detail.status + ' · archived' : detail.status;

    var issueCount = 0;
    (detail.issueLists || []).forEach(function (l) { issueCount += l.items.length; });
    setTabLabels(issueCount, countTasks(detail.taskLists || []));

    renderIssuesPanel(detail.issueLists || []);
    renderTasksPanel(detail.taskLists || []);

    // A plain open resolves the fetch before the Plan tab is ever selected;
    // this is the call site that covers that ordering.
    planData = detail.plans || [];
    maybeBuildPlan();
  }

  function renderModalMeta(w: PraxisWorkstream | undefined) {
    var sevDot = byId('ws-modal-sev-dot');
    var tagsEl = byId('ws-modal-tags');
    var datesEl = byId('ws-modal-dates');
    var descEl = byId('ws-modal-description');
    var descMoreEl = byId('ws-modal-description-more');
    var blockedEl = byId('ws-modal-blocked');
    var blockedReasonEl = byId('ws-modal-blocked-reason');
    var metaScrollEl = byId('ws-modal-meta-scroll');
    tagsEl.innerHTML = '';
    if (!w) {
      sevDot.hidden = true;
      sevDot.removeAttribute('title');
      tagsEl.hidden = true;
      blockedReasonEl.textContent = '';
      blockedEl.hidden = true;
      descEl.textContent = '';
      descEl.classList.add('is-clamped');
      descEl.hidden = true;
      descMoreEl.hidden = true;
      metaScrollEl.hidden = true;
      datesEl.textContent = '';
      return;
    }
    var dominant = dominantSeverity(sevMix![w.id]);
    if (dominant) {
      sevDot.style.background = 'var(--sev-' + dominant + ')';
      sevDot.title = SEV_LABEL[dominant] + ' severity (open issues)';
      sevDot.hidden = false;
    } else {
      sevDot.hidden = true;
      sevDot.removeAttribute('title');
    }
    if (w.tags && w.tags.length) {
      w.tags.forEach(function (t) { tagsEl.appendChild(el('span', 'tag', t)); });
      tagsEl.hidden = false;
    } else {
      tagsEl.hidden = true;
    }
    if (isBlocked(w)) {
      blockedReasonEl.textContent = String(w.blocked).trim();
      blockedEl.hidden = false;
    } else {
      blockedReasonEl.textContent = '';
      blockedEl.hidden = true;
    }
    var desc = w.body ? w.body.trim() : '';
    if (desc) {
      descEl.textContent = desc;
      descEl.classList.add('is-clamped');
      descEl.hidden = false;
      descMoreEl.hidden = true;
    } else {
      descEl.textContent = '';
      descEl.classList.add('is-clamped');
      descEl.hidden = true;
      descMoreEl.hidden = true;
    }
    datesEl.textContent = 'created ' + fmtDate(w.created) + ' · updated ' + fmtDate(w.updated);
    metaScrollEl.hidden = blockedEl.hidden && descEl.hidden;
  }

  // Show the reveal button only when the clamped paragraph really overflows.
  // This must run after modal.showModal(): a <dialog> without the open
  // attribute is display: none, so both height reads return 0 before it.
  // The +1 absorbs sub-pixel rounding between the two integer readings; one
  // real extra line is a whole line-height, far above that tolerance.
  function syncDescriptionOverflow(): void {
    var descEl = byId('ws-modal-description');
    var moreEl = byId('ws-modal-description-more');
    if (descEl.hidden) {
      moreEl.hidden = true;
      return;
    }
    moreEl.hidden = descEl.scrollHeight <= descEl.clientHeight + 1;
  }

  // initialTab is the tab this open lands on. Every caller states it, so a
  // reopen still never inherits the last session's tab.
  function openModal(wsId: string, initialTab: string) {
    renderModalMeta(workstreams.find(function (ws) { return ws.id === wsId; }));
    byId('ws-modal-id').textContent = wsId;
    byId('ws-modal-title').textContent = 'Loading…';
    byId('ws-modal-status').textContent = '';
    setTabLabels(0, 0);
    // Reset the deferred plan state before anything can call maybeBuildPlan,
    // so a second card never shows the first card's plan.
    planData = null;
    planBuilt = false;
    setPanelMessage(panelPlan, 'Loading…');
    setPanelMessage(panelIssues, 'Loading…');
    setPanelMessage(panelTasks, 'Loading…');
    // Set from the caller, never from the last session's tab, so a reopen
    // never inherits it. The plan state was reset just above, so the
    // planBuilt guard still lets the panel build exactly once per open,
    // whichever tab this selects first.
    selectTab(initialTab, false);
    // showModal() supplies focus containment, an inert background,
    // Escape-to-close, ::backdrop and focus restoration — none of it hand-rolled.
    modal.showModal();
    syncDescriptionOverflow();

    // Refetched on every open; no client-side caching (assumption A6).
    // projectParam is what scopes the modal to the board's own project.
    window.praxisAPI.getWorkstreamDetail(projectParam!, wsId)
      .then(unwrapIpc)
      .then(renderDetail)
      .catch(function (err) {
        byId('ws-modal-title').textContent = "Couldn't load this workstream";
        setPanelMessage(panelPlan, err.message);
        setPanelMessage(panelIssues, err.message);
        setPanelMessage(panelTasks, err.message);
      });
  }

  // One delegated listener each, on #board — renderBoard() rebuilds
  // board.innerHTML on every sort, direction and search change, so per-card
  // listeners would be re-created continuously and leak.
  byId('board').addEventListener('click', function (e) {
    // A dependency link jumps to its target. The early return is the whole
    // mechanism that keeps the modal closed — propagation is left alone.
    var dep = (e.target as HTMLElement).closest('.dep-link') as HTMLElement | null;
    if (dep && dep.dataset.dep) { jumpToDep(dep.dataset.dep); return; }
    var card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    // A miss means the click landed on column or board background, which clears
    // the chain highlight. A hit highlights the chain and then opens the modal.
    if (!card || !card.dataset.ws) { setChain(null); return; }
    setChain(card.dataset.ws);
    // A click on the PLN row deep-links to the Plan tab. Anywhere else on the
    // card keeps the Issues default. The row itself has no listener.
    var row = (e.target as HTMLElement).closest('.artefact-row') as HTMLElement | null;
    openModal(card.dataset.ws, row && row.dataset.artefactType === 'plan' ? 'plan' : 'issues');
  });
  byId('board').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var depK = (e.target as HTMLElement).closest('.dep-link') as HTMLElement | null;
    if (depK && depK.dataset.dep) { e.preventDefault(); jumpToDep(depK.dataset.dep); return; }
    var card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!card || !card.dataset.ws) return;
    e.preventDefault();   // Space on a focused card would otherwise scroll the page.
    // The card is the focus target and the row is not, so there is no row
    // context to read here. A keyboard reader reaches the plan with one Tab
    // and one ArrowLeft inside the modal.
    setChain(card.dataset.ws);
    openModal(card.dataset.ws, 'issues');
  });

  modalTabs.addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button');
    if (!btn || !btn.dataset.tab) return;
    selectTab(btn.dataset.tab, true);
  });
  modalTabs.addEventListener('keydown', function (e) {
    var idx = 0;
    for (var i = 0; i < TABS.length; i++) {
      if (TABS[i].name === currentTab) { idx = i; break; }
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      // + (TABS.length - 1) is a left step that stays non-negative, so one
      // modulo wraps in both directions for any number of tabs.
      var step = e.key === 'ArrowRight' ? 1 : TABS.length - 1;
      selectTab(TABS[(idx + step) % TABS.length].name, true);
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab(TABS[0].name, true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab(TABS[TABS.length - 1].name, true);
    }
  });

  byId('ws-modal-close').addEventListener('click', function () { modal.close(); });
  // Registered once here, never per open: the button is static markup, so a
  // per-open registration would stack a listener on every card click.
  // One shot only — the reveal removes the clamp class and there is no
  // collapse path.
  byId('ws-modal-description-more').addEventListener('click', function () {
    byId('ws-modal-description').classList.remove('is-clamped');
    byId('ws-modal-description-more').hidden = true;
  });
  // Backdrop dismissal: a backdrop click targets the dialog element itself,
  // which is why #ws-modal carries no padding (styles.css).
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });

  // #live-status has exactly two states, no third: live (with the time of the
  // last successful poll) and not updating. textContent only, never innerHTML.
  function setLiveStatus(isLive: boolean) {
    var status = byId('live-status');
    if (isLive) {
      status.textContent = 'Live · updated ' + new Date().toLocaleTimeString();
      status.classList.remove('is-stale');
    } else {
      status.textContent = 'Not updating';
      status.classList.add('is-stale');
    }
  }

  // Poll: re-fetch the board's data on an interval and re-apply only when the
  // raw response bytes differ from what is already rendered.
  function pollOnce() {
    if (polling) return;
    polling = true;
    window.praxisAPI.getProjectData(projectParam!)
      .then(unwrapIpc)
      .then(function (data) {
        var stringified = JSON.stringify(data);
        if (stringified === lastBody) {
          setLiveStatus(true);
          return;
        }
        lastBody = stringified;
        var board = byId('board');
        var scrollLeft = board.scrollLeft;
        applyData(data);
        board.scrollLeft = scrollLeft;
        setLiveStatus(true);
      })
      .catch(function () {
        // A poll failure must leave the current render untouched: this deliberately
        // differs from the initial load's showLoadState-on-failure path below.
        // Replacing the board with a load-state panel is right for a first load with
        // nothing to show, and wrong for a refresh with a perfectly good render
        // already on screen.
        setLiveStatus(false);
      })
      .finally(function () { polling = false; });
  }

  var projectParam = new URLSearchParams(location.search).get('project');

  if (!projectParam) {
    showLoadState('No project selected', 'This board renders one project at a time. Pick one from the project list to open its board.');
  } else {
    window.praxisAPI.getProjectData(projectParam)
      .then(unwrapIpc)
      .then(function (data) {
        lastBody = JSON.stringify(data);
        applyData(data);
        setLiveStatus(true);
        setInterval(pollOnce, POLL_MS);
      })
      .catch(function (err) {
        showLoadState("Couldn't load this project", err.message);
      });
  }

  // applyData is idempotent. Calling it twice with the same payload leaves the DOM in the same
  // state as calling it once. Every renderer it invokes clears its own container before appending.
  // It binds no event listeners.
  function applyData(raw: BoardPayload) {
    workstreams = raw.workstreams || [];
    issues = raw.issues || [];
    // The graph is rebuilt exactly where the data changes, not in renderBoard,
    // which runs on every keystroke in the search box.
    buildDepIndex();

    // A poll can drop the highlighted workstream out of the data. Clear a root
    // that no longer names a workstream, and otherwise recompute the chain from
    // the new graph. This runs before the renderBoard() call below, so buildCard
    // seeds the right classes. A root hidden by the search filter is still in
    // the data and keeps its highlight.
    if (chainRoot) {
      var root = chainRoot;
      var rootLives = workstreams.some(function (w) { return w.id === root; });
      setChain(rootLives ? root : null);
    }

    // The chip row is derived where the data changes, for the same reason the
    // graph above is. It prunes a vanished active tag, pins a surviving one, and
    // rebuilds the chips only when the displayed set changed.
    refreshFilterTags();

    byId('gen-date').textContent = raw.generated || '—';
    byId('board-title').textContent = raw.source
      ? raw.source.split('/').pop()!
      : 'Board';
    if (raw.branch) {
      byId('branch-name').textContent = raw.branch;
      byId('branch-line').hidden = false;
    }
    byId('lower').hidden = false;

    function collectStale() {
      var out: any[] = [];
      workstreams.forEach(function (w) {
        (w.artefacts || []).forEach(function (a) {
          if (a.status !== 'in-progress') return;
          var d = daysSince(a.updated);
          if (d != null && d >= 14) out.push({ id: a.id, workstream: w.id, title: w.title, slug: w.slug, days: d });
        });
        if (w.status === 'in-progress') {
          var d2 = daysSince(w.updated);
          if (d2 != null && d2 >= 14) out.push({ id: w.id, workstream: w.id, title: w.title, slug: w.slug, days: d2 });
        }
      });
      out.sort(function (a, b) { return b.days - a.days; });
      return out;
    }

    /* ---------------- KPI strip ---------------- */
    (function renderKpis() {
      var strip = byId('kpi-strip');
      strip.innerHTML = '';

      var wsByStatus: Record<string, number> = {};
      STATUS_ORDER.forEach(function (s) { wsByStatus[s] = 0; });
      workstreams.forEach(function (w) { wsByStatus[w.status] = (wsByStatus[w.status] || 0) + 1; });

      var k1 = el('div', 'kpi');
      k1.appendChild(el('div', 'kpi-label', 'Workstreams'));
      k1.appendChild(el('div', 'kpi-value tab', String(workstreams.length)));
      var bar1 = el('div', 'kpi-bar');
      STATUS_ORDER.forEach(function (s) {
        if (!wsByStatus[s]) return;
        var seg = el('span');
        seg.style.width = (100 * wsByStatus[s] / workstreams.length) + '%';
        seg.style.background = 'var(--st-' + s + ')';
        seg.title = STATUS_LABEL[s] + ': ' + wsByStatus[s];
        bar1.appendChild(seg);
      });
      k1.appendChild(bar1);
      var chips1 = el('div', 'kpi-chips');
      STATUS_ORDER.forEach(function (s) {
        if (!wsByStatus[s]) return;
        var c = el('span', 'chip', STATUS_LABEL[s] + ' ' + wsByStatus[s]);
        c.style.background = 'var(--st-' + s + '-bg)';
        c.style.color = 'var(--st-' + s + ')';
        chips1.appendChild(c);
      });
      // Blocked overlaps the status counts above rather than adding to them, so the
      // chip is appended last and carries a tooltip that says so. It is inert by design.
      var blockedCount = workstreams.filter(isBlocked).length;
      if (blockedCount > 0) {
        var bc = el('span', 'chip', 'Blocked ' + blockedCount);
        bc.style.background = 'color-mix(in srgb, var(--sev-critical) 16%, var(--paper-raised))';
        bc.style.color = 'var(--sev-critical)';
        bc.title = 'Blocked workstreams overlap the status counts above rather than adding to them — a blocked workstream also sits at one of the five statuses.';
        chips1.appendChild(bc);
      }
      k1.appendChild(chips1);
      strip.appendChild(k1);

      var openIssues = issues.filter(function (i) { return i.status === 'ready' || i.status === 'in-progress'; });
      var k2 = el('div', 'kpi');
      k2.appendChild(el('div', 'kpi-label', 'Open issues'));
      k2.appendChild(el('div', 'kpi-value tab', String(openIssues.length)));
      k2.appendChild(el('div', 'kpi-sub', issues.length + ' filed total across all issue lists'));
      var sevCounts: Record<string, number> = {};
      SEV_ORDER.forEach(function (s) { sevCounts[s] = 0; });
      openIssues.forEach(function (i) { if (i.severity != null && sevCounts[i.severity] != null) sevCounts[i.severity]++; });
      var chips2 = el('div', 'kpi-chips');
      SEV_ORDER.forEach(function (s) {
        if (!sevCounts[s]) return;
        var c = el('span', 'chip', SEV_LABEL[s] + ' ' + sevCounts[s]);
        c.style.background = 'color-mix(in srgb, var(--sev-' + s + ') 16%, var(--paper-raised))';
        c.style.color = 'var(--sev-' + s + ')';
        chips2.appendChild(c);
      });
      k2.appendChild(chips2);
      strip.appendChild(k2);

      var tlDone = 0, tlTotal = 0, tlCount = 0;
      workstreams.forEach(function (w) {
        (w.artefacts || []).forEach(function (a) {
          if (a.type === 'tasklist') {
            tlCount++;
            tlDone += (a.done || 0);
            tlTotal += (a.total || 0);
          }
        });
      });
      var pct = tlTotal ? Math.round(100 * tlDone / tlTotal) : 0;
      var k3 = el('div', 'kpi');
      k3.appendChild(el('div', 'kpi-label', 'Task completion'));
      k3.appendChild(el('div', 'kpi-value tab', pct + '%'));
      k3.appendChild(el('div', 'kpi-sub tab', tlDone.toLocaleString() + ' / ' + tlTotal.toLocaleString() + ' tasks across ' + tlCount + ' task lists'));
      var bar3 = el('div', 'kpi-bar');
      var seg3 = el('span'); seg3.style.width = pct + '%'; seg3.style.background = 'var(--accent)';
      bar3.appendChild(seg3);
      k3.appendChild(bar3);
      strip.appendChild(k3);

      var staleItems = collectStale();
      var k4 = el('div', 'kpi');
      k4.appendChild(el('div', 'kpi-label', 'Needs attention'));
      k4.appendChild(el('div', 'kpi-value tab', String(staleItems.length)));
      k4.appendChild(el('div', 'kpi-sub', 'in-progress artefacts untouched 14+ days'));
      strip.appendChild(k4);
    })();

    /* ---------------- Attention panel ---------------- */
    (function renderAttention() {
      var stale = collectStale();
      byId('attn-count').textContent = stale.length as unknown as string;
      var list = byId('attn-list');
      list.innerHTML = '';
      if (!stale.length) {
        list.appendChild(el('div', 'attn-empty', 'Nothing in progress has gone quiet — everything active has moved in the last two weeks.'));
        return;
      }
      stale.slice(0, 12).forEach(function (item) {
        var row = el('div', 'attn-row');
        row.appendChild(el('div', 'a-days tab', item.days + 'd'));
        var what = el('div', 'a-what');
        var line = el('span');
        var idSpan = el('span'); idSpan.style.fontFamily = 'var(--font-mono)'; idSpan.style.fontWeight = '600'; idSpan.textContent = item.id;
        line.appendChild(idSpan);
        line.appendChild(document.createTextNode('  ' + item.title));
        what.appendChild(line);
        what.appendChild(el('span', 'a-title', item.slug));
        row.appendChild(what);
        list.appendChild(row);
      });
    })();

    /* ---------------- Severity panel ---------------- */
    (function renderSeverity() {
      var openIssues = issues.filter(function (i) { return i.status === 'ready' || i.status === 'in-progress'; });
      byId('sev-total').textContent = openIssues.length + ' open';
      var counts: Record<string, number> = {};
      SEV_ORDER.forEach(function (s) { counts[s] = 0; });
      openIssues.forEach(function (i) { if (i.severity != null && counts[i.severity] != null) counts[i.severity]++; });

      var sevBtn = document.querySelector('#sort-key-seg button[data-key="severity"]') as HTMLElement | null;
      if (sevBtn) {
        var dominant = dominantSeverity(counts);
        var dot = sevBtn.querySelector('.dot-sm') as HTMLElement | null;
        if (dominant) {
          if (!dot) {
            dot = el('span', 'dot-sm');
            sevBtn.insertBefore(dot, sevBtn.firstChild);
          }
          dot.style.background = 'var(--sev-' + dominant + ')';
          sevBtn.title = 'Worst open severity, board-wide: ' + SEV_LABEL[dominant];
        } else if (dot) {
          dot.remove();
          sevBtn.removeAttribute('title');
        }
      }

      var bar = byId('sev-bar');
      var legend = byId('sev-legend');
      bar.innerHTML = '';
      legend.innerHTML = '';
      SEV_ORDER.forEach(function (s) {
        if (!counts[s]) return;
        var seg = el('span');
        seg.style.width = (100 * counts[s] / openIssues.length) + '%';
        seg.style.background = 'var(--sev-' + s + ')';
        seg.title = SEV_LABEL[s] + ': ' + counts[s];
        bar.appendChild(seg);

        var row = el('div', 'sev-legend-row');
        var sw = el('span', 'sw'); sw.style.background = 'var(--sev-' + s + ')';
        row.appendChild(sw);
        row.appendChild(el('span', 'label', SEV_LABEL[s]));
        row.appendChild(el('span', 'val tab', String(counts[s])));
        legend.appendChild(row);
      });
    })();

    renderBoard();
  }
})();
