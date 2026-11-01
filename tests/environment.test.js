'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const assets=path.join(ROOT,'public/assets/cinematics');

test('cinematic general background is bundled and replaces the old tiled page pattern',()=>{
 const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
 const cinema=fs.readFileSync(path.join(ROOT,'src/cinema.js'),'utf8');
 assert.match(html,/hollowmere-background\.webp/);
 assert.match(html,/background-attachment:fixed,fixed,fixed/);
 assert.match(html,/#table \.bar\{/);
 assert.match(html,/#home \.hero-copy\{/);
 for (const kind of ['arrival','gathering','clock','discovery','evidence','event','portrait','finalGathering','finalReveal','finalEpilogue']){
  assert.match(cinema,new RegExp(kind+':"\\/assets\\/cinematics\\/manor-'));
 }
 for (const name of ['hollowmere-background','manor-arrival','manor-gathering','manor-clock','manor-discovery','manor-evidence','manor-study','manor-private','manor-reveal','manor-verdict']){
  const buf=fs.readFileSync(path.join(assets,name+'.webp'));
  assert.ok(buf.length>15_000 && buf.length<800_000,name+' file is present and optimized');
  assert.equal(buf.toString('ascii',0,4),'RIFF');
  assert.equal(buf.toString('ascii',8,12),'WEBP');
 }
});

test('the actual multiplayer server serves cinematic assets and the updated version',async()=>{
 const {server,loadFiles}=require('../server');
 loadFiles();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  for(const file of ['hollowmere-background.webp','manor-arrival.webp','manor-verdict.webp']){
   const response=await fetch(url+'/assets/cinematics/'+file);
   assert.equal(response.status,200,file);
   assert.match(response.headers.get('content-type')||'',/image\/webp/);
  }
  const version=await fetch(url+'/version');
  assert.equal((await version.json()).version,'1.5.1');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
