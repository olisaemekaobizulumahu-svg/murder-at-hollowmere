'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('voice-over starts with each scene and does not require a Narrate button',()=>{
 const source=fs.readFileSync(path.join(root,'src/platform.js'),'utf8');
 const built=fs.readFileSync(path.join(root,'public/app.js'),'utf8');
 assert.match(source,/cinematicNarrate\(o\);/);
 assert.match(source,/o\.voiceState==="speaking"\|\|o\.voiceState==="starting"/);
 assert.match(source,/function cinematicArmVoice\(\)/);
 assert.match(source,/addEventListener\("pointerdown",cinematicArmVoice/);
 assert.match(source,/data-cine="voice"/);
 assert.doesNotMatch(source,/data-cine="narrate"/);
 assert.match(source,/speechSynthesis\.speak\(u\)/);
 assert.match(source,/if\(elapsed>=duration&&!o\.paused&&\(!voiceBusy\|\|voiceStuck\)\)/);
 assert.match(built,/Mute voice/);
});
