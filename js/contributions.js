// ============================================================
// js/contributions.js — Personal Contribution Tracker
//
// Imports safeHtml from utils.js.
// localStorage logic and form handling are specific to this page.
// ============================================================

import { safeHtml } from './Modules/utils.js';

var STORAGE_KEY = 'xaytheon:contributions';

// ---- localStorage helpers ----

function loadFromStorage() {
  try { var raw = localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : []; }
  catch (e) { return []; }
}

function saveToStorage(items) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
  catch (e) { console.warn('Could not save to localStorage:', e); }
}

// ---- ID generator ----

function createId() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  var r = '';
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) r += '-';
    else if (i === 14) r += '4';
    else r += Math.floor(Math.random() * 16).toString(16);
  }
  return r;
}

// ---- status ----

function setStatus(message, isError) {
  var el = document.getElementById('contrib-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#111827';
}

// ---- save ----

function saveContribution(event) {
  event.preventDefault();
  var contribution = {
    id:          createId(),
    project:     document.getElementById('cf-project').value.trim(),
    link:        document.getElementById('cf-link').value.trim(),
    program:     document.getElementById('cf-program').value.trim(),
    date:        document.getElementById('cf-date').value || null,
    type:        document.getElementById('cf-type').value.trim(),
    description: document.getElementById('cf-desc').value.trim(),
    tech:        document.getElementById('cf-tech').value.trim(),
    created_at:  new Date().toISOString()
  };

  var items = loadFromStorage();
  items.unshift(contribution);
  saveToStorage(items);
  setStatus('Saved!');
  document.getElementById('contrib-form').reset();
  renderContributions();
}

// ---- render ----

function buildRow(c) {
  var dateText  = c.date ? new Date(c.date).toLocaleDateString() : '';
  var metaParts = [c.program, c.type, dateText, c.tech].filter(Boolean).map(safeHtml);
  var linkHtml  = c.link ? '<a href="' + safeHtml(c.link) + '" target="_blank" rel="noopener">View →</a> ' : '';

  return (
    '<div class="repo-item" data-id="' + c.id + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">' +
        '<div>' +
          '<div class="repo-name">' + safeHtml(c.project || 'Untitled') + '</div>' +
          (c.description ? '<div class="repo-desc">' + safeHtml(c.description) + '</div>' : '') +
          '<div class="repo-meta">' + linkHtml + metaParts.join(' • ') + '</div>' +
        '</div>' +
        '<button class="btn btn-outline contrib-delete-btn" data-id="' + c.id + '">Delete</button>' +
      '</div>' +
    '</div>'
  );
}

function renderContributions() {
  var list = document.getElementById('contrib-list');
  if (!list) return;

  var items = loadFromStorage();
  if (items.length === 0) { list.innerHTML = '<div class="muted">No contributions yet. Add one above!</div>'; return; }

  list.innerHTML = items.map(buildRow).join('');

  list.querySelectorAll('.contrib-delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function() { deleteContribution(btn.getAttribute('data-id')); });
  });
}

// ---- delete ----

function deleteContribution(id) {
  if (!confirm('Delete this contribution?')) return;
  saveToStorage(loadFromStorage().filter(function(c) { return c.id !== id; }));
  setStatus('Deleted.');
  renderContributions();
}

// ---- init ----

window.addEventListener('DOMContentLoaded', function() {
  var form = document.getElementById('contrib-form');
  if (form) form.addEventListener('submit', saveContribution);
  renderContributions();
});
