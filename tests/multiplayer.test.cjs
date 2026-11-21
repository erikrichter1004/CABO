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
function client(identity,existingStorage=null,randomSeed=null){
 const app={innerHTML:""},dom=new Map();
 const timers=new Map();let nextTimer=0;
 const storage=existingStorage||new Map(),session=new Map();
 const cryptoIds=[identity,"secret-token-"+identity+"-1234567890"];
 const localMath=Object.create(Math);
 if(randomSeed!==null){
  let rng=randomSeed>>>0;
  localMath.random=()=>((rng=(Math.imul(rng,1664525)+1013904223)>>>0)/4294967296);
 }
 const ctx={
  console,Math:localMath,JSON,Date,structuredClone,Peer:SimPeer,
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

async function completeGameScenario(){
 const a=client("game-host-a-identity-0016"),b=client("game-guest-b-identity-0017"),c=client("game-guest-c-identity-0018");
 a.evaluate('opts={...defaults,endMode:"rounds",roundLimit:3,cards:4,peeks:2,turnsAfterCabo:1,abilityMode:"classic",abilityMandatory:false}');
 a.evaluate("createRoom('A')");await settle();
 const room=a.evaluate("room");
 b.evaluate("joinRoom('B',"+JSON.stringify(room)+")");
 c.evaluate("joinRoom('C',"+JSON.stringify(room)+")");
 await settle();
 const participants=[a,b,c],byId=new Map(participants.map(p=>[p.identity,p]));
 assert.equal(a.view().players.length,3);
 a.act({type:"start"});await settle();
 let previousScores=[0,0,0],previousRescued=[false,false,false],totalTurns=0;
 for(let round=1;round<=3;round++){
  assert.equal(a.view().stage,"peeking");
  assert.equal(a.view().round,round);
  for(const p of participants){
   assert.equal(p.view().stage,"peeking");
   for(const index of [0,1]){
    p.act({type:"initialPeek",index});await settle();
    assert.equal(p.evaluate("peek?.index"),index);
    p.act({type:"closeInitialPeek"});await settle();
   }
   p.act({type:"donePeek"});await settle();
  }
  assert.equal(a.view().stage,"playing");
  const starter=a.view().players[a.view().turn].id;
  for(let i=0;i<3;i++){
   assert.equal(a.view().stage,"playing");
   const actorId=a.view().players[a.view().turn].id,actor=byId.get(actorId);
   assert.ok(actor,"unknown actor");
   actor.act({type:"draw",source:"deck"});await settle();
   assert.equal(typeof actor.evaluate("drawn?.v"),"number");
   for(const other of participants)if(other!==actor)assert.equal(other.evaluate("drawn"),null);
   actor.act({type:"swapDraw",index:0});await settle();
   assert.equal(actor.evaluate("drawn"),null);
   totalTurns++;
   if(i===0){actor.act({type:"cabo"});await settle();assert.equal(a.view().cabo,starter)}
   else if(a.view().stage==="playing"&&a.view().caboEligible===actorId){
    actor.act({type:"endTurn"});await settle();
   }
   if(a.view().stage==="reveal")break;
  }
  assert.ok(["reveal","finished"].includes(a.view().stage),"CABO final turns must score round");
  const latest=a.view();
  assert.equal(latest.lastResult.length,3);
  for(const [i,p] of latest.players.entries()){
   assert.equal(p.hand.every(card=>card.up&&Number.isInteger(card.v)),true);
   let expected=previousScores[i]+latest.lastResult[i].points;
   if(latest.settings.exactRescue&&expected===100&&!previousRescued[i])expected=50;
   assert.equal(p.score,expected,"round "+round+" total for "+p.name);
  }
  const scores=latest.players.map(p=>p.score);
  assert.equal(participants.every(p=>p.view().players.every((x,i)=>x.score===scores[i])),true);
  previousScores=scores;previousRescued=latest.players.map(p=>!!p.rescued);
  if(round<3){
   for(const p of participants){p.act({type:"ready"});await settle()}
   assert.equal(a.view().stage,"peeking");
  }
 }
 assert.equal(totalTurns,9);
 let last=a.view();
 if(last.tiebreak){
  // In a tied finish, the next phase is deliberately left for the dedicated tiebreak test.
  assert.equal(last.stage,"reveal");
 }else assert.equal(last.stage,"finished");
 console.log("PASS complete three-round, three-client game covers starting peeks, CABO, final turns, scoring and ready transitions");
}
async function completeTiebreakScenario(){
 const a=client("tie-host-a-identity-0019"),b=client("tie-guest-b-identity-0020"),c=client("tie-guest-c-identity-0021");
 a.evaluate('opts={...defaults,endMode:"rounds",roundLimit:1,cards:4,peeks:2,reshuffle:false,abilityOwn:false,abilityOpponent:false,abilitySwap:false}');
 a.evaluate("createRoom('A')");await settle();const room=a.evaluate("room");
 b.evaluate("joinRoom('B',"+JSON.stringify(room)+")");c.evaluate("joinRoom('C',"+JSON.stringify(room)+")");await settle();
 const players=[a,b,c],byId=new Map(players.map(p=>[p.identity,p]));
 a.act({type:"start"});await settle();
 for(const p of players){
  for(const i of [0,1]){p.act({type:"initialPeek",index:i});await settle();p.act({type:"closeInitialPeek"});await settle()}
  p.act({type:"donePeek"});await settle();
 }
 assert.equal(a.view().stage,"playing");
 a.evaluate('state.players[0].hand=[{v:2,up:false},{v:2,up:false},{v:0,up:false},{v:0,up:false}];state.players[1].hand=[{v:1,up:false},{v:1,up:false},{v:1,up:false},{v:1,up:false}];state.players[2].hand=[{v:7,up:false},{v:8,up:false},{v:6,up:false},{v:5,up:false}];state.deck=[];state.discard=[{v:4,up:true}];broadcast()');await settle();
 a.act({type:"draw",source:"deck"});await settle();
 assert.equal(a.view().stage,"reveal");
 assert.deepEqual(a.view().players.map(p=>p.score),[4,4,26]);
 assert.deepEqual(a.view().tiebreak.ids,[a.identity,b.identity]);
 for(const p of [a,b]){p.act({type:"ready"});await settle()}
 assert.equal(a.view().stage,"peeking");
 assert.equal(a.view().round,1);
 assert.equal(a.view().players[0].hand.length,4);assert.equal(a.view().players[1].hand.length,4);assert.equal(a.view().players[2].hand.length,0);
 for(const p of [a,b]){
  for(const i of [0,1]){p.act({type:"initialPeek",index:i});await settle();p.act({type:"closeInitialPeek"});await settle()}
  p.act({type:"donePeek"});await settle();
 }
 assert.equal(a.view().stage,"playing");
 a.evaluate('state.players[0].hand=Array.from({length:4},()=>({v:0,up:false}));state.players[1].hand=Array.from({length:4},()=>({v:13,up:false}));broadcast()');await settle();
 let turns=0;
 while(a.view().stage==="playing"&&turns<10){
  const actorId=a.view().players[a.view().turn].id,actor=byId.get(actorId);
  assert.notEqual(actorId,c.identity);
  actor.act({type:"draw",source:"deck"});await settle();
  actor.act({type:"discardDraw"});await settle();
  if(a.view().stage==="playing"&&a.view().caboEligible===actorId){actor.act({type:"endTurn"});await settle()}
  turns++;
 }
 assert.equal(turns,6,"each tied player must have exactly three mini-turns");
 assert.equal(a.view().stage,"finished");
 assert.equal(a.view().winner,a.identity);
 assert.deepEqual(a.view().players.map(p=>p.score),[4,4,26]);
 assert.equal(players.every(p=>p.view().winner===a.identity),true);
 console.log("PASS complete tie-break after full round: only tied players, exactly six turns, main scores unchanged, one winner");
}

async function completeVariableSizeGame(size){
 const people=Array.from({length:size},(_,i)=>client("fullgame-"+size+"-identity-"+i,null,99000+size));
 const host=people[0],byId=new Map(people.map(p=>[p.identity,p]));
 host.evaluate('opts={...defaults,cards:4,peeks:2,turnsAfterCabo:1,roundLimit:1,endMode:"rounds",abilityMandatory:false}');
 host.evaluate("createRoom('Host')");await settle();
 const room=host.evaluate("room");
 for(let i=1;i<size;i++){people[i].evaluate("joinRoom("+JSON.stringify("P"+i)+","+JSON.stringify(room)+")");await settle()}
 assert.equal(host.view().players.length,size);
 host.act({type:"start"});await settle();
 const cardsBefore=host.evaluate("state.deck.length+state.discard.length+state.players.reduce((n,p)=>n+p.hand.length,0)");
 for(const p of people){
  for(let i=0;i<2;i++){p.act({type:"initialPeek",index:i});await settle();p.act({type:"closeInitialPeek"});await settle()}
  p.act({type:"donePeek"});await settle();
 }
 assert.equal(host.view().stage,"playing");
 const starterId=host.view().players[host.view().turn].id;
 for(let i=0;i<size;i++){
  assert.equal(host.view().stage,"playing","end too soon in size "+size);
  const id=host.view().players[host.view().turn].id,player=byId.get(id);
  assert.ok(player);
  if(i>0)assert.notEqual(id,starterId);
  player.act({type:"draw",source:"deck"});await settle();
  assert.equal(typeof player.evaluate("drawn?.v"),"number");
  player.act({type:"discardDraw"});await settle();
  if(player.evaluate("abilityView?.kind")){player.act({type:"finishAbility"});await settle()}
  if(i===0){assert.equal(host.view().caboEligible,id);player.act({type:"cabo"});await settle()}
  const conserved=host.evaluate("state.deck.length+state.discard.length+state.players.reduce((n,p)=>n+p.hand.length,0)+Object.keys(pending).length");
  assert.equal(conserved,cardsBefore,"cards lost in size "+size+" turn "+i);
 }
 assert.ok(["finished","reveal"].includes(host.view().stage));
 const mainScores=host.view().players.map(p=>p.score);
 assert.equal(host.view().lastResult.length,size);
 assert.ok(host.view().lastResult.some(p=>p.points===0)||host.view().lastResult.every(p=>p.points>0));
 let attempts=0;
 while(host.view().stage!=="finished"&&attempts<12){
  const state=host.view();
  assert.ok(state.tiebreak,"must have a tie to continue");
  const eligible=state.tiebreak.ids;
  for(const id of eligible){byId.get(id).act({type:"ready"});await settle()}
  assert.equal(host.view().stage,"peeking");
  for(const id of eligible){
   const player=byId.get(id);
   for(let i=0;i<2;i++){player.act({type:"initialPeek",index:i});await settle();player.act({type:"closeInitialPeek"});await settle()}
   player.act({type:"donePeek"});await settle();
  }
  assert.equal(host.view().stage,"playing");
  const expectedTurns=eligible.length*3;
  for(let t=0;t<expectedTurns;t++){
   assert.equal(host.view().stage,"playing");
   const id=host.view().players[host.view().turn].id;
   assert.ok(eligible.includes(id));
   const player=byId.get(id);
   player.act({type:"draw",source:"deck"});await settle();
   player.act({type:"discardDraw"});await settle();
   if(player.evaluate("abilityView?.kind")){player.act({type:"finishAbility"});await settle()}
  }
  attempts++;
  assert.deepEqual(host.view().players.map(p=>p.score),mainScores);
 }
 assert.equal(host.view().stage,"finished","game of size "+size+" did not finish");
 assert.ok(host.view().players.some(p=>p.id===host.view().winner));
 assert.equal(host.view().round,1);
 for(const p of people){
  assert.equal(p.view().stage,"finished","guest disagrees on finish");
  assert.equal(p.view().winner,host.view().winner,"guest disagrees on winner");
  assert.deepEqual(p.view().players.map(p=>p.score),mainScores,"guest disagrees on totals");
 }
 console.log("PASS fully completed "+size+"-player game with CABO, scoring, synchronization"+(attempts?" and "+attempts+" tiebreak(s)":""));
}
main().then(recoveryScenario).then(automaticFailoverScenario).then(twoPlayerFailoverScenario).then(standbyReassignmentScenario).then(heartbeatFailoverScenario).then(completeGameScenario).then(completeTiebreakScenario).then(()=>completeVariableSizeGame(2)).then(()=>completeVariableSizeGame(4)).then(()=>completeVariableSizeGame(8)).catch(err=>{console.error(err);process.exitCode=1});


