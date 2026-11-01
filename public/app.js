"use strict";
const BUILD_VERSION='1.4.3';
/* Murder at Hollowmere: the page.
   The server deals the cards, keeps the envelope and every hand, and runs the computer
   detectives. This page shows what your own seats may see and sends your moves. */
"use strict";
const {SUSPECTS,METHODS,ROOMS,DETECTIVES,DETECTIVE_BY_ID,CARD,ALL,MAX_SEATS,holdersOf,actor,matches,seated}=HM;
const KCLS={s:"who",m:"how",r:"where"};
const KLAB={s:"Who",m:"How",r:"Where"};

/* ---------- state ---------- */
const S={
  uid:null,key:null,conn:"init",lastData:0,retry:0,stream:null,streamGen:0,
  view:"home",code:null,game:null,missing:false,resuming:false,tables:[],
  as:null,hands:{},dec:{},hints:{},scores:{},online:null,
  pick:{s:null,m:null,r:null},mode:null,confirm:false,lastTurn:null,
  nb:{},nbCode:null,
  tab:null,busy:false,lastPend:null,
  anim:new Set(),pk:null,full:false,
  nudgedAt:{},waitKey:null,waitAt:0,lastNudge:0,
  sheet:null,sheetConfirm:false,addLocal:false,sound:true,follow:true,saver:false,panelVis:true,settings:false
};
const ME=()=>S.as||S.uid;

/* ---------- small helpers ---------- */
const $=(s,el=document)=>el.querySelector(s);
const $$=(s,el=document)=>[...el.querySelectorAll(s)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}}};
let toastT=null;
function toast(t){const el=$("#toast");el.textContent=t;el.classList.add("on");clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove("on"),4200);}
function announce(t){const el=$("#sr");if(!el||!t)return;el.textContent="";setTimeout(()=>{el.textContent=t;},40);}
function setHTML(el,html){if(el.__h===html)return false;el.innerHTML=html;el.__h=html;return true;}
const REDUCED=!!(window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches);
function playAnims(root){if(REDUCED)return;root.querySelectorAll("[data-anim]").forEach(el=>{const k=el.dataset.anim;if(!S.anim.has(k)){S.anim.add(k);el.classList.add("play");}});}
/* buzz the phone, but only once the person has touched the page (browsers refuse before that) */
function vib(p){try{if(navigator.vibrate&&(!navigator.userActivation||navigator.userActivation.hasBeenActive))navigator.vibrate(p);}catch(e){}}
const cleanNick=v=>[...String(v||"").replace(/\s+/g," ").trim()].slice(0,16).join("");

/* Portraits are bundled original game assets; URLs are from fixed character metadata. */
function detectivePortrait(d,css="",extra=""){
  const character=d||DETECTIVES[0];
  return `<img class="detective-portrait ${css}" src="${character.portrait}?v=${encodeURIComponent(BUILD_VERSION)}" alt="Portrait of ${esc(character.name)}" width="240" height="300" loading="eager" decoding="async" ${extra}>`;
}
function detectiveIdentityHTML(g){
  const u=ME(),player=g&&g.players&&g.players[u];
  if(!player)return "";
  const d=DETECTIVE_BY_ID[player.character]||DETECTIVES[0];
  return `<div class="detective-playing" aria-label="Your detective character">${detectivePortrait(d,"detective-playing-face")}<div><span class="eyebrow">Playing as</span><h3>${esc(d.name)}</h3><small>${esc(d.title)}</small></div></div>`;
}

/* ---------- who you are: a random id and secret kept in this browser, no account ---------- */
const B62="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
function randStr(n){const a=new Uint32Array(n);crypto.getRandomValues(a);let s="";for(const x of a)s+=B62[x%62];return s;}
const PID_RE=/^u_[A-Za-z0-9]{16,32}$/,KEY_RE=/^[A-Za-z0-9]{24,64}$/;
function loadIdentity(){
  /* a private link made on another device: carry on as the same detective here */
  const m=location.hash.match(/[#&]me=(u_[A-Za-z0-9]{16,32})\.([A-Za-z0-9]{24,64})/);
  if(m){
    if(ls.get("hm.pid")&&ls.get("hm.pid")!==m[1])ls.set("hm.table",null);
    ls.set("hm.pid",m[1]);ls.set("hm.key",m[2]);S.adopted=true;
    try{history.replaceState(null,"",location.pathname+location.search);}catch(e){}
    if(!ls.get("hm.pid")){S.uid=m[1];S.key=m[2];S.noStore=true;return;}
  }
  let pid=ls.get("hm.pid"),key=ls.get("hm.key");
  if(!pid||!PID_RE.test(pid)||!key||!KEY_RE.test(key)){
    pid="u_"+randStr(20);key=randStr(32);
    ls.set("hm.pid",pid);ls.set("hm.key",key);
    S.noStore=ls.get("hm.pid")!==pid;
  }
  S.uid=pid;S.key=key;
}
function myLink(){return location.origin+location.pathname+"#me="+S.uid+"."+S.key;}
function inviteURL(code){return location.origin+location.pathname+"?t="+encodeURIComponent(code);}

/* ---------- talking to the manor ---------- */
async function api(op,d={}){
  try{
    const r=await fetch("api/act",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",
      body:JSON.stringify({code:S.code,...d,op,pid:S.uid,key:S.key})});
    let j=null;try{j=await r.json();}catch(e){}
    return j||{ok:false,error:"The manor didn't answer. Check your connection and try again."};
  }catch(e){return {ok:false,error:"Couldn't reach the manor. Check your connection and try again."};}
}
async function move(op,d={}){
  if(S.busy)return false;
  S.busy=true;renderSoon();
  const r=await api(op,{seat:ME(),...d});
  S.busy=false;renderSoon();
  if(!r.ok){toast(r.error||"That move didn't go through.");return false;}
  return r;
}
function setConn(c){if(S.conn===c)return;S.conn=c;renderSoon();}
/* one live stream at a time: your table's view, or the list of your cases in the hall */
function connect(){
  const gen=++S.streamGen;
  if(S.stream){try{S.stream.abort();}catch(e){}}
  const ctl=new AbortController();S.stream=ctl;
  const code=S.view==="table"?S.code:null;
  S.lastData=Date.now();
  (async()=>{
    let fatal=false;
    try{
      const r=await fetch("api/stream",{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",signal:ctl.signal,
        body:JSON.stringify({pid:S.uid,key:S.key,code})});
      if(!r.ok||!r.body){let j=null;try{j=await r.json();}catch(e){}throw {status:r.status,error:j&&j.error};}
      const rd=r.body.getReader(),td=new TextDecoder();let buf="";
      setConn("ready");S.retry=0;
      for(;;){
        const {value,done}=await rd.read();if(done)break;
        S.lastData=Date.now();
        buf+=td.decode(value,{stream:true});
        let i;
        while((i=buf.indexOf("\n\n"))>=0){
          const chunk=buf.slice(0,i);buf=buf.slice(i+2);
          let ev="message",data="";
          for(const line of chunk.split("\n")){if(line.startsWith("event: "))ev=line.slice(7);else if(line.startsWith("data: "))data+=line.slice(6);}
          if(data&&gen===S.streamGen)onEvent(ev,data);
        }
      }
    }catch(e){
      if(ctl.signal.aborted||gen!==S.streamGen)return;
      if(e&&e.status===401){fatal=true;setConn("badkey");}
    }
    if(fatal||gen!==S.streamGen||ctl.signal.aborted)return;
    setConn("retry");
    const wait=Math.min(12000,700*Math.pow(1.6,S.retry++))+Math.random()*500;
    setTimeout(()=>{if(gen===S.streamGen)connect();},wait);
  })();
}
function onEvent(ev,data){
  let d;try{d=JSON.parse(data);}catch(e){return;}
  if(ev==="state")onState(d);
  else if(ev==="tables"){S.tables=Array.isArray(d)?d:[];if(S.view==="home")renderHome();}
  else if(ev==="missing")onMissing(d);
  else if(ev==="nudge")onNudge(d);
  else if(ev==="profile")setPlatformProfile(d);
  else if(ev==="voice")onVoice(d);
  else if(ev==="invite")toast("Invitation from @"+d.from+" to game "+d.code+". Check your Detective Passport.");
}
function onState(v){
  const g=v&&v.g;if(!g||g.code!==S.code)return;
  S.hands=(v.mine&&v.mine.hands)||{};S.dec=(v.mine&&v.mine.dec)||{};
  S.hints=(v.mine&&v.mine.hints)||{};S.scores=(v.mine&&v.mine.score)||{};
  S.online=new Set(v.online||[]);
  PLATFORM.chat=(v.mine&&v.mine.chat)||[];
  PLATFORM.prediction=(v.mine&&v.mine.prediction)||null;
  if(Object.prototype.hasOwnProperty.call(v,"profile"))PLATFORM.profile=v.profile;
  onGame(g);
}
function onMissing(d){
  if(!d||d.code!==S.code)return;
  if(S.resuming){goHome();return;}
  S.game=null;S.missing=true;render();
}
function onNudge(d){
  if(Date.now()-S.lastNudge<2500)return;S.lastNudge=Date.now();
  const here=S.view==="table"&&d.code===S.code;
  chime("nudge");
  toast(here?`${d.from} nudged you. It's your move.`:`${d.from} nudged you at table ${d.code}. It's your move there.`);
  announce(`${d.from} nudged you.`);
  vib([80,60,80]);
}

/* ---------- seats and who plays them ---------- */
function controllerOf(g,u){
  if(!g||u==="butler")return null;
  const p=g.players&&g.players[u];if(!p||p.bot)return null;
  return p.local||u;
}
const isBot=(g,u)=>!!(g&&g.players&&g.players[u]&&g.players[u].bot);
const isLocal=(g,u)=>!!(g&&g.players&&g.players[u]&&g.players[u].local);
const canHost=(g,u)=>!!(g&&g.players&&g.players[u]&&!g.players[u].bot&&!g.players[u].local&&!(g.left&&g.left[u]));
function mySeats(g){return g&&g.players&&g.players[S.uid]?[S.uid,...Object.keys(g.players).filter(u=>g.players[u]&&g.players[u].local===S.uid)]:[];}

/* ---------- names & colors ---------- */
function nm(u,g=S.game,lower=false){
  if(u==="butler")return "Fennimore";
  if(u===ME())return lower?"you":"You";
  return (g&&g.players&&g.players[u]&&g.players[u].nick)||"A detective";
}
function nick(u,g=S.game){
  if(u==="butler")return "Fennimore";
  return (g&&g.players&&g.players[u]&&g.players[u].nick)||"A detective";
}
function seatIndex(u,g=S.game){
  if(!g)return 0;
  const o=g.order&&g.order.length?g.order:seated(g);
  const i=o.indexOf(u);return i<0?0:i;
}
const colorOf=(u,g=S.game)=>u==="butler"?"var(--muted)":`var(--p${seatIndex(u,g)%8})`;
const N=(u,g,lower)=>`<b class="who-n" style="--c:${colorOf(u,g)}">${esc(nm(u,g,lower))}</b>`;
const ref=id=>{const c=CARD[id];return c?`<span class="ref ${KCLS[c.k]}">${c.icon} ${esc(c.name)}</span>`:"";};
const trioRef=cs=>cs.map(ref).join(" · ");
function online(u){
  const g=S.game;
  if(u==="butler"||isBot(g,u))return null;
  const c=controllerOf(g,u)||u;
  if(c===S.uid)return true;
  if(!S.online)return null;
  return S.online.has(c);
}
/* "Inspector Pike" -> "Pike", "Grandpa Joe" -> "Joe": short enough for a notebook column */
function shortNick(n){
  const w=String(n||"").trim().split(/\s+/);
  const t=w.length>1&&/^(inspector|miss|constable|dr\.?|lady|professor|sergeant|madame|aunt|auntie|uncle|cousin|grandma|grandpa|granny|nana|papa|mr\.?|mrs\.?|ms\.?|sir)$/i.test(w[0]);
  return (t?w[1]:w[0]).slice(0,7);
}

/* ---------- cards HTML ---------- */
function cardHTML(id,o={}){
  const c=CARD[id];if(!c)return "";
  const cls=`pc ${KCLS[c.k]} ${o.size||""}`;
  let sv=o.i!=null?`--i:${o.i};`:"";
  if(o.fan){const f=o.fan[0]-(o.fan[1]-1)/2;sv+=`--rz:${(f*6).toFixed(1)}deg;--fy:${(f*f*3.2).toFixed(1)}px;`;}
  const sty=sv?` style="${sv}"`:"";
  const inner=`<span class="pc-k">${KLAB[c.k]}</span><span class="pc-i" aria-hidden="true">${c.icon}</span><span class="pc-n">${esc(c.name)}</span>${o.tag?`<span class="pc-tag">${esc(o.tag)}</span>`:""}`;
  if(o.act)return `<button type="button" class="${cls}"${sty} data-act="${o.act}" data-card="${c.id}" aria-label="Show ${esc(c.name)}">${inner}</button>`;
  return `<div class="${cls}"${sty}>${inner}</div>`;
}
/* a card that flips over in 3D the first time it appears */
function flipHTML(id,o={}){
  return `<div class="flip"${o.i!=null?` style="--i:${o.i}"`:""}${o.anim?` data-anim="${esc(o.anim)}"`:""}><div class="flip-in">${cardHTML(id,{size:o.size})}<div class="card-back" aria-hidden="true"></div></div></div>`;
}

/* ---------- what the seat you're playing can deduce ---------- */
function mySolution(g){
  const me=ME();
  return null;
}
function knowledge(g){
  const H=holdersOf(g),me=ME(),hand=S.hands[me],auto={},row={};
  const fu=new Set(g.faceUp||[]);
  const place=(c,h)=>{H.forEach(x=>{auto[c+"|"+x]=x===h?"y":"n";});};
  const no=(c,h)=>{const k=c+"|"+h;if(auto[k]!=="y")auto[k]="n";};
  fu.forEach(c=>H.forEach(x=>{auto[c+"|"+x]="n";}));
  if(H.includes(me)&&hand){ALL.forEach(c=>{if(hand.includes(c))place(c,me);else no(c,me);});}
  const shownHands=g.status==="over"&&g.allHands?g.allHands:(g.revealed||{});
  for(const u in shownHands){if(!H.includes(u))continue;const r=shownHands[u]||[];ALL.forEach(c=>{if(r.includes(c))place(c,u);else no(c,u);});}
  for(const e of g.log||[]){
    if(e.t==="pass"&&e.c)e.c.forEach(c=>no(c,e.who));
    else if(e.t==="show"&&e.to===me&&S.dec[e.n]&&S.dec[e.n].card)place(S.dec[e.n].card,e.who);
  }
  const hinted=new Set((S.hints[me]||[]).map(h=>h.card));
  for(const c of ALL){
    if(fu.has(c))row[c]="faceup";
    else if(hinted.has(c))row[c]="held";
    else if(H.some(h=>auto[c+"|"+h]==="y"))row[c]="held";
    else if(H.length&&H.every(h=>auto[c+"|"+h]==="n"))row[c]="env";
    else row[c]="";
  }
  for(const k of ["s","m","r"]){
    const ids=ALL.filter(c=>CARD[c].k===k);
    const open=ids.filter(c=>row[c]!=="held"&&row[c]!=="faceup");
    if(open.length===1)row[open[0]]="env";
    const env=ids.filter(c=>row[c]==="env");
    if(env.length===1)ids.forEach(c=>{if(c!==env[0]&&!row[c])row[c]="notenv";});
  }
  const sol=g.solution||mySolution(g);
  if(sol){ALL.forEach(c=>{row[c]=sol.includes(c)?"env":(row[c]==="env"||!row[c]?"notenv":row[c]);});}
  return {H,auto,row};
}

/* ---------- moves ---------- */
function ask(){const cards=[S.pick.s,S.pick.m,S.pick.r];if(cards.some(c=>!c))return;S.mode=null;S.confirm=false;return move("ask",{cards});}
function accuse(){const cards=[S.pick.s,S.pick.m,S.pick.r];if(cards.some(c=>!c))return;S.mode=null;S.confirm=false;return move("accuse",{cards});}
async function nudge(u){
  const g=S.game;if(!g)return;
  if((S.nudgedAt[u]||0)>Date.now()-30000){toast("Give them a moment before nudging again.");return;}
  S.nudgedAt[u]=Date.now();
  const who=shortNick(nick(controllerOf(g,u)||u,g));
  const r=await api("nudge",{u});
  if(!r.ok){toast(r.error);return;}
  toast(r.reached?`Nudged ${who}.`:`${who} doesn't have the game open anywhere right now, so the nudge can't reach them.`);
  renderSoon();
}
async function addBot(lvl){const r=await api("addbot",{lvl});if(!r.ok)toast(r.error);}

/* ---------- sound: a short chime when it's your move ---------- */
let AC=null;
function unlockAudio(){try{if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C();}if(AC&&AC.state==="suspended")AC.resume();}catch(e){}}
function chime(kind){
  if(!S.sound||!AC||AC.state!=="running")return;
  try{
    const t=AC.currentTime,notes=kind==="nudge"?[784,659,784]:[659,988];
    notes.forEach((f,i)=>{
      const o=AC.createOscillator(),gn=AC.createGain();o.type="sine";o.frequency.value=f;
      const s=t+i*.16;gn.gain.setValueAtTime(0,s);gn.gain.linearRampToValueAtTime(.16,s+.02);gn.gain.exponentialRampToValueAtTime(.001,s+.5);
      o.connect(gn).connect(AC.destination);o.start(s);o.stop(s+.55);
    });
  }catch(e){}
}

