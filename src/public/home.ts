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

  // Carries the HTTP status alongside the message, so a caller can tell one failure
  // status from another. A rejected fetch chain otherwise arrives as a bare Error and
  // the status is lost by the time the .catch runs.
  function httpError(status: number, message: string): Error & { status: number } {
    var err = new Error(message) as Error & { status: number };
    err.status = status;
    return err;
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
      var renameButton = el('button', 'tile-action', 'Rename') as HTMLButtonElement;
      renameButton.type = 'button';
      renameButton.setAttribute('aria-label', 'Rename ' + p.name);
      var deleteButton = el('button', 'tile-action', 'Delete') as HTMLButtonElement;
      deleteButton.type = 'button';
      deleteButton.setAttribute('aria-label', 'Delete ' + p.name);
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
          fetch('/api/projects/' + encodeURIComponent(p.id), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: nameInput.value })
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

        fetch('/api/projects/' + encodeURIComponent(p.id), { method: 'DELETE' })
          .then(function (r) {
            return r.json().then(function (body: any) {
              if (!r.ok) throw httpError(r.status, body && body.error ? body.error : 'HTTP ' + r.status);
              return body;
            }, function () {
              throw httpError(r.status, 'HTTP ' + r.status);
            });
          })
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
