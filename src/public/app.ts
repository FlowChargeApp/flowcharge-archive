(function () {
  var STATUS_ORDER = ['backlog', 'ready', 'in-progress', 'blocked', 'done', 'dropped'];
  var STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', ready: 'Ready', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped' };
  var SEV_ORDER = ['critical', 'high', 'medium', 'low'];
  var SEV_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
  var POLL_MS = 5000;

  // module (IIFE) scope — survives every re-render
  var sortKey: string | undefined = 'id';
  var sortDir: string | undefined = 'asc';
  var query = '';
  var workstreams: PraxisWorkstream[] = [];
  var issues: PraxisIssue[] = [];
  var lastBody: string | null = null;   // raw response text of the last applied payload
  var polling = false;                  // a request is in flight
  type SevMix = { critical: number; high: number; medium: number; low: number };
  var sevMix: Record<string, SevMix> | null = null;

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
  function wsIdNum(id: string) { return parseInt(String(id).replace(/\D+/g, ''), 10) || 0; }

  function severityCmp(x: SevMix, y: SevMix) {
    return (y.critical - x.critical) || (y.high - x.high) || (y.medium - x.medium) || (y.low - x.low);
  }

  function matches(w: PraxisWorkstream, q: string) {
    if (!q) return true;
    var hay = (w.id + ' ' + w.title + ' ' + w.slug + ' ' + (w.tags || []).join(' ')).toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function artefactTypeLabel(t: string) {
    return ({ plan: 'PLN', issuelist: 'IL', tasklist: 'TL', workstream: 'WS' } as Record<string, string>)[t] || t;
  }

  function buildCard(w: PraxisWorkstream) {
    var card = el('div', 'card' + (w.status === 'dropped' ? ' is-dropped' : ''));
    card.tabIndex = 0;
    card.dataset.ws = w.id;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');

    var top = el('div', 'card-top');
    top.appendChild(el('div', 'card-id', w.id));
    var upd = el('div', 'card-id', fmtDate(w.updated));
    upd.style.fontWeight = '400';
    upd.style.color = 'var(--ink-faint)';
    top.appendChild(upd);
    card.appendChild(top);

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
        row.appendChild(el('span', 'a-id', artefactTypeLabel(a.type) + '·' + a.id.split('-')[1]));
        if (a.type === 'issuelist' || a.type === 'tasklist') {
          var barWrap = el('div', 'a-bar');
          var pct = a.total ? Math.round(100 * a.done! / a.total) : 0;
          var seg = el('span'); seg.style.width = pct + '%';
          if (a.status === 'dropped') seg.style.background = 'var(--st-dropped)';
          barWrap.appendChild(seg);
          row.appendChild(barWrap);
          row.appendChild(el('span', 'a-frac tab', a.done! + '/' + a.total!));
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
    foot.appendChild(el('span', 'updated', 'updated ' + fmtDate(w.updated)));
    if (w.depends_on && w.depends_on.length) {
      foot.appendChild(el('span', 'deps', '⤷ ' + w.depends_on.join(', ')));
    }
    card.appendChild(foot);

    return card;
  }

  function renderBoard() {
    var board = byId('board');
    board.innerHTML = '';
    var q = query.trim().toLowerCase();
    var visibleTotal = 0;

    var byStatus: Record<string, PraxisWorkstream[]> = {};
    STATUS_ORDER.forEach(function (s) { byStatus[s] = []; });
    workstreams.forEach(function (w) { (byStatus[w.status] || byStatus.backlog).push(w); });

    if (sortKey === 'severity') {
      sevMix = {};
      workstreams.forEach(function (w) { sevMix![w.id] = { critical: 0, high: 0, medium: 0, low: 0 }; });
      issues.forEach(function (i) {
        if (i.status !== 'ready' && i.status !== 'in-progress') return;
        var mix = i.severity != null ? sevMix![i.workstream] : null;
        if (mix && mix[i.severity as keyof SevMix] !== undefined) mix[i.severity as keyof SevMix]++;
      });
    }

    STATUS_ORDER.forEach(function (status) {
      var items = byStatus[status].filter(function (w) { return matches(w, q); });
      visibleTotal += items.length;

      items.sort(function (a, b) {
        var cmp;
        if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
        else if (sortKey === 'name') cmp = a.title.localeCompare(b.title);
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
        body.appendChild(el('div', 'column-empty', q ? 'No matches' : 'Empty'));
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
  var tabIssues = byId('ws-tab-issues');
  var tabTasks = byId('ws-tab-tasks');
  var panelIssues = byId('ws-panel-issues');
  var panelTasks = byId('ws-panel-tasks');

  // aria-selected, the roving tabindex and the panels' hidden attribute always
  // move together — the markup ships the initial state, this only toggles it.
  function selectTab(name: string, focusTab: boolean) {
    var isIssues = name !== 'tasks';
    tabIssues.setAttribute('aria-selected', isIssues ? 'true' : 'false');
    tabTasks.setAttribute('aria-selected', isIssues ? 'false' : 'true');
    tabIssues.tabIndex = isIssues ? 0 : -1;
    tabTasks.tabIndex = isIssues ? -1 : 0;
    panelIssues.hidden = !isIssues;
    panelTasks.hidden = isIssues;
    if (focusTab) (isIssues ? tabIssues : tabTasks).focus();
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
    sec.appendChild(head);
    return sec;
  }

  // Shared summary row for every collapsible item, issue or task alike.
  function buildItem(checked: boolean, id: string, title: string, fields: Record<string, PraxisYamlValue>): HTMLElement {
    var d = el('details', 'ws-item');
    var sum = el('summary', 'ws-item-summary');
    sum.appendChild(el('span', 'ws-check' + (checked ? ' is-checked' : ''), checked ? '✓' : '○'));
    sum.appendChild(el('span', 'ws-item-id', id));
    sum.appendChild(el('span', 'ws-item-title', title));
    d.appendChild(sum);
    lazyBody(d, function () { return renderMap(fields); });
    return d;
  }

  // Two files means two sections in the ONE Issues tab — never a third tab.
  function renderIssuesPanel(lists: PraxisIssueListDetail[]) {
    panelIssues.innerHTML = '';
    // (a) No issue-list file at all — the common case, and not an error.
    if (!lists.length) {
      setPanelMessage(panelIssues, 'No issue list in this workstream. The modal looked for a prxissuelist file in its folder and found none.');
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
          body.appendChild(buildItem(item.checked, item.id, item.title, item.fields));
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
      setPanelMessage(panelTasks, 'No task list in this workstream. The modal looked for a prxtasklist file in its folder and found none.');
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
  }

  function openModal(wsId: string) {
    byId('ws-modal-id').textContent = wsId;
    byId('ws-modal-title').textContent = 'Loading…';
    byId('ws-modal-status').textContent = '';
    setTabLabels(0, 0);
    setPanelMessage(panelIssues, 'Loading…');
    setPanelMessage(panelTasks, 'Loading…');
    // Reset to Issues so a reopen never inherits the last session's tab.
    selectTab('issues', false);
    // showModal() supplies focus containment, an inert background,
    // Escape-to-close, ::backdrop and focus restoration — none of it hand-rolled.
    modal.showModal();

    // Refetched on every open; no client-side caching (assumption A6).
    // projectParam is what scopes the modal to the board's own project.
    fetch('/api/projects/' + encodeURIComponent(projectParam!) + '/workstreams/' + encodeURIComponent(wsId) + '/detail', { cache: 'no-store' })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().then(
          function (body) { throw new Error((body && body.error) || 'HTTP ' + r.status); },
          function () { throw new Error('HTTP ' + r.status); }
        );
      })
      .then(renderDetail)
      .catch(function (err) {
        byId('ws-modal-title').textContent = "Couldn't load this workstream";
        setPanelMessage(panelIssues, err.message);
        setPanelMessage(panelTasks, err.message);
      });
  }

  // One delegated listener each, on #board — renderBoard() rebuilds
  // board.innerHTML on every sort, direction and search change, so per-card
  // listeners would be re-created continuously and leak.
  byId('board').addEventListener('click', function (e) {
    var card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!card || !card.dataset.ws) return;
    openModal(card.dataset.ws);
  });
  byId('board').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
    var card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!card || !card.dataset.ws) return;
    e.preventDefault();   // Space on a focused card would otherwise scroll the page.
    openModal(card.dataset.ws);
  });

  modalTabs.addEventListener('click', function (e) {
    var btn = (e.target as HTMLElement).closest('button');
    if (!btn || !btn.dataset.tab) return;
    selectTab(btn.dataset.tab, true);
  });
  modalTabs.addEventListener('keydown', function (e) {
    var onIssues = tabIssues.getAttribute('aria-selected') === 'true';
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      selectTab(onIssues ? 'tasks' : 'issues', true);   // two tabs, so either arrow wraps
    } else if (e.key === 'Home') {
      e.preventDefault();
      selectTab('issues', true);
    } else if (e.key === 'End') {
      e.preventDefault();
      selectTab('tasks', true);
    }
  });

  byId('ws-modal-close').addEventListener('click', function () { modal.close(); });
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
    fetch(dataUrl, { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (text) {
        if (text === lastBody) {
          setLiveStatus(true);
          return;
        }
        lastBody = text;
        var board = byId('board');
        var scrollLeft = board.scrollLeft;
        applyData(JSON.parse(text));
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
    var dataUrl = '/api/projects/' + encodeURIComponent(projectParam) + '/data';
    fetch(dataUrl, { cache: 'no-store' })
      .then(function (r) {
        if (r.ok) return r.text();
        // Every API failure answers with a JSON { error } string; surface that verbatim,
        // falling back to the status code if the body itself cannot be parsed.
        return r.json().then(
          function (body) { throw new Error((body && body.error) || 'HTTP ' + r.status); },
          function () { throw new Error('HTTP ' + r.status); }
        );
      })
      .then(function (text) {
        lastBody = text;
        applyData(JSON.parse(text));
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

    byId('gen-date').textContent = raw.generated || '—';
    byId('tagline').textContent = raw.source
      ? 'Workstream state · ' + raw.source.split('/').pop()
      : 'Workstream state';
    byId('meta-counts').textContent =
      workstreams.length + ' workstreams · ' + issues.length + ' issues';
    if (raw.branch) {
      byId('branch-name').textContent = raw.branch;
      byId('branch-line').style.display = '';
    }
    byId('lower').style.display = '';

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
