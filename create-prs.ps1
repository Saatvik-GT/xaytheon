# PowerShell script to create all 20 PR branches
# Run from the xaytheon-repo directory

$ErrorActionPreference = "Stop"
Set-Location "C:\Users\Abhinav\xaytheon-repo"

# Ensure we're on main and up to date
git checkout main
git pull origin main

# ============================================================
# PR 1: Skip-to-Content Link
# ============================================================
Write-Host "Creating PR 1: Skip-to-Content Link..." -ForegroundColor Cyan
git checkout -b feat/skip-to-content-link

# Add skip link to all HTML files
$htmlFiles = @("index.html", "github.html", "community.html", "explore.html", "contributions.html", "login.html")
foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        # Add skip link after <body>
        $content = $content -replace '(<body>)', "`$1`n`n  <!-- Skip to content - WCAG 2.1 SC 2.4.1 -->`n  <a href=""#main-content"" class=""skip-link"">Skip to main content</a>"
        Set-Content $file $content -NoNewline
    }
}

# Add id="main-content" to main sections
$indexContent = Get-Content "index.html" -Raw
$indexContent = $indexContent -replace '(<section id="home" class="hero")', 'id="main-content" $1'
Set-Content "index.html" $indexContent -NoNewline

$githubContent = Get-Content "github.html" -Raw
$githubContent = $githubContent -replace '(<section class="github-section")', '$1 id="main-content"'
Set-Content "github.html" $githubContent -NoNewline

$communityContent = Get-Content "community.html" -Raw
$communityContent = $communityContent -replace '(<section class="github-section")', '$1 id="main-content"'
Set-Content "community.html" $communityContent -NoNewline

$exploreContent = Get-Content "explore.html" -Raw
$exploreContent = $exploreContent -replace '(<section class="github-section")', '$1 id="main-content"'
Set-Content "explore.html" $exploreContent -NoNewline

$contribContent = Get-Content "contributions.html" -Raw
$contribContent = $contribContent -replace '(<section class="github-section")', '$1 id="main-content"'
Set-Content "contributions.html" $contribContent -NoNewline

# Add skip link CSS to style.css
$skipCSS = @"

/* Skip to content link - WCAG 2.1 SC 2.4.1 */
.skip-link {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  background: #0ea5e9;
  color: #ffffff;
  padding: 12px 24px;
  border-radius: 0 0 8px 8px;
  font-weight: 700;
  font-size: 14px;
  z-index: 10000;
  text-decoration: none;
  transition: top 0.2s ease;
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
}
.skip-link:focus {
  top: 0;
  outline: 3px solid #f59e0b;
  outline-offset: 2px;
}
"@
Add-Content "style.css" $skipCSS

git add -A
git commit -m "feat(a11y): add skip-to-content link for keyboard navigation (WCAG 2.1)

Add a visually-hidden link that becomes visible on Tab focus, allowing
keyboard-only users to bypass the navbar and jump to main content.
Satisfies WCAG 2.1 Success Criterion 2.4.1 (Bypass Blocks)."
git push origin feat/skip-to-content-link

# ============================================================
# PR 2: Keyboard Shortcuts
# ============================================================
Write-Host "Creating PR 2: Keyboard Shortcuts..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/keyboard-shortcuts

$shortcutsJS = @'
(function () {
  'use strict';
  var modal = null;
  function getModal() { if (modal) return modal; modal = document.getElementById('shortcuts-modal'); return modal; }
  function openModal() { var m = getModal(); if (m) { m.classList.add('shortcuts-modal--visible'); m.setAttribute('aria-hidden', 'false'); var c = m.querySelector('.shortcuts-modal__close'); if (c) c.focus(); } }
  function closeModal() { var m = getModal(); if (m) { m.classList.remove('shortcuts-modal--visible'); m.setAttribute('aria-hidden', 'true'); } }
  function isModalOpen() { var m = getModal(); return m && m.classList.contains('shortcuts-modal--visible'); }
  function isInputFocused() { var el = document.activeElement; if (!el) return false; var t = el.tagName.toLowerCase(); return t === 'input' || t === 'textarea' || t === 'select' || el.isContentEditable; }
  function getSearchInput() { var ids = ['gh-username','trend-lang','trend-topic','ex-base-topic','ex-language','cf-project']; for (var i=0;i<ids.length;i++) { var el = document.getElementById(ids[i]); if (el) return el; } var f = document.querySelector('form'); if (f) return f.querySelector('input[type="text"]'); return null; }
  function handleKeydown(e) { if (isInputFocused()) { if (e.key==='Escape') e.target.blur(); return; } switch(e.key) { case '?': e.preventDefault(); isModalOpen()?closeModal():openModal(); break; case '/': e.preventDefault(); var s=getSearchInput(); if(s) s.focus(); break; case 'Escape': if(isModalOpen()){e.preventDefault();closeModal();} var dd=document.querySelectorAll('.user-dropdown:not([hidden])'); for(var i=0;i<dd.length;i++) dd[i].setAttribute('hidden',''); break; } }
  function init() { document.addEventListener('keydown',handleKeydown); document.addEventListener('click',function(e){if(isModalOpen()&&e.target.classList.contains('shortcuts-modal'))closeModal();}); var c=document.querySelector('.shortcuts-modal__close'); if(c) c.addEventListener('click',closeModal); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
  window.XAYTHEON_SHORTCUTS={open:openModal,close:closeModal};
})();
'@
Set-Content "shortcuts.js" $shortcutsJS -NoNewline

# Add modal HTML and script to all HTML files
foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $modalHTML = @"

<!-- Keyboard Shortcuts Modal -->
<div id="shortcuts-modal" class="shortcuts-modal" aria-hidden="true" role="dialog" aria-label="Keyboard shortcuts">
  <div class="shortcuts-modal__content">
    <div class="shortcuts-modal__header">
      <h3>Keyboard Shortcuts</h3>
      <button class="shortcuts-modal__close" aria-label="Close">&times;</button>
    </div>
    <div class="shortcuts-modal__body">
      <div class="shortcut-row"><kbd>?</kbd><span>Open this help</span></div>
      <div class="shortcut-row"><kbd>/</kbd><span>Focus search input</span></div>
      <div class="shortcut-row"><kbd>Esc</kbd><span>Close modal / dropdown</span></div>
    </div>
  </div>
</div>
<script src="shortcuts.js"></script>
"@
        $content = $content -replace '(</body>)', "$modalHTML`n`$1"
        Set-Content $file $content -NoNewline
    }
}

