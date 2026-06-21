(function () {
  'use strict';

  var PAGE_SIZE = 50;
  var _currentPage = 1;
  var _filteredEntries = [];

  /* ─── helpers ─── */

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function monthStartStr() {
    var d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }

  function fmtDuration(min) {
    if (min == null || isNaN(min)) return '—';
    var h = Math.floor(min / 60);
    var m = Math.round(min % 60);
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
  }

  function fmtTotalHours(entries) {
    var total = entries.reduce(function (acc, e) { return acc + (e.duration_min || 0); }, 0);
    return fmtDuration(total);
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─── category select population ─── */

  function populateCategoryFilter() {
    var sel = document.getElementById('hist-category-filter');
    if (!sel) return;
    var current = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    var cats = (window.Storage && window.Storage.getConfig().categories) || [];
    cats.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      sel.appendChild(opt);
    });
    sel.value = current;
  }

  /* ─── filter & render ─── */

  function getFilterValues() {
    var from = document.getElementById('hist-date-from');
    var to = document.getElementById('hist-date-to');
    var search = document.getElementById('hist-search');
    var cat = document.getElementById('hist-category-filter');
    return {
      from: (from && from.value) || monthStartStr(),
      to: (to && to.value) || todayStr(),
      search: (search && search.value.trim().toLowerCase()) || '',
      category: (cat && cat.value) || ''
    };
  }

  function applyFilters() {
    var f = getFilterValues();
    var entries = (window.Storage && window.Storage.getEntriesByRange(f.from, f.to)) || [];

    if (f.search) {
      entries = entries.filter(function (e) {
        return (e.task && e.task.toLowerCase().indexOf(f.search) >= 0) ||
               (e.notes && e.notes.toLowerCase().indexOf(f.search) >= 0);
      });
    }

    if (f.category) {
      entries = entries.filter(function (e) { return e.category === f.category; });
    }

    // sort descending by date then start
    entries.sort(function (a, b) {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      if ((a.start || '') > (b.start || '')) return -1;
      if ((a.start || '') < (b.start || '')) return 1;
      return 0;
    });

    _filteredEntries = entries;
    _currentPage = 1;
    renderTable();
  }

  function renderTable() {
    var wrapper = document.getElementById('history-table');
    var paginationEl = document.getElementById('history-pagination');
    if (!wrapper) return;

    var entries = _filteredEntries;
    var totalPages = Math.ceil(entries.length / PAGE_SIZE) || 1;
    if (_currentPage > totalPages) _currentPage = totalPages;

    var start = (_currentPage - 1) * PAGE_SIZE;
    var pageEntries = entries.slice(start, start + PAGE_SIZE);

    // clear previous table (keep empty placeholder)
    var oldTable = wrapper.querySelector('table');
    if (oldTable) oldTable.remove();
    var oldFooter = wrapper.querySelector('.history-footer');
    if (oldFooter) oldFooter.remove();

    var emptyEl = document.getElementById('history-empty');
    if (entries.length === 0) {
      if (emptyEl) emptyEl.style.display = '';
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML =
      '<thead>' +
      '<tr>' +
      '<th>Fecha</th>' +
      '<th>Inicio</th>' +
      '<th>Fin</th>' +
      '<th>Duración</th>' +
      '<th>Tarea</th>' +
      '<th>Categoría</th>' +
      '<th>Notas</th>' +
      '<th class="col-actions">Acciones</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="history-tbody"></tbody>';
    wrapper.appendChild(table);

    var tbody = table.querySelector('tbody');
    pageEntries.forEach(function (entry) {
      var tr = document.createElement('tr');
      tr.dataset.id = entry.id;
      tr.innerHTML =
        '<td data-label="Fecha">' + escHtml(entry.date) + '</td>' +
        '<td data-label="Inicio">' + escHtml(entry.start || '—') + '</td>' +
        '<td data-label="Fin">' + escHtml(entry.end || '—') + '</td>' +
        '<td data-label="Duración">' + fmtDuration(entry.duration_min) + '</td>' +
        '<td data-label="Tarea">' + escHtml(entry.task) + '</td>' +
        '<td data-label="Categoría"><span class="badge">' + escHtml(entry.category || '—') + '</span></td>' +
        '<td data-label="Notas">' + escHtml(entry.notes || '') + '</td>' +
        '<td class="col-actions">' +
          '<button class="btn btn-secondary btn--xs btn-hist-edit" data-id="' + escHtml(entry.id) + '" title="Editar">✎</button>' +
          '<button class="btn btn-danger btn--xs btn-hist-delete" data-id="' + escHtml(entry.id) + '" title="Eliminar">✕</button>' +
        '</td>';
      tbody.appendChild(tr);
    });

    // footer total
    var footer = document.createElement('div');
    footer.className = 'history-footer';
    footer.innerHTML =
      '<span class="history-count">' + entries.length + ' entrada' + (entries.length !== 1 ? 's' : '') + '</span>' +
      '<span class="history-total">Total: <strong>' + fmtTotalHours(entries) + '</strong></span>';
    wrapper.appendChild(footer);

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    var el = document.getElementById('history-pagination');
    if (!el) return;
    el.innerHTML = '';
    if (totalPages <= 1) return;

    function makeBtn(label, page, disabled, active) {
      var btn = document.createElement('button');
      btn.className = 'btn btn-secondary btn--sm pagination-btn' + (active ? ' active' : '');
      btn.textContent = label;
      btn.disabled = disabled;
      btn.addEventListener('click', function () {
        _currentPage = page;
        renderTable();
      });
      return btn;
    }

    el.appendChild(makeBtn('‹', _currentPage - 1, _currentPage <= 1, false));

    var range = [];
    for (var p = 1; p <= totalPages; p++) {
      if (p === 1 || p === totalPages || (p >= _currentPage - 2 && p <= _currentPage + 2)) {
        range.push(p);
      }
    }

    var prev = 0;
    range.forEach(function (p) {
      if (prev && p - prev > 1) {
        var dots = document.createElement('span');
        dots.className = 'pagination-dots';
        dots.textContent = '…';
        el.appendChild(dots);
      }
      el.appendChild(makeBtn(String(p), p, false, p === _currentPage));
      prev = p;
    });

    el.appendChild(makeBtn('›', _currentPage + 1, _currentPage >= totalPages, false));
  }

  /* ─── edit & delete ─── */

  function handleEdit(id) {
    var entry = (window.Storage && window.Storage.getEntries().find(function (e) { return e.id === id; }));
    if (!entry) return;

    if (typeof window.editEntry === 'function') {
      window.editEntry(entry);
    } else {
      // fallback: populate form manually
      var fields = {
        'entry-date': entry.date,
        'entry-start': entry.start || '',
        'entry-end': entry.end || '',
        'entry-task': entry.task || '',
        'entry-category': entry.category || '',
        'entry-notes': entry.notes || ''
      };
      Object.keys(fields).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = fields[id];
      });
      // store editing id for the form submit handler
      var form = document.getElementById('form-manual-entry');
      if (form) form.dataset.editingId = entry.id;
    }

    // switch to tab Hoy
    var tabBtn = document.querySelector('[data-tab="hoy"]');
    if (tabBtn) tabBtn.click();
  }

  function handleDelete(id) {
    var confirmOverlay = document.getElementById('modal-confirm');
    var confirmText = document.getElementById('modal-confirm-text');
    var btnYes = document.getElementById('btn-confirm-yes');
    var btnNo = document.getElementById('btn-confirm-no');

    if (confirmOverlay && btnYes && btnNo) {
      if (confirmText) confirmText.textContent = '¿Eliminar esta entrada? Esta acción no se puede deshacer.';
      confirmOverlay.setAttribute('aria-hidden', 'false');
      confirmOverlay.classList.add('is-open');

      function cleanup() {
        confirmOverlay.setAttribute('aria-hidden', 'true');
        confirmOverlay.classList.remove('is-open');
        btnYes.removeEventListener('click', onYes);
        btnNo.removeEventListener('click', onNo);
      }
      function onYes() {
        if (window.Storage) window.Storage.deleteEntry(id);
        cleanup();
        applyFilters();
        if (typeof window.showToast === 'function') window.showToast('Entrada eliminada', 'success');
      }
      function onNo() { cleanup(); }
      btnYes.addEventListener('click', onYes);
      btnNo.addEventListener('click', onNo);
    } else {
      if (!confirm('¿Eliminar esta entrada? Esta acción no se puede deshacer.')) return;
      if (window.Storage) window.Storage.deleteEntry(id);
      applyFilters();
      if (typeof window.showToast === 'function') window.showToast('Entrada eliminada', 'success');
    }
  }

  /* ─── event delegation for table buttons ─── */

  function bindTableEvents() {
    var wrapper = document.getElementById('history-table');
    if (!wrapper) return;
    wrapper.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.btn-hist-edit');
      var delBtn = e.target.closest('.btn-hist-delete');
      if (editBtn) handleEdit(editBtn.dataset.id);
      if (delBtn) handleDelete(delBtn.dataset.id);
    });
  }

  /* ─── init ─── */

  function initHistorialTab() {
    var fromEl = document.getElementById('hist-date-from');
    var toEl = document.getElementById('hist-date-to');
    if (fromEl && !fromEl.value) fromEl.value = monthStartStr();
    if (toEl && !toEl.value) toEl.value = todayStr();

    populateCategoryFilter();

    var filterBtn = document.getElementById('btn-hist-filter');
    if (filterBtn) {
      filterBtn.addEventListener('click', function () { applyFilters(); });
    }

    var clearBtn = document.getElementById('btn-hist-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        if (fromEl) fromEl.value = monthStartStr();
        if (toEl) toEl.value = todayStr();
        var searchEl = document.getElementById('hist-search');
        if (searchEl) searchEl.value = '';
        var catEl = document.getElementById('hist-category-filter');
        if (catEl) catEl.value = '';
        applyFilters();
      });
    }

    // search on Enter
    var searchEl = document.getElementById('hist-search');
    if (searchEl) {
      searchEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') applyFilters();
      });
    }

    bindTableEvents();
    applyFilters();
  }

  // expose
  window.initHistorialTab = initHistorialTab;
  window.refreshHistorial = applyFilters;

})();
