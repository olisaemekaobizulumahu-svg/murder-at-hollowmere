/* Murder at Hollowmere: the game server.

   It serves the page and runs every table. The server deals the cards and keeps the envelope,
   every hand and every shown card to itself. Each device is sent only what its own seats may
   see: its hands and the cards shown to or by them. Computer detectives and Fennimore the
   butler play here, so no player's device ever knows their cards. Accusations are checked
   here the moment they're made. If someone drops out, the server answers or skips for them.

   No dependencies: Node 18 or newer. Start with `node server.js`. */
"use strict";
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),zlib=require("zlib");
const HM=require("./public/rules.js");
const CASES=require("./public/cases.js");
const {SUSPECTS,METHODS,ROOMS,DETECTIVES,DETECTIVE_BY_ID,OPENINGS,CARD,ALL,MAX_SEATS,holdersOf,nextTurn,queueFor,actor,matches,seated,validTrio}=HM;

const ENV=process.env;
const PORT=Number(ENV.PORT)||8080;
const HOST=ENV.HOST||"0.0.0.0";
const DATA_DIR=ENV.DATA_DIR||path.join(__dirname,"data");
const STATE_FILE=path.join(DATA_DIR,"state.json");
const PUBLIC_DIR=path.join(__dirname,"public");
const PACE=Math.max(.01,Number(ENV.BOT_PACE)||1);               // speed of computer players and automatic moves
const OFFLINE_ANSWER_MS=Number(ENV.OFFLINE_ANSWER_MS)||30000;     // answer for someone whose page has been closed this long
const IDLE_ANSWER_MS=Number(ENV.IDLE_ANSWER_MS)||180000;          // or who has left a question unanswered this long
const OFFLINE_TURN_MS=Number(ENV.OFFLINE_TURN_MS)||90000;         // skip the turn of someone whose page has been closed this long
const IDLE_TURN_MS=Number(ENV.IDLE_TURN_MS)||300000;              // or who has sat on their own turn this long
const HOST_GONE_MS=Number(ENV.HOST_GONE_MS)||60000;               // pass hosting on when the host's page has been closed this long
const MAX_TABLES=Number(ENV.MAX_TABLES)||1500;
const TRUST_PROXY=ENV.TRUST_PROXY!=="0";
const RATE=Math.max(1,Number(ENV.RATE_MULT)||1);                  // raise the flood limits (for testing)
const BOOT=Date.now();

/* ---------- small helpers ---------- */
const rnd=n=>crypto.randomInt(n);
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=rnd(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
const CODE_CHARS="ABCDEFGHJKLMNPQRSTUVWXYZ";
const rid=()=>crypto.randomBytes(6).toString("hex");
const now=()=>Date.now();
class Refusal extends Error{constructor(msg,status){super(msg);this.status=status||400;}}
const refuse=(msg,status)=>{throw new Refusal(msg,status);};
function cleanName(v,fallback){
  const s=String(v==null?"":v).normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g,"").replace(/\s+/g," ").trim();
  return [...s].slice(0,16).join("")||fallback||"";
}
const BOT_NAMES=["Inspector Pike","Miss Marigold","Constable Higgs","Dr. Quill","Lady Ashcombe","Professor Moth","Sergeant Wren","Madame Voss"];

/* ---------- devices: a random id and secret made by each browser, no accounts ---------- */
const devices=new Map();
/* Optional password accounts. Device secrets and account identities are separate. */
const accounts=new Map(); // username -> {salt,hash,display,xp,games,wins,friends,requests,achievements,createdAt}
const community=new Map(); // custom case id -> {owner,caseData,status,reports}
const tournaments=new Map(); // id -> {owner,title,members,scores,createdAt}
const isHandle=s=>/^[a-z][a-z0-9_]{2,19}$/.test(s);
const handleOf=v=>String(v||"").trim().toLowerCase();
function passwordHash(pass,salt){return crypto.scryptSync(pass,salt,32).toString("hex");}
function accountOf(pid){const d=devices.get(pid);return d&&d.account&&accounts.get(d.account)||null;}
function profileOf(pid){const a=accountOf(pid);if(!a)return null;return {handle:a.handle,display:a.display,xp:a.xp||0,level:1+Math.floor(Math.sqrt((a.xp||0)/100)),games:a.games||0,wins:a.wins||0,friends:a.friends||[],requests:a.requests||[],achievements:a.achievements||[],rank:a.rank||1000,invitations:a.invitations||[]};}
function publicProfile(a){return {handle:a.handle,display:a.display,xp:a.xp||0,level:1+Math.floor(Math.sqrt((a.xp||0)/100)),games:a.games||0,wins:a.wins||0,achievements:a.achievements||[],rank:a.rank||1000};}
function ownedCase(pid,caseId){
  const base=CASES.BY_ID[caseId||"hollowmere"];
  if(base)return base;
  const c=community.get(caseId),a=accountOf(pid);
  if(c&&(c.status==="approved"||(a&&c.owner===a.handle)))return c.caseData;
  refuse("That case is not available.");
}
function caseSummary(pid){const a=accountOf(pid);return [...CASES.CASES,...[...community.values()].filter(c=>c.status==="approved"||(a&&c.owner===a.handle)).map(c=>({...c.caseData,status:c.status}))].map(c=>({id:c.id,title:c.title,tagline:c.tagline||"",status:c.status||"official"}));}
   // pid -> {h: hash of the secret, seen}
const PID_RE=/^u_[A-Za-z0-9]{16,32}$/,KEY_RE=/^[A-Za-z0-9]{24,64}$/;
const hashKey=k=>crypto.createHash("sha256").update(k).digest();
function auth(pid,key,ip){
  if(typeof pid!=="string"||typeof key!=="string"||!PID_RE.test(pid)||!KEY_RE.test(key))return false;
  const d=devices.get(pid),h=hashKey(key);
  if(!d){
    if(!allow("newdev:"+ip,1,40,40/3600))return "limit";
    if(devices.size>=200000)pruneDevices(true);
    devices.set(pid,{h:h.toString("base64"),seen:now()});markDirty();return true;
  }
  const want=Buffer.from(d.h,"base64");
  if(want.length!==h.length||!crypto.timingSafeEqual(want,h))return false;
  d.seen=now();return true;
}

/* ---------- tables ----------
   A table's public fields are what every device sees. `secret` never leaves the server:
   the hands, the envelope, which card each "show" was, and the envelope as seen by a
   wrong accuser. */
const tables=new Map();
const RT=new Map();        // runtime-only per table: timers, presence
function rt(T){let r=RT.get(T.code);if(!r){r={timer:null,key:null,keyAt:now(),jit:Math.random(),seen:{},bq:false};RT.set(T.code,r);}return r;}
function newCode(){
  for(let t=0;t<200;t++){let s="";for(let i=0;i<4;i++)s+=CODE_CHARS[rnd(CODE_CHARS.length)];if(!tables.has(s))return s;}
  refuse("The manor is full right now. Try again in a few minutes.",503);
}
function logp(T,...entries){
  const out=[];
  for(const e of entries){T.seq=(T.seq||0)+1;const x={n:T.seq,at:now(),...e};T.log.push(x);out.push(x);}
  if(T.log.length>600)T.log=T.log.slice(-600);
  return out;
}
const isBot=(T,u)=>!!(T.players[u]&&T.players[u].bot);
/* who plays a seat: a person's own device, the device a pass-the-phone guest sits at, or the server */
function controllerOf(T,u){
  if(u==="butler")return null;
  const p=T.players[u];if(!p)return null;
  if(p.bot)return null;
  if(p.local)return p.local;
  return u;
}
const controls=(T,seat,pid)=>!!pid&&controllerOf(T,seat)===pid;
function seatsOf(T,pid){
  if(!T.players[pid])return [];
  return [pid,...Object.keys(T.players).filter(u=>T.players[u]&&T.players[u].local===pid)];
}
const humans=T=>seated(T).filter(u=>!T.players[u].bot&&!T.players[u].local);

/* ---------- presence: which devices have this table open ---------- */
const streams=new Set();   // {pid, code, res}
function connected(code,pid){for(const s of streams)if(s.code===code&&s.pid===pid)return true;return false;}
function onlineList(T){const o=new Set();for(const s of streams)if(s.code===T.code)o.add(s.pid);return [...o];}
function offlineSince(T,pid){
  if(!pid)return null;
  if(connected(T.code,pid))return null;
  const r=rt(T);return r.seen[pid]||Math.max(BOOT,T.startedAt||T.createdAt||BOOT);
}

