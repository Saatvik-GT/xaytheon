// ============================================================
// contributions.js - Save and display your open source contributions
//
// All data is saved in the browser's localStorage.
// Date-range filtering is applied client-side before rendering.
// ============================================================

var STORAGE_KEY = 'xaytheon:contributions';

// ── Date filter state ────────────────────────────────────────
var contribDateFilter = { start: null, end: null };


// ============================================================
// LOCALSTORAGE HELPERS
// ============================================================

function loadContributionsFromStorage() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

function saveContributionsToStorage(contributions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contributions));
  } catch (error) {
    console.warn('Could not save to localStorage:', error);
  }
}


// ============================================================
// ID GENERATOR
// ============================================================

function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  var result = '';
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) result += '-';
    else if (i === 14) result += '4';
    else result += Math.floor(Math.random() * 16).toString(16);
  }
  return result;
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function setStatus(message, isError) {
  var el = document.getElementById('contrib-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#111827';
}

function safeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}


// ============================================================
// DATE-RANGE FILTER UI (Contributions page)
// ============================================================

/**
 * Inject the date-range filter bar above the contribution list.
 * Called once from DOMContentLoaded.
 */
function injectDateFilterStyles() {
  if (document.getElementById('xaytheon-filter-styles')) return;
  var style = document.createElement('style');
  style.id = 'xaytheon-filter-styles';
  style.textContent = [
    '#gh-date-filter-bar, #contrib-date-filter-bar { width:100%; margin:0 0 24px 0; position:relative; z-index:2; }',
    '#gh-date-filter-bar .xf-bar, #contrib-date-filter-bar .xf-bar { display:flex !important; flex-wrap:wrap !important; align-items:center !important; gap:10px !important; padding:14px 20px 14px 24px !important; border-radius:14px !important; position:relative !important; border-left:3px solid #0ea5e9 !important; }',
    '#gh-date-filter-bar .xf-label, #contrib-date-filter-bar .xf-label { font-size:11px !important; font-weight:800 !important; letter-spacing:1.2px !important; text-transform:uppercase !important; color:#0ea5e9 !important; white-space:nowrap !important; flex-shrink:0 !important; background:none !important; border:none !important; padding:0 !important; box-shadow:none !important; margin:0 !important; opacity:1 !important; }',
    '#gh-date-filter-bar .xf-div, #contrib-date-filter-bar .xf-div { width:1px !important; height:20px !important; opacity:0.3 !important; flex-shrink:0 !important; }',
    '#gh-date-filter-bar .xf-presets, #contrib-date-filter-bar .xf-presets { display:flex !important; flex-wrap:wrap !important; gap:5px !important; align-items:center !important; }',
    '#gh-date-filter-bar .xf-btn, #contrib-date-filter-bar .xf-btn { display:inline-block !important; padding:6px 14px !important; font-size:12.5px !important; font-family:inherit !important; font-weight:700 !important; border-radius:8px !important; cursor:pointer !important; white-space:nowrap !important; line-height:1.4 !important; opacity:1 !important; background:transparent !important; color:inherit !important; transition:background 0.15s,color 0.15s,border-color 0.15s,transform 0.1s !important; }',
    '#gh-date-filter-bar .xf-btn::before, #contrib-date-filter-bar .xf-btn::before { display:none !important; }',
    '#gh-date-filter-bar .xf-btn:hover, #contrib-date-filter-bar .xf-btn:hover { background:rgba(14,165,233,0.12) !important; color:#0ea5e9 !important; border-color:rgba(14,165,233,0.6) !important; transform:translateY(-1px) !important; opacity:1 !important; }',
    '#gh-date-filter-bar .xf-btn.xf-active, #contrib-date-filter-bar .xf-btn.xf-active { background:#0ea5e9 !important; border-color:#0ea5e9 !important; color:#fff !important; box-shadow:0 2px 10px rgba(14,165,233,0.4) !important; transform:translateY(-1px) !important; opacity:1 !important; }',
    '#gh-date-filter-bar .xf-badge, #contrib-date-filter-bar .xf-badge { display:inline-flex !important; align-items:center !important; gap:6px !important; padding:5px 12px !important; font-size:12px !important; font-weight:700 !important; background:rgba(14,165,233,0.12) !important; border:1px solid rgba(14,165,233,0.35) !important; border-radius:999px !important; color:#0ea5e9 !important; white-space:nowrap !important; }',
    '#gh-date-filter-bar .xf-clear, #contrib-date-filter-bar .xf-clear { display:inline-flex !important; align-items:center !important; justify-content:center !important; width:16px !important; height:16px !important; border-radius:50% !important; background:rgba(14,165,233,0.22) !important; border:none !important; color:#0ea5e9 !important; cursor:pointer !important; font-size:10px !important; padding:0 !important; opacity:1 !important; flex-shrink:0 !important; }',
    '#gh-date-filter-bar .xf-clear::before, #contrib-date-filter-bar .xf-clear::before { display:none !important; }',
    '#gh-date-filter-bar .xf-custom, #contrib-date-filter-bar .xf-custom { width:100% !important; display:flex !important; flex-wrap:wrap !important; align-items:flex-end !important; gap:10px !important; padding-top:12px !important; border-top:1px dashed rgba(14,165,233,0.3) !important; }',
    '#gh-date-filter-bar .xf-inp-wrap, #contrib-date-filter-bar .xf-inp-wrap { display:flex !important; flex-direction:column !important; gap:4px !important; }',
    '#gh-date-filter-bar .xf-inp-wrap label, #contrib-date-filter-bar .xf-inp-wrap label { font-size:11px !important; font-weight:800 !important; letter-spacing:1px !important; text-transform:uppercase !important; color:#0ea5e9 !important; }',
    '#gh-date-filter-bar .xf-inp-wrap input, #contrib-date-filter-bar .xf-inp-wrap input { padding:8px 12px !important; font-size:13px !important; font-family:inherit !important; border-radius:8px !important; outline:none !important; min-width:148px !important; line-height:1.4 !important; opacity:1 !important; }',
    '#gh-date-filter-bar .xf-apply, #contrib-date-filter-bar .xf-apply { padding:8px 20px !important; font-size:13px !important; font-family:inherit !important; font-weight:800 !important; border-radius:8px !important; border:none !important; background:#0ea5e9 !important; color:#fff !important; cursor:pointer !important; align-self:flex-end !important; opacity:1 !important; white-space:nowrap !important; box-shadow:0 2px 10px rgba(14,165,233,0.32) !important; }',
    '#gh-date-filter-bar .xf-apply::before, #contrib-date-filter-bar .xf-apply::before { display:none !important; }',
    '#gh-date-filter-bar .xf-apply:hover, #contrib-date-filter-bar .xf-apply:hover { opacity:0.85 !important; transform:translateY(-1px) !important; }',
  ].join('\n');
  document.head.appendChild(style);
}
function injectContribDateFilterBar() {
  var listEl = document.getElementById('contrib-list');
  if (!listEl) return;

  // Reuse the same style injector
  injectDateFilterStyles();

  var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  var bgColor     = isDark ? '#0d1117' : '#ffffff';
  var borderColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  var textColor   = isDark ? '#ffffff' : '#000000';
  var divColor    = isDark ? '#ffffff' : '#000000';

  var bar = document.createElement('div');
  bar.id = 'contrib-date-filter-bar';

  var barDiv = document.createElement('div');
  barDiv.className = 'xf-bar';
  barDiv.style.cssText = [
    'background:' + bgColor,
    'border:1px solid ' + borderColor,
    'box-shadow:0 2px 12px rgba(0,0,0,0.08)',
  ].join(';');

  barDiv.innerHTML = [
    '<span class="xf-label">Filter by date</span>',
    '<div class="xf-div" style="background:' + divColor + '"></div>',
    '<div class="xf-presets">',
    '  <button class="xf-btn xf-active" style="border:1px solid ' + borderColor + '" data-days="0">All time</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="7">7 days</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="30">30 days</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="90">3 months</button>',
    '  <button class="xf-btn" style="border:1px solid ' + borderColor + '" data-days="365">1 year</button>',
    '</div>',
    '<div class="xf-badge" id="contrib-filter-badge" style="display:none">',
    '  <span id="contrib-filter-badge-text"></span>',
    '  <button class="xf-clear" id="contrib-date-clear-filter">✕</button>',
    '</div>',
    '<div class="xf-custom" id="contrib-custom-range" style="display:none">',
    '  <div class="xf-inp-wrap">',
    '    <label>From</label>',
    '    <input type="date" id="contrib-date-start" style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '  </div>',
    '  <div class="xf-inp-wrap">',
    '    <label>To</label>',
    '    <input type="date" id="contrib-date-end" style="border:1px solid ' + borderColor + ';background:' + bgColor + ';color:' + textColor + '" />',
    '  </div>',
    '  <button class="xf-apply" id="contrib-date-apply">Apply</button>',
    '</div>',
    '</div>',
    '<div id="contrib-filter-count" style="font-size:12px;opacity:0.5;text-align:right;margin:-8px 0 16px;font-style:italic;"></div>',
  ].join('\n');

  bar.appendChild(barDiv);
  listEl.parentNode.insertBefore(bar, listEl);

  // Wire preset buttons
  bar.querySelectorAll('.xf-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      bar.querySelectorAll('.xf-btn').forEach(function(b) { b.classList.remove('xf-active'); b.style.background = 'transparent'; b.style.color = 'inherit'; b.style.borderColor = ''; });
      btn.classList.add('xf-active');
      btn.style.background = '#0ea5e9';
      btn.style.color = '#fff';
      btn.style.borderColor = '#0ea5e9';

      var days = btn.getAttribute('data-days');
      var customRange = document.getElementById('contrib-custom-range');

      if (days === 'custom') {
        customRange.style.display = 'flex';
        return;
      }

      customRange.style.display = 'none';

      if (days === '0') {
        contribDateFilter = { start: null, end: null };
        updateContribBadge(null, null);
      } else {
        var end   = new Date();
        var start = new Date(Date.now() - parseInt(days) * 86400000);
        contribDateFilter = { start: start, end: end };
        updateContribBadge(start, end);
      }

      renderContributions();
    });
  });

  // Wire custom range apply
  document.getElementById('contrib-date-apply').addEventListener('click', function() {
    var startVal = document.getElementById('contrib-date-start').value;
    var endVal   = document.getElementById('contrib-date-end').value;

    if (!startVal && !endVal) {
      contribDateFilter = { start: null, end: null };
      updateContribBadge(null, null);
    } else {
      var start = startVal ? new Date(startVal + 'T00:00:00') : null;
      var end   = endVal   ? new Date(endVal   + 'T23:59:59') : new Date();
      if (start && end && start > end) {
        alert('Start date must be before end date.');
        return;
      }
      contribDateFilter = { start: start, end: end };
      updateContribBadge(start, end);
    }

    renderContributions();
  });

  // Wire clear button
  document.getElementById('contrib-date-clear-filter').addEventListener('click', function() {
    contribDateFilter = { start: null, end: null };
    updateContribBadge(null, null);
    bar.querySelectorAll('.xf-btn').forEach(function(b) { b.classList.remove('xf-active'); b.style.background='transparent'; b.style.color='inherit'; b.style.borderColor=''; });
    var allTime = bar.querySelector('[data-days="0"]');
    if (allTime) { allTime.classList.add('xf-active'); allTime.style.background='#0ea5e9'; allTime.style.color='#fff'; allTime.style.borderColor='#0ea5e9'; }
    document.getElementById('contrib-custom-range').style.display = 'none';
    renderContributions();
  });
}

