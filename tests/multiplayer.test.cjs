"use strict";
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");

const source=fs.readFileSync("app.js","utf8");
const peers=new Map();
let peerCounter=0,eventsSent=0;
class SimConnection {
 constructor(peerId){this.peer=peerId;this.open=true;this.handlers={};this.other=null}
 on(event,fn){(this.handlers[event]??=[]).push(fn)}
 emit(event,data){for(const fn of this.handlers[event]||[])fn(data)}
 send(msg){if(!this.open)return;eventsSent++;const copied=structuredClone(msg);queueMicrotask(()=>{if(this.open&&this.other?.open)this.other.emit("data",copied)})}
 close(){
  if(!this.open)return;
  this.open=false;if(this.other)this.other.open=false;
  queueMicrotask(()=>this.emit("close"));if(this.other)queueMicrotask(()=>this.other.emit("close"));
 }
}
class SimPeer {
 constructor(requested){
  this.id=requested||"sim-guest-"+(++peerCounter);
  this.handlers={};this.connections=[];this.open=false;
  queueMicrotask(()=>{
   if(peers.has(this.id)){this.emit("error",{type:"unavailable-id"});return}
   peers.set(this.id,this);this.open=true;this.emit("open",this.id);
  });
 }
 on(event,fn){(this.handlers[event]??=[]).push(fn)}
 emit(event,data){for(const fn of this.handlers[event]||[])fn(data)}
 connect(targetId){
  const local=new SimConnection(targetId);this.connections.push(local);
  queueMicrotask(()=>{
   const target=peers.get(targetId);
   if(!target){local.emit("error",{type:"peer-unavailable"});return}
   const remote=new SimConnection(this.id);target.connections.push(remote);
   local.other=remote;remote.other=local;
   target.emit("connection",remote);
   local.emit("open");
   remote.emit("open");
  });
  return local;
 }
 destroy(){
  if(peers.get(this.id)===this)peers.delete(this.id);
  this.open=false;
  for(const conn of this.connections)conn.close();
 }
}
function client(identity,existingStorage=null){
 const app={innerHTML:""},dom=new Map();
 const timers=new Map();let nextTimer=0;
 const storage=existingStorage||new Map(),session=new Map();
 const cryptoIds=[identity,"secret-token-"+identity+"-1234567890"];
 const ctx={
  console,Math,JSON,Date,structuredClone,Peer:SimPeer,
  crypto:{randomUUID:()=>cryptoIds.shift()||"backup-uuid-"+identity},
  sessionStorage:{
   getItem:k=>session.get(k)??null,
   setItem:(k,v)=>session.set(k,String(v)),
   removeItem:k=>session.delete(k)
  },
  localStorage:{
   getItem:k=>storage.get(k)??null,
   setItem:(k,v)=>storage.set(k,String(v)),
   removeItem:k=>storage.delete(k)
  },
  document:{
   getElementById:id=>{
    if(id==="app")return app;
    if(!dom.has(id))dom.set(id,{id,innerHTML:"",value:"",textContent:"",classList:{add(){},remove(){}},disabled:false,onclick:null});
    return dom.get(id);
   },
   querySelectorAll:()=>[]
  },
  setInterval:()=>0,
  clearTimeout:id=>timers.delete(id),
  setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id},
  confirm:()=>true
 };
 vm.createContext(ctx);
 vm.runInContext(source,ctx,{filename:"app.js"});
 return {
  identity,ctx,storage,timers,app,
  evaluate(code){return vm.runInContext(code,ctx)},
  view(){return JSON.parse(vm.runInContext("JSON.stringify(state)",ctx))},
  act(action){ctx.__action=action;try{vm.runInContext("sendAction(__action)",ctx)}finally{delete ctx.__action}},
  async runTimers(maxMs=10000){
   for(const [id,timer] of [...timers.entries()])if(timer.ms<=maxMs){timers.delete(id);timer.fn()}
   await settle();
  }
 };
}
async function settle(){for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve))}
function turnOf(c){const s=c.view();return s.players[s.turn]?.id}
async function main(){
 const a=client("client-a-identity-0001");
 const b=client("client-b-identity-0002");
 const c=client("client-c-identity-0003");
 a.evaluate("createRoom('A')");await settle();
 const room=a.evaluate("room");
 assert.match(room,/^\d{4}$/);
 b.evaluate("joinRoom('B', '"+room+"')");
 c.evaluate("joinRoom('C', '"+room+"')");
 await settle();
 assert.equal(a.view().players.length,3);
 assert.equal(b.view().players.length,3);
 assert.equal(c.view().players.length,3);
 assert.equal(a.view().revision,b.view().revision);
 assert.equal(b.view().revision,c.view().revision);
 console.log("PASS three simulated clients connect and synchronize their lobby");
 a.act({type:"start"});await settle();
 assert.equal(a.view().stage,"peeking");
 assert.equal(b.view().stage,"peeking");
 for(const player of [a,b,c]){
  for(const index of [0,1]){
   player.act({type:"initialPeek",index});await settle();
   assert.equal(player.evaluate("peek?.index"),index);
   player.act({type:"closeInitialPeek"});await settle();
  }
  player.act({type:"donePeek"});await settle();
 }
 assert.equal(a.view().stage,"playing");
 assert.equal(b.view().stage,"playing");
 assert.equal(c.view().stage,"playing");
 assert.equal(turnOf(a),a.identity);
 assert.equal(turnOf(b),a.identity);
 assert.equal(turnOf(c),a.identity);
 console.log("PASS private opening peeks, ready transition, identical current turn");

 a.act({type:"draw",source:"deck"});await settle();
 assert.equal(a.evaluate("drawn?.source"),"deck");
 assert.equal(b.evaluate("drawn"),null);
 assert.equal(c.evaluate("drawn"),null);
 a.act({type:"swapDraw",index:0});await settle();
 a.act({type:"endTurn"});await settle();
 assert.equal(turnOf(a),b.identity);assert.equal(turnOf(b),b.identity);assert.equal(turnOf(c),b.identity);
 b.act({type:"draw",source:"deck"});await settle();
 assert.equal(b.evaluate("drawn?.source"),"deck");
 assert.equal(a.evaluate("drawn"),null);assert.equal(c.evaluate("drawn"),null);
 b.act({type:"swapDraw",index:0});await settle();
 b.act({type:"endTurn"});await settle();
 assert.equal(turnOf(a),c.identity);assert.equal(turnOf(b),c.identity);assert.equal(turnOf(c),c.identity);
 assert.equal(a.view().revision,b.view().revision);
 assert.equal(b.view().revision,c.view().revision);
 console.log("PASS turns and private deck draws stay in sync on all three clients");
 const staleSnapshot=c.view();
 a.evaluate("broadcast()");await settle();
 const newerRevision=c.view().revision;
 c.ctx.__oldState=staleSnapshot;
 c.evaluate('hostConn.emit("data",{type:"state",state:__oldState})');
 delete c.ctx.__oldState;
 assert.equal(c.view().revision,newerRevision);
 assert.equal(turnOf(c),turnOf(a));
 console.log("PASS out-of-order older host snapshots cannot rewind the client's turn");

 const revision=a.view().revision;
 b.ctx.__stale={type:"action",revision:revision-1,sequence:999,action:{type:"cabo"}};
 b.evaluate("hostConn.send(__stale)");delete b.ctx.__stale;await settle();
 assert.equal(a.view().revision,revision);
 assert.equal(a.view().cabo,null);
 console.log("PASS outdated network action is rejected and does not change the turn");

 c.act({type:"draw",source:"deck"});await settle();
 const cDrawBeforeDisconnect=c.evaluate("drawn?.v");
 assert.equal(typeof cDrawBeforeDisconnect,"number");
 c.evaluate("hostConn.close()");await settle();
 assert.equal(a.view().players[2].connected,false);
 await c.runTimers(2500);await settle();
 assert.equal(a.view().players[2].connected,true);
 assert.equal(c.view().revision,a.view().revision);
 assert.equal(c.evaluate("drawn?.v"),cDrawBeforeDisconnect);
 assert.equal(a.view().players.length,3);
 console.log("PASS guest can disconnect and automatically rejoin without a duplicate seat");

 a.evaluate("leaveRoom()");await settle();
 assert.equal(a.evaluate("phase"),"home");
 assert.equal(b.evaluate("isHost"),true);
 assert.equal(b.view().host,b.identity);
 assert.equal(b.evaluate("room"),room);
 assert.equal(b.view().players[0].paused,true);
 await c.runTimers(2500);await settle();
 assert.equal(c.view().host,b.identity);
 assert.equal(c.view().revision,b.view().revision);
 assert.equal(c.view().players.length,3);
 assert.equal(c.evaluate("drawn?.v"),cDrawBeforeDisconnect);
 c.act({type:"swapDraw",index:0});await settle();
 assert.equal(c.evaluate("drawn"),null);
 assert.equal(c.view().revision,b.view().revision);
 console.log("PASS voluntary host handoff preserves room, private pending draw and remaining guest connections");
 c.evaluate("closeNet()");await settle();
 assert.equal(c.evaluate("localStorage.getItem('caboRoom')"),room);
 assert.equal(c.evaluate("localStorage.getItem('caboIdentity')"),c.identity);
 const reloaded=client(c.identity,c.storage);
 assert.ok(reloaded.app.innerHTML.includes('id="rejoin"'));
 reloaded.evaluate('document.getElementById("rejoin").onclick()');await settle();
 assert.equal(reloaded.view().host,b.identity);
 assert.equal(reloaded.view().revision,b.view().revision);
 assert.equal(b.view().players.find(p=>p.id===c.identity).connected,true);
 console.log("PASS reloaded guest reenters previous room without losing identity or score");
 console.log("PASS "+eventsSent+" simulated WebRTC messages exchanged");
}
async function recoveryScenario(){
 const d=client("client-d-identity-0004"),e=client("client-e-identity-0005");
 d.evaluate("createRoom('D')");await settle();
 const room=d.evaluate("room");
 e.evaluate("joinRoom('E','"+room+"')");await settle();
 assert.equal(d.view().players.length,2);
 d.act({type:"start"});await settle();
 for(const player of [d,e]){
  for(const index of [0,1]){
   player.act({type:"initialPeek",index});await settle();
   player.act({type:"closeInitialPeek"});await settle();
  }
  player.act({type:"donePeek"});await settle();
 }
 assert.equal(d.view().stage,"playing");
 d.act({type:"pause",id:e.identity});await settle();
 assert.equal(d.view().standby,null);
 assert.equal(e.evaluate("standbySnapshot"),null);
 const before=d.view().turnStart;
 d.evaluate("peer.destroy()");await settle();
 const blocker=new SimPeer("cabo-online-v1-"+room);await settle();
 d.evaluate(`const saved=JSON.parse(sessionStorage.getItem("caboHostSnapshot"));saved.savedAt=Date.now()-120000;sessionStorage.setItem("caboHostSnapshot",JSON.stringify(saved))`);
 d.evaluate("createRoom('D',true)");await settle();
 assert.equal(d.evaluate("phase"),"connecting");
 assert.ok(d.evaluate("hostResumeRetries")>=1);
 blocker.destroy();await settle();
 await d.runTimers(2500);await settle();
 assert.equal(d.evaluate("isHost"),true);
 assert.equal(d.evaluate("peer.open"),true);
 assert.equal(d.evaluate("room"),room);
 assert.equal(d.view().stage,"playing");
 assert.ok(d.view().turnStart-before>=110000,"turn clock must pause through downtime");
 assert.equal(d.view().players[1].connected,false);
 await e.runTimers(2500);await settle();
 assert.equal(e.view().players.length,2);
 assert.equal(e.view().revision,d.view().revision);
 assert.equal(d.view().players[1].connected,true);
 console.log("PASS crashed host can reclaim original room after PeerJS ID is released; guest rejoins");
 console.log("PASS resumed host freezes game clock through extended downtime");
}
async function automaticFailoverScenario(){
 const a=client("auto-host-a-identity-0006"),b=client("auto-guest-b-identity-0007"),c=client("auto-guest-c-identity-0008");
 a.evaluate("createRoom('A')");await settle();
 const room=a.evaluate("room");
 b.evaluate("joinRoom('B','"+room+"')");c.evaluate("joinRoom('C','"+room+"')");await settle();
 assert.equal(a.view().players.length,3);
 assert.equal(a.view().standby,b.identity);
 assert.equal(b.evaluate("standbySnapshot?.state?.host"),a.identity);
 assert.equal(c.evaluate("standbySnapshot"),null);
 a.act({type:"start"});await settle();
 for(const player of [a,b,c]){
  for(const index of [0,1]){player.act({type:"initialPeek",index});await settle();player.act({type:"closeInitialPeek"});await settle()}
  player.act({type:"donePeek"});await settle();
 }
 assert.equal(a.view().stage,"playing");
 for(const player of [a,b]){
  assert.equal(turnOf(a),player.identity);
  player.act({type:"draw",source:"deck"});await settle();
  player.act({type:"swapDraw",index:0});await settle();
  player.act({type:"endTurn"});await settle();
 }
 assert.equal(turnOf(a),c.identity);
 c.act({type:"draw",source:"deck"});await settle();
 const drawnValue=c.evaluate("drawn.v"),scoresBefore=a.view().players.map(p=>p.score);
 assert.equal(b.evaluate("standbySnapshot?.pending?.[\""+c.identity+"\"]?.v"),drawnValue);
 a.evaluate("peer.destroy()");await settle();
 assert.equal(b.evaluate("isHost"),true);
 assert.equal(b.evaluate("room"),room);
 assert.equal(b.view().host,b.identity);
 assert.equal(b.view().players[0].paused,true);
 assert.deepEqual(b.view().players.map(p=>p.score),scoresBefore);
 assert.equal(b.evaluate("pending[\""+c.identity+"\"]?.v"),drawnValue);
 await c.runTimers(2500);await settle();
 assert.equal(c.view().host,b.identity);
 assert.equal(c.view().revision,b.view().revision);
 assert.equal(c.evaluate("drawn?.v"),drawnValue);
 assert.equal(turnOf(c),c.identity);
 c.act({type:"swapDraw",index:0});await settle();
 assert.equal(c.evaluate("drawn"),null);
 assert.equal(b.view().revision,c.view().revision);
 assert.equal(b.evaluate("isHost"),true);
 console.log("PASS unannounced host crash elects designated standby, preserves room, all secrets, pending draws, scores and current turn");
 console.log("PASS remaining guest automatically reconnects and finishes draw under new host");
}
async function twoPlayerFailoverScenario(){
 const a=client("duo-host-a-identity-0009"),b=client("duo-guest-b-identity-0010");
 a.evaluate("createRoom('A')");await settle();const room=a.evaluate("room");
 b.evaluate("joinRoom('B','"+room+"')");await settle();
 a.act({type:"start"});await settle();
 for(const player of [a,b]){
  for(const index of [0,1]){player.act({type:"initialPeek",index});await settle();player.act({type:"closeInitialPeek"});await settle()}
  player.act({type:"donePeek"});await settle();
 }
 assert.equal(turnOf(a),a.identity);
 assert.equal(b.evaluate("standbySnapshot?.state?.host"),a.identity);
 a.evaluate("peer.destroy()");await settle();
 assert.equal(b.evaluate("isHost"),true);
 assert.equal(b.view().host,b.identity);
 assert.equal(turnOf(b),b.identity);
 assert.equal(b.evaluate("room"),room);
 b.act({type:"draw",source:"deck"});await settle();
 b.act({type:"swapDraw",index:0});await settle();
 b.act({type:"cabo"});await settle();
 assert.equal(b.view().stage,"reveal");
 assert.equal(b.view().players.length,2);
 console.log("PASS two-player sudden host loss elects only surviving player and permits completing CABO round");
}
async function standbyReassignmentScenario(){
 const a=client("switch-host-a-identity-0011"),b=client("switch-guest-b-identity-0012"),c=client("switch-guest-c-identity-0013");
 a.evaluate("createRoom('A')");await settle();const room=a.evaluate("room");
 b.evaluate("joinRoom('B','"+room+"')");c.evaluate("joinRoom('C','"+room+"')");await settle();
 assert.equal(a.view().standby,b.identity);
 assert.ok(b.evaluate("standbySnapshot"));
 a.act({type:"pause",id:b.identity});await settle();
 assert.equal(a.view().standby,c.identity);
 assert.equal(b.evaluate("standbySnapshot"),null);
 assert.equal(c.evaluate("standbySnapshot?.state?.host"),a.identity);
 a.evaluate("peer.destroy()");await settle();
 assert.equal(c.evaluate("isHost"),true);
 assert.equal(c.view().host,c.identity);
 assert.equal(c.evaluate("room"),room);
 assert.equal(c.view().players[1].paused,true);
 assert.equal(b.evaluate("isHost"),false);
 await b.runTimers(2500);await settle();
 assert.equal(b.view().host,c.identity);
 console.log("PASS pausing a standby revokes its complete backup and moves automatic succession to next active player");
}
async function heartbeatFailoverScenario(){
 const a=client("heartbeat-host-a-identity-0014"),b=client("heartbeat-guest-b-identity-0015");
 a.evaluate("createRoom('A')");await settle();const room=a.evaluate("room");
 b.evaluate("joinRoom('B','"+room+"')");await settle();
 assert.equal(b.evaluate("standbySnapshot?.state?.host"),a.identity);
 b.evaluate("hostLastSeenAt=Date.now()-22000;tick()");await settle();
 assert.equal(b.evaluate("isHost"),true);
 assert.equal(b.evaluate("phase"),"connecting");
 assert.ok(b.evaluate("hostResumeRetries")>=1);
 assert.equal(a.evaluate("peer.open"),true);
 a.evaluate("peer.destroy()");await settle();
 await b.runTimers(2500);await settle();
 assert.equal(b.evaluate("peer.open"),true);
 assert.equal(b.evaluate("room"),room);
 assert.equal(b.view().host,b.identity);
 console.log("PASS silent host heartbeat timeout cannot steal occupied peer ID; takeover retries until old host releases it");
}
main().then(recoveryScenario).then(automaticFailoverScenario).then(twoPlayerFailoverScenario).then(standbyReassignmentScenario).then(heartbeatFailoverScenario).catch(err=>{console.error(err);process.exitCode=1});