/* ---------- what each device is allowed to see ---------- */
function publicJSON(T){
  const {secret,messages,...pub}=T;
  if(pub.status!=="over")pub.solution=null;
  if(T.status==="over"&&secret&&secret.hands)pub.allHands=secret.hands;
  delete pub.chatReports;
  return JSON.stringify(pub);
}
function privateFor(T,pid){
  const mine=new Set(seatsOf(T,pid)),hands={},dec={},s=T.secret;
  if(s&&s.hands){
    for(const u of mine)if(s.hands[u])hands[u]=s.hands[u];
    for(const e of T.log){
      if(e.t==="show"&&(mine.has(e.to)||mine.has(e.who))&&s.shown[e.n])dec[e.n]={card:s.shown[e.n]};
    }
  }
  const hints={},score={};
  for(const u of mine){
    hints[u]=((s&&s.hints)||{})[u]||[];
    score[u]=((s&&s.progress)||{})[u]||null;
  }
  const chat=(T.messages||[]).filter(m=>(m.channel==="room"&&!!T.players[pid])||(m.channel==="spectators"&&!T.players[pid])||(m.channel==="private"&&(m.from===pid||m.to===pid)));
  return {hands,dec,hints,score,chat:chat.slice(-100),prediction:(s&&s.predictions&&s.predictions[pid])||null};
}
function viewString(T,pid,pubStr,online){
  return `{"g":${pubStr},"mine":${JSON.stringify(privateFor(T,pid))},"online":${JSON.stringify(online)},"me":${JSON.stringify(pid)},"profile":${JSON.stringify(profileOf(pid))}}`;
}
function tableSummary(T,pid){
  const a=actor(T),mine=seatsOf(T,pid),nickOf=u=>u==="butler"?"Fennimore":(T.players[u]&&T.players[u].nick)||"A detective";
  const yourMove=T.status==="playing"&&mine.includes(a)&&T.phase!=="judging"&&!(T.away&&T.away[a])&&
    !(T.phase==="asking"&&!matches(T.secret.hands[a],T.q.cards).length);
  return {code:T.code,status:T.status,host:nickOf(T.hostId),n:seated(T).length,turn:T.turn?nickOf(T.turn):null,yourMove,updatedAt:T.updatedAt,next:T.next||null};
}
function myTables(pid){
  const out=[],t0=now()-7*864e5;
  for(const T of tables.values()){
    if(!T.players[pid]||T.updatedAt<t0)continue;
    if(T.status==="closed")continue;
    if(T.status==="over"&&(T.next||now()-(T.endedAt||T.updatedAt)>6*3600e3))continue;
    out.push(tableSummary(T,pid));
  }
  return out.sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,20);
}

/* ---------- pushing updates down the open streams ---------- */
function send(s,event,data){try{s.res.write(`event: ${event}\ndata: ${data}\n\n`);}catch(e){}}
function broadcast(T){
  const r=rt(T);if(r.bq)return;r.bq=true;
  setTimeout(()=>{
    r.bq=false;
    const pub=publicJSON(T),online=onlineList(T);
    for(const s of streams){
      if(s.code===T.code)send(s,"state",viewString(T,s.pid,pub,online));
      else if(!s.code&&T.players[s.pid])send(s,"tables",JSON.stringify(myTables(s.pid)));
    }
  },15);
}
function touch(T){
  if(T.status==="playing"&&["turn","asked"].includes(T.phase)){
    const stamp=T.turn+":"+T.phase;
    if(T.clockStamp!==stamp){T.clockStamp=stamp;T.turnExpiresAt=T.settings&&T.settings.turnSeconds?now()+1000*T.settings.turnSeconds:null;}
  }else{T.clockStamp=null;T.turnExpiresAt=null;}
  if(T.status==="over"&&!T.settled){
    T.settled=true;
    const predictions=T.secret&&T.secret.predictions||{};
    T.spectatorRankings=Object.entries(predictions).map(([pid,p])=>{
      const correct=p.cards.filter((c,i)=>T.secret.sol[i]===c).length;
      const points=correct===3?120:correct*25;
      const a=accountOf(pid);
      if(a){a.xp=(a.xp||0)+Math.min(60,10+points/3);if(correct===3){const achievements=new Set(a.achievements||[]);achievements.add("Spectator Oracle");a.achievements=[...achievements];}}
      return {nick:p.nick,points,correct};
    }).sort((a,b)=>b.points-a.points||a.nick.localeCompare(b.nick));
    for(const u of T.order||[]){
      const ctl=controllerOf(T,u),a=ctl&&accountOf(ctl);if(!a||T.players[u].bot||T.players[u].local)continue;
      const pg=T.secret&&T.secret.progress&&T.secret.progress[u]||{};
      const gained=25+Math.min(80,(pg.questions||0)*3)+Math.min(60,(pg.discoveries||0)*5)+(T.winner===u?120:0)+(T.bestDetective===u?40:0);
      a.games=(a.games||0)+1;a.xp=(a.xp||0)+gained;
      if(T.winner===u)a.wins=(a.wins||0)+1;
      if(T.mode==="ranked"&&T.order.every(k=>!T.players[k].bot))a.rank=Math.max(100,Math.min(3000,(a.rank||1000)+(T.winner===u?24:-8)));
      const ach=new Set(a.achievements||[]);ach.add("First Investigation");if(T.winner===u)ach.add("Case Closed");if(a.wins>=5)ach.add("Five Victories");if(T.winner===u&&!((T.secret.hints||{})[u]||[]).length)ach.add("Unaided Detective");a.achievements=[...ach];
      if(T.tournamentId&&tournaments.has(T.tournamentId)){const tour=tournaments.get(T.tournamentId);if(tour.members.includes(a.handle))tour.scores[a.handle]=(tour.scores[a.handle]||0)+(T.winner===u?100:20);}
    }
  }
  T.rev=(T.rev||0)+1;T.updatedAt=now();
  markDirty();broadcast(T);
  setImmediate(()=>autoStep(T));
}

