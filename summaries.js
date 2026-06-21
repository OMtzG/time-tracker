(function () {
  'use strict';

  // ─── Date Helpers ────────────────────────────────────────────────────────────

  function toYMD(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  function parseYMD(str) {
    var parts = str.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  function getWeekRange(date) {
    var d = new Date(date);
    d.setHours(0, 0, 0, 0);
    var day = d.getDay(); // 0=Sun, 1=Mon,...6=Sat
    var diffToSaturday = -((day + 1) % 7); // 0 if Sat, -1 if Sun, ..., -6 if Fri
    var saturday = new Date(d);
    saturday.setDate(d.getDate() + diffToSaturday);
    var friday = new Date(saturday);
    friday.setDate(saturday.getDate() + 6);
    return { start: saturday, end: friday };
  }

  function getMonthRange(date) {
    var start = new Date(date.getFullYear(), date.getMonth(), 1);
    var end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { start: start, end: end };
  }

  var MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  var SHORT_MONTH = [
    'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
  ];

  function weekLabel(start, end) {
    var startDay = start.getDate();
    var endDay = end.getDate();
    var startMon = SHORT_MONTH[start.getMonth()];
    var endMon = SHORT_MONTH[end.getMonth()];
    var endYear = end.getFullYear();
    if (start.getMonth() === end.getMonth()) {
      return startDay + '–' + endDay + ' ' + startMon + ' ' + endYear;
    }
    return startDay + ' ' + startMon + ' – ' + endDay + ' ' + endMon + ' ' + endYear;
  }

  // ─── Calculation ─────────────────────────────────────────────────────────────

  function calcWeekSummary(weekStart) {
    var range = getWeekRange(weekStart);
    var startStr = toYMD(range.start);
    var endStr = toYMD(range.end);

    var entries = Storage.getEntriesByRange(startStr, endStr);
    var config = Storage.getConfig();
    var rate = config.sanction_rate_eur || 3.0;
    var targets = config.weekly_targets || {};
    var categories = config.categories || [];

    var byCategory = {};
    categories.forEach(function (cat) {
      byCategory[cat] = { hours: 0, target: targets[cat] || 0, deficit: 0, sanction: 0 };
    });

    entries.forEach(function (e) {
      if (!byCategory[e.category]) {
        byCategory[e.category] = { hours: 0, target: targets[e.category] || 0, deficit: 0, sanction: 0 };
      }
      byCategory[e.category].hours += (e.duration_min || 0) / 60;
    });

    var totalHours = 0;
    var totalTarget = 0;

    Object.keys(byCategory).forEach(function (cat) {
      var c = byCategory[cat];
      c.hours = Math.round(c.hours * 100) / 100;
      c.deficit = Math.max(0, Math.round((c.target - c.hours) * 100) / 100);
      totalHours += c.hours;
      totalTarget += c.target;
    });

    totalHours = Math.round(totalHours * 100) / 100;
    totalTarget = Math.round(totalTarget * 100) / 100;
    var totalDeficit = Math.max(0, Math.round((totalTarget - totalHours) * 100) / 100);
    var totalSanction = Math.round(totalDeficit * rate * 100) / 100;

    return {
      entries: entries,
      byCategory: byCategory,
      totalHours: totalHours,
      totalTarget: totalTarget,
      totalDeficit: totalDeficit,
      totalSanction: totalSanction,
      weekLabel: weekLabel(range.start, range.end),
      weekStart: range.start,
      weekEnd: range.end
    };
  }

  function calcMonthSummary(year, month) {
    var firstDay = new Date(year, month, 1);
    var lastDay = new Date(year, month + 1, 0);

    // Collect all week-starts that overlap with this month
    var weeks = [];
    var cursor = getWeekRange(firstDay).start;
    while (cursor <= lastDay) {
      var range = getWeekRange(cursor);
      // Only include weeks that overlap with the month
      if (range.end >= firstDay && range.start <= lastDay) {
        var summary = calcWeekSummary(cursor);
        weeks.push(summary);
      }
      var next = new Date(cursor);
      next.setDate(cursor.getDate() + 7);
      cursor = next;
    }

    var totalHours = 0;
    var totalSanction = 0;
    weeks.forEach(function (w) {
      totalHours += w.totalHours;
      totalSanction += w.totalSanction;
    });

    return {
      weeks: weeks,
      totalHours: Math.round(totalHours * 100) / 100,
      totalSanction: Math.round(totalSanction * 100) / 100,
      monthLabel: MONTH_NAMES[month] + ' ' + year,
      year: year,
      month: month
    };
  }

  // ─── State ───────────────────────────────────────────────────────────────────

  var state = {
    view: 'weekly',          // 'weekly' | 'monthly'
    currentWeekStart: null,  // Date (Monday)
    currentYear: null,
    currentMonth: null,
    weeklyChart: null
  };

  // ─── Rendering ───────────────────────────────────────────────────────────────

  function fmt(n) {
    return n.toFixed(2);
  }

  function fmtH(n) {
    return n.toFixed(2) + ' h';
  }

  function fmtEur(n) {
    return fmt(n) + ' €';
  }

  function renderWeekly() {
    var summary = calcWeekSummary(state.currentWeekStart);
    var config = Storage.getConfig();
    var categories = config.categories || [];

    // Header / label
    var labelEl = document.getElementById('summaries-period-label');
    if (labelEl) labelEl.textContent = 'Semana ' + summary.weekLabel;

    // Build table
    var tableContainer = document.getElementById('summaries-table-container');
    if (!tableContainer) return;

    var rows = '';
    categories.forEach(function (cat) {
      var c = summary.byCategory[cat] || { hours: 0, target: 0, deficit: 0 };
      var pct = c.target > 0 ? Math.min(100, (c.hours / c.target) * 100) : (c.hours > 0 ? 100 : 0);
      var barColor = pct >= 100 ? '#22c55e' : pct >= 60 ? '#f59e0b' : '#ef4444';
      rows += '<tr>' +
        '<td>' + escHtml(cat) + '</td>' +
        '<td>' + fmtH(c.hours) + '</td>' +
        '<td>' + fmtH(c.target) + '</td>' +
        '<td class="' + (c.deficit > 0 ? 'deficit-cell' : '') + '">' + fmtH(c.deficit) + '</td>' +
        '<td class="progress-cell"><div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + pct.toFixed(1) + '%;background:' + barColor + '"></div></div><span class="progress-label">' + pct.toFixed(0) + '%</span></td>' +
        '</tr>';
    });

    tableContainer.innerHTML =
      '<table class="summaries-table">' +
      '<thead><tr>' +
      '<th>Categoría</th>' +
      '<th>Horas registradas</th>' +
      '<th>Meta</th>' +
      '<th>Déficit</th>' +
      '<th>Progreso</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr>' +
      '<td><strong>Total</strong></td>' +
      '<td><strong>' + fmtH(summary.totalHours) + '</strong></td>' +
      '<td><strong>' + fmtH(summary.totalTarget) + '</strong></td>' +
      '<td><strong class="' + (summary.totalDeficit > 0 ? 'deficit-cell' : '') + '">' + fmtH(summary.totalDeficit) + '</strong></td>' +
      '<td><strong class="' + (summary.totalSanction > 0 ? 'sanction-cell' : '') + '">Sanción: ' + fmtEur(summary.totalSanction) + '</strong></td>' +
      '</tr></tfoot>' +
      '</table>';

    // Chart
    renderWeeklyChart(summary, categories);
  }

  function renderWeeklyChart(summary, categories) {
    var canvas = document.getElementById('weekly-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    var hours = categories.map(function (cat) {
      return (summary.byCategory[cat] || { hours: 0 }).hours;
    });
    var targets = categories.map(function (cat) {
      return (summary.byCategory[cat] || { target: 0 }).target;
    });

    if (state.weeklyChart) {
      state.weeklyChart.destroy();
      state.weeklyChart = null;
    }

    state.weeklyChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: categories,
        datasets: [
          {
            label: 'Horas registradas',
            data: hours,
            backgroundColor: 'rgba(99, 102, 241, 0.7)',
            borderColor: 'rgba(99, 102, 241, 1)',
            borderWidth: 1
          },
          {
            label: 'Meta semanal',
            data: targets,
            backgroundColor: 'rgba(251, 191, 36, 0.4)',
            borderColor: 'rgba(251, 191, 36, 1)',
            borderWidth: 2,
            type: 'bar'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
          title: {
            display: true,
            text: 'Horas por categoría vs Meta — ' + summary.weekLabel
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: { display: true, text: 'Horas' }
          }
        }
      }
    });
  }

  function renderMonthly() {
    var summary = calcMonthSummary(state.currentYear, state.currentMonth);

    var labelEl = document.getElementById('summaries-period-label');
    if (labelEl) labelEl.textContent = summary.monthLabel;

    var tableContainer = document.getElementById('summaries-table-container');
    if (!tableContainer) return;

    var rows = '';
    summary.weeks.forEach(function (w) {
      rows += '<tr>' +
        '<td>' + escHtml(w.weekLabel) + '</td>' +
        '<td>' + fmtH(w.totalHours) + '</td>' +
        '<td class="' + (w.totalSanction > 0 ? 'sanction-cell' : '') + '">' + fmtEur(w.totalSanction) + '</td>' +
        '</tr>';
    });

    tableContainer.innerHTML =
      '<table class="summaries-table">' +
      '<thead><tr>' +
      '<th>Semana</th>' +
      '<th>Horas totales</th>' +
      '<th>Sanción (€)</th>' +
      '</tr></thead>' +
      '<tbody>' + rows + '</tbody>' +
      '<tfoot><tr>' +
      '<td><strong>Total mes</strong></td>' +
      '<td><strong>' + fmtH(summary.totalHours) + '</strong></td>' +
      '<td><strong class="' + (summary.totalSanction > 0 ? 'sanction-cell' : '') + '">' + fmtEur(summary.totalSanction) + '</strong></td>' +
      '</tr></tfoot>' +
      '</table>';

    // Destroy weekly chart if present
    if (state.weeklyChart) {
      state.weeklyChart.destroy();
      state.weeklyChart = null;
    }
    var canvas = document.getElementById('weekly-chart');
    if (canvas) canvas.style.display = 'none';
  }

  function render() {
    var canvas = document.getElementById('weekly-chart');
    if (state.view === 'weekly') {
      if (canvas) canvas.style.display = '';
      renderWeekly();
    } else {
      renderMonthly();
    }
  }

  // ─── Escape HTML ─────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Navigation ──────────────────────────────────────────────────────────────

  function prevPeriod() {
    if (state.view === 'weekly') {
      var d = new Date(state.currentWeekStart);
      d.setDate(d.getDate() - 7);
      state.currentWeekStart = d;
    } else {
      state.currentMonth -= 1;
      if (state.currentMonth < 0) {
        state.currentMonth = 11;
        state.currentYear -= 1;
      }
    }
    render();
  }

  function nextPeriod() {
    if (state.view === 'weekly') {
      var d = new Date(state.currentWeekStart);
      d.setDate(d.getDate() + 7);
      state.currentWeekStart = d;
    } else {
      state.currentMonth += 1;
      if (state.currentMonth > 11) {
        state.currentMonth = 0;
        state.currentYear += 1;
      }
    }
    render();
  }

  function switchView(view) {
    state.view = view;

    var btnWeekly = document.getElementById('summaries-btn-weekly');
    var btnMonthly = document.getElementById('summaries-btn-monthly');
    if (btnWeekly) btnWeekly.classList.toggle('active', view === 'weekly');
    if (btnMonthly) btnMonthly.classList.toggle('active', view === 'monthly');

    // Sync month state to current week when switching to monthly
    if (view === 'monthly') {
      state.currentYear = state.currentWeekStart.getFullYear();
      state.currentMonth = state.currentWeekStart.getMonth();
    }

    render();
  }

  // ─── Inject styles ───────────────────────────────────────────────────────────

  function injectStyles() {
    var id = 'summaries-styles';
    if (document.getElementById(id)) return;
    var style = document.createElement('style');
    style.id = id;
    style.textContent = [
      '#summaries-tab { padding: 1rem; }',
      '.summaries-controls { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }',
      '.summaries-controls button { padding: 0.35rem 0.8rem; cursor: pointer; border: 1px solid #d1d5db; border-radius: 6px; background: #fff; font-size: 0.9rem; }',
      '.summaries-controls button.active { background: #6366f1; color: #fff; border-color: #6366f1; }',
      '.summaries-controls button:hover:not(.active) { background: #f3f4f6; }',
      '#summaries-period-label { flex: 1; text-align: center; font-weight: 600; font-size: 1rem; }',
      '.summaries-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.9rem; }',
      '.summaries-table th, .summaries-table td { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; text-align: left; }',
      '.summaries-table thead th { background: #f9fafb; font-weight: 600; }',
      '.summaries-table tfoot td { background: #f9fafb; }',
      '.summaries-table tbody tr:hover { background: #f3f4f6; }',
      '.deficit-cell { color: #dc2626; }',
      '.sanction-cell { color: #dc2626; font-weight: 600; }',
      '.progress-cell { min-width: 140px; }',
      '.progress-bar-track { display: inline-block; width: 100px; height: 10px; background: #e5e7eb; border-radius: 5px; vertical-align: middle; margin-right: 6px; overflow: hidden; }',
      '.progress-bar-fill { height: 100%; border-radius: 5px; transition: width 0.3s; }',
      '.progress-label { font-size: 0.8rem; color: #6b7280; }',
      '#summaries-chart-container { margin-top: 1rem; max-height: 320px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ─── Build Shell ─────────────────────────────────────────────────────────────

  function buildShell(container) {
    container.innerHTML =
      '<div id="summaries-tab">' +
      '<div class="summaries-controls">' +
      '<button id="summaries-btn-prev">←</button>' +
      '<span id="summaries-period-label"></span>' +
      '<button id="summaries-btn-next">→</button>' +
      '<button id="summaries-btn-weekly" class="active">Semanal</button>' +
      '<button id="summaries-btn-monthly">Mensual</button>' +
      '</div>' +
      '<div id="summaries-table-container"></div>' +
      '<div id="summaries-chart-container"><canvas id="weekly-chart"></canvas></div>' +
      '</div>';

    document.getElementById('summaries-btn-prev').addEventListener('click', prevPeriod);
    document.getElementById('summaries-btn-next').addEventListener('click', nextPeriod);
    document.getElementById('summaries-btn-weekly').addEventListener('click', function () { switchView('weekly'); });
    document.getElementById('summaries-btn-monthly').addEventListener('click', function () { switchView('monthly'); });
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function initSummariesTab() {
    var now = new Date();
    var weekRange = getWeekRange(now);
    state.currentWeekStart = weekRange.start;
    state.currentYear = now.getFullYear();
    state.currentMonth = now.getMonth();
    state.view = 'weekly';
    state.weeklyChart = null;

    injectStyles();

    // Try to find the summaries tab container; support shell.html id conventions
    var container = document.getElementById('tab-summaries') ||
                    document.getElementById('summaries-tab-content') ||
                    document.getElementById('summaries-container');

    if (!container) {
      // Fallback: look for a tab panel with data-tab="summaries"
      container = document.querySelector('[data-tab="summaries"]');
    }

    if (!container) {
      console.warn('initSummariesTab: no container found. Call buildShell manually or ensure a #tab-summaries element exists.');
      return;
    }

    buildShell(container);
    render();
  }

  // ─── Public API ──────────────────────────────────────────────────────────────

  window.Summaries = {
    getWeekRange: getWeekRange,
    getMonthRange: getMonthRange,
    calcWeekSummary: calcWeekSummary,
    calcMonthSummary: calcMonthSummary,
    initSummariesTab: initSummariesTab,
    refresh: render
  };

})();
