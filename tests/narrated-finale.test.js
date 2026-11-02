'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {paint}=require('../src/cinema.js');
const root=path.join(__dirname,'..');
function fakeCtx(){let fills=0;const g=()=>({addColorStop(){}});return {get fills(){return fills},fillStyle:'',strokeStyle:'',lineWidth:1,createLinearGradient:g,createRadialGradient:g,beginPath(){},arc(){},ellipse(){},rect(){},roundRect(){},moveTo(){},lineTo(){},closePath(){},fill(){fills++},stroke(){},fillRect(){fills++},strokeRect(){},clearRect(){},save(){},restore(){},translate(){},scale(){},rotate(){},fillText(){fills++},measureText(t){return {width:String(t).length*12}}};}
test('three unique conclusion scenes animate without exposing secrets until the case ends',()=>{
 const details={solution:['The culprit','A poisoned cup','The gallery'],winner:'Alex',success:true};
 for(const kind of ['finalGathering','finalReveal','finalEpilogue']){
  const a=fakeCtx();for(const t of [0,2.2,5.4,8.9,12])paint(a,'manor',kind,t,details);
  assert.ok(a.fills>10,`${kind} must render cinematographic overlays without old slides`);
 }
 const f=fakeCtx();paint(f,'manor','finalEpilogue',7,{success:false,solution:[]});assert.ok(f.fills>10);
});
test('cinematics autoplay narration and use compact film-first captions',()=>{
 const src=fs.readFileSync(path.join(root,'src/platform.js'),'utf8'),css=fs.readFileSync(path.join(root,'src/extra.css'),'utf8');
 const built=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
 assert.match(src,/cinematicNarrate\(o\);/);
 assert.match(src,/speechSynthesis\.speak\(u\)/);
 assert.match(src,/"Narration starting automatically"/);
 assert.match(src,/Browser blocked audio · captions are on/);
 assert.match(src,/speechSynthesis\.pause\(\)/);
 assert.match(src,/speechSynthesis\.resume\(\)/);
 assert.match(src,/finalReveal/);
 assert.match(src,/voiceOn:narrationSupported&&!PLATFORM.narrationMuted/);
 assert.match(src,/data-cine="voice"/);
 assert.doesNotMatch(src,/data-cine="narrate"/);
 assert.match(src,/cinematicArmVoice/);
 assert.match(src,/voiceStuck/);
 assert.match(css,/film-first cinematic experience/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(built,/finalRevelation|finaleRevelation/);
});
