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

  loadProjects();
})();
