// ============================================================
// js/Modules/utils.js — Shared helper functions
//
// WHY THIS FILE EXISTS:
//   Before the refactor, safeHtml() and timeAgo() were copy-pasted
//   into script.js, community.js, and contributions.js separately.
//   Now they live here ONCE and every other file imports them.
//   If you ever need to fix a bug in safeHtml, you fix it in one place.
//
// HOW TO USE IN ANOTHER FILE:
//   import { safeHtml, timeAgo, setText, setHtml, setStatus } from './utils.js';
// ============================================================

/**
 * Escapes special HTML characters in a string so it is safe to inject
 * into innerHTML without risking XSS (cross-site scripting) attacks.
 * e.g.  safeHtml('<script>') → '&lt;script&gt;'
 */
export function safeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts an ISO date string into a human-readable "time ago" string.
 * e.g.  timeAgo('2025-01-01T00:00:00Z') → '3 days ago'
 */
export function timeAgo(dateString) {
  var s = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (s < 60)       return 'just now';
  if (s < 3600)     return Math.floor(s / 60)      + ' minutes ago';
  if (s < 86400)    return Math.floor(s / 3600)    + ' hours ago';
  if (s < 2592000)  return Math.floor(s / 86400)   + ' days ago';
  if (s < 31536000) return Math.floor(s / 2592000) + ' months ago';
  return Math.floor(s / 31536000) + ' years ago';
}

/**
 * Sets the textContent of an element by its id.
 * Safe — does nothing if the element doesn't exist on this page.
 */
export function setText(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Sets the innerHTML of an element by its id.
 * Only use this with content already sanitised by safeHtml().
 */
export function setHtml(id, value) {
  var el = document.getElementById(id);
  if (el) el.innerHTML = value;
}

/**
 * Displays a status message inside any element by its id.
 * Pass isError=true to show the message in red.
 *
 * Usage:
 *   setStatus('github-status', 'Loading…');
 *   setStatus('github-status', 'Not found', true);
 */
export function setStatus(elementId, message, isError) {
  var el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? '#b91c1c' : '#111827';
}