/* ---------- the rules, run by the server ---------- */
function startGame(T){
  const order=seated(T);
  if(order.length>MAX_SEATS)refuse("The table has too many detectives.");
  if(order.length<2)refuse("You need at least two detectives.");
  const butler=order.length===2;
  const pick=l=>l[rnd(l.length)].id;
  const sol=[pick(SUSPECTS),pick(METHODS),pick(ROOMS)];
  const rest=shuffle(ALL.filter(c=>!sol.includes(c)));
  const holders=[...order,...(butler?["butler"]:[])];
  // Deal every non-solution card, one at a time, to make 7–8 seat games viable.
  // Every pair of hands differs in size by no more than one card.
  const hands={},handSize={};
  holders.forEach(h=>{hands[h]=[];});
  rest.forEach((c,i)=>hands[holders[i%holders.length]].push(c));
  holders.forEach(h=>{handSize[h]=hands[h].length;});
  const first=order[rnd(order.length)];
  Object.assign(T,{status:"playing",order,butler,first,turn:first,phase:"turn",q:null,acc:null,out:{},away:{},left:{},revealed:{},
    opening:OPENINGS[rnd(OPENINGS.length)],finalRound:false,bestDetective:null,rankings:null,
    faceUp:[],handSize,winner:null,solution:null,startedAt:now(),endedAt:null,log:[],seq:0});
  const progress={};for(const u of order)progress[u]={points:20,questions:0,discoveries:0,accusations:0,asked:[]};
  T.secret={hands,sol,shown:{},autoAway:{},hints:{},progress};
  logp(T,{t:"start",first});
}
function askAs(T,by,cards){
  if(T.status!=="playing"||T.phase!=="turn"||T.turn!==by)refuse("It isn't your turn to ask.");
  if(!validTrio(cards))refuse("Pick one relative, one method and one room.");
  const queue=queueFor(T,by);
  const track=T.secret.progress&&T.secret.progress[by];
  if(track){
    const key=cards.join("|");
    if(!track.asked.includes(key)){
      track.asked.push(key);track.questions++;track.points+=3;
    }
  }
  logp(T,{t:"ask",by,c:cards});
  const askedCount=T.log.filter(e=>e.t==="ask").length;
  if([3,7,12].includes(askedCount))logp(T,{t:"story",scene:askedCount===3?"footsteps":askedCount===7?"letter":"midnight"});
  if(!queue.length){logp(T,{t:"none",by});Object.assign(T,{phase:"asked",q:{by,cards,queue:[],step:0,shownBy:null}});return;}
  Object.assign(T,{phase:"asking",q:{by,cards,queue,step:0,shownBy:null}});
}
function passStep(T,who,t){
  const q=T.q,last=q.step+1>=q.queue.length;
  logp(T,{t,who,c:q.cards});
  if(last)logp(T,{t:"none",by:q.by});
  T.q={...q,step:q.step+1,shownBy:null};
  if(last)T.phase="asked";
}
function showAs(T,who,card,auto){
  const q=T.q;
  if(T.status!=="playing"||T.phase!=="asking"||!q||q.queue[q.step]!==who)refuse("It isn't your turn to answer.");
  if(!q.cards.includes(card)||!(T.secret.hands[who]||[]).includes(card))refuse("You can only show one of the three asked cards, from your own hand.");
  const [e]=logp(T,{t:"show",who,to:q.by,c:q.cards,...(auto?{auto:1}:{})});
  T.secret.shown[e.n]=card;
  const track=T.secret.progress&&T.secret.progress[q.by];
  if(track){
    const seen=T.log.some(v=>v.n<e.n&&v.t==="show"&&v.to===q.by&&T.secret.shown[v.n]===card);
    const hinted=((T.secret.hints||{})[q.by]||[]).some(v=>v.card===card);
    if(!seen&&!hinted){track.discoveries++;track.points+=5;}
  }
  T.q={...q,shownBy:who};T.phase="asked";
}
function passAs(T,who){
  const q=T.q;
  if(T.status!=="playing"||T.phase!=="asking"||!q||q.queue[q.step]!==who)refuse("It isn't your turn to answer.");
  if(matches(T.secret.hands[who],q.cards).length)refuse("You hold one of those cards, so you must show it.");
  passStep(T,who,"pass");
}
function endUnsolved(T){
  T.rankings=rankPlayers(T);
  T.bestDetective=T.rankings.length?T.rankings[0].seat:null;
  logp(T,{t:"escape"});
  Object.assign(T,{status:"over",phase:"done",winner:null,solution:T.secret.sol,acc:null,endedAt:now()});
}
function endTurnAs(T,by){
  if(T.status!=="playing"||T.turn!==by||T.phase!=="asked")refuse("You can't end the turn right now.");
  if(T.finalRound){endUnsolved(T);return;}
  const nt=nextTurn(T,by);
  logp(T,{t:"turn",who:nt});Object.assign(T,{phase:"turn",turn:nt,q:null});
}
function skipTurn(T,who){
  if(T.status!=="playing"||T.turn!==who||!["turn","asked"].includes(T.phase))return;
  if(T.finalRound){endUnsolved(T);return;}
  const nt=nextTurn(T,who);
  logp(T,{t:"skip",who},{t:"turn",who:nt});Object.assign(T,{phase:"turn",turn:nt,q:null});
}
function accuseAs(T,by,cards){
  if(T.status!=="playing"||T.turn!==by||!["turn","asked"].includes(T.phase))refuse("You can accuse only on your own turn.");
  if(T.out[by])refuse("You've already made your accusation.");
  if(!validTrio(cards))refuse("Name one relative, one method and one room.");
  logp(T,{t:"accuse",by,c:cards});
  Object.assign(T,{phase:"judging",acc:{by,cards}});
}
function rankPlayers(T){
  const p=(T.secret&&T.secret.progress)||{};
  return (T.order||[]).map(seat=>({seat,nick:T.players[seat]?T.players[seat].nick:"Detective",
    points:(p[seat]&&p[seat].points)||0,questions:(p[seat]&&p[seat].questions)||0,
    discoveries:(p[seat]&&p[seat].discoveries)||0,accusations:(p[seat]&&p[seat].accusations)||0}))
    .sort((a,b)=>b.points-a.points||b.discoveries-a.discoveries||b.questions-a.questions||(T.order.indexOf(a.seat)-T.order.indexOf(b.seat)));
}
function verdict(T){
  if(T.status!=="playing"||T.phase!=="judging"||!T.acc)return;
  const by=T.acc.by,sol=T.secret.sol;
  if(T.acc.cards.every((c,i)=>c===sol[i])){
    if(T.secret.progress&&T.secret.progress[by]){T.secret.progress[by].points+=100;T.secret.progress[by].accusations++;}
    T.rankings=rankPlayers(T);
    logp(T,{t:"win",by,c:T.acc.cards});
    Object.assign(T,{status:"over",phase:"done",winner:by,solution:sol,endedAt:now()});
    return;
  }
  logp(T,{t:"wrong",by});
  T.out={...T.out,[by]:true};
  if(T.secret.progress&&T.secret.progress[by]){
    T.secret.progress[by].accusations++;
    T.secret.progress[by].points=Math.max(0,T.secret.progress[by].points-10);
  }
  const eligible=T.order.filter(u=>!T.out[u]);
  if(!eligible.length){endUnsolved(T);return;}
  if(eligible.length===1&&!T.finalRound){
    T.finalRound=true;
    logp(T,{t:"final",who:eligible[0]});
  }
  const nt=nextTurn(T,by);
  logp(T,{t:"turn",who:nt});Object.assign(T,{phase:"turn",turn:nt,q:null,acc:null});
}
function leaveForGood(T,seat){
  if(T.status!=="playing"||T.left[seat]||!T.order.includes(seat))return;
  const wasActor=T.phase==="asking"&&actor(T)===seat,wasTurn=T.turn===seat&&["turn","asked"].includes(T.phase);
  T.left={...T.left,[seat]:true};T.out={...T.out,[seat]:true};T.away={...T.away,[seat]:false};
  T.revealed={...T.revealed,[seat]:T.secret.hands[seat]||[]};
  logp(T,{t:"left",who:seat});
  if(!T.order.some(u=>!T.out[u])){
    T.rankings=rankPlayers(T);
    logp(T,{t:"abandon"});
    Object.assign(T,{status:"over",phase:"done",winner:null,solution:T.secret.sol,endedAt:now()});
    return;
  }
  if(wasTurn){const nt=nextTurn(T,seat);logp(T,{t:"turn",who:nt});Object.assign(T,{phase:"turn",turn:nt,q:null});}
  else if(wasActor)passStep(T,seat,"skipq");
}
/* answer for someone: show a card they've already shown this asker if they can, so nothing new is given away */
function autoShow(T,who,auto){
  const q=T.q,m=matches(T.secret.hands[who],q.cards);
  if(!m.length){passStep(T,who,"pass");return;}
  const before=m.filter(c=>T.log.some(e=>e.t==="show"&&e.who===who&&e.to===q.by&&T.secret.shown[e.n]===c));
  const pool=before.length?before:m;
  showAs(T,who,pool[rnd(pool.length)],auto);
}

/* ---------- computer detectives ----------
   They reason only from what a player in their seat would know: their own hand, the face-up
   cards, cards shown to them, and what happened at the table. Rookies only use their hand,
   face-up cards and cards shown to them; sharp ones use every pass and every answer. */
function deduce(g,me,hand,sharp,dec){
  const H=holdersOf(g),M={},cons=[],FU=new Set(g.faceUp||[]),env={},size=g.handSize||{};
  ALL.forEach(c=>{M[c]={};});
  let changed=true;
  const set=(c,h,v)=>{if(M[c][h]===undefined){M[c][h]=v;changed=true;}};
  FU.forEach(c=>H.forEach(h=>set(c,h,0)));
  ALL.forEach(c=>set(c,me,hand.includes(c)?1:0));
  for(const u in (g.revealed||{})){const r=g.revealed[u]||[];ALL.forEach(c=>set(c,u,r.includes(c)?1:0));}
  for(const e of g.log||[]){
    if(e.t==="show"&&e.to===me){const d=dec[e.n];if(d&&d.card)set(d.card,e.who,1);}
    if(!sharp)continue;
    if(e.t==="pass"&&e.c)e.c.forEach(c=>set(c,e.who,0));
    else if(e.t==="show"&&e.to!==me&&e.who!==me&&e.c)cons.push({h:e.who,c:e.c});
  }
  const cats=["s","m","r"].map(k=>ALL.filter(c=>CARD[c].k===k));
  for(let it=0;it<80&&changed;it++){
    changed=false;
    for(const c of ALL){
      if(FU.has(c))continue;
      const yes=H.find(h=>M[c][h]===1);
      if(yes)H.forEach(h=>{if(h!==yes)set(c,h,0);});
      else if(H.every(h=>M[c][h]===0)&&!env[c]){env[c]=true;changed=true;}
    }
    for(const cat of cats){
      let e1=cat.find(c=>env[c]);
      if(!e1){const possible=cat.filter(c=>!FU.has(c)&&!H.some(h=>M[c][h]===1));if(possible.length===1){e1=possible[0];env[e1]=true;changed=true;}}
      if(!e1)continue;
      H.forEach(h=>set(e1,h,0));
      for(const c of cat){
        if(c===e1||FU.has(c)||H.some(h=>M[c][h]===1))continue;
        const cand=H.filter(h=>M[c][h]!==0);if(cand.length===1)set(c,cand[0],1);
      }
    }
    if(sharp){
      for(const h of H){
        const n=size[h];if(n==null)continue;
        const yes=ALL.filter(c=>M[c][h]===1).length,unk=ALL.filter(c=>M[c][h]===undefined);
        if(!unk.length)continue;
        if(yes===n)unk.forEach(c=>set(c,h,0));
        else if(yes+unk.length===n)unk.forEach(c=>set(c,h,1));
      }
      for(const k of cons){
        if(k.c.some(c=>M[c][k.h]===1))continue;
        const cand=k.c.filter(c=>M[c][k.h]!==0);if(cand.length===1)set(cand[0],k.h,1);
      }
    }
  }
  const sol=cats.map(cat=>cat.find(c=>env[c])||null);
  return {M,H,FU,sol,solved:sol.every(Boolean),hand,sharp};
}
function botQuestion(kb){
  return ["s","m","r"].map((k,i)=>{
    const cat=ALL.filter(c=>CARD[c].k===k),mine=cat.filter(c=>kb.hand.includes(c)),env=kb.sol[i];
    const unknown=cat.filter(c=>!kb.FU.has(c)&&c!==env&&!kb.H.some(h=>kb.M[c][h]===1));
    if(env||!unknown.length){const safe=[...mine,...(env?[env]:[])];return safe.length?safe[rnd(safe.length)]:cat[rnd(cat.length)];}
    if(!kb.sharp){if(mine.length&&Math.random()<.2)return mine[rnd(mine.length)];return unknown[rnd(unknown.length)];}
    let best=[],bs=-1;
    for(const c of unknown){const s=kb.H.filter(h=>kb.M[c][h]===undefined).length;if(s>bs){bs=s;best=[c];}else if(s===bs)best.push(c);}
    return best[rnd(best.length)];
  });
}
function botMind(T,bot){
  const dec={};
  for(const e of T.log)if(e.t==="show"&&e.to===bot&&T.secret.shown[e.n])dec[e.n]={card:T.secret.shown[e.n]};
  return deduce(T,bot,T.secret.hands[bot]||[],T.players[bot].bot!=="rookie",dec);
}
/* A Master tracks the answers and card-holder possibilities available to their seat.
   It asks high-information, less-repeated combinations; it cannot read the sealed envelope. */