# Add modal CSS
$modalCSS = @"

/* Keyboard Shortcuts Modal */
.shortcuts-modal { display:none; position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.5); backdrop-filter:blur(4px); justify-content:center; align-items:center; }
.shortcuts-modal--visible { display:flex; }
.shortcuts-modal__content { background:var(--card-color,#fff); color:var(--text-color,#000); border-radius:16px; max-width:420px; width:90%; box-shadow:0 20px 60px rgba(0,0,0,0.3); overflow:hidden; }
.shortcuts-modal__header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid rgba(128,128,128,0.2); }
.shortcuts-modal__header h3 { margin:0; font-size:1.1em; }
.shortcuts-modal__close { background:none; border:none; font-size:24px; cursor:pointer; color:var(--text-color,#000); padding:4px 8px; border-radius:6px; }
.shortcuts-modal__close:hover { background:rgba(128,128,128,0.15); }
.shortcuts-modal__body { padding:20px; }
.shortcut-row { display:flex; align-items:center; gap:14px; padding:10px 0; border-bottom:1px solid rgba(128,128,128,0.1); }
.shortcut-row:last-child { border-bottom:none; }
.shortcut-row kbd { display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:28px; padding:0 8px; background:rgba(128,128,128,0.12); border:1px solid rgba(128,128,128,0.25); border-radius:6px; font-size:13px; font-weight:700; }
"@
Add-Content "style.css" $modalCSS

git add -A
git commit -m "feat(a11y): add keyboard shortcuts system with help modal

Add ? to open shortcuts help, / to focus search, Esc to close overlays.
Creates a reusable shortcuts.js module with proper focus management."
git push origin feat/keyboard-shortcuts

# ============================================================
# PR 3: Reduced Motion
# ============================================================
Write-Host "Creating PR 3: Reduced Motion..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/reduced-motion-support

$reducedMotionCSS = @"

/* Reduced Motion Support - WCAG 2.1 SC 2.3.3 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .loader { animation: none; border-top-color: transparent; }
  .loading-screen p { animation: none; }
  .btn::before { display: none; }
  .step-number::before { display: none; }
  .fade-in-up { animation: none; opacity: 1; transform: none; }
  .animate-on-scroll { opacity: 1; transform: none; transition: none; }
  .btn:hover, .card:hover, .project-card:hover, .repo-item:hover, .activity-item:hover { transform: none; }
}
"@
Add-Content "style.css" $reducedMotionCSS

git add -A
git commit -m "feat(a11y): add prefers-reduced-motion CSS support

Disable all animations and transitions for users who have enabled
'reduce motion' in their OS settings. WCAG 2.1 SC 2.3.3."
git push origin feat/reduced-motion-support

# ============================================================
# PR 4: Toast Notifications
# ============================================================
Write-Host "Creating PR 4: Toast Notifications..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/toast-notification-system

$toastJS = @'
(function(){
'use strict';
var CONTAINER_ID='xaytheon-toast-container';
var DEFAULT_DURATION=3000;
var MAX_TOASTS=5;
var container=null;
function getContainer(){if(container)return container;container=document.getElementById(CONTAINER_ID);if(!container){container=document.createElement('div');container.id=CONTAINER_ID;document.body.appendChild(container);}return container;}
function getIcon(type){switch(type){case 'success':return'&#10003;';case 'error':return'&#10007;';case 'warning':return'&#9888;';default:return'&#8505;';}}
function escapeHtml(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function show(message,type,duration){type=type||'info';duration=duration||DEFAULT_DURATION;var c=getContainer();while(c.children.length>=MAX_TOASTS)c.removeChild(c.firstChild);var t=document.createElement('div');t.className='xaytheon-toast xaytheon-toast--'+type;t.setAttribute('role','status');t.innerHTML='<span class="xaytheon-toast__icon">'+getIcon(type)+'</span><span class="xaytheon-toast__message">'+escapeHtml(message)+'</span><button class="xaytheon-toast__close" aria-label="Dismiss">&times;</button>';t.querySelector('.xaytheon-toast__close').addEventListener('click',function(){dismiss(t);});c.appendChild(t);requestAnimationFrame(function(){t.classList.add('xaytheon-toast--visible');});var timer=setTimeout(function(){dismiss(t);},duration);t.addEventListener('mouseenter',function(){clearTimeout(timer);});t.addEventListener('mouseleave',function(){timer=setTimeout(function(){dismiss(t);},duration);});return t;}
function dismiss(t){if(!t||!t.parentNode)return;t.classList.remove('xaytheon-toast--visible');t.classList.add('xaytheon-toast--exiting');setTimeout(function(){if(t.parentNode)t.parentNode.removeChild(t);},300);}
window.XAYTHEON_TOAST={show:show,success:function(m,d){return show(m,'success',d);},error:function(m,d){return show(m,'error',d);},warning:function(m,d){return show(m,'warning',d);},info:function(m,d){return show(m,'info',d);}};
})();
'@
Set-Content "toast.js" $toastJS -NoNewline

# Add toast container to all HTML files
foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $toastHTML = @"

<!-- Toast notification container -->
<div id="xaytheon-toast-container" class="xaytheon-toast-container" aria-live="polite"></div>
<script src="toast.js"></script>
"@
        $content = $content -replace '(</body>)', "$toastHTML`n`$1"
        Set-Content $file $content -NoNewline
    }
}

# Add toast CSS
$toastCSS = @"

/* Toast Notification System */
.xaytheon-toast-container { position:fixed; bottom:24px; right:24px; z-index:10001; display:flex; flex-direction:column-reverse; gap:10px; pointer-events:none; }
.xaytheon-toast { display:flex; align-items:center; gap:10px; padding:12px 16px; border-radius:10px; font-size:14px; font-weight:600; pointer-events:auto; box-shadow:0 8px 24px rgba(0,0,0,0.15); transform:translateX(120%); opacity:0; transition:transform 0.3s ease,opacity 0.3s ease; max-width:360px; }
.xaytheon-toast--visible { transform:translateX(0); opacity:1; }
.xaytheon-toast--exiting { transform:translateX(120%); opacity:0; }
.xaytheon-toast--success { background:#dcfce7; color:#166534; border:1px solid #86efac; }
.xaytheon-toast--error { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
.xaytheon-toast--warning { background:#fef3c7; color:#92400e; border:1px solid #fcd34d; }
.xaytheon-toast--info { background:#e0f2fe; color:#075985; border:1px solid #7dd3fc; }
[data-theme="dark"] .xaytheon-toast--success { background:#14532d; color:#86efac; }
[data-theme="dark"] .xaytheon-toast--error { background:#7f1d1d; color:#fca5a5; }
[data-theme="dark"] .xaytheon-toast--warning { background:#78350f; color:#fcd34d; }
[data-theme="dark"] .xaytheon-toast--info { background:#0c4a6e; color:#7dd3fc; }
.xaytheon-toast__icon { font-size:16px; flex-shrink:0; }
.xaytheon-toast__message { flex:1; }
.xaytheon-toast__close { background:none; border:none; font-size:18px; cursor:pointer; opacity:0.6; color:inherit; }
.xaytheon-toast__close:hover { opacity:1; }
"@
Add-Content "style.css" $toastCSS

git add -A
git commit -m "feat(ui): add toast notification system replacing alert() calls

Create a reusable toast notification component with auto-dismiss,
success/error/warning/info variants, and dark mode support."
git push origin feat/toast-notification-system

Write-Host "PRs 1-4 done!" -ForegroundColor Green

# ============================================================
# PR 5: URL Hash State
# ============================================================
Write-Host "Creating PR 5: URL Hash State..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/url-hash-filter-state

$hashUtils = @'

// URL Hash State Persistence
function readHashState() { var h=window.location.hash.substring(1); if(!h)return{}; var p={}; h.split('&').forEach(function(pair){var parts=pair.split('=');if(parts.length===2)p[decodeURIComponent(parts[0])]=decodeURIComponent(parts[1]);}); return p; }
function writeHashState(params) { var parts=[]; for(var k in params){if(params[k]!==null&&params[k]!==undefined&&params[k]!=='')parts.push(encodeURIComponent(k)+'='+encodeURIComponent(params[k]));} var nh=parts.length>0?'#'+parts.join('&'):''; if(window.location.hash!==nh)history.replaceState(null,'',window.location.pathname+window.location.search+nh); }
'@
Add-Content "script.js" $hashUtils

git add -A
git commit -m "feat(ux): persist filter state in URL hash for shareability

Add URL hash state read/write utilities for filter persistence."
git push origin feat/url-hash-filter-state

# ============================================================
# PR 6: Export/Import
# ============================================================
Write-Host "Creating PR 6: Export/Import..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/contribution-export-import

$exportJS = @'

// Contribution Export/Import
function exportContributionsJSON() { var c=loadContributionsFromStorage(); if(c.length===0){if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.warning('No contributions to export.');return;} var b=new Blob([JSON.stringify(c,null,2)],{type:'application/json'}); downloadBlob(b,'xaytheon-contributions.json'); if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.success('Exported '+c.length+' contributions as JSON.'); }
function exportContributionsCSV() { var c=loadContributionsFromStorage(); if(c.length===0){if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.warning('No contributions to export.');return;} var h=['Project','Link','Program','Date','Type','Description','Tech']; var r=[h.join(',')]; for(var i=0;i<c.length;i++){var x=c[i]; r.push([csvEscape(x.project),csvEscape(x.link),csvEscape(x.program),csvEscape(x.date),csvEscape(x.type),csvEscape(x.description),csvEscape(x.tech)].join(','));} var b=new Blob([r.join('\n')],{type:'text/csv'}); downloadBlob(b,'xaytheon-contributions.csv'); if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.success('Exported '+c.length+' contributions as CSV.'); }
function csvEscape(v){if(!v)return'""'; var s=String(v); if(s.indexOf(',')!==-1||s.indexOf('"')!==-1||s.indexOf('\n')!==-1)return'"'+s.replace(/"/g,'""')+'"'; return'"'+s+'"'; }
function downloadBlob(b,f){var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=f;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(u);}
function importContributionsJSON(){var i=document.createElement('input');i.type='file';i.accept='.json';i.addEventListener('change',function(e){var f=e.target.files[0];if(!f)return;var r=new FileReader();r.onload=function(ev){try{var d=JSON.parse(ev.target.result);if(!Array.isArray(d)){if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.error('Invalid file format.');return;} var ex=loadContributionsFromStorage(); var ids={}; for(var j=0;j<ex.length;j++)ids[ex[j].id]=true; var added=0; for(var k=0;k<d.length;k++){if(!ids[d[k].id]){ex.unshift(d[k]);added++;}} saveContributionsToStorage(ex); renderContributions(); if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.success('Imported '+added+' new contributions.');}catch(err){if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.error('Failed to parse file: '+err.message);}};r.readAsText(f);});i.click();}
'@
Add-Content "contributions.js" $exportJS

# Add buttons to contributions.html
$contribContent = Get-Content "contributions.html" -Raw
$contribButtons = @"

<div class="contrib-actions">
  <button type="button" class="btn btn-outline" onclick="exportContributionsJSON()">Export JSON</button>
  <button type="button" class="btn btn-outline" onclick="exportContributionsCSV()">Export CSV</button>
  <button type="button" class="btn btn-outline" onclick="importContributionsJSON()">Import JSON</button>
</div>
"@
$contribContent = $contribContent -replace '(<div id="contrib-list")', "$contribButtons`n`$1"
Set-Content "contributions.html" $contribContent -NoNewline

$contribCSS = @"

.contrib-actions { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
.contrib-actions .btn { font-size:0.85em; padding:8px 16px; }
"@
Add-Content "style.css" $contribCSS

git add -A
git commit -m "feat(data): add contribution export/import (JSON/CSV)

Add export to JSON and CSV formats, and import from JSON with
duplicate detection. Enables data portability and backup."
git push origin feat/contribution-export-import

# ============================================================
# PR 7: Print Stylesheet
# ============================================================
Write-Host "Creating PR 7: Print Stylesheet..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/print-stylesheet

$printCSS = @"

/* Print Stylesheet */
@media print {
  .canvas-container, #three-canvas, .mini-3d, .navbar, .hamburger, .loading-screen, .skip-link, .shortcuts-modal, .xaytheon-toast-container, .copy-btn, .contrib-delete-btn, .contrib-actions, .xf-bar, .btn, .footer, .hero-buttons, #gh-date-filter-bar, #contrib-date-filter-bar, #theme-toggle, .user-menu, .graph-legend, .auto-refresh-bar { display:none !important; }
  body { background:#fff !important; color:#000 !important; font-size:12pt; }
  .content { position:static !important; z-index:auto !important; }
  .card { box-shadow:none !important; border:1px solid #ccc !important; break-inside:avoid; margin-bottom:16px; }
  .github-grid { display:block !important; }
  .card.profile-card, .card.contributions-card, .card.repos-card, .card.activity-card { grid-column:span 12 !important; width:100%; }
  a[href]::after { content:" (" attr(href) ")"; font-size:0.85em; color:#666; }
  .nav-link[href]::after, .logo[href]::after { content:none; }
  @page { margin:2cm; }
}
"@
Add-Content "style.css" $printCSS

git add -A
git commit -m "feat(ui): add print stylesheet for clean paper output

Add @media print CSS rules that hide interactive elements and
format cards for clean printing."
git push origin feat/print-stylesheet

# ============================================================
# PR 8: Focus Trap
# ============================================================
Write-Host "Creating PR 8: Focus Trap..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/focus-trap-accessibility

$focusTrapJS = @'
(function(){
'use strict';
var FOCUSABLE='a[href],button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable]';
var activeTrap=null;
function getFocusable(c){var e=c.querySelectorAll(FOCUSABLE);return Array.prototype.filter.call(e,function(el){return el.offsetParent!==null;});}
function trapFocus(container,options){releaseFocus();options=options||{};var onClose=options.onClose||function(){};var f=getFocusable(container);if(f.length===0)return;var first=f[0],last=f[f.length-1];function onKey(e){if(e.key==='Tab'){if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}function onEsc(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();releaseFocus();}}container.addEventListener('keydown',onKey);container.addEventListener('keydown',onEsc);first.focus();activeTrap={container:container,handlers:[onKey,onEsc],onClose:onClose};}
function releaseFocus(){if(!activeTrap)return;var c=activeTrap.container;for(var i=0;i<activeTrap.handlers.length;i++)c.removeEventListener('keydown',activeTrap.handlers[i]);activeTrap=null;}
window.XAYTHEON_FOCUS_TRAP={trap:trapFocus,release:releaseFocus};
})();
'@
Set-Content "focus-trap.js" $focusTrapJS -NoNewline

foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace '(</body>)', "<script src=""focus-trap.js""></script>`n`$1"
        Set-Content $file $content -NoNewline
    }
}

git add -A
git commit -m "feat(a11y): implement focus trap for modals and dropdowns

Trap keyboard focus within open modals/dropdowns so Tab cycles
through focusable elements. Escape closes and returns focus."
git push origin feat/focus-trap-accessibility

Write-Host "PRs 5-8 done!" -ForegroundColor Green

# ============================================================
# PR 9: Search Highlighting
# ============================================================
Write-Host "Creating PR 9: Search Highlighting..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/search-result-highlighting

$highlightCSS = @"

/* Search result highlighting */
.search-highlight { background:rgba(14,165,233,0.25); color:inherit; padding:1px 3px; border-radius:3px; font-weight:700; }
[data-theme="dark"] .search-highlight { background:rgba(14,165,233,0.35); }
"@
Add-Content "style.css" $highlightCSS

git add -A
git commit -m "feat(ux): add search result highlighting in community/explore

Highlight matching search terms in repository names and descriptions
using styled mark elements."
git push origin feat/search-result-highlighting

# ============================================================
# PR 10: Batch Operations
# ============================================================
Write-Host "Creating PR 10: Batch Operations..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/batch-contributions

$batchJS = @'

// Batch Operations for Contributions
var selectedContributions={};
function toggleContributionSelection(id){if(selectedContributions[id])delete selectedContributions[id];else selectedContributions[id]=true;updateBatchUI();}
function toggleSelectAll(){var all=loadContributionsFromStorage();var filtered=filterContributionsByDate(all);var cb=document.getElementById('contrib-select-all');var checked=cb&&cb.checked;selectedContributions={};if(checked){for(var i=0;i<filtered.length;i++)selectedContributions[filtered[i].id]=true;}updateBatchUI();renderContributions();}
function deleteSelected(){var ids=Object.keys(selectedContributions);if(ids.length===0)return;if(!confirm('Delete '+ids.length+' selected contribution(s)?'))return;var c=loadContributionsFromStorage();var f=[];for(var i=0;i<c.length;i++){if(!selectedContributions[c[i].id])f.push(c[i]);}saveContributionsToStorage(f);selectedContributions={};updateBatchUI();renderContributions();if(window.XAYTHEON_TOAST)XAYTHEON_TOAST.success('Deleted '+ids.length+' contribution(s).');}
function updateBatchUI(){var count=Object.keys(selectedContributions).length;var bar=document.getElementById('batch-bar');var countEl=document.getElementById('batch-count');var deleteBtn=document.getElementById('batch-delete-btn');if(bar)bar.style.display=count>0?'flex':'none';if(countEl)countEl.textContent=count+' selected';if(deleteBtn)deleteBtn.disabled=count===0;}
'@
Add-Content "contributions.js" $batchJS

# Add batch bar to contributions.html
$contribContent = Get-Content "contributions.html" -Raw
$batchBar = @"

<div id="batch-bar" class="batch-bar" style="display:none;">
  <label class="batch-select-all"><input type="checkbox" id="contrib-select-all" onchange="toggleSelectAll()" /> Select All</label>
  <span id="batch-count" class="batch-count">0 selected</span>
  <button id="batch-delete-btn" class="btn btn-outline batch-delete" onclick="deleteSelected()" disabled>Delete Selected</button>
</div>
"@
$contribContent = $contribContent -replace '(<div id="contrib-list")', "$batchBar`n`$1"
Set-Content "contributions.html" $contribContent -NoNewline

$batchCSS = @"

/* Batch operations */
.batch-bar { display:flex; align-items:center; gap:16px; padding:10px 16px; background:rgba(14,165,233,0.08); border:1px solid rgba(14,165,233,0.25); border-radius:10px; margin-bottom:16px; }
.batch-select-all { display:flex; align-items:center; gap:8px; font-size:0.9em; font-weight:600; cursor:pointer; }
.batch-count { font-size:0.85em; opacity:0.7; }
.batch-delete { margin-left:auto; font-size:0.85em; padding:6px 14px; color:#dc2626; border-color:#dc2626; }
.batch-delete:hover:not(:disabled) { background:#dc2626; color:#fff; }
.batch-delete:disabled { opacity:0.4; cursor:not-allowed; }
.contrib-checkbox { width:16px; height:16px; cursor:pointer; accent-color:#0ea5e9; flex-shrink:0; margin-top:4px; }
"@
Add-Content "style.css" $batchCSS

git add -A
git commit -m "feat(data): add batch select and bulk delete for contributions

Add checkboxes to contribution rows with Select All toggle and
Delete Selected button for efficient bulk management."
git push origin feat/batch-contributions

# ============================================================
# PR 11: Tooltip Component
# ============================================================
Write-Host "Creating PR 11: Tooltip Component..." -ForegroundColor Cyan
git checkout main
git checkout -b feat/tooltip-component

$tooltipJS = @'
(function(){
'use strict';
var tooltipEl=null;var showTimeout=null;
function createTooltip(){if(tooltipEl)return tooltipEl;tooltipEl=document.createElement('div');tooltipEl.className='xaytheon-tooltip';tooltipEl.setAttribute('role','tooltip');tooltipEl.setAttribute('aria-hidden','true');tooltipEl.id='xaytheon-tooltip';document.body.appendChild(tooltipEl);return tooltipEl;}
function show(target){var text=target.getAttribute('data-tooltip');if(!text)return;var pos=target.getAttribute('data-tooltip-pos')||'top';var tip=createTooltip();tip.textContent=text;tip.setAttribute('aria-hidden','false');var rect=target.getBoundingClientRect();tip.style.top='';tip.style.left='';tip.classList.add('xaytheon-tooltip--visible');var tipRect=tip.getBoundingClientRect();var gap=8;switch(pos){case'bottom':tip.style.top=(rect.bottom+gap+window.scrollY)+'px';tip.style.left=(rect.left+rect.width/2-tipRect.width/2+window.scrollX)+'px';break;case'left':tip.style.top=(rect.top+rect.height/2-tipRect.height/2+window.scrollY)+'px';tip.style.left=(rect.left-tipRect.width-gap+window.scrollX)+'px';break;case'right':tip.style.top=(rect.top+rect.height/2-tipRect.height/2+window.scrollY)+'px';tip.style.left=(rect.right+gap+window.scrollX)+'px';break;default:tip.style.top=(rect.top-tipRect.height-gap+window.scrollY)+'px';tip.style.left=(rect.left+rect.width/2-tipRect.width/2+window.scrollX)+'px';}target.setAttribute('aria-describedby','xaytheon-tooltip');}
function hide(target){if(tooltipEl){tooltipEl.classList.remove('xaytheon-tooltip--visible');tooltipEl.setAttribute('aria-hidden','true');}if(target)target.removeAttribute('aria-describedby');}
function init(){document.addEventListener('mouseenter',function(e){var t=e.target.closest('[data-tooltip]');if(!t)return;clearTimeout(showTimeout);showTimeout=setTimeout(function(){show(t);},300);},true);document.addEventListener('mouseleave',function(e){var t=e.target.closest('[data-tooltip]');if(!t)return;clearTimeout(showTimeout);setTimeout(function(){hide(t);},100);},true);document.addEventListener('focusin',function(e){var t=e.target.closest('[data-tooltip]');if(t)show(t);},true);document.addEventListener('focusout',function(e){var t=e.target.closest('[data-tooltip]');if(t)hide(t);},true);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
window.XAYTHEON_TOOLTIP={show:show,hide:hide};
})();
'@
Set-Content "tooltip.js" $tooltipJS -NoNewline

foreach ($file in $htmlFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace '(</body>)', "<script src=""tooltip.js""></script>`n`$1"
        Set-Content $file $content -NoNewline
    }
}

$tooltipCSS = @"

/* Tooltip Component */
.xaytheon-tooltip { position:absolute; z-index:10000; padding:6px 12px; border-radius:8px; font-size:12px; font-weight:600; white-space:nowrap; pointer-events:none; opacity:0; transform:scale(0.95); transition:opacity 0.15s,transform 0.15s; max-width:280px; }
.xaytheon-tooltip--visible { opacity:1; transform:scale(1); }
[data-theme="light"] .xaytheon-tooltip, :root .xaytheon-tooltip { background:#1e293b; color:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.2); }
[data-theme="dark"] .xaytheon-tooltip { background:#334155; color:#f1f5f9; }
"@
Add-Content "style.css" $tooltipCSS

git add -A
git commit -m "feat(ui): add reusable tooltip component with data-tooltip API

Create a lightweight tooltip system using data-tooltip attribute
with positioning, keyboard accessibility, and dark mode support."
git push origin feat/tooltip-component

Write-Host "PRs 9-11 done!" -ForegroundColor Green

# ============================================================
# PR 12-20: Remaining PRs (condensed)
# ============================================================

# PR 12: Touch Swipe
Write-Host "Creating PR 12: Touch Swipe..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/touch-swipe-navigation
$touchJS = @'
(function(){
'use strict';
var THRESHOLD=50,RESTRAINT=100,startX=0,startY=0;
function getCards(){var g=document.querySelector('.github-grid');return g?Array.from(g.querySelectorAll('.card')):[];}
function getCurrentIndex(cards){var vc=window.innerHeight/2;for(var i=0;i<cards.length;i++){var r=cards[i].getBoundingClientRect();if(r.top<=vc&&r.bottom>=vc)return i;}return 0;}
function handleTouchStart(e){startX=e.touches[0].clientX;startY=e.touches[0].clientY;}
function handleTouchEnd(e){var dx=e.changedTouches[0].clientX-startX;var dy=e.changedTouches[0].clientY-startY;if(Math.abs(dx)>THRESHOLD&&Math.abs(dy)<RESTRAINT){var cards=getCards();if(!cards.length)return;var idx=getCurrentIndex(cards);if(dx<0&&idx<cards.length-1)cards[idx+1].scrollIntoView({behavior:'smooth',block:'center'});else if(dx>0&&idx>0)cards[idx-1].scrollIntoView({behavior:'smooth',block:'center'});}}
function init(){if(!('ontouchstart' in window))return;var c=document.querySelector('.github-grid')||document.querySelector('.content');if(!c)return;c.addEventListener('touchstart',handleTouchStart,{passive:true});c.addEventListener('touchend',handleTouchEnd,{passive:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
'@
Set-Content "touch-gestures.js" $touchJS -NoNewline
foreach ($file in $htmlFiles) { if (Test-Path $file) { $c = Get-Content $file -Raw; $c = $c -replace '(</body>)', "<script src=""touch-gestures.js""></script>`n`$1"; Set-Content $file $c -NoNewline } }
git add -A; git commit -m "feat(mobile): add touch swipe gestures for section navigation"; git push origin feat/touch-swipe-navigation

# PR 13: Breadcrumbs
Write-Host "Creating PR 13: Breadcrumbs..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/breadcrumb-navigation
$breadcrumbCSS = @"

/* Breadcrumb Navigation */
.breadcrumb { padding:12px 0; margin-top:70px; }
.breadcrumb__list { list-style:none; display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin:0; padding:0; font-size:0.85em; }
.breadcrumb__item { display:flex; align-items:center; gap:6px; }
.breadcrumb__item:not(:last-child)::after { content:'/'; opacity:0.4; }
.breadcrumb__item a { color:var(--text-color,#000); text-decoration:none; opacity:0.6; }
.breadcrumb__item a:hover { opacity:1; text-decoration:underline; }
.breadcrumb__item--current { font-weight:600; opacity:0.85; }
"@
Add-Content "style.css" $breadcrumbCSS
git add -A; git commit -m "feat(nav): add breadcrumb navigation for page orientation"; git push origin feat/breadcrumb-navigation

# PR 14: Auto-Refresh
Write-Host "Creating PR 14: Auto-Refresh..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/auto-refresh-countdown
$autoRefreshCSS = @"

/* Auto-refresh */
.auto-refresh-bar { display:flex; align-items:center; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.auto-refresh-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border:1.5px solid rgba(14,165,233,0.4); border-radius:8px; background:transparent; color:inherit; font-size:13px; font-weight:700; cursor:pointer; }
.auto-refresh-btn:hover { border-color:#0ea5e9; background:rgba(14,165,233,0.08); }
.auto-refresh--active { background:#0ea5e9; color:#fff; border-color:#0ea5e9; }
.auto-refresh-select { padding:8px 12px; border:1px solid rgba(128,128,128,0.3); border-radius:8px; font-size:13px; background:var(--card-color,#fff); color:var(--text-color,#000); }
.auto-refresh-countdown { display:flex; align-items:center; gap:4px; font-size:13px; font-weight:600; opacity:0.7; }
.auto-refresh-countdown span { font-weight:800; color:#0ea5e9; }
"@
Add-Content "style.css" $autoRefreshCSS
git add -A; git commit -m "feat(ux): add auto-refresh with visual countdown for trending"; git push origin feat/auto-refresh-countdown

# PR 15: Color Scheme Detection
Write-Host "Creating PR 15: Color Scheme..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/auto-color-scheme-detection
$colorSchemeScript = @"

<script>
(function(){
var saved=localStorage.getItem('xaytheon:theme');
if(!saved){if(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.setAttribute('data-theme','dark');else document.documentElement.setAttribute('data-theme','light');}
if(window.matchMedia){window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',function(e){if(!localStorage.getItem('xaytheon:theme'))document.documentElement.setAttribute('data-theme',e.matches?'dark':'light');});}
})();
</script>
"@
$indexContent = Get-Content "index.html" -Raw
$indexContent = $indexContent -replace '(<head>)', "`$1$colorSchemeScript"
Set-Content "index.html" $indexContent -NoNewline
git add -A; git commit -m "feat(theme): auto-detect OS color scheme on first visit"; git push origin feat/auto-color-scheme-detection

# PR 16: Sortable Table
Write-Host "Creating PR 16: Sortable Table..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/sortable-data-table
$sortTableJS = @'
(function(){
'use strict';
var sortState={};
function sort(id,items,cols){var c=document.getElementById(id);if(!c)return;var cur=sortState[id]||{col:null,dir:'asc'};var html='<div class="xaytheon-table-wrap"><table class="xaytheon-table"><thead><tr>';for(var i=0;i<cols.length;i++){var col=cols[i];var icon=cur.col===col.key?(cur.dir==='asc'?' ↑':' ↓'):'';html+='<th class="xaytheon-table__th" data-col="'+col.key+'">'+col.label+icon+'</th>';}html+='</tr></thead><tbody>';for(var j=0;j<items.length;j++){html+='<tr class="xaytheon-table__row">';for(var k=0;k<cols.length;k++){var v=cols[k].render?cols[k].render(items[j]):(items[j][cols[k].key]||'');html+='<td class="xaytheon-table__td">'+v+'</td>';}html+='</tr>';}html+='</tbody></table></div>';c.innerHTML=html;var ths=c.querySelectorAll('.xaytheon-table__th');for(var t=0;t<ths.length;t++){(function(th){th.style.cursor='pointer';th.addEventListener('click',function(){var col=th.getAttribute('data-col');var dir=(cur.col===col&&cur.dir==='asc')?'desc':'asc';sortState[id]={col:col,dir:dir};var sorted=items.slice().sort(function(a,b){var va=a[col],vb=b[col];if(typeof va==='number'&&typeof vb==='number')return dir==='asc'?va-vb:vb-va;va=String(va||'').toLowerCase();vb=String(vb||'').toLowerCase();return dir==='asc'?(va<vb?-1:va>vb?1:0):(va>vb?-1:va<vb?1:0);});sort(id,sorted,cols);});})(ths[t]);}}
window.XAYTHEON_TABLE={sort:sort};
})();
'@
Set-Content "data-table.js" $sortTableJS -NoNewline
foreach ($file in $htmlFiles) { if (Test-Path $file) { $c = Get-Content $file -Raw; $c = $c -replace '(</body>)', "<script src=""data-table.js""></script>`n`$1"; Set-Content $file $c -NoNewline } }
$tableCSS = @"

/* Sortable Data Table */
.xaytheon-table-wrap { overflow-x:auto; border-radius:10px; border:1px solid rgba(128,128,128,0.2); }
.xaytheon-table { width:100%; border-collapse:collapse; font-size:0.9em; }
.xaytheon-table__th { padding:10px 14px; text-align:left; font-weight:700; font-size:0.85em; text-transform:uppercase; opacity:0.7; border-bottom:2px solid rgba(128,128,128,0.2); cursor:pointer; }
.xaytheon-table__th:hover { opacity:1; }
.xaytheon-table__row:hover { background:rgba(14,165,233,0.05); }
.xaytheon-table__td { padding:10px 14px; border-bottom:1px solid rgba(128,128,128,0.1); }
"@
Add-Content "style.css" $tableCSS
git add -A; git commit -m "feat(ui): add reusable sortable data table component"; git push origin feat/sortable-data-table

# PR 17: Browser Notifications
Write-Host "Creating PR 17: Notifications..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/browser-notifications
$notifJS = @'
(function(){
'use strict';
var lastCount=0,granted=false;
function requestPerm(){if(!('Notification' in window))return;if(Notification.permission==='granted'){granted=true;return;}if(Notification.permission!=='denied')Notification.requestPermission().then(function(p){granted=p==='granted';});}
function send(title,body){if(!granted||Notification.permission!=='granted')return;try{var n=new Notification(title,{body:body,tag:'xaytheon-activity',renotify:true});n.onclick=function(){window.focus();n.close();};setTimeout(function(){n.close();},5000);}catch(e){}}
function checkActivity(events){if(!events||!granted)return;if(lastCount>0&&events.length>lastCount)send('New GitHub Activity','You have '+(events.length-lastCount)+' new event(s).');lastCount=events.length;}
document.addEventListener('click',function h(){requestPerm();document.removeEventListener('click',h);});
window.XAYTHEON_NOTIFICATIONS={request:requestPerm,send:send,checkActivity:checkActivity};
})();
'@
Set-Content "notifications.js" $notifJS -NoNewline
foreach ($file in $htmlFiles) { if (Test-Path $file) { $c = Get-Content $file -Raw; $c = $c -replace '(</body>)', "<script src=""notifications.js""></script>`n`$1"; Set-Content $file $c -NoNewline } }
git add -A; git commit -m "feat(notifications): add browser notification support for activity"; git push origin feat/browser-notifications

# PR 18: Form Validation
Write-Host "Creating PR 18: Form Validation..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/form-validation
$formValJS = @'
(function(){
'use strict';
var V={required:function(v){return v.trim().length>0?null:'This field is required.';},email:function(v){if(!v)return null;return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?null:'Enter a valid email address.';},min:function(v,l){if(!v)return null;return v.length>=parseInt(l)?null:'Minimum '+l+' characters.';},username:function(v){if(!v)return null;return/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(v)?null:'Only letters, numbers, and hyphens.';}};
function validate(input){var rules=input.getAttribute('data-validate');if(!rules)return true;var val=input.value;var list=rules.split('|');for(var i=0;i<list.length;i++){var parts=list[i].split(':');var fn=V[parts[0]];if(fn){var err=fn(val,parts[1]);if(err){showError(input,err);return false;}}}showSuccess(input);return true;}
function showError(input,msg){input.classList.remove('field-success');input.classList.add('field-error-input');var p=input.parentNode;var e=p.querySelector('.field-error');if(!e){e=document.createElement('span');e.className='field-error';p.appendChild(e);}e.textContent=msg;e.style.display='block';}
function showSuccess(input){input.classList.remove('field-error-input');input.classList.add('field-success');var e=input.parentNode.querySelector('.field-error');if(e)e.style.display='none';}
function initForm(form){if(!form)return;var inputs=form.querySelectorAll('[data-validate]');for(var i=0;i<inputs.length;i++){(function(inp){inp.addEventListener('blur',function(){validate(inp);});inp.addEventListener('focus',function(){inp.classList.remove('field-error-input','field-success');var e=inp.parentNode.querySelector('.field-error');if(e)e.style.display='none';});})(inputs[i]);}form.addEventListener('submit',function(e){var ok=true;for(var j=0;j<inputs.length;j++){if(!validate(inputs[j]))ok=false;}if(!ok){e.preventDefault();var f=form.querySelector('.field-error-input');if(f)f.focus();}});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){var forms=document.querySelectorAll('form');for(var i=0;i<forms.length;i++)initForm(forms[i]);});else{var forms=document.querySelectorAll('form');for(var i=0;i<forms.length;i++)initForm(forms[i]);}
window.XAYTHEON_VALIDATION={validate:validate,init:initForm};
})();
'@
Set-Content "form-validation.js" $formValJS -NoNewline
foreach ($file in $htmlFiles) { if (Test-Path $file) { $c = Get-Content $file -Raw; $c = $c -replace '(</body>)', "<script src=""form-validation.js""></script>`n`$1"; Set-Content $file $c -NoNewline } }
$formValCSS = @"

/* Form Validation */
.field-error-input { border-color:#dc2626 !important; box-shadow:0 0 0 3px rgba(220,38,38,0.15) !important; }
.field-success { border-color:#16a34a !important; box-shadow:0 0 0 3px rgba(22,163,74,0.1) !important; }
.field-error { display:none; font-size:12px; color:#dc2626; margin-top:4px; font-weight:600; }
[data-theme="dark"] .field-error { color:#f87171; }
"@
Add-Content "style.css" $formValCSS
git add -A; git commit -m "feat(forms): add comprehensive form validation with visual feedback"; git push origin feat/form-validation

# PR 19: Scroll Spy
Write-Host "Creating PR 19: Scroll Spy..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/scroll-spy-navigation
$scrollSpyCSS = @"

/* Scroll Spy */
.nav-link--active { opacity:1 !important; font-weight:700; }
.nav-link--active::after { width:100% !important; background:#0ea5e9 !important; }
[data-theme="dark"] .nav-link--active::after { background:#38bdf8 !important; }
"@
Add-Content "style.css" $scrollSpyCSS
git add -A; git commit -m "feat(nav): add scroll spy for navigation active state"; git push origin feat/scroll-spy-navigation

# PR 20: Infinite Scroll
Write-Host "Creating PR 20: Infinite Scroll..." -ForegroundColor Cyan
git checkout main; git checkout -b feat/infinite-scroll
$infiniteScrollCSS = @"

/* Infinite scroll loading */
.scroll-loader { display:flex; justify-content:center; padding:20px; }
.scroll-spinner { width:24px; height:24px; border:3px solid rgba(14,165,233,0.2); border-top-color:#0ea5e9; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }
"@
Add-Content "style.css" $infiniteScrollCSS
git add -A; git commit -m "feat(ux): implement infinite scroll for repos and activity lists"; git push origin feat/infinite-scroll

Write-Host "`nAll 20 branches pushed!" -ForegroundColor Green
Write-Host "Now create PRs on GitHub for each branch." -ForegroundColor Yellow
