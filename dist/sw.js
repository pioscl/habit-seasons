const CACHE_PREFIX=`habit-seasons:${self.registration.scope}:`;
const CACHE=`${CACHE_PREFIX}v14`;
const ASSETS=['./','./index.html','./style.css','./app.js','./model.js','./core.js','./wallet.js','./goal-math.js','./goal-model.js','./goal-ui.js','./goals.css','./habit-icons.js','./icon.svg','./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys()
  .then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE).map(key=>caches.delete(key))))
  .then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const known=ASSETS.some(asset=>new URL(asset,self.registration.scope).pathname===url.pathname);
 if(!known&&event.request.mode!=='navigate')return;
 event.respondWith(caches.open(CACHE).then(async cache=>{
  const cached=await cache.match(event.request);
  if(cached)return cached;
  try{return await fetch(event.request)}
  catch(error){
   if(event.request.mode==='navigate')return cache.match(new URL('./index.html',self.registration.scope).href);
   throw error;
  }
 }));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();
});
