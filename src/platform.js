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
 return `<div class="platform-table">${timer}${settings}${inviteFriends}<section class="platform-card story-card"><p class="eyebrow">Now investigating</p><h3>${esc(c.title)}</h3><p>${esc(c.opening||"")}</p></section>${chat}${prediction}${spectatorResults}${voice}${host?`<section class="platform-card"><h3>Tournament association</h3><div class="actions"><input id="tableTournament" placeholder="Tournament code"><button class="btn sm" type="button" data-act="tournamentset">Attach tournament</button></div></section>`:""}</div>`;
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
 voicemute:()=>{const tr=PLATFORM.media?.getAudioTracks()[0];if(tr)tr.enabled=!tr.enabled;render();}
};
function cinematic(type,g,discovery){
 const c=g.caseData||HMCASES.BY_ID.hollowmere;
 const detective=g.players&&g.players[S.uid]?DETECTIVE_BY_ID[g.players[S.uid].character]:null;
 let scenes;
 if(type==="opening")scenes=[
  {eyebrow:"Chapter I · The setting",title:c.title,text:c.opening,art:c.theme||"manor"},
  {eyebrow:"Chapter II · The gathering",title:detective?detective.name:"Eight detectives. One sealed truth.",text:detective?`${detective.title}. ${detective.bio}`:`As shadows lengthen across ${c.place||"the estate"}, every witness gives a different account. Each detective holds only part of the story.`,art:"portrait",persona:detective?.icon||"🕵️"},
  {eyebrow:"Chapter III · The hour",title:"11:47",text:c.tagline||"A clock stops. A voice falls silent. The mystery begins.",art:"clock"},
  {eyebrow:"The investigation",title:"The envelope is sealed",text:"Ask the family about one suspect, one method and one room. Trust your deductions—not the rumours.",art:"envelope"}
 ];
 else if(type==="ending")scenes=[{eyebrow:"The last act",title:g.winner?"The truth is spoken":"The case remains unsolved",text:c.ending||"The night draws to a close.",art:"clock"},{eyebrow:"The revelation",title:g.winner?"Case closed":"Best Detective",text:g.winner?`${g.players[g.winner]?.nick||"A detective"} uncovered the truth. The sealed evidence can finally be read.`:"The murderer escaped conviction. The strongest investigator is honoured by their deductions.",art:"envelope"},
 {eyebrow:"The sealed evidence",title:(g.solution||[]).map(c=>CARD[c]?.name||c).join(" · "),text:"The suspect, method and scene are revealed to every detective. Compare them with your private notebook before the next mystery.",art:"envelope"}];
 else if(type==="event"){
   const entries={footsteps:{title:"Footsteps in the passage",text:"Three distinct accounts contradict one another. Someone passes the stairs without a candle. The story grows darker, but the evidence cards alone can confirm what happened.",art:"gallery"},letter:{title:"The missing letter",text:"An unsigned note surfaces beneath the clock. Its contents are dramatic, but cannot prove guilt. Keep investigating the sealed evidence.",art:"envelope"},midnight:{title:"A bell without a witness",text:"Midnight strikes. An unseen figure closes a door, and every investigator begins to wonder whether a trusted alibi can survive scrutiny.",art:"clock"}};
   const e=entries[discovery?.scene]||entries.footsteps;scenes=[{eyebrow:"Interlude · A manor secret",...e}];
 }
 else scenes=[{eyebrow:"Discovery",title:"A new thread emerges",text:"A private card was shown to you. Record it in your notebook before you continue your investigation.",art:"envelope"}];
 PLATFORM.cine={type,scenes,index:0};renderCinematic();
}
function renderCinematic(){const el=$("#cinematic");if(!el)return;const o=PLATFORM.cine;if(!o){el.hidden=true;el.innerHTML="";document.body.classList.remove("cinematic-open");return;}
 const sc=o.scenes[o.index],pct=(o.index+1)/o.scenes.length*100;
 el.hidden=false;document.body.classList.add("cinematic-open");el.innerHTML=`<div class="cine-film" role="dialog" aria-modal="true" aria-labelledby="cineTitle"><div class="cine-art ${sc.art}" aria-hidden="true"><div class="cine-moon"></div><div class="cine-roof"></div><div class="cine-tower"></div><div class="cine-windows"></div><div class="cine-clockface"><i></i><b></b></div><div class="cine-mist"></div>${sc.persona?`<div class="cine-portrait">${esc(sc.persona)}</div>`:""}<div class="cine-vignette"></div></div><div class="cine-content"><p class="eyebrow">${esc(sc.eyebrow)}</p><h2 id="cineTitle">${esc(sc.title)}</h2><p>${esc(sc.text)}</p><div class="cine-progress" style="--pc:${pct}%"></div><div class="actions"><button class="btn sm ghost" type="button" data-cine="skip">Skip scene</button>${"speechSynthesis" in window?`<button class="btn sm ghost" type="button" data-cine="narrate">Narrate</button>`:""}<button class="btn primary" type="button" data-cine="next">${o.index===o.scenes.length-1?"Enter the investigation":"Continue"}</button></div></div></div>`;
 const b=el.querySelector('[data-cine="next"]');if(b)b.focus({preventScroll:true});
}
function cineAction(a){if(!PLATFORM.cine)return;
 if(a==="narrate"){
  if("speechSynthesis" in window){speechSynthesis.cancel();const sc=PLATFORM.cine.scenes[PLATFORM.cine.index];const u=new SpeechSynthesisUtterance(sc.title+". "+sc.text);u.rate=.86;u.pitch=.86;speechSynthesis.speak(u);}return;
 }
 if("speechSynthesis" in window)speechSynthesis.cancel();
 if(a==="skip"||++PLATFORM.cine.index>=PLATFORM.cine.scenes.length)PLATFORM.cine=null;renderCinematic();}
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
function platformBound(){document.addEventListener("click",e=>{const b=e.target.closest("[data-cine]");if(b)cineAction(b.dataset.cine);});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&PLATFORM.cine)cineAction("skip");});document.addEventListener("submit",e=>{if(e.target.id!=="chatForm")return;e.preventDefault();const input=$("#chatMessage"),text=input?.value;if(!text?.trim())return;api("chat",{channel:PLATFORM.pan==="private"?"private":S.game?.players[S.uid]?"room":"spectators",to:$("#chatRecipient")?.value,text}).then(r=>{if(r.ok&&input)input.value="";else if(!r.ok)toast(r.error);});});document.addEventListener("change",e=>{if(e.target.id==="casePicker")PLATFORM_ACT.casechange();if(e.target.id==="chatChannel"){PLATFORM.pan=e.target.value;renderTable();}});setInterval(()=>{const c=$("#turnClock"),g=S.game;if(c&&g?.turnExpiresAt)c.textContent=Math.max(0,Math.ceil((g.turnExpiresAt-Date.now())/1000))+"s";},1000);}
