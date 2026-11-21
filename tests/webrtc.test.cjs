"use strict";
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {PeerServer}=require("peer");
const {chromium,webkit}=require("playwright");
const ROOT=path.resolve(__dirname,"..");
const contentTypes={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",".webmanifest":"application/manifest+json"};
const peerjsSource=fs.readFileSync(path.join(ROOT,"node_modules/peerjs/dist/peerjs.min.js"),"utf8");
function webServer(){
 return http.createServer((req,res)=>{
  let uri;
  try{uri=decodeURIComponent(new URL(req.url,"http://127.0.0.1").pathname)}
  catch{res.writeHead(400).end();return}
  const file=path.resolve(ROOT,"."+ (uri==="/"?"/index.html":uri));
  if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return}
  res.writeHead(200,{"content-type":contentTypes[path.extname(file)]||"application/octet-stream","cache-control":"no-store"});
  res.end(fs.readFileSync(file));
 });
}
async function pageFor(engine,url,port){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({serviceWorkers:"block",viewport:{width:430,height:850}});
 const page=await context.newPage(),pageErrors=[];
 page.on("pageerror",error=>pageErrors.push(error.message));
 page.on("console",m=>{if(m.type()==="error")console.log("Browser console:",m.text().slice(0,300))});
 const patchedPeer=peerjsSource+";window.__RealPeer=window.Peer;window.Peer=class extends window.__RealPeer{constructor(id){super(id,{host:'127.0.0.1',port:"+port+",path:'/cabo',secure:false,config:{iceServers:[]}})}};";
 await page.route("https://unpkg.com/**",route=>route.fulfill({status:200,contentType:"text/javascript",body:patchedPeer}));
 await page.goto(url,{waitUntil:"domcontentloaded",timeout:30000});
 await page.locator("#create").waitFor();
 return {browser,context,page,pageErrors};
}
async function exercise(hostEngine,guestEngine,name){
 console.log("Starting local PeerJS signaling for "+name);
 // PeerServer returns an Express application, not the listening HTTP server.
 // The supplied callback receives the actual HTTP server once bound.
 const signalingServer=await Promise.race([
  new Promise((resolve,reject)=>{
   try{PeerServer({port:0,host:"127.0.0.1",path:"/cabo",key:"peerjs"},resolve)}
   catch(error){reject(error)}
  }),
  new Promise((_,reject)=>setTimeout(()=>reject(Error("PeerServer did not start within 10 seconds")),10000))
 ]);
 const port=signalingServer.address()?.port;
 assert.ok(Number.isInteger(port)&&port>0,"PeerServer did not bind a valid port");
 console.log("Local signaling active on "+port);
 const server=webServer();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const url="http://127.0.0.1:"+server.address().port+"/";
 let host,guest;
 try{
  console.log("Opening Chromium/WebKit pages for "+name);
  host=await pageFor(hostEngine,url,port);
  guest=await pageFor(guestEngine,url,port);
  const a=host.page,b=guest.page;
  await a.locator("#create").click();
  await a.locator("#playerName").fill("Host");
  await a.locator("#go").click();
  await a.locator("#start").waitFor({timeout:15000});
  const room=await a.evaluate(()=>localStorage.getItem("caboRoom"));
  assert.match(room,/^[0-9]{4}$/);
  console.log("Host room ready: "+room);
  await b.locator("#join").click();
  await b.locator("#playerName").fill("Gast");
  await b.locator("#code").fill(room);
  await b.locator("#go").click();
  await a.waitForFunction(()=>state?.players.length===2&&state.players[1].connected===true,null,{timeout:25000});
  await b.waitForFunction(()=>state?.players.length===2&&state.stage==="lobby",null,{timeout:25000});
  console.log("Both browsers received lobby state");
  const conn=await b.evaluate(()=>({open:hostConn?.open,dc:hostConn?.dataChannel?.readyState||hostConn?._dc?.readyState,pc:hostConn?.peerConnection?.connectionState||hostConn?._pc?.connectionState,hasPc:!!(hostConn?.peerConnection||hostConn?._pc)}));
  assert.equal(conn.open,true,"guest PeerJS DataConnection must be open");
  assert.equal(conn.hasPc,true,"must use an actual RTCPeerConnection, not a synthetic message bus");
  assert.equal(conn.dc,"open","real browser RTC data channel must be open");
  await a.locator("#start").click();
  await a.locator('[data-peek="0"]').waitFor();
  await b.locator('[data-peek="0"]').waitFor();
  for(const p of [a,b]){
   for(const index of [0,1]){
    await p.locator('[data-peek="'+index+'"]').click();
    await p.locator("#closeInitialPeek").waitFor();
    await p.locator("#closeInitialPeek").click();
   }
   await p.locator("#donePeek").click();
  }
  await a.locator("#deck").waitFor();
  await a.locator("#deck").click();
  await a.waitForFunction(()=>drawn?.source==="deck");
  const drawnValue=await a.evaluate(()=>drawn.v);
  assert.equal(await b.evaluate(()=>drawn),null,"drawn card is private");
  await a.locator('[data-card="0"]').click();
  await a.locator("#swapDraw").click();
  await a.locator("#endTurn").click();
  await b.waitForFunction(()=>state?.stage==="playing"&&state?.players[state.turn]?.name==="Gast");
  assert.equal(await a.evaluate(()=>state.turn),await b.evaluate(()=>state.turn),"active turn matches");
  assert.equal(await a.evaluate(()=>state.revision),await b.evaluate(()=>state.revision),"revision matches");
  assert.deepEqual(host.pageErrors,[],"host script must have no uncaught errors");
  assert.deepEqual(guest.pageErrors,[],"guest script must have no uncaught errors");
  console.log("PASS "+name+": actual RTCPeerConnection and RTCDataChannel, room join, private peek/draw and shared turn; drawn card "+drawnValue);
 }finally{
  if(guest){await guest.context.close().catch(()=>{});await guest.browser.close().catch(()=>{})}
  if(host){await host.context.close().catch(()=>{});await host.browser.close().catch(()=>{})}
  await new Promise(resolve=>server.close(resolve));
  // Existing PeerJS WebSocket sessions should be closed with the browsers.
  // Force-close remaining HTTP sockets so a failed test cannot hang GitHub CI.
  signalingServer.closeAllConnections?.();
  signalingServer.close();
 }
}
async function main(){
 const guard=setTimeout(()=>{console.error("WebRTC browser integration timed out after 90 seconds");process.exit(1)},90000);
 try{
 await exercise(chromium,chromium,"Chromium ↔ Chromium");
 await exercise(chromium,webkit,"Chromium ↔ WebKit");
 }finally{clearTimeout(guard)}
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error);process.exit(1)});
