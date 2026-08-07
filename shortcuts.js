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