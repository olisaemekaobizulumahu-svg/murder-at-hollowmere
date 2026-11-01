"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const ROOT=path.join(__dirname,"..");
const VERSION=require("../package.json").version;
test("generated browser assets are versioned and portrait images are present",()=>{
 const html=fs.readFileSync(path.join(ROOT,"public/index.html"),"utf8");
 const js=fs.readFileSync(path.join(ROOT,"public/app.js"),"utf8");
 for(const pathName of ["rules.js","cases.js","app.js"])assert.match(html,new RegExp(`${pathName.replace(".","\\.")}\\?v=${VERSION.replaceAll(".","\\.")}`));
 assert.match(html,/build-stamp/);
 assert.match(html,new RegExp(`v${VERSION.replaceAll(".","\\.")} . portraits`));
 assert.match(js,/const BUILD_VERSION/);
 assert.match(js,/character.portrait/);
 assert.match(js,/encodeURIComponent\(BUILD_VERSION\)/);
});
test("server publishes release ID and revalidates script assets",async()=>{
 const {server,loadFiles}=require("../server");loadFiles();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 try{
 const url=`http://127.0.0.1:${server.address().port}`;
 const version=await fetch(url+"/version");assert.equal(version.status,200);assert.equal((await version.json()).version,VERSION);assert.match(version.headers.get("cache-control"),/no-store/);
 for(const route of ["/index.html","/app.js","/rules.js","/cases.js"]){const r=await fetch(url+route);assert.equal(r.status,200);assert.match(r.headers.get("cache-control"),/no-cache/);}
 const image=await fetch(url+"/assets/detectives/blackwood.webp?v="+VERSION);assert.equal(image.status,200);assert.equal(image.headers.get("content-type"),"image/webp");
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
