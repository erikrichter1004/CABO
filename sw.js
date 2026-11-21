"use strict";
const CACHE="cabo-core-v2",ASSETS=["./","./index.html","./app.js","./manifest.webmanifest","./icon.svg","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(Promise.all([
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE&&key.startsWith("cabo-core-")).map(key=>caches.delete(key)))),
  self.clients.claim()
 ]));
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
 event.respondWith(fetch(event.request).then(async response=>{
  if(response.ok){const cache=await caches.open(CACHE);await cache.put(event.request,response.clone())}
  return response;
 }).catch(async()=>await caches.match(event.request)||await caches.match("./index.html")));
});
