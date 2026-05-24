// ============================================================
// contributions.js - Save and display your open source contributions
//
// No login required. All data is saved in the browser's localStorage.
// localStorage stores data on your computer — it persists between
// page refreshes but only on this browser.
// ============================================================

// The key we use to store contributions in localStorage
var STORAGE_KEY = 'xaytheon:contributions';
var editingContributionId = null;


// ============================================================
// LOCALSTORAGE HELPERS
// ============================================================

// Load all contributions from localStorage
// Returns an array of contribution objects, or [] if none saved yet
function loadContributionsFromStorage() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    return [];
  }
}

// Save an array of contributions to localStorage
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

// Create a random unique ID for each contribution
// e.g. "7f3b1a4d-8e2c-4f0b-9d1e-5c7a3b2d1e4f"
function createId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }
  // Older browser fallback
  var result = '';
  for (var i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      result += '-';
    } else if (i === 14) {
      result += '4';
    } else {
      result += Math.floor(Math.random() * 16).toString(16);
    }
  }
  return result;
}


// ============================================================
// UTILITY FUNCTIONS
// ============================================================

// Show a status message in the form
function setStatus(message, isError) {
  var el = document.getElementById('contrib-status');
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#111827';
}

// Make text safe to display in HTML (prevents injection attacks)
function safeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// ============================================================
// SAVE A CONTRIBUTION
// ============================================================

// Called when the form is submitted
function saveContribution(event) {
  event.preventDefault();  // stop the browser from reloading the page

  // Read all the form field values
  var project     = document.getElementById('cf-project').value.trim();
  var link        = document.getElementById('cf-link').value.trim();
  var program     = document.getElementById('cf-program').value.trim();
  var date        = document.getElementById('cf-date').value || null;
  var type        = document.getElementById('cf-type').value.trim();
  var description = document.getElementById('cf-desc').value.trim();
  var tech        = document.getElementById('cf-tech').value.trim();

  // Build the contribution object
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

  // Load existing contributions, add the new one at the top, save back
  var contributions = loadContributionsFromStorage();

if (editingContributionId) {

  for (var i = 0; i < contributions.length; i++) {

    if (contributions[i].id === editingContributionId) {

      contribution.id = editingContributionId;

      contribution.created_at =
        contributions[i].created_at;

      contributions[i] = contribution;

      break;
    }
  }

  editingContributionId = null;

  var submitButton =
    document.querySelector('#contrib-form button[type="submit"]');

  if (submitButton) {
    submitButton.textContent = 'Save Contribution';
  }

  setStatus('Contribution updated!');

} else {

  contributions.unshift(contribution);

  setStatus('Saved!');
}

saveContributionsToStorage(contributions);

  // Clear the form and refresh the displayed list
  document.getElementById('contrib-form').reset();
  renderContributions();
}


// ============================================================
// BUILD HTML FOR ONE CONTRIBUTION ROW
// ============================================================

function buildContributionRow(contribution) {
  // Format the date nicely
  var dateText = '';
  if (contribution.date) {
    dateText = new Date(contribution.date).toLocaleDateString();
  }

  // Build the meta line: "GSoC • Feature • Jan 1 2025 • React"
  var metaParts = [];
  if (contribution.program) metaParts.push(safeHtml(contribution.program));
  if (contribution.type)    metaParts.push(safeHtml(contribution.type));
  if (dateText)             metaParts.push(dateText);
  if (contribution.tech)    metaParts.push(safeHtml(contribution.tech));

  // Optional link to the repo or PR
  var linkHtml = '';
  if (contribution.link) {
    linkHtml =
      '<a href="' + safeHtml(contribution.link) + '" target="_blank" rel="noopener">View →</a> ';
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
        '<button class="btn btn-outline contrib-edit-btn" data-id="' + contribution.id + '">' +
  'Edit' +
'</button>' +
'<button class="btn btn-outline contrib-delete-btn" data-id="' + contribution.id + '">' + 
'Delete' +
        '</button>' +
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

  var contributions = loadContributionsFromStorage();

  if (contributions.length === 0) {
    list.innerHTML = '<div class="muted">No contributions yet. Add one above!</div>';
    return;
  }

  // Build HTML for every contribution and insert it
  var html = '';
  for (var i = 0; i < contributions.length; i++) {
    html += buildContributionRow(contributions[i]);
  }
  list.innerHTML = html;

  // Wire up the Delete button on each row
  var deleteButtons = list.querySelectorAll('.contrib-delete-btn');
  for (var i = 0; i < deleteButtons.length; i++) {
    // We wrap in a function so each button remembers its own "id"
    (function(btn) {
      btn.addEventListener('click', function() {
        deleteContribution(btn.getAttribute('data-id'));
      });
    })(deleteButtons[i]);
  }
  var editButtons = list.querySelectorAll('.contrib-edit-btn');

for (var j = 0; j < editButtons.length; j++) {

  (function(btn) {

    btn.addEventListener('click', function() {

      startEditContribution(btn.getAttribute('data-id'));

    });

  })(editButtons[j]);

}
}


// ============================================================
// DELETE A CONTRIBUTION
// ============================================================
// Load an existing contribution into the form for editing
function startEditContribution(id) 
{

  var contributions = loadContributionsFromStorage();

  for (var i = 0; i < contributions.length; i++) {

    if (contributions[i].id === id) {

      var contribution = contributions[i];

      document.getElementById('cf-project').value = contribution.project || '';
      document.getElementById('cf-link').value = contribution.link || '';
      document.getElementById('cf-program').value = contribution.program || '';
      document.getElementById('cf-date').value = contribution.date || '';
      document.getElementById('cf-type').value = contribution.type || '';
      document.getElementById('cf-desc').value = contribution.description || '';
      document.getElementById('cf-tech').value = contribution.tech || '';

      editingContributionId = id;

      var submitButton =
        document.querySelector('#contrib-form button[type="submit"]');

      if (submitButton) {
        submitButton.textContent = 'Update Contribution';
      }

      setStatus('Editing contribution...');

      break;
    }
  }
}
function deleteContribution(id) {
  if (!confirm('Delete this contribution?')) return;

  var contributions = loadContributionsFromStorage();

  // Build a new array with everything except the deleted one
  var filtered = [];
  for (var i = 0; i < contributions.length; i++) {
    if (contributions[i].id !== id) {
      filtered.push(contributions[i]);
    }
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
  if (form) {
    form.addEventListener('submit', saveContribution);
  }

  // Show any existing contributions right away
  renderContributions();
});
