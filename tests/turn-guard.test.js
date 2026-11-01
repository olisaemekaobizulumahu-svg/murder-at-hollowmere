'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {server,tables,OPS,autoStep,rt}=require('../server');

const device=()=>({pid:'u_'+crypto.randomBytes(12).toString('hex'),key:crypto.randomBytes(32).toString('hex')});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const mk=()=>{
  const a=device(),b=device();
  const code=OPS.create(a.pid,{nick:'Detective A'}).code;
  OPS.join(b.pid,{code,nick:'Detective B'});
  return {a,b,code,T:tables.get(code)};
};

// A room with no live detective must not change turns, even if two or more
// detectives were marked away or an old deadline expired during a Render restart.
test('Disconnected game pauses instead of cycling through every turn',async()=>{
  const {a,b,code,T}=mk();
  try{
    OPS.settings(a.pid,{code,turnSeconds:30,chat:true,voice:false});
    OPS.start(a.pid,{code});
    T.introUntil=null;
    T.turnExpiresAt=Date.now()-120000;
    const old=T.turn,oldSeq=T.seq;
    autoStep(T);
    assert.ok(T.pausedAt,'game paused without connected humans');
    await sleep(1500);
    assert.equal(T.turn,old);
    assert.equal(T.seq,oldSeq);
    assert.equal(T.log.some(e=>e.t==='skip'),false);
    assert.equal(T.status,'playing');
    assert.ok(T.secret.hands[a.pid]&&T.secret.hands[b.pid]);
  }finally{tables.delete(code);}
});

test('Long, untimed human turn never automatically skips when detective is connected',async()=>{
  const {a,code,T}=mk();
  let controller;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    OPS.start(a.pid,{code});
    const url=`http://127.0.0.1:${server.address().port}/api/stream`;
    controller=new AbortController();
    const resp=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,code}),signal:controller.signal});
    assert.equal(resp.status,200);
    await sleep(80);
    assert.equal(T.pausedAt,null);
    T.introUntil=null;T.turn=a.pid;T.phase='turn';T.turnExpiresAt=null;T.clockStamp=null;
    const oldSeq=T.seq;
    autoStep(T);
    rt(T).keyAt=Date.now()-6*60*1000;
    autoStep(T);
    assert.equal(T.seq,oldSeq);
    assert.equal(T.turn,a.pid);
    assert.equal(T.away[a.pid],undefined);
  }finally{
    controller?.abort();tables.delete(code);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});

test('All-away room pauses, returning detective resumes rather than being skipped',async()=>{
  const {a,b,code,T}=mk();
  let ctl;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    OPS.start(a.pid,{code});
    ctl=new AbortController();
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,code}),signal:ctl.signal});
    assert.equal(response.status,200);
    await sleep(75);
    assert.equal(T.pausedAt,null);
    OPS.away(a.pid,{code,v:true});
    autoStep(T);
    assert.ok(T.pausedAt,'last active detective went away');
    const seq=T.seq;
    rt(T).keyAt=Date.now()-300000;
    autoStep(T);
    assert.equal(T.seq,seq,'no skipped turns while all are away');
    OPS.away(a.pid,{code,v:false});
    await sleep(80);
    assert.equal(T.pausedAt,null,'game resumed after detective returns');
    assert.equal(T.away[a.pid],false);
    assert.equal(T.log.filter(e=>e.t==='skip').length,0);
  }finally{
    ctl?.abort();tables.delete(code);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});

test('Timed game preserves a full deadline after disconnect pause and reconnect',async()=>{
  const {a,code,T}=mk();
  let ctl;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    OPS.settings(a.pid,{code,turnSeconds:30,chat:true,voice:false});
    OPS.start(a.pid,{code});
    T.introUntil=null;
    autoStep(T);
    assert.ok(T.pausedAt);
    // Model the room being paused for 20s, with 10s still on the current clock.
    T.clockStamp=T.turn+':turn';T.pausedClockStamp=T.clockStamp;
    T.turnExpiresAt=Date.now()+10000;
    T.pausedAt=Date.now()-20000;
    ctl=new AbortController();
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,code}),signal:ctl.signal});
    assert.equal(response.status,200);
    await sleep(70);
    const remaining=T.turnExpiresAt-Date.now();
    assert.ok(remaining>28500 && remaining<31500,`timer should extend by paused time; got ${remaining}`);
    assert.equal(T.pausedAt,null);
    assert.equal(T.log.filter(e=>e.t==='skip').length,0);
  }finally{
    ctl?.abort();tables.delete(code);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
});

test('Expired configured timer skips exactly one turn, without a runaway skip chain',async()=>{
  const {a,b,code,T}=mk();let ctl;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    OPS.settings(a.pid,{code,turnSeconds:30,chat:true,voice:false});OPS.start(a.pid,{code});
    ctl=new AbortController();
    const resp=await fetch(`http://127.0.0.1:${server.address().port}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,code}),signal:ctl.signal});
    assert.equal(resp.status,200);await sleep(65);
    T.introUntil=null;T.turn=a.pid;T.phase='turn';T.clockStamp=a.pid+':turn';T.turnExpiresAt=Date.now()-1;
    autoStep(T);
    assert.equal(T.turn,b.pid);
    const skipped=T.log.filter(e=>e.t==='skip');
    assert.equal(skipped.length,1);
    assert.equal(skipped[0].who,a.pid);
    assert.equal(skipped[0].reason,'timer');
    assert.ok(T.turnExpiresAt>Date.now()+25000,'next turn gets its OWN timer');
    autoStep(T);
    assert.equal(T.log.filter(e=>e.t==='skip').length,1,'no immediate chain skip');
  }finally{ctl?.abort();tables.delete(code);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('One offline detective may be skipped once after grace, without being permanently Away',async()=>{
  const {a,b,code,T}=mk();let ctl;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    OPS.start(a.pid,{code});
    ctl=new AbortController();
    const resp=await fetch(`http://127.0.0.1:${server.address().port}/api/stream`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...a,code}),signal:ctl.signal});
    assert.equal(resp.status,200);await sleep(65);
    T.introUntil=null;T.turn=b.pid;T.phase='turn';T.clockStamp=b.pid+':turn';T.turnExpiresAt=null;
    rt(T).seen[b.pid]=Date.now()-140000;
    autoStep(T);
    rt(T).keyAt=Date.now()-30000;
    autoStep(T);
    assert.equal(T.turn,a.pid,'connected detective takes the next turn');
    const skips=T.log.filter(e=>e.t==='skip');
    assert.equal(skips.length,1);
    assert.equal(skips[0].reason,'offline');
    assert.ok(!T.away[b.pid],'offline player is not automatically marked away');
    assert.equal(T.pausedAt,null,'connected human keeps the game active');
    autoStep(T);assert.equal(T.log.filter(e=>e.t==='skip').length,1);
  }finally{ctl?.abort();tables.delete(code);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
