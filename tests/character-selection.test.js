'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const HM=require('../public/rules.js');
const {OPS,tables,server,loadFiles}=require('../server.js');
const pid=()=>`u_${crypto.randomBytes(12).toString('hex')}`;
const device=()=>({pid:pid(),key:crypto.randomBytes(32).toString('hex')});

test('online friends choose distinct detective identities; AI has all three levels and host-selectable characters',()=>{
 const host=pid(),friend=pid(),friend2=pid();
 const {code}=OPS.create(host,{nick:'Host',character:'noir'}),T=tables.get(code);
 try{
  assert.equal(T.players[host].character,'noir');
  OPS.join(friend,{code,nick:'Friend',character:'ashford'});
  OPS.join(friend2,{code,nick:'Friend 2',character:'graves'});
  assert.equal(T.players[friend].character,'ashford');
  assert.equal(T.players[friend2].character,'graves');
  assert.throws(()=>OPS.character(friend,{code,seat:host,character:'sterling'}),/only your own detective/);
  assert.throws(()=>OPS.character(friend,{code,seat:friend2,character:'sterling'}),/only your own detective/);
  assert.throws(()=>OPS.character(friend,{code,seat:friend,character:'noir'}),/already taken/);
  assert.throws(()=>OPS.join(pid(),{code,nick:'Late friend',character:'ashford'}),/already taken/);
  OPS.character(friend,{code,seat:friend,character:'whitmore'});
  assert.equal(T.players[friend].character,'whitmore');
  assert.throws(()=>OPS.addbot(friend,{code,lvl:'master',character:'blackwood'}),/Only the host/);
  const r=OPS.addbot(host,{code,lvl:'rookie',character:'blackwood'});
  const sh=OPS.addbot(host,{code,lvl:'sharp',character:'crowe'});
  const m=OPS.addbot(host,{code,lvl:'master',character:'sterling'});
  assert.equal(T.players[r.seat].bot,'rookie');
  assert.equal(T.players[sh.seat].bot,'sharp');
  assert.equal(T.players[m.seat].bot,'master');
  assert.equal(T.players[m.seat].character,'sterling');
  assert.equal(T.players[m.seat].nick,HM.DETECTIVE_BY_ID.sterling.name);
  assert.throws(()=>OPS.addbot(host,{code,lvl:'master',character:'crowe'}),/already taken/);
  assert.throws(()=>OPS.character(friend,{code,seat:m.seat,character:'ravenscroft'}),/only your own detective/);
  OPS.character(host,{code,seat:m.seat,character:'ravenscroft'});
  assert.equal(T.players[m.seat].character,'ravenscroft');
  assert.equal(T.players[m.seat].nick,HM.DETECTIVE_BY_ID.ravenscroft.name);
  OPS.addbot(host,{code,lvl:'rookie'});
  OPS.addbot(host,{code,lvl:'sharp'});
  assert.equal(HM.seated(T).length,8);
  const claimed=HM.seated(T).map(id=>T.players[id].character);
  assert.equal(new Set(claimed).size,8);
  assert.throws(()=>OPS.addbot(host,{code,lvl:'rookie'}),/Eight detectives is the limit/);
  OPS.start(host,{code});assert.equal(T.status,'playing');
  assert.equal(T.order.length,8);
  assert.throws(()=>OPS.character(friend,{code,seat:friend,character:'noir'}),/before the case starts/);
 }finally{tables.delete(code);}
});

test('default join and bot assignment auto-choose different available portraits',()=>{
 const host=pid();const {code}=OPS.create(host,{nick:'Host'}),T=tables.get(code);
 try{
  for(let i=0;i<3;i++)OPS.join(pid(),{code,nick:`Player${i}`});
  for(let i=0;i<4;i++)OPS.addbot(host,{code,lvl:i===3?'master':'rookie'});
  assert.deepEqual(HM.seated(T).map(id=>T.players[id].character),HM.DETECTIVES.map(d=>d.id));
 }finally{tables.delete(code);}
});

test('the live API lets two independent devices select their own portrait and rejects a duplicate',async()=>{
 loadFiles();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;const a=device(),b=device();let code;
 async function op(user,act,args={}){
  const r=await fetch(`${base}/api/act`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...user,code,op:act,...args})});
  return {status:r.status,...await r.json()};
 }
 try{
  const c=await op(a,'create',{nick:'Host',character:'blackwood'});assert.equal(c.ok,true);code=c.code;
  assert.equal((await op(b,'join',{nick:'Online friend',character:'ashford'})).ok,true);
  assert.equal((await op(b,'character',{seat:b.pid,character:'crowe'})).ok,true);
  const denied=await op(a,'character',{seat:a.pid,character:'crowe'});assert.equal(denied.ok,false);assert.match(denied.error,/already taken/);
  const forbidden=await op(a,'character',{seat:b.pid,character:'noir'});assert.equal(forbidden.ok,false);assert.equal(forbidden.status,403);
  const bot=await op(a,'addbot',{lvl:'master',character:'graves'});assert.equal(bot.ok,true);
  assert.equal(bot.character,'graves');assert.equal(tables.get(code).players[b.pid].character,'crowe');
  const r=await fetch(`${base}/assets/detectives/graves.webp`);assert.equal(r.status,200);
 }finally{if(code)tables.delete(code);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('online picker is included before taking a seat and AI selection is visible',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/app_top.js'),'utf8'),built=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(src,/preseat-picker/);
 assert.match(src,/portraitChoices\(g,null,preferredCharacter\(g\)\?\.id,"pickpreferred"\)/);
 assert.match(src,/data-act="pickcharacter"/);
 assert.match(src,/id="botCharacter"/);
 assert.match(src,/Master AI/);
 assert.match(src,/character:S\.preferredCharacter/);
 assert.match(built,/chooseDetective/);
});
