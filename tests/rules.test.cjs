const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm");
const app={innerHTML:""};
const storage=new Map();
const ctx={console,Date,Math,JSON,structuredClone,crypto:{randomUUID:()=>"host"},document:{getElementById:id=>id==="app"?app:{textContent:"",classList:{add(){},remove(){}},style:{}}},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},setInterval(){},setTimeout(){},clearTimeout(){},confirm:()=>true};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("app.js","utf8"),ctx);
function check(title,code){try{vm.runInContext(code,ctx);console.log("PASS",title)}catch(e){console.error("FAIL",title,e);process.exitCode=1}}
const base=(a,b,c)=>({host:"host",players:[{id:"host",name:"A",score:0,hand:a.map(v=>({v,up:false})),rescued:false},{id:"b",name:"B",score:0,hand:b.map(v=>({v,up:false})),rescued:false},{id:"c",name:"C",score:0,hand:c.map(v=>({v,up:false})),rescued:false}],settings:{kamikaze:false,exactRescue:true,endMode:"rounds",roundLimit:99,limit:100},stage:"playing",round:1,cabo:"host",ready:[],turn:0,deck:[],discard:[]});
ctx.make=base;
check("CABO sole lowest scores zero",`state=make([2,3],[4,5],[6,7]);scoreRound();if(state.players.map(p=>p.score).join(",")!=="0,9,13")throw Error("sole lowest")`);
check("CABO equal score fails and tied opponent gets zero",`state=make([6,6],[5,7],[9,9]);scoreRound();if(state.players.map(p=>p.score).join(",")!=="22,0,18")throw Error("tied")`);
check("CABO lower opponents tied get zero",`state=make([6,6],[4,4],[5,3]);scoreRound();if(state.players.map(p=>p.score).join(",")!=="22,0,0")throw Error("lower tie")`);
check("Kamikaze winner zero others +50",`state=make([12,12,13,13],[2],[4]);state.cabo=null;state.settings.kamikaze=true;scoreRound();if(state.players.map(p=>p.score).join(",")!=="0,50,50")throw Error("kamikaze")`);
check("100 -> 50 only once",`state=make([50,50],[1],[2]);state.cabo=null;scoreRound();if(state.players[0].score!==50||!state.players[0].rescued)throw Error("rescue");state.players[0].score=99;state.players[0].hand=[{v:1}];scoreRound();if(state.players[0].score!==100)throw Error("rescued twice")`);
check("CABO final turns individually",`state=make([1],[2],[3]);state.cabo="host";state.turn=0;state.caboRemaining={b:2,c:2};state.lastTurns=4;state.players.forEach(p=>p.paused=false);state.players.forEach(p=>p.connected=true);nextTurn(true);if(state.players[state.turn].id!=="b")throw Error("b first");nextTurn();if(state.players[state.turn].id!=="c")throw Error("c next");nextTurn();if(state.players[state.turn].id!=="b")throw Error("b second");nextTurn();if(state.players[state.turn].id!=="c")throw Error("c second");nextTurn();if(state.stage!=="reveal")throw Error("round not ended")`);

check("Opening peeks cannot finish early",`state=make([1,2,3,4],[4,5,6,7],[8,9,10,11]);state.stage="peeking";state.peeks={};state.ready=[];state.settings.peeks=2;state.players[0].paused=false;isHost=true;apply("host",{type:"donePeek"});if(state.ready.length!==0)throw Error("early ready accepted")`);
check("Abilities block unrelated turn actions",`state=make([1,2,3,4],[4,5,6,7],[8,9,10,11]);state.stage="playing";state.turn=0;state.deck=[{v:8,up:false}];state.settings.abilityOwn=true;state.settings.timeout=60;isHost=true;abilities.host={kind:"own",started:Date.now()};apply("host",{type:"draw",source:"deck"});if(pending.host||state.deck.length!==1)throw Error("draw during ability")`);
check("Turn timeout uses configured duration",`state=make([1],[2],[3]);state.stage="playing";state.cabo=null;state.settings.timeout=90;state.turnStart=Date.now()-65000;state.deck=[{v:4,up:false}];state.players.forEach(p=>p.connected=true);isHost=true;abilities={};tick();if(state.turn!==0)throw Error("60-second hardcoded timeout")`);
