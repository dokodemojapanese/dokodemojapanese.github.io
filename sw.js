/* Dokodemo offline cache. Bump VERSION each time you upload a new index.html */
const VERSION='myaing-v408';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
const SWV=+VERSION.split('v').pop();
/* v1.0.346: GitHub's CDN can hand out the OLD index.html for a few minutes after an upload. Always fetch with ?v= (bypasses the CDN copy)
   and never save an index.html that is older than this sw.js — that is what made the "new version" banner come back 3–5 times. */
function pageVer(t){const m=/ver:'1\.0\.(\d+)'/.exec(t||'');return m?+m[1]:0}
async function freshPage(){for(let i=0;i<3;i++){try{const res=await fetch('./index.html?v='+SWV+'-'+Date.now(),{cache:'no-store'});if(res&&res.ok){const t=await res.text();if(pageVer(t)>=SWV||i===2)return new Response(t,{headers:{'Content-Type':'text/html; charset=utf-8'}})}}catch(x){}await new Promise(r=>setTimeout(r,1500))}return null}
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(async c=>{
  await c.addAll(CORE.filter(u=>u!=='./'&&u!=='./index.html').map(u=>new Request(u+'?v='+SWV,{cache:'reload'}))).catch(()=>{});
  const pg=await freshPage();if(pg){await c.put('./index.html',pg.clone());await c.put('./',pg)}
  /* keep the plain names for icons/manifest too */
  for(const u of CORE.filter(u=>u!=='./'&&u!=='./index.html')){const r=await c.match(u+'?v='+SWV);if(r)await c.put(u,r)}
}).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  if(r.url.indexOf('config.json')>-1)return; /* on/off switches: always fresh from network */
  if(r.url.indexOf('er-api.com')>-1)return; /* v398 exchange rates: always live (the page keeps its own 6 h copy) */
  if(r.url.indexOf('/popup')>-1)return; /* v318 daily popup (popup.json + image): always from network */
  if(r.url.indexOf('topics2.json')>-1||r.url.indexOf('dlg2.txt')>-1||r.url.indexOf('xp2.txt')>-1){e.respondWith(fetch(r).then(res=>{if(res&&res.ok){const c=res.clone();caches.open(VERSION).then(x=>x.put(r,c))}return res}).catch(()=>caches.match(r)));return} /* v357 new topics: network first, offline copy */
  if(/\/sw\.js\?/.test(r.url)){e.respondWith(fetch(r));return} /* update check: network only, never saved */
  const isPage=r.mode==='navigate'||r.url.endsWith('index.html');
  if(isPage){ /* v1.0.176: open instantly from the saved copy (like a native app), refresh the saved copy in the background.
     New versions: the in-app update banner (index.html) checks sw.js and reloads. Offline: saved copy. */
    const net=fetch('./index.html?v='+SWV+'-'+Date.now(),{cache:'no-store',credentials:'same-origin'}).then(async res=>{if(res&&res.ok){const t=await res.clone().text();if(pageVer(t)>=SWV){const x=await caches.open(VERSION);const old=await x.match('./index.html');const ot=old?await old.text():'';if(pageVer(t)>=pageVer(ot))await x.put('./index.html',new Response(t,{headers:{'Content-Type':'text/html; charset=utf-8'}}))}}return res});
    net.catch(()=>{});e.respondWith(caches.match('./index.html').then(hit=>hit||net.catch(()=>caches.match('./index.html'))));return}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque')){const c=res.clone();caches.open(VERSION).then(x=>x.put(r,c))}return res}).catch(()=>hit)));
});

/* Push notifications (Sabbath reminders from Firebase Cloud Messaging) */
self.addEventListener('push',e=>{let p={};try{p=e.data?e.data.json():{}}catch(x){p={data:{body:e.data?e.data.text():''}}}
  const d=p.data||p.notification||p||{};const title=d.title||'Dokodemo',body=d.body||'';
  /* renotify + silent:false = play the phone's notification sound even when a notification with the same tag is replaced */
  e.waitUntil(Promise.all([
    self.registration.showNotification(title,{body,icon:'icon-192.png',badge:'icon-192.png',tag:d.tag||'dokodemo-sabbath',renotify:true,silent:false,vibrate:[200,100,200,100,400],timestamp:Date.now(),data:{url:d.url||'./',jp:d.jp||''}}),
    clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>cs.forEach(c=>{try{c.postMessage({t:'push',title,body,jp:d.jp||''})}catch(x){}}))
  ]))});
/* v1.0.215: tapping a notification opens the app and shows a card that reads the Japanese line aloud (index.html nsayShow) */
self.addEventListener('notificationclick',e=>{const n=e.notification,dd=n.data||{},m={t:'nclick',title:n.title||'',body:n.body||'',jp:dd.jp||''};n.close();
  let u=dd.url||'./';try{const x=new URL(u,self.registration.scope);x.searchParams.set('nt',m.title);x.searchParams.set('nb',m.body);if(m.jp)x.searchParams.set('nj',m.jp);u=x.href}catch(x){}
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{for(const c of cs){if('focus' in c){try{c.postMessage(m)}catch(x){}return c.focus()}}return clients.openWindow(u)}))});
