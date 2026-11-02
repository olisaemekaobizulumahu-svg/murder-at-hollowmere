'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {paint,preloadScene,requiresArtwork,readyImage}=require('../src/cinema.js');
const ROOT=path.join(__dirname,'..');
function fakeContext(){let draws=0,fills=0;const gradient=()=>({addColorStop(){}});return {
 get draws(){return draws;},get fills(){return fills;},
 createLinearGradient:gradient,createRadialGradient:gradient,
 beginPath(){},closePath(){},moveTo(){},lineTo(){},roundRect(){},arc(){},ellipse(){},rect(){},
 fill(){fills++;},stroke(){},fillRect(){fills++;},strokeRect(){},clearRect(){},
 save(){},restore(){},translate(){},scale(){},rotate(){},fillText(){},
 drawImage(){draws++;},
 };}

test('every Hollowmere shot requires a unique decoded image, not the old geometry slide',()=>{
 const opening=['arrival','gathering','clock','discovery','evidence'];
 const src=fs.readFileSync(path.join(ROOT,'src/cinema.js'),'utf8');
 const hashes=new Set();
 for(const kind of opening){
  assert.equal(requiresArtwork('manor',kind),true,`${kind} has mandatory artwork`);
  const file=path.join(ROOT,'public/assets/cinematics/manor-'+kind+'.webp');
  const bytes=fs.readFileSync(file);
  assert.ok(bytes.length>12000,kind);
  hashes.add(require('node:crypto').createHash('sha1').update(bytes).digest('hex'));
 }
 assert.equal(hashes.size,5,'all five opening shots have distinct illustrations');
 for(const kind of ['event','portrait','ending','finalGathering','finalReveal','finalEpilogue'])assert.ok(requiresArtwork('manor',kind),kind);
 assert.doesNotMatch(src,/if\(!stillReady\)clock\(ctx,t\)/,'the old clock cannot appear as a fallback');
 assert.match(src,/if\(!drawStillScene\(ctx,theme,kind,t,details\)\)waitingFrame\(ctx\)/);
});

test('while an image is loading or has failed, Hollowmere never paints the retired clock',async()=>{
 const previous=global.Image;
 class SlowImage{
  constructor(){this.naturalWidth=0;this.naturalHeight=0;this.onload=null;this.onerror=null;this.decode=()=>Promise.resolve();}
  set src(url){this.url=url;SlowImage.images.push(this);}
  get src(){return this.url;}
 }
 SlowImage.images=[];
 global.Image=SlowImage;
 try{
  const ctx=fakeContext();
  const loading=preloadScene('manor','clock');
  paint(ctx,'manor','clock',2);
  assert.equal(ctx.draws,0,'never draws an old illustration while decoding');
  assert.equal(readyImage('manor','clock'),null);
  const image=SlowImage.images.find(x=>/manor-clock\.webp/.test(x.url));
  assert.ok(image,'clock asset requested');
  image.naturalWidth=1600;image.naturalHeight=900;image.onload();
  assert.equal(await loading,true);
  paint(ctx,'manor','clock',2);
  assert.ok(ctx.draws>0,'image appears once decoded');
  assert.ok(/v=1\.7\.1/.test(image.url),'image request is release-versioned');
 }finally{global.Image=previous;}
});

test('the film waits for imagery before narration or the scene clock begins',()=>{
 const src=fs.readFileSync(path.join(ROOT,'src/platform.js'),'utf8');
 const head=src.slice(src.indexOf('function renderCinematic()'),src.indexOf('function cineAction('));
 assert.match(head,/preloadScene\(o\.theme,sc\.kind\)\.then\(ok=>ok\?beginShot\(\):failShot\(\)\)/);
 const start=head.indexOf('function beginShot()'),mount=head.indexOf('HollowmereCinema?.mount(',start),narrate=head.indexOf('cinematicNarrate(o);',start);
 assert.ok(mount>start&&narrate>mount,'voice begins after image-mounted shot');
 assert.match(head,/o\.elapsed=0;o\.started=performance\.now\(\)/);
 assert.match(head,/sceneToken/,'stale image loads may not restart an earlier scene');
 assert.match(head,/This scene couldn\x27t load/,'failed assets produce a retry, never an old illustration');
});