/* ---------- tables: create, join, leave ---------- */
function needNick(){
  const v=cleanNick($("#nick").value);
  if(!v){homeMsg("Type your name first, so the family knows who you are.",true);$("#nick").focus();return null;}
  ls.set("hm.nick",v);return v;
}
function homeMsg(t,err){S.hmsg=t?{t,err:!!err}:null;renderHome();}
async function createTable(){
  const n=needNick();if(!n)return;
  const b=$("#createBtn");b.disabled=true;
  const r=await api("create",{nick:n,code:null});
  b.disabled=false;
  if(!r.ok){homeMsg(r.error,true);return;}
  openTable(r.code);
}
async function joinTable(raw){
  const code=String(raw||"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4);
  if(code.length!==4){homeMsg("Table codes are four letters, like KXTB.",true);return;}
  const n=cleanNick($("#nick").value)||cleanNick(ls.get("hm.nick"));
  if(!n){openTable(code);return;}
  ls.set("hm.nick",n);
  const r=await api("join",{code,nick:n});
  if(!r.ok){homeMsg(r.error,true);return;}
  openTable(code);
}
async function takeSeat(){
  const g=S.game;if(!g||g.status!=="lobby")return;
  const inp=$("#seatNick");
  const n=cleanNick(inp?inp.value:"")||cleanNick(ls.get("hm.nick"));
  if(!n){toast("Type your name first, so the family knows who you are.");if(inp)inp.focus();return;}
  ls.set("hm.nick",n);$("#nick").value=n;
  const r=await api("join",{code:S.code,nick:n});
  if(!r.ok)toast(r.error);
}
async function leaveSeat(){
  const g=S.game;
  if(g&&g.status==="lobby"&&g.players[S.uid]){const r=await api("unjoin");if(!r.ok){toast(r.error);return;}}
  goHome();
}
async function kick(u){const r=await api("kick",{u});if(!r.ok)toast(r.error);}
/* pass-the-phone: someone without their own device sits at yours */
async function addLocalSeat(){
  const inp=$("#localName"),name=cleanNick(inp&&inp.value);
  if(!name){toast("Type their name first.");if(inp)inp.focus();return;}
  S.addLocal=false;
  const r=await api("addlocal",{name});if(!r.ok)toast(r.error);
  render();
}
async function rematch(){const r=await move("rematch");if(r&&r.code)openTable(r.code);}
async function copyText(t,done){
  try{await navigator.clipboard.writeText(t);toast(done);return true;}
  catch(e){
    const ta=document.createElement("textarea");ta.value=t;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";document.body.appendChild(ta);ta.select();
    let ok=false;try{ok=document.execCommand("copy");}catch(_){}
    ta.remove();toast(ok?done:"Couldn't copy. Select the link and copy it yourself.");return ok;
  }
}

/* ---------- opening a table ---------- */
function setURL(code){
  try{const u=new URL(location.href);if(code)u.searchParams.set("t",code);else u.searchParams.delete("t");history.replaceState(null,"",u.pathname+u.search);}catch(e){}
}
function openTable(code,resume){
  Object.assign(S,{code,view:"table",game:null,missing:false,resuming:!!resume,as:null,hands:{},dec:{},hints:{},scores:{},online:null,
    pick:{s:null,m:null,r:null},mode:null,confirm:false,lastTurn:null,sheet:null,sheetConfirm:false,addLocal:false,lastPend:null,settings:false});
  S.hmsg=null;ls.set("hm.table",code);setURL(code);
  loadNotebook(code);
  connect();
  window.scrollTo(0,0);
  render();
}
function goHome(){
  voiceLeave();applyCase(HMCASES.BY_ID.hollowmere);
  setFull(false);ls.set("hm.table",null);setURL(null);
  Object.assign(S,{view:"home",code:null,game:null,missing:false,as:null,sheet:null,sheetConfirm:false,settings:false});
  document.title="Murder at Hollowmere";
  connect();render();window.scrollTo(0,0);
}
function onGame(g){
  const previous=S.game;
  S.resuming=false;S.game=g;
  applyPlatformState(g,previous);S.missing=false;
  if(S.as&&!(g.players&&g.players[S.as]&&g.players[S.as].local===S.uid))S.as=null;
  if(g.status==="over")S.as=null;
  if(g.next&&g.players&&g.players[S.uid]&&g.status==="over"){const nx=g.next;setTimeout(()=>{if(S.code===g.code&&S.view==="table")openTable(nx);},900);}
  if(g.turn!==S.lastTurn){S.pick={s:null,m:null,r:null};S.mode=null;S.confirm=false;S.lastTurn=g.turn;}
  if(S.mode==="accuse"&&!(g.status==="playing"&&g.turn===ME()&&["turn","asked"].includes(g.phase))){S.mode=null;S.confirm=false;}
  buzz(g);render();
}
/* which of the seats this device plays needs a person to act right now */
function pendingSeat(g){
  if(!g||g.status!=="playing")return null;
  const a=actor(g);if(!a||g.phase==="judging")return null;
  if(!mySeats(g).includes(a)||(g.away&&g.away[a]))return null;
  if(g.phase==="asking"){const h=S.hands[a];return h&&matches(h,g.q.cards).length?a:null;}
  return a;
}
const needsMe=g=>!!g&&pendingSeat(g)===ME();
function moveLine(g,seat){
  const who=seat===S.uid?"":nick(seat,g)+": ";
  if(g.phase==="asking")return `${who}Show ${nick(g.q.by,g)} a card.`;
  if(g.phase==="asked")return `${who}Your question is answered. End your turn or accuse.`;
  return `${who}Your turn. Ask the family a question.`;
}
function buzz(g){
  const pend=pendingSeat(g);
  document.title=pend?"● Your move · Murder at Hollowmere":"Murder at Hollowmere";
  if(!pend){S.lastPend=null;return;}
  const k=`${g.code}|${pend}|${g.phase}|${g.turn}|${g.q?g.q.cards.join():""}`;
  if(S.lastPend===k)return;
  S.lastPend=k;chime("turn");announce(moveLine(g,pend));
  vib(60);
}

/* ---------- notebook marks: kept in this browser only ---------- */
function loadNotebook(code){
  S.nb={};S.nbCode=code;
  try{const v=ls.get("hm.nb."+code);if(v){const m=JSON.parse(v);if(m&&typeof m==="object")S.nb=m;}}catch(e){}
}
const nbMarks=()=>S.nb[ME()]||(S.nb[ME()]={});
function saveNotebook(){
  ls.set("hm.nb."+S.nbCode,JSON.stringify(S.nb));
  try{const l=JSON.parse(ls.get("hm.nbList")||"[]").filter(c=>c!==S.nbCode);l.push(S.nbCode);while(l.length>30)ls.set("hm.nb."+l.shift(),null);ls.set("hm.nbList",JSON.stringify(l));}catch(e){}
}
const CYCLE={"":"y","y":"n","n":"q","q":""};
const GLYPH={y:"✓",n:"✕",q:"?"};

/* ---------- rendering ---------- */
let rq=false;
function renderSoon(){if(rq)return;rq=true;requestAnimationFrame(()=>{rq=false;render();});}
function seatHexes(){
  const cs=getComputedStyle(document.documentElement),out=[];
  for(let i=0;i<8;i++){const v=cs.getPropertyValue("--p"+i).trim();out.push(v||"#888888");}
  return out;
}
function render(){
  $("#home").hidden=S.view!=="home";
  $("#table").hidden=S.view!=="table";
  if(S.view==="home")renderHome();else renderTable();
  Stage.mount(S.view==="home"?$("#stageH"):$("#stageT"));
  Stage.setMe(ME(),S.dec);
  Stage.setSeatHex(seatHexes());
  Stage.sync(S.view==="table"?S.game:null,S.view==="table"?S.code:null);
  if(S.view==="home"){Stage.setPick(false,{});Stage.setKnow(null);}
  renderOverlays();
}
function connLine(){
  switch(S.conn){
    case "init":return ["Opening the manor…",false];
    case "ready":return [S.noStore?"This browser isn't saving site data (private browsing?), so you won't be able to rejoin after closing this tab.":"",!!S.noStore];
    case "retry":return ["Lost touch with the manor. Reconnecting…",true];
    case "badkey":return ["This browser's player key was refused. Clear this site's data and reload.",true];
    default:return ["Couldn't reach the manor. Reload the page to try again.",true];
  }
}
function renderHome(){
  const msg=$("#homeMsg");
  const [ct,cerr]=connLine(),m=S.hmsg&&S.conn==="ready"?S.hmsg:{t:ct,err:cerr};
  if(msg.textContent!==m.t)msg.textContent=m.t;
  msg.classList.toggle("err",!!m.err);
  const mine=S.tables||[];
  let h="";
  if(mine.length){
    h=`<div class="list"><h3>Your cases</h3><ul class="tables">${mine.map(t=>{
      let meta;
      if(t.status==="lobby")meta=`Gathering · hosted by ${esc(t.host)} · ${t.n} of ${MAX_SEATS} seats taken`;
      else if(t.status==="over")meta=`Finished`;
      else meta=t.yourMove?`<span class="yourturn">Your move</span> · ${t.n} detectives`:`In progress · ${esc(t.turn||"someone")}'s turn`;
      const btn=t.status==="lobby"?"Back to table":t.status==="over"?"See the answer":"Rejoin";
      return `<li><div><div class="tcode">${esc(t.code)}</div><div class="tmeta">${meta}</div></div><button class="btn sm${t.yourMove||t.status!=="over"?" primary":""}" type="button" data-act="open" data-code="${esc(t.code)}">${btn}</button></li>`;
    }).join("")}</ul></div>`;
  }
  setHTML($("#platformHome"),platformHomeHTML());
  setHTML($("#lists"),h);
  $("#lists").hidden=!mine.length;
}
function renderTable(){
  const g=S.game,tbl=$("#tbl");
  $("#caseNo").textContent=S.code?`Case № ${S.code}`:"";
  const stage=!g?(S.missing?"closed":"loading"):({lobby:"lobby",over:"over",playing:"playing"}[g.status]||"closed");
  tbl.dataset.stage=stage;
  if(!S.tab)S.tab=window.matchMedia&&window.matchMedia("(min-width:960px)").matches?"log":"nb";
  tbl.dataset.tab=(stage==="playing"||stage==="over")?S.tab:"rules";
  $$("#tabbar [data-tab]").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===S.tab)));
  tbl.classList.toggle("busy",!!S.busy);
  const kn=(stage==="playing"||stage==="over")?knowledge(g):null;
  const pk=[S.code,stage,g&&g.phase,g&&g.turn,S.mode,ME(),g&&g.q?g.q.cards.join():""].join("|");
  if(setHTML($("#panel"),connBanner()+sheetHTML(g)+panelHTML(g,kn))){
    if(pk!==S.pk&&!REDUCED){const p=$("#panel .panel.act")||$("#panel .panel");if(p)p.classList.add("play");}
    S.pk=pk;playAnims($("#panel"));
  }
  if(kn){
    setHTML($("#seats"),seatsHTML(g));
    if(setHTML($("#hand"),handHTML(g,kn)))playAnims($("#hand"));
    setHTML($("#nb"),nbHTML(g,kn));
    setHTML($("#log"),logHTML(g));
  }
  if(!$("#rulesT").__h)setHTML($("#rulesT"),rulesHTML());
  const chatDraft=$("#chatMessage")?.value||"";
  const recipient=$("#chatRecipient")?.value;
  const platformChanged=setHTML($("#platformTable"),platformTableHTML(g));
  if(platformChanged){const c=$("#chatMessage");if(c)c.value=chatDraft;const r=$("#chatRecipient");if(r&&recipient&&[...r.options].some(o=>o.value===recipient))r.value=recipient;}
  setHTML($("#stageHud"),hudHTML(g));
  const me=ME();
  const pickMode=!!(g&&g.status==="playing"&&g.turn===me&&needsMe(g)&&(g.phase==="turn"||(S.mode==="accuse"&&g.phase==="asked")));
  Stage.setPick(pickMode,S.pick);
  Stage.setKnow(kn&&g.status==="playing"?kn.row:null);
}
function connBanner(){
  if(S.conn==="retry")return `<div class="banner warnbar" role="status"><span>Lost touch with the manor. Reconnecting<span class="dots"></span> Your seat is safe.</span></div>`;
  if(S.conn==="badkey")return `<div class="banner warnbar" role="alert"><span>This browser's player key was refused, so you can only watch. Clear this site's data and reload.</span></div>`;
  return "";
}
function actionVisible(){
  const el=$("#panel .respond .cards")||$("#panel .act.mine .actions")||$("#panel .act .actions");
  if(!el||$("#table").hidden)return true;
  const r=el.getBoundingClientRect();
  return r.bottom>70&&r.top<innerHeight-Math.min(r.height,140)*.75;
}
/* things that float over the page: the move dock, the pass-the-phone curtain, settings */
function renderOverlays(){
  S.panelVis=actionVisible();
  const g=S.view==="table"?S.game:null;
  const cur=curtainFor(g);
  const ce=$("#curtain");
  setHTML(ce,cur?curtainHTML(g,cur):"");ce.hidden=!cur;
  document.body.classList.toggle("curtained",!!cur);
  const d=$("#dock"),dh=cur?"":dockHTML(g);
  setHTML(d,dh);d.hidden=!dh||(S.panelVis&&!S.full);
  const st=$("#settings");st.hidden=!S.settings;
  if(S.settings)setHTML(st,settingsHTML());
  $$(".set-open").forEach(b=>b.setAttribute("aria-expanded",String(!!S.settings)));
  document.body.classList.toggle("has-dock",!d.hidden);
}
function hudHTML(g){
  if(!g)return "";
  let line="";
  if(g.status==="lobby")line=`Table ${esc(g.code)} · ${seated(g).length} seated`;
  else if(g.status==="over")line=g.winner?`${esc(nm(g.winner,g))} solved it`:"The case is closed";
  else if(g.status==="playing"){
    const a=actor(g);
    if(g.phase==="judging"&&g.acc)line=`${esc(nm(g.acc.by,g))} ${g.acc.by===ME()?"accuse":"accuses"}…`;
    else if(g.phase==="asking"&&g.q)line=`${esc(nm(g.q.by,g))} asked · ${esc(nm(a,g))} ${a===ME()?"are":"is"} checking`;
    else line=g.turn===ME()?"Your turn":`${esc(nick(g.turn,g))}'s turn`;
  }
  return `<span class="hud-line">${line}</span>`;
}
function setFull(on){
  S.full=!!on;
  const st=$("#stageT");if(!st)return;
  st.classList.toggle("full",S.full);document.body.classList.toggle("boardfull",S.full);
  const b=st.querySelector(".stage-btn");if(b){b.setAttribute("aria-label",S.full?"Close full screen":"Show the board full screen");b.title=S.full?"Close":"Full screen";}
  renderOverlays();
}
function seatsHTML(g){
  const a=actor(g);
  return holdersOf(g).map(u=>{
    const isB=u==="butler",bot=isBot(g,u);
    let st=`${(g.handSize&&g.handSize[u])||0} cards`,cls="";
    if(g.left&&g.left[u]){st="Left the game";cls+=" out";}
    else if(!isB&&g.out&&g.out[u]){st="Out of the running";cls+=" out";}
    else if(!isB&&g.away&&g.away[u]){st="Away";}
    if(g.status==="playing"){
      if(g.turn===u&&!(g.out&&g.out[u])){cls+=" turn";st=u===ME()?"Your turn":(bot&&a===u?"Thinking…":"Their turn");}
      if(g.phase==="asking"&&a===u){cls+=" acting";st=bot||isB?"Thinking…":"Checking cards…";}
      if(g.phase==="asking"&&g.turn===u&&a!==u)st="Waiting for answers";
      if(g.phase==="asked"&&g.q&&g.q.shownBy===u){st="Showed a card";}
    }else if(g.winner===u){cls+=" turn";st="Solved it";}
    const on=isB||bot?null:online(u);
    const dot=on===null?"":`<span class="dot ${on?"":"off"}" title="${on?"Here now":"Not here right now"}"></span>`;
    const label=isB?"Fennimore (butler)":nick(u,g)+(u===ME()?" (you)":"");
    const sub=bot?"Computer · ":isLocal(g,u)?`On ${shortNick(nick(g.players[u].local,g))}'s device · `:"";
    const portrait=isB?`<span class="seat-portrait seat-butler" aria-hidden="true">🗝️</span>`:detectivePortrait(DETECTIVE_BY_ID[g.players[u]?.character]||DETECTIVES[0],"seat-portrait");
    return `<li class="seat${cls}" style="--c:${colorOf(u,g)}"><span class="sw"></span>${portrait}<span class="sn">${esc(label)}${dot}</span><span class="ss">${esc(sub+st)}</span></li>`;
  }).join("");
}
function sentence(mode){
  const b=(id,w)=>id?`<b>${esc(CARD[id].name)}</b>`:`<span class="blank">${w}</span>`;
  if(mode==="accuse")return `“I accuse ${b(S.pick.s,"someone")}, with the ${b(S.pick.m,"something")}, in the ${b(S.pick.r,"somewhere")}.”`;
  return `“Was it ${b(S.pick.s,"someone")}, with the ${b(S.pick.m,"something")}, in the ${b(S.pick.r,"somewhere")}?”`;
}
function builderHTML(mode,kn){
  const groups=[["s",SUSPECTS,"Who"],["m",METHODS,"How"],["r",ROOMS,"Where"]],hand=S.hands[ME()];
  return `<div class="builder">${groups.map(([k,list,lab])=>`<fieldset class="grp ${KCLS[k]}"><legend>${lab}</legend><div class="chips">${list.map(c=>{
    const st=kn.row[c.id],on=S.pick[k]===c.id,mine=hand&&hand.includes(c.id);
    const cls=`chip ${KCLS[k]}${st==="env"?" hot":""}${["held","faceup","notenv"].includes(st)?" dim":""}`;
    return `<button type="button" class="${cls}" data-act="pick" data-k="${k}" data-id="${c.id}" aria-pressed="${on}"><span aria-hidden="true">${c.icon}</span>${esc(c.short)}${mine?'<span class="mine">yours</span>':""}</button>`;
  }).join("")}</div></fieldset>`).join("")}<p class="sentence">${sentence(mode)}</p></div>`;
}
function waited(g){const k=g.code+"|"+g.rev;if(S.waitKey!==k){S.waitKey=k;S.waitAt=Date.now();}return Date.now()-S.waitAt;}
function nudgeBtn(u){
  const g=S.game,c=controllerOf(g,u)||u;
  return `<button class="btn sm" type="button" data-act="nudge" data-u="${esc(u)}">Nudge ${esc(shortNick(nick(c,g)))}</button>`;
}
function waitingHTML(g,u,doing){
  if(isBot(g,u)||u==="butler")return `<div class="waiting"><span>${N(u,g)} is thinking<span class="dots"></span></span></div>`;
  const ctrl=controllerOf(g,u),on=online(u),answering=g.phase==="asking";
  let h=`<div class="waiting"><span>Waiting for ${N(u,g)} ${esc(doing)}<span class="dots"></span></span>`;
  if(on===false)h+=`<span>${isLocal(g,u)?esc(nick(ctrl,g))+"'s device, where "+esc(nick(u,g))+" plays, isn't open.":"They don't have the game open right now."} ${answering?"If they don't come back soon, the game shows a card for them.":"If they don't come back, their turn is skipped."}</span>`;
  if(ctrl!==S.uid&&(on===false||waited(g)>=12000))h+=nudgeBtn(u);
  if(g.hostId===S.uid&&ctrl!==S.uid&&!(g.away&&g.away[u])&&waited(g)>=20000)h+=`<button class="btn sm ghost" type="button" data-act="away" data-u="${esc(u)}">They've stepped away</button>`;
  return h+`</div>`;
}
function questionHTML(g){
  const q=g.q;if(!q)return "";
  const lastAsk=((g.log||[]).filter(x=>x.t==="ask").slice(-1)[0]||{n:0}).n;
  const items=q.queue.map((u,i)=>{
    let cls="",mk="",txt="";
    if(q.shownBy===u){cls="yes";mk="★";txt=`showed ${q.by===ME()?"you":esc(nm(q.by,g,true))} a card`;}
    else if(i<q.step||(g.phase!=="asking"&&!q.shownBy)){
      const sk=(g.log||[]).some(e=>e.t==="skipq"&&e.who===u&&e.n>lastAsk);
      cls="no";mk="✕";txt=sk?"has left, so wasn't asked":"couldn't show a card";
    }
    else if(i===q.step&&g.phase==="asking"){cls="now";mk="…";txt=isBot(g,u)||u==="butler"?"is thinking":u===ME()?"are checking your cards":"is checking their cards";}
    else{mk="";txt=g.phase==="asking"?"waits":"wasn't asked";}
    return `<li class="${cls}"><span class="mk">${mk}</span><span>${N(u,g)} ${txt}</span></li>`;
  }).join("");
  return `<div class="trio">${q.cards.map(c=>cardHTML(c,{size:"sm"})).join("")}</div><ol class="answers">${items}</ol>`;
}
function progressHTML(g){
  if(g.status!=="playing"||!mySeats(g).includes(ME()))return "";
  const progress=S.scores[ME()],hints=S.hints[ME()]||[],cost=[3,6,10,15][hints.length];
  if(!progress)return "";
  const cards=hints.map(h=>`<span class="hint-card">${ref(h.card)} <small>−${h.cost} pts</small></span>`).join("");
  const disabled=cost==null||progress.points<cost||!!(g.out&&g.out[ME()]);
  const reason=cost==null?"All four hints used.":`The next private clue costs ${cost} points.`;
  return `<section class="dossier-progress" aria-label="Your investigation score and hints">
    <div class="dossier-score"><span>YOUR DETECTIVE SCORE</span><strong>${progress.points} pts</strong><small>${progress.questions} distinct questions · ${progress.discoveries} cards discovered</small></div>
    <div><b>Private evidence hints</b><p class="muted">${reason} Each hint reveals one card that cannot be the solution. Only you see it.</p>
    ${cards?`<div class="hint-list">${cards}</div>`:""}<button class="btn sm" type="button" data-act="hint" ${disabled?"disabled":""}>${cost==null?"Hints exhausted":`Reveal a clue (−${cost} pts)`}</button></div>
  </section>`;
}
function panelHTML(g,kn){
  if(S.missing)return `<div class="panel"><h2>There's no table ${esc(S.code||"")}</h2><p class="help">Check the code with whoever invited you. Tables are cleared away a couple of days after their last move.</p><div class="actions"><button class="btn primary" type="button" data-act="gohome">Back to the hall</button></div></div>`;
  if(!g)return `<div class="panel"><p class="muted">Opening the case file…</p></div>`;
  if(g.status==="closed")return `<div class="panel"><h2>This table was closed</h2><p class="help">Everyone left before the cards were dealt.</p><div class="actions"><button class="btn primary" type="button" data-act="gohome">Back to the hall</button></div></div>`;
  if(g.status==="lobby")return lobbyHTML(g);
  let top="";
  if(g.status==="playing"){
    if(g.pausedAt){
      top+=`<div class="banner" role="status"><span>⏸ Investigation paused: no active detectives are connected. Turns and timers will resume when someone returns. Your cards and progress are safe.</span>${g.away&&mySeats(g).some(u=>g.away[u])?`<button class="btn sm primary" type="button" data-act="back">I'm back</button>`:""}</div>`;
    }
    const gone=(g.order||[]).filter(u=>g.away&&g.away[u]&&!(g.left&&g.left[u])&&controllerOf(g,u)!==S.uid);
    if(gone.length){
      const names=gone.map(u=>esc(nick(u,g))).join(" and "),many=gone.length>1;
      top+=`<div class="banner"><span>${names} ${many?"are":"is"} away, so the game skips ${many?"their":"their"} turns and shows a card for ${many?"them":"them"} when asked.</span><span class="actions">${gone.map(u=>nudgeBtn(u)).join("")}</span></div>`;
    }
  }
  if(g.status==="over")return top+overHTML(g);
  return top+`${g.opening?`<section class="opening"><p class="eyebrow">Case opening</p><h3>${esc(g.opening.title)}</h3><p>${esc(g.opening.text)}</p></section>`:""}${g.finalRound?`<div class="final-banner">FINAL INVESTIGATION · The last eligible detective gets one question, then must accuse or close the case. The best score decides the honours if unsolved.</div>`:""}${detectiveIdentityHTML(g)}${progressHTML(g)}${playHTML(g,kn)}`;
}
function coach(text){return text?`<p class="coach">${text}</p>`:"";}
function turnCoach(g,kn){
  const n=(g.log||[]).filter(e=>e.t==="ask"&&e.by===ME()).length,found=ALL.filter(c=>kn.row[c]==="env").length;
  if(found===3)return "Your notebook shows all three. Make your accusation to win.";
  if(n<2)return "Pick one of each, then ask. The first player holding any of them must show you one, in secret. Tip: include a card you hold to steer the answer toward the others.";
  if(found)return `Gold in your notebook is proven. ${found} of 3 found. Ask about what's still open.`;
  return "Crossed-out cards aren't in the envelope. Ask about the ones that aren't crossed out yet.";
}
function playHTML(g,kn){
  const me=ME(),a=actor(g),myTurn=g.turn===me;
  let top="";
  if(g.away&&g.away[me]&&mySeats(g).includes(me))top+=`<div class="banner"><span>You're marked away: the game skips your turns and shows a card for you when you're asked.</span><button class="btn sm primary" type="button" data-act="back">I'm back</button></div>`;
  if(g.out&&g.out[me]&&!(g.left&&g.left[me])&&mySeats(g).includes(me)){
    const sol=mySolution(g);
    top+=`<div class="banner"><span>Your accusation was wrong, so you're out of the running. Keep showing cards when asked. The solution stays sealed until the case ends.</span></div>`;
  }
  if(myTurn&&S.mode==="accuse"&&["turn","asked"].includes(g.phase))return top+accuseHTML(kn);
  if(g.phase==="turn"){
    if(myTurn&&!(g.away&&g.away[me])&&mySeats(g).includes(me)){
      const ok=S.pick.s&&S.pick.m&&S.pick.r;
      return top+`<div class="panel act mine">
        <p class="eyebrow">${me===S.uid?"Your turn":esc(nick(me,g))+"'s turn"}</p><h2>Question the family</h2>
        ${coach(turnCoach(g,kn))}
        ${builderHTML("ask",kn)}
        <div class="actions"><button class="btn primary" type="button" data-act="ask" ${ok?"":"disabled"}>Ask the family</button><button class="btn ghost sealtext" type="button" data-act="mode" data-mode="accuse">Make an accusation…</button></div>
      </div>`;
    }
    return top+`<div class="panel act"><p class="eyebrow">${esc(nick(g.turn,g))}'s turn</p><h2>${N(g.turn,g)} ${g.turn===me?"are":"is"} choosing a question</h2>${waitingHTML(g,g.turn,"to ask")}</div>`;
  }
  if(g.phase==="asking"){
    const q=g.q,hand=S.hands[me];let mid="";
    const askers=nm(q.by,g);
    if(a===me&&mySeats(g).includes(me)&&!(g.away&&g.away[me])){
      if(!hand)mid=`<p class="muted">Getting your cards…</p>`;
      else{
        const m=matches(hand,q.cards);
        if(!m.length)mid=coach(`You hold none of the three, so you pass. ${esc(askers)} learns you don't have them.`);
        else{
          const before=new Set();for(const e of g.log||[])if(e.t==="show"&&e.who===me&&e.to===q.by&&S.dec[e.n]&&S.dec[e.n].card)before.add(S.dec[e.n].card);
          const cn=m.map(c=>CARD[c].name);
          const tip=m.length>1?`You hold ${cn.slice(0,-1).join(", ")} and ${cn.slice(-1)}. Show one. ${esc(askers)} only sees the one you pick${before.size?", and showing one you've shown them before gives nothing new away":""}.`:`You hold ${esc(cn[0])}, so you must show it. Only ${esc(askers)} sees it.`;
          mid=`<div class="respond" data-anim="resp-${esc(S.code)}-${g.seq||0}"><h3>Show ${N(q.by,g,true)} a card</h3>${coach(tip)}<div class="cards">${m.map((c,i)=>cardHTML(c,{act:"show",i,tag:before.has(c)?"shown before":""})).join("")}</div></div>`;
        }
      }
    }else if(a==="butler")mid=`<p class="waiting">Fennimore is checking his cards<span class="dots"></span></p>`;
    else if(g.away&&g.away[a])mid=`<p class="waiting">${a===me?"You're":N(a,g)+" is"} away, so the game answers for ${a===me?"you":"them"}<span class="dots"></span></p>`;
    else mid=waitingHTML(g,a,"to check their cards");
    const mineAct=a===me&&hand&&matches(hand,q.cards).length;
    return top+`<div class="panel act${mineAct?" mine":""}"><p class="eyebrow">${q.by===me?"Your question":esc(nick(q.by,g))+" asks"}</p><h2>${q.by===me?"You asked":N(q.by,g)+" asked"}</h2>${questionHTML(g)}${mid}</div>`;
  }
  if(g.phase==="asked"){
    const q=g.q;let res="";
    if(q.shownBy){
      if(q.by===me){
        const e=[...(g.log||[])].reverse().find(x=>x.t==="show"&&x.to===me);
        const d=e&&S.dec[e.n];
        res=`<div class="result">${d&&d.card?flipHTML(d.card,{size:"lg",anim:`show-${S.code}-${e.n}`}):""}<p>${N(q.shownBy,g)} showed you ${d&&d.card?ref(d.card)+". It isn't in the envelope, so it's crossed off in your notebook.":"a card."}</p></div>`;
      }else res=`<div class="result"><p>${N(q.shownBy,g)} showed ${N(q.by,g,true)} a card.${q.shownBy===me?"":" Only they saw which one."}</p></div>`;
    }else res=`<div class="result"><p>Nobody could show a card. ${q.by===me?"Any of the three you don't hold must be in the envelope.":"Each of the three is in "+esc(nick(q.by,g))+"'s hand or in the envelope."}</p></div>`;
    let tail;
    if(myTurn&&mySeats(g).includes(me)&&!(g.away&&g.away[me]))tail=`<div class="actions"><button class="btn primary" type="button" data-act="endturn">${g.finalRound?"Close investigation & score":"End my turn"}</button><button class="btn ghost sealtext" type="button" data-act="mode" data-mode="accuse">Make an accusation…</button></div>`;
    else tail=waitingHTML(g,g.turn,"to end their turn or accuse");
    return top+`<div class="panel act${myTurn?" mine":""}"><p class="eyebrow">${q.by===me?"Your question":esc(nick(q.by,g))+"'s question"}</p>${questionHTML(g)}${res}${tail}</div>`;
  }
  if(g.phase==="judging"){
    const acc=g.acc;
    return top+`<div class="panel act accuse"><p class="eyebrow">Accusation</p><h2>${N(acc.by,g)} ${acc.by===me?"accuse":"accuses"}</h2><div class="trio">${acc.cards.map(c=>cardHTML(c,{size:"sm"})).join("")}</div><p class="waiting">Opening the envelope<span class="dots"></span></p></div>`;
  }
  return top;
}
function accuseHTML(kn){
  const ok=S.pick.s&&S.pick.m&&S.pick.r,found=ALL.filter(c=>kn.row[c]==="env").length;
  let act;
  if(!S.confirm)act=`<button class="btn danger" type="button" data-act="confirm" ${ok?"":"disabled"}>Seal my accusation</button><button class="btn ghost" type="button" data-act="mode" data-mode="">Not yet</button>`;
  else act=`<p class="warn">Final answer? If any of the three is wrong, you're out of the running for the rest of the case.</p><button class="btn danger" type="button" data-act="accuse">Yes, I accuse</button><button class="btn ghost" type="button" data-act="unconfirm">Let me think</button>`;
  return `<div class="panel act accuse"><p class="eyebrow">Accusation</p><h2>Name the culprit</h2>${coach(found===3?"Your notebook proves all three. Gold rows are the answer.":`Only accuse when you're sure. Your notebook proves ${found} of 3 so far, and a wrong guess puts you out.`)}${builderHTML("accuse",kn)}<div class="actions">${act}</div></div>`;
}
function overHTML(g){
  const sol=g.solution,me=ME(),log=g.log||[];
  const closed=log.some(e=>e.t==="closed"),abandoned=log.some(e=>e.t==="abandon");
  let head,sub="";
  if(g.winner)head=g.winner===me?"You solved it!":`${esc(nick(g.winner,g))} solved it`;
  else if(closed){head="The case was closed unsolved";sub=`<p class="help">The host ended it before anyone solved it. Here's what the envelope held.</p>`;}
  else if(abandoned){head="The case was abandoned";sub=`<p class="help">Everyone left before it was solved. Here's what the envelope held.</p>`;}
  else{head="The culprit got away";sub=`<p class="help">No accusation solved the murder. The best detective is recognised for their investigation—not for identifying the culprit.</p>`;}
  const body=sol?`<div class="trio">${sol.map((c,i)=>flipHTML(c,{size:"lg",i,anim:`reveal-${S.code}-${i}`})).join("")}</div><p class="verdict">It was ${esc(CARD[sol[0]].name)}, with the ${esc(CARD[sol[1]].name)}, in the ${esc(CARD[sol[2]].name)}.</p>`:"";
  const host=g.hostId===S.uid,seatedMe=canHost(g,S.uid)||!!(g.players&&g.players[S.uid]&&!g.players[S.uid].local&&!g.players[S.uid].bot);
  const canRe=host||(seatedMe&&(online(g.hostId)===false||(g.left&&g.left[g.hostId])));
  const act=canRe?`<button class="btn primary" type="button" data-act="rematch">New case, same family</button><button class="btn ghost" type="button" data-act="gohome">Back to the hall</button>`
    :`<span class="muted">${g.next?"Moving to the next case…":esc(nick(g.hostId,g))+" can start a new case for the same family."}</span><button class="btn ghost" type="button" data-act="gohome">Back to the hall</button>`;
  const winnerPortrait=g.winner&&g.players&&g.players[g.winner]?`<div class="winner-portrait">${detectivePortrait(DETECTIVE_BY_ID[g.players[g.winner].character]||DETECTIVES[0],"winner-portrait-face")}<div><span class="eyebrow">Case solved by</span><h3>${esc(nick(g.winner,g))}</h3><p>${esc((DETECTIVE_BY_ID[g.players[g.winner].character]||DETECTIVES[0]).name)}</p></div></div>`:"";
  const ranking=Array.isArray(g.rankings)&&g.rankings.length?`<div class="end-rank"><h3>Final detective rankings</h3><ol>${g.rankings.map((r,i)=>`<li><span>${i+1}. ${esc(r.nick)}${g.bestDetective===r.seat?" · Best Detective":""}${g.winner===r.seat?" · Case Solved":""}</span><b>${r.points} pts</b></li>`).join("")}</ol></div>`:"";
  return `<div class="panel reveal"><p class="eyebrow">The envelope</p><h2>${head}</h2>${sub}${winnerPortrait}${body}${ranking}<div class="actions" style="justify-content:center">${act}</div></div>`;
}
function lobbyHTML(g){
  const seats=seated(g),me=S.uid,host=g.hostId===me,inIt=!!(g.players&&g.players[me]);
  const list=seats.map(u=>{
    const p=g.players[u],b=p.bot;
    const tag=b?`<span class="tag">computer · ${b}</span>`:p.local?`<span class="tag">on ${esc(shortNick(nick(p.local,g)))}'s device</span>`:"";
    const canRemove=u!==me&&(host||p.local===me);
    const on=b?null:online(u);
    const dot=on===null||p.local?"":`<span class="dot ${on?"":"off"}" title="${on?"Here now":"Not here right now"}"></span>`;
    return `<li style="--c:${colorOf(u,g)}"${b||p.local?' class="botrow"':""}><span class="sw"></span>${detectivePortrait(DETECTIVE_BY_ID[p.character]||DETECTIVES[0],"guest-portrait")}<span class="gn">${esc(nick(u,g))}${dot}</span><small class="char-tag">${esc((DETECTIVE_BY_ID[p.character]||DETECTIVES[0]).name)}</small>${tag}${u===g.hostId?'<span class="tag">host</span>':""}${u===me?'<span class="tag">you</span>':""}${canRemove?`<button class="link" type="button" data-act="kick" data-u="${esc(u)}" aria-label="Remove ${esc(nick(u,g))}">Remove</button>`:""}</li>`;
  }).join("");
  const room=seats.length<MAX_SEATS;
  const link=inviteURL(g.code);
  const invite=`<div class="invite">
      <label for="inviteLink"><b>Invite the family</b></label>
      <div class="invite-row"><input id="inviteLink" readonly value="${esc(link)}"><button class="btn sm" type="button" data-act="copylink">Copy link</button>${navigator.share?`<button class="btn sm" type="button" data-act="sharelink">Share…</button>`:""}</div>
      <p class="muted">Send everyone this link. Or they can open <b>${esc(location.host+location.pathname.replace(/\/$/,""))}</b> and type the code <b>${esc(g.code)}</b>. Nobody needs an account.</p>
    </div>`;
  const addBots=host&&room?`<div class="addbot">
      <div class="addbot-t"><b>Add a computer detective</b><span>Rookie detectives use basic clues; Sharp detectives use table-wide deductions; Master detectives select strategic questions using available evidence. AI plays on the server, keeping cards private.</span></div>
      <div class="actions"><button class="btn sm" type="button" data-act="addbot" data-lvl="rookie">+ Rookie</button><button class="btn sm" type="button" data-act="addbot" data-lvl="sharp">+ Sharp</button><button class="btn sm" type="button" data-act="addbot" data-lvl="master">+ Master</button></div>
    </div>`:"";
  const addLocal=inIt&&room?(S.addLocal?`<form class="addbot" id="localForm">
      <div class="addbot-t"><label for="localName"><b>Who's playing on this device?</b></label><span>When it's their move, you pass them the phone and their cards appear behind a privacy screen.</span></div>
      <div class="actions"><input id="localName" maxlength="16" placeholder="e.g. Grandma Rose" autocomplete="off"><button class="btn sm primary" type="submit">Add</button><button class="btn sm ghost" type="button" data-act="localcancel">Cancel</button></div>
    </form>`:`<div class="addbot"><div class="addbot-t"><b>Someone without a phone or computer?</b><span>Seat them on your device and pass it over when it's their move.</span></div><div class="actions"><button class="btn sm" type="button" data-act="localadd">+ Player on this device</button></div></div>`):"";
  let act="";
  if(host)act=`<button class="btn primary" type="button" data-act="deal" ${seats.length<2?"disabled":""}>Deal the cards</button><button class="btn ghost" type="button" data-act="leave">${seats.some(u=>u!==me&&canHost(g,u))?"Leave and hand over":"Close this table"}</button>`;
  else if(inIt)act=`<span class="muted">Waiting for ${esc(nick(g.hostId,g))} to deal the cards.</span><button class="btn ghost" type="button" data-act="leave">Leave table</button>`;
  else if(room){
    const n=cleanNick(ls.get("hm.nick"));
    act=`<form class="seatform" id="seatForm"><label for="seatNick">Your name at the table</label><div class="actions"><input id="seatNick" maxlength="16" autocomplete="nickname" placeholder="e.g. Grandpa Joe" value="${esc(n)}"><button class="btn primary" type="submit">Take a seat</button></div></form>`;
  }
  else act=`<span class="muted">This table is full. You can watch once the cards are dealt.</span>`;
  const editableSeats=mySeats(g).filter(u=>g.players[u]&&!g.players[u].bot);
  const characterSelect=editableSeats.length?`<div class="character-picker"><h3>Choose your detective</h3><p class="muted">All eight are available immediately. Characters are cosmetic; each has the same powers and access to clues.</p>${editableSeats.map(u=>{
    const p=g.players[u],selected=DETECTIVE_BY_ID[p.character]||DETECTIVES[0];
    return `<div class="character-row"><strong>${esc(p.nick)}'s detective</strong>
      <div class="character-selected">${detectivePortrait(selected,"character-selected-face")}<div><h4>${esc(selected.name)}</h4><b>${esc(selected.title)}</b><p>${esc(selected.bio)}</p></div></div>
      <label class="character-select-label" for="character-${esc(u)}">Choose by name</label><select id="character-${esc(u)}" data-character-seat="${esc(u)}">${DETECTIVES.map(c=>`<option value="${c.id}" ${selected.id===c.id?"selected":""}>${esc(c.name)}</option>`).join("")}</select>
      <div class="character-options" role="group" aria-label="Select a detective for ${esc(p.nick)}">${DETECTIVES.map(c=>`<button class="character-option ${selected.id===c.id?"is-selected":""}" type="button" data-act="pickcharacter" data-seat="${esc(u)}" data-character="${c.id}" aria-label="Choose ${esc(c.name)}" aria-pressed="${selected.id===c.id?"true":"false"}">${detectivePortrait(c,"character-option-face")}<span>${esc(c.name)}</span>${selected.id===c.id?`<small>Selected ✓</small>`:""}</button>`).join("")}</div>
    </div>`;
  }).join("")}</div>`:"";
  const n=seats.length;
  const hint=n<2?(host?"You need at least two detectives. Wait for family to join, or add a computer detective or a player on this device and start now.":"You need at least two detectives to start."):n===2?"Two detectives: Fennimore the butler joins with a third hand to keep the puzzle interesting.":`${n} detectives. Up to ${MAX_SEATS} can play.`;
  return `<div class="panel act">
    <p class="eyebrow">Gathering the family</p>
    <div class="actions" style="justify-content:space-between"><h2>Table</h2><span class="bigcode">${esc(g.code)}</span></div>
    ${invite}
    <ol class="guestlist">${list}</ol>
    ${characterSelect}
    ${addBots}${addLocal}
    <p class="muted">${esc(hint)}</p>
    <div class="actions">${act}</div>
  </div>`;
}
function handHTML(g,kn){
  const me=ME(),iPlay=(g.order||[]).includes(me)&&mySeats(g).includes(me),hand=S.hands[me];
  let h="";
  if(iPlay){
    const cards=hand?`<div class="cards fan${hand.length>5?" tight":""}">${hand.map((c,i)=>cardHTML(c,{i,fan:[i,hand.length]})).join("")}</div>`:`<p class="muted">Getting your cards…</p>`;
    h+=`<div class="handbox"${hand?` data-anim="hand-${esc(S.code)}-${esc(me)}"`:""}><h3>${me===S.uid?"Your cards":esc(nick(me,g))+"'s cards"}</h3>${cards}<p class="hand-note">Nobody else can see these. A card you hold can't be in the envelope.</p></div>`;
  }else h+=`<div class="handbox"><h3>You're watching</h3><p class="hand-note">Only the detectives at the table can see their own cards.</p></div>`;
  if(g.faceUp&&g.faceUp.length)h+=`<div class="handbox"><h3>Face-up evidence</h3><div class="cards">${g.faceUp.map(c=>cardHTML(c,{size:"sm"})).join("")}</div><p class="hand-note">Left over after the deal. Everyone can see these.</p></div>`;
  if(g.status==="over"&&g.allHands){
    const rows=holdersOf(g).filter(u=>u!==me&&(g.allHands[u]||[]).length).map(u=>`<div class="ah-row"><p class="ah-n" style="--c:${colorOf(u,g)}">${esc(u==="butler"?"Fennimore":nick(u,g))}</p><div class="cards">${g.allHands[u].map(c=>cardHTML(c,{size:"sm"})).join("")}</div></div>`).join("");
    if(rows)h+=`<div class="handbox"><h3>Everyone's cards</h3>${rows}<p class="hand-note">The case is over, so every hand is laid face up.</p></div>`;
  }else for(const u in (g.revealed||{}))if((g.revealed[u]||[]).length)h+=`<div class="handbox"><h3>${esc(nick(u,g))}'s cards</h3><div class="cards">${g.revealed[u].map(c=>cardHTML(c,{size:"sm"})).join("")}</div><p class="hand-note">${esc(nick(u,g))} left the game, so their cards are face up for everyone.</p></div>`;
  return h;
}
function nbHTML(g,kn){
  const H=kn.H,marks=nbMarks();
  const head=H.map(u=>{const lab=u===ME()?"You":u==="butler"?"Fenn.":shortNick(nick(u,g));return `<th scope="col" style="--c:${colorOf(u,g)}" title="${esc(nick(u,g))}">${esc(lab)}</th>`;}).join("");
  const groups=[["s",SUSPECTS,"Who"],["m",METHODS,"How"],["r",ROOMS,"Where"]];
  let body="";
  for(const [k,list,lab] of groups){
    body+=`<tr class="gh ${KCLS[k]}"><th colspan="${H.length+1}" scope="rowgroup">${lab}</th></tr>`;
    for(const c of list){
      const st=kn.row[c.id];
      const rcls=st==="env"?"env":["held","faceup","notenv"].includes(st)?"cleared":"";
      const cells=H.map(u=>{
        const k2=c.id+"|"+u,av=kn.auto[k2];
        if(av)return `<td><button class="cell auto ${av}" type="button" disabled aria-label="${esc(nick(u,g))}: ${av==="y"?"holds it":"doesn't hold it"}">${GLYPH[av]}</button></td>`;
        const mv=marks[k2]||"";
        return `<td><button class="cell${mv?" man":""}" type="button" data-act="mark" data-k="${esc(k2)}" aria-label="${esc(nick(u,g))}, ${esc(c.name)}: ${mv?{y:"holds it",n:"doesn't hold it",q:"maybe"}[mv]:"no note"}">${mv?GLYPH[mv]:""}</button></td>`;
      }).join("");
      body+=`<tr class="${rcls}"><th scope="row"><span class="i" aria-hidden="true">${c.icon}</span>${esc(c.name)}</th>${cells}</tr>`;
    }
  }
  const envCount=ALL.filter(c=>kn.row[c]==="env").length;
  return `<div class="ledger-wrap"><div class="ledger-head"><h3>${ME()===S.uid?"Detective's notebook":esc(nick(ME(),g))+"'s notebook"}</h3><span class="muted" style="font-size:.88rem">${envCount?`${envCount} of 3 found`:"Envelope: unknown"}</span></div>
  <div class="ledger-scroll"><table class="ledger"><thead><tr><th scope="col">Card</th>${head}</tr></thead><tbody>${body}</tbody></table></div>
  <p class="legend">Grey marks are filled in from what you've seen. Tap a blank square to note ✓ holds it, ✕ doesn't, or ? maybe. Gold rows must be in the envelope.</p></div>`;
}
function logLine(e,g){
  const me=ME();
  switch(e.t){
    case "start":return ["",`The cards are dealt and the envelope is sealed. ${N(e.first,g)} ${e.first===me?"go":"goes"} first.`];
    case "turn":return ["div",`${esc(e.who===me?"Your":nick(e.who,g)+"'s")} turn`];
    case "ask":return ["",`${N(e.by,g)} asked: ${trioRef(e.c)}`];
    case "pass":return ["",`${N(e.who,g)} couldn't show a card.`];
    case "skipq":return ["",`${N(e.who,g)} ${e.who===me?"have":"has"} left, so ${e.who===me?"you weren't":"they weren't"} asked.`];
    case "show":{
      let t=`${N(e.who,g)} showed ${N(e.to,g,true)} a card.`;
      const d=S.dec[e.n];
      if(e.to===me&&d&&d.card)t+=` It was ${ref(d.card)}.`;
      if(e.who===me&&d&&d.card)t+=` You showed ${ref(d.card)}.`;
      if(e.auto)t+=e.who===me?" The game answered for you while you were away.":" The game answered for them.";
      return ["",t];
    }
    case "none":return ["",`Nobody could show a card.`];
    case "accuse":return ["bad",`${N(e.by,g)} ${e.by===me?"accuse":"accuses"} ${trioRef(e.c)}!`];
    case "wrong":{
      const d=S.dec[e.n];
      return ["bad",`Wrong. ${N(e.by,g)} ${e.by===me?"are":"is"} out of the running.`];
    }
    case "win":return ["big",`Correct! ${N(e.by,g)} solved the case.`];
    case "final":return ["big",`${N(e.who,g)} is the last eligible detective. The final investigation begins.`];
    case "hint":return ["",`${N(e.who,g)} consulted a private evidence hint (level ${e.level}).`];
    case "escape":return ["bad",`No detective solved the case. The best detective will be named by investigation score.`];
    case "abandon":return ["bad",`Everyone has left. The case was abandoned.`];
    case "closed":return ["bad",`The host closed the case unsolved.`];
    case "skip":return ["",e.reason==="timer"?`${N(e.who,g)} ${e.who===me?"ran":"ran"} out of turn time, so the turn passed to the next detective.`:e.reason==="offline"?`${N(e.who,g)} ${e.who===me?"were":"was"} disconnected long enough for the turn to pass.`:e.reason==="away"?`${N(e.who,g)} ${e.who===me?"were":"was"} marked away, so the turn passed.`:`${N(e.who,g)}'s turn was skipped.`];
    case "left":return ["bad",`${N(e.who,g)} left the game. Their cards are now face up.`];
    case "host":return ["",`${N(e.who,g)} ${e.who===me?"are":"is"} now hosting.`];
  }
  return null;
}
function logHTML(g){
  const items=[...(g.log||[])].reverse().map(e=>{const l=logLine(e,g);return l?`<li class="${l[0]}">${l[1]}</li>`:"";}).join("");
  return `<div class="logbox"><ol class="log" reversed>${items}</ol></div>`;
}
function rulesHTML(){
  return `<div class="rules">
  <div class="rule"><h3>The puzzle</h3><p>There are 18 cards: 6 relatives (who), 6 methods (how) and 6 rooms (where). When the cards are dealt, one of each kind is sealed in the envelope without anyone seeing it. Those three cards are what happened. The other 15 cards are dealt as evenly as possible among card holders. In two-player games the butler Fennimore holds a third hand.</p><p>Any card you can see, in your hand, face up, or shown to you, is not in the envelope.</p></div>
  <div class="rule"><h3>Your turn</h3><ol>
    <li><b>Ask a question.</b> Pick one relative, one method and one room. You may include your own cards to throw the others off.</li>
    <li><b>The others answer in seat order</b>, starting with the next player. The first one holding any of the three must secretly show you one of them. Everyone sees that a card was shown, but only you see which.</li>
    <li><b>If nobody can</b>, each of the three is either in your hand or in the envelope.</li>
    <li><b>End your turn</b>, or make an accusation.</li></ol></div>
  <div class="rule"><h3>Accusing</h3><p>Name a relative, a method and a room, at the start of your turn or after your question. All three right and you win. Any wrong and you're out: the solution remains sealed, you take no more turns, and you still show cards when asked. You get one accusation.</p><p>When only one eligible detective remains, that detective gets one final investigation turn: ask a question, then accuse or close the case. If their accusation is wrong—or they close the case without solving it—the highest deduction score receives the Best Detective title. Wrong accusers cannot accuse again.</p></div>
  <div class="rule"><h3>Deduction points and private hints</h3><p>Each distinct question earns 3 points; revealing a previously unseen card through a question earns 5 more. Start with 20 points. A wrong accusation loses 10 points, while solving the case earns 100. You may purchase up to four private evidence hints for 3, 6, 10, then 15 points. Hints only show cards outside the envelope and never disclose the solution. At the end, scores become public.</p></div>
  <div class="rule"><h3>Your notebook</h3><p>It fills itself in from what you've seen: your cards, cards shown to you, and who couldn't answer which question. Tap a blank square to add your own ✓, ✕ or ? notes. A row turns gold once that card must be in the envelope.</p></div>
  <div class="rule"><h3>Who can play</h3><p>Anyone with the link or the table code, in any web browser. No account, nothing to install. Someone without their own phone or computer can sit at yours: when it's their move, a privacy screen asks you to pass it over. The host can also add computer detectives. Rookie, Sharp and Master computer detectives have progressively stronger deduction and questioning strategies. All accuse only when they're sure.</p></div>
  <div class="rule"><h3>Away and leaving</h3><p>Unlimited turns do not end automatically while you are online. A chosen turn timer can expire; if you disconnect, the other detectives can continue after a reconnect grace period. If everyone is offline or marked away, the investigation pauses instead of skipping turns. Selecting Away lets the game pass your turns and answer questions until you tap “I'm back”. Leaving permanently lays your cards face up and removes you from the running. If the host goes, hosting can pass to a connected detective.</p></div>
  <div class="rule"><h3>Fair play</h3><p>The game's server shuffles and deals, and keeps the envelope sealed. Your device is only ever sent your own cards and the cards shown to you, never anyone else's hand or the answer, so nobody can peek, not even the host. Computer detectives and Fennimore play on the server too, and only use what a player in their seat would know. Accusations are checked the moment they're made.</p></div>
  </div>`;
}
function detectiveRosterHTML(){
  return `<div class="roster-grid">${DETECTIVES.map(d=>`<article class="detective-card">${detectivePortrait(d,"detective-card-face")}<h3>${esc(d.name)}</h3><b>${esc(d.title)}</b><p>${esc(d.bio)}</p></article>`).join("")}</div>`;
}
function castHTML(){
  const grp=(k,list,title)=>`<div class="cast-grp ${KCLS[k]}"><h3>${title}</h3><div class="cast-list">${list.map(c=>`<div class="cast-item">${cardHTML(c.id,{size:"sm"})}<p><b>${esc(c.name)}</b>${esc(c.note)}</p></div>`).join("")}</div></div>`;
  return grp("s",SUSPECTS,"Who: the family")+grp("m",METHODS,"How: the methods")+grp("r",ROOMS,"Where: the rooms");
}

