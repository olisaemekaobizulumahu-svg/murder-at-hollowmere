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
function butlerPortrait(css="",extra=""){
  return `<img class="detective-portrait ${css} seat-butler-portrait" src="assets/detectives/fennimore.webp?v=${encodeURIComponent(BUILD_VERSION)}" alt="Portrait of Fennimore the butler" width="240" height="300" loading="eager" decoding="async" ${extra}>`;
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
/* Fixed illustrations are indexed by the trusted 18-card deck; never by user input. */
const gothicCardArt=id=>`assets/cards/${encodeURIComponent(id)}.svg?v=${encodeURIComponent(BUILD_VERSION)}`;
const gothicMini=id=>`<img class="gothic-mini" src="${gothicCardArt(id)}" width="28" height="36" alt="" aria-hidden="true" decoding="async">`;
const ref=id=>{const c=CARD[id];return c?`<span class="ref ${KCLS[c.k]}">${gothicMini(c.id)}<span>${esc(c.name)}</span></span>`:"";};
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
  const inner=`<span class="pc-crown" aria-hidden="true">✦ ❧ ✦</span><span class="pc-k">${KLAB[c.k]}</span><span class="pc-i" aria-hidden="true"><img class="pc-art" src="${gothicCardArt(c.id)}" width="260" height="340" alt="" decoding="async" loading="eager"></span><span class="pc-n">${esc(c.name)}</span><span class="pc-filigree" aria-hidden="true">❦</span>${o.tag?`<span class="pc-tag">${esc(o.tag)}</span>`:""}`;
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
    const label=isB?"Fennimore the Butler":nick(u,g)+(u===ME()?" (you)":"");
    const sub=isB?"House helper · ":bot?"Computer · ":isLocal(g,u)?`On ${shortNick(nick(g.players[u].local,g))}'s device · `:"";
    const portrait=isB?butlerPortrait("seat-portrait"):detectivePortrait(DETECTIVE_BY_ID[g.players[u]?.character]||DETECTIVES[0],"seat-portrait");
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
    return `<button type="button" class="${cls}" data-act="pick" data-k="${k}" data-id="${c.id}" aria-pressed="${on}">${gothicMini(c.id)}<span>${esc(c.short)}</span>${mine?'<span class="mine">yours</span>':""}</button>`;
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
      body+=`<tr class="${rcls}"><th scope="row"><span class="i" aria-hidden="true">${gothicMini(c.id)}</span>${esc(c.name)}</th>${cells}</tr>`;
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
