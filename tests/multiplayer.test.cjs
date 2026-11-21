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
function client(identity){
 const app={innerHTML:""},dom=new Map();
 const timers=new Map();let nextTimer=0;
 const storage=new Map();
 const cryptoIds=[identity,"secret-token-"+identity+"-1234567890"];
 const ctx={
  console,Math,JSON,Date,structuredClone,Peer:SimPeer,
  crypto:{randomUUID:()=>cryptoIds.shift()||"backup-uuid-"+identity},
  sessionStorage:{
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

 const revision=a.view().revision;
 b.ctx.__stale={type:"action",revision:revision-1,sequence:999,action:{type:"cabo"}};
 b.evaluate("hostConn.send(__stale)");delete b.ctx.__stale;await settle();
 assert.equal(a.view().revision,revision);
 assert.equal(a.view().cabo,null);
 console.log("PASS outdated network action is rejected and does not change the turn");

 c.evaluate("hostConn.close()");await settle();
 assert.equal(a.view().players[2].connected,false);
 await c.runTimers(2500);await settle();
 assert.equal(a.view().players[2].connected,true);
 assert.equal(c.view().revision,a.view().revision);
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
 console.log("PASS voluntary host handoff preserves room, scores and remaining guest connections");
 console.log("PASS "+eventsSent+" simulated WebRTC messages exchanged");
}
main().catch(err=>{console.error(err);process.exitCode=1});