function updateContribBadge(start, end) {
  var badge    = document.getElementById('contrib-filter-badge');
  var badgeTxt = document.getElementById('contrib-filter-badge-text');
  if (!badge || !badgeTxt) return;

  if (!start && !end) {
    badge.style.display = 'none';
    badgeTxt.textContent = '';
    return;
  }

  var fmt = function(d) {
    return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '…';
  };
  badgeTxt.textContent = fmt(start) + ' → ' + fmt(end);
  badge.style.display = 'inline-flex';
}

/** Filter contributions by the contribDateFilter using the contribution's date field */
function filterContributionsByDate(contributions) {
  if (!contributions) return [];
  if (!contribDateFilter.start && !contribDateFilter.end) return contributions;

  return contributions.filter(function(c) {
    // Use contribution date if set, otherwise fall back to created_at
    var rawDate = c.date || c.created_at;
    if (!rawDate) return true;

    var d = new Date(rawDate);
    if (isNaN(d.getTime())) return true;

    if (contribDateFilter.start && d < contribDateFilter.start) return false;
    if (contribDateFilter.end   && d > contribDateFilter.end)   return false;
    return true;
  });
}


// ============================================================
// SAVE A CONTRIBUTION
// ============================================================

function saveContribution(event) {
  event.preventDefault();

  var project     = document.getElementById('cf-project').value.trim();
  var link        = document.getElementById('cf-link').value.trim();
  var program     = document.getElementById('cf-program').value.trim();
  var date        = document.getElementById('cf-date').value || null;
  var type        = document.getElementById('cf-type').value.trim();
  var description = document.getElementById('cf-desc').value.trim();
  var tech        = document.getElementById('cf-tech').value.trim();

  var contribution = {
    id:          createId(),
    project:     project,
    link:        link,
    program:     program,
    date:        date,
    type:        type,
    description: description,
    tech:        tech,
    created_at:  new Date().toISOString()
  };

  var contributions = loadContributionsFromStorage();
  contributions.unshift(contribution);
  saveContributionsToStorage(contributions);

  setStatus('Saved!');
  document.getElementById('contrib-form').reset();
  renderContributions();
}