function masterQuestion(T,bot,kb){
  const prior=(T.log||[]).filter(e=>e.t==="ask"&&e.by===bot).map(e=>(e.c||[]).join("|"));
  const options=["s","m","r"].map((k,i)=>{
    const cat=ALL.filter(c=>CARD[c].k===k),mine=cat.filter(c=>kb.hand.includes(c));
    const unresolved=cat.filter(c=>!kb.FU.has(c)&&c!==kb.sol[i]&&!kb.H.some(h=>kb.M[c][h]===1));
    if(!unresolved.length)return (mine.length?mine:cat).slice(0,1);
    return unresolved.sort((a,b)=>{
      const score=c=>kb.H.filter(h=>kb.M[c][h]===undefined).length*3- prior.filter(q=>q.split("|").includes(c)).length*2;
      return score(b)-score(a);
    }).slice(0,4);
  });
  let best=null,bestScore=-Infinity;
  for(const a of options[0])for(const b of options[1])for(const c of options[2]){
    const cards=[a,b,c],key=cards.join("|"),repeat=prior.filter(v=>v===key).length;
    let score=0;
    for(const card of cards)score+=kb.H.filter(h=>kb.M[card][h]===undefined).length;
    score-=repeat*20;
    // Break ties unpredictably so humans cannot infer the AI's private deductions.
    score+=Math.random()*.25;
    if(score>bestScore){bestScore=score;best=cards;}
  }
  return best||botQuestion(kb);
}
function botTurn(T,bot){const kb=botMind(T,bot);if(kb.solved)accuseAs(T,bot,kb.sol);else askAs(T,bot,T.players[bot].bot==="master"?masterQuestion(T,bot,kb):botQuestion(kb));}
function botAfter(T,bot){const kb=botMind(T,bot);if(kb.solved)accuseAs(T,bot,kb.sol);else endTurnAs(T,bot);}
function botAnswer(T,bot){
  const q=T.q,m=matches(T.secret.hands[bot],q.cards);
  if(!m.length){passStep(T,bot,"pass");return;}
  let pool=m;
  if(bot==="butler"||T.players[bot].bot!=="rookie"){
    const before=m.filter(c=>T.log.some(e=>e.t==="show"&&e.who===bot&&e.to===q.by&&T.secret.shown[e.n]===c));
    if(before.length)pool=before;
  }
  showAs(T,bot,pool[rnd(pool.length)]);
}

/* ---------- automatic moves: computer players, people who have stepped away, verdicts ---------- */
function stateKey(T){const a=actor(T);return `${T.status}|${T.phase}|${a}|${T.seq}|${a&&T.away&&T.away[a]?1:0}`;}
function plan(T,r){
  const a=actor(T),at=(base,spread)=>r.keyAt+(base+spread*r.jit)*PACE;
  if(T.phase==="judging")return {at:at(2400,0),run:()=>verdict(T)};
  if(!a)return null;
  if(a==="butler")return {at:at(1300,700),run:()=>botAnswer(T,"butler")};
  const p=T.players[a];if(!p)return null;
  if(p.bot){
    if(T.phase==="asking")return {at:at(1200,900),run:()=>botAnswer(T,a)};
    if(T.phase==="turn")return {at:at(1900,1300),run:()=>botTurn(T,a)};
    if(T.phase==="asked")return {at:at(1700,900),run:()=>botAfter(T,a)};
    return null;
  }
  if(T.left[a])return {at:at(500,0),run:()=>{if(T.phase==="asking")passStep(T,a,"skipq");else skipTurn(T,a);}};
  const ctl=controllerOf(T,a),off=offlineSince(T,ctl);
  if(T.phase==="asking"){
    if(!matches(T.secret.hands[a],T.q.cards).length)return {at:at(1000,500),run:()=>passStep(T,a,"pass")};
    if(T.away[a])return {at:at(1300,600),run:()=>autoShow(T,a,true)};
    const due=Math.min(off==null?Infinity:Math.max(off+OFFLINE_ANSWER_MS,r.keyAt+3000),r.keyAt+IDLE_ANSWER_MS);
    return {at:due,run:()=>autoShow(T,a,true)};
  }
  if(T.away[a])return {at:at(900,0),run:()=>skipTurn(T,a)};
  if(T.turnExpiresAt&&["turn","asked"].includes(T.phase)&&T.turnExpiresAt<now()+600)return {at:T.turnExpiresAt,run:()=>skipTurn(T,a)};
  const due=Math.min(T.turnExpiresAt||Infinity,off==null?Infinity:Math.max(off+OFFLINE_TURN_MS,r.keyAt+15000),r.keyAt+IDLE_TURN_MS);
  return {at:due,run:()=>{if(!T.turnExpiresAt||now()<T.turnExpiresAt){T.away={...T.away,[a]:true};T.secret.autoAway[a]=true;}skipTurn(T,a);}};
}
function hostCheck(T){
  if(!["lobby","playing"].includes(T.status))return false;
  const h=T.hostId,gone=(T.left&&T.left[h])||!T.players[h];
  const off=gone?0:offlineSince(T,h);
  if(!gone&&(off==null||now()-off<HOST_GONE_MS))return false;
  const cand=humans(T).filter(u=>u!==h&&!(T.left&&T.left[u])&&connected(T.code,u));
  if(!cand.length)return false;
  T.hostId=cand[0];
  if(T.status==="playing")logp(T,{t:"host",who:cand[0]});
  return true;
}
function autoStep(T){
  const r=rt(T);
  clearTimeout(r.timer);r.timer=null;
  if(tables.get(T.code)!==T)return;
  if(hostCheck(T)){touch(T);return;}
  if(T.status!=="playing")return;
  const key=stateKey(T);
  if(r.key!==key){r.key=key;r.keyAt=now();r.jit=Math.random();}
  const p=plan(T,r);if(!p)return;
  const wait=p.at-now();
  if(wait<=0){
    try{p.run();}catch(e){if(!(e instanceof Refusal))console.error("auto move failed",T.code,e);return;}
    touch(T);return;
  }
  r.timer=setTimeout(()=>autoStep(T),Math.min(wait,5000));
}
/* a slow sweep catches hosts and players whose pages closed while nothing else changed */
setInterval(()=>{for(const T of tables.values())if(T.status==="playing"||T.status==="lobby"){
  if(T.status==="lobby"&&T.matchmade&&seated(T).length>=2&&
     (seated(T).length>=MAX_SEATS||now()-(T.matchStartedAt||T.createdAt)>=30000)){
    try{startGame(T);touch(T);}catch(e){console.error("matchmaking start failed",e);}continue;
  }
  const r=rt(T);if(!r.timer)autoStep(T);
}},4000).unref();

