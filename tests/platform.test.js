'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {server,loadFiles,tables,OPS}=require('../server');
function device(){return {pid:'u_'+crypto.randomBytes(12).toString('hex'),key:crypto.randomBytes(32).toString('hex')}}
test('Platform API: account, case selection, timer, community review, chat isolation, XP, friends, tournament',async()=>{
  loadFiles();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}`;
  const A=device(),B=device(),W=device();let code;
  async function act(dev,op,extra={}){const resp=await fetch(url+'/api/act',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dev,op,...extra})});return {status:resp.status,...await resp.json()};}
  async function getState(dev,room){const ctl=new AbortController();try{
    const res=await fetch(url+'/api/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...dev,code:room}),signal:ctl.signal});
    let buf='';for await(const chunk of res.body){buf+=Buffer.from(chunk).toString();const m=buf.match(/event: state\ndata: ([^\n]+)\n\n/);if(m)return JSON.parse(m[1]);if(buf.length>1000000)throw Error('stream overflow');}
    throw Error('no state received');
  }finally{ctl.abort();}}
  try{
    assert.equal((await act(A,'register',{handle:'alpha_test',password:'very-secure-pass-123'})).ok,true);
    assert.equal((await act(B,'register',{handle:'beta_test',password:'another-secure-pass-123'})).ok,true);
    assert.equal((await act(A,'register',{handle:'alpha_test',password:'another-secure-pass'})).ok,false);
    assert.equal((await act(A,'friendRequest',{handle:'beta_test'})).ok,true);
    assert.deepEqual((await act(B,'profile')).profile.requests,['alpha_test']);
    assert.equal((await act(B,'friendAccept',{handle:'alpha_test'})).ok,true);
    assert.deepEqual((await act(A,'profile')).profile.friends,['beta_test']);
    assert.equal((await act(B,'login',{handle:'beta_test',password:'WRONG-password'})).status,401);
    const tour=await act(A,'tournamentCreate',{title:'October Manor Championship'});
    assert.equal(tour.ok,true);
    assert.equal((await act(B,'tournamentJoin',{id:tour.id})).ok,true);
    code=(await act(A,'create',{nick:'Alpha'})).code;
    assert.ok(code);
    assert.equal((await act(B,'join',{code,nick:'Beta'})).seated,true);
    assert.equal((await act(A,'settings',{code,turnSeconds:30,chat:true,voice:true})).ok,true);
    assert.equal((await act(B,'settings',{code,turnSeconds:0,chat:false})).status,403);
    assert.equal((await act(A,'setcase',{code,caseId:'express'})).ok,true);
    assert.equal(tables.get(code).caseData.title,'Death on the Midnight Express');
    assert.equal((await act(A,'tournamentSet',{code,id:tour.id})).ok,true);
    assert.equal((await act(A,'start',{code})).ok,true);
    assert.ok(tables.get(code).turnExpiresAt>Date.now());
    assert.equal((await act(A,'chat',{code,text:'The evidence has arrived',channel:'room'})).ok,true);
    // Rate limit is intentional; space messages only in tests that need a second message.
    assert.equal((await act(B,'chat',{code,text:'Private from Beta',channel:'private',to:A.pid})).ok,true);
    assert.equal((await act(W,'chat',{code,text:'I am watching',channel:'spectators'})).ok,true);
    const prediction=await act(W,'predict',{code,nick:'Quiet Observer',cards:['philippa','cocoa','greenhouse']});
    assert.equal(prediction.ok,true);
    assert.equal((await act(W,'predict',{code,nick:'Again',cards:['rupert','soup','attic']})).ok,false);
    assert.equal((await act(B,'predict',{code,cards:['rupert','soup','attic']})).status,403);
    const va=await getState(A,code),vb=await getState(B,code),vw=await getState(W,code);
    assert.equal(va.g.secret,undefined);assert.equal(va.g.messages,undefined);
    assert.ok(va.mine.chat.some(m=>m.text==='Private from Beta'));
    assert.ok(vb.mine.chat.some(m=>m.text==='Private from Beta'));
    assert.equal(vw.mine.chat.some(m=>m.text==='Private from Beta'),false);
    assert.equal(vw.mine.chat.some(m=>m.text==='The evidence has arrived'),false);
    assert.ok(vw.mine.prediction);
    assert.equal(va.mine.prediction,null);
    assert.equal(va.g.spectatorRankings,undefined);
    assert.ok(vw.mine.chat.some(m=>m.text==='I am watching'));
    assert.equal(va.mine.chat.some(m=>m.text==='I am watching'),false);
    assert.equal((await act(A,'reportChat',{code,id:va.mine.chat.find(m=>m.text==='The evidence has arrived').id})).ok,true);
    assert.equal((await act(A,'mute',{code,target:B.pid,mute:true})).ok,true);
    assert.equal((await act(B,'chat',{code,text:'Blocked message',channel:'room'})).status,403);
    assert.ok(va.mine.chat.some(m=>m.text==='The evidence has arrived'));
    assert.equal((await act(A,'endcase',{code})).ok,true);
    assert.ok(tables.get(code).spectatorRankings.some(x=>x.nick==='Quiet Observer'));
    assert.ok((await act(A,'profile')).profile.xp>=25);
    assert.ok((await act(B,'profile')).profile.xp>=25);
    const newCase=await act(A,'caseCreate',{title:'The Snowbound Lodge',opening:'A frozen mountain pass kept everybody inside the lodge for three days. An eerie voice sounded from the staircase just before the famous host vanished, and nobody knew what happened.',names:{s:['One','Two','Three','Four','Five','Six'],m:['Tea','Mushroom','Knife','Rope','Arrow','Weight'],r:['Hall','Cellar','Loft','Yard','Lounge','Gallery']}});
    assert.equal(newCase.ok,true);
    const D=device();await act(D,'profile');
    const other=await act(D,'profile');
    assert.ok(!other.cases.some(c=>c.id===newCase.caseId),'drafts must not be discoverable by strangers');
    assert.ok((await act(A,'profile')).cases.some(c=>c.id===newCase.caseId));
    assert.equal((await act(A,'caseSubmit',{caseId:newCase.caseId})).status,'review');
    assert.equal((await act(D,'caseReview',{caseId:newCase.caseId,approve:true,moderatorKey:'unapproved'})).status,403);
  }finally{if(code)tables.delete(code);await new Promise(resolve=>server.close(resolve));}
});
