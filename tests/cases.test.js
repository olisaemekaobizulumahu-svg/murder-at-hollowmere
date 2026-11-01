'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {CASES,BY_ID,ids,displayCase,noteFor}=require('../public/cases');
const HM=require('../public/rules');
test('All four official cases have consistent 18-card scenario data',()=>{
  assert.equal(CASES.length,4);
  assert.equal(new Set(CASES.map(c=>c.id)).size,4);
  assert.equal(HM.ALL.length,18);
  for(const c of CASES){
    assert.ok(c.opening.length>=60,`${c.id} has narrative opening`);
    assert.ok(c.title&&c.tagline&&c.theme);
    assert.equal(BY_ID[c.id],c);
    const names=displayCase(c);
    if(c.id==='hollowmere')assert.equal(Object.keys(names).length,0);
    else {
      assert.equal(Object.keys(names).length,18);
      for(const k of ['s','m','r']){
        assert.equal(c.names[k].length,6);
        assert.equal(c.notes[k].length,6);
        assert.ok(c.notes[k].every(v=>v.length>=30));
        assert.ok(ids[k].every(id=>names[id]&&noteFor(c,id)));
      }
      assert.equal(new Set(Object.values(names)).size,18);
    }
  }
});
