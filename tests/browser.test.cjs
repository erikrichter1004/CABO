"use strict";
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit,devices}=require("playwright");
const ROOT=path.resolve(__dirname,"..");
const contentTypes={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".webmanifest":"application/manifest+json",".css":"text/css"};
const peerStub=`window.Peer=class {
 constructor(id){this.id=id||"smoke-guest";this.open=false;this.handlers={};
   setTimeout(()=>{this.open=true;this.emit("open",this.id)},0)}
 on(event,callback){(this.handlers[event]??=[]).push(callback)}
 emit(event,data){for(const callback of this.handlers[event]||[])callback(data)}
 connect(){throw Error("Browser smoke test deliberately excludes live signaling")}
 destroy(){this.open=false}
};`;
function serve(){
 return http.createServer((req,res)=>{
  let requested;
  try{requested=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname)}catch{res.writeHead(400);res.end();return}
  const relative=requested==="/"?"/index.html":requested;
  const file=path.resolve(ROOT,"."+relative);
  if(!(file===path.join(ROOT,"index.html")||file.startsWith(ROOT+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile()){
   res.writeHead(404);res.end("Not found");return;
  }
  res.setHeader("content-type",contentTypes[path.extname(file)]||"application/octet-stream");
  res.setHeader("cache-control","no-cache");
  res.end(fs.readFileSync(file));
 });
}
async function browserCheck({name,engine,device}){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({...device,serviceWorkers:"allow"});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.route("https://unpkg.com/**",route=>route.fulfill({status:200,contentType:"text/javascript",body:peerStub}));
 try{
  await page.goto(globalThis.testURL,{waitUntil:"load",timeout:30000});
  await page.locator("#create").waitFor();
  assert.equal(await page.title(),"CABO Online");
  assert.equal(await page.locator("#join").isVisible(),true);
  assert.equal(await page.evaluate(()=>window.isSecureContext),true);
  await page.locator("#create").click();
  await page.locator("#playerName").fill("Browsercheck");
  await page.locator('[data-option="cards"]').selectOption("4");
  await page.locator('[data-option="peeks"]').selectOption("2");
  await page.locator("#go").click();
  await page.locator("#start").waitFor();
  assert.equal(await page.locator("#start").isDisabled(),true);
  const title=await page.locator("#app").innerText();
  assert.match(title,/Raum [0-9]{4}/);
  const room=await page.evaluate(()=>window.localStorage.getItem("caboRoom"));
  assert.match(room,/^[0-9]{4}$/);
  const installed=await page.evaluate(async()=>{
   const ready=await navigator.serviceWorker.ready;
   return {active:!!ready.active,script:ready.active?.scriptURL||""};
  });
  assert.ok(installed.active,"Service worker not active");
  assert.match(installed.script,/\/sw\.js/);
  const manifest=await page.evaluate(async()=>{
   const href=document.querySelector('link[rel="manifest"]')?.href;
   return href?await (await fetch(href)).json():null;
  });
  assert.equal(manifest?.display,"standalone");
  assert.ok(Array.isArray(manifest?.icons)&&manifest.icons.length);
  for(const icon of manifest.icons){
   const response=await page.evaluate(async src=>{
    const manifestUrl=document.querySelector('link[rel="manifest"]').href;
    const url=new URL(src,manifestUrl);
    const r=await fetch(url);
    return {status:r.status,type:r.headers.get("content-type")};
   },icon.src);
   assert.equal(response.status,200,"Icon missing: "+icon.src);
   assert.match(response.type,/image\//);
  }
  const cache=await page.evaluate(async()=>await caches.keys());
  assert.ok(cache.some(k=>k.startsWith("cabo-core-")),"Offline core assets missing");
  await page.locator("#leave").click();
  await page.locator("#create").waitFor();
  // Offline shell: game network must not work offline, but cached UI must remain loadable.
  await context.setOffline(true);
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.locator("#create").waitFor({timeout:15000});
  assert.equal(await page.locator("#join").isVisible(),true);
  assert.deepEqual(errors,[],"Uncaught browser errors: "+errors.join(" | "));
  console.log("PASS "+name+": interactive lobby, room creation, secure PWA, icon, service worker and offline shell");
 }finally{await context.close();await browser.close()}
}
async function main(){
 const server=serve();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 globalThis.testURL="http://127.0.0.1:"+server.address().port+"/";
 try{
  await browserCheck({name:"Chromium desktop",engine:chromium,device:{viewport:{width:1280,height:800}}});
  await browserCheck({name:"Chromium Android viewport",engine:chromium,device:devices["Pixel 5"]});
  await browserCheck({name:"WebKit iPhone viewport",engine:webkit,device:devices["iPhone 13"]});
 }finally{await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1});
