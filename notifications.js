(function(){
'use strict';
var lastCount=0,granted=false;
function requestPerm(){if(!('Notification' in window))return;if(Notification.permission==='granted'){granted=true;return;}if(Notification.permission!=='denied')Notification.requestPermission().then(function(p){granted=p==='granted';});}
function send(title,body){if(!granted||Notification.permission!=='granted')return;try{var n=new Notification(title,{body:body,tag:'xaytheon-activity',renotify:true});n.onclick=function(){window.focus();n.close();};setTimeout(function(){n.close();},5000);}catch(e){}}
function checkActivity(events){if(!events||!granted)return;if(lastCount>0&&events.length>lastCount)send('New GitHub Activity','You have '+(events.length-lastCount)+' new event(s).');lastCount=events.length;}
document.addEventListener('click',function h(){requestPerm();document.removeEventListener('click',h);});
window.XAYTHEON_NOTIFICATIONS={request:requestPerm,send:send,checkActivity:checkActivity};
})();