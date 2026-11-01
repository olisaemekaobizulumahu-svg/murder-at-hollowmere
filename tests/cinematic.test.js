'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {paint}=require('../src/cinema.js');
const {server,tables}=require('../server');
function fakeContext(){let fills=0,strokes=0;const gradient=()=>({addColorStop(){}});return {
 get fills(){return fills;},get strokes(){return strokes;},
 createLinearGradient:gradient,createRadialGradient:gradient,
 beginPath(){},closePath(){},moveTo(){},lineTo(){},roundRect(){},arc(){},ellipse(){},rect(){},
 fill(){fills++;},stroke(){strokes++;},fillRect(){fills++;},strokeRect(){strokes++;},clearRect(){},
 save(){},restore(){},translate(){},scale(){},rotate(){},fillText(){},
 };}
const device=()=>({pid:'u_'+crypto.randomBytes(12).toString('hex'),key:crypto.randomBytes(32).toString('hex')});
test('Five animated story sets paint original moving illustrations without remote dependencies',()=>{
 for(const theme of ['manor','train','ball','island'])for(const kind of ['arrival','gathering','clock','discovery','evidence']){
  const ctx=fakeContext();for(const moment of [0,2.5,6.5])paint(ctx,theme,kind,moment);
  assert.ok(ctx.fills>100,`${theme}/${kind} should draw an animated scene`);
  assert.ok(ctx.strokes>15,`${theme}/${kind} should draw meaningful scene detail`);
 }
 const bundled=fs.readFileSync(path.join(__dirname,'../public/app.js'),'utf8');
 assert.match(bundled,/HollowmereCinema/);
 assert.match(bundled,/cine-canvas/);
 assert.match(bundled,/ACT V · THE INVESTIGATION/);
});
test('Opening cinematic protects timed turns; all detectives can finish it early',async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}`;const a=device(),b=device(),watcher=device();let code;
 async function act(d,op,more={}){
  const resp=await fetch(base+'/api/act',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...d,op,code,...more})});
  return {status:resp.status,...await resp.json()};
 }
 try{
  code=(await act(a,'create',{nick:'First Detective'})).code;
  assert.ok(code);
  assert.equal((await act(b,'join',{nick:'Second Detective'})).ok,true);
  assert.equal((await act(a,'settings',{turnSeconds:30,chat:true,voice:false})).ok,true);
  assert.equal((await act(a,'start')).ok,true);
  const g=tables.get(code);
  assert.ok(g.introUntil>Date.now()+38000,'the film gets adequate opening time');
  assert.ok(g.turnExpiresAt>Date.now()+66000,'turn timer includes the intro grace');
  assert.equal((await act(watcher,'cineReady')).status,403,'spectators cannot release the opening');
  assert.equal((await act(a,'cineReady')).ok,true);
  assert.ok(g.introUntil,'one ready player cannot cut off another player’s cinematic');
  assert.equal((await act(b,'cineReady')).ok,true);
  assert.equal(g.introUntil,null,'all viewers may skip the cinematic together');
  assert.ok(g.turnExpiresAt>Date.now()+25000 && g.turnExpiresAt<Date.now()+32000,'timer resets fairly after intro');
 }finally{if(code)tables.delete(code);await new Promise(resolve=>server.close(resolve));}
});
