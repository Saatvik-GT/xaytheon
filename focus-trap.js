(function(){
'use strict';
var FOCUSABLE='a[href],button:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),[contenteditable]';
var activeTrap=null;
function getFocusable(c){var e=c.querySelectorAll(FOCUSABLE);return Array.prototype.filter.call(e,function(el){return el.offsetParent!==null;});}
function trapFocus(container,options){releaseFocus();options=options||{};var onClose=options.onClose||function(){};var f=getFocusable(container);if(f.length===0)return;var first=f[0],last=f[f.length-1];function onKey(e){if(e.key==='Tab'){if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}function onEsc(e){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();releaseFocus();}}container.addEventListener('keydown',onKey);container.addEventListener('keydown',onEsc);first.focus();activeTrap={container:container,handlers:[onKey,onEsc],onClose:onClose};}
function releaseFocus(){if(!activeTrap)return;var c=activeTrap.container;for(var i=0;i<activeTrap.handlers.length;i++)c.removeEventListener('keydown',activeTrap.handlers[i]);activeTrap=null;}
window.XAYTHEON_FOCUS_TRAP={trap:trapFocus,release:releaseFocus};
})();