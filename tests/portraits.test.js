"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const HM=require("../public/rules.js");
const base=path.join(__dirname,"../public");
test("all eight detective characters have distinct bundled portrait assets",()=>{
 assert.equal(HM.DETECTIVES.length,8);
 const seen=new Set();
 for(const d of HM.DETECTIVES){
  assert.match(d.portrait,/^assets\/detectives\/[a-z]+\.webp$/);
  assert(!seen.has(d.portrait),"portrait must be unique");seen.add(d.portrait);
  const file=path.join(base,d.portrait);
  assert(fs.existsSync(file),`missing ${file}`);
  const raw=fs.readFileSync(file);
  assert(raw.length>3000);
  assert.equal(raw.toString("ascii",0,4),"RIFF");
  assert.equal(raw.toString("ascii",8,12),"WEBP");
 }
});
test("rendered web app includes image gallery, portrait selection and current-player portrait",()=>{
 const js=fs.readFileSync(path.join(base,"app.js"),"utf8");
 const html=fs.readFileSync(path.join(base,"index.html"),"utf8");
 assert.match(js,/function detectivePortrait/);
 assert.match(js,/character-options/);
 assert.match(js,/data-act="pickcharacter"/);
 assert.match(js,/character-option-face/);
 assert.match(js,/detective-playing-face/);
 assert.match(js,/"seat-portrait"/);
 assert.match(js,/winner-portrait-face/);
 assert.match(html,/\.detective-card-face/);
});

test("HTTP server serves original WebP character portraits from the nested public assets directory",async()=>{
 const {server,loadFiles}=require("../server");
 loadFiles();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const d of HM.DETECTIVES){
   const resp=await fetch(`${url}/${d.portrait}`);
   assert.equal(resp.status,200,`character portrait ${d.name} not served`);
   assert.equal(resp.headers.get("content-type"),"image/webp");
   assert.ok((await resp.arrayBuffer()).byteLength>3000);
  }
  assert.equal((await fetch(`${url}/assets/detectives/../../server.js`)).status,404);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