/* ---------- the move dock, the privacy curtain, the leave sheet, settings ---------- */
function dockHTML(g){
  if(!g||g.status!=="playing"||!needsMe(g))return "";
  const me=ME(),q=g.q,who=me===S.uid?"":`${esc(nick(me,g))}: `;
  if(g.phase==="asking"){
    const m=matches(S.hands[me]||[],q.cards);
    return `<div class="dock-t"><b>${who}Show ${esc(nm(q.by,g))} a card</b><span>${m.length>1?"Pick one. Only they see it.":"You hold this one, so you must show it."}</span></div><div class="dock-cards">${m.map(c=>cardHTML(c,{act:"show",size:"sm"})).join("")}</div>`;
  }
  if(g.phase==="turn"){
    if(S.mode==="accuse")return `<div class="dock-t"><b>${who}Your accusation</b><span>Pick all three, then seal it.</span></div><div class="dock-a"><button class="btn sm" type="button" data-act="topanel">Go to it</button></div>`;
    const ok=S.pick.s&&S.pick.m&&S.pick.r;
    return `<div class="dock-t"><b>${who}Your turn</b><span>${ok?[S.pick.s,S.pick.m,S.pick.r].map(c=>esc(CARD[c].short)).join(" · "):"Pick who, how and where on the board or below."}</span></div><div class="dock-a"><button class="btn sm primary" type="button" data-act="ask" ${ok?"":"disabled"}>Ask</button><button class="btn sm" type="button" data-act="topanel">Choose</button></div>`;
  }
  if(g.phase==="asked"){
    const e=q.shownBy&&q.by===me?[...(g.log||[])].reverse().find(x=>x.t==="show"&&x.to===me):null,d=e&&S.dec[e.n];
    return `<div class="dock-t"><b>${who}${q.shownBy?(d&&d.card?esc(nm(q.shownBy,g))+" showed you "+esc(CARD[d.card].name):"You were shown a card"):"Nobody could show a card"}</b><span>End your turn, or accuse if you're sure.</span></div><div class="dock-a"><button class="btn sm primary" type="button" data-act="endturn">${g.finalRound?"Close case":"End turn"}</button><button class="btn sm ghost sealtext" type="button" data-act="accusenow">Accuse…</button></div>`;
  }
  return "";
}
function curtainFor(g){
  if(!g||!g.players||g.status!=="playing")return null;
  if(!Object.values(g.players).some(p=>p&&p.local===S.uid))return null;
  const pend=pendingSeat(g);
  if(pend&&pend!==ME())return {to:pend};
  if(!pend&&ME()!==S.uid)return {to:S.uid,back:true};
  return null;
}
function curtainHTML(g,c){
  const name=nick(c.to,g);
  return `<div class="curtain-in" role="dialog" aria-modal="true" aria-labelledby="curH">
    <p class="eyebrow">${c.back?"All done":"Pass the device"}</p>
    <h2 id="curH">${c.back?`Pass the device back to ${esc(name)}`:`${esc(name)}'s move`}</h2>
    <p class="help">${c.back?"Cards are hidden until the right person taps below.":`Hand the device to ${esc(name)}. Their cards stay hidden until they tap below.`}</p>
    <button class="btn primary" type="button" data-act="become" data-u="${esc(c.to)}">I'm ${esc(name)}, show my cards</button>
  </div>`;
}
function sheetHTML(g){
  if(S.sheet==="end"&&g)return `<div class="panel sheet" role="dialog" aria-labelledby="endH"><p class="eyebrow">End the case</p><h2 id="endH">Close this case unsolved?</h2><p class="help">Nobody wins, and everyone sees what the envelope held. You can start a new case for the same family afterwards.</p><div class="actions"><button class="btn danger" type="button" data-act="endcaseyes">End the case</button><button class="btn ghost" type="button" data-act="stay">Keep playing</button></div></div>`;
  if(S.sheet!=="leave"||!g)return "";
  const host=g.hostId===S.uid,playing=g.status==="playing",seat=(g.order||[]).includes(S.uid)&&!(g.left&&g.left[S.uid]);
  const cands=seated(g).filter(u=>u!==S.uid&&canHost(g,u));
  let h=`<div class="panel sheet" role="dialog" aria-labelledby="sheetH"><p class="eyebrow">Leaving the table</p><h2 id="sheetH">Leave for now?</h2>`;
  h+=`<p class="help">The game carries on without you. ${seat?"While you're away, your turns are skipped and the game shows a card for you when you're asked. Come back any time from the hall or your invite link, and tap “I'm back”.":"You can come back to it from the hall any time."}</p>`;
  if(host&&cands.length)h+=`<p class="help">You're hosting. If you're gone for a minute, hosting passes to someone still here, or choose now:</p><div class="actions"><label for="hostTo" class="sr-only">New host</label><select id="hostTo">${cands.map(u=>`<option value="${esc(u)}">${esc(nick(u,g))}${online(u)===false?" (not here now)":""}</option>`).join("")}</select><button class="btn" type="button" data-act="handover">Make them host</button></div>`;
  h+=`<div class="actions"><button class="btn primary" type="button" data-act="gohome">Leave for now</button>${seat&&playing?`<button class="btn ghost sealtext" type="button" data-act="leavegame">Leave this game for good</button>`:""}${host&&playing?`<button class="btn ghost" type="button" data-act="endcase">End the case…</button>`:""}<button class="btn ghost" type="button" data-act="stay">Stay</button></div>`;
  if(S.sheetConfirm)h+=`<p class="warn">Leave for good? Your cards will be laid face up for everyone and you'll be out of the running. <button class="btn sm danger" type="button" data-act="leavegameyes">Yes, leave the game</button></p>`;
  return h+`</div>`;
}
function settingsHTML(){
  const sw=(k,label,help)=>`<label class="sw-row"><span><b>${label}</b><small>${help}</small></span><input type="checkbox" data-set="${k}" ${S[k]?"checked":""}></label>`;
  const name=cleanNick(ls.get("hm.nick"));
  return `<div class="set-in"><h3>Settings</h3>
    ${sw("sound","Sound","A chime when it's your move or someone nudges you.")}
    ${sw("follow","Follow the action","The camera moves to each question. Turn off to keep your own view.")}
    ${sw("saver","Battery saver","Simpler 3D: no shadows or rain, and the board rests when nothing moves.")}
    <div class="set-dev"><b>Carry on from another device</b><small>Open your private link on your phone or another computer to play as ${name?esc(name):"yourself"} there too. Anyone with this link can play as you, so don't post it.</small><div class="actions"><button class="btn sm" type="button" data-act="copyme">Copy my private link</button></div></div>
  </div>`;
}

/* ---------- the 3D manor board ----------
   Six rooms in a ring around the hall, where the sealed envelope lies on a table.
   Each question moves the named relative and method into the named room, the way
   the pieces travel on a mystery board. Purely visual: the game runs without it. */
