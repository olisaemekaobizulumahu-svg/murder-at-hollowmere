'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.join(__dirname,'..');
const stage=fs.readFileSync(path.join(ROOT,'src/stage.js'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'src/extra.css'),'utf8');
const built=fs.readFileSync(path.join(ROOT,'public/app.js'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'public/index.html'),'utf8');
test('cinematic board uses real 3D PBR lighting, textural geometry and a budgeted saver',()=>{
 for(const token of ['ACESFilmicToneMapping','sRGBEncoding','PCFSoftShadowMap','FogExp2','bumpMap:','roughness:', 'MeshStandardMaterial', 'buildChandelier()', 'roomDecor(rm.id,a,grp)', 'TorusGeometry', 'shadow.normalBias'])
  assert.ok(stage.includes(token),`missing immersive rendering element ${token}`);
 assert.match(stage,/setPixelRatio\(Math\.min\(window\.devicePixelRatio\|\|1,st\.saver\?1\.15:1\.8\)\)/);
 assert.match(stage,/st\.saver\?1\.1:1\.23/);
});
test('detective gameplay remains active and costumes remain clickable',()=>{
 assert.match(stage,/pieces\[s\.id\]=\{g,mat,base:/);
 assert.match(stage,/torso\.userData\.pick=\{k:"s",id:s\.id\}/);
 assert.match(stage,/pickables\.push\(torso\)/);
 assert.match(stage,/api\.onPick\(u\.pick\.k,u\.pick\.id\)/);
 assert.match(stage,/function sync\(g,code\)/);
 assert.match(stage,/function layout\(locS,locM\)/);
});
test('camera buttons provide zoom, overhead, film orbit and reset without hiding gameplay',()=>{
 for(const op of ['zoomIn','zoomOut','top','film','reset'])assert.match(stage,new RegExp(`data-camera=\\\\"${op}\\\\"|data-camera="${op}"`));
 assert.match(stage,/setAttribute\("aria-label","3D manor camera controls"\)/);
 assert.match(stage,/aria-pressed/);
 assert.match(stage,/st\.zoom=clamp/);
 assert.match(stage,/st\.filmOrbit&&!REDUCED/);
 assert.match(stage,/if\(st\.topView\)want\.el=1\.47/);
 assert.match(css,/stage-camera-controls/);
 assert.match(built,/ACESFilmicToneMapping/);
 assert.match(html,/v1\.6\.0/);
});
test('chandelier does not block investigation or overhead view',()=>{
 assert.match(stage,/if\(chandelier\)chandelier\.visible=!st\.topView&&f\.mode!=="envelope"&&f\.mode!=="reveal"/);
});
