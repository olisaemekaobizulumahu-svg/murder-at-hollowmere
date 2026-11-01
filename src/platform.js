/* Platform additions: cases, accounts, moderated community drafts, timers, chat, and peer voice. */
const PLATFORM={profile:null,cases:HMCASES.CASES,chat:[],prediction:null,voiceOn:false,media:null,peers:new Map(),pendingIce:new Map(),seenCine:new Set(),cine:null,pan:"room",secretCase:null,narrationPrimed:false,narrationMuted:false};
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
  const success=!!g.winner, champion=success?(g.players?.[g.winner]?.nick||"A detective"):null;
  const solved=(g.solution||[]).map(id=>CARD[id]?.name||id);
  const finale=success?`${champion} has solved the case. The family finally hears the truth.`:"Every accusation has failed. The murderer escapes; the best detective is honoured for their investigation.";
  scenes=[
   {eyebrow:"FINAL ACT · THE LAST GATHERING",title:"The last witness",text:"At last, the investigators return to the candlelit hall. One final statement will decide the fate of the family.",kind:"finalGathering",duration:12},
   {eyebrow:"FINAL ACT · THE REVELATION",title:"The evidence is revealed",text:"Three sealed cards turn over: the murderer, the method, and the scene of the crime.",kind:"finalReveal",duration:13},
   {eyebrow:"EPILOGUE · THE VERDICT",title:success?"The case is closed":"The case remains unsolved",text:finale,kind:"finalEpilogue",duration:13}
  ];
  PLATFORM.finalTruth={solution:solved,winner:champion,success,character:g.players?.[g.winner]?.character||null};
 }else if(type==="event"){
  const entries={footsteps:{title:"Footsteps in the passage",text:"Someone crosses the hallway without a candle. The noise reveals no culprit; the evidence remains sealed."},letter:{title:"The missing letter",text:"An unsigned note is found. The words are unsettling, but only confirmed card evidence establishes the truth."},midnight:{title:"A bell without a witness",text:"A distant bell rings and a door closes. No alibi is safe from careful questioning."}};
  const e=entries[discovery?.scene]||entries.footsteps;
  scenes=[{eyebrow:"INTERLUDE · A MANOR SECRET",...e,kind:"event",duration:7}];
 }else scenes=[{eyebrow:"PRIVATE DISCOVERY",title:"A new thread emerges",text:"A card has been shown to you alone. Record the evidence in your notebook.",kind:"evidence",duration:6}];
 if(PLATFORM.cineTicker)clearInterval(PLATFORM.cineTicker);
 window.HollowmereCinema?.stop();
 // The film narrates itself. The player's first ordinary game interaction arms
 // Web Speech (no separate Narrate/Enable Narration button is required).
 // Browsers that disallow speech without user activation still display captions.
 const narrationSupported=!!(window.speechSynthesis&&window.SpeechSynthesisUtterance);
 PLATFORM.cine={type,theme,scenes,index:0,elapsed:0,soundOn:false,
  voiceOn:narrationSupported&&!PLATFORM.narrationMuted,
  voiceState:narrationSupported?"starting":"unavailable",
  speech:null,speechStartedAt:0,started:performance.now(),paused:false,
  details:type==="ending"?PLATFORM.finalTruth:null};
 renderCinematic();
}
function cinematicElapsed(o){return o.elapsed+(o.paused?0:(performance.now()-o.started)/1000);}
function cinematicDuration(o,scene){
 // Give the default narrator enough time to finish a readable passage.
 const words=(scene.title+" "+scene.text).split(/\s+/).length;
 return Math.max(scene.duration||9,Math.ceil(words/2.4)+2);
}
/* Arm the browser speech engine from an existing player interaction. This
   happens on the first tap/key press *before* the network round trip to start
   a game, so an opening streamed to the player can narrate on its own.
   Web Speech remains subject to each browser's sound autoplay rules. */