/* ---------- the moves a device can ask for ---------- */
function getTable(code){
  const c=String(code||"").toUpperCase();
  if(!/^[A-Z]{4}$/.test(c))refuse("Table codes are four letters, like KXTB.");
  const T=tables.get(c);if(!T)refuse(`There's no table ${c}. Check the code with whoever invited you.`,404);
  return T;
}
function ownSeat(T,pid,seat){
  const s=seat||pid;
  if(!controls(T,s,pid))refuse("That isn't your seat.",403);
  return s;
}
function newTable(hostId,players){
  pruneTables();
  if(tables.size>=MAX_TABLES)refuse("The manor is full right now. Try again in a few minutes.",503);
  const code=newCode(),t=now();
  const T={v:4,code,hostId,status:"lobby",createdAt:t,updatedAt:t,players,rev:1,seq:0,log:[],caseId:"hollowmere",caseData:CASES.BY_ID.hollowmere,settings:{turnSeconds:0,chat:true,voice:false},mode:"casual",messages:[]};
  tables.set(code,T);
  return T;
}
const OPS={
  register(pid,d){
    const handle=handleOf(d.handle),pass=String(d.password||"");
    if(!isHandle(handle)||pass.length<10||pass.length>200)refuse("Use a 3–20 character username and a password of at least 10 characters.");
    if(accounts.has(handle))refuse("That username is unavailable.");
    const salt=crypto.randomBytes(16).toString("hex"),a={handle,display:cleanName(d.display)||handle,salt,hash:passwordHash(pass,salt),xp:0,games:0,wins:0,rank:1000,friends:[],requests:[],achievements:[],createdAt:now()};
    accounts.set(handle,a);devices.get(pid).account=handle;markDirty();return {profile:profileOf(pid)};
  },
  login(pid,d){
    const a=accounts.get(handleOf(d.handle)),pass=String(d.password||"");
    if(!a||pass.length>200)refuse("Incorrect username or password.",401);
    const hash=Buffer.from(passwordHash(pass,a.salt),"hex"),want=Buffer.from(a.hash,"hex");
    if(want.length!==hash.length||!crypto.timingSafeEqual(hash,want))refuse("Incorrect username or password.",401);
    devices.get(pid).account=a.handle;markDirty();return {profile:profileOf(pid)};
  },
  logout(pid){delete devices.get(pid).account;markDirty();return {profile:null};},
  profile(pid){return {profile:profileOf(pid),cases:caseSummary(pid)};},
  leaderboard(pid){return {leaders:[...accounts.values()].sort((a,b)=>(b.xp||0)-(a.xp||0)).slice(0,20).map(publicProfile)};},
  inviteFriend(pid,d){
    const a=accountOf(pid),T=getTable(d.code),target=accounts.get(handleOf(d.handle));
    if(!a||!T.players[pid]||!target||!a.friends.includes(target.handle))refuse("Invite a confirmed friend from your table.",403);
    target.invitations=target.invitations||[];
    if(!target.invitations.some(x=>x.code===T.code))target.invitations.unshift({code:T.code,from:a.handle,at:now()});
    target.invitations=target.invitations.slice(0,20);
    for(const stream of streams)if(devices.get(stream.pid)?.account===target.handle)send(stream,"invite",JSON.stringify({code:T.code,from:a.handle}));
    markDirty();return {};
  },
  dismissInvite(pid,d){const a=accountOf(pid);if(!a)refuse("Sign in first.",403);a.invitations=(a.invitations||[]).filter(x=>x.code!==String(d.code||""));markDirty();return {profile:profileOf(pid)};},
  friendRequest(pid,d){
    const a=accountOf(pid),other=accounts.get(handleOf(d.handle));if(!a)refuse("Sign in first.",403);
    if(!other||other===a)refuse("No matching detective found.");
    if(!a.friends.includes(other.handle)&&!other.requests.includes(a.handle))other.requests.push(a.handle);
    markDirty();return {profile:profileOf(pid)};
  },
  friendAccept(pid,d){
    const a=accountOf(pid),other=accounts.get(handleOf(d.handle));if(!a||!other||!a.requests.includes(other.handle))refuse("No invitation from that detective.",403);
    a.requests=a.requests.filter(x=>x!==other.handle);if(!a.friends.includes(other.handle))a.friends.push(other.handle);if(!other.friends.includes(a.handle))other.friends.push(a.handle);markDirty();return {profile:profileOf(pid)};
  },
  matchmake(pid,d){
    const mode=d.mode==="ranked"?"ranked":"casual";
    if(mode==="ranked"&&!accountOf(pid))refuse("Sign in to join ranked matches.",403);
    const nick=cleanName(d.nick)||accountOf(pid)?.display||"Detective";
    let T=[...tables.values()].find(t=>t.status==="lobby"&&t.matchmade&&t.mode===mode&&seated(t).length<8&&(!t.players[pid]));
    if(!T){T=newTable(pid,{[pid]:{nick,character:"blackwood",joinedAt:now()}});T.matchmade=true;T.matchStartedAt=now();T.mode=mode;}
    else T.players[pid]={nick,character:DETECTIVES[seated(T).length%8].id,joinedAt:now()};
    touch(T);return {code:T.code,seated:true};
  },
  setcase(pid,d){
    const T=getTable(d.code);if(T.hostId!==pid||T.status!=="lobby")refuse("Only the host may select a case before play.",403);
    const c=ownedCase(pid,String(d.caseId||""));T.caseId=c.id;T.caseData=c;touch(T);return {};
  },
  settings(pid,d){
    const T=getTable(d.code);if(T.hostId!==pid||T.status!=="lobby")refuse("Only the host can change settings before dealing.",403);
    if(![0,30,60,120].includes(Number(d.turnSeconds)))refuse("Choose 30, 60, 120 seconds or no timer.");
    T.settings={turnSeconds:Number(d.turnSeconds),chat:!!d.chat,voice:!!d.voice};touch(T);return {};
  },
  chat(pid,d){
    const T=getTable(d.code),player=!!T.players[pid],channel=String(d.channel||"room"),to=String(d.to||"");
    if(!T.settings?.chat)refuse("Chat is disabled by the host.",403);
    if((T.muted||[]).includes(pid))refuse("The host has muted this account for this room.",403);
    if(T.status==="closed")refuse("This room is closed.");
    if(!player&&T.status!=="playing"&&T.status!=="over")refuse("Spectator chat opens after the case begins.",403);
    if(!["room","private","spectators"].includes(channel))refuse("Unknown chat channel.");
    if(player&&channel==="spectators"||!player&&channel!=="spectators")refuse("This chat channel is not available to you.",403);
    if(channel==="private"&&(!T.players[to]||T.players[to].bot||T.players[to].local||to===pid))refuse("Choose another human player.");
    const text=String(d.text||"").normalize("NFC").replace(/[\x00-\x1f\x7f]/g," ").trim().slice(0,280);
    if(!text)refuse("Write a message.");
    const r=rt(T);r.chatAt=r.chatAt||{};if(now()-(r.chatAt[pid]||0)<1300)refuse("Please slow down your messages.",429);r.chatAt[pid]=now();
    T.messages=T.messages||[];T.messages.push({id:rid(),at:now(),from:pid,nick:player?T.players[pid].nick:"Spectator",channel,to:channel==="private"?to:null,text});
    T.messages=T.messages.slice(-120);touch(T);return {};
  },
  mute(pid,d){
    const T=getTable(d.code),target=String(d.target||"");
    if(T.hostId!==pid)refuse("Only the host may moderate this room.",403);
    if(!T.players[target]&&!(T.messages||[]).some(m=>m.from===target))refuse("Unknown participant.");
    if(target===pid)refuse("You cannot mute yourself.");
    const list=new Set(T.muted||[]);if(d.mute===false)list.delete(target);else list.add(target);
    T.muted=[...list];touch(T);return {};
  },
  reportChat(pid,d){
    const T=getTable(d.code),m=(T.messages||[]).find(m=>m.id===String(d.id||""));
    if(!m)refuse("Message not found.",404);
    if(m.channel==="private"&&m.from!==pid&&m.to!==pid)refuse("Message not found.",404);
    if(m.channel==="room"&&!T.players[pid]||m.channel==="spectators"&&T.players[pid])refuse("Message not found.",404);
    T.chatReports=T.chatReports||[];
    if(T.chatReports.some(r=>r.by===pid&&r.messageId===m.id))refuse("You already reported this message.");
    T.chatReports.push({by:pid,messageId:m.id,at:now(),reason:String(d.reason||"inappropriate").slice(0,90)});
    markDirty();return {};
  },
  predict(pid,d){
    const T=getTable(d.code);
    if(T.players[pid]||T.status!=="playing")refuse("Only spectators can predict during an active mystery.",403);
    if(!validTrio(d.cards))refuse("Predict a suspect, method and location.");
    T.secret.predictions=T.secret.predictions||{};
    if(T.secret.predictions[pid])refuse("Your prediction is already sealed.");
    T.secret.predictions[pid]={cards:d.cards,nick:cleanName(d.nick)||accountOf(pid)?.display||"A spectator",at:now()};
    touch(T);return {sealed:true};
  },
  voice(pid,d){
    const T=getTable(d.code);if(!T.settings?.voice||!T.players[pid]||T.players[pid].bot||T.players[pid].local)refuse("Voice is unavailable.",403);
    if(!T.players[d.to]||d.to===pid||T.players[d.to].bot||T.players[d.to].local)refuse("Invalid voice recipient.",403);
    if(!["offer","answer","ice","bye"].includes(d.kind))refuse("Invalid signal.");
    const payload=d.payload;if(JSON.stringify(payload||{}).length>5000)refuse("Signal too large.");
    for(const stream of streams)if(stream.code===T.code&&stream.pid===d.to)send(stream,"voice",JSON.stringify({from:pid,kind:d.kind,payload}));
    return {};
  },
  caseCreate(pid,d){
    const a=accountOf(pid);if(!a)refuse("Sign in to create mysteries.",403);
    const title=String(d.title||"").trim().slice(0,64),opening=String(d.opening||"").trim().slice(0,1200);
    if(title.length<5||opening.length<80)refuse("A case needs a title and an introduction of at least 80 characters.");
    const names={};for(const cat of ["s","m","r"]){const arr=d.names&&d.names[cat];if(!Array.isArray(arr)||arr.length!==6||arr.some(n=>typeof n!=="string"||n.trim().length<2||n.length>40))refuse("Provide six names for each evidence category.");names[cat]=arr.map(n=>n.trim());}
    const id="community-"+rid();const caseData={id,title,opening,tagline:String(d.tagline||"").slice(0,100),place:String(d.place||"").slice(0,60),ending:String(d.ending||"").slice(0,240),theme:"manor",names};
    community.set(id,{owner:a.handle,caseData,status:"draft",reports:[]});markDirty();return {caseId:id};
  },
  caseSubmit(pid,d){
    const a=accountOf(pid),c=community.get(String(d.caseId||""));if(!a||!c||c.owner!==a.handle)refuse("Not your case.",403);
    if(c.status!=="draft")refuse("That mystery has already been submitted.");c.status="review";markDirty();return {status:"review"};
  },
  moderationQueue(pid,d){
    if(!ENV.CASE_MODERATOR_KEY||String(d.moderatorKey)!==ENV.CASE_MODERATOR_KEY)refuse("Moderator access required.",403);
    const cases=[...community.values()].filter(c=>c.status==="review").map(c=>({owner:c.owner,caseData:c.caseData}));
    const reports=[];
    for(const T of tables.values())for(const r of T.chatReports||[]){const message=(T.messages||[]).find(m=>m.id===r.messageId);if(message)reports.push({code:T.code,message,report:r});}
    return {cases:cases.slice(0,100),reports:reports.slice(-200)};
  },
  caseReview(pid,d){
    if(!ENV.CASE_MODERATOR_KEY||String(d.moderatorKey)!==ENV.CASE_MODERATOR_KEY)refuse("Moderator access required.",403);
    const c=community.get(String(d.caseId||""));if(!c)refuse("Case not found.",404);
    c.status=d.approve===true?"approved":"rejected";markDirty();return {status:c.status};
  },
  tournamentCreate(pid,d){
    const a=accountOf(pid);if(!a)refuse("Sign in to create a tournament.",403);
    const id="T"+rid().slice(0,6).toUpperCase(),title=String(d.title||"").trim().slice(0,60);
    if(title.length<3)refuse("Give your tournament a name.");
    tournaments.set(id,{id,title,owner:a.handle,members:[a.handle],scores:{[a.handle]:0},createdAt:now()});markDirty();return {id};
  },
  tournamentJoin(pid,d){
    const a=accountOf(pid),t=tournaments.get(String(d.id||"").toUpperCase());if(!a||!t)refuse("Sign in and enter a valid tournament code.",403);
    if(!t.members.includes(a.handle))t.members.push(a.handle);t.scores[a.handle]??=0;markDirty();return {tournament:t};
  },
  tournamentList(pid){const a=accountOf(pid);return {tournaments:[...tournaments.values()].filter(t=>a&&t.members.includes(a.handle)).map(t=>({...t,members:t.members.length}))};},
  tournamentSet(pid,d){
    const a=accountOf(pid),t=tournaments.get(String(d.id||"").toUpperCase()),T=getTable(d.code);
    if(!a||!t||!t.members.includes(a.handle)||T.hostId!==pid||T.status!=="lobby")refuse("Join the tournament and host an unstarted table first.",403);
    T.tournamentId=t.id;touch(T);return {};
  },
  create(pid,d){
    const nick=cleanName(d.nick);if(!nick)refuse("Type your name first, so the family knows who you are.");
    const T=newTable(pid,{[pid]:{nick,character:"blackwood",joinedAt:now()}});
    touch(T);return {code:T.code};
  },
  join(pid,d){
    const T=getTable(d.code);
    if(T.players[pid]){
      const nick=cleanName(d.nick);
      if(nick&&T.status==="lobby"&&T.players[pid].nick!==nick){T.players[pid].nick=nick;touch(T);}
      return {code:T.code,seated:true};
    }
    if(T.status!=="lobby")return {code:T.code,seated:false,watching:true};
    if(seated(T).length>=MAX_SEATS)refuse("That table is full. Eight detectives is the limit.");
    const nick=cleanName(d.nick);if(!nick)refuse("Type your name first, so the family knows who you are.");
    T.players[pid]={nick,character:DETECTIVES[seated(T).length%DETECTIVES.length].id,joinedAt:now()};
    touch(T);return {code:T.code,seated:true};
  },
  unjoin(pid,d){
    const T=getTable(d.code);
    if(T.status!=="lobby"||!T.players[pid])return {};
    for(const u of seatsOf(T,pid))delete T.players[u];
    if(T.hostId===pid){
      const next=humans(T).find(u=>connected(T.code,u))||humans(T)[0];
      if(next)T.hostId=next;else{T.status="closed";}
    }
    touch(T);return {};
  },
  addbot(pid,d){
    const T=getTable(d.code);
    if(T.status!=="lobby")refuse("The cards are already dealt.");
    if(T.hostId!==pid)refuse("Only the host can add computer detectives.",403);
    if(seated(T).length>=MAX_SEATS)refuse("The table is full. Eight detectives is the limit.");
    const used=new Set(seated(T).map(u=>T.players[u].nick));
    const nick=BOT_NAMES.find(n=>!used.has(n))||`Detective ${seated(T).length+1}`;
    T.players["bot-"+rid()]={nick,character:DETECTIVES[seated(T).length%DETECTIVES.length].id,joinedAt:now(),bot:["rookie","sharp","master"].includes(d.lvl)?d.lvl:"rookie"};
    touch(T);return {};
  },
  addlocal(pid,d){
    const T=getTable(d.code);
    if(T.status!=="lobby")refuse("The cards are already dealt.");
    if(!T.players[pid]||T.players[pid].local||T.players[pid].bot)refuse("Take a seat yourself first.",403);
    if(seated(T).length>=MAX_SEATS)refuse("The table is full. Eight detectives is the limit.");
    const nick=cleanName(d.name);if(!nick)refuse("Type their name first.");
    T.players["loc-"+rid()]={nick,character:DETECTIVES[seated(T).length%DETECTIVES.length].id,joinedAt:now(),local:pid};
    touch(T);return {};
  },
  character(pid,d){
    const T=getTable(d.code),seat=ownSeat(T,pid,d.seat);
    if(T.status!=="lobby")refuse("Choose your detective before the case starts.");
    const character=String(d.character||"");
    if(!DETECTIVE_BY_ID[character])refuse("That detective is not available.");
    T.players[seat].character=character;touch(T);return {};
  },
  hint(pid,d){
    const T=getTable(d.code),seat=ownSeat(T,pid,d.seat);
    if(T.status!=="playing"||!T.secret||T.left[seat])refuse("Hints are available only during an active investigation.");
    if(T.out[seat])refuse("Your accusation is already final.");
    const progress=T.secret.progress&&T.secret.progress[seat];
    if(!progress)refuse("You don't have a detective score.");
    const history=T.secret.hints[seat]||(T.secret.hints[seat]=[]);
    const costs=[3,6,10,15];
    if(history.length>=costs.length)refuse("You've used all four hints this case.");
    const cost=costs[history.length];
    if(progress.points<cost)refuse(`You need ${cost} deduction points for the next hint. Ask another question first.`);
    const seen=new Set([...(T.secret.hands[seat]||[]),...history.map(h=>h.card)]);
    for(const e of T.log)if(e.t==="show"&&e.to===seat&&T.secret.shown[e.n])seen.add(T.secret.shown[e.n]);
    const possible=ALL.filter(c=>!T.secret.sol.includes(c)&&!seen.has(c)&&!(T.faceUp||[]).includes(c));
    if(!possible.length)refuse("No useful hidden non-solution cards remain.");
    const card=possible[rnd(possible.length)];
    history.push({card,cost});progress.points-=cost;
    logp(T,{t:"hint",who:seat,level:history.length});
    touch(T);return {level:history.length};
  },
  kick(pid,d){
    const T=getTable(d.code),u=String(d.u||"");
    if(T.status!=="lobby"||!T.players[u]||u===pid)return {};
    if(!(T.hostId===pid||T.players[u].local===pid))refuse("Only the host can remove detectives.",403);
    for(const x of [u,...Object.keys(T.players).filter(x=>T.players[x]&&T.players[x].local===u)])delete T.players[x];
    if(T.hostId===u)T.hostId=pid;
    touch(T);return {};
  },
  start(pid,d){
    const T=getTable(d.code);
    if(T.status!=="lobby")refuse("The cards are already dealt.");
    if(T.hostId!==pid)refuse("Only the host can deal the cards.",403);
    if(T.mode==="ranked"&&(seated(T).some(u=>T.players[u].bot||T.players[u].local)||seated(T).some(u=>!accountOf(u))))refuse("Ranked matches need registered human detectives (no AI or local seats).");
    startGame(T);touch(T);return {};
  },
  ask(pid,d){const T=getTable(d.code);askAs(T,ownSeat(T,pid,d.seat),d.cards);touch(T);return {};},
  show(pid,d){const T=getTable(d.code);showAs(T,ownSeat(T,pid,d.seat),String(d.card||""));touch(T);return {};},
  pass(pid,d){const T=getTable(d.code);passAs(T,ownSeat(T,pid,d.seat));touch(T);return {};},
  end(pid,d){const T=getTable(d.code);endTurnAs(T,ownSeat(T,pid,d.seat));touch(T);return {};},
  accuse(pid,d){const T=getTable(d.code);accuseAs(T,ownSeat(T,pid,d.seat),d.cards);touch(T);return {};},
  away(pid,d){
    const T=getTable(d.code);
    if(T.status!=="playing")return {};
    const v=!!d.v,seats=d.seat?[d.seat]:seatsOf(T,pid);
    for(const s of seats){
      const mine=controls(T,s,pid);
      if(!T.order.includes(s)||T.left[s])continue;
      if(!mine&&!(v&&T.hostId===pid&&!isBot(T,s)))refuse("Only the host can mark someone else as away.",403);
      T.away={...T.away,[s]:v};delete T.secret.autoAway[s];
    }
    touch(T);return {};
  },
  leave(pid,d){
    const T=getTable(d.code);
    const seats=d.seat?[ownSeat(T,pid,d.seat)]:seatsOf(T,pid);
    for(const s of seats)leaveForGood(T,s);
    if(T.hostId===pid)hostCheck(T);
    touch(T);return {};
  },
  handover(pid,d){
    const T=getTable(d.code),to=String(d.to||"");
    if(T.hostId!==pid)refuse("You aren't hosting this table.",403);
    if(!humans(T).includes(to)||to===pid||(T.left&&T.left[to]))refuse("Pick another detective who is still playing.");
    T.hostId=to;
    if(T.status==="playing")logp(T,{t:"host",who:to});
    touch(T);return {};
  },
  endcase(pid,d){
    const T=getTable(d.code);
    if(T.hostId!==pid)refuse("Only the host can end the case.",403);
    if(T.status!=="playing")return {};
    T.rankings=rankPlayers(T);
    logp(T,{t:"closed"});
    Object.assign(T,{status:"over",phase:"done",winner:null,solution:T.secret.sol,endedAt:now()});
    touch(T);return {};
  },
  rematch(pid,d){
    const T=getTable(d.code);
    if(T.status!=="over")refuse("Finish this case first.");
    if(T.next&&tables.has(T.next))return {code:T.next};
    if(T.hostId!==pid&&!(T.players[pid]&&!T.players[pid].local&&!T.players[pid].bot&&(T.left&&T.left[T.hostId]||offlineSince(T,T.hostId)!=null)))
      refuse("Only the host can start a new case.",403);
    const players={};let i=0;
    for(const u of (T.order||seated(T))){
      const p=T.players[u];if(!p||(T.left&&T.left[u]))continue;
      if(p.local&&(!T.players[p.local]||(T.left&&T.left[p.local])))continue;
      players[u]={nick:p.nick,character:p.character||"blackwood",joinedAt:++i,...(p.bot?{bot:p.bot}:{}),...(p.local?{local:p.local}:{})};
    }
    if(!players[pid])players[pid]={nick:T.players[pid].nick,joinedAt:0};
    const N=newTable(pid,players);
    T.next=N.code;touch(T);touch(N);
    return {code:N.code};
  },
  nudge(pid,d){
    const T=getTable(d.code),u=String(d.u||"");
    if(!T.players[pid])refuse("Only detectives at the table can nudge.",403);
    const to=controllerOf(T,u);if(!to||to===pid)return {};
    const r=rt(T),k=pid+">"+to;r.nudged=r.nudged||{};
    if((r.nudged[k]||0)>now()-30000)refuse("Give them a moment before nudging again.",429);
    r.nudged[k]=now();
    const msg=JSON.stringify({code:T.code,from:T.players[pid].nick,seat:u});
    let reached=0;for(const s of streams)if(s.pid===to){send(s,"nudge",msg);reached++;}
    return {reached};
  }
};

