'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {CARD,ALL}=require('../public/rules.js');
const ROOT=path.join(__dirname,'..');
const ART=path.join(ROOT,'public/assets/cards');
const JS=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const HTML=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');

test('all 18 fixed evidence slots have their own safe, unique Gothic artwork',()=>{
 assert.equal(ALL.length,18);
 assert.equal(new Set(ALL).size,18);
 const images=new Set();
 for(const id of ALL){
  const c=CARD[id];assert.ok(['s','m','r'].includes(c.k));
  const f=path.join(ART,id+'.svg');
  const svg=fs.readFileSync(f,'utf8');
  assert.ok(svg.length>2500,`${id} artwork should be substantive`);
  assert.match(svg,/viewBox="0 0 260 340"/);
  assert.match(svg,/<linearGradient/);
  assert.match(svg,/<path /);
  assert.doesNotMatch(svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,""),/<script|<foreignObject|<iframe|javascript:|https?:\/\//i,`${id} must not load executable or remote content`);
  images.add(svg);
 }
 assert.equal(images.size,18,'all 18 slots have distinct illustrations');
});

test('all UI card contexts use a fixed illustrated asset rather than the legacy emoji',()=>{
 const app=fs.readFileSync(path.join(ROOT,'src/app_top.js'),'utf8');
 assert.match(app,/const gothicCardArt=/);
 assert.match(app,/const gothicMini=/);
 assert.match(app,/class="pc-art" src="\$\{gothicCardArt\(c\.id\)\}"/);
 assert.match(app,/const ref=id=>/);
 assert.match(app,/\$\{gothicMini\(c\.id\)\}/);
 assert.match(app,/\.map\(\(c,i\)=>cardHTML\(c,\{act:"show"/);
 assert.match(app,/data-act="pick"/);
 assert.doesNotMatch(app,/class="pc-i" aria-hidden="true">\$\{c\.icon\}/);
 assert.match(HTML,/\.pc-art\{/);
 assert.match(HTML,/\.pc-filigree\{/);
 assert.match(HTML,/\.card-back::before/);
 assert.match(JS,/gothicCardArt/);
 assert.match(JS,/gothicMini/);
});

test('Node web server serves every Gothic artwork as SVG and never changes the deck',async()=>{
 const {server,loadFiles}=require('../server');loadFiles();
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const id of ALL){
   const r=await fetch(base+'/assets/cards/'+id+'.svg?v=1.7.0');
   assert.equal(r.status,200,id);
   assert.match(r.headers.get('content-type')||'',/image\/svg\+xml/,id);
   const s=await r.text();assert.match(s,/<svg/);
  }
  assert.equal((await (await fetch(base+'/version')).json()).version,require("../package.json").version);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
