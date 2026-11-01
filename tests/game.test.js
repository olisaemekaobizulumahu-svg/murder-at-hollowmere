"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const HM=require('../public/rules');
const {OPS,tables}=require('../server');

function makeHumanTable(n){
  const host=`u_${crypto.randomBytes(12).toString('hex')}`;
  const {code}=OPS.create(host,{nick:'Host'});
  for(let i=1;i<n;i++){
    const id=`u_${crypto.randomBytes(12).toString('hex')}`;
    OPS.join(id,{code,nick:`Player${i}`});
  }
  return {host,code,T:tables.get(code)};
}
for(let n=2;n<=8;n++){
  test(`${n} detectives: complete secret deal, balanced hands, valid solution`,()=>{
    const {host,code,T}=makeHumanTable(n);
    OPS.start(host,{code});
    assert.equal(T.status,'playing');
    assert.equal(T.order.length,n);
    assert.equal(T.butler,n===2);
    const hands=Object.values(T.secret.hands);
    const dealt=hands.flat();
    assert.equal(dealt.length,15);
    assert.equal(new Set(dealt).size,15);
    assert.equal(T.secret.sol.length,3);
    assert.equal(HM.validTrio(T.secret.sol),true);
    assert.deepEqual([...dealt,...T.secret.sol].sort(),HM.ALL.slice().sort());
    assert.ok(Math.max(...hands.map(h=>h.length))-Math.min(...hands.map(h=>h.length))<=1);
    assert.deepEqual(T.faceUp,[]);
    assert.deepEqual(T.handSize,Object.fromEntries(Object.entries(T.secret.hands).map(([k,v])=>[k,v.length])));
    tables.delete(code);
  });
}
test('A ninth detective cannot join a full table',()=>{
  const {host,code}=makeHumanTable(8);
  assert.throws(()=>OPS.join(`u_${crypto.randomBytes(12).toString('hex')}`,{code,nick:'Extra'}),/Eight detectives is the limit/);
  tables.delete(code);
});
test('A host can add a Master AI, with an eight-seat cap',()=>{
  const {host,code,T}=makeHumanTable(1);
  OPS.addbot(host,{code,lvl:'master'});
  const master=Object.values(T.players).find(p=>p.bot==='master');
  assert.ok(master);
  assert.equal(HM.seated(T).length,2);
  OPS.start(host,{code});
  assert.equal(T.status,'playing');
  tables.delete(code);
});
test('An incorrect accusation does not remove the detective from the question queue',()=>{
  const {host,code,T}=makeHumanTable(4);
  OPS.start(host,{code});
  const outPlayer=T.order[1];
  T.out[outPlayer]=true;
  assert.equal(HM.nextTurn(T,T.order[0]),T.order[2]);
  assert.ok(HM.queueFor(T,T.order[0]).includes(outPlayer));
  tables.delete(code);
});

test('HTTP multiplayer: eight devices join; a spectator cannot see private hands',async()=>{
  const {server,loadFiles}=require('../server');
  loadFiles();
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
  const base=`http://127.0.0.1:${server.address().port}`;
  const mkDev=()=>({pid:`u_${crypto.randomBytes(12).toString('hex')}`,key:crypto.randomBytes(24).toString('hex')});
  const act=async (dev,op,extra={})=>{
    const response=await fetch(`${base}/api/act`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dev,op,...extra})});
    return {status:response.status,...await response.json()};
  };
  const state=async(dev,code)=>{
    const controller=new AbortController();
    const response=await fetch(`${base}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dev,code}),signal:controller.signal});
    assert.equal(response.status,200);
    const reader=response.body.getReader();let buffer='';
    try{
      for(let i=0;i<40;i++){
        const {value,done}=await reader.read();if(done)break;
        buffer+=new TextDecoder().decode(value);
        const hit=buffer.match(/event: state\ndata: ([^\n]+)\n\n/);
        if(hit)return JSON.parse(hit[1]);
      }
      throw Error('No game state arrived');
    }finally{controller.abort();await reader.cancel().catch(()=>{});}
  };
  try{
    assert.equal((await fetch(`${base}/healthz`)).status,200);
    const devices=Array.from({length:9},mkDev), spectator=mkDev();
    const created=await act(devices[0],'create',{nick:'Host'});
    assert.equal(created.ok,true);
    const code=created.code;
    for(let i=1;i<8;i++)assert.equal((await act(devices[i],'join',{code,nick:`Player${i}`})).ok,true);
    const extra=await act(devices[8],'join',{code,nick:'Ninth'});
    assert.equal(extra.ok,false);
    assert.match(extra.error,/Eight detectives/);
    assert.equal((await act(devices[0],'start',{code})).ok,true);
    const T=tables.get(code);
    assert.equal(T.order.length,8);
    const hostView=await state(devices[0],code);
    assert.equal(hostView.g.secret,undefined);
    assert.equal(hostView.g.solution,null);
    assert.equal(hostView.g.allHands,undefined);
    assert.deepEqual(hostView.mine.hands[devices[0].pid],T.secret.hands[devices[0].pid]);
    assert.equal(Object.keys(hostView.mine.hands).length,1);
    const watched=await state(spectator,code);
    assert.deepEqual(watched.mine.hands,{});
    assert.equal(watched.g.secret,undefined);
    tables.delete(code);
  }finally{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
  }
});