const Stage=(()=>{
  const THREE_URL="three.min.js";
  const st={ok:false,dead:false,loading:false,host:null,g:null,code:null,key:null,tableKey:null,hadGame:false,
    pickMode:false,picks:{},know:null,focus:{mode:"overview"},t:0,lastDrag:-1e9,tip:"",tipUntil:0,visible:true,
    hover:null,revealKey:null,reveal:null,capHTML:null,tanH:.5,tanV:.32,
    seats:[],lastN:0,turnKey:null,qKey:null,qFly:null,boltAt:-99,nextBolt:4,flash:null,me:null,dec:{},
    follow:true,saver:false,seatHex:null,acc:0,idle:false,poke:0,lastTap:null};
  const poke=()=>{st.poke=performance.now();st.idle=false;};
  const AMB=()=>!REDUCED&&!st.saver;
  const api={onPick:null};
  let T,R,scene,camera,clock,ray,ndc,capEl,ro,io,camT,wantT,tmpA,tmpB,tmpC,right,GREY;
  const pieces={},rooms=[],pickables=[],redraws=[],faces={},labels=[];
  let envGroup,envMat,flapMat,flap,lamp,focusLight,dust,dustPos,waterMat,boat,revealCards=[];
  let hemi,moonL,conf,rain,rainPos;const figs=[],qCards=[],flyers=[],marks=[];
  const cam={az:.95,el:.9,dist:15},want={az:.95,el:.9,dist:15};
  const RIN=2.45,ROUT=6.25,FLOOR=.14,TAU=Math.PI*2,SEAT_R=7.25,TER_Y=-.3;
  const SEAT_HEX=[0xc0424f,0x2f86b3,0xc9971f,0x7a5bb5,0x3a9a68,0xc25a9f,0x4c78a8,0xd97736];
  const easeBack=x=>1+2.70158*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2);
  const ang=i=>(i*60+30)*Math.PI/180;
  const roomIdx=id=>ROOMS.findIndex(r=>r.id===id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),c01=v=>clamp(v,0,1);
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const SUS_COL={philippa:0x8d4b98,rupert:0x3a4058,beatrice:0xd67fa0,desmond:0xd08f2c,imogen:0x2f938b,hollis:0xe9dfc8};
  const LOOK={greenhouse:[0x47684a,"tiles"],cellar:[0x52423e,"flags"],attic:[0x7d5939,"planks"],boathouse:[0x6e533a,"planks"],music:[0x6e2a3b,"carpet"],gallery:[0x4f3f5c,"parquet"]};
  const FELL='"IM Fell English SC","IM Fell English",Georgia,serif',SERIF='"IM Fell English",Georgia,serif',
        SANS='"Alegreya Sans","Gill Sans","Segoe UI",system-ui,sans-serif',EMOJI='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function fail(){st.dead=true;st.ok=false;document.body.classList.add("no3d");}
  function load(){
    if(st.loading||st.ok||st.dead)return;st.loading=true;
    if(window.THREE){init();return;}
    const s=document.createElement("script");s.src=THREE_URL;s.async=true;
    s.onload=()=>init();s.onerror=()=>fail();
    (document.head||document.body).appendChild(s);
  }

  /* ---- drawing helpers ---- */
  function rr(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+W,Y,X+W,Y+H,r);x.arcTo(X+W,Y+H,X,Y+H,r);x.arcTo(X,Y+H,X,Y,r);x.arcTo(X,Y,X+W,Y,r);x.closePath();}
  function canvasTex(w,h,draw,repeat){
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const tex=new T.CanvasTexture(c);
    if(repeat){tex.wrapS=tex.wrapT=T.RepeatWrapping;}
    tex.anisotropy=4;
    const run=()=>{const x=c.getContext("2d");x.clearRect(0,0,w,h);draw(x,w,h);tex.needsUpdate=true;};
    run();redraws.push(run);tex.__redraw=run;return tex;
  }
  function pattern(kind,base){
    return canvasTex(128,128,(x,w,h)=>{
      const c=new T.Color(base),hx=k=>"#"+c.clone().offsetHSL(0,0,k).getHexString();
      x.fillStyle=hx(0);x.fillRect(0,0,w,h);
      if(kind==="tiles"||kind==="parquet"||kind==="checker"){
        const n=4,s=w/n;
        for(let i=0;i<n;i++)for(let j=0;j<n;j++)if((i+j)%2){x.fillStyle=kind==="checker"?"#cdbfa8":hx(kind==="parquet"?.05:-.05);x.fillRect(i*s,j*s,s,s);}
        x.strokeStyle=hx(-.09);x.lineWidth=2;
        for(let i=0;i<=n;i++){x.beginPath();x.moveTo(i*s,0);x.lineTo(i*s,h);x.stroke();x.beginPath();x.moveTo(0,i*s);x.lineTo(w,i*s);x.stroke();}
      }else if(kind==="planks"){
        for(let i=0;i<8;i++){x.fillStyle=hx(((i*5)%3-1)*.03);x.fillRect(0,i*16,w,15);x.fillStyle=hx(-.12);x.fillRect(0,i*16+15,w,1);x.fillRect((i*41)%w,i*16,1.5,15);}
      }else if(kind==="flags"){
        x.fillStyle=hx(-.1);x.fillRect(0,0,w,h);
        for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle=hx(((i*7+j*3)%5-2)*.025);x.fillRect(i*32+1.5,j*32+1.5,29,29);}
      }else if(kind==="carpet"){
        x.strokeStyle=hx(.09);x.lineWidth=3;
        for(let i=-4;i<8;i++){x.beginPath();x.moveTo(i*32,0);x.lineTo(i*32+h,h);x.stroke();x.beginPath();x.moveTo(i*32+h,0);x.lineTo(i*32,h);x.stroke();}
      }
    },true);
  }
  function label(text,opts){
    const box={text,frac:.5};
    const tex=canvasTex(256,64,(x,w,h)=>{
      const text=box.text;if(!text)return;
      x.font=`700 32px ${SANS}`;const tw=Math.min(w-6,x.measureText(text).width+30);box.frac=tw/w;
      rr(x,(w-tw)/2,8,tw,h-16,(h-16)/2);x.fillStyle="rgba(18,12,23,.78)";x.fill();
      x.fillStyle=opts&&opts.gold?"#f0d59a":"#f6eef8";x.textAlign="center";x.textBaseline="middle";x.fillText(text,w/2,h/2+1);
    });
    const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,sizeAttenuation:false}));
    s.scale.set(.2,.05,1);s.renderOrder=5;labels.push(s);s.userData.box=box;s.userData.pri=1;
    s.userData.setText=t=>{if(t!==box.text){box.text=t;tex.__redraw();}};
    return s;
  }
  function emojiTex(icon){
    return canvasTex(128,128,(x)=>{
      const g=x.createRadialGradient(56,52,8,64,64,64);g.addColorStop(0,"#fffaf0");g.addColorStop(1,"#eadcbc");
      x.fillStyle=g;x.beginPath();x.arc(64,64,63,0,TAU);x.fill();
      x.strokeStyle="#9a7330";x.lineWidth=5;x.beginPath();x.arc(64,64,56,0,TAU);x.stroke();
      x.font=`66px ${EMOJI}`;x.textAlign="center";x.textBaseline="middle";x.fillText(icon,64,70);
    });
  }
  function cardFace(id){
    if(faces[id])return faces[id];
    const c=CARD[id],col={s:"#8b2c3a",m:"#2b674b",r:"#2c4b7a"}[c.k];
    return faces[id]=canvasTex(256,356,(x,w,h)=>{
      x.fillStyle="#fbf6ea";x.fillRect(0,0,w,h);
      x.strokeStyle=col;x.lineWidth=4;rr(x,13,13,w-26,h-26,10);x.stroke();
      x.fillStyle=col;x.textAlign="center";x.textBaseline="alphabetic";x.font=`30px ${FELL}`;x.fillText({s:"who",m:"how",r:"where"}[c.k],w/2,58);
      x.font=`104px ${EMOJI}`;x.textBaseline="middle";x.fillText(c.icon,w/2,h/2-2);
      x.textBaseline="alphabetic";x.fillStyle="#2b2125";x.font=`33px ${SERIF}`;
      const words=c.name.split(" ");let lines=[c.name];
      if(x.measureText(c.name).width>w-44&&words.length>1){const k=Math.ceil(words.length/2);lines=[words.slice(0,k).join(" "),words.slice(k).join(" ")];}
      lines.forEach((l,i)=>x.fillText(l,w/2,h-(lines.length-i)*36+4));
    });
  }
  function drawBack(x,w,h){
    x.fillStyle="#3a2342";x.fillRect(0,0,w,h);
    x.strokeStyle="rgba(216,176,96,.35)";x.lineWidth=2;
    for(let i=-h;i<w+h;i+=22){x.beginPath();x.moveTo(i,0);x.lineTo(i+h,h);x.stroke();x.beginPath();x.moveTo(i+h,0);x.lineTo(i,h);x.stroke();}
    x.strokeStyle="#d8b060";x.lineWidth=4;x.strokeRect(11,11,w-22,h-22);
    const g=x.createRadialGradient(w*.45,h*.45,4,w/2,h/2,52);g.addColorStop(0,"#d0646c");g.addColorStop(.6,"#9b2330");g.addColorStop(1,"#5e131b");
    x.fillStyle=g;x.beginPath();x.arc(w/2,h/2,50,0,TAU);x.fill();
    x.fillStyle="#f6d9da";x.font=`58px ${SERIF}`;x.textAlign="center";x.textBaseline="middle";x.fillText("H",w/2,h/2+3);
  }

  /* ---- geometry helpers ---- */
  const polar=(r,a,y=0)=>new T.Vector3(r*Math.cos(a),y,r*Math.sin(a));
  function slab(r0,r1,a0,a1,depth,mat){
    const s=new T.Shape(),P=(r,a)=>[r*Math.cos(a),-r*Math.sin(a)],n=24;
    s.moveTo(...P(r1,a0));
    for(let k=1;k<=n;k++)s.lineTo(...P(r1,a0+(a1-a0)*k/n));
    for(let k=n;k>=0;k--)s.lineTo(...P(r0,a0+(a1-a0)*k/n));
    const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false});
    geo.rotateX(-Math.PI/2);
    const m=new T.Mesh(geo,mat);m.receiveShadow=true;return m;
  }
  const Mat=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:o.r!=null?o.r:.7,metalness:o.m||0,transparent:!!o.t,opacity:o.t||1,side:o.ds?T.DoubleSide:T.FrontSide});
  function add(geo,mat,pos,rot,parent,noShadow){
    const m=new T.Mesh(geo,mat);m.position.copy(pos);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);
    m.castShadow=!noShadow;m.receiveShadow=true;parent.add(m);return m;
  }
  const V=(x,y,z)=>new T.Vector3(x,y,z);

  function props(id,a,grp){
    const P=(r,da,y)=>polar(r,a+da,y);
    if(id==="greenhouse"){
      const pot=Mat(0xa65b3c),leaf=Mat(0x4f8f4c),leaf2=Mat(0x6fa85a);
      [[5.25,-.36],[5.35,.34],[3.0,.42],[3.05,-.43]].forEach(([r,da],k)=>{
        add(new T.CylinderGeometry(.17,.12,.26,14),pot,P(r,da,FLOOR+.13),null,grp);
        if(k%2)add(new T.ConeGeometry(.2,.55,10),leaf2,P(r,da,FLOOR+.53),null,grp);
        else add(new T.SphereGeometry(.27,14,10),leaf,P(r,da,FLOOR+.43),null,grp);
      });
      add(new T.BoxGeometry(1.1,.4,.5),Mat(0xcdeee9,{r:.08,t:.32}),P(5.6,0,FLOOR+.2),[0,-a+Math.PI/2,0],grp,true);
      add(new T.BoxGeometry(1.12,.03,.52),Mat(0x6a5a3a),P(5.6,0,FLOOR+.41),[0,-a+Math.PI/2,0],grp);
    }else if(id==="cellar"){
      const oak=Mat(0x74492a),hoop=Mat(0x2b2b2b,{m:.6,r:.4});
      [[5.15,-.36],[5.15,.36]].forEach(([r,da])=>{
        const b=new T.Group();b.position.copy(P(r,da,FLOOR+.27));b.rotation.y=-(a+da);grp.add(b);
        add(new T.CylinderGeometry(.27,.27,.62,18),oak,V(0,0,0),[0,0,Math.PI/2],b);
        [-.2,.2].forEach(x=>add(new T.TorusGeometry(.275,.022,6,20),hoop,V(x,0,0),[0,Math.PI/2,0],b));
      });
      add(new T.BoxGeometry(1.05,.78,.28),Mat(0x3a2420),P(5.8,0,FLOOR+.39),[0,-a+Math.PI/2,0],grp);
      const glass=Mat(0x1f4a2c,{r:.2,m:.3});
      [-.13,-.045,.045,.13].forEach((da,k)=>[.22,.5].forEach((y,j)=>{if(!(k===2&&j===1))add(new T.SphereGeometry(.055,10,8),glass,P(5.64,da,FLOOR+y),null,grp,true);}));
      add(new T.CylinderGeometry(.06,.06,.3,10),glass,P(3.1,.42,FLOOR+.06),[Math.PI/2,0,.7],grp);
    }else if(id==="attic"){
      const trunk=Mat(0x6a3d22),band=Mat(0xb08a3a,{m:.6,r:.35});
      [[5.3,-.33,.2],[5.2,.3,-.25]].forEach(([r,da,rot])=>{
        const t=new T.Group();t.position.copy(P(r,da,FLOOR));t.rotation.y=-(a+da)+Math.PI/2+rot;grp.add(t);
        add(new T.BoxGeometry(.7,.36,.44),trunk,V(0,.18,0),null,t);
        add(new T.CylinderGeometry(.22,.22,.7,16,1,false,0,Math.PI),trunk,V(0,.36,0),[0,0,Math.PI/2],t);
        [-.22,.22].forEach(x=>add(new T.BoxGeometry(.05,.62,.46),band,V(x,.3,0),null,t));
      });
      const paper=Mat(0xf2ead8);
      for(let k=0;k<4;k++)add(new T.BoxGeometry(.22,.012,.15),paper,P(3.05,.4-k*.05,FLOOR+.008+k*.013),[0,k*.6,0],grp,true);
      add(new T.CylinderGeometry(.05,.05,1.0,8),Mat(0x5a3a26),P(5.75,0,FLOOR+.5),null,grp);
      add(new T.SphereGeometry(.17,12,10),Mat(0x8a7a6a),P(5.75,0,FLOOR+1.08),null,grp).scale.set(1,1.3,.8);
    }else if(id==="boathouse"){
      boat=new T.Group();boat.position.copy(P(5.3,0,.1));boat.rotation.y=-a+Math.PI/2;grp.add(boat);
      const hull=add(new T.SphereGeometry(1,22,10,0,TAU,Math.PI/2,Math.PI/2),Mat(0x8a5631,{ds:true}),V(0,0,0),null,boat);
      hull.scale.set(.82,.27,.32);
      add(new T.BoxGeometry(.06,.03,.6),Mat(0x5a3a22),V(0,-.03,0),null,boat);
      add(new T.BoxGeometry(1.1,.025,.05),Mat(0xc7a46a),V(.1,.02,.18),[0,.25,.05],boat);
      [-.38,.38].forEach(da=>add(new T.CylinderGeometry(.06,.07,.7,10),Mat(0x4a3322),P(4.42,da,FLOOR+.3),null,grp));
    }else if(id==="music"){
      const black=Mat(0x17131b,{r:.25,m:.2}),ivory=Mat(0xf3ecdc);
      const pg=new T.Group();pg.position.copy(P(5.3,-.1,FLOOR));pg.rotation.y=-(a-.1)+Math.PI/2;grp.add(pg);
      add(new T.BoxGeometry(1.15,.28,.72),black,V(0,.62,0),null,pg);
      add(new T.BoxGeometry(1.15,.025,.72),black,V(0,.93,.1),[-.5,0,0],pg);
      add(new T.BoxGeometry(1.0,.05,.17),ivory,V(0,.6,-.44),null,pg);
      [[-.48,-.26],[.48,-.26],[0,.28]].forEach(([x,z])=>add(new T.CylinderGeometry(.045,.045,.48,8),black,V(x,.24,z),null,pg));
      add(new T.CylinderGeometry(.17,.17,.08,16),Mat(0x6e2a3b),V(0,.44,-.82),null,pg);
      add(new T.CylinderGeometry(.04,.04,.42,8),black,V(0,.21,-.82),null,pg);
      add(new T.BoxGeometry(.3,.01,.2),ivory,V(-.25,.77,-.15),[0,.2,0],pg,true);
    }else if(id==="gallery"){
      const gold=Mat(0xb08a3a,{m:.55,r:.35}),legW=Mat(0x5a3a26);
      const cols=[0x2f4a3a,0x6a2433,0x24385a];
      [-.36,0,.36].forEach((da,k)=>{
        const e=new T.Group();e.position.copy(P(5.4+(k===1?.2:0),da,FLOOR));grp.add(e);e.lookAt(0,FLOOR,0);
        [-.2,.2].forEach(x=>add(new T.BoxGeometry(.04,.95,.04),legW,V(x,.45,-.06),[.1,0,0],e));
        add(new T.BoxGeometry(.04,.9,.04),legW,V(0,.42,-.26),[-.3,0,0],e);
        const f=new T.Group();f.position.set(0,.8,0);f.rotation.x=-.12;if(k===1)f.rotation.z=.26;e.add(f);
        add(new T.BoxGeometry(.58,.72,.05),gold,V(0,0,0),null,f);
        add(new T.BoxGeometry(.45,.58,.056),Mat(cols[k],{r:.9}),V(0,0,.004),null,f);
        add(new T.SphereGeometry(.085,10,8),Mat(0xd9b99a),V(0,.06,.034),null,f,true).scale.set(1,1.25,.25);
      });
    }
  }

  function build(){
    R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.setClearColor(0x000000,0);
    scene=new T.Scene();scene.fog=new T.Fog(0x1a1120,20,38);
    camera=new T.PerspectiveCamera(36,1.6,.1,90);
    clock=new T.Clock();ray=new T.Raycaster();ndc=new T.Vector2();
    camT=V(0,.3,0);wantT=V(0,.3,0);tmpA=V(0,0,0);tmpB=V(0,0,0);tmpC=V(0,0,0);right=V(1,0,0);GREY=new T.Color(0x6d6672);

    hemi=new T.HemisphereLight(0xb3bcec,0x2b1a30,.66);scene.add(hemi);
    const moon=moonL=new T.DirectionalLight(0xdfe3ff,.6);moon.position.set(-7,13,6);moon.castShadow=true;
    moon.shadow.mapSize.set(1024,1024);Object.assign(moon.shadow.camera,{left:-9.5,right:9.5,top:9.5,bottom:-9.5,near:1,far:42});moon.shadow.bias=-.0015;
    scene.add(moon);
    lamp=new T.PointLight(0xffc27a,1.1,11,1.5);lamp.position.set(0,3.4,0);scene.add(lamp);
    focusLight=new T.PointLight(0xffd391,0,7.5,1.4);focusLight.position.set(0,2.6,0);scene.add(focusLight);

    // plinth and brass rim
    add(new T.CylinderGeometry(ROUT+.25,ROUT+.5,.55,80),Mat(0x2a1d30,{r:.6}),V(0,-.275,0),null,scene,true);
    add(new T.TorusGeometry(ROUT+.26,.05,8,96),Mat(0xb08a3a,{m:.6,r:.35}),V(0,0,0),[Math.PI/2,0,0],scene,true);
    // the terrace where the detectives stand
    const terTex=pattern("planks",0x3b2b26);terTex.repeat.set(4,4);
    const ter=new T.Mesh(new T.CylinderGeometry(8.15,8.4,.34,96),[Mat(0x22171d,{r:.7}),new T.MeshStandardMaterial({map:terTex,roughness:.85}),Mat(0x22171d)]);
    ter.position.y=TER_Y-.17;ter.receiveShadow=true;scene.add(ter);
    add(new T.TorusGeometry(8.16,.045,8,128),Mat(0xb08a3a,{m:.6,r:.35}),V(0,TER_Y,0),[Math.PI/2,0,0],scene,true);

    // the hall: checkered floor, table, envelope
    add(new T.CylinderGeometry(RIN-.02,RIN-.02,FLOOR,72),Mat(0x2c2230),V(0,FLOOR/2,0),null,scene,true);
    const ht=pattern("checker",0x33263a);ht.repeat.set(3,3);
    const hall=new T.Mesh(new T.CircleGeometry(RIN-.02,72),new T.MeshStandardMaterial({map:ht,roughness:.55}));
    hall.rotation.x=-Math.PI/2;hall.position.y=FLOOR+.002;hall.receiveShadow=true;
    hall.userData.info="<b>The hall</b>The sealed envelope on the table holds the answer: who, how and where.";
    scene.add(hall);pickables.push(hall);
    const wood=Mat(0x4a2f22,{r:.55});
    add(new T.CylinderGeometry(.95,.95,.07,48),wood,V(0,FLOOR+.62,0),null,scene);
    add(new T.CylinderGeometry(.11,.3,.6,20),wood,V(0,FLOOR+.3,0),null,scene);
    envGroup=new T.Group();envGroup.position.y=FLOOR+.655;scene.add(envGroup);
    envMat=new T.MeshStandardMaterial({color:0xefe2c2,roughness:.75,emissive:0xffc766,emissiveIntensity:0});
    const envBody=add(new T.BoxGeometry(1.0,.035,.68),envMat,V(0,.018,0),null,envGroup);
    envBody.userData.info="<b>The envelope</b>Sealed at the deal. Nobody sees inside until someone accuses.";pickables.push(envBody);
    flap=new T.Group();flap.position.set(0,.037,-.34);envGroup.add(flap);
    const tri=new T.Shape();tri.moveTo(-.5,0);tri.lineTo(.5,0);tri.lineTo(0,.44);tri.closePath();
    const fg=new T.ShapeGeometry(tri);fg.rotateX(Math.PI/2);
    flapMat=new T.MeshStandardMaterial({color:0xe3d2aa,roughness:.8,side:T.DoubleSide,emissive:0xffc766,emissiveIntensity:0});
    const fm=new T.Mesh(fg,flapMat);fm.castShadow=true;flap.add(fm);
    add(new T.CylinderGeometry(.085,.085,.03,24),Mat(0x9b2330,{r:.4}),V(0,.015,.3),null,flap);

    // rooms
    const wallPaper=0x76607c,trim=Mat(0x3b2a2c,{r:.6});
    ROOMS.forEach((rm,i)=>{
      const a=ang(i),a0=a-Math.PI/6,a1=a+Math.PI/6,[col,pat]=LOOK[rm.id];
      const tex=pattern(pat,col);tex.repeat.set(.45,.45);
      const mat=new T.MeshStandardMaterial({map:tex,roughness:.88,emissive:0xffb347,emissiveIntensity:0});
      const floor=slab(RIN,rm.id==="boathouse"?4.35:ROUT,a0+.004,a1-.004,FLOOR,mat);
      floor.userData.pick={k:"r",id:rm.id};scene.add(floor);pickables.push(floor);
      if(rm.id==="boathouse"){
        waterMat=new T.MeshStandardMaterial({color:0x2a5a7c,roughness:.2,metalness:.15,emissive:0x163a55,emissiveIntensity:.3,transparent:true,opacity:.92});
        const w=slab(4.35,ROUT,a0+.004,a1-.004,.07,waterMat);w.userData.pick={k:"r",id:rm.id};scene.add(w);pickables.push(w);
      }
      const wallMat=new T.MeshStandardMaterial({color:wallPaper,roughness:.9,side:T.DoubleSide,transparent:true,opacity:1});
      const wall=new T.Mesh(new T.CylinderGeometry(ROUT,ROUT,.8,24,1,true,Math.PI/2-a1,a1-a0),wallMat);
      wall.position.y=.4;wall.receiveShadow=true;scene.add(wall);
      const dv=add(new T.BoxGeometry(ROUT-RIN+.1,.5,.08),trim,polar((RIN+ROUT)/2,a0,.25),null,scene);dv.rotation.y=-a0;
      // brass name plaque on the floor, reading from outside the room
      const ptex=canvasTex(512,96,(x,w,h)=>{
        rr(x,4,8,w-8,h-16,14);x.fillStyle="rgba(24,16,28,.9)";x.fill();x.strokeStyle="#c9a35a";x.lineWidth=4;x.stroke();
        x.font=`44px ${FELL}`;const name=rm.name.toLowerCase(),tw=x.measureText(name).width,sx=(w-tw-56)/2;
        x.textBaseline="middle";x.textAlign="left";x.fillStyle="#ecd39a";x.fillText(name,sx+56,h/2+2);
        x.font=`38px ${EMOJI}`;x.textAlign="center";x.fillText(rm.icon,sx+22,h/2+3);
      });
      const pmat=new T.MeshBasicMaterial({map:ptex,transparent:true,depthWrite:false});
      const pg=new T.Group();pg.position.copy(polar(2.9,a,FLOOR+.012));pg.rotation.y=Math.PI/2-a;scene.add(pg);
      const pl=new T.Mesh(new T.PlaneGeometry(1.75,.33),pmat);pl.rotation.x=-Math.PI/2;pl.userData.pick={k:"r",id:rm.id};pg.add(pl);pickables.push(pl);
      const grp=new T.Group();scene.add(grp);props(rm.id,a,grp);
      rooms.push({i,id:rm.id,a,mat,wallMat,pmat});
    });

    // the family: pawns
    const PAWN=[[0,0],[.27,0],[.27,.05],[.22,.09],[.14,.14],[.1,.42],[.17,.47],[.17,.52],[.09,.56],[0,.57]].map(p=>new T.Vector2(p[0],p[1]));
    const pawnGeo=new T.LatheGeometry(PAWN,28),headGeo=new T.SphereGeometry(.14,20,14),haloGeo=new T.RingGeometry(.31,.42,40);
    const haloMat=new T.MeshBasicMaterial({color:0xffcf6b,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide});
    SUSPECTS.forEach((s,i)=>{
      const g=new T.Group();
      const mat=new T.MeshStandardMaterial({color:SUS_COL[s.id],roughness:.4,metalness:.15,emissive:0xffbf55,emissiveIntensity:0});
      const body=new T.Mesh(pawnGeo,mat),head=new T.Mesh(headGeo,mat);head.position.y=.69;
      body.castShadow=head.castShadow=true;
      const halo=new T.Mesh(haloGeo,haloMat.clone());halo.rotation.x=-Math.PI/2;halo.position.y=.015;halo.visible=false;
      const lab=label(s.short);lab.position.y=1.1;
      g.add(body,head,halo,lab);scene.add(g);
      body.userData.pick=head.userData.pick={k:"s",id:s.id};pickables.push(body,head);
      pieces[s.id]={g,mat,base:new T.Color(SUS_COL[s.id]),halo,lab,kind:"s",idx:i,to:null,anim:null,glow:0};
    });
    // the methods: floating brass medallions
    const coinGeo=new T.CylinderGeometry(.3,.3,.07,36),faceGeo=new T.CircleGeometry(.27,36);
    METHODS.forEach((m,i)=>{
      const g=new T.Group(),inner=new T.Group();g.add(inner);inner.position.y=.55;
      const brass=new T.MeshStandardMaterial({color:0xb88c3c,roughness:.35,metalness:.55,emissive:0xffbf55,emissiveIntensity:0});
      const face=new T.MeshStandardMaterial({map:emojiTex(m.icon),roughness:.6});
      const coin=new T.Mesh(coinGeo,brass);coin.rotation.x=Math.PI/2;coin.castShadow=true;
      const f1=new T.Mesh(faceGeo,face);f1.position.z=.037;
      const f2=new T.Mesh(faceGeo,face);f2.position.z=-.037;f2.rotation.y=Math.PI;
      inner.add(coin,f1,f2);
      const halo=new T.Mesh(haloGeo,haloMat.clone());halo.rotation.x=-Math.PI/2;halo.position.y=.015;halo.visible=false;
      const lab=label(m.short);lab.position.y=1.05;lab.visible=false;
      g.add(halo,lab);scene.add(g);
      [coin,f1,f2].forEach(o=>{o.userData.pick={k:"m",id:m.id};pickables.push(o);});
      pieces[m.id]={g,inner,mat:brass,face,base:new T.Color(0xb88c3c),halo,lab,kind:"m",idx:i,to:null,anim:null,glow:0};
    });

    // the three cards that rise out of the envelope at the end
    const backTex=canvasTex(256,356,drawBack),edge=Mat(0xf3ead2);
    for(let k=0;k<3;k++){
      const front=new T.MeshStandardMaterial({map:backTex,roughness:.7}),back=new T.MeshStandardMaterial({map:backTex,roughness:.7});
      const c=new T.Mesh(new T.BoxGeometry(.62,.86,.012),[edge,edge,edge,edge,front,back]);c.visible=false;c.castShadow=true;
      scene.add(c);revealCards.push(c);
    }
    // the question cards that float over a room, and cards flying between detectives
    const cardGeo=new T.BoxGeometry(.62,.86,.012);
    const mkCard=()=>{const c=new T.Mesh(cardGeo,[edge,edge,edge,edge,new T.MeshStandardMaterial({map:backTex,roughness:.7}),new T.MeshStandardMaterial({map:backTex,roughness:.7})]);c.visible=false;c.castShadow=true;scene.add(c);return c;};
    for(let k=0;k<3;k++)qCards.push(mkCard());
    for(let k=0;k<3;k++)flyers.push({c:mkCard(),on:false});
    st.backTex=backTex;

    // detectives: one figure per seat, plus Fennimore the butler
    const coatGeo=new T.LatheGeometry([[0,0],[.3,0],[.3,.04],[.26,.3],[.2,.62],[.13,.76],[.15,.8],[0,.82]].map(p=>new T.Vector2(p[0],p[1])),24);
    const headGeo2=new T.SphereGeometry(.15,18,14),brimGeo=new T.CylinderGeometry(.25,.25,.03,24),crownGeo=new T.CylinderGeometry(.15,.16,.2,20);
    const ringGeo=new T.RingGeometry(.42,.56,40),beamGeo=new T.ConeGeometry(.62,4.2,28,1,true);
    const skin=Mat(0xe3c09d,{r:.6}),hatM=Mat(0x221a26,{r:.45}),brassM=Mat(0xc49a45,{m:.6,r:.3}),
          glassM=new T.MeshStandardMaterial({color:0xcfe8ff,transparent:true,opacity:.45,roughness:.05,metalness:.2});
    for(let j=0;j<7;j++){
      const g=new T.Group(),body=new T.Group();g.add(body);
      const coat=new T.MeshStandardMaterial({color:0x888888,roughness:.6,emissive:0xffc766,emissiveIntensity:0});
      const m1=new T.Mesh(coatGeo,coat),head=new T.Mesh(headGeo2,skin);head.position.y=.97;
      const brim=new T.Mesh(brimGeo,hatM);brim.position.y=1.09;
      const crown=new T.Mesh(crownGeo,hatM);crown.position.y=1.2;
      [m1,head,brim,crown].forEach(o=>{o.castShadow=true;o.userData.fig=j;pickables.push(o);});
      body.add(m1,head,brim,crown);
      const mag=new T.Group();mag.position.set(.29,.5,.1);mag.rotation.z=-.5;
      const handle=new T.Mesh(new T.CylinderGeometry(.018,.018,.22,8),Mat(0x3a2418));handle.position.y=-.11;
      const rim=new T.Mesh(new T.TorusGeometry(.085,.017,8,24),brassM);rim.position.y=.08;
      const lens=new T.Mesh(new T.CircleGeometry(.08,20),glassM);lens.position.y=.08;
      mag.add(handle,rim,lens);body.add(mag);
      const shirt=new T.Mesh(new T.BoxGeometry(.13,.22,.02),Mat(0xf2ede4));shirt.position.set(0,.6,.215);shirt.rotation.x=-.22;
      const tie=new T.Mesh(new T.BoxGeometry(.13,.045,.03),Mat(0x111111));tie.position.set(0,.73,.18);
      body.add(shirt,tie);
      const ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xffcf6b,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));
      ring.rotation.x=-Math.PI/2;ring.position.y=.02;g.add(ring);
      const beam=new T.Mesh(beamGeo,new T.MeshBasicMaterial({color:0xffd391,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
      beam.position.y=2.1;beam.scale.set(1.3,1,1.3);g.add(beam);
      body.scale.setScalar(1.35);ring.scale.setScalar(1.35);
      const lab=label("",{gold:true});lab.position.y=2.12;g.add(lab);
      g.visible=false;scene.add(g);
      figs.push({g,body,coat,mag,shirt,tie,ring,beam,lab,u:null,seat:null,popT0:-9,fall:0,glow:0});
    }

    // a red cross that pops over someone who couldn't show a card
    const xTex=canvasTex(128,128,x=>{x.fillStyle="rgba(155,35,48,.92)";x.beginPath();x.arc(64,64,58,0,TAU);x.fill();
      x.strokeStyle="#f6d9da";x.lineWidth=12;x.lineCap="round";x.beginPath();x.moveTo(42,42);x.lineTo(86,86);x.moveTo(86,42);x.lineTo(42,86);x.stroke();});
    for(let k=0;k<6;k++){const sp=new T.Sprite(new T.SpriteMaterial({map:xTex,transparent:true,depthWrite:false,opacity:0}));sp.visible=false;scene.add(sp);marks.push({s:sp,t0:-9,pos:V(0,0,0)});}

    // confetti for the winner
    const CN=200,cp=new Float32Array(CN*3),cc=new Float32Array(CN*3);
    const pal=[0xc0424f,0x2f86b3,0xe0b24a,0x7a5bb5,0x3a9a68,0xf2ede4];
    for(let i=0;i<CN;i++){const c=new T.Color(pal[i%pal.length]);cc[i*3]=c.r;cc[i*3+1]=c.g;cc[i*3+2]=c.b;cp[i*3+1]=-50;}
    const cg=new T.BufferGeometry();cg.setAttribute("position",new T.BufferAttribute(cp,3));cg.setAttribute("color",new T.BufferAttribute(cc,3));
    conf={pts:new T.Points(cg,new T.PointsMaterial({size:.14,vertexColors:true,transparent:true,opacity:1,depthWrite:false})),pos:cp,vel:new Float32Array(CN*3),t0:-99,n:CN};
    conf.pts.visible=false;conf.pts.frustumCulled=false;scene.add(conf.pts);

    // the storm outside: rain beyond the terrace and a moon behind the clouds
    const RN=380;rainPos=new Float32Array(RN*6);
    for(let i=0;i<RN;i++){const r=8.9+Math.random()*7,a=Math.random()*TAU,y=Math.random()*12-1,x=r*Math.cos(a),z=r*Math.sin(a);rainPos.set([x,y,z,x-.04,y-.45,z],i*6);}
    const rg=new T.BufferGeometry();rg.setAttribute("position",new T.BufferAttribute(rainPos,3));
    rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0xa8b8dc,transparent:true,opacity:.3,depthWrite:false}));
    rain.frustumCulled=false;rain.visible=!REDUCED;scene.add(rain);
    const mTex=canvasTex(128,128,x=>{const g=x.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,"rgba(255,250,235,1)");g.addColorStop(.2,"rgba(242,238,222,.95)");g.addColorStop(.28,"rgba(200,200,255,.28)");g.addColorStop(1,"rgba(160,160,255,0)");x.fillStyle=g;x.fillRect(0,0,128,128);});
    const moonS=new T.Sprite(new T.SpriteMaterial({map:mTex,transparent:true,depthWrite:false,fog:false}));moonS.position.set(-24,15,-26);moonS.scale.set(7,7,1);scene.add(moonS);

    // drifting dust in the lamplight
    const N=150;dustPos=new Float32Array(N*3);
    for(let i=0;i<N;i++){const r=Math.sqrt(Math.random())*6.2,a=Math.random()*TAU;dustPos[i*3]=r*Math.cos(a);dustPos[i*3+1]=Math.random()*3.6;dustPos[i*3+2]=r*Math.sin(a);}
    const dg=new T.BufferGeometry();dg.setAttribute("position",new T.BufferAttribute(dustPos,3));
    dust=new T.Points(dg,new T.PointsMaterial({color:0xffe0a8,size:.045,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));
    scene.add(dust);

    capEl=document.createElement("div");capEl.className="stage-cap";capEl.innerHTML="<span></span>";
    bindPointer(R.domElement);
    R.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();fail();});
  }

  function applySaver(){
    if(!st.ok)return;
    R.shadowMap.enabled=!st.saver;
    scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.needsUpdate=true;});});
    rain.visible=AMB();dust.visible=AMB();
    R.setPixelRatio(Math.min(window.devicePixelRatio||1,st.saver?1.5:2));resize();poke();
  }
  function init(){
    try{
      T=window.THREE;if(!T)return fail();
      R=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
      if(!R.getContext())return fail();
      R.domElement.setAttribute("aria-hidden","true");
      build();
    }catch(e){console.error(e);return fail();}
    st.ok=true;applySaver();
    if(!REDUCED){cam.az=want.az-1.7;cam.el=1.42;cam.dist=44;}
    const h=st.host;st.host=null;mount(h);
    st.key=null;sync(st.g,st.code);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>redraws.forEach(f=>f())).catch(()=>{});
    setTimeout(()=>redraws.forEach(f=>f()),3000);
    requestAnimationFrame(loop);
  }

  /* ---- pointer: drag to turn, tap to pick ---- */
  function hitsAt(e){
    const r=R.domElement.getBoundingClientRect();
    ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc,camera);
    const out=[],seen=new Set();
    for(const h of ray.intersectObjects(pickables,false)){
      const u=h.object.userData;
      if(u.fig!=null){let o=h.object,vis=true;while(o){if(!o.visible){vis=false;break;}o=o.parent;}if(!vis)continue;}
      const key=u.pick?u.pick.id:u.fig!=null?"fig"+u.fig:u.info;
      if(!(u.pick||u.info||u.fig!=null)||seen.has(key))continue;
      seen.add(key);out.push(u);
    }
    return out;
  }
  function hitAt(e){
    const r=R.domElement.getBoundingClientRect();
    ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc,camera);
    for(const h of ray.intersectObjects(pickables,false)){
      const u=h.object.userData;
      if(u.fig!=null){let o=h.object,vis=true;while(o){if(!o.visible){vis=false;break;}o=o.parent;}if(!vis)continue;}
      if(u.pick||u.info||u.fig!=null)return u;
    }
    return null;
  }
  function bindPointer(cv){
    let drag=null,lastHover=0;
    cv.addEventListener("pointerdown",e=>{poke();drag={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,type:e.pointerType};});
    cv.addEventListener("pointermove",e=>{
      if(drag&&e.pointerId===drag.id){
        const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
        if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;try{cv.setPointerCapture(e.pointerId);}catch(_){}}
        if(drag.moved){
          poke();want.az+=dx*.0085;
          if(drag.type==="mouse")want.el=clamp(want.el+dy*.006,.3,1.3);
          drag.x=e.clientX;drag.y=e.clientY;st.lastDrag=performance.now();
        }
      }else if(e.pointerType==="mouse"&&performance.now()-lastHover>60){
        lastHover=performance.now();
        const u=hitAt(e);const id=u&&u.pick?u.pick.id:null;
        cv.classList.toggle("pointing",!!u);if(st.hover!==id)poke();st.hover=id;
      }
    });
    cv.addEventListener("pointerup",e=>{if(drag&&e.pointerId===drag.id){if(!drag.moved)tap(e);drag=null;}});
    cv.addEventListener("pointercancel",()=>{drag=null;});
    cv.addEventListener("pointerleave",()=>{st.hover=null;cv.classList.remove("pointing");});
  }
  function tap(e){
    poke();
    const hits=hitsAt(e).filter(x=>x.pick||x.fig!=null||x.info);if(!hits.length)return;
    let u=hits[0];
    const lt=st.lastTap,now=performance.now();
    /* tapping the same spot again picks the next piece behind it */
    if(lt&&now-lt.t<2500&&Math.hypot(e.clientX-lt.x,e.clientY-lt.y)<16){
      const i=hits.findIndex(x=>x===lt.u||(x.pick&&lt.u.pick&&x.pick.id===lt.u.pick.id));
      if(i>=0)u=hits[(i+1)%hits.length];
    }
    st.lastTap={t:now,x:e.clientX,y:e.clientY,u};
    if(u.info){tip(u.info);return;}
    if(u.fig!=null){const fg=figs[u.fig];if(fg&&fg.seat)tip(figInfo(fg));return;}
    const c=CARD[u.pick.id];if(!c)return;
    if(st.pickMode&&api.onPick){
      api.onPick(u.pick.k,u.pick.id);
      const on=st.picks[u.pick.k]===u.pick.id;
      tip(`<b>${esc(c.name)}</b>${on?"is in your question.":"is out of your question."}`);
    }else tip(`<b>${esc(c.name)}</b>${esc(c.note)}`);
  }
  function figInfo(fg){
    const g=st.g,sv=fg.seat;if(!g)return "";
    const name=sv.butler?"Fennimore":nick(sv.u,g);
    let line=sv.butler?"The butler holds a hand when only two detectives play.":sv.bot?`Computer detective, ${g.players[sv.u].bot}.`:sv.u===st.me?"That's you.":"Detective.";
    const n=g.handSize&&g.handSize[sv.u];if(n!=null)line+=` ${n} cards.`;
    if(g.out&&g.out[sv.u])line+=" Out of the running.";
    return `<b>${esc(name)}</b>${esc(line)}`;
  }
  function tip(html){poke();st.tip=html;st.tipUntil=performance.now()+5200;updateCap();}
  function hint(){
    const g=st.g,f=st.focus;
    if(st.pickMode)return "Tap a relative, a method and a room to build your question.";
    if(f.mode==="room"&&f.asked){const [s,m,r]=f.asked.map(id=>CARD[id]);return `<b>${esc(r.name)}</b>Was it ${esc(s.short)}, with the ${esc(m.name)}?`;}
    if(f.mode==="envelope")return "<b>Accusation</b>Opening the envelope…";
    if(f.mode==="reveal"){const [s,m,r]=f.sol.map(id=>CARD[id]);return `<b>Solved</b>${esc(s.name)}, with the ${esc(m.name)}, in the ${esc(r.name)}.`;}
    if(g&&g.status==="playing"&&st.know&&ALL.some(id=>st.know[id]==="env"))return "Gold rings mark what your notebook proves is in the envelope.";
    return st.seats.length?"Drag to turn the manor. Tap a detective or a piece for details.":"Drag to turn the manor. Tap a piece to meet the family.";
  }
  /* labels that would overlap on screen give way to the more important one:
     pieces in the question first, then the detectives, then the rest, nearest first */
  let dcV=null;
  function declutter(){
    if(!st.vw||!st.lpx)return;
    if(!dcV)dcV=new T.Vector3();
    figs.forEach(x=>{x.lab.visible=true;});
    const L=st.lpx,cand=[];
    for(const l of labels){
      if(!l.visible||!l.userData.box||!l.userData.box.text)continue;
      let o=l.parent,shown=true;while(o){if(!o.visible){shown=false;break;}o=o.parent;}
      if(!shown)continue;
      l.getWorldPosition(dcV);dcV.project(camera);
      if(dcV.z>1||dcV.z<-1)continue;
      cand.push({l,x:(dcV.x+1)/2*st.vw,y:(1-dcV.y)/2*st.vh,z:dcV.z,pr:l.userData.pri||1});
    }
    cand.sort((a,b)=>b.pr-a.pr||a.z-b.z);
    const placed=[];
    for(const c of cand){
      const hw=c.l.userData.box.frac*L*2+1,hh=L*.375+1;
      const r=[c.x-hw,c.x+hw,c.y-hh,c.y+hh];
      if(placed.some(p=>p[0]<r[1]&&r[0]<p[1]&&p[2]<r[3]&&r[2]<p[3]))c.l.visible=false;
      else placed.push(r);
    }
  }
  function updateCap(){
    if(!capEl)return;
    const html=st.tip&&performance.now()<st.tipUntil?st.tip:hint();
    if(html!==st.capHTML){st.capHTML=html;capEl.firstChild.innerHTML=html;}
  }

  function mount(host){
    if(!host)return;
    if(!st.ok){st.host=host;return;}
    if(st.host===host&&host.contains(R.domElement))return;
    st.host=host;
    host.appendChild(R.domElement);host.appendChild(capEl);host.classList.add("ready");
    if(ro)ro.disconnect();if(io)io.disconnect();
    if(window.ResizeObserver){ro=new ResizeObserver(resize);ro.observe(host);}
    if(window.IntersectionObserver){io=new IntersectionObserver(es=>{st.visible=es[es.length-1].isIntersecting;});io.observe(host);}
    resize();
  }
  function resize(){
    const h=st.host;if(!h||!R)return;
    const w=h.clientWidth,hh=h.clientHeight;if(!w||!hh)return;
    R.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix();
    st.tanV=Math.tan(camera.fov*Math.PI/360);st.tanH=st.tanV*camera.aspect;st.aspect=camera.aspect;
    st.lpx=clamp(24,20,hh*.09);st.vw=w;st.vh=hh;
    const lh=st.lpx/hh*2*st.tanV;labels.forEach(l=>l.scale.set(lh*4,lh,1));
  }

  /* ---- game state -> board ---- */
  function layout(locS,locM){
    const out={},by=Array.from({length:6},()=>({s:[],m:[]}));
    SUSPECTS.forEach((s,i)=>{const r=locS[s.id];if(r==null)out[s.id]=polar(1.62,ang(i),FLOOR);else by[r].s.push(s.id);});
    METHODS.forEach(m=>by[locM[m.id]].m.push(m.id));
    by.forEach((b,ri)=>{
      const a=ang(ri);
      const place=(ids,r,sp)=>ids.forEach((id,j)=>{const t=(j-(ids.length-1)/2)*sp;out[id]=V(r*Math.cos(a)-t*Math.sin(a),FLOOR,r*Math.sin(a)+t*Math.cos(a));});
      place(b.s,3.55,.6);place(b.m,4.5,.72);
    });
    return out;
  }
  function near(a){const d=((a-want.az)%TAU+TAU*1.5)%TAU-Math.PI;return want.az+d;}
  function setFocus(f){
    const p=st.focus;st.focus=f;
    if(!st.follow)return;
    if(f.mode==="room"&&!(p.mode==="room"&&p.room===f.room)){want.az=near(ang(f.room));want.el=.74;}
    else if(f.mode!==p.mode){want.el={overview:(st.aspect||1.5)<1?1.06:.9,envelope:.62,reveal:.44,room:.78}[f.mode];}
  }
  function sync(g,code){
    st.g=g;st.code=code;
    if(!st.ok)return;
    const tk=code||"home";
    const key=`${tk}|${g?g.rev:0}|${g?g.status:""}|${g?g.phase:""}|${g&&g.solution?1:0}|${g&&g.players?Object.keys(g.players).filter(u=>g.players[u]).length:0}|${st.me}`;
    if(key===st.key){updateCap();return;}
    st.key=key;
    const fresh=st.tableKey!==tk||!st.hadGame;
    const animate=!REDUCED&&!fresh;
    st.tableKey=tk;st.hadGame=!!g||tk==="home";
    const locS={},locM={};
    METHODS.forEach((m,i)=>{locM[m.id]=i;});
    const live=g&&(g.status==="playing"||g.status==="over");
    if(live)for(const e of g.log||[])if(e.t==="ask"&&e.c&&roomIdx(e.c[2])>=0&&pieces[e.c[0]]&&pieces[e.c[1]]){locS[e.c[0]]=roomIdx(e.c[2]);locM[e.c[1]]=roomIdx(e.c[2]);}
    if(g&&g.status==="over"&&g.solution){locS[g.solution[0]]=roomIdx(g.solution[2]);locM[g.solution[1]]=roomIdx(g.solution[2]);}
    const L=layout(locS,locM);let ns=0,nm=0;
    for(const id in L){
      const pc=pieces[id],to=L[id];
      if(pc.to&&pc.to.distanceTo(to)<.01)continue;
      if(!animate||!pc.to){pc.g.position.copy(to);pc.anim=null;}
      else pc.anim={from:pc.g.position.clone(),t0:st.t+(pc.kind==="s"?ns++*.15:.3+nm++*.15),dur:1.1,hop:.8+.3*pc.g.position.distanceTo(to)/6};
      pc.to=to;
    }
    let f={mode:"overview"};
    if(g&&g.status==="playing"){
      if((g.phase==="asking"||g.phase==="asked")&&g.q)f={mode:"room",room:roomIdx(g.q.cards[2]),asked:g.q.cards};
      else if(g.phase==="judging")f={mode:"envelope",asked:g.acc?g.acc.cards:[]};
    }else if(g&&g.status==="over"&&g.solution)f={mode:"reveal",sol:g.solution,room:roomIdx(g.solution[2]),asked:g.solution};
    setFocus(f);
    if(f.mode==="reveal"){
      if(st.revealKey!==tk){
        st.revealKey=tk;
        revealCards.forEach((c,k)=>{c.material[4].map=cardFace(f.sol[k]);c.material[4].needsUpdate=true;});
        st.reveal={t0:animate?st.t:st.t-30};
      }
    }else if(st.reveal){st.reveal=null;st.revealKey=null;revealCards.forEach(c=>c.visible=false);flap.rotation.x=0;}

    // the detectives on the terrace
    const seats=seatList(g);st.seats=seats;
    const have=new Map();figs.forEach(x=>{if(x.u&&seats.some(sv=>sv.u===x.u))have.set(x.u,x);else{x.u=null;x.seat=null;}});
    seats.forEach(sv=>{
      let fg=have.get(sv.u);
      if(!fg){fg=figs.find(x=>!x.u);if(!fg)return;fg.u=sv.u;fg.popT0=animate?st.t+sv.i*.08:-9;fg.fall=(g.out&&g.out[sv.u])?1.45:0;}
      fg.seat=sv;
      fg.g.position.copy(polar(SEAT_R,sv.angle,TER_Y));fg.g.lookAt(0,TER_Y,0);
      fg.mag.visible=!sv.butler;fg.shirt.visible=fg.tie.visible=sv.butler;
      fg.lab.userData.setText(sv.u===st.me?"You":sv.name);fg.lab.userData.pri=sv.u===st.me?2.5:2;
    });
    // swing the camera behind whoever's turn it is
    if(g&&g.status==="playing"&&f.mode==="overview"){
      const ts=seats.find(sv=>sv.u===g.turn);
      let lastTurn=0;for(const e of g.log||[])if(e.t==="turn"||e.t==="start")lastTurn=e.n;
      const tkey=tk+"|"+g.turn+"|"+lastTurn;
      if(ts&&tkey!==st.turnKey&&st.follow){st.turnKey=tkey;want.az=near(ts.angle);want.el=(st.aspect||1.5)<1?.8:.62;}
      st.turnAngle=ts?ts.angle:null;
    }else st.turnAngle=null;
    // the question cards over the room
    const qk=f.mode==="room"&&f.asked?f.asked.join():"";
    if(qk&&qk!==st.qKey)f.asked.forEach((id,i)=>{const m=qCards[i].material[4];m.map=cardFace(id);m.needsUpdate=true;});
    st.qKey=qk;
    // replay what just happened at the table
    poke();
    const seq=g?(g.seq||0):0;
    if(!animate||!g){st.lastN=seq;st.qFly=null;}
    else{
      let dl=0;
      for(const e of g.log||[]){
        if(e.n<=st.lastN)continue;
        if(e.t==="ask"){st.qFly={t0:st.t+.05,from:seatPos(e.by,1.3)};dl=.9;}
        else if(e.t==="pass"){spawnMark(seatPos(e.who,1.9),dl);dl+=.45;}
        else if(e.t==="show"){spawnFlyer(e,dl);dl+=.4;}
        else if(e.t==="win")burst(seatPos(e.by,1.3),2.6);
      }
      st.lastN=seq;
    }
    updateCap();
  }
  function seatList(g){
    if(!g||!g.players||g.status==="closed")return [];
    const ids=g.status==="lobby"?seated(g):[...(g.order||[]),...(g.butler?["butler"]:[])];
    const n=Math.max(ids.length,1);
    return ids.map((u,i)=>({u,i,angle:Math.PI/2+i*TAU/n,hex:u==="butler"?0x2b2730:SEAT_HEX[i%SEAT_HEX.length],
      name:u==="butler"?"Fennimore":shortNick(nick(u,g)),bot:isBot(g,u),butler:u==="butler"}));
  }
  function seatPos(u,y){const sv=st.seats.find(x=>x.u===u);return sv?polar(SEAT_R,sv.angle,TER_Y+(y||1.25)*1.35):V(0,2,0);}
  function spawnMark(pos,dl){
    let m=marks.find(x=>x.t0<0)||marks.reduce((a,b)=>a.t0<b.t0?a:b);
    m.pos.copy(pos);m.t0=st.t+dl;
  }
  function spawnFlyer(e,dl){
    let fl=flyers.find(x=>!x.on)||flyers[0];
    fl.on=true;fl.from=seatPos(e.who,1.25);fl.to=seatPos(e.to,1.45);fl.t0=st.t+dl+.1;fl.n=e.n;fl.mine=e.to===st.me;fl.faced=false;
    const m=fl.c.material[4];m.map=st.backTex;m.needsUpdate=true;
  }
  function burst(pos,dl){
    if(REDUCED)return;
    for(let i=0;i<conf.n;i++){const j=i*3;
      conf.pos[j]=pos.x+(Math.random()-.5)*.4;conf.pos[j+1]=pos.y+Math.random()*.3;conf.pos[j+2]=pos.z+(Math.random()-.5)*.4;
      conf.vel[j]=(Math.random()-.5)*4.6;conf.vel[j+1]=3.4+Math.random()*3.8;conf.vel[j+2]=(Math.random()-.5)*4.6;}
    conf.pts.geometry.attributes.position.needsUpdate=true;conf.t0=st.t+dl;
  }

  /* ---- every frame ---- */
  function frame(dt){
    st.t+=dt;const t=st.t,f=st.focus,now=performance.now();
    const k=REDUCED?1:1-Math.exp(-dt*(t<3.6?1.25:2.6));
    // where the camera wants to be
    const tanH=st.tanH,tanV=st.tanV;
    const fm=st.follow?f.mode:"overview";
    if(fm==="room"){wantT.copy(polar(3.7,ang(f.room),.3));want.dist=clamp(Math.max(2.7/tanH,2.2/tanV),5.5,15);}
    else if(fm==="envelope"){wantT.set(0,FLOOR+.75,0);want.dist=clamp(Math.max(1.6/tanH,1.25/tanV),4.2,11);}
    else if(fm==="reveal"){wantT.set(0,FLOOR+1.35,0);want.dist=clamp(Math.max(1.9/tanH,1.25/tanV),5.2,12);}
    else{
      const home=!st.code,R0=st.seats.length?8.3:((st.aspect||1.5)<1?6.2:6.7);
      if(st.turnAngle!=null&&st.follow){const pf=(st.aspect||1.5)<1?.76:.86;wantT.copy(polar(3.6,st.turnAngle,.3));want.dist=clamp(Math.max(R0*pf/tanH,R0*.6/tanV),8,34);}
      else{wantT.set(0,home?.9:.1,0);want.dist=clamp(Math.max(R0/tanH,R0*.7/tanV),9,36);}
    }
    if(!REDUCED&&f.mode==="overview"&&now-st.lastDrag>6000&&!(st.g&&st.g.status==="playing"))want.az+=dt*.07;
    cam.az+=(want.az-cam.az)*k;cam.el+=(want.el-cam.el)*k;cam.dist+=(want.dist-cam.dist)*k;camT.lerp(wantT,k);
    const ce=Math.cos(cam.el);
    camera.position.set(camT.x+ce*Math.cos(cam.az)*cam.dist,camT.y+Math.sin(cam.el)*cam.dist,camT.z+ce*Math.sin(cam.az)*cam.dist);
    camera.lookAt(camT);
    scene.fog.near=cam.dist*.85;scene.fog.far=cam.dist*2.3;

    // fade the walls between the camera and the room, like a dollhouse
    for(const rm of rooms){
      const fa=Math.cos(rm.a-cam.az),op=fa>.1?1-.86*Math.min(1,(fa-.1)/.55):1;
      rm.wallMat.opacity=op;rm.wallMat.depthWrite=op>.95;
      const picked=st.pickMode&&st.picks.r===rm.id,kv=st.know&&st.know[rm.id];
      let em=picked?.42:(kv==="env"?.2:0);
      if(st.hover===rm.id)em=Math.max(em,.16);
      if(f.mode==="room"&&f.room===rm.i)em=Math.max(em,.1+.06*Math.sin(t*3));
      rm.mat.emissiveIntensity+=(em-rm.mat.emissiveIntensity)*.2;
      const dim=kv==="held"||kv==="faceup"||kv==="notenv";
      rm.pmat.opacity=dim?.45:1;
    }

    // pieces
    const asked=f.asked||[];
    for(const id in pieces){
      const pc=pieces[id];
      if(pc.anim){
        const q=c01((t-pc.anim.t0)/pc.anim.dur);
        if(q>0){
          const e=ease(q);
          pc.g.position.lerpVectors(pc.anim.from,pc.to,e);pc.g.position.y+=Math.sin(Math.PI*q)*pc.anim.hop;
          if(pc.kind==="s")pc.g.rotation.y=e*TAU;
        }
        if(q>=1){pc.anim=null;pc.g.position.copy(pc.to);pc.g.rotation.y=0;}
      }else if(pc.to&&asked.includes(id)&&!REDUCED){
        pc.g.position.y=pc.to.y+(pc.kind==="s"?Math.abs(Math.sin(t*2.6))*.07:0);
      }
      if(pc.kind==="m"){
        pc.g.rotation.y=Math.atan2(camera.position.x-pc.g.position.x,camera.position.z-pc.g.position.z);
        if(AMB()){pc.inner.position.y=.55+Math.sin(t*1.8+pc.idx)*.05;pc.inner.rotation.y=Math.sin(t*.9+pc.idx)*.4+(pc.anim?c01((t-pc.anim.t0)/pc.anim.dur)*TAU:0);}
      }
      const picked=st.pickMode&&(st.picks.s===id||st.picks.m===id);
      let glow=picked?.65:asked.includes(id)?.3+.18*Math.sin(t*4):0;
      if(st.hover===id)glow=Math.max(glow,.32);
      pc.glow+=(glow-pc.glow)*.2;pc.mat.emissiveIntensity=pc.glow;
      const kv=st.know&&st.know[id],dim=kv==="held"||kv==="faceup"||kv==="notenv";
      pc.mat.color.copy(pc.base);if(dim)pc.mat.color.lerp(GREY,.62);
      if(pc.face)pc.face.color.setScalar(dim?.5:1);
      const env=kv==="env"||(f.mode==="reveal"&&f.sol.includes(id));
      pc.halo.visible=env;if(env)pc.halo.material.opacity=.55+.3*Math.sin(t*3+pc.idx);
      const hot=picked||asked.includes(id)||st.hover===id||env;
      pc.lab.userData.pri=hot?3:1;
      if(pc.kind==="m")pc.lab.visible=hot;
      else pc.lab.visible=f.mode!=="reveal"||f.sol.includes(id);
    }

    // envelope: glows while an accusation is checked, opens at the end
    const judging=f.mode==="envelope";
    const eg=judging?.35+.25*Math.sin(t*5):0;
    envMat.emissiveIntensity+=(eg-envMat.emissiveIntensity)*.2;flapMat.emissiveIntensity=envMat.emissiveIntensity;
    const ey=FLOOR+.655+(judging?.22+Math.sin(t*2.2)*.04:0);envGroup.position.y+=(ey-envGroup.position.y)*k;
    if(judging&&!REDUCED)envGroup.rotation.y=Math.sin(t*1.3)*.25;else envGroup.rotation.y*=.9;
    if(st.reveal){
      const p=t-st.reveal.t0;
      flap.rotation.x=-2.5*ease(c01(p/.8));
      right.set(1,0,0).applyQuaternion(camera.quaternion);
      revealCards.forEach((c,i)=>{
        const q=c01((p-.7-i*.3)/1.5);
        c.visible=q>0;if(!c.visible)return;
        const e=ease(q);
        tmpA.set(0,envGroup.position.y+.05,0);
        tmpB.set(0,FLOOR+1.62,0).addScaledVector(right,(i-1)*.74);
        c.position.lerpVectors(tmpA,tmpB,e);c.position.y+=Math.sin(Math.PI*q)*.45+(REDUCED?0:Math.sin(t*1.6+i)*.02*e);
        const s=.35+.65*e;c.scale.set(s,s,s);
        c.lookAt(camera.position);c.rotateY(Math.PI*(1-ease(c01((q-.35)/.65))));
      });
    }

    // the detectives
    const g=st.g,act=g?actor(g):null;
    for(const fg of figs){
      if(!fg.u){fg.g.visible=false;continue;}
      fg.g.visible=true;
      const sv=fg.seat,pop=c01((t-fg.popT0)/.65);
      fg.g.scale.setScalar(Math.max(.001,pop<1?easeBack(pop):1));
      const out=!!(g&&g.status!=="lobby"&&g.out&&g.out[fg.u]);
      fg.fall+=((out?1.45:0)-fg.fall)*(REDUCED?1:.06);fg.body.rotation.z=fg.fall;
      if(st.seatHex&&!sv.butler)fg.coat.color.set(st.seatHex[sv.i%st.seatHex.length]);else fg.coat.color.setHex(sv.hex);
      if(out)fg.coat.color.lerp(GREY,.6);
      const playing=g&&g.status==="playing";
      const isTurn=playing&&g.turn===fg.u&&!out,acting=playing&&g.phase==="asking"&&act===fg.u;
      const won=g&&g.status==="over"&&g.winner===fg.u,accusing=playing&&g.phase==="judging"&&g.acc&&g.acc.by===fg.u;
      const ro=(isTurn||won)?.7+.25*Math.sin(t*3):acting?.4:0;
      fg.ring.material.opacity+=(ro-fg.ring.material.opacity)*.15;
      fg.beam.material.opacity+=(((isTurn||accusing||won)?.12:0)-fg.beam.material.opacity)*.1;
      fg.beam.material.color.setHex(accusing?0xff8f80:0xffd391);
      fg.glow+=(((isTurn||acting)?.22+.12*Math.sin(t*4):won?.3:0)-fg.glow)*.15;fg.coat.emissiveIntensity=fg.glow;
      let y=0;
      if(!REDUCED){if(won)y=Math.abs(Math.sin(t*5))*.35;else if(acting)y=Math.abs(Math.sin(t*7))*.07;else if(isTurn)y=.03+Math.sin(t*2)*.03;}
      fg.body.position.y=y;
    }

    // the question floats over the room; the asker's cards fly there first
    if(f.mode==="room"&&f.asked&&f.room>=0){
      right.set(1,0,0).applyQuaternion(camera.quaternion);
      const base=polar(3.9,ang(f.room),1.95);
      qCards.forEach((c,i)=>{
        tmpB.copy(base).addScaledVector(right,(i-1)*.66);if(!REDUCED)tmpB.y+=Math.sin(t*1.5+i)*.05;
        const p=st.qFly?c01((t-st.qFly.t0-i*.12)/.95):1,e=ease(p);
        c.visible=p>0;
        if(p<1){c.position.lerpVectors(st.qFly.from,tmpB,e);c.position.y+=Math.sin(Math.PI*p)*1.3;}else c.position.copy(tmpB);
        const sc=.78*(.4+.6*e);c.scale.set(sc,sc,sc);
        c.lookAt(camera.position);if(p<1)c.rotateY(TAU*(1-e));
      });
    }else qCards.forEach(c=>{c.visible=false;});

    // a shown card flies face down from one detective to the other; only the asker sees it turn over
    for(const fl of flyers){
      if(!fl.on){fl.c.visible=false;continue;}
      const p=t-fl.t0;fl.c.visible=p>=0;if(p<0)continue;
      const tr=c01(p/1.25);
      const dest=fl.mine?(camera.getWorldDirection(tmpC).multiplyScalar(2.5).add(camera.position),tmpC.y-=.32,tmpC):fl.to;
      if(tr<1){
        const e=ease(tr);fl.c.position.lerpVectors(fl.from,dest,e);fl.c.position.y+=Math.sin(Math.PI*tr)*(fl.mine?1.2:2.4);fl.c.scale.setScalar(fl.mine?.55+.25*e:.7);
        fl.c.lookAt(camera.position);fl.c.rotateY(Math.PI);fl.c.rotateZ(Math.sin(tr*Math.PI)*.5);
      }else{
        const h=p-1.25;
        if(fl.mine)fl.c.position.copy(dest);else{fl.c.position.copy(fl.to);fl.c.position.y+=.2+Math.min(h,.5)*.5;}
        fl.c.lookAt(camera.position);
        let flip=0;
        if(fl.mine){const d=st.dec&&st.dec[fl.n];if(d&&d.card){if(!fl.faced){fl.faced=true;fl.ft0=t;const m=fl.c.material[4];m.map=cardFace(d.card);m.needsUpdate=true;}flip=ease(c01((t-fl.ft0)/.6));}}
        fl.c.rotateY(Math.PI*(1-flip));
        const life=fl.mine?3.2:1.3,fade=c01((h-life)/.4);
        fl.c.scale.setScalar((fl.mine?.8:.7)*(1-fade)+.001);
        if(h>life+.4){fl.on=false;fl.c.visible=false;}
      }
    }
    for(const mk of marks){
      const p=mk.t0<0?-1:(t-mk.t0)/1.3;
      if(p<0||p>1){mk.s.visible=false;if(p>1)mk.t0=-9;continue;}
      mk.s.visible=true;mk.s.position.copy(mk.pos);mk.s.position.y+=p*.5;
      mk.s.material.opacity=p<.15?p/.15:1-(p-.15)/.85;
      const sc=.5*(p<.15?.6+.4*p/.15:1);mk.s.scale.set(sc,sc,1);
    }
    if(conf.t0>-90){
      const p=t-conf.t0;
      if(p>3.8){conf.pts.visible=false;conf.t0=-99;}
      else if(p>=0){
        conf.pts.visible=true;
        for(let i=0;i<conf.n;i++){const j=i*3;
          conf.vel[j+1]-=6.5*dt;conf.vel[j]*=.985;conf.vel[j+2]*=.985;
          conf.pos[j]+=conf.vel[j]*dt;conf.pos[j+1]+=conf.vel[j+1]*dt;conf.pos[j+2]+=conf.vel[j+2]*dt;
          if(conf.pos[j+1]<TER_Y){conf.pos[j+1]=TER_Y;conf.vel[j+1]*=-.2;}}
        conf.pts.geometry.attributes.position.needsUpdate=true;conf.pts.material.opacity=1-c01((p-2.8)/1);
      }
    }

    // the storm: rain and the odd flash of lightning
    if(rain.visible){
      for(let i=0;i<rainPos.length;i+=6){rainPos[i+1]-=dt*11;rainPos[i+4]-=dt*11;if(rainPos[i+4]<-2){rainPos[i+1]+=13;rainPos[i+4]+=13;}}
      rain.geometry.attributes.position.needsUpdate=true;
    }
    if(AMB()){
      if(t>st.nextBolt){st.boltAt=t;st.nextBolt=t+(st.code?60+Math.random()*60:12+Math.random()*8);}
      const bt=t-st.boltAt,amp=st.code?.4:.7;let fb=0;
      if(bt>=0&&bt<.8)fb=(bt<.08?1:bt<.16?.25:bt<.26?.8:Math.max(0,.8-(bt-.26)*1.5))*amp;
      hemi.intensity=.66+1.2*fb;moonL.intensity=.6+1*fb;
      const fv=(fb*.35).toFixed(2);if(fv!==st.flash){st.flash=fv;st.host.style.setProperty("--flash",fv);}
    }else if(st.flash!=="0.00"){st.flash="0.00";hemi.intensity=.66;moonL.intensity=.6;if(st.host)st.host.style.setProperty("--flash","0");}

    // lights and atmosphere
    lamp.intensity=1.05+(AMB()?Math.sin(t*7.3)*.04+Math.sin(t*12.1)*.03:0);
    let fl=0;
    if((f.mode==="room"||f.mode==="reveal")&&f.room>=0){focusLight.position.copy(polar(3.9,ang(f.room),2.3));fl=1.5;}
    focusLight.intensity+=(fl-focusLight.intensity)*.08;
    if(AMB()){
      if(waterMat)waterMat.emissiveIntensity=.28+.08*Math.sin(t*1.7);
      if(boat){boat.position.y=.1+Math.sin(t*1.3)*.025;boat.rotation.z=Math.sin(t*1.1)*.05;}
      for(let i=1;i<dustPos.length;i+=3){dustPos[i]+=dt*.06;if(dustPos[i]>3.6)dustPos[i]=0;}
      dust.geometry.attributes.position.needsUpdate=true;
    }
    if(st.tip&&now>st.tipUntil){st.tip="";}
    updateCap();
    declutter();
    R.render(scene,camera);
    if(st.saver){
      const settled=Math.abs(want.az-cam.az)<1e-3&&Math.abs(want.el-cam.el)<1e-3&&Math.abs(want.dist-cam.dist)<1e-2&&camT.distanceTo(wantT)<1e-3;
      const fx=Object.values(pieces).some(pc=>pc.anim)||flyers.some(x=>x.on)||marks.some(x=>x.t0>=0)||conf.t0>-90||(st.reveal&&t-st.reveal.t0<6)||(st.qFly&&t-st.qFly.t0<2.5)||figs.some(x=>x.u&&t-x.popT0<1);
      st.idle=settled&&!fx&&now-st.poke>1500&&!(f.mode==="overview"&&!(st.g&&st.g.status==="playing")&&now-st.lastDrag>6000&&!REDUCED);
    }
  }
  function loop(){
    if(st.dead)return;
    requestAnimationFrame(loop);
    let dt=Math.min(.25,clock.getDelta());
    if(!st.ok||!st.host||document.hidden||!st.visible||!st.host.clientWidth)return;
    if(st.saver){st.acc+=dt;if(st.acc<(st.idle?.5:1/30))return;dt=st.acc;st.acc=0;}
    try{frame(Math.min(.05,dt));}catch(e){console.error(e);fail();}
  }

  api.load=load;api.mount=mount;api.sync=sync;
  api.setPick=(on,p)=>{const k=JSON.stringify([!!on,p]);if(k!==st.pickK){st.pickK=k;poke();}st.pickMode=!!on;st.picks={...(p||{})};if(st.ok)updateCap();};
  api.setKnow=row=>{const k=row?JSON.stringify(row):"";if(k!==st.knowK){st.knowK=k;poke();}st.know=row||null;};
  api.setMe=(uid,dec)=>{if(st.me!==uid)poke();st.me=uid||null;st.dec=dec||{};};
  api.setSeatHex=arr=>{st.seatHex=arr&&arr.length?arr:null;};
  api.setFollow=on=>{st.follow=!!on;poke();};
  api.setSaver=on=>{st.saver=!!on;applySaver();};
  api.where=id=>{
    const pc=pieces[id];if(!st.ok||!pc)return null;
    const v=pc.g.position.clone();v.y+=pc.kind==="s"?.45:.55;v.project(camera);
    const r=R.domElement.getBoundingClientRect();
    return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  };
  api.ready=()=>st.ok;
  return api;
})();

