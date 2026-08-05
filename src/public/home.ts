(function () {
  var ABSOLUTE_PATH_MESSAGE = 'Path must be absolute — enter a full path starting with /';
  var TILDE_MESSAGE = '~ is not expanded — enter the full absolute path instead';

  function el(tag: string, cls?: string | null, text?: string | null): HTMLElement {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function byId(id: string): HTMLElement { return document.getElementById(id)!; }

  function setError(message: string) {
    byId('add-error').textContent = message;
  }

  // Clears its container before appending: this runs again after every successful add.
  function renderTiles(projects: ProjectEntry[]) {
    var host = byId('project-tiles');
    host.innerHTML = '';

    if (!projects.length) {
      var empty = el('div', 'tiles-empty');
      empty.appendChild(el('h3', null, 'No projects yet'));
      empty.appendChild(el('p', null,
        'Add the absolute path of any directory that contains a prxwork/ folder, using the form below.'));
      host.appendChild(empty);
      return;
    }

    projects.forEach(function (p) {
      var tile = document.createElement('a');
      tile.className = 'tile';
      tile.href = '/board.html?project=' + encodeURIComponent(p.id);
      tile.appendChild(el('span', 'tile-name', p.name));
      tile.appendChild(el('span', 'tile-path', p.path));
      tile.appendChild(el('span', 'tile-added', 'Added ' + p.added));
      host.appendChild(tile);
    });
  }

  function loadProjects() {
    return fetch('/api/projects', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (list: ProjectList) {
        renderTiles(list.projects || []);
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
      setError('Enter the absolute path of a directory containing a prxwork/ folder');
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

    fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: value })
    })
      .then(function (r) {
        return r.json().then(function (body: any) {
          if (!r.ok) throw new Error(body && body.error ? body.error : 'HTTP ' + r.status);
          return body;
        }, function () {
          throw new Error('HTTP ' + r.status);
        });
      })
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

  loadProjects();
})();
