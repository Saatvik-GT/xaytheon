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