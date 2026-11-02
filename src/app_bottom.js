
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
  viewcharacter:()=>scrollToPanel("#chooseDetective"),
  viewbot:()=>scrollToPanel("#botSetup"),
  localadd:()=>{S.addLocal=true;render();const i=$("#localName");if(i)i.focus();},
  localcancel:()=>{S.addLocal=false;render();},
  viewroster:()=>scrollToPanel("#detectivesHome"),
  pickpreferred:d=>{
    if(!DETECTIVE_BY_ID[d.character])return;
    const typed=$("#seatNick")?.value||"";
    S.preferredCharacter=d.character;ls.set("hm.detective",d.character);
    render();
    if(typed&&$("#seatNick"))$("#seatNick").value=typed;
  },
  pickcharacter:async d=>{
    if(S.busy||!DETECTIVE_BY_ID[d.character])return;
    const r=await api("character",{seat:d.seat,character:d.character});
    if(!r.ok){toast(r.error);return;}
    if(d.seat===S.uid){S.preferredCharacter=d.character;ls.set("hm.detective",d.character);}
    if(S.game?.players?.[d.seat]){S.game.players[d.seat].character=d.character;render();}
    toast(`${DETECTIVE_BY_ID[d.character].name} selected.`);
  },
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
    if(seat){ACT.pickcharacter({seat,character:e.target.value});}
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
  S.preferredCharacter=DETECTIVE_BY_ID[ls.get("hm.detective")]?ls.get("hm.detective"):"blackwood";
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
