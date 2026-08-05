(function () {
  var STATUS_ORDER = ['backlog', 'ready', 'in-progress', 'blocked', 'done', 'dropped'];
  var STATUS_LABEL: Record<string, string> = { backlog: 'Backlog', ready: 'Ready', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done', dropped: 'Dropped' };
  var SEV_ORDER = ['critical', 'high', 'medium', 'low'];
  var SEV_LABEL: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };

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

  fetch('./data.json', { cache: 'no-store' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(boot)
    .catch(function (err) {
      var board = byId('board');
      board.innerHTML = '';
      var box = el('div', 'load-state');
      box.appendChild(el('h2', null, "Couldn't load data.json"));
      var p = el('p', null, 'Generate it first, from this folder:');
      box.appendChild(p);
      var pre = el('pre', null, 'npm run refresh -- --root /path/to/your/praxis/project');
      box.appendChild(pre);
      var p2 = el('p', null, 'Detail: ' + err.message);
      box.appendChild(p2);
      board.appendChild(box);
    });

  function boot(raw: PraxisData) {
    var workstreams = raw.workstreams || [];
    var issues = raw.issues || [];

    byId('gen-date').textContent = raw.generated || '—';
    byId('tagline').textContent = raw.source
      ? 'Workstream state · ' + raw.source.split('/').pop()
      : 'Workstream state';
    byId('meta-counts').textContent =
      workstreams.length + ' workstreams · ' + issues.length + ' issues';
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

    /* ---------------- Board ---------------- */
    var sortKey: string | undefined = 'id';
    var sortDir: string | undefined = 'asc';
    var query = '';

    function wsIdNum(id: string) { return parseInt(String(id).replace(/\D+/g, ''), 10) || 0; }

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

      STATUS_ORDER.forEach(function (status) {
        var items = byStatus[status].filter(function (w) { return matches(w, q); });
        visibleTotal += items.length;

        items.sort(function (a, b) {
          var cmp;
          if (sortKey === 'id') cmp = wsIdNum(a.id) - wsIdNum(b.id);
          else cmp = a.title.localeCompare(b.title);
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

    renderBoard();
  }
})();
