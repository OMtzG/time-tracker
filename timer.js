(function () {
  'use strict';

  var TIMER_KEY = 'time_timer_state';

  var timerState = {
    running: false,
    startTime: null,
    task: '',
    category: ''
  };

  var timerInterval = null;
  var editingEntryId = null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function padTwo(n) {
    return String(n).padStart(2, '0');
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDuration(minutes) {
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return h + ':' + padTwo(m);
  }

  function timeToMinutes(timeStr) {
    var parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function minutesToTime(minutes) {
    return padTwo(Math.floor(minutes / 60)) + ':' + padTwo(minutes % 60);
  }

  function elapsedSeconds(startTime) {
    return Math.floor((Date.now() - startTime) / 1000);
  }

  function formatElapsed(seconds) {
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    return padTwo(h) + ':' + padTwo(m) + ':' + padTwo(s);
  }

  function persistTimerState() {
    if (timerState.running) {
      localStorage.setItem(TIMER_KEY, JSON.stringify(timerState));
    } else {
      localStorage.removeItem(TIMER_KEY);
    }
  }

  function loadPersistedTimer() {
    try {
      var raw = localStorage.getItem(TIMER_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  // ── Timer core ───────────────────────────────────────────────────────────

  function startTimer(task, category) {
    if (timerState.running) return;
    timerState = {
      running: true,
      startTime: Date.now(),
      task: task || '',
      category: category || ''
    };
    persistTimerState();
    beginTickInterval();
    updateTimerUI();
  }

  function stopTimer() {
    if (!timerState.running) return null;

    clearInterval(timerInterval);
    timerInterval = null;

    var now = new Date();
    var startDate = new Date(timerState.startTime);
    var durationMs = now - startDate;
    var durationMin = Math.max(1, Math.round(durationMs / 60000));

    var startH = padTwo(startDate.getHours());
    var startM = padTwo(startDate.getMinutes());
    var endH = padTwo(now.getHours());
    var endM = padTwo(now.getMinutes());

    var entry = {
      id: Storage.generateId(),
      task: timerState.task,
      category: timerState.category,
      date: startDate.toISOString().slice(0, 10),
      start: startH + ':' + startM,
      end: endH + ':' + endM,
      duration_min: durationMin,
      notes: ''
    };

    timerState = { running: false, startTime: null, task: '', category: '' };
    persistTimerState();

    Storage.saveEntry(entry);
    updateTimerUI();
    renderDayEntries(todayStr());

    return entry;
  }

  function resumeTimerIfActive() {
    var saved = loadPersistedTimer();
    if (saved && saved.running && saved.startTime) {
      timerState = saved;
      var taskInput = document.getElementById('timer-task');
      var catSelect = document.getElementById('timer-category');
      if (taskInput) taskInput.value = timerState.task || '';
      if (catSelect) catSelect.value = timerState.category || '';
      beginTickInterval();
      updateTimerUI();
    }
  }

  function beginTickInterval() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(function () {
      if (timerState.running) {
        var display = document.getElementById('timer-display');
        if (display) {
          display.textContent = formatElapsed(elapsedSeconds(timerState.startTime));
        }
      }
    }, 1000);
  }

  function updateTimerUI() {
    var display = document.getElementById('timer-display');
    var startBtn = document.getElementById('timer-start-btn');
    var stopBtn = document.getElementById('timer-stop-btn');
    var timerTaskInput = document.getElementById('timer-task');
    var timerCatSelect = document.getElementById('timer-category');
    var timerStatus = document.getElementById('timer-status');

    if (timerState.running) {
      if (display) display.textContent = formatElapsed(elapsedSeconds(timerState.startTime));
      if (startBtn) startBtn.style.display = 'none';
      if (stopBtn) stopBtn.style.display = '';
      if (timerTaskInput) timerTaskInput.disabled = true;
      if (timerCatSelect) timerCatSelect.disabled = true;
      if (timerStatus) {
        timerStatus.textContent = 'Temporizando: ' + timerState.task + (timerState.category ? ' [' + timerState.category + ']' : '');
        timerStatus.className = 'timer-status running';
      }
    } else {
      if (display) display.textContent = '00:00:00';
      if (startBtn) startBtn.style.display = '';
      if (stopBtn) stopBtn.style.display = 'none';
      if (timerTaskInput) timerTaskInput.disabled = false;
      if (timerCatSelect) timerCatSelect.disabled = false;
      if (timerStatus) {
        timerStatus.textContent = 'Temporizador detenido';
        timerStatus.className = 'timer-status stopped';
      }
    }
  }

  // ── Manual entry form ────────────────────────────────────────────────────

  function getManualFormValues() {
    return {
      date: document.getElementById('manual-date') ? document.getElementById('manual-date').value : todayStr(),
      start: document.getElementById('manual-start') ? document.getElementById('manual-start').value : '',
      end: document.getElementById('manual-end') ? document.getElementById('manual-end').value : '',
      task: document.getElementById('manual-task') ? document.getElementById('manual-task').value.trim() : '',
      category: document.getElementById('manual-category') ? document.getElementById('manual-category').value : '',
      notes: document.getElementById('manual-notes') ? document.getElementById('manual-notes').value.trim() : ''
    };
  }

  function clearManualForm() {
    var dateEl = document.getElementById('manual-date');
    if (dateEl) dateEl.value = todayStr();
    var fields = ['manual-start', 'manual-end', 'manual-task', 'manual-notes'];
    fields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var catEl = document.getElementById('manual-category');
    if (catEl) catEl.selectedIndex = 0;

    editingEntryId = null;
    var saveBtn = document.getElementById('manual-save-btn');
    if (saveBtn) saveBtn.textContent = 'Guardar';
    var cancelBtn = document.getElementById('manual-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
    hideFormError();
  }

  function showFormError(msg) {
    var el = document.getElementById('manual-error');
    if (el) { el.textContent = msg; el.style.display = ''; }
  }

  function hideFormError() {
    var el = document.getElementById('manual-error');
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  }

  function saveManualEntry() {
    var vals = getManualFormValues();

    if (!vals.task) { showFormError('La tarea no puede estar vacía.'); return; }
    if (!vals.start) { showFormError('Indica la hora de inicio.'); return; }
    if (!vals.end) { showFormError('Indica la hora de fin.'); return; }

    var startMin = timeToMinutes(vals.start);
    var endMin = timeToMinutes(vals.end);
    if (endMin <= startMin) { showFormError('La hora de fin debe ser posterior a la de inicio.'); return; }

    hideFormError();

    var entry = {
      id: editingEntryId || Storage.generateId(),
      task: vals.task,
      category: vals.category,
      date: vals.date,
      start: vals.start,
      end: vals.end,
      duration_min: endMin - startMin,
      notes: vals.notes
    };

    Storage.saveEntry(entry);
    clearManualForm();
    renderDayEntries(vals.date);

    var dateEl = document.getElementById('manual-date');
    if (dateEl) dateEl.value = vals.date;
  }

  function fillFormForEdit(entry) {
    editingEntryId = entry.id;
    var fields = {
      'manual-date': entry.date,
      'manual-start': entry.start,
      'manual-end': entry.end,
      'manual-task': entry.task,
      'manual-category': entry.category,
      'manual-notes': entry.notes || ''
    };
    Object.keys(fields).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = fields[id];
    });
    var saveBtn = document.getElementById('manual-save-btn');
    if (saveBtn) saveBtn.textContent = 'Actualizar';
    var cancelBtn = document.getElementById('manual-cancel-btn');
    if (cancelBtn) cancelBtn.style.display = '';

    var formEl = document.getElementById('manual-entry-form');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Day entries list ─────────────────────────────────────────────────────

  function renderDayEntries(date) {
    var container = document.getElementById('day-entries-list');
    var totalEl = document.getElementById('day-total');
    if (!container) return;

    var entries = Storage.getEntriesByDate(date || todayStr());
    entries.sort(function (a, b) { return a.start.localeCompare(b.start); });

    if (entries.length === 0) {
      container.innerHTML = '<p class="no-entries">No hay entradas para este día.</p>';
      if (totalEl) totalEl.textContent = 'Total: 0:00';
      return;
    }

    var totalMin = 0;
    var html = '<ul class="entries-list">';
    entries.forEach(function (e) {
      totalMin += (e.duration_min || 0);
      var dur = formatDuration(e.duration_min || 0);
      var cat = e.category
        ? '<span class="category-badge" data-cat="' + escHtml(e.category) + '">' + escHtml(e.category) + '</span>'
        : '';
      html += '<li class="entry-item" data-id="' + escHtml(e.id) + '">'
        + '<div class="entry-time">' + escHtml(e.start) + '&ndash;' + escHtml(e.end) + '</div>'
        + '<div class="entry-main">'
        + '<span class="entry-task">' + escHtml(e.task) + '</span>'
        + cat
        + (e.notes ? '<span class="entry-notes">' + escHtml(e.notes) + '</span>' : '')
        + '</div>'
        + '<div class="entry-duration">' + dur + ' h</div>'
        + '<div class="entry-actions">'
        + '<button class="btn-edit" data-id="' + escHtml(e.id) + '" title="Editar">✏️</button>'
        + '<button class="btn-delete" data-id="' + escHtml(e.id) + '" title="Eliminar">🗑️</button>'
        + '</div>'
        + '</li>';
    });
    html += '</ul>';

    container.innerHTML = html;
    if (totalEl) totalEl.textContent = 'Total: ' + formatDuration(totalMin) + ' h';

    container.querySelectorAll('.btn-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        var entry = Storage.getEntries().find(function (e) { return e.id === id; });
        if (entry) fillFormForEdit(entry);
      });
    });

    container.querySelectorAll('.btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        if (confirm('¿Eliminar esta entrada?')) {
          Storage.deleteEntry(id);
          renderDayEntries(date);
        }
      });
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Category selects population ──────────────────────────────────────────

  function populateCategorySelects() {
    var cats = Categories.getAll();
    var selectIds = ['timer-category', 'manual-category'];
    selectIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var current = el.value;
      el.innerHTML = '<option value="">Sin categoría</option>';
      cats.forEach(function (c) {
        var opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        el.appendChild(opt);
      });
      if (current) el.value = current;
    });
  }

  // ── Hoy tab date navigator ───────────────────────────────────────────────

  var currentViewDate = todayStr();

  function updateDateDisplay() {
    var el = document.getElementById('hoy-date-display');
    if (el) el.textContent = currentViewDate === todayStr() ? 'Hoy — ' + currentViewDate : currentViewDate;
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  function initHoyTab() {
    populateCategorySelects();

    var dateEl = document.getElementById('manual-date');
    if (dateEl && !dateEl.value) dateEl.value = todayStr();

    var dateDisplay = document.getElementById('hoy-date-display');
    if (dateDisplay) updateDateDisplay();

    var prevBtn = document.getElementById('hoy-prev-day');
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        var d = new Date(currentViewDate + 'T00:00:00');
        d.setDate(d.getDate() - 1);
        currentViewDate = d.toISOString().slice(0, 10);
        updateDateDisplay();
        renderDayEntries(currentViewDate);
      });
    }

    var nextBtn = document.getElementById('hoy-next-day');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        var d = new Date(currentViewDate + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        currentViewDate = d.toISOString().slice(0, 10);
        updateDateDisplay();
        renderDayEntries(currentViewDate);
      });
    }

    var todayBtn = document.getElementById('hoy-goto-today');
    if (todayBtn) {
      todayBtn.addEventListener('click', function () {
        currentViewDate = todayStr();
        updateDateDisplay();
        renderDayEntries(currentViewDate);
      });
    }

    // Timer buttons
    var startBtn = document.getElementById('timer-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', function () {
        var task = document.getElementById('timer-task') ? document.getElementById('timer-task').value.trim() : '';
        var cat = document.getElementById('timer-category') ? document.getElementById('timer-category').value : '';
        if (!task) {
          alert('Indica un nombre de tarea antes de iniciar.');
          return;
        }
        startTimer(task, cat);
      });
    }

    var stopBtn = document.getElementById('timer-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', function () {
        stopTimer();
      });
    }

    // Manual form save
    var saveBtn = document.getElementById('manual-save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        saveManualEntry();
      });
    }

    // Manual form cancel edit
    var cancelBtn = document.getElementById('manual-cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        clearManualForm();
      });
    }

    // Allow Enter key on task inputs
    ['manual-task', 'manual-notes'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter' && !ev.shiftKey && id !== 'manual-notes') {
            ev.preventDefault();
            saveManualEntry();
          }
        });
      }
    });

    // Resume timer if was running before page load
    resumeTimerIfActive();

    // Initial render
    updateTimerUI();
    renderDayEntries(currentViewDate);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  window.Timer = {
    start: startTimer,
    stop: stopTimer,
    getState: function () { return timerState; }
  };

  window.HoyTab = {
    init: initHoyTab,
    renderDayEntries: renderDayEntries,
    populateCategorySelects: populateCategorySelects,
    getCurrentViewDate: function () { return currentViewDate; }
  };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      if (document.getElementById('hoy-tab-root')) initHoyTab();
    });
  } else {
    if (document.getElementById('hoy-tab-root')) initHoyTab();
  }
})();