/* Hollowmere cinematic director — original, deterministic animated 2D storytelling.
   All illustration is drawn at runtime; no remote videos or dependencies are required.
   Intentionally keeps the solution secret: atmosphere is NOT evidence. */
(function(root){"use strict";
 const W=1600,H=900, PI=Math.PI,TAU=PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 function rng(n){let x=Math.sin(n*17.771+49.81)*43758.5453;return x-Math.floor(x);}
 function poly(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();}
 function round(ctx,x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
 function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
 function circle(ctx,x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=color;ctx.fill();}
 function gradient(ctx,x1,y1,x2,y2,stops){const g=ctx.createLinearGradient(x1,y1,x2,y2);for(const [p,c]of stops)g.addColorStop(p,c);return g;}
 function radial(ctx,x,y,r,stops){const g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [p,c]of stops)g.addColorStop(p,c);return g;}
 function glow(ctx,x,y,r,col){ctx.save();ctx.globalCompositeOperation="screen";circle(ctx,x,y,r,radial(ctx,x,y,r,[[0,col],[1,"#00000000"]]));ctx.restore();}
 function backdrop(ctx,t,theme){
  const colors=theme==="train"?["#13172a","#26304c","#080e1c"]:theme==="ball"?["#161023","#51304b","#170f21"]:theme==="island"?["#0c1926","#234254","#06101b"]:["#0a1022","#293954","#0a121f"];
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,colors[0]],[.5,colors[1]],[1,colors[2]]]);ctx.fillRect(0,0,W,H);
  for(let i=0;i<95;i++){let x=rng(i+101)*W,y=rng(i+201)*510;circle(ctx,x,y,rng(i+301)*1.4+.3,`rgba(255,235,199,${.12+rng(i+401)*.5})`);}
  const mx=1240+Math.sin(t*.08)*9,my=160,moon=ctx.createRadialGradient(mx,my,9,mx,my,108);moon.addColorStop(0,"#ffefd4");moon.addColorStop(.75,"#dbcab4");moon.addColorStop(1,"#b4b6c000");ctx.fillStyle=moon;ctx.beginPath();ctx.arc(mx,my,108,0,TAU);ctx.fill();glow(ctx,mx,my,340,"#cdd7ff27");
  for(let j=0;j<5;j++){let y=570+j*46;poly(ctx,[[0,y+100],[170,y-50],[380,y+40],[690,y-130],[950,y+25],[1230,y-65],[1600,y+50],[1600,H],[0,H]],`rgba(8,14,27,${.06+j*.12})`);}
 }
 function rain(ctx,t,strength=1){ctx.save();ctx.strokeStyle=`rgba(202,218,243,${.23*strength})`;ctx.lineWidth=1.6;for(let i=0;i<155;i++){const x=(rng(i+999)*W+(t*100+i*2))%W,y=(rng(i+1222)*H+(t*460+i*17))%H;line(ctx,x,y,x-14,y+38,`rgba(214,222,237,${(.07+rng(i+1542)*.24)*strength})`,1.5);}ctx.restore();}
 function mist(ctx,t){for(let i=0;i<6;i++){ctx.save();ctx.globalAlpha=.16+i*.018;const x=250+i*240+Math.sin(t*.22+i)*45,y=740+i*18;ctx.fillStyle=radial(ctx,x,y,240,[[0,"#b8c8d266"],[1,"#e3e4ee00"]]);ctx.beginPath();ctx.ellipse(x,y,400,116,0,0,TAU);ctx.fill();ctx.restore();}}
 function bolt(ctx,x,y,t){ctx.save();ctx.shadowColor="#d9e7ff";ctx.shadowBlur=45;let xx=x,yy=0;ctx.beginPath();ctx.moveTo(xx,yy);for(let i=0;i<9;i++){xx+=(-1+2*rng(50+i))*56;yy+=50+rng(80+i)*55;ctx.lineTo(xx,yy);}ctx.strokeStyle="#e8efff";ctx.lineWidth=7;ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=2;ctx.strokeStyle="#fff";ctx.stroke();ctx.restore();}
 function manor(ctx,t){
  backdrop(ctx,t,"manor");
  const z=1.05+Math.min(t/8,1)*.11;ctx.save();ctx.translate(W/2,540);ctx.scale(z,z);ctx.translate(-W/2,-540);
  const ground=gradient(ctx,0,650,0,900,[[0,"#17212a"],[1,"#05080f"]]);ctx.fillStyle=ground;ctx.fillRect(0,690,W,210);
  poly(ctx,[[270,720],[320,320],[500,310],[580,240],[690,320],[985,320],[1060,220],[1145,320],[1300,315],[1360,720]],"#121523");
  round(ctx,330,348,962,365,4,gradient(ctx,340,330,1270,800,[[0,"#252c39"],[.5,"#161923"],[1,"#0b0d19"]]),"#7e705644",3);
  poly(ctx,[[286,350],[460,245],[1050,260],[1296,350]],"#101522");poly(ctx,[[515,340],[610,210],[714,340]],"#171c2c");
  poly(ctx,[[1020,344],[1085,175],[1150,344]],"#111522");round(ctx,1050,296,72,414,0,"#202332","#97744955");
  for(let i=0;i<7;i++){const x=395+i*120;for(let row=0;row<2;row++){const y=402+row*124;const flick=.76+.16*Math.sin(t*1.5+i+row*3);round(ctx,x,y,53,80,24,`rgba(220,158,85,${flick})`,"#9a805b",3);line(ctx,x+27,y,x+27,y+80,"#231a1d",5);line(ctx,x,y+42,x+53,y+42,"#231a1d",5);glow(ctx,x+26,y+42,73,"#ffd28e18");}}
  round(ctx,760,520,100,198,50,"#090c18","#a88352",6);line(ctx,810,545,810,700,"#9d7243",4);circle(ctx,843,635,5,"#d1ad63");
  for(let i=0;i<10;i++){let y=710+i*14;line(ctx,700-i*6,y,912+i*6,y,"#d2b47c22",2);}
  for(let i=0;i<9;i++){const x=290+i*132;line(ctx,x,350,x,700,"#c7a57822",3);}
  ctx.restore();
  // A horse-drawn carriage glides into the foreground; it never discloses suspect identity.
  const x=-430+Math.min(t/8,1)*1020,y=735+Math.sin(t*8)*2;
  ctx.save();ctx.translate(x,y);ctx.fillStyle="#07080e";
  for(let i=0;i<2;i++){circle(ctx,95+i*185,40,55,"#080a12");circle(ctx,95+i*185,40,43,"#45352a");circle(ctx,95+i*185,40,33,"#0b0c13");for(let j=0;j<8;j++)line(ctx,95+i*185,40,95+i*185+Math.cos(j*PI/4)*35,40+Math.sin(j*PI/4)*35,"#887151",3);}
  round(ctx,40,-140,325,140,30,"#1a161e","#94714c",5);poly(ctx,[[30,-145],[140,-206],[282,-206],[375,-145]],"#0b0e19");round(ctx,155,-130,96,94,5,"#c39a6040","#876b4d",4);line(ctx,204,-130,204,-36,"#98704a",3);line(ctx,365,-42,500,-40,"#a98a66",4);
  // horse silhouette
  ctx.fillStyle="#080a10";ctx.beginPath();ctx.ellipse(555,-34,80,40,0,0,TAU);ctx.fill();poly(ctx,[[595,-60],[629,-100],[654,-103],[640,-36]],"#090b11");circle(ctx,648,-107,25,"#080a10");for(const leg of [510,555,592,621])line(ctx,leg,-20,leg-6,66,"#07080c",12);
  ctx.restore();
  rain(ctx,t,1);mist(ctx,t);
  const flash=(t%9.3>5.78&&t%9.3<5.97)?1:0;if(flash){ctx.fillStyle="#d2def73a";ctx.fillRect(0,0,W,H);bolt(ctx,1150,0,t);}
 }
 function tablePerson(ctx,x,y,scale,color,phase,hat=false){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=color;
  // deliberate body motion and gestures
  let sway=Math.sin(phase)*5;poly(ctx,[[-34,0],[32,0],[50,116],[-53,116]],color);circle(ctx,sway,-34,31,"#25202b");ctx.fillStyle="#b49a7d";ctx.beginPath();ctx.ellipse(sway,-33,19,26,0,0,TAU);ctx.fill();if(hat){poly(ctx,[[-35,-51],[36,-51],[22,-91],[-24,-91]],"#0c0d14");}
  line(ctx,-29,22,-62+Math.sin(phase)*17,95,color,20);line(ctx,29,22,67+Math.cos(phase)*15,89,color,20);ctx.restore();}
 function parlor(ctx,t,theme){
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,"#16111e"],[.62,"#432b37"],[1,"#110d17"]]);ctx.fillRect(0,0,W,H);
  // tall-panelled walls and gothic leaded windows
  for(let i=0;i<9;i++){let x=60+i*182;round(ctx,x,120,146,575,3,"#392834","#a5805b77",9);line(ctx,x+18,140,x+18,679,"#946f5533",4);}
  for(let i=0;i<3;i++){const x=220+i*460;round(ctx,x,180,165,358,82,"#0b1424","#97764d",12);round(ctx,x+17,200,131,310,68,gradient(ctx,0,200,0,500,[[0,"#56627e"],[1,"#0e1426"]]),"#aaa4a055",3);line(ctx,x+83,190,x+83,515,"#c5b58e",7);line(ctx,x+22,356,x+148,356,"#bca77d",7);glow(ctx,x+80,280,180,"#8399b72a");}
  poly(ctx,[[0,715],[1600,715],[1600,900],[0,900]],"#160e14");for(let i=0;i<23;i++)line(ctx,i*74,720,780+(i-10)*120,900,"#c08b5930",2);
  round(ctx,520,565,590,218,100,gradient(ctx,500,560,1100,800,[[0,"#51332a"],[.5,"#3b211e"],[1,"#1d1115"]]),"#ac8350",10);
  for(let i=0;i<5;i++){let x=590+i*106;tablePerson(ctx,x,530,.68,i%2?"#312334":"#261d2c",t*1.6+i*1.3,i===2);}
  // Ambrose stands at the end of the table reading the will
  tablePerson(ctx,820,397,.94,"#171823",t*.8+2,true);
  // rustling document lifted, lowered
  ctx.save();ctx.translate(820,525-10*Math.sin(t*1.2));ctx.rotate(.03*Math.sin(t));poly(ctx,[[-54,-49],[58,-52],[48,15],[-59,23]],"#cbb991");for(let k=0;k<6;k++)line(ctx,-40,-32+k*9,34,-33+k*9,"#84694c",2);ctx.restore();
  // chandelier drifts slightly
  ctx.save();ctx.translate(800+Math.sin(t*.38)*4,0);line(ctx,0,0,0,178,"#c2a26c",7);poly(ctx,[[-115,181],[116,181],[77,238],[-74,238]],"#b88b4e");for(let i=-2;i<=2;i++){let x=i*49;line(ctx,x,210,x,251,"#c7a66a",6);glow(ctx,x,251,56,"#efaf582d");circle(ctx,x,252+Math.sin(t*2+i)*2,9,"#ffe5a1");}ctx.restore();
  // right candle, and light fades sharply for later part
  glow(ctx,1330,600,170,"#f6af4d33");round(ctx,1320,563,20,85,5,"#ead2aa");circle(ctx,1330,555+Math.sin(t*4)*4,12,"#ffc76b");
  if(t>5.4){let fade=ease((t-5.4)/1.9);ctx.fillStyle=`rgba(4,5,12,${fade*.85})`;ctx.fillRect(0,0,W,H);if(t>6.8&&t<7.1){ctx.fillStyle="#b1c3e533";ctx.fillRect(0,0,W,H);}}
  rain(ctx,t,.25);
 }
 function clock(ctx,t){
  ctx.fillStyle=gradient(ctx,0,0,W,H,[[0,"#1a1520"],[.55,"#392931"],[1,"#090c18"]]);ctx.fillRect(0,0,W,H);
  for(let i=0;i<16;i++){let x=i*120;line(ctx,x,0,x,H,"#b18a5630",5);}
  glow(ctx,835,435,550,"#b48e5230");
  ctx.save();ctx.translate(835,432);let zoom=1+.23*ease(t/7);ctx.scale(zoom,zoom);
  circle(ctx,0,0,312,"#151019");circle(ctx,0,0,299,"#9e713d");circle(ctx,0,0,282,"#2d2024");circle(ctx,0,0,266,radial(ctx,0,0,275,[[0,"#d7c29c"],[.8,"#a28c71"],[1,"#64503f"]]));circle(ctx,0,0,231,"#e6d5b330");
  ctx.fillStyle="#433124";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 47px Georgia";
  const numerals=["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];
  for(let i=0;i<12;i++){let a=i*TAU/12-PI/2;ctx.fillText(numerals[i],Math.cos(a)*212,Math.sin(a)*212);}
  for(let i=0;i<60;i++){let a=i*TAU/60-PI/2;line(ctx,Math.cos(a)*241,Math.sin(a)*241,Math.cos(a)*(i%5===0?256:249),Math.sin(a)*(i%5===0?256:249),"#5a4432",i%5===0?3:1.4);}
  // From nearly midnight, minute hand sweeps and visibly stops at 11:47.
  const moving=ease(Math.min(t/4.6,1)); const minAngle=(45+moving*2)*TAU/60; const hourAngle=(11+47/60)*TAU/12;
  ctx.save();ctx.rotate(hourAngle);poly(ctx,[[-8,15],[8,15],[7,-140],[0,-195],[-7,-140]],"#201a20");ctx.restore();
  ctx.save();ctx.rotate(minAngle);poly(ctx,[[-5,22],[5,22],[4,-182],[0,-234],[-4,-182]],"#21191b");ctx.restore();circle(ctx,0,0,18,"#947048");circle(ctx,0,0,8,"#2f2420");ctx.restore();
  if(t>4.6){const a=ease(Math.min((t-4.6)/1.4,1));ctx.fillStyle=`rgba(5,6,13,${a*.78})`;ctx.fillRect(0,0,W,H);ctx.fillStyle=`rgba(246,210,159,${a})`;ctx.textAlign="center";ctx.font="bold 78px Georgia";ctx.fillText("11 : 47",835,765);}
  if(t>5.3&&t<5.55){ctx.fillStyle="#dee6ff45";ctx.fillRect(0,0,W,H);bolt(ctx,1210,0,t);}
 }
 function corridor(ctx,t){
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,"#15121d"],[.5,"#32212a"],[1,"#080a11"]]);ctx.fillRect(0,0,W,H);
  for(let i=0;i<6;i++){const inset=i*125;ctx.strokeStyle=`rgba(183,140,95,${.36-i*.04})`;ctx.lineWidth=12-i;ctx.strokeRect(inset,inset*.38,W-2*inset,H-inset*.46);}
  const floor=gradient(ctx,0,570,0,900,[[0,"#563c37"],[1,"#0b0a11"]]);poly(ctx,[[0,900],[650,530],[950,530],[1600,900]],floor);
  for(let i=1;i<8;i++){let d=i/8,y=530+Math.pow(d,1.8)*390;line(ctx,0,y,W,y,"#b48b6830",2);}
  // Murder-room door opens and a witness's lantern moves toward the discovery.
  round(ctx,610,70,390,600,170,"#110e16","#93734b",22);
  poly(ctx,[[650,110],[957,110],[957,625],[650,625]],"#060913");
  const opening=ease(clamp((t-1.3)/3.2,0,1));
  poly(ctx,[[650,112],[952-opening*184,112+opening*38],[952-opening*184,620-opening*19],[650,625]],"#302128");
  for(let i=0;i<4;i++)line(ctx,682,150+i*109,900-opening*165,150+i*109,"#b98a5b42",8);
  circle(ctx,927-opening*166,400,8,"#d0af6a");
  // shadow, still unidentified, falling across the door; no culprit implied.
  if(t>3){const alpha=clamp((t-3)/1.3,0,.85);ctx.globalAlpha=alpha;ctx.fillStyle="#090910";ctx.beginPath();ctx.ellipse(795,600,110,29,-.12,0,TAU);ctx.fill();poly(ctx,[[710,570],[789,560],[865,589],[900,610],[746,630]],"#12111a");ctx.globalAlpha=1;}
  // witness walks in with a lantern
  const walk=ease(t/6),x=1360-walk*500;ctx.save();ctx.translate(x,600);poly(ctx,[[-40,-100],[50,-102],[90,170],[-95,170]],"#0a0c15");circle(ctx,0,-150,45,"#11111a");line(ctx,-60,-75,-110,20,"#0c0d12",25);
  ctx.save();ctx.translate(-110,20);glow(ctx,0,0,250,"#f1b15a50");round(ctx,-20,-35,40,75,9,"#9c7246","#d3b477",3);circle(ctx,0,8,15,"#ffdf8c");ctx.restore();ctx.restore();
  mist(ctx,t*.4);if(t>6.1){ctx.fillStyle=`rgba(11,8,14,${ease((t-6.1)/1.5)*.7})`;ctx.fillRect(0,0,W,H);}
 }
 function evidence(ctx,t){
  ctx.fillStyle=gradient(ctx,0,0,W,H,[[0,"#111c29"],[.5,"#2b2934"],[1,"#090d17"]]);ctx.fillRect(0,0,W,H);
  // evidence desk in cinematic perspective
  poly(ctx,[[0,650],[1600,540],[1600,900],[0,900]],"#30221e");for(let i=0;i<12;i++){let y=570+i*37;line(ctx,0,y+70,W,y,"#93694b25",2);}
  // detective silhouette and hat approach; anonymous detective, not a named suspect.
  const x=160+ease(t/4)*210;
  ctx.save();ctx.translate(x,440);glow(ctx,40,180,360,"#5f90b22c");poly(ctx,[[-150,120],[90,120],[205,460],[-280,460]],"#0b101a");circle(ctx,-28,25,80,"#15151e");poly(ctx,[[-180,-27],[155,-27],[106,-58],[-138,-58]],"#090b13");poly(ctx,[[-95,-47],[98,-47],[65,-164],[-62,-164]],"#10111b");
  line(ctx,105,200,390,390,"#12131b",47);ctx.restore();
  // Leather folder opens, sealed case envelope and three cards fly out.
  ctx.save();ctx.translate(965,665);ctx.rotate(-.14);round(ctx,-250,-130,500,210,16,"#472d24","#ba9059",8);
  for(let i=0;i<5;i++)line(ctx,-200,-70+i*26,170,-85+i*26,"#ab835a80",3);
  ctx.save();ctx.translate(0,-30);let open=ease(clamp((t-1.2)/2.3,0,1));poly(ctx,[[-187,-45],[190,-45],[190+40*open,-160-120*open],[-170-90*open,-180-130*open]],"#b39264");line(ctx,-180,-44,190,-44,"#e9c996",5);
  circle(ctx,0,-22,30,"#8b2534");circle(ctx,0,-22,19,"#b7444c");ctx.restore();ctx.restore();
  const slots=[[-220,-135,-.25],[50,-210,.12],[275,-118,.26]];
  for(let i=0;i<3;i++){let grow=ease(clamp((t-2.8-i*.55)/2,0,1));if(!grow)continue;const [ox,oy,rot]=slots[i];ctx.save();ctx.translate(945+ox*grow,565+oy*grow);ctx.rotate(rot*grow);ctx.globalAlpha=grow;round(ctx,-76,-119,150,225,12,"#ddc9a1","#a07843",5);round(ctx,-65,-109,130,203,7,"#eaddc5","#86633c",2);ctx.fillStyle="#674c32";ctx.textAlign="center";ctx.font="bold 18px Georgia";ctx.fillText(["SUSPECT","METHOD","LOCATION"][i],0,-65);circle(ctx,0,4,38,"#9d805155");for(let j=0;j<3;j++)line(ctx,-35,58+j*17,35,58+j*17,"#765b42",2);ctx.restore();}
  ctx.save();ctx.globalAlpha=.15;ctx.fillStyle="#ffe8af";for(let i=0;i<50;i++){const x=rng(i+61)*W,y=(rng(i+97)*H+t*11)%H;circle(ctx,x,y,rng(i+19)*1.5+.5,"#ffdbac");}ctx.restore();
 }
 function train(ctx,t){backdrop(ctx,t,"train");const z=ease(t/9);ctx.save();ctx.translate(-25+60*z,0);round(ctx,-150,460,1900,270,13,"#121b29","#a0835866",5);for(let i=0;i<12;i++){let x=i*166-60;round(ctx,x,495,106,115,12,"#b17e4c","#99754d",6);round(ctx,x+9,505,88,96,8,"#292842");glow(ctx,x+53,555,67,"#e3a55c26");}for(let i=0;i<22;i++)circle(ctx,i*84,735,42,"#050811");ctx.restore();for(let i=0;i<22;i++){const x=i*95-(t*260)%95;line(ctx,x,775,x-70,900,"#a8b8d032",4);}mist(ctx,t);rain(ctx,t,.7);}
 function masquerade(ctx,t){parlor(ctx,t,"ball");ctx.fillStyle="#6e35461f";ctx.fillRect(0,0,W,H);for(let i=0;i<6;i++){const x=210+i*225,y=475+Math.sin(t+i)*15;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*1.5+i)*.15);tablePerson(ctx,0,0,.7,i%2?"#5a2947":"#322941",t*1.5+i,true);ctx.restore();}for(let i=0;i<30;i++){const x=rng(i+900)*W+Math.sin(t+i)*20,y=(rng(i+500)*H+t*25)%H;circle(ctx,x,y,2,"#d9c09b55");}}
 function lighthouse(ctx,t){backdrop(ctx,t,"island");poly(ctx,[[0,680],[200,610],[370,660],[550,580],[800,650],[1050,600],[1420,690],[1600,665],[1600,900],[0,900]],"#111d23");ctx.fillStyle="#172533";poly(ctx,[[890,695],[960,220],[1085,220],[1140,695]],"#c2b69b");poly(ctx,[[955,220],[970,162],[1072,162],[1088,220]],"#101b2b");round(ctx,964,184,110,34,2,"#f8c97e");glow(ctx,1017,199,260,"#e9d8aa55");ctx.save();ctx.translate(1015,199);ctx.rotate(Math.sin(t*.7)*.85);poly(ctx,[[0,0],[660,-175],[660,175]],"#f4e6b51a");ctx.restore();for(let i=0;i<3;i++)round(ctx,985,315+i*120,50,70,25,"#f2cf8655");rain(ctx,t,1.2);mist(ctx,t);}
 function paint(ctx,theme,kind,t){
  ctx.save();ctx.clearRect(0,0,W,H);
  if(kind==="arrival"){
   if(theme==="train")train(ctx,t);else if(theme==="ball")masquerade(ctx,t);else if(theme==="island")lighthouse(ctx,t);else manor(ctx,t);
  }else if(kind==="gathering")parlor(ctx,t,theme);
  else if(kind==="clock")clock(ctx,t);
  else if(kind==="discovery")corridor(ctx,t);
  else if(kind==="evidence")evidence(ctx,t);
  else if(kind==="ending")evidence(ctx,t);
  else if(kind==="event")corridor(ctx,t);
  else if(kind==="portrait")evidence(ctx,t);
  else manor(ctx,t);
  // 2.39:1 film projection, grain, vignette, and rolling film-light artifacts.
  const vg=ctx.createRadialGradient(800,390,160,800,445,1040);vg.addColorStop(0,"#00000000");vg.addColorStop(1,"#000000bb");ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  for(let i=0;i<90;i++){let x=rng(i*3+17+t*.01)*W,y=rng(i*5+29)*H;ctx.fillStyle="rgba(248,224,187,.04)";ctx.fillRect(x,y,1.3,1.3);}
  ctx.restore();
 }
 let audio=null;
 function sound(on){
  if(!on){if(audio){for(const o of audio.sources)try{o.stop()}catch(e){};audio.ctx.close().catch(()=>{});audio=null;}return false;}
  if(audio)return true;
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return false;
  try{
   const ctx=new Ctx(),master=ctx.createGain();master.gain.value=.14;master.connect(ctx.destination);
   const sources=[];
   for(const [f,volume] of [[73.42,.18],[110,.08],[146.83,.055]]){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.value=f;gain.gain.value=volume;osc.connect(gain);gain.connect(master);osc.start();sources.push(osc);
   }
   const n=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),v=n.getChannelData(0);
   for(let i=0;i<v.length;i++)v[i]=2*rng(i+641)-1;
   const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();noise.buffer=n;noise.loop=true;filter.type="lowpass";filter.frequency.value=360;g.gain.value=.12;noise.connect(filter);filter.connect(g);g.connect(master);noise.start();sources.push(noise);
   audio={ctx,sources};ctx.resume().catch(()=>{});return true;
  }catch(e){return false;}
 }
 let active=null;
 function stop(){if(!active)return;active.cancelled=true;if(active.frame)cancelAnimationFrame(active.frame);if(active.observer)active.observer.disconnect();active=null;}
 function mount(canvas,scene,theme,getElapsed){stop();if(!canvas)return;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)return;
  const obj={cancelled:false,frame:0,canvas,observer:null};active=obj;
  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight,dpr=Math.min(devicePixelRatio||1,1.7);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  resize();if(typeof ResizeObserver!=="undefined"){obj.observer=new ResizeObserver(resize);obj.observer.observe(canvas);}else window.addEventListener("resize",resize,{once:true});
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function frame(){if(obj.cancelled)return;const elapsed=reduced?3.5:getElapsed();const sx=canvas.width/W,sy=canvas.height/H,scale=Math.max(sx,sy);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#05070b";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.setTransform(scale,0,0,scale,(canvas.width-W*scale)/2,(canvas.height-H*scale)/2);paint(ctx,theme,scene,Math.max(0,elapsed));obj.frame=requestAnimationFrame(frame);}
  frame();
 }
 const api={mount,stop,paint,sound};if(typeof module==="object"&&module.exports)module.exports=api;else root.HollowmereCinema=api;
})(typeof window!=="undefined"?window:globalThis);

