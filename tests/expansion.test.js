'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const HM=require('../public/rules');
const {OPS,tables,verdict}=require('../server');
const id=()=>`u_${crypto.randomBytes(12).toString('hex')}`;
function table(n=2){
 const host=id(),code=OPS.create(host,{nick:'Host'}).code;
 const ids=[host];for(let i=1;i<n;i++){const u=id();ids.push(u);OPS.join(u,{code,nick:`Detective ${i}`});}
 return {host,code,ids,T:tables.get(code),done(){tables.delete(code);}};
}
test('Eight distinct detective identities exist; host chooses one before dealing',()=>{
 const g=table();
 try{
  assert.equal(HM.DETECTIVES.length,8);
  assert.equal(new Set(HM.DETECTIVES.map(d=>d.id)).size,8);
  OPS.character(g.host,{code:g.code,character:'sterling'});
  assert.equal(g.T.players[g.host].character,'sterling');
  assert.throws(()=>OPS.character(g.host,{code:g.code,character:'impossible'}),/not available/);
  OPS.start(g.host,{code:g.code});
  assert.throws(()=>OPS.character(g.host,{code:g.code,character:'noir'}),/before the case starts/);
 }finally{g.done();}
});
test('Private progressive hints deduct points and only reveal non-solution cards',()=>{
 const g=table(4);
 try{
  OPS.start(g.host,{code:g.code});
  assert.equal(g.T.secret.progress[g.host].points,20);
  for(const [i,cost] of [3,6,10].entries()){
   OPS.hint(g.host,{code:g.code});
   const hints=g.T.secret.hints[g.host];
   assert.equal(hints.length,i+1);
   assert.equal(hints.at(-1).cost,cost);
   assert.equal(g.T.secret.sol.includes(hints.at(-1).card),false);
  }
  assert.equal(g.T.secret.progress[g.host].points,1);
  assert.throws(()=>OPS.hint(g.host,{code:g.code}),/need 15 deduction points/);
  assert.throws(()=>OPS.hint(id(),{code:g.code}),/isn't your seat/);
 }finally{g.done();}
});
test('Question scoring rewards distinct investigations, not repeated questions',()=>{
 const g=table(3);
 try{
  OPS.start(g.host,{code:g.code});
  const turn=g.T.turn,cards=[HM.SUSPECTS[0].id,HM.METHODS[0].id,HM.ROOMS[0].id];
  OPS.ask(turn,{code:g.code,cards});
  assert.equal(g.T.secret.progress[turn].points,23);
  assert.equal(g.T.secret.progress[turn].questions,1);
  // Simulate finishing the question; ask same trio next turn.
  g.T.phase='turn';g.T.q=null;
  OPS.ask(turn,{code:g.code,cards});
  assert.equal(g.T.secret.progress[turn].points,23);
  assert.equal(g.T.secret.progress[turn].questions,1);
 }finally{g.done();}
});
test('Last eligible detective receives a final investigation; unresolved game awards score honour',()=>{
 const g=table(2);
 try{
  OPS.start(g.host,{code:g.code});
  const first=g.T.turn,wrong=HM.SUSPECTS.find(c=>c.id!==g.T.secret.sol[0]).id;
  OPS.accuse(first,{code:g.code,cards:[wrong,g.T.secret.sol[1],g.T.secret.sol[2]]});
  verdict(g.T);
  assert.equal(g.T.status,'playing');
  assert.equal(g.T.finalRound,true);
  assert.equal(g.T.out[first],true);
  const last=g.T.turn,cards=[HM.SUSPECTS[0].id,HM.METHODS[0].id,HM.ROOMS[0].id];
  assert.notEqual(last,first);
  OPS.ask(last,{code:g.code,cards});
  while(g.T.phase==='asking'){
   const who=g.T.q.queue[g.T.q.step],choices=HM.matches(g.T.secret.hands[who],cards);
   if(choices.length){if(who==='butler'){
      // The butler's response is normally automated; skip directly to an answered state in this unit test.
      g.T.phase='asked';g.T.q.shownBy='butler';
    }else OPS.show(who,{code:g.code,card:choices[0]});
   }else if(who==='butler'){g.T.phase='asked';}
   else OPS.pass(who,{code:g.code});
  }
  OPS.end(last,{code:g.code});
  assert.equal(g.T.status,'over');
  assert.equal(g.T.winner,null);
  assert.equal(g.T.rankings.length,2);
  assert.equal(g.T.bestDetective,g.T.rankings[0].seat);
  assert.equal(g.T.solution.length,3);
 }finally{g.done();}
});
test('HTTP: private hints and deduction scores stay private to the requesting player',async()=>{
 const {server,loadFiles}=require('../server');
 loadFiles();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const dev=()=>({pid:id(),key:crypto.randomBytes(24).toString('hex')});
 const a=dev(),b=dev(),watcher=dev();
 const act=async(d,op,extra={})=>{
  const r=await fetch(`${base}/api/act`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,op,...extra})});
  return r.json();
 };
 async function state(d,code){
  const ctl=new AbortController();
  try{
   const r=await fetch(`${base}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,code}),signal:ctl.signal});
   const reader=r.body.getReader();let b='';
   while(true){const {value,done}=await reader.read();if(done)throw Error('Stream finished');b+=new TextDecoder().decode(value);
    const hit=b.match(/event: state\ndata: ([^\n]+)\n\n/);if(hit)return JSON.parse(hit[1]);
   }
  }finally{ctl.abort();}
 }
 let code;
 try{
  code=(await act(a,'create',{nick:'Host'})).code;
  assert.equal((await act(b,'join',{nick:'Guest',code})).ok,true);
  assert.equal((await act(a,'start',{code})).ok,true);
  assert.equal((await act(a,'hint',{code})).ok,true);
  const mine=await state(a,code),other=await state(b,code),spectator=await state(watcher,code);
  assert.equal(mine.mine.hints[a.pid].length,1);
  assert.equal(mine.mine.score[a.pid].points,17);
  assert.equal(mine.g.secret,undefined);
  assert.equal(mine.g.rankings,null);
  for(const v of [other,spectator]){
   assert.equal(v.mine.hints[a.pid],undefined);
   assert.equal(v.mine.score[a.pid],undefined);
   assert.equal(v.g.secret,undefined);
   assert.equal(v.g.rankings,null);
   assert.ok((v.g.log||[]).filter(e=>e.t==="hint").every(e=>!Object.hasOwn(e,"card")));
  }
 }finally{
  if(code)tables.delete(code);
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
});

test('HTTP: wrong accusation never leaks the sealed solution before the case ends',async()=>{
 const {server,loadFiles}=require('../server');
 loadFiles();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;
 const dev=()=>({pid:id(),key:crypto.randomBytes(24).toString('hex')});
 const a=dev(),b=dev();
 const act=async(d,op,extra={})=>{
  const r=await fetch(`${base}/api/act`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,op,...extra})});
  return r.json();
 };
 async function state(d,code){
  const ctl=new AbortController();
  try{
   const r=await fetch(`${base}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,code}),signal:ctl.signal});
   const reader=r.body.getReader();let str='';
   while(true){const {value,done}=await reader.read();if(done)throw Error('Stream finished');str+=new TextDecoder().decode(value);
    const found=str.match(/event: state\ndata: ([^\n]+)\n\n/);if(found)return JSON.parse(found[1]);
   }
  }finally{ctl.abort();}
 }
 let code;
 try{
  const created=await act(a,'create',{nick:'Host'});assert.equal(created.ok,true);code=created.code;
  assert.equal((await act(b,'join',{nick:'Guest',code})).ok,true);
  assert.equal((await act(a,'start',{code})).ok,true);
  const T=tables.get(code),first=T.turn,firstDev=first===a.pid?a:b;
  const wrong=HM.SUSPECTS.find(c=>c.id!==T.secret.sol[0]).id;
  assert.equal((await act(firstDev,'accuse',{code,seat:first,cards:[wrong,T.secret.sol[1],T.secret.sol[2]]})).ok,true);
  verdict(T);
  assert.equal(T.status,'playing');
  const view=await state(firstDev,code);
  assert.equal(view.g.solution,null);
  assert.equal(view.g.secret,undefined);
  assert.equal(view.mine.dec && Object.values(view.mine.dec).some(x=>Array.isArray(x.solution)),false);
 }finally{
  if(code)tables.delete(code);
  server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
 }
});