// ============================================================
// BUILD HTML FOR ONE CONTRIBUTION ROW
// ============================================================

function buildContributionRow(contribution) {
  var dateText = '';
  if (contribution.date) {
    // Use UTC date to avoid timezone shifts on date-only strings
    dateText = new Date(contribution.date + 'T00:00:00').toLocaleDateString();
  }

  var metaParts = [];
  if (contribution.program) metaParts.push(safeHtml(contribution.program));
  if (contribution.type)    metaParts.push(safeHtml(contribution.type));
  if (dateText)             metaParts.push(dateText);
  if (contribution.tech)    metaParts.push(safeHtml(contribution.tech));

  var linkHtml = '';
  if (contribution.link) {
    linkHtml = '<a href="' + safeHtml(contribution.link) + '" target="_blank" rel="noopener">View →</a> ';
  }

  return (
    '<div class="repo-item" data-id="' + contribution.id + '">' +
      '<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">' +
        '<div>' +
          '<div class="repo-name">' + safeHtml(contribution.project || 'Untitled') + '</div>' +
          (contribution.description
            ? '<div class="repo-desc">' + safeHtml(contribution.description) + '</div>'
            : '') +
          '<div class="repo-meta">' +
            linkHtml +
            metaParts.join(' • ') +
          '</div>' +
        '</div>' +
        '<button class="btn btn-outline contrib-delete-btn" data-id="' + contribution.id + '">Delete</button>' +
      '</div>' +
    '</div>'
  );
}


