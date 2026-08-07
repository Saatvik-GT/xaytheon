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