function cinematicArmVoice(){
 if(!window.speechSynthesis||!window.SpeechSynthesisUtterance||PLATFORM.narrationMuted)return;
 const current=PLATFORM.cine;
 if(current){
  if(current.voiceOn&&current.voiceState==="blocked")cinematicNarrate(current);
  return;
 }
 if(PLATFORM.narrationPrimed)return;
 try{
  const warmup=new SpeechSynthesisUtterance(" ");
  warmup.lang="en-GB";warmup.volume=0;warmup.rate=2;
  warmup.onend=()=>{PLATFORM.narrationPrimed=true;};
  speechSynthesis.speak(warmup);
  // Speech permission is usually unlocked by the gesture that queues it.
  PLATFORM.narrationPrimed=true;
 }catch(_){PLATFORM.narrationPrimed=false;}
}
function cineSpeechStop(){
 if(window.speechSynthesis)try{speechSynthesis.cancel();}catch(e){}
}
function cinematicNarrate(o){
 if(!o?.voiceOn||!window.speechSynthesis||!window.SpeechSynthesisUtterance)return;
 cineSpeechStop();
 const i=o.index,sc=o.scenes[i];o.voiceState="starting";o.speechStartedAt=performance.now();
 o.speechCompletedAt=0;
 try{
  const u=new SpeechSynthesisUtterance(sc.title+". "+sc.text);
  u.lang="en-GB";u.rate=.92;u.pitch=.82;u.volume=1;
  const voices=speechSynthesis.getVoices?.()||[];
  const preferred=voices.find(v=>/^en-GB/i.test(v.lang)&&v.localService)||voices.find(v=>/^en-GB/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang));
  if(preferred)u.voice=preferred;
  u.onstart=()=>{
   if(PLATFORM.cine!==o||o.index!==i||o.speech!==u)return;
   o.voiceState="speaking";
   if(o.paused)try{speechSynthesis.pause();}catch(_){}
   cineUpdateVoice(o);
  };
  u.onend=()=>{
   if(PLATFORM.cine!==o||o.index!==i||o.speech!==u)return;
   o.voiceState="finished";o.speechCompletedAt=performance.now();
   cineUpdateVoice(o);
  };
  u.onerror=()=>{
   if(PLATFORM.cine!==o||o.index!==i||o.speech!==u)return;
   // A browser may prohibit autoplay. Keep the animation running, and retry
   // automatically at the next normal interaction, without requiring a Narrate click.
   o.voiceState="blocked";cineUpdateVoice(o);
  };
  o.speech=u;
  speechSynthesis.speak(u);
  cineUpdateVoice(o);
 }catch(_){o.voiceState="blocked";cineUpdateVoice(o);}
}
function cineUpdateVoice(o){
 if(PLATFORM.cine!==o)return;
 const b=$("#cinematic [data-cine=voice]");
 const status=$("#cinematic .cine-voice-status");
 if(b){
  b.textContent=o.voiceOn?"Mute voice":"Unmute voice";
  b.setAttribute("aria-pressed",String(!o.voiceOn));
 }
 if(status){
  status.textContent=!o.voiceOn?"Narration muted":o.voiceState==="speaking"?"Narrating with the scene":o.voiceState==="finished"?"Narration finished":o.voiceState==="blocked"?"Browser blocked audio · captions are on":o.voiceState==="unavailable"?"Captions only":"Narration starting automatically";
 }
}
function cinematicEnd(){
 const finished=PLATFORM.cine;
 if(finished?.type==="opening"&&S.game?.status==="playing"&&S.game.players?.[S.uid])api("cineReady").catch(()=>{});
 if(PLATFORM.cineTicker){clearInterval(PLATFORM.cineTicker);PLATFORM.cineTicker=null;}
 window.HollowmereCinema?.stop();window.HollowmereCinema?.sound(false);
 cineSpeechStop();PLATFORM.cine=null;renderCinematic();
}
function renderCinematic(){
 const el=$("#cinematic");if(!el)return;
 if(PLATFORM.cineTicker){clearInterval(PLATFORM.cineTicker);PLATFORM.cineTicker=null;}
 if(!PLATFORM.cine){el.hidden=true;el.innerHTML="";document.body.classList.remove("cinematic-open");return;}
 const o=PLATFORM.cine,sc=o.scenes[o.index];o.started=performance.now();
 const nr=o.index+1,total=o.scenes.length;
 el.hidden=false;document.body.classList.add("cinematic-open");
 // Film-first layout: the canvas is the scene, and dialogue is a restrained subtitle.
 el.innerHTML=`<section class="cine-reel ${sc.kind==="finalReveal"?"is-reveal":""}" role="dialog" aria-modal="true" aria-labelledby="cineTitle" aria-describedby="cineSubtitle">
  <canvas class="cine-canvas" aria-label="Animated ${esc(sc.kind)} scene"></canvas>
  <div class="cine-grade" aria-hidden="true"></div><div class="cine-letterbox top" aria-hidden="true"></div><div class="cine-letterbox bottom" aria-hidden="true"></div>
  <div class="cine-topline"><span>MURDER AT HOLLOWMERE</span><span>${String(nr).padStart(2,"0")} / ${String(total).padStart(2,"0")} · ${esc(sc.eyebrow)}</span></div>
  <div class="cine-copy" aria-live="off"><h2 id="cineTitle">${esc(sc.title)}</h2><p id="cineSubtitle">${esc(sc.text)}</p></div>
  <div class="cine-toolbar"><div class="cine-time"><span class="cine-time-fill" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></span></div>
  <div class="cine-controls"><span class="cine-runtime">${nr}/${total} · <span class="cine-voice-status">Narration starting automatically</span></span>
  <button type="button" class="btn sm ghost" data-cine="skip">Skip film</button>
  <button type="button" class="btn sm ghost" data-cine="pause" aria-pressed="${o.paused}">${o.paused?"▶ Play":"Ⅱ Pause"}</button>
  ${window.AudioContext||window.webkitAudioContext?`<button type="button" class="btn sm ghost" data-cine="sound" aria-pressed="${!!o.soundOn}">${o.soundOn?"♪ Atmosphere on":"♪ Atmosphere off"}</button>`:""}
  ${window.speechSynthesis?`<button type="button" class="btn sm ghost" data-cine="voice" aria-pressed="${!o.voiceOn}">${o.voiceOn?"Mute voice":"Unmute voice"}</button>`:""}
  <button type="button" class="btn sm primary" data-cine="next">${nr===total?"Finish film":"Next scene →"}</button></div></div>
 </section>`;
 const canvas=el.querySelector("canvas");
 window.HollowmereCinema?.mount(canvas,sc.kind,o.theme,()=>cinematicElapsed(o),o.details);
 cinematicNarrate(o);
 const fill=el.querySelector(".cine-time-fill"),duration=cinematicDuration(o,sc);
 PLATFORM.cineTicker=setInterval(()=>{
  if(PLATFORM.cine!==o)return;
  const elapsed=cinematicElapsed(o);
  // The film has a minimum visual beat, but NEVER cuts off a speaking narrator.
  const voiceBusy=o.voiceOn&&(o.voiceState==="speaking"||o.voiceState==="starting");
  const fraction=Math.min(voiceBusy ? .97 : 1,elapsed/duration);
  if(fill){fill.style.width=`${Math.max(0,Math.min(1,fraction))*100}%`;fill.setAttribute("aria-valuenow",String(Math.round(Math.max(0,Math.min(1,fraction))*100)));}
  // Some Web Speech engines fail to emit start/error. Do not freeze the film.
  if(o.voiceOn&&o.voiceState==="starting"&&performance.now()-o.speechStartedAt>4500&&!(speechSynthesis?.speaking)){
   o.voiceState="blocked";cineUpdateVoice(o);
  }
  // Hard safety cap protects against a speech engine that stays stuck forever.
  // It is generous enough for the full spoken passage at normal speech speed.
  const voiceStuck=elapsed>Math.max(duration+40,65);
  if(elapsed>=duration&&!o.paused&&(!voiceBusy||voiceStuck))cineAction("next");
 },100);
}
function cineAction(a){const o=PLATFORM.cine;if(!o)return;
 if(a==="voice"){
  o.voiceOn=!o.voiceOn;PLATFORM.narrationMuted=!o.voiceOn;
  if(o.voiceOn)cinematicNarrate(o);
  else{o.voiceState="muted";cineSpeechStop();cineUpdateVoice(o);}
  return;
 }
 if(a==="sound"){
  o.soundOn=!o.soundOn;o.soundOn=window.HollowmereCinema?.sound(o.soundOn)===true;
  const b=$("#cinematic [data-cine=sound]");if(b){b.textContent=o.soundOn?"♪ Atmosphere on":"♪ Atmosphere off";b.setAttribute("aria-pressed",String(o.soundOn));}return;
 }
 if(a==="pause"){
  o.elapsed=cinematicElapsed(o);o.paused=!o.paused;o.started=performance.now();
  if(o.voiceState==="speaking"&&window.speechSynthesis){try{o.paused?speechSynthesis.pause():speechSynthesis.resume();}catch(e){}}
  const b=$("#cinematic [data-cine=pause]");if(b){b.textContent=o.paused?"▶ Play":"Ⅱ Pause";b.setAttribute("aria-pressed",String(o.paused));}return;
 }
 cineSpeechStop();
 if(a==="skip")return cinematicEnd();
 o.index++;if(o.index>=o.scenes.length)return cinematicEnd();
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
function platformBound(){
 // Capture user activation on an existing game click, keyboard activation or
 // touch. No extra speech-enable step is required during the cinematic.
 document.addEventListener("pointerdown",cinematicArmVoice,{capture:true,passive:true});
 document.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" ")cinematicArmVoice();},{capture:true});
 document.addEventListener("click",cinematicArmVoice,{capture:true});
 document.addEventListener("click",e=>{const b=e.target.closest("[data-cine]");if(b)cineAction(b.dataset.cine);});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&PLATFORM.cine)cineAction("skip");});document.addEventListener("submit",e=>{if(e.target.id!=="chatForm")return;e.preventDefault();const input=$("#chatMessage"),text=input?.value;if(!text?.trim())return;api("chat",{channel:PLATFORM.pan==="private"?"private":S.game?.players[S.uid]?"room":"spectators",to:$("#chatRecipient")?.value,text}).then(r=>{if(r.ok&&input)input.value="";else if(!r.ok)toast(r.error);});});document.addEventListener("change",e=>{if(e.target.id==="casePicker")PLATFORM_ACT.casechange();if(e.target.id==="chatChannel"){PLATFORM.pan=e.target.value;renderTable();}});setInterval(()=>{const c=$("#turnClock"),g=S.game;if(c&&g?.turnExpiresAt)c.textContent=g.pausedAt?"Paused":Math.max(0,Math.ceil((g.turnExpiresAt-Date.now())/1000))+"s";},1000);}