/* ---------- keeping the manor tidy, and remembering it across restarts ---------- */
function pruneTables(){
  const t=now();
  for(const [code,T] of tables){
    const idle=t-(T.updatedAt||0);
    const dead=(T.status==="closed"&&idle>3600e3)||(T.status==="over"&&idle>2*864e5)||(T.status==="lobby"&&idle>2*864e5)||(T.status==="playing"&&idle>7*864e5);
    if(dead){tables.delete(code);const r=RT.get(code);if(r)clearTimeout(r.timer);RT.delete(code);markDirty();}
  }
}
function pruneDevices(force){
  const t=now(),limit=force?30*864e5:180*864e5;
  for(const [pid,d] of devices)if(t-d.seen>limit)devices.delete(pid);
}
let saveT=null,saving=false;
function markDirty(){if(!saveT)saveT=setTimeout(save,1200);}
function save(sync){
  saveT=null;
  const data=JSON.stringify({v:2,savedAt:now(),devices:[...devices],tables:[...tables.values()],accounts:[...accounts],community:[...community],tournaments:[...tournaments]});
  const tmp=STATE_FILE+".tmp";
  try{
    fs.mkdirSync(DATA_DIR,{recursive:true});
    if(sync){fs.writeFileSync(tmp,data);fs.renameSync(tmp,STATE_FILE);return;}
    if(saving){markDirty();return;}
    saving=true;
    fs.writeFile(tmp,data,e=>{
      if(e){saving=false;console.error("save failed",e.message);return;}
      fs.rename(tmp,STATE_FILE,e2=>{saving=false;if(e2)console.error("save failed",e2.message);});
    });
  }catch(e){saving=false;console.error("save failed",e.message);}
}
function load(){
  try{
    const d=JSON.parse(fs.readFileSync(STATE_FILE,"utf8"));
    for(const [pid,v] of d.devices||[])devices.set(pid,v);
    for(const [h,a] of d.accounts||[])accounts.set(h,a);
    for(const [id,c] of d.community||[])community.set(id,c);
    for(const [id,t] of d.tournaments||[])tournaments.set(id,t);
    for(const T of d.tables||[])if(T&&T.code)tables.set(T.code,T);
    console.log(`Loaded ${tables.size} tables and ${devices.size} devices.`);
  }catch(e){if(e.code!=="ENOENT")console.error("Couldn't read saved state:",e.message);}
  pruneTables();
  for(const T of tables.values())if(T.status==="playing")setTimeout(()=>autoStep(T),500);
}
setInterval(()=>{pruneTables();pruneDevices(false);},3600e3).unref();