/* Platform additions: cases, accounts, moderated community drafts, timers, chat, and peer voice. */
const PLATFORM={profile:null,cases:HMCASES.CASES,chat:[],prediction:null,voiceOn:false,media:null,peers:new Map(),pendingIce:new Map(),seenCine:new Set(),cine:null,pan:"room",secretCase:null};
const BASE_CARD_NAMES=Object.fromEntries(ALL.map(id=>[id,{name:CARD[id].name,short:CARD[id].short,note:CARD[id].note}]));
function applyCase(caseData){
  const c=caseData||HMCASES.BY_ID.hollowmere,overrides=HMCASES.displayCase(c);
  for(const id of ALL){const x=CARD[id],base=BASE_CARD_NAMES[id],name=overrides[id];x.name=name||base.name;x.short=name?name.split(" ").slice(-1)[0]:base.short;x.note=name?(HMCASES.noteFor(c,id)||`Evidence from ${c.place||c.title}. Confirm its relevance using the cards and questioning; atmospheric narrative alone is not proof.`):base.note;}
}
function applyPlatformState(g,prior){
  applyCase(g.caseData);
  if(prior&&prior.code!==g.code)voiceLeave();
  const key=g.code+":"+g.startedAt;
  if(g.status==="playing"&&g.startedAt&&!PLATFORM.seenCine.has("intro:"+key)){
    PLATFORM.seenCine.add("intro:"+key);cinematic("opening",g);
  }else if(g.status==="over"&&(!prior||prior.status!=="over")&&!PLATFORM.seenCine.has("end:"+key)){
    PLATFORM.seenCine.add("end:"+key);cinematic("ending",g);
  }else if(prior&&g.status==="playing"&&g.seq>prior.seq){
    const events=(g.log||[]).filter(e=>e.n>prior.seq),shown=events.find(e=>e.t==="show"&&e.to===S.uid&&S.dec[e.n]);
    const story=events.find(e=>e.t==="story");
    if(shown&&(!PLATFORM.cine||PLATFORM.cine.type!=="opening"))cinematic("discovery",g,shown);
    else if(story&&!PLATFORM.cine)cinematic("event",g,story);
  }
}
function profileHTML(){
 const p=PLATFORM.profile;
 const signup=`<section class="platform-card"><h2>Detective Passport</h2><p>Optional account: save your progress, join rankings and reconnect from another device. Guest play still works without signing up.</p>
 <div class="platform-credentials"><label>Username<input id="accountHandle" autocomplete="username" maxlength="20" placeholder="detective_name"></label><label>Password<input id="accountPassword" type="password" autocomplete="current-password" placeholder="At least 10 characters"></label></div>
 <div class="actions"><button class="btn sm primary" type="button" data-act="login">Sign in</button><button class="btn sm" type="button" data-act="register">Create account</button></div><p class="muted">Only enter a password on a trusted HTTPS site when playing online.</p></section>`;
 if(!p)return signup;
 const achievements=p.achievements||[];
 return `<section class="platform-card"><div class="platform-heading"><div><p class="eyebrow">Detective Passport</p><h2>${esc(p.display||p.handle)} <small>@${esc(p.handle)}</small></h2></div><button class="btn sm ghost" type="button" data-act="logout">Sign out</button></div>
 <div class="stat-row"><span><b>${p.level}</b> level</span><span><b>${p.xp}</b> XP</span><span><b>${p.wins}/${p.games}</b> wins</span><span><b>${p.rank}</b> rating</span></div>
 <p class="muted">${achievements.length?achievements.map(esc).join(" · "):"Achievements appear after completed games."}</p>
 <h3>Friends & invitations</h3><div class="actions"><input id="friendHandle" placeholder="Friend's username" maxlength="20"><button class="btn sm" type="button" data-act="friendrequest">Request friendship</button></div>
 <p class="muted">Friends: ${(p.friends||[]).map(esc).join(", ")||"None yet"}</p>
 ${(p.requests||[]).map(n=>`<button class="btn sm" type="button" data-act="friendaccept" data-handle="${esc(n)}">Accept @${esc(n)}</button>`).join(" ")}
 ${(p.invitations||[]).map(i=>`<p>Invitation from @${esc(i.from)}: ${esc(i.code)} <button class="btn sm" data-act="acceptinvite" data-code="${esc(i.code)}">Join table</button><button class="btn sm ghost" data-act="dismissinvite" data-code="${esc(i.code)}">Dismiss</button></p>`).join("")}
 <div class="actions"><button class="btn sm" type="button" data-act="leaderboard">View global XP leaderboard</button></div><div id="leaderResult"></div></section>`;
}
function communityHTML(){const official=(PLATFORM.cases||HMCASES.CASES).map(c=>`<option value="${esc(c.id)}">${esc(c.title)}${c.status&&c.status!=="official"?" ("+esc(c.status)+")":""}</option>`).join("");return `<section class="platform-card"><h2>The mystery universe</h2><p>Four complete themed cases use the same proven 18-slot deduction engine with distinct casts, methods, locations and cinematic stories. Community cases require review before public listing.</p><div class="case-gallery">${HMCASES.CASES.map(c=>`<article><b>${esc(c.title)}</b><p>${esc(c.tagline)}</p></article>`).join("")}</div>
 ${(PLATFORM.cases||[]).filter(x=>x.status&&x.status!=="official").map(x=>`<p><strong>${esc(x.title)}</strong> — ${esc(x.status)} ${x.status==="draft"?`<button type="button" class="btn sm" data-act="casesubmit" data-caseid="${esc(x.id)}">Submit for review</button>`:""}</p>`).join("")}
 <details><summary>Create a community mystery ${PLATFORM.profile?"":"(sign in first)"}</summary><div class="community-form"><label>Case title<input id="newCaseTitle" maxlength="64" placeholder="A Murder in the Snow"></label><label>Story introduction (80+ characters)<textarea id="newCaseOpening" rows="4" maxlength="1200" placeholder="Write the story's opening and setting…"></textarea></label><label>Six suspect names (one per line)<textarea id="newCaseSuspects" rows="6" placeholder="Six names, one per line"></textarea></label><label>Six murder methods (one per line)<textarea id="newCaseMethods" rows="6" placeholder="Six methods, one per line"></textarea></label><label>Six crime scenes (one per line)<textarea id="newCaseRooms" rows="6" placeholder="Six locations, one per line"></textarea></label><button class="btn sm primary" type="button" data-act="casecreate">Save private case draft</button><div id="newCaseResult"></div></div></details></section>`;}
