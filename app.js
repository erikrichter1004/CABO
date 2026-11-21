"use strict";
const $=id=>document.getElementById(id),app=$("app");let peer=null,hostConn=null,connections=new Map(),state=null,identity=sessionStorage.getItem("caboIdentity")||crypto.randomUUID(),room=sessionStorage.getItem("caboRoom")||"",isHost=false,selected=[],drawn=null,peek=null,phase="home",ticker=null;
sessionStorage.setItem("caboIdentity",identity);
const defaults={cards:4,peeks:2,turnsAfterCabo:1,limit:100,roundLimit:10,endMode:"points",failure:"medium",faceUp:false,reshuffle:true,multiLimit:8,abilityOwn:true,abilityOpponent:true,abilitySwap:true,abilityMode:"classic",abilityMandatory:false,exactRescue:true,kamikaze:true,startMode:"rotate",timeout:60,customCounts:""};
let opts={...defaults};let intentionalClose=false,reconnectAttempts=0,netEpoch=0,reconnectTimer=null;
let resumeSecret=sessionStorage.getItem("caboResumeSecret")||crypto.randomUUID(),playerSecrets={},handoffTarget=null,pendingHandoff=null,handoffTimeout=null;
sessionStorage.setItem("caboResumeSecret",resumeSecret);
const clean=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function note(msg){const n=$("notice");n.textContent=msg;n.classList.add("show");clearTimeout(note.t);note.t=setTimeout(()=>n.classList.remove("show"),6000)}
function setPhase(p){phase=p;render()}
function home(){
 intentionalClose=true;if(handoffTimeout){clearTimeout(handoffTimeout);handoffTimeout=null}
 handoffTarget=null;pendingHandoff=null;
 sessionStorage.removeItem("caboHostSnapshot");closeNet();state=null;room="";
 sessionStorage.removeItem("caboRoom");setPhase("home");
}
function leaveRoom(){
 if(!isHost||!state){home();return}
 const next=state.players.find(p=>p.id!==identity&&!p.paused&&p.connected!==false&&connections.get(p.id)?.open);
 if(!next){if(confirm("Kein anderer Gastgeber ist erreichbar. Raum wirklich beenden?"))home();return}
 if(!confirm("Gastgeberrechte an "+next.name+" übergeben und Raum verlassen?"))return;
 handoffTarget=next.id;
 const snapshot={room,state:structuredClone(state),pending:structuredClone(pending),privatePeeks:structuredClone(privatePeeks),abilities:structuredClone(abilities),secrets:structuredClone(playerSecrets)};
 connections.get(next.id).send({type:"handoff",snapshot});
 note("Gastgeberwechsel angefordert.");
 handoffTimeout=setTimeout(()=>{if(handoffTarget===next.id){handoffTarget=null;note("Gastgeberwechsel nicht bestätigt. Du bleibst Gastgeber.")}},12000);
}
function closeNet(){
 netEpoch++;if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}
 try{hostConn?.close();for(const c of connections.values())c.close();peer?.destroy()}catch{}
 hostConn=null;connections.clear();peer=null;isHost=false;
}
function nameField(){return '<label>Dein Spielername<input id="playerName" maxlength="24" value="'+clean(sessionStorage.getItem("caboName")||"")+'" placeholder="Name"></label>'}
function takeName(){const n=$("playerName")?.value.trim();if(!n){note("Bitte Namen eingeben.");return null}sessionStorage.setItem("caboName",n);return n}
function optionsUI(){const choices=(key,label,values)=>'<label>'+label+'<select data-option="'+key+'">'+values.map(([v,t])=>'<option value="'+v+'" '+(String(opts[key])===String(v)?"selected":"")+'>'+t+'</option>').join("")+'</select></label>';return '<div class="settings">'+[
choices("cards","Startkarten",[[3,3],[4,4],[5,5],[6,6],[7,7],[8,8]]),choices("peeks","Anfangsblick",[[0,0],[1,1],[2,2],[3,3],[4,4]]),choices("turnsAfterCabo","Letzte Züge nach CABO",[[0,0],[1,1],[2,2],[3,3]]),choices("endMode","Spielende",[["points","Punktegrenze"],["rounds","Rundenzahl"]]),choices("limit","Punktegrenze",[[50,50],[75,75],[100,100],[150,150],[200,200]]),choices("roundLimit","Rundenanzahl",[[5,5],[10,10],[15,15],[20,20]]),choices("failure","Fehler beim Mehrfachablegen",[["light","Zug endet"],["medium","+1 Karte"],["hard","+1 Karte je Fehler"]]),choices("faceUp","Eingetauschte Karten",[["false","Verdeckt"],["true","Offen"]]),choices("reshuffle","Leerer Nachziehstapel",[["true","Ablagestapel mischen"],["false","Runde beenden"]]),choices("multiLimit","Max. Mehrfachablage",[[2,2],[3,3],[4,4],[5,5],[6,6],[7,7],[8,"Unbegrenzt"]]),choices("abilityOwn","7/8 Eigene Karte ansehen",[["true","An"],["false","Aus"]]),choices("abilityOpponent","9/10 Gegnerkarte ansehen",[["true","An"],["false","Aus"]]),choices("abilitySwap","11/12 Karten tauschen",[["true","An"],["false","Aus"]]),choices("abilityMode","Spezialfähigkeiten",[["classic","Nur direkt gezogene Karte"],["extended","Auch aus eigener Hand"]]),choices("abilityMandatory","Fähigkeiten verpflichtend",[["false","Nein"],["true","Ja"]]),choices("exactRescue","100 → 50 Rettung",[["true","An"],["false","Aus"]]),choices("kamikaze","Kamikaze 12/12/13/13",[["true","An"],["false","Aus"]]),choices("startMode","Startspieler",[["rotate","Rotierend"],["same","Immer gleich"],["random","Zufällig"]])].join("")+'</div><label>Eigene Kartenhäufigkeiten 0–13 (14 Zahlen, Komma-getrennt, optional)<input id="customCounts" placeholder="4,4,4,4,4,4,4,4,4,4,4,4,4,2" value="'+clean(opts.customCounts||"")+'"></label>'}
function readOptions(){opts.customCounts=$("customCounts")?.value.trim()||"";document.querySelectorAll("[data-option]").forEach(e=>{let v=e.value;opts[e.dataset.option]=v==="true"?true:v==="false"?false:/^\d+$/.test(v)?Number(v):v})}
function render(){if(phase==="home"){app.innerHTML='<div class="panel"><div class="actions"><button id="create">Neue Partie erstellen</button><button id="join">Raum beitreten</button>'+(sessionStorage.getItem("caboHostSnapshot")?'<button id="resume">Gastgeber-Partie fortsetzen</button>':'')+'</div><p class="muted">Online-PWA · 2–8 Spieler · vierstelliger Raumcode</p></div>';$("create").onclick=()=>setPhase("create");$("join").onclick=()=>setPhase("join");if($("resume"))$("resume").onclick=()=>createRoom(sessionStorage.getItem("caboName")||"Gastgeber",true);return}
if(phase==="create"){app.innerHTML='<div class="panel"><h2>Neue Partie erstellen</h2>'+nameField()+'<details open><summary>Spieleinstellungen (Standardwerte vorausgewählt)</summary>'+optionsUI()+'</details><button id="go">Raum erstellen</button><button class="outline" id="back">Zurück</button></div>';$("back").onclick=home;$("go").onclick=()=>{const n=takeName();if(n){readOptions();const error=validateSettings(opts,2);if(error){note(error);return}createRoom(n)}};return}
if(phase==="join"){app.innerHTML='<div class="panel"><h2>Raum beitreten</h2>'+nameField()+'<label>Vierstelliger Code<input id="code" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" placeholder="1234"></label><button id="go">Beitreten</button><button class="outline" id="back">Zurück</button></div>';$("back").onclick=home;$("go").onclick=()=>{let n=takeName(),c=$("code").value.trim();if(n&&/^\d{4}$/.test(c))joinRoom(n,c);else note("Bitte Namen und vierstelligen Code eingeben.")};return}
if(!state){app.innerHTML='<div class="panel">Verbinde…</div>';return}
const me=state.players.find(p=>p.id===identity),host=state.players.find(p=>p.id===state.host),active=state.players[state.turn],myTurn=state.started&&state.stage==="playing"&&active?.id===identity&&!me?.paused;
let out='<div class="panel"><b>Raum '+clean(room)+'</b> · '+(isHost?"Gastgeber":"Mitspieler")+' <span class="pill">'+clean(state.stage)+'</span><p class="muted">Spieler: '+state.players.length+'/8 · Runde '+state.round+'</p><button class="outline" id="leave">Raum verlassen</button>';
out+='<div>'+state.players.map(p=>'<div class="seat '+(active?.id===p.id&&state.stage==="playing"?"active":"")+'">'+clean(p.name)+(p.id===state.host?" 👑":"")+(p.paused?" (pausiert)":"")+(p.connected===false?" (offline)":"")+' · '+p.score+' Punkte'+(state.started?" · "+p.hand.length+" Karten":"")+(isHost&&p.id!==identity?'<button data-pause="'+p.id+'">'+(p.paused?"Fortsetzen":"Pausieren")+'</button><button class="danger" data-remove="'+p.id+'">Entfernen</button>':"")+'</div>').join("")+'</div>';
if(state.stage==="lobby"){out+='<p>Teile den Raumcode mit deinen Mitspielern.</p>'+(isHost?'<button id="start" '+(state.players.length<2?"disabled":"")+'>Partie starten</button>':'<p>Warte auf den Gastgeber…</p>')+'</div>';app.innerHTML=out;bindCommon();if($("start"))$("start").onclick=()=>sendAction({type:"start"});return}
if(state.stage==="finished"){out+='<h2>Spiel beendet</h2><p>Gewinner: '+clean(state.players.find(p=>p.id===state.winner)?.name||'Noch offen')+'</p>'+(isHost?'<button id="reset">Neues Spiel</button>':"")+'</div>';app.innerHTML=out;bindCommon();if($("reset"))$("reset").onclick=()=>sendAction({type:"reset"});return}
if(state.stage==="reveal"){out+='<h2>'+(state.tiebreak?'Stichrunde':'Rundenergebnis')+'</h2>'+state.players.map(p=>'<p>'+clean(p.name)+': '+p.hand.reduce((s,c)=>s+c.v,0)+' Kartenpunkte · Rundenergebnis '+(state.lastResult?.find(x=>x.id===p.id)?.points??'–')+' · Gesamt '+p.score+'</p>').join("")+'<button id="ready" '+(state.tiebreak&&!state.tiebreak.ids.includes(identity)?'disabled':'')+'>Bereit für '+(state.tiebreak?'Stichrunde':'nächste Runde')+'</button><p>Bereit: '+(state.ready?.length||0)+'/'+state.players.filter(x=>!x.paused&&(!state.tiebreak||state.tiebreak.ids.includes(x.id))).length+'</p>'+(isHost?'<button id="forceReady" '+(Date.now()-(state.readyStart||Date.now())<90000?'disabled':'')+'>Fehlende Spieler als bereit markieren (ab 90 s)</button>':'')+'</div>';app.innerHTML=out;bindCommon();if($("ready"))$("ready").onclick=()=>sendAction({type:"ready"});if($("forceReady"))$("forceReady").onclick=()=>sendAction({type:"forceReady"});return}
if(state.stage==="peeking"){out+='<h2>'+(state.tiebreak?'Stichrunde: Anfangsblick':'Anfangsblick')+'</h2><p>Wähle '+Math.min(state.tiebreak?2:state.settings.peeks,me?.hand.length||0)+' Karten zum privaten Anschauen.</p><div class="cards">'+(me?.hand||[]).map((c,i)=>'<button class="card" data-peek="'+i+'">🂠</button>').join("")+'</div><p>Angesehen: '+(state.peeks?.[identity]?.length||0)+'/'+(state.tiebreak?2:state.settings.peeks)+'</p>'+(peek?'<p>Karte '+(peek.index+1)+': <strong>'+peek.value+'</strong></p><button id="closeInitialPeek">Karte schließen</button>':'')+'<button id="donePeek" '+(peek||(state.peeks?.[identity]?.length||0)<Math.min(state.tiebreak?2:state.settings.peeks,me?.hand.length||0)?'disabled':'')+'>Fertig / bereit</button>'+(isHost?'<button id="forcePeek" '+(Date.now()-(state.peekStart||Date.now())<90000?'disabled':'')+'>Fehlende Anfangsblicke abschließen (ab 90 s)</button>':'')+'</div>';app.innerHTML=out;bindCommon();document.querySelectorAll("[data-peek]").forEach(b=>b.onclick=()=>sendAction({type:"initialPeek",index:Number(b.dataset.peek)}));if($("closeInitialPeek"))$("closeInitialPeek").onclick=()=>sendAction({type:"closeInitialPeek"});$("donePeek").onclick=()=>sendAction({type:"donePeek"});if($("forcePeek"))$("forcePeek").onclick=()=>sendAction({type:"forcePeek"});return}
out+='<p><strong>Am Zug: '+clean(active?.name)+'</strong> · '+(state.cabo?"CABO von "+clean(state.players.find(p=>p.id===state.cabo)?.name):"Kein CABO")+'</p><p id="clock" class="muted"></p>'+(isHost&&state.abilityActive?'<button id="forceAbility" '+(Date.now()-(state.abilityPauseAt||Date.now())<90000?'disabled':'')+'>Hängende Spezialfähigkeit schließen (ab 90 s)</button>':'');
out+='<div id="center"><div><button id="deck" class="card" '+(!myTurn||drawn||abilityView||state.caboEligible===identity||state.deck.length===0?"disabled":"")+'>🂠</button><small>Nachziehen · '+state.deck.length+'</small></div><div><div class="card face">'+(state.discard.at(-1)?.v??"–")+'</div><small>Ablage</small><button id="takeDiscard" '+(!myTurn||drawn||abilityView||state.caboEligible===identity||!state.discard.length?"disabled":"")+'>Aufnehmen</button></div></div>';
out+='<h3>Deine Karten</h3><div class="cards">'+(me?.hand||[]).map((c,i)=>'<button class="card '+(selected.includes(i)?"chosen ":"")+(c.up?"face":"")+'" data-card="'+i+'">'+(c.up?c.v:"🂠")+'</button>').join("")+'</div>';
if(peek!==null)out+='<div class="panel"><h3>Privater Blick: '+peek+'</h3><button id="closePeek">Schließen</button></div>';
if(drawn)out+='<div class="panel"><h3>Deine gezogene Karte</h3><div class="cards"><div class="card face">'+drawn.v+'</div></div><p class="muted">'+(drawn.source==='deck'?'Vom Nachziehstapel':'Vom Ablagestapel')+'</p><button id="discardDraw" '+(drawn.source==="discard"?"disabled":"")+'>Direkt ablegen</button><button id="swapDraw" '+(selected.length!==1?"disabled":"")+'>Mit gewählter Karte tauschen</button><button id="multiSwap" '+(selected.length<2?"disabled":"")+'>Mit mehreren gleichen Karten tauschen</button></div>';
if(abilityView)out+='<div class="panel"><h3>Spezialfähigkeit</h3>'+(abilityView.value!==undefined?'<p>Gesehene Karte: <strong>'+abilityView.value+'</strong></p>':'<p>Wähle eine Zielkarte.</p>')+(abilityView.kind==='own'||abilityView.kind==='opponent'?'<div class="cards">'+state.players.filter(p=>abilityView.kind==='own'?p.id===identity:p.id!==identity).map(p=>'<div><small>'+clean(p.name)+'</small><div class="cards">'+p.hand.map((c,i)=>'<button class="card" data-ability="'+p.id+':'+i+'">🂠</button>').join("")+'</div></div>').join("")+'</div>':'')+(abilityView.kind==='swap'?'<p>Wähle erst eine eigene und dann eine fremde Karte.</p><div class="cards">'+(me?.hand||[]).map((c,i)=>'<button class="card" data-swap-own="'+i+'">🂠</button>').join("")+'</div>'+state.players.filter(p=>p.id!==identity).map(p=>'<p>'+clean(p.name)+'</p><div class="cards">'+p.hand.map((c,i)=>'<button class="card" data-swap-other="'+p.id+':'+i+'">🂠</button>').join("")+'</div>').join(""):'')+'<button id="finishAbility" '+(state.settings.abilityMandatory&&abilityView.value===undefined?'disabled':'')+'>Fertig / Fähigkeit beenden</button></div>';if(myTurn&&!abilityView&&state.caboEligible===identity)out+=`<div class="actions"><button id="endTurn">Zug beenden</button>${!state.tiebreak&&!state.cabo?'<button id="callCabo">CABO ansagen</button>':''}</div>`;if(myTurn&&!drawn&&!abilityView&&state.caboEligible!==identity)out+='<div class="actions"><button id="multi" '+(selected.length<2?"disabled":"")+'>Gleiche Karten ablegen</button></div>';
out+='</div>';app.innerHTML=out;bindCommon();
document.querySelectorAll("[data-card]").forEach(b=>b.onclick=()=>{const i=+b.dataset.card;if(!myTurn){return}selected=selected.includes(i)?selected.filter(x=>x!==i):[...selected,i];render()});
if($("deck"))$("deck").onclick=()=>sendAction({type:"draw",source:"deck"});
if($("takeDiscard"))$("takeDiscard").onclick=()=>sendAction({type:"draw",source:"discard"});
if($("discardDraw"))$("discardDraw").onclick=()=>sendAction({type:"discardDraw"});
if($("swapDraw"))$("swapDraw").onclick=()=>{if(selected.length!==1){note("Bitte genau eine Karte auswählen.");return}sendAction({type:"swapDraw",index:selected[0]})};
if($("multiSwap"))$("multiSwap").onclick=()=>{if(selected.length<2)return;const position=selected[0];if(confirm("Mehrere ausgewählte Karten gegen die gezogene Karte tauschen?"))sendAction({type:"multiSwap",indices:selected,position})};if($("multi"))$("multi").onclick=()=>{if(confirm("Ausgewählte Karten gemeinsam ablegen?"))sendAction({type:"multi",indices:selected})};
document.querySelectorAll("[data-swap-own]").forEach(b=>b.onclick=()=>{selected=[Number(b.dataset.swapOwn)];note("Eigene Karte ausgewählt. Jetzt fremde Karte antippen.")});document.querySelectorAll("[data-swap-other]").forEach(b=>b.onclick=()=>{if(selected.length!==1){note("Zuerst eigene Karte auswählen.");return}const [target,other]=b.dataset.swapOther.split(":");sendAction({type:"swapAbility",own:selected[0],target,other:Number(other)})});document.querySelectorAll("[data-ability]").forEach(b=>b.onclick=()=>{const [target,index]=b.dataset.ability.split(":");sendAction({type:"abilityTarget",target,index:Number(index)})});if($("finishAbility"))$("finishAbility").onclick=()=>sendAction({type:"finishAbility"});if($("forceAbility"))$("forceAbility").onclick=()=>sendAction({type:"forceAbility"});if($("endTurn"))$("endTurn").onclick=()=>sendAction({type:"endTurn"});if($("callCabo"))$("callCabo").onclick=()=>{if(confirm("CABO wirklich ansagen?"))sendAction({type:"cabo"})};
if($("closePeek"))$("closePeek").onclick=()=>{peek=null;render()};
}
function bindCommon(){document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{if(confirm("Spieler dauerhaft entfernen?"))sendAction({type:"remove",id:b.dataset.remove})});document.querySelectorAll("[data-pause]").forEach(b=>b.onclick=()=>sendAction({type:"pause",id:b.dataset.pause}));if($("leave"))$("leave").onclick=leaveRoom}
function newState(n){return {host:identity,players:[{id:identity,name:n,score:0,hand:[],paused:false,rescued:false,connected:true}],settings:{...opts},started:false,stage:"lobby",round:0,turn:0,deck:[],discard:[],cabo:null,lastTurns:0,turnStart:Date.now(),starter:0}}
function peerId(c){return "cabo-online-v1-"+c}
function createRoom(n,resume=false,fromHandoff=false){
 intentionalClose=true;closeNet();intentionalClose=false;isHost=true;handoffTarget=null;
 const snapshot=resume?sessionStorage.getItem("caboHostSnapshot"):null;
 if(snapshot){
  try{
   const saved=JSON.parse(snapshot);room=saved.room;state=saved.state;
   pending=saved.pending||{};privatePeeks=saved.privatePeeks||{};
   abilities=saved.abilities||{};playerSecrets=saved.secrets||{};
  }catch{room=String(Math.floor(1000+Math.random()*9000));state=newState(n);playerSecrets={}}
 }else{
  room=String(Math.floor(1000+Math.random()*9000));state=newState(n);
  playerSecrets={};pending={};privatePeeks={};abilities={};
 }
 playerSecrets[identity]=resumeSecret;
 sessionStorage.setItem("caboRoom",room);setPhase("connecting");
 const epoch=netEpoch;
 peer=new Peer(peerId(room));
 peer.on("open",()=>{if(epoch!==netEpoch)return;setPhase("game");broadcast()});
 peer.on("connection",conn=>{
  if(epoch!==netEpoch){conn.close();return}
  conn.on("data",msg=>{if(epoch===netEpoch)receive(conn,msg)});
  conn.on("close",()=>{
   if(epoch!==netEpoch)return;
   if(conn.playerId&&connections.get(conn.playerId)===conn){
    connections.delete(conn.playerId);
    const player=state?.players.find(x=>x.id===conn.playerId);
    if(player){player.connected=false;player.disconnectedAt=Date.now()}
    broadcast();
   }
  });
 });
 peer.on("error",e=>{
  if(epoch!==netEpoch)return;
  if(e.type==="unavailable-id"){
   if(fromHandoff){
    note("Gastgeberwechsel läuft. Raumcode wird erneut beansprucht.");
    setTimeout(()=>{if(epoch===netEpoch&&!intentionalClose)createRoom(n,true,true)},2000);
   }else if(resume){
    note("Der Raum wird bereits gehostet. Beitritt als Mitspieler wird versucht.");
    joinRoom(n,room);
   }else{
    note("Raumcode vergeben, wähle automatisch einen neuen.");
    createRoom(n,false);
   }
   return;
  }
  note("Spielserververbindung fehlgeschlagen: "+e.type);
 });
}
function promoteHandoff(snapshot){
 if(!snapshot||snapshot.room!==room||!snapshot.state||!snapshot.state.players?.some(p=>p.id===identity)){
  note("Gastgeberwechsel fehlgeschlagen. Verbindung wird wiederhergestellt.");return false;
 }
 const saved=structuredClone(snapshot),previousHost=saved.state.host;
 saved.state.host=identity;
 const previous=saved.state.players.find(p=>p.id===previousHost);
 if(previous){previous.connected=false;previous.paused=true;previous.disconnectedAt=Date.now()}
 sessionStorage.setItem("caboHostSnapshot",JSON.stringify(saved));
 createRoom(sessionStorage.getItem("caboName")||"Gastgeber",true,true);
 if(state.stage==="playing"&&state.players[state.turn]?.id===previousHost){
  settlePendingDraw(previousHost);nextTurn(true);
 }
 if(state.stage==="peeking"||state.stage==="reveal")advanceWaitingPhase();
 note("Gastgeberwechsel übernommen.");
 return true;
}
function scheduleReconnect(n,c,epoch){
 if(intentionalClose||epoch!==netEpoch||reconnectTimer)return;
 reconnectAttempts++;
 note("Verbindung unterbrochen. Automatischer Wiederbeitritt wird versucht.");
 reconnectTimer=setTimeout(()=>{
  reconnectTimer=null;
  if(!intentionalClose&&epoch===netEpoch)joinRoom(n,c);
 },Math.min(1500*reconnectAttempts,12000));
}
function joinRoom(n,c){
 intentionalClose=true;closeNet();intentionalClose=false;
 const epoch=netEpoch;
 room=c;isHost=false;setPhase("connecting");
 peer=new Peer();
 peer.on("open",()=>{
  if(epoch!==netEpoch)return;
  const conn=peer.connect(peerId(c),{reliable:true});hostConn=conn;
  conn.on("open",()=>{
   if(epoch!==netEpoch)return;
   reconnectAttempts=0;
   conn.send({type:"hello",id:identity,name:n,token:resumeSecret});
  });
  conn.on("data",msg=>{
   if(epoch!==netEpoch)return;
   if(msg?.type==="handoff"){
    if(msg.snapshot?.room===c&&msg.snapshot.state?.players?.some(p=>p.id===identity)){
     pendingHandoff=msg.snapshot;
     conn.send({type:"handoffAck"});
     note("Gastgeberwechsel bestätigt. Übernahme nach Verbindungsfreigabe.");
    }
    return;
   }
   if(msg?.type==="state"){
    reconnectAttempts=0;
    if(state&&Number(msg.state.revision||0)<Number(state.revision||0))return;
    state=msg.state;selected=[];drawn=msg.privateDraw||null;peek=msg.privatePeek??null;
    abilityView=msg.privateAbility||null;setPhase("game");
   }
   if(msg?.type==="error")note(msg.message);
  });
  conn.on("close",()=>{if(epoch!==netEpoch)return;if(pendingHandoff){const backup=pendingHandoff;pendingHandoff=null;promoteHandoff(backup)}else scheduleReconnect(n,c,epoch)});
  conn.on("error",()=>scheduleReconnect(n,c,epoch));
 });
 peer.on("error",()=>scheduleReconnect(n,c,epoch));
 peer.on("disconnected",()=>scheduleReconnect(n,c,epoch));
}
function receive(conn,msg){
 if(!msg||typeof msg!=="object"||!state)return;
 if(msg.type==="handoffAck"&&handoffTarget&&conn.playerId===handoffTarget&&connections.get(conn.playerId)===conn){
  note("Gastgeberrechte wurden bestätigt.");
  home();return;
 }
 if(msg.type==="hello"){
  const playerId=msg.id,token=msg.token;
  const deny=message=>{conn.send({type:"error",message});conn.close()};
  if(typeof playerId!=="string"||playerId.length>128||typeof token!=="string"||token.length<16||token.length>200||playerId===state.host){
   deny("Ungültige Spieleridentität.");return;
  }
  const existing=state.players.some(p=>p.id===playerId);
  if(state.started&&!existing){deny("Partie läuft bereits.");return}
  if(state.players.length>=8&&!existing){deny("Raum ist voll.");return}
  if(existing&&playerSecrets[playerId]&&playerSecrets[playerId]!==token){deny("Diese Spieleridentität gehört zu einer anderen Sitzung.");return}
  playerSecrets[playerId]=token;
  conn.playerId=playerId;
  const previous=connections.get(playerId);
  connections.set(playerId,conn);
  if(previous&&previous!==conn)previous.close();
  if(!existing)state.players.push({id:playerId,name:String(msg.name||"Gast").slice(0,24),score:0,hand:[],paused:false,rescued:false,connected:true});
  const joined=state.players.find(p=>p.id===playerId);
  joined.connected=true;joined.disconnectedAt=null;
  if(state.stage==="playing"&&state.players[state.turn]?.id===playerId&&state.connectionPauseAt){
   state.turnStart+=Date.now()-state.connectionPauseAt;state.connectionPauseAt=null;
  }
  broadcast();return;
 }
 if(msg.type==="action"&&conn.playerId&&connections.get(conn.playerId)===conn)apply(conn.playerId,msg.action);
}
function sendAction(action){if(isHost&&peer?.open)apply(identity,action);else if(isHost)note("Gastgeber ist noch nicht mit dem Raum verbunden.");else if(hostConn?.open)hostConn.send({type:"action",action});else note("Keine Verbindung zum Gastgeber.")}
function privateState(id){const copy=structuredClone(state);for(const p of copy.players){if(p.id!==id)p.hand=p.hand.map(c=>({up:c.up,v:c.up?c.v:null}));else p.hand=p.hand.map(c=>({up:c.up,v:c.up?c.v:null}))}copy.deck=copy.deck.map(()=>({}));copy.discard=copy.discard.map(c=>({v:c.v,up:true}));if(copy.peeks){copy.peeks=Object.fromEntries(Object.entries(copy.peeks).filter(([playerId])=>playerId===id))}return copy}
function broadcast(){if(!isHost||!state)return;state.revision=(state.revision||0)+1;try{sessionStorage.setItem("caboHostSnapshot",JSON.stringify({room,state,pending,privatePeeks,abilities,secrets:playerSecrets}))}catch{}for(const [id,c] of connections)if(c.open)c.send({type:"state",state:privateState(id),privateDraw:pending[id]||null,privatePeek:privatePeeks[id]||null,privateAbility:abilities[id]||null});const own=privateState(identity);stateView=own;renderHost()}
let stateView=null,pending={},privatePeeks={},abilities={},abilityView=null;
function renderHost(){const full=state;state=stateView;drawn=pending[identity]||null;peek=privatePeeks[identity]||null;abilityView=abilities[identity]||null;render();state=full}
function validateSettings(settings,playerCount=2){
 if(!Number.isInteger(settings.cards)||settings.cards<3||settings.cards>8)return "Startkarten müssen zwischen 3 und 8 liegen.";
 if(!Number.isInteger(settings.peeks)||settings.peeks<0||settings.peeks>settings.cards)return "Anfangsblick darf die Anzahl der Startkarten nicht überschreiten.";
 const text=String(settings.customCounts||"").trim();
 if(text){
  const raw=text.split(",").map(x=>x.trim());
  if(raw.length!==14||raw.some(x=>!/^[0-9]+$/.test(x)))return "Eigene Kartenhäufigkeiten: bitte genau 14 ganze, nichtnegative Zahlen (0–13) eintragen.";
  const counts=raw.map(Number);
  if(counts.some(x=>x>100))return "Maximal 100 Karten je Kartenwert einstellen.";
  if(counts.reduce((a,b)=>a+b,0)<playerCount*settings.cards+1)return "Der eigene Kartenstapel reicht nicht für alle "+playerCount+" Spieler und die Startablage.";
 }
 return null;
}
function deck(){
 const custom=String(state.settings.customCounts||"").trim();
 const playerCount=state.players.length;
 const required=playerCount*(state.tiebreak?4:state.settings.cards)+12;
 const packs=Math.max(Math.ceil(playerCount/5),Math.ceil(required/52));
 let counts;
 if(custom){
  const error=validateSettings(state.settings,playerCount);
  if(error)throw Error(error);
  counts=custom.split(",").map(x=>Number(x.trim()));
 }else counts=Array.from({length:14},(_,v)=>(v===0||v===13?2:4)*packs);
 const d=[];
 for(let value=0;value<14;value++)for(let i=0;i<counts[value];i++)d.push({v:value,up:false});
 for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]]}
 return d;
}
function setupRound(){if(!state.tiebreak)state.round++;state.deck=deck();state.discard=[state.deck.pop()];for(const p of state.players)p.hand=state.tiebreak&&!state.tiebreak.ids.includes(p.id)?[]:Array.from({length:state.tiebreak?4:state.settings.cards},()=>state.deck.pop());state.cabo=null;state.lastTurns=0;state.caboRemaining={};state.caboEligible=null;state.connectionPauseAt=null;state.connectionNotified=false;state.abilityActive=null;state.abilityPauseAt=null;state.ready=[];state.peeks={};privatePeeks={};abilities={};pending={};state.stage="peeking";state.peekStart=Date.now();if(state.settings.startMode==="rotate")state.starter=(state.round-1)%state.players.length;else if(state.settings.startMode==="random")state.starter=Math.floor(Math.random()*state.players.length);else state.starter=0;state.turn=state.starter;if(state.tiebreak){state.turn=state.players.findIndex(p=>state.tiebreak.ids.includes(p.id));state.tiebreak.turns=0}state.turnStart=Date.now()}
function nextTurn(fromCaboCall=false){
 selected=[];abilities={};state.abilityActive=null;state.abilityPauseAt=null;state.caboEligible=null;state.connectionPauseAt=null;state.connectionNotified=false;
 const current=state.players[state.turn];
 if(state.cabo&&!fromCaboCall&&current?.id!==state.cabo){
  state.caboRemaining[current.id]=Math.max(0,(state.caboRemaining[current.id]||0)-1);
  state.lastTurns=Object.values(state.caboRemaining).reduce((a,b)=>a+b,0);
  if(state.lastTurns===0){scoreRound();return}
 }
 const eligible=p=>!p.paused&&(!state.tiebreak||state.tiebreak.ids.includes(p.id))&&(!state.cabo||((state.caboRemaining||{})[p.id]||0)>0);
 let next=state.turn,found=false;
 for(let i=0;i<state.players.length;i++){next=(next+1)%state.players.length;if(eligible(state.players[next])){found=true;break}}
 if(!found){scoreRound();return}
 state.turn=next;
 if(state.tiebreak&&!state.cabo){
  state.tiebreak.turns=(state.tiebreak.turns||0)+1;
  if(state.tiebreak.turns>=state.tiebreak.ids.length*3){scoreRound();return}
 }
 state.turnStart=Date.now();
}
function scoreRound(){
 state.stage="reveal";state.ready=[];state.readyStart=Date.now();
 for(const p of state.players)for(const c of p.hand)c.up=true;
 const sums=state.players.map(p=>p.hand.reduce((sum,c)=>sum+c.v,0));
 const caller=state.players.findIndex(p=>p.id===state.cabo);
 const min=Math.min(...sums);
 const success=caller>=0&&sums.every((v,i)=>i===caller||sums[caller]<v);
 const kam=state.settings.kamikaze?state.players.findIndex(p=>p.hand.length===4&&p.hand.map(c=>c.v).sort((a,b)=>a-b).join(",")==="12,12,13,13"):-1;
 state.lastResult=[];
 for(let i=0;i<state.players.length;i++){
  let points=sums[i];
  if(caller>=0){if(i===caller)points=success?0:points+10;else if(!success&&sums[i]===min)points=0}
  if(kam>=0)points=i===kam?0:50;
  if(!state.tiebreak){state.players[i].score+=points;
   if(state.settings.exactRescue&&!state.players[i].rescued&&state.players[i].score===100){state.players[i].score=50;state.players[i].rescued=true}}
  state.lastResult.push({id:state.players[i].id,sum:sums[i],points});
 }
 if(state.tiebreak){
  const eligible=state.players.map((p,i)=>({p,sum:sums[i]})).filter(x=>state.tiebreak.ids.includes(x.p.id)),smallest=Math.min(...eligible.map(x=>x.sum)),winners=eligible.filter(x=>x.sum===smallest).map(x=>x.p);
  if(winners.length===1){state.winner=winners[0].id;state.stage="finished";state.tiebreak=null}
  else{state.tiebreak={ids:winners.map(p=>p.id),attempt:(state.tiebreak.attempt||0)+1};state.stage="reveal"}
  return;
 }
 const end=state.settings.endMode==="rounds"?state.round>=state.settings.roundLimit:state.players.some(p=>p.score>state.settings.limit);
 if(end){const lowest=Math.min(...state.players.map(p=>p.score)),winners=state.players.filter(p=>p.score===lowest);
  if(winners.length===1){state.winner=winners[0].id;state.stage="finished"}
  else state.tiebreak={ids:winners.map(p=>p.id),attempt:1};
 }
}
function abilityKind(value){return value===7||value===8?"own":value===9||value===10?"opponent":value===11||value===12?"swap":null}
function abilityEnabled(kind){return kind==="own"?state.settings.abilityOwn:kind==="opponent"?state.settings.abilityOpponent:kind==="swap"?state.settings.abilitySwap:false}
function canUseAbility(id,kind){const own=state.players.find(p=>p.id===id);const others=state.players.filter(p=>p.id!==id&&p.hand.length>0);return kind==="own"?own.hand.length>0:kind==="opponent"?others.length>0:kind==="swap"?own.hand.length>0&&others.length>0:false}
function startAbility(id,value,fromHand=false){
 const kind=abilityKind(value);
 if(!kind||!abilityEnabled(kind)||!canUseAbility(id,kind)||(fromHand&&state.settings.abilityMode!=="extended"))return false;
 const started=Date.now();abilities[id]={kind,started};state.abilityActive=id;state.abilityPauseAt=started;return true;
}
function endAbility(id){
 const ab=abilities[id];if(!ab)return;
 state.turnStart+=Math.max(0,Date.now()-ab.started);
 delete abilities[id];state.abilityActive=null;state.abilityPauseAt=null;completeTurn(id);
}
function completeTurn(id){if(state.cabo)nextTurn();else state.caboEligible=id}
function settlePendingDraw(id,drawOnTimeout=false){
 const player=state.players.find(p=>p.id===id),card=pending[id];
 if(card){
  if(card.source==="discard"&&player?.hand.length){
   const old=player.hand[0];player.hand[0]={v:card.v,up:state.settings.faceUp};
   state.discard.push({...old,up:true});
  }else state.discard.push({...card,up:true,source:undefined});
  delete pending[id];
 }else if(drawOnTimeout&&state.deck.length)state.discard.push({...state.deck.pop(),up:true});
}
function requiredPlayers(){return state.players.filter(p=>!p.paused&&(!state.tiebreak||state.tiebreak.ids.includes(p.id)))}
function advanceWaitingPhase(){
 if(!["peeking","reveal"].includes(state.stage)||!requiredPlayers().length||!requiredPlayers().every(p=>state.ready.includes(p.id)))return;
 if(state.stage==="peeking"){state.stage="playing";state.ready=[];state.turnStart=Date.now()}
 else setupRound();
}
function apply(id,a){
 if(!isHost||handoffTarget||!a||typeof a!=="object")return;
 const p=state.players.find(x=>x.id===id);if(!p)return;
 if(a.type==="remove"&&id===state.host){
  const index=state.players.findIndex(x=>x.id===a.id);
  if(index<0||a.id===id)return;
  const target=state.players[index],currentId=state.players[state.turn]?.id,wasCurrent=currentId===target.id;
  if(wasCurrent)settlePendingDraw(target.id);
  connections.get(target.id)?.close();connections.delete(target.id);
  state.players.splice(index,1);
  delete pending[target.id];delete privatePeeks[target.id];delete abilities[target.id];delete playerSecrets[target.id];
  if(state.peeks)delete state.peeks[target.id];
  if(state.ready)state.ready=state.ready.filter(x=>x!==target.id);
  if(state.caboRemaining)delete state.caboRemaining[target.id];
  if(state.cabo===target.id){state.cabo=null;state.caboRemaining={};state.lastTurns=0}
  else state.lastTurns=Object.values(state.caboRemaining||{}).reduce((a,b)=>a+b,0);
  if(state.tiebreak){state.tiebreak.ids=state.tiebreak.ids.filter(x=>x!==target.id);
   if(state.tiebreak.ids.length===1){state.stage="finished";state.winner=state.tiebreak.ids[0];state.tiebreak=null}}
  if(state.players.length<2){state.stage="finished";state.winner=state.players[0]?.id||null}
  else if(state.stage==="playing"){
   if(wasCurrent){state.turn=(index-1+state.players.length)%state.players.length;nextTurn(true)}
   else state.turn=state.players.findIndex(x=>x.id===currentId);
  }else if(state.stage==="peeking"||state.stage==="reveal")advanceWaitingPhase();
  broadcast();return;
 }
 if(a.type==="pause"&&id===state.host){
  const target=state.players.find(x=>x.id===a.id);
  if(target&&target.id!==id){
   target.paused=!target.paused;
   if(target.paused&&state.players[state.turn]?.id===target.id&&state.stage==="playing"){
    settlePendingDraw(target.id);nextTurn();
   }
   if(state.stage==="peeking"||state.stage==="reveal")advanceWaitingPhase();
  }
  broadcast();return;
 }
if(a.type==="start"&&id===state.host&&state.stage==="lobby"&&state.players.length>=2){const error=validateSettings(state.settings,state.players.length);if(error){note(error);return}state.started=true;setupRound();broadcast();return}
if(a.type==="reset"&&id===state.host&&state.stage==="finished"){for(const x of state.players){x.score=0;x.rescued=false}state.round=0;state.tiebreak=null;state.winner=null;state.lastResult=[];setupRound();broadcast();return}
if(a.type==="initialPeek"&&state.stage==="peeking"){if(p.paused||(state.tiebreak&&!state.tiebreak.ids.includes(id))||state.ready.includes(id)||privatePeeks[id])return;const i=Number(a.index),seen=state.peeks[id]||[];if(Number.isInteger(i)&&i>=0&&i<p.hand.length&&seen.length<(state.tiebreak?2:state.settings.peeks)&&!seen.includes(i)){state.peeks[id]=[...seen,i];privatePeeks[id]={index:i,value:p.hand[i].v};broadcast()}return}if(a.type==="closeInitialPeek"&&state.stage==="peeking"){if(privatePeeks[id]){delete privatePeeks[id];broadcast()}return}if(a.type==="donePeek"&&state.stage==="peeking"){if(p.paused||(state.tiebreak&&!state.tiebreak.ids.includes(id))||privatePeeks[id])return;if((state.peeks[id]||[]).length<Math.min((state.tiebreak?2:state.settings.peeks),p.hand.length))return;if(!state.ready.includes(id))state.ready.push(id);delete privatePeeks[id];advanceWaitingPhase();broadcast();return}if(a.type==="forcePeek"&&state.stage==="peeking"&&id===state.host&&Date.now()-(state.peekStart||Date.now())>=90000){
  for(const player of requiredPlayers()){if(!state.ready.includes(player.id))state.ready.push(player.id);delete privatePeeks[player.id]}
  advanceWaitingPhase();broadcast();return;
 }
 if(a.type==="forceReady"&&state.stage==="reveal"&&id===state.host&&Date.now()-(state.readyStart||Date.now())>=90000){
  for(const player of requiredPlayers())if(!state.ready.includes(player.id))state.ready.push(player.id);
  advanceWaitingPhase();broadcast();return;
 }
 if(a.type==="forceAbility"&&state.stage==="playing"&&id===state.host&&state.abilityActive&&Date.now()-state.abilityPauseAt>=90000){
  const actor=state.abilityActive;endAbility(actor);
  if(state.stage==="playing"&&state.caboEligible===actor)nextTurn();
  broadcast();return;
 }if(a.type==="ready"&&state.stage==="reveal"){if(p.paused||(state.tiebreak&&!state.tiebreak.ids.includes(id)))return;if(!state.ready.includes(id))state.ready.push(id);advanceWaitingPhase();broadcast();return}
if(state.stage!=="playing"||state.players[state.turn]?.id!==id||p.paused)return;
if(abilities[id]&&!["abilityTarget","finishAbility","swapAbility"].includes(a.type))return;
if(a.type==="abilityTarget"&&abilities[id]&&abilities[id].value===undefined){const ab=abilities[id],target=state.players.find(x=>x.id===a.target),idx=Number(a.index);if(target&&Number.isInteger(idx)&&idx>=0&&idx<target.hand.length&&((ab.kind==="own"&&target.id===id)||(ab.kind==="opponent"&&target.id!==id))){ab.value=target.hand[idx].v;broadcast()}return}if(a.type==="finishAbility"&&abilities[id]){if(state.settings.abilityMandatory&&abilities[id].value===undefined)return;endAbility(id);broadcast();return}if(a.type==="swapAbility"&&abilities[id]?.kind==="swap"){const own=Number(a.own),target=state.players.find(x=>x.id===a.target),other=Number(a.other);if(target&&target.id!==id&&Number.isInteger(own)&&Number.isInteger(other)&&own>=0&&own<p.hand.length&&other>=0&&other<target.hand.length){[p.hand[own],target.hand[other]]=[target.hand[other],p.hand[own]];endAbility(id);broadcast()}return}if(a.type==="draw"&&!pending[id]&&state.caboEligible!==id){if(a.source==="deck"){if(!state.deck.length){if(state.settings.reshuffle&&state.discard.length>1){let top=state.discard.pop();state.deck=state.discard.map(c=>({v:c.v,up:false}));state.discard=[top];for(let i=state.deck.length-1;i>0;i--){let j=Math.floor(Math.random()*(i+1));[state.deck[i],state.deck[j]]=[state.deck[j],state.deck[i]]}}else{scoreRound();broadcast();return}}pending[id]={...state.deck.pop(),source:"deck"}}else if(a.source==="discard"&&state.discard.length)pending[id]={...state.discard.pop(),source:"discard"}}
else if(a.type==="discardDraw"&&pending[id]){if(pending[id].source==="discard"){note("Ablagekarte muss getauscht werden.");return}const discarded=pending[id];state.discard.push({...discarded,up:true});delete pending[id];if(!startAbility(id,discarded.v))completeTurn(id)}
else if(a.type==="swapDraw"&&pending[id]&&Number.isInteger(a.index)&&a.index>=0&&a.index<p.hand.length){const old=p.hand[a.index];p.hand[a.index]={v:pending[id].v,up:state.settings.faceUp};state.discard.push({...old,up:true});delete pending[id];if(!startAbility(id,old.v,true))completeTurn(id)}
else if(a.type==="multiSwap"&&pending[id]&&Array.isArray(a.indices)){const ids=[...new Set(a.indices)].sort((x,y)=>x-y);if(ids.length<2||(state.settings.multiLimit!==8&&ids.length>state.settings.multiLimit)||ids.some(i=>!Number.isInteger(i)||i<0||i>=p.hand.length))return;const values=ids.map(i=>p.hand[i].v);if(values.every(v=>v===values[0])){const position=Number(a.position);if(!ids.includes(position))return;for(const i of [...ids].reverse())state.discard.push({...p.hand.splice(i,1)[0],up:true});const insert=ids.filter(i=>i<position).length;p.hand.splice(position-insert,0,{v:pending[id].v,up:state.settings.faceUp});delete pending[id];if(!startAbility(id,values[0],true))completeTurn(id)}else{if(state.settings.failure!=="light"){const count=state.settings.failure==="medium"?1:ids.length-Math.max(...values.map(v=>values.filter(w=>w===v).length));for(let i=0;i<count&&state.deck.length;i++)p.hand.push(state.deck.pop())}state.discard.push({...pending[id],up:true});delete pending[id];nextTurn()} }else if(a.type==="multi"&&!pending[id]&&state.caboEligible!==id&&Array.isArray(a.indices)){
 const ids=[...new Set(a.indices)].sort((x,y)=>y-x);
 if(ids.length<2||(state.settings.multiLimit!==8&&ids.length>state.settings.multiLimit)||ids.some(i=>!Number.isInteger(i)||i<0||i>=p.hand.length))return;
 const values=ids.map(i=>p.hand[i].v);
 if(values.every(v=>v===values[0])){
  for(const i of ids)state.discard.push({...p.hand.splice(i,1)[0],up:true});
  if(state.settings.abilityMode==="extended"){
   startAbility(id,values[0],true);
  }
  if(!abilities[id])completeTurn(id);
 }else{
  if(state.settings.failure!=="light"){
   const count=state.settings.failure==="medium"?1:ids.length-Math.max(...values.map(v=>values.filter(w=>w===v).length));
   for(let i=0;i<count&&state.deck.length;i++)p.hand.push(state.deck.pop());
  }
  nextTurn();
 }
}
else if(a.type==="endTurn"&&state.caboEligible===id){nextTurn()}else if(a.type==="cabo"&&!state.tiebreak&&!state.cabo&&!pending[id]&&state.caboEligible===id){state.cabo=id;state.lastTurns=state.settings.turnsAfterCabo*state.players.filter(x=>!x.paused&&x.id!==id).length;state.caboRemaining=Object.fromEntries(state.players.filter(x=>!x.paused&&x.id!==id).map(x=>[x.id,state.settings.turnsAfterCabo]));if(!state.lastTurns)scoreRound();else nextTurn(true)}
broadcast()}
function tick(){
 if(!state||(isHost&&handoffTarget))return;
 const now=Date.now();
 if(state.stage==="peeking"||state.stage==="reveal"){
  const peeking=state.stage==="peeking";
  const started=peeking?state.peekStart:state.readyStart;
  if(!started)return;
  const elapsed=now-started,waitKey=state.stage+":"+started;
  if(tick.waitKey!==waitKey){tick.waitKey=waitKey;tick.waitNotified=false;tick.hostNotified=false}
  const needsReady=!state.ready?.includes(identity)&&(!state.tiebreak||state.tiebreak.ids.includes(identity));
  if(elapsed>=60000&&needsReady&&!tick.waitNotified){
   tick.waitNotified=true;
   note(peeking?"Bitte den privaten Anfangsblick abschließen.":"Bitte für die nächste Runde bereit melden.");
  }
  if(isHost&&elapsed>=90000){
   const control=$(peeking?"forcePeek":"forceReady");if(control)control.disabled=false;
   if(!tick.hostNotified){tick.hostNotified=true;note("Seit 90 Sekunden fehlen Bestätigungen. Du kannst als Gastgeber fortfahren.")}
  }
  return;
 }
 tick.waitKey=null;tick.waitNotified=false;tick.hostNotified=false;
 if(state.stage!=="playing")return;
 const actingId=state.players[state.turn]?.id;
 const pausedAbility=state.abilityActive===actingId&&state.abilityPauseAt;
 const pausedConnection=state.connectionPauseAt&&state.players[state.turn]?.connected===false;
 const effectiveNow=pausedAbility?state.abilityPauseAt:pausedConnection?state.connectionPauseAt:now;
 const t=state.turnStart+(Number(state.settings.timeout)||60)*1000-effectiveNow;
 const clock=$("clock");
 if(clock)clock.textContent="Zugzeit: "+(pausedAbility?"pausiert (Spezialfähigkeit)":pausedConnection?"pausiert (offline)":Math.max(0,Math.ceil(t/1000))+" s");
 if(pausedAbility){
  const abilityKey=actingId+":"+state.abilityPauseAt;
  if(tick.abilityKey!==abilityKey){tick.abilityKey=abilityKey;tick.abilityNotified=false;tick.abilityHostNotified=false}
  const elapsed=now-state.abilityPauseAt;
  if(identity===actingId&&elapsed>=60000&&!tick.abilityNotified){
   tick.abilityNotified=true;note("Deine Spezialfähigkeit ist seit 60 Sekunden offen. Bitte abschließen.");
  }
  if(isHost&&elapsed>=90000){
   const button=$("forceAbility");if(button)button.disabled=false;
   if(!tick.abilityHostNotified){tick.abilityHostNotified=true;note("Spezialfähigkeit seit 90 Sekunden offen. Gastgeber kann sie schließen.")}
  }
 }else tick.abilityKey=null;
 if(!isHost)return;
 if(state.players[state.turn]?.connected===false){
  if(!state.connectionPauseAt){state.connectionPauseAt=now;broadcast()}
  if(now-state.connectionPauseAt>30000&&!state.connectionNotified){
   state.connectionNotified=true;note("Aktiver Spieler seit 30 Sekunden offline. Gastgeber kann pausieren oder warten.");
  }
  return;
 }
 if(state.connectionPauseAt){
  const elapsed=now-state.connectionPauseAt;
  if(!pausedAbility)state.turnStart+=elapsed;
  state.connectionPauseAt=null;state.connectionNotified=false;
 }
 if(t<=0&&!abilities[actingId]){
  const active=state.players[state.turn];
  if(state.caboEligible===active.id)nextTurn();
  else{settlePendingDraw(active.id,true);nextTurn()}
  broadcast();
 }
}
setInterval(tick,500);render();