/* ---------- a little protection against floods ---------- */
const buckets=new Map();
function allow(key,cost,cap,perSec){
  cap*=RATE;perSec*=RATE;
  const t=now();let b=buckets.get(key);
  if(!b){b={tokens:cap,at:t};buckets.set(key,b);}
  b.tokens=Math.min(cap,b.tokens+(t-b.at)/1000*perSec);b.at=t;
  if(b.tokens<cost)return false;
  b.tokens-=cost;return true;
}
setInterval(()=>{const t=now();for(const [k,b] of buckets)if(t-b.at>600e3)buckets.delete(k);},300e3).unref();
function ipOf(req){
  const xf=TRUST_PROXY&&req.headers["x-forwarded-for"];
  return (xf?String(xf).split(",")[0].trim():req.socket.remoteAddress)||"?";
}

/* ---------- the web server ---------- */
const TYPES={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",
  ".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".webmanifest":"application/manifest+json",".txt":"text/plain; charset=utf-8"};
const files=new Map();
function loadFiles(){
  for(const name of fs.readdirSync(PUBLIC_DIR)){
    const p=path.join(PUBLIC_DIR,name);if(!fs.statSync(p).isFile())continue;
    const body=fs.readFileSync(p),type=TYPES[path.extname(name)]||"application/octet-stream";
    const gz=/text|javascript|json|svg|manifest/.test(type)?zlib.gzipSync(body,{level:9}):null;
    const etag='"'+crypto.createHash("sha1").update(body).digest("base64").slice(0,20)+'"';
    files.set("/"+name,{body,gz,type,etag});
  }
}
const SECURITY={
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer",
  "X-Frame-Options":"DENY",
  "Permissions-Policy":"camera=(), microphone=(self), geolocation=()",
  "Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};
function serveFile(req,res,name){
  const f=files.get(name);
  if(!f){res.writeHead(404,{"Content-Type":"text/plain",...SECURITY});res.end("Not found");return;}
  const h={"Content-Type":f.type,"ETag":f.etag,"Cache-Control":name==="/index.html"?"no-cache":"public, max-age=3600","Vary":"Accept-Encoding",...SECURITY};
  if(req.headers["if-none-match"]===f.etag){res.writeHead(304,h);res.end();return;}
  const gz=f.gz&&/\bgzip\b/.test(req.headers["accept-encoding"]||"");
  if(gz)h["Content-Encoding"]="gzip";
  res.writeHead(200,h);res.end(req.method==="HEAD"?undefined:(gz?f.gz:f.body));
}
function readJSON(req,limit){
  return new Promise((resolve,reject)=>{
    let size=0;const chunks=[];
    req.on("data",c=>{size+=c.length;if(size>limit){reject(new Refusal("Too much data.",413));req.destroy();}else chunks.push(c);});
    req.on("end",()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"));}catch(e){reject(new Refusal("Bad request."));}});
    req.on("error",reject);
  });
}
function json(res,status,obj){res.writeHead(status,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...SECURITY});res.end(JSON.stringify(obj));}

async function handleAct(req,res){
  const ip=ipOf(req);
  if(!allow("ip:"+ip,1,60,6))return json(res,429,{ok:false,error:"Too many moves at once. Wait a moment and try again."});
  let d;try{d=await readJSON(req,8192);}catch(e){return json(res,e.status||400,{ok:false,error:e.message});}
  if(!d||typeof d!=="object")return json(res,400,{ok:false,error:"Bad request."});
  const who=auth(d.pid,d.key,ip);
  if(who==="limit")return json(res,429,{ok:false,error:"Lots of new players from your network just now. Wait a little and try again."});
  if(!who)return json(res,401,{ok:false,error:"This browser's player key didn't match. Reload the page."});
  const op=OPS[d.op];if(!op||!Object.prototype.hasOwnProperty.call(OPS,d.op))return json(res,400,{ok:false,error:"Unknown move."});
  if(!allow("pid:"+d.pid,1,30,4))return json(res,429,{ok:false,error:"Too many moves at once. Wait a moment and try again."});
  if(["login","register"].includes(d.op)&&!allow("auth:"+ip,1,12,12/600))return json(res,429,{ok:false,error:"Too many sign-in attempts."});
  if(d.op==="create"&&!allow("create:"+ip,1,30,30/3600))return json(res,429,{ok:false,error:"That's a lot of new tables. Wait a little before starting another."});
  if(d.op==="join"&&!tables.has(String(d.code||"").toUpperCase())&&!allow("miss:"+ip,1,20,20/600))return json(res,429,{ok:false,error:"Too many wrong codes. Wait a few minutes and try again."});
  try{const out=op(d.pid,d)||{};json(res,200,{ok:true,...out});}
  catch(e){
    if(e instanceof Refusal)return json(res,e.status,{ok:false,error:e.message});
    console.error("move failed",d.op,e);json(res,500,{ok:false,error:"Something went wrong in the manor. Try again."});
  }
}
async function handleStream(req,res){
  const ip=ipOf(req);
  if(!allow("ip:"+ip,1,60,6))return json(res,429,{ok:false,error:"Too many connections. Wait a moment."});
  let d;try{d=await readJSON(req,2048);}catch(e){return json(res,e.status||400,{ok:false,error:e.message});}
  const who=d&&auth(d.pid,d.key,ip);
  if(who==="limit")return json(res,429,{ok:false,error:"Lots of new players from your network just now. Wait a little and try again."});
  if(!who)return json(res,401,{ok:false,error:"This browser's player key didn't match. Reload the page."});
  const code=d.code?String(d.code).toUpperCase():null;
  if(code&&!/^[A-Z]{4}$/.test(code))return json(res,400,{ok:false,error:"Bad table code."});
  if(code&&!tables.has(code)&&!allow("miss:"+ip,1,20,20/600))return json(res,429,{ok:false,error:"Too many wrong codes. Wait a few minutes and try again."});
  const mine=[...streams].filter(s=>s.pid===d.pid);
  if(mine.length>=8)try{mine[0].res.end();}catch(e){}
  let fromIp=0;for(const x of streams)if(x.ip===ip)fromIp++;
  if(fromIp>=60*RATE||streams.size>=6000)return json(res,503,{ok:false,error:"The manor is very busy. Try again in a minute."});
  res.writeHead(200,{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","Connection":"keep-alive","X-Accel-Buffering":"no",...SECURITY});
  res.write(": welcome\n\n");
  const s={pid:d.pid,code,res,ip};streams.add(s);
  const T=code?tables.get(code):null;
  if(code&&!T)send(s,"missing",JSON.stringify({code}));
  else if(T){
    send(s,"profile",JSON.stringify({profile:profileOf(d.pid),cases:caseSummary(d.pid)}));
    const r=rt(T);delete r.seen[d.pid];
    /* back after being marked away automatically: you're no longer away */
    let back=false;
    if(T.status==="playing")for(const u of seatsOf(T,d.pid))if(T.secret.autoAway[u]&&T.away[u]){T.away={...T.away,[u]:false};delete T.secret.autoAway[u];back=true;}
    if(back)touch(T);else broadcast(T);
  }else {send(s,"tables",JSON.stringify(myTables(d.pid)));send(s,"profile",JSON.stringify({profile:profileOf(d.pid),cases:caseSummary(d.pid)}));}
  const bye=()=>{
    if(!streams.delete(s))return;
    if(T&&tables.get(code)===T){rt(T).seen[d.pid]=now();broadcast(T);setTimeout(()=>autoStep(T),50);}
  };
  req.on("close",bye);res.on("close",bye);res.on("error",bye);
}
/* keep connections alive through proxies, and tell everyone when someone's page closes */
setInterval(()=>{for(const s of streams){try{s.res.write(": ping\n\n");}catch(e){}}},20000).unref();

const server=http.createServer((req,res)=>{
  const u=new URL(req.url,"http://x");
  if(req.method==="POST"&&u.pathname==="/api/act")return void handleAct(req,res).catch(e=>{console.error(e);try{json(res,500,{ok:false,error:"Server error."});}catch(_){}});
  if(req.method==="POST"&&u.pathname==="/api/stream")return void handleStream(req,res).catch(e=>{console.error(e);try{json(res,500,{ok:false,error:"Server error."});}catch(_){}});
  if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405,{"Allow":"GET, HEAD, POST"});res.end();return;}
  if(u.pathname==="/healthz"){res.writeHead(200,{"Content-Type":"text/plain","Cache-Control":"no-store"});res.end("ok");return;}
  if(u.pathname==="/"||u.pathname==="/index.html")return serveFile(req,res,"/index.html");
  if(files.has(u.pathname))return serveFile(req,res,u.pathname);
  res.writeHead(404,{"Content-Type":"text/plain; charset=utf-8",...SECURITY});res.end("Not found");
});
server.keepAliveTimeout=65000;server.headersTimeout=66000;server.requestTimeout=0;

function shutdown(){
  console.log("Saving and shutting down…");
  if(saveT){clearTimeout(saveT);saveT=null;}
  try{save(true);}catch(e){}
  for(const s of streams)try{s.res.end();}catch(e){}
  process.exit(0);
}
process.on("SIGTERM",shutdown);process.on("SIGINT",shutdown);

if(require.main===module){
  loadFiles();load();
  server.listen(PORT,HOST,()=>console.log(`Murder at Hollowmere is open on http://localhost:${PORT}`));
}
module.exports={server,tables,OPS,verdict,deduce,botQuestion,startGame,loadFiles,load};
