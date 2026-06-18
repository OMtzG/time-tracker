(function () {
  'use strict';

  var SHEETJS_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  var _xlsxLoaded = false;
  var _xlsxLoading = false;
  var _xlsxCallbacks = [];

  /* ─── date helpers ─── */

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function weekStartStr(refDate) {
    var d = refDate ? new Date(refDate) : new Date();
    var day = d.getDay(); // 0=Sun
    var diff = (day === 0) ? -6 : 1 - day; // Monday-based
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  function weekEndStr(weekStart) {
    var d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }

  function monthStartStr() {
    var d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  }

  function addDays(dateStr, n) {
    var d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function fmtDuration(min) {
    if (min == null || isNaN(min)) return '0h 00m';
    var h = Math.floor(min / 60);
    var m = Math.round(min % 60);
    return h + 'h ' + (m < 10 ? '0' : '') + m + 'm';
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ─── get entries for current filter state ─── */

  function getExportEntries() {
    var fromEl = document.getElementById('export-date-from');
    var toEl = document.getElementById('export-date-to');
    var catEl = document.getElementById('export-category');

    var from = (fromEl && fromEl.value) || monthStartStr();
    var to = (toEl && toEl.value) || todayStr();
    var cat = (catEl && catEl.value) || '';

    var entries = (window.Storage && window.Storage.getEntriesByRange(from, to)) || [];

    if (cat) {
      entries = entries.filter(function (e) { return e.category === cat; });
    }

    entries.sort(function (a, b) {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      if ((a.start || '') < (b.start || '')) return -1;
      if ((a.start || '') > (b.start || '')) return 1;
      return 0;
    });

    return entries;
  }

  /* ─── preview table ─── */

  function updatePreview() {
    var entries = getExportEntries();
    var container = document.getElementById('export-preview-table');
    var countEl = document.getElementById('export-count');
    var emptyEl = document.getElementById('export-empty');

    if (!container) return;

    var oldTable = container.querySelector('table');
    if (oldTable) oldTable.remove();

    if (entries.length === 0) {
      if (emptyEl) emptyEl.style.display = '';
      if (countEl) countEl.textContent = '';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    var preview = entries.slice(0, 10);
    var table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML =
      '<thead><tr>' +
      '<th>Fecha</th><th>Inicio</th><th>Fin</th><th>Duración</th><th>Tarea</th><th>Categoría</th><th>Notas</th>' +
      '</tr></thead>';
    var tbody = document.createElement('tbody');
    preview.forEach(function (e) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escHtml(e.date) + '</td>' +
        '<td>' + escHtml(e.start || '—') + '</td>' +
        '<td>' + escHtml(e.end || '—') + '</td>' +
        '<td>' + fmtDuration(e.duration_min) + '</td>' +
        '<td>' + escHtml(e.task) + '</td>' +
        '<td>' + escHtml(e.category || '—') + '</td>' +
        '<td>' + escHtml(e.notes || '') + '</td>';
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);

    var totalMin = entries.reduce(function (acc, e) { return acc + (e.duration_min || 0); }, 0);
    if (countEl) {
      countEl.innerHTML =
        '<strong>' + entries.length + '</strong> entrada' + (entries.length !== 1 ? 's' : '') +
        ' &bull; Total: <strong>' + fmtDuration(totalMin) + '</strong>' +
        (entries.length > 10 ? ' <em>(mostrando primeras 10)</em>' : '');
    }
  }

  /* ─── CSV export ─── */

  function entriesToCSVRows(entries) {
    var header = ['Fecha', 'Hora inicio', 'Hora fin', 'Duración (min)', 'Tarea', 'Categoría', 'Notas'];
    var rows = [header];
    entries.forEach(function (e) {
      rows.push([
        e.date || '',
        e.start || '',
        e.end || '',
        e.duration_min != null ? String(e.duration_min) : '',
        e.task || '',
        e.category || '',
        e.notes || ''
      ]);
    });
    return rows;
  }

  function rowsToCSVString(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        var s = String(cell);
        if (s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf('\n') >= 0) {
          return '"' + s.replace(/"/g, '""') + '"';
        }
        return s;
      }).join(',');
    }).join('\r\n');
  }

  function exportCSV(entries) {
    if (!entries || entries.length === 0) {
      alert('No hay entradas en el rango seleccionado.');
      return;
    }
    var rows = entriesToCSVRows(entries);
    var csvStr = rowsToCSVString(rows);
    // UTF-8 BOM so Excel opens it correctly
    var BOM = '﻿';
    var blob = new Blob([BOM + csvStr], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'registro-horas-' + todayStr() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  /* ─── SheetJS loader ─── */

  function loadSheetJS(cb) {
    if (_xlsxLoaded && window.XLSX) { cb(null); return; }
    _xlsxCallbacks.push(cb);
    if (_xlsxLoading) return;
    _xlsxLoading = true;
    var script = document.createElement('script');
    script.src = SHEETJS_CDN;
    script.onload = function () {
      _xlsxLoaded = true;
      _xlsxLoading = false;
      _xlsxCallbacks.forEach(function (fn) { fn(null); });
      _xlsxCallbacks = [];
    };
    script.onerror = function () {
      _xlsxLoading = false;
      var err = new Error('No se pudo cargar SheetJS desde el CDN. Comprueba tu conexión a Internet e inténtalo de nuevo.');
      _xlsxCallbacks.forEach(function (fn) { fn(err); });
      _xlsxCallbacks = [];
    };
    document.head.appendChild(script);
  }

  /* ─── weekly summaries for XLSX ─── */

  function buildWeekSummaries(entries) {
    if (!entries || entries.length === 0) return [];
    var config = (window.Storage && window.Storage.getConfig()) || {};
    var rate = config.sanction_rate_eur || 3;
    var targets = config.weekly_targets || {};

    // group by week start
    var weeks = {};
    entries.forEach(function (e) {
      var ws = weekStartStr(e.date);
      if (!weeks[ws]) weeks[ws] = [];
      weeks[ws].push(e);
    });

    var rows = [];
    Object.keys(weeks).sort().forEach(function (ws) {
      var we = weekEndStr(ws);
      var weekEntries = weeks[ws];

      // by category
      var byCategory = {};
      weekEntries.forEach(function (e) {
        var cat = e.category || 'Sin categoría';
        byCategory[cat] = (byCategory[cat] || 0) + (e.duration_min || 0);
      });

      var weekTotalSanction = 0;

      Object.keys(byCategory).forEach(function (cat) {
        var hoursWorked = byCategory[cat] / 60;
        var target = targets[cat] || 0;
        var deficit = Math.max(0, target - hoursWorked);
        var sanction = deficit * rate;
        weekTotalSanction += sanction;

        rows.push({
          semana: ws + ' / ' + we,
          categoria: cat,
          horas: Math.round(hoursWorked * 100) / 100,
          meta: target,
          deficit: Math.round(deficit * 100) / 100,
          sancion_cat: Math.round(sanction * 100) / 100,
          sancion_semana: '' // filled below for first row of each week
        });
      });

      // stamp week total sanction on first category row of this week
      var firstIdx = rows.findIndex(function (r) { return r.semana.startsWith(ws); });
      if (firstIdx >= 0) {
        rows[firstIdx].sancion_semana = Math.round(weekTotalSanction * 100) / 100;
      }
    });

    return rows;
  }

  /* ─── XLSX export ─── */

  function exportXLSX(entries) {
    if (!entries || entries.length === 0) {
      alert('No hay entradas en el rango seleccionado.');
      return;
    }

    var btn = document.getElementById('btn-export-xlsx');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Cargando SheetJS…'; }

    loadSheetJS(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = '⬇ Exportar XLSX'; }

      if (err) {
        alert('Error al cargar SheetJS:\n' + err.message);
        return;
      }

      var XLSX = window.XLSX;

      // ── Hoja 1: Entradas ──
      var headerRow = ['Fecha', 'Hora inicio', 'Hora fin', 'Duración (min)', 'Tarea', 'Categoría', 'Notas'];
      var dataRows = entries.map(function (e) {
        return [
          e.date || '',
          e.start || '',
          e.end || '',
          e.duration_min != null ? e.duration_min : '',
          e.task || '',
          e.category || '',
          e.notes || ''
        ];
      });

      var ws1Data = [headerRow].concat(dataRows);
      var ws1 = XLSX.utils.aoa_to_sheet(ws1Data);

      // column widths for sheet 1
      ws1['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
        { wch: 35 }, { wch: 16 }, { wch: 40 }
      ];

      // ── Hoja 2: Resumen semanal ──
      var summaryRows = buildWeekSummaries(entries);
      var summaryHeader = ['Semana', 'Categoría', 'Horas', 'Meta (h)', 'Déficit (h)', 'Sanción cat. (€)', 'Sanción total semana (€)'];
      var summaryData = [summaryHeader].concat(summaryRows.map(function (r) {
        return [r.semana, r.categoria, r.horas, r.meta, r.deficit, r.sancion_cat, r.sancion_semana];
      }));

      var ws2 = XLSX.utils.aoa_to_sheet(summaryData);
      ws2['!cols'] = [
        { wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 10 },
        { wch: 13 }, { wch: 16 }, { wch: 22 }
      ];

      // ── Workbook ──
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Entradas');
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumen semanal');

      var fileName = 'registro-horas-' + todayStr() + '.xlsx';
      XLSX.writeFile(wb, fileName);
    });
  }

  /* ─── preset buttons ─── */

  function applyPreset(preset) {
    var fromEl = document.getElementById('export-date-from');
    var toEl = document.getElementById('export-date-to');
    if (!fromEl || !toEl) return;

    var today = todayStr();
    switch (preset) {
      case 'today':
        fromEl.value = today;
        toEl.value = today;
        break;
      case 'week':
        fromEl.value = weekStartStr();
        toEl.value = weekEndStr(weekStartStr());
        break;
      case 'month':
        fromEl.value = monthStartStr();
        toEl.value = today;
        break;
      case 'all':
        var allEntries = (window.Storage && window.Storage.getEntries()) || [];
        if (allEntries.length === 0) {
          fromEl.value = monthStartStr();
          toEl.value = today;
        } else {
          var dates = allEntries.map(function (e) { return e.date; }).sort();
          fromEl.value = dates[0];
          toEl.value = dates[dates.length - 1];
        }
        break;
    }
    updatePreview();
  }

  /* ─── JSON backup / import ─── */

  function exportJSON() {
    var entries = (window.Storage && window.Storage.getEntries()) || [];
    var config = (window.Storage && window.Storage.getConfig()) || {};
    var data = { version: 1, exported: new Date().toISOString(), entries: entries, config: config };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'backup-registro-horas-' + todayStr() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function importJSON(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var data = JSON.parse(e.target.result);
        var entries = data.entries || data; // support raw array too
        if (!Array.isArray(entries)) throw new Error('Formato no reconocido');
        var count = 0;
        entries.forEach(function (entry) {
          if (entry && entry.id && entry.date) {
            window.Storage && window.Storage.saveEntry(entry);
            count++;
          }
        });
        alert('Importadas ' + count + ' entradas correctamente.');
        updatePreview();
        if (typeof window.refreshHistorial === 'function') window.refreshHistorial();
      } catch (err) {
        alert('Error al importar: ' + err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  /* ─── clear all ─── */

  function clearAllData() {
    var confirmOverlay = document.getElementById('modal-confirm');
    var confirmText = document.getElementById('modal-confirm-text');
    var btnYes = document.getElementById('btn-confirm-yes');
    var btnNo = document.getElementById('btn-confirm-no');

    function doDelete() {
      localStorage.clear();
      updatePreview();
      if (typeof window.refreshHistorial === 'function') window.refreshHistorial();
      if (typeof window.showToast === 'function') window.showToast('Todos los datos eliminados', 'success');
    }

    if (confirmOverlay && btnYes && btnNo) {
      if (confirmText) confirmText.textContent = '¿Borrar TODOS los datos? Esta acción no se puede deshacer.';
      confirmOverlay.setAttribute('aria-hidden', 'false');
      confirmOverlay.classList.add('is-open');

      function cleanup() {
        confirmOverlay.setAttribute('aria-hidden', 'true');
        confirmOverlay.classList.remove('is-open');
        btnYes.removeEventListener('click', onYes);
        btnNo.removeEventListener('click', onNo);
      }
      function onYes() { doDelete(); cleanup(); }
      function onNo() { cleanup(); }
      btnYes.addEventListener('click', onYes);
      btnNo.addEventListener('click', onNo);
    } else {
      if (confirm('¿Borrar TODOS los datos? Esta acción no se puede deshacer.')) doDelete();
    }
  }

  /* ─── populate category select ─── */

  function populateCategorySelect(selId) {
    var sel = document.getElementById(selId);
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

  /* ─── init ─── */

  function initExportarTab() {
    var fromEl = document.getElementById('export-date-from');
    var toEl = document.getElementById('export-date-to');
    if (fromEl && !fromEl.value) fromEl.value = monthStartStr();
    if (toEl && !toEl.value) toEl.value = todayStr();

    populateCategorySelect('export-category');

    // range inputs → update preview
    if (fromEl) fromEl.addEventListener('change', updatePreview);
    if (toEl) toEl.addEventListener('change', updatePreview);
    var catEl = document.getElementById('export-category');
    if (catEl) catEl.addEventListener('change', updatePreview);

    // preset buttons
    document.querySelectorAll('[data-export-preset]').forEach(function (btn) {
      btn.addEventListener('click', function () { applyPreset(btn.dataset.exportPreset); });
    });

    // CSV
    var csvBtn = document.getElementById('btn-export-csv');
    if (csvBtn) {
      csvBtn.addEventListener('click', function () {
        exportCSV(getExportEntries());
      });
    }

    // XLSX
    var xlsxBtn = document.getElementById('btn-export-xlsx');
    if (xlsxBtn) {
      xlsxBtn.addEventListener('click', function () {
        exportXLSX(getExportEntries());
      });
    }

    // JSON backup
    var jsonBtn = document.getElementById('btn-export-json');
    if (jsonBtn) jsonBtn.addEventListener('click', exportJSON);

    // JSON import
    var importBtn = document.getElementById('btn-import-json');
    var fileInput = document.getElementById('import-file-input');
    if (importBtn && fileInput) {
      importBtn.addEventListener('click', function () { fileInput.click(); });
      fileInput.addEventListener('change', function () {
        if (fileInput.files && fileInput.files[0]) {
          importJSON(fileInput.files[0]);
          fileInput.value = '';
        }
      });
    }

    // clear all
    var clearBtn = document.getElementById('btn-clear-all');
    if (clearBtn) clearBtn.addEventListener('click', clearAllData);

    updatePreview();
  }

  // expose
  window.initExportarTab = initExportarTab;
  window.exportCSV = exportCSV;
  window.exportXLSX = exportXLSX;

})();