function platformHomeHTML(){return `<div class="platform-grid">${profileHTML()}${communityHTML()}</div><section class="platform-card"><h2>Find other detectives</h2><p>Open matchmaking joins an available room, or creates one if necessary. Ranked mode requires accounts and registered human players.</p><div class="actions"><button class="btn primary" type="button" data-act="matchmake" data-mode="casual">Casual matchmaking</button><button class="btn" type="button" data-act="matchmake" data-mode="ranked">Ranked matchmaking</button></div><h3>Tournaments</h3><p>Private tournament codes let invited detectives accumulate points across completed matches; advanced brackets and automatic scheduling remain future work.</p><div class="actions"><input id="tournamentName" placeholder="Tournament title"><button class="btn sm" type="button" data-act="tournamentcreate">Create</button><input id="tournamentCode" placeholder="Tournament code"><button class="btn sm" type="button" data-act="tournamentjoin">Join</button><button class="btn sm" type="button" data-act="tournamentlist">My tournaments</button></div><div id="tournamentResult"></div></section>`;}
function platformTableHTML(g){if(!g)return "";
 const host=g.hostId===S.uid&&g.status==="lobby",set=g.settings||{turnSeconds:0,chat:true,voice:false},c=g.caseData||HMCASES.BY_ID.hollowmere;
 const settings=host?`<section class="platform-card"><h3>Case & room setup</h3><div class="config-grid"><label>Story case<select id="casePicker">${(PLATFORM.cases||HMCASES.CASES).map(x=>`<option value="${esc(x.id)}" ${x.id===g.caseId?"selected":""}>${esc(x.title)}</option>`).join("")}</select></label><label>Turn timer<select id="turnTimer">${[0,30,60,120].map(n=>`<option value="${n}" ${n===set.turnSeconds?"selected":""}>${n?n+" seconds":"No timer"}</option>`).join("")}</select></label><label class="check-row"><input type="checkbox" id="allowChat" ${set.chat?"checked":""}> Text chat</label><label class="check-row"><input type="checkbox" id="allowVoice" ${set.voice?"checked":""}> Voice chat (experimental)</label></div><div class="actions"><button class="btn sm primary" type="button" data-act="saveconfiguration">Save room settings</button></div></section>`:"";
 const timer=g.status==="playing"&&g.turnExpiresAt?`<div class="timer-strip" role="status"><span>⏳ Turn time remaining</span><strong id="turnClock">—</strong></div>`:"";
 const player=!!g.players[S.uid],channel=player?PLATFORM.pan:"spectators";
 const people=Object.keys(g.players||{}).filter(u=>u!==S.uid&&!g.players[u].bot&&!g.players[u].local);
 const messages=(PLATFORM.chat||[]).filter(m=>m.channel===channel||(channel==="private"&&m.channel==="private"));
 const chat=g.status!=="lobby"&&set.chat?`<section class="platform-card"><h3>Conversations</h3><p class="muted">Public room messages are visible to players and spectators; spectator chat is separate. Private chat is visible only to its participants. Do not share your secret cards.</p>
 ${player?`<label>Channel<select id="chatChannel"><option value="room" ${PLATFORM.pan==="room"?"selected":""}>Public room</option><option value="private" ${PLATFORM.pan==="private"?"selected":""}>Private message</option></select></label>`:"<p>Spectator lounge</p>"}
 ${player&&PLATFORM.pan==="private"?`<label>Recipient<select id="chatRecipient">${people.map(u=>`<option value="${esc(u)}">${esc(g.players[u].nick)}</option>`).join("")}</select></label>`:""}
 <div class="chat-feed" role="log" aria-live="polite">${messages.slice(-45).map(m=>`<p><small>${new Date(m.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</small> <b>${esc(m.nick)}</b>${m.channel==="private"?" (private)":""}: ${esc(m.text)} <button class="chat-report" data-act="reportchat" data-mid="${esc(m.id)}" type="button" title="Report this message" aria-label="Report message by ${esc(m.nick)}">⚑</button>${g.hostId===S.uid&&m.from!==S.uid?`<button class="chat-report" data-act="mutechat" data-uid="${esc(m.from)}" type="button" title="Mute user">Mute</button>`:""}</p>`).join("")||"<p>No messages yet.</p>"}</div><form id="chatForm" class="actions"><input id="chatMessage" maxlength="280" autocomplete="off" placeholder="Your message…" aria-label="Chat message"><button class="btn sm primary" type="submit">Send</button></form></section>`:"";
 const prediction=(!player&&g.status==="playing")?`<section class="platform-card"><h3>Predict the mystery</h3><p class="muted">Your prediction is secret until the reveal. One sealed prediction per spectator per game.</p>${PLATFORM.prediction?`<p>Prediction submitted. Await the verdict.</p>`:`<div class="config-grid">${[["s",SUSPECTS],["m",METHODS],["r",ROOMS]].map(([k,items])=>`<label>${{s:"Suspect",m:"Method",r:"Scene"}[k]}<select id="predict-${k}">${items.map(i=>`<option value="${i.id}">${esc(i.name)}</option>`).join("")}</select></label>`).join("")}</div><div class="actions"><input id="predictName" maxlength="16" placeholder="Spectator nickname"><button class="btn sm primary" type="button" data-act="predict">Seal my prediction</button></div>`}</section>`:"";
 const spectatorResults=g.status==="over"&&Array.isArray(g.spectatorRankings)&&g.spectatorRankings.length?`<section class="platform-card"><h3>Spectator predictions</h3><ol>${g.spectatorRankings.map(x=>`<li>${esc(x.nick)} — ${x.points} points (${x.correct}/3 correct)</li>`).join("")}</ol></section>`:"";
 const voice=player&&g.status!=="lobby"&&set.voice?`<section class="platform-card"><h3>Optional voice room</h3><p class="muted">Encrypted peer-to-peer browser audio. Requires microphone permission, HTTPS and compatible network routing; a TURN relay is recommended for reliability.</p><div class="actions"><button class="btn sm" type="button" data-act="voicetoggle">${PLATFORM.voiceOn?"Disconnect microphone":"Join voice room"}</button>${PLATFORM.voiceOn?`<button class="btn sm" type="button" data-act="voicemute">${PLATFORM.media?.getAudioTracks()[0]?.enabled?"Mute microphone":"Unmute microphone"}</button>`:""}</div></section>`:"";
 const inviteFriends=player&&g.status==="lobby"&&PLATFORM.profile?.friends?.length?`<section class="platform-card"><h3>Invite friends</h3><div class="actions"><select id="inviteFriendSelect">${PLATFORM.profile.friends.map(h=>`<option value="${esc(h)}">@${esc(h)}</option>`).join("")}</select><button class="btn sm" type="button" data-act="invitefriend">Send invitation</button></div></section>`:"";
 return `<div class="platform-table">${timer}${settings}${inviteFriends}<section class="platform-card story-card"><p class="eyebrow">Now investigating</p><h3>${esc(c.title)}</h3><p>${esc(c.opening||"")}</p>${g.status!=="lobby"?`<button class="btn sm" type="button" data-act="replaycinematic">▶ Replay story cinematics</button>`:""}</section>${chat}${prediction}${spectatorResults}${voice}${host?`<section class="platform-card"><h3>Tournament association</h3><div class="actions"><input id="tableTournament" placeholder="Tournament code"><button class="btn sm" type="button" data-act="tournamentset">Attach tournament</button></div></section>`:""}</div>`;
}
function setPlatformProfile(data){if(!data)return;PLATFORM.profile=data.profile||null;if(data.cases)PLATFORM.cases=data.cases;if(S.view==="home")renderHome();else renderTable();}
async function platformOp(op,data){const r=await api(op,data);if(!r.ok){toast(r.error||"Couldn't complete that action.");return null;}if(Object.hasOwn(r,"profile"))PLATFORM.profile=r.profile;if(r.cases)PLATFORM.cases=r.cases;render();return r;}
const PLATFORM_ACT={
 register:async()=>{const handle=$("#accountHandle")?.value,password=$("#accountPassword")?.value;if(!handle||!password)return toast("Enter a username and password.");const r=await platformOp("register",{handle,password});if(r)toast("Detective account created.");},
 login:async()=>{const handle=$("#accountHandle")?.value,password=$("#accountPassword")?.value;const r=await platformOp("login",{handle,password});if(r)toast("Signed in.");},
 logout:()=>platformOp("logout"),
 friendrequest:()=>platformOp("friendRequest",{handle:$("#friendHandle")?.value}),
 friendaccept:d=>platformOp("friendAccept",{handle:d.handle}),
 invitefriend:async()=>{const r=await platformOp("inviteFriend",{handle:$("#inviteFriendSelect")?.value});if(r)toast("Game invitation sent.");},
 acceptinvite:d=>{platformOp("dismissInvite",{code:d.code});openTable(d.code);},
 dismissinvite:d=>platformOp("dismissInvite",{code:d.code}),
 leaderboard:async()=>{const r=await platformOp("leaderboard");const el=$("#leaderResult");if(el&&r)el.innerHTML=`<ol>${r.leaders.map(a=>`<li>${esc(a.display)} — ${a.xp} XP, ${a.wins} wins</li>`).join("")}</ol>`;},
 matchmake:async d=>{const r=await platformOp("matchmake",{mode:d.mode,nick:cleanNick($("#nick")?.value)||cleanNick(ls.get("hm.nick"))||"Detective"});if(r)openTable(r.code);},
 saveconfiguration:async()=>{const r=await platformOp("settings",{turnSeconds:Number($("#turnTimer").value),chat:$("#allowChat").checked,voice:$("#allowVoice").checked});if(r)toast("Settings saved.");},
 casechange:()=>platformOp("setcase",{caseId:$("#casePicker")?.value}),
 casesubmit:async d=>{const r=await platformOp("caseSubmit",{caseId:d.caseid});if(r){toast("Submitted for moderator review.");await platformOp("profile");}},
 casecreate:async()=>{const lines=id=>($(id)?.value||"").split("\n").map(x=>x.trim()).filter(Boolean);const r=await platformOp("caseCreate",{title:$("#newCaseTitle")?.value,opening:$("#newCaseOpening")?.value,names:{s:lines("#newCaseSuspects"),m:lines("#newCaseMethods"),r:lines("#newCaseRooms")}});if(r){toast("Private case draft created.");alert(`Draft saved as ${r.caseId}. Select it as a host, or submit for moderation.`);await platformOp("profile");}},
 tournamentcreate:async()=>{const r=await platformOp("tournamentCreate",{title:$("#tournamentName")?.value});if(r){toast("Tournament created: "+r.id);const el=$("#tournamentResult");if(el)el.textContent=`Invite code: ${r.id}`;}},
 tournamentjoin:async()=>{const r=await platformOp("tournamentJoin",{id:$("#tournamentCode")?.value});if(r)toast("Joined tournament: "+r.tournament.title);},
 tournamentlist:async()=>{const r=await platformOp("tournamentList");const el=$("#tournamentResult");if(el&&r)el.innerHTML=r.tournaments.length?r.tournaments.map(t=>`<p><b>${esc(t.title)} (${esc(t.id)})</b> · ${t.members} participants</p><ol>${Object.entries(t.scores).sort((a,b)=>b[1]-a[1]).map(([h,p])=>`<li>@${esc(h)} — ${p} points</li>`).join("")}</ol>`).join(""):"No tournaments joined yet.";},
 tournamentset:async()=>{const r=await platformOp("tournamentSet",{id:$("#tableTournament")?.value});if(r)toast("Tournament attached.");},
 predict:async()=>{const cards=["s","m","r"].map(k=>$("#predict-"+k)?.value);const r=await platformOp("predict",{cards,nick:$("#predictName")?.value});if(r){PLATFORM.prediction={cards};toast("Prediction sealed.");}},
 reportchat:async d=>{const r=await platformOp("reportChat",{id:d.mid});if(r)toast("Report submitted to the room moderator.");},
 mutechat:async d=>{const r=await platformOp("mute",{target:d.uid,mute:true});if(r)toast("Participant muted in this room.");},
 voicetoggle:()=>PLATFORM.voiceOn?voiceLeave():voiceJoin(),
 voicemute:()=>{const tr=PLATFORM.media?.getAudioTracks()[0];if(tr)tr.enabled=!tr.enabled;render();},
 replaycinematic:()=>{if(S.game&&S.game.status!=="lobby")cinematic("opening",S.game);}
};
/* Directed motion-graphic cutscenes: a frame-rendered story with auto-play and manual controls. */
function cinematic(type,g,discovery){
 const c=g.caseData||HMCASES.BY_ID.hollowmere;
 const theme=c.theme||"manor";
 const detective=g.players&&g.players[S.uid]?DETECTIVE_BY_ID[g.players[S.uid].character]:null;
 let scenes=[];
 if(type==="opening"){
  const intros={
   manor:["The summons","A carriage cuts through the rain. Ambrose has summoned every heir to Hollowmere Manor.","The final will","The family gathers. Before the last page can be read, every smile becomes an accusation.","The stopped clock","The storm swallows the lights. At 11:47, the grandfather clock stops.","The discovery","When the hall falls quiet, Great-Uncle Ambrose is found lifeless. The killer remains unknown."],
   train:["The midnight express","The Nocturne Express disappears into the mountain snow. Nobody can leave.","A final service","The passengers share one last meal. Their stories no longer agree.","The last whistle","The train jerks through the storm. A signal bell falls silent.","A locked carriage","The patron has been found dead. Every passenger holds a piece of the mystery."],
   ball:["The invitation","Masks and candlelight fill Ravensgate's grand ballroom.","The final waltz","As the orchestra plays, an unsigned invitation is passed between masked guests.","When the music stops","The chandelier dims. A clock strikes, and the dancers lose sight of one another.","Behind the mirrors","The host is found motionless beyond the mirrored doors. Which mask hides the truth?"],
   island:["The storm at sea","The lighthouse burns above Blackthorn Island as the last boat loses its way.","Stormbound strangers","The visitors seek shelter and discover the keeper has vanished from his rounds.","The warning bell","The signal lantern falters in the wind. The storm cuts the island off.","The keeper's silence","The keeper is found dead. The sea offers no witness, only unanswered questions."]
  };
  const words=intros[theme]||intros.manor;
  scenes=[
   {eyebrow:"ACT I · THE ARRIVAL",title:words[0],text:words[1],kind:"arrival",duration:8.5},
   {eyebrow:"ACT II · THE GATHERING",title:words[2],text:words[3],kind:"gathering",duration:8},
   {eyebrow:"ACT III · THE BLACKOUT",title:words[4],text:words[5],kind:"clock",duration:7.5},
   {eyebrow:"ACT IV · THE DISCOVERY",title:words[6],text:words[7],kind:"discovery",duration:8},
   {eyebrow:"ACT V · THE INVESTIGATION",title:"A sealed truth",text:detective?`${detective.name} arrives to investigate. ${detective.title}. Your task: discover who, how and where.`:"The evidence is sealed. Every detective holds only part of the truth. The investigation begins.",kind:"evidence",duration:8}
  ];
 }else if(type==="ending"){
  scenes=[
   {eyebrow:"THE FINAL ACT",title:g.winner?"The truth is spoken":"The case remains unsolved",text:c.ending||"The last witness finishes speaking.",kind:"clock",duration:6},
   {eyebrow:"THE REVELATION",title:g.winner?"Case closed":"Best Detective",text:g.winner?`${g.players[g.winner]?.nick||"A detective"} uncovered the truth. The sealed evidence is now released.`:"The murderer escapes conviction. The best investigator is recognised for their deductions.",kind:"discovery",duration:6},
   {eyebrow:"THE SEALED EVIDENCE",title:(g.solution||[]).map(id=>CARD[id]?.name||id).join(" · ")||"The final evidence",text:"The suspect, method and scene are revealed to every detective. The case has ended.",kind:"ending",duration:8}
  ];
 }else if(type==="event"){
  const entries={footsteps:{title:"Footsteps in the passage",text:"Someone crosses the hallway without a candle. The noise reveals no culprit; the evidence remains sealed."},letter:{title:"The missing letter",text:"An unsigned note is found. The words are unsettling, but only confirmed card evidence establishes the truth."},midnight:{title:"A bell without a witness",text:"A distant bell rings and a door closes. No alibi is safe from careful questioning."}};
  const e=entries[discovery?.scene]||entries.footsteps;
  scenes=[{eyebrow:"INTERLUDE · A MANOR SECRET",...e,kind:"event",duration:7}];
 }else scenes=[{eyebrow:"PRIVATE DISCOVERY",title:"A new thread emerges",text:"A card has been shown to you alone. Record the evidence in your notebook.",kind:"evidence",duration:6}];
 if(PLATFORM.cineTicker)clearInterval(PLATFORM.cineTicker);
 window.HollowmereCinema?.stop();
 PLATFORM.cine={type,theme,scenes,index:0,elapsed:0,soundOn:false,started:performance.now(),paused:!!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches};
 renderCinematic();
}
function cinematicElapsed(o){return o.elapsed+(o.paused?0:(performance.now()-o.started)/1000);}
function cinematicEnd(){
 const finished=PLATFORM.cine;
 if(finished?.type==="opening"&&S.game?.status==="playing"&&S.game.players?.[S.uid])api("cineReady").catch(()=>{});
 if(PLATFORM.cineTicker){clearInterval(PLATFORM.cineTicker);PLATFORM.cineTicker=null;}
 window.HollowmereCinema?.stop();window.HollowmereCinema?.sound(false);
 if("speechSynthesis" in window)speechSynthesis.cancel();
 PLATFORM.cine=null;renderCinematic();
}
function renderCinematic(){
 const el=$("#cinematic");if(!el)return;
 if(PLATFORM.cineTicker){clearInterval(PLATFORM.cineTicker);PLATFORM.cineTicker=null;}
 if(!PLATFORM.cine){el.hidden=true;el.innerHTML="";document.body.classList.remove("cinematic-open");return;}
 const o=PLATFORM.cine,sc=o.scenes[o.index];
 o.started=performance.now();
 const nr=o.index+1,total=o.scenes.length;
 el.hidden=false;document.body.classList.add("cinematic-open");
 el.innerHTML=`<section class="cine-reel" role="dialog" aria-modal="true" aria-labelledby="cineTitle" aria-describedby="cineSubtitle">
  <canvas class="cine-canvas" aria-label="Animated story: ${esc(sc.title)}"></canvas>
  <div class="cine-grade" aria-hidden="true"></div><div class="cine-letterbox top" aria-hidden="true"></div><div class="cine-letterbox bottom" aria-hidden="true"></div>
  <div class="cine-topline"><span>MURDER AT HOLLOWMERE</span><span>SCENE ${String(nr).padStart(2,"0")} / ${String(total).padStart(2,"0")}</span></div>
  <div class="cine-copy" aria-live="polite"><p class="cine-act">${esc(sc.eyebrow)}</p><h2 id="cineTitle">${esc(sc.title)}</h2><p id="cineSubtitle">${esc(sc.text)}</p></div>
  <div class="cine-toolbar"><div class="cine-time"><span class="cine-time-fill" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></span></div>
  <div class="cine-controls"><span class="cine-runtime">${nr} of ${total} scenes</span><button type="button" class="btn sm ghost" data-cine="skip">Skip film</button>
  <button type="button" class="btn sm ghost" data-cine="pause" aria-pressed="${o.paused}">${o.paused?"▶ Play":"Ⅱ Pause"}</button>
  ${window.AudioContext||window.webkitAudioContext?`<button type="button" class="btn sm ghost" data-cine="sound" aria-pressed="${!!o.soundOn}">${o.soundOn?"♪ Sound on":"♪ Sound off"}</button>`:""}
  ${"speechSynthesis" in window?`<button type="button" class="btn sm ghost" data-cine="narrate">Narrate</button>`:""}
  <button type="button" class="btn sm primary" data-cine="next">${nr===total?"Enter the investigation":"Next scene →"}</button></div></div>
 </section>`;
 const canvas=el.querySelector("canvas");
 window.HollowmereCinema?.mount(canvas,sc.kind,o.theme,()=>cinematicElapsed(o));
 const fill=el.querySelector(".cine-time-fill");
 PLATFORM.cineTicker=setInterval(()=>{
  if(PLATFORM.cine!==o)return;
  const fraction=Math.min(1,cinematicElapsed(o)/sc.duration);
  if(fill){fill.style.width=`${fraction*100}%`;fill.setAttribute("aria-valuenow",String(Math.round(fraction*100)));}
  if(fraction>=1&&!o.paused)cineAction("next");
 },100);
}
function cineAction(a){const o=PLATFORM.cine;if(!o)return;
 if(a==="narrate"){
  if("speechSynthesis" in window){speechSynthesis.cancel();const sc=o.scenes[o.index],u=new SpeechSynthesisUtterance(sc.title+". "+sc.text);u.rate=.86;u.pitch=.83;speechSynthesis.speak(u);}return;
 }
 if(a==="sound"){o.soundOn=!o.soundOn;o.soundOn=window.HollowmereCinema?.sound(o.soundOn)===true;const b=$("#cinematic [data-cine=sound]");if(b){b.textContent=o.soundOn?"♪ Sound on":"♪ Sound off";b.setAttribute("aria-pressed",String(o.soundOn));}return;}
 if(a==="pause"){
  o.elapsed=cinematicElapsed(o);o.paused=!o.paused;o.started=performance.now();
  const b=$("#cinematic [data-cine=pause]");if(b){b.textContent=o.paused?"▶ Play":"Ⅱ Pause";b.setAttribute("aria-pressed",String(o.paused));}return;
 }
 if("speechSynthesis" in window)speechSynthesis.cancel();
 if(a==="skip")return cinematicEnd();
 o.index++;
 if(o.index>=o.scenes.length)return cinematicEnd();
 o.elapsed=0;o.started=performance.now();renderCinematic();
}
async function voiceJoin(){if(!S.game?.settings?.voice||!S.game.players[S.uid])return;
 if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection){toast("This browser doesn't support microphone calls.");return;}
 try{PLATFORM.media=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});PLATFORM.voiceOn=true;for(const uid of Object.keys(S.game.players).filter(u=>u!==S.uid&&!S.game.players[u].bot&&!S.game.players[u].local))await voicePeer(uid,true);toast("Microphone connected. Other players must also join voice.");render();}
 catch(e){toast("Microphone permission or secure connection required.");}
}
function voiceLeave(){for(const [uid,p] of PLATFORM.peers){p.close();$("#voice-"+uid)?.remove();}PLATFORM.peers.clear();PLATFORM.pendingIce.clear();if(PLATFORM.media)PLATFORM.media.getTracks().forEach(t=>t.stop());PLATFORM.media=null;PLATFORM.voiceOn=false;render();}
async function voicePeer(to,offer){let p=PLATFORM.peers.get(to);if(p)return p;
 p=new RTCPeerConnection({iceServers:[{urls:"stun:stun.l.google.com:19302"}]});PLATFORM.peers.set(to,p);
 for(const t of PLATFORM.media.getAudioTracks())p.addTrack(t,PLATFORM.media);
 p.onicecandidate=e=>{if(e.candidate)api("voice",{to,kind:"ice",payload:e.candidate.toJSON()});};
 p.ontrack=e=>{let a=document.getElementById("voice-"+to);if(!a){a=document.createElement("audio");a.id="voice-"+to;a.autoplay=true;document.body.appendChild(a);}a.srcObject=e.streams[0];a.play().catch(()=>{});};
 p.onconnectionstatechange=()=>{if(["closed","failed"].includes(p.connectionState)){PLATFORM.peers.delete(to);p.close();}};
 if(offer){const o=await p.createOffer();await p.setLocalDescription(o);await api("voice",{to,kind:"offer",payload:{type:o.type,sdp:o.sdp}});}return p;
}
async function onVoice(d){if(!PLATFORM.voiceOn||!S.game||!S.game.players[d.from])return;
 try{if(d.kind==="bye"){PLATFORM.peers.get(d.from)?.close();PLATFORM.peers.delete(d.from);return;}
  const p=await voicePeer(d.from,false);
  if(d.kind==="offer"){await p.setRemoteDescription(new RTCSessionDescription(d.payload));const answer=await p.createAnswer();await p.setLocalDescription(answer);await api("voice",{to:d.from,kind:"answer",payload:{type:answer.type,sdp:answer.sdp}});}
  if(d.kind==="answer")await p.setRemoteDescription(new RTCSessionDescription(d.payload));
  if(d.kind==="ice"){
    if(!p.remoteDescription){const q=PLATFORM.pendingIce.get(d.from)||[];if(q.length<40)q.push(d.payload);PLATFORM.pendingIce.set(d.from,q);}
    else await p.addIceCandidate(new RTCIceCandidate(d.payload));
  }else if(p.remoteDescription){
    const q=PLATFORM.pendingIce.get(d.from)||[];PLATFORM.pendingIce.delete(d.from);
    for(const c of q)try{await p.addIceCandidate(new RTCIceCandidate(c));}catch(_){}
  }
 }catch(e){console.warn("Voice connection could not be established",e);}
}
function platformBound(){document.addEventListener("click",e=>{const b=e.target.closest("[data-cine]");if(b)cineAction(b.dataset.cine);});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&PLATFORM.cine)cineAction("skip");});document.addEventListener("submit",e=>{if(e.target.id!=="chatForm")return;e.preventDefault();const input=$("#chatMessage"),text=input?.value;if(!text?.trim())return;api("chat",{channel:PLATFORM.pan==="private"?"private":S.game?.players[S.uid]?"room":"spectators",to:$("#chatRecipient")?.value,text}).then(r=>{if(r.ok&&input)input.value="";else if(!r.ok)toast(r.error);});});document.addEventListener("change",e=>{if(e.target.id==="casePicker")PLATFORM_ACT.casechange();if(e.target.id==="chatChannel"){PLATFORM.pan=e.target.value;renderTable();}});setInterval(()=>{const c=$("#turnClock"),g=S.game;if(c&&g?.turnExpiresAt)c.textContent=g.pausedAt?"Paused":Math.max(0,Math.ceil((g.turnExpiresAt-Date.now())/1000))+"s";},1000);}