// ============================================================
// RENDER THE LIST
// ============================================================

function renderContributions() {
  var list = document.getElementById('contrib-list');
  if (!list) return;

  var all          = loadContributionsFromStorage();
  var contributions = filterContributionsByDate(all);

  // Update count badge
  var countEl = document.getElementById('contrib-filter-count');
  if (countEl) {
    if (contribDateFilter.start || contribDateFilter.end) {
      countEl.textContent = contributions.length + ' of ' + all.length + ' contributions in range';
    } else {
      countEl.textContent = '';
    }
  }

  if (contributions.length === 0) {
    var msg = (contribDateFilter.start || contribDateFilter.end)
      ? 'No contributions found in this date range.'
      : 'No contributions yet. Add one above!';
    list.innerHTML = '<div class="muted">' + msg + '</div>';
    return;
  }

  var html = '';
  for (var i = 0; i < contributions.length; i++) {
    html += buildContributionRow(contributions[i]);
  }
  list.innerHTML = html;

  // Wire delete buttons
  var deleteButtons = list.querySelectorAll('.contrib-delete-btn');
  for (var i = 0; i < deleteButtons.length; i++) {
    (function(btn) {
      btn.addEventListener('click', function() {
        deleteContribution(btn.getAttribute('data-id'));
      });
    })(deleteButtons[i]);
  }
}


// ============================================================
// DELETE A CONTRIBUTION
// ============================================================

function deleteContribution(id) {
  if (!confirm('Delete this contribution?')) return;

  var contributions = loadContributionsFromStorage();
  var filtered = [];
  for (var i = 0; i < contributions.length; i++) {
    if (contributions[i].id !== id) filtered.push(contributions[i]);
  }

  saveContributionsToStorage(filtered);
  setStatus('Deleted.');
  renderContributions();
}


// ============================================================
// INITIALIZE WHEN PAGE LOADS
// ============================================================

window.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('contrib-form');
  if (form) form.addEventListener('submit', saveContribution);

  injectContribDateFilterBar();
  renderContributions();
});
