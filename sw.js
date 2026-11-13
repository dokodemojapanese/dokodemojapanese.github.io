/* Dokodemo offline cache. Bump VERSION each time you upload a new index.html */
const VERSION='myaing-v298';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  if(r.url.indexOf('config.json')>-1)return; /* on/off switches: always fresh from network */
  if(/\/sw\.js\?/.test(r.url)){e.respondWith(fetch(r));return} /* update check: network only, never saved */
  const isPage=r.mode==='navigate'||r.url.endsWith('index.html');
  if(isPage){ /* v1.0.176: open instantly from the saved copy (like a native app), refresh the saved copy in the background.
     New versions: the in-app update banner (index.html) checks sw.js and reloads. Offline: saved copy. */
    const net=fetch(r.url,{cache:'no-cache',credentials:'same-origin'}).then(res=>{if(res&&res.ok){const c=res.clone();caches.open(VERSION).then(x=>x.put('./index.html',c))}return res});
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