/* ---------- events ---------- */
function scrollToPanel(sel){setFull(false);setTimeout(()=>{const p=(sel&&$(sel))||$("#panel .panel.act")||$("#panel");if(p)p.scrollIntoView({behavior:REDUCED?"auto":"smooth",block:"start"});},60);}
const inGameSeat=()=>{const g=S.game;return !!(g&&g.status==="playing"&&mySeats(g).some(u=>(g.order||[]).includes(u)&&!(g.left&&g.left[u])));};
const ACT={
  create:()=>createTable(),
  open:d=>openTable(d.code),
  home:()=>{if(S.view==="table"&&inGameSeat()){S.sheet="leave";S.sheetConfirm=false;render();scrollToPanel("#panel .sheet");}else goHome();},
  gohome:async()=>{
    const g=S.game;
    if(g&&g.status==="playing"&&inGameSeat())await api("away",{v:true});
    goHome();
  },
  stay:()=>{S.sheet=null;S.sheetConfirm=false;render();},
  handover:async()=>{const sel=$("#hostTo");if(!sel)return;const to=sel.value;const r=await api("handover",{to});if(!r.ok){toast(r.error);return;}toast(`${nick(to)} is hosting now.`);},
  leavegame:()=>{S.sheetConfirm=true;render();},
  leavegameyes:async()=>{const r=await api("leave");if(!r.ok){toast(r.error);return;}S.sheet=null;S.sheetConfirm=false;goHome();},
  takeseat:()=>takeSeat(),
  leave:()=>leaveSeat(),
  kick:d=>kick(d.u),
  deal:()=>move("start"),
  hint:()=>move("hint"),
  pick:d=>{S.pick[d.k]=S.pick[d.k]===d.id?null:d.id;S.confirm=false;render();},
  ask:()=>ask(),
  mode:d=>{S.mode=d.mode||null;S.confirm=false;render();},
  accusenow:()=>{S.mode="accuse";S.confirm=false;render();scrollToPanel();},
  topanel:()=>scrollToPanel(),
  confirm:()=>{S.confirm=true;render();},
  unconfirm:()=>{S.confirm=false;render();},
  accuse:()=>accuse(),
  show:d=>move("show",{card:d.card}),
  endturn:()=>move("end"),
  away:async d=>{const r=await api("away",{seat:d.u,v:true});if(!r.ok)toast(r.error);},
  back:async()=>{const r=await api("away",{v:false});if(!r.ok)toast(r.error);},
  nudge:d=>nudge(d.u),
  become:d=>{S.as=d.u===S.uid?null:d.u;S.pick={s:null,m:null,r:null};S.mode=null;S.confirm=false;render();window.scrollTo(0,0);},
  rematch:()=>rematch(),
  endcase:()=>{S.sheet="end";render();scrollToPanel("#panel .sheet");},
  endcaseyes:async()=>{S.sheet=null;await move("endcase");},
  addbot:d=>addBot(d.lvl),
  localadd:()=>{S.addLocal=true;render();const i=$("#localName");if(i)i.focus();},
  localcancel:()=>{S.addLocal=false;render();},
  pickcharacter:d=>{if(S.busy)return;api("character",{seat:d.seat,character:d.character}).then(r=>{if(!r.ok)toast(r.error);});},
  copylink:()=>{if(S.code)copyText(inviteURL(S.code),"Invite link copied. Send it to the family.");},
  sharelink:()=>{if(!S.code||!navigator.share)return;navigator.share({title:"Murder at Hollowmere",text:`Join my murder mystery at Hollowmere. Table ${S.code}.`,url:inviteURL(S.code)}).catch(()=>{});},
  copyme:()=>copyText(myLink(),"Your private link is copied. Open it on your other device."),
  fullboard:()=>setFull(!S.full),
  fullexit:()=>scrollToPanel(),
  settings:()=>{S.settings=!S.settings;renderOverlays();},
  tab:d=>{S.tab=d.tab;render();},
  mark:d=>{const m=nbMarks();m[d.k]=CYCLE[m[d.k]||""];if(!m[d.k])delete m[d.k];saveNotebook();render();}
};
Object.assign(ACT,PLATFORM_ACT);
const MOVES=new Set(["ask","accuse","show","endturn","deal","rematch","endcaseyes"]);
function applySettings(){
  ls.set("hm.sound",S.sound?"1":"0");ls.set("hm.follow",S.follow?"1":"0");ls.set("hm.saver",S.saver?"1":"0");
  Stage.setFollow(S.follow);Stage.setSaver(S.saver);
}
function bind(){
  document.addEventListener("click",e=>{
    const b=e.target.closest("[data-act]");if(!b||b.disabled)return;
    if(S.busy&&MOVES.has(b.dataset.act))return;
    const f=ACT[b.dataset.act];if(f){e.preventDefault();f({...b.dataset},b);}
  });
  document.addEventListener("change",e=>{
    const k=e.target&&e.target.dataset&&e.target.dataset.set;
    if(k){S[k]=!!e.target.checked;applySettings();if(k==="sound"&&S.sound){unlockAudio();chime("turn");}}
    const seat=e.target&&e.target.dataset&&e.target.dataset.characterSeat;
    if(seat){api("character",{seat,character:e.target.value}).then(r=>{if(!r.ok)toast(r.error);});}
  });
  document.addEventListener("submit",e=>{
    const id=e.target&&e.target.id;
    if(id==="localForm"){e.preventDefault();addLocalSeat();}
    else if(id==="seatForm"){e.preventDefault();takeSeat();}
  });
  document.addEventListener("pointerdown",unlockAudio,{passive:true});
  document.addEventListener("keydown",unlockAudio);
  document.addEventListener("click",e=>{if(S.settings&&!e.target.closest("#settings")&&!e.target.closest(".set-open")){S.settings=false;renderOverlays();}});
  /* cards tilt toward the mouse, like holding them in your hand */
  if(window.matchMedia&&window.matchMedia("(hover:hover) and (pointer:fine)").matches&&!REDUCED){
    let cur=null;
    const reset=()=>{if(!cur)return;cur.classList.remove("tilt");["--rx","--ry","--mx","--my"].forEach(p=>cur.style.removeProperty(p));cur=null;};
    document.addEventListener("pointermove",e=>{
      const el=e.target&&e.target.closest?e.target.closest(".pc"):null;
      if(el!==cur)reset();
      if(!el)return;
      cur=el;const r=el.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
      el.classList.add("tilt");
      el.style.setProperty("--rx",((.5-y)*18).toFixed(1)+"deg");el.style.setProperty("--ry",((x-.5)*22).toFixed(1)+"deg");
      el.style.setProperty("--mx",Math.round(x*100)+"%");el.style.setProperty("--my",Math.round(y*100)+"%");
    },{passive:true});
    document.addEventListener("pointerleave",reset);
  }
  document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(S.full)setFull(false);if(S.settings){S.settings=false;renderOverlays();}}});
  $("#joinForm").addEventListener("submit",e=>{e.preventDefault();joinTable($("#joinCode").value);});
  $("#joinCode").addEventListener("input",e=>{const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,"");if(v!==e.target.value)e.target.value=v;});
  $("#nick").addEventListener("change",e=>{const v=cleanNick(e.target.value);if(v)ls.set("hm.nick",v);});
  /* the dock appears when the thing you must act on is off-screen */
  let vq=false;
  const onView=()=>{if(vq)return;vq=true;requestAnimationFrame(()=>{vq=false;const v=actionVisible();if(v!==S.panelVis){S.panelVis=v;renderOverlays();}});};
  window.addEventListener("scroll",onView,{passive:true});window.addEventListener("resize",onView,{passive:true});
  /* keep "waiting" lines fresh so the nudge button can appear */
  setInterval(()=>{if(S.view==="table"&&S.game&&S.game.status==="playing")renderSoon();},4000);
  /* a quiet connection is a dead one: pings arrive every 20 seconds */
  setInterval(()=>{if(S.conn==="ready"&&Date.now()-S.lastData>50000)connect();},10000);
  /* some free hosts sleep after 15 minutes without an incoming request; a visible page says hello every 4 minutes */
  setInterval(()=>{if(!document.hidden)fetch("healthz",{cache:"no-store"}).catch(()=>{});},240000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&(S.conn!=="ready"||Date.now()-S.lastData>30000))connect();});
  window.addEventListener("online",()=>{if(S.conn!=="ready")connect();});
  /* keep seat colours in step with the light or dark theme */
  try{window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>renderSoon());}catch(e){}
}

/* ---------- start-up ---------- */
function boot(){
  loadIdentity();
  $("#rulesHome").innerHTML=rulesHTML();
  $("#castHome").innerHTML=castHTML();
  $("#detectivesHome").innerHTML=detectiveRosterHTML();
  const n=ls.get("hm.nick");if(n)$("#nick").value=n;
  const small=window.matchMedia&&(window.matchMedia("(pointer:coarse)").matches||window.matchMedia("(max-width:720px)").matches);
  S.sound=ls.get("hm.sound")!=="0";S.follow=ls.get("hm.follow")!=="0";
  const sv=ls.get("hm.saver");S.saver=sv==null?!!small:sv==="1";
  Stage.onPick=(k,id)=>ACT.pick({k,id});
  Stage.setFollow(S.follow);Stage.setSaver(S.saver);
  bind();platformBound();
  const q=new URLSearchParams(location.search).get("t");
  const code=q&&/^[A-Za-z]{4}$/.test(q)?q.toUpperCase():null;
  if(code)openTable(code);
  else{
    const last=ls.get("hm.table");
    if(last&&/^[A-Z]{4}$/.test(last))openTable(last,true);
    else{render();connect();}
  }
  if(S.adopted)toast("This device now plays as you too.");
  Stage.load();
}
boot();
