#!/usr/bin/env python3
"""Apply Gothic evidence card presentation (no gameplay data changes)."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
js=root/'src/app_top.js'
s=js.read_text()
old='''const ref=id=>{const c=CARD[id];return c?`<span class="ref ${KCLS[c.k]}">${c.icon} ${esc(c.name)}</span>`:"";};'''
new='''/* Fixed illustrations are indexed by the trusted 18-card deck; never by user input. */
const gothicCardArt=id=>`assets/cards/${encodeURIComponent(id)}.svg?v=${encodeURIComponent(BUILD_VERSION)}`;
const gothicMini=id=>`<img class="gothic-mini" src="${gothicCardArt(id)}" width="28" height="36" alt="" aria-hidden="true" decoding="async">`;
const ref=id=>{const c=CARD[id];return c?`<span class="ref ${KCLS[c.k]}">${gothicMini(c.id)}<span>${esc(c.name)}</span></span>`:"";};'''
assert old in s
s=s.replace(old,new)
old='''  const inner=`<span class="pc-k">${KLAB[c.k]}</span><span class="pc-i" aria-hidden="true">${c.icon}</span><span class="pc-n">${esc(c.name)}</span>${o.tag?`<span class="pc-tag">${esc(o.tag)}</span>`:""}`;
  if(o.act)return `<button type="button" class="${cls}"${sty} data-act="${o.act}" data-card="${c.id}" aria-label="Show ${esc(c.name)}">${inner}</button>`;'''
new='''  const inner=`<span class="pc-crown" aria-hidden="true">✦ ❧ ✦</span><span class="pc-k">${KLAB[c.k]}</span><span class="pc-i" aria-hidden="true"><img class="pc-art" src="${gothicCardArt(c.id)}" width="260" height="340" alt="" decoding="async" loading="eager"></span><span class="pc-n">${esc(c.name)}</span><span class="pc-filigree" aria-hidden="true">❦</span>${o.tag?`<span class="pc-tag">${esc(o.tag)}</span>`:""}`;
  if(o.act)return `<button type="button" class="${cls}"${sty} data-act="${o.act}" data-card="${c.id}" aria-label="Show ${esc(c.name)}">${inner}</button>`;'''
assert old in s
s=s.replace(old,new)
old='''return `<button type="button" class="${cls}" data-act="pick" data-k="${k}" data-id="${c.id}" aria-pressed="${on}"><span aria-hidden="true">${c.icon}</span>${esc(c.short)}${mine?'<span class="mine">yours</span>':""}</button>`;'''
new='''return `<button type="button" class="${cls}" data-act="pick" data-k="${k}" data-id="${c.id}" aria-pressed="${on}">${gothicMini(c.id)}<span>${esc(c.short)}</span>${mine?'<span class="mine">yours</span>':""}</button>`;'''
assert old in s
s=s.replace(old,new)
old='''<span class="i" aria-hidden="true">${c.icon}</span>${esc(c.name)}'''
new='''<span class="i" aria-hidden="true">${gothicMini(c.id)}</span>${esc(c.name)}'''
assert old in s
s=s.replace(old,new)
js.write_text(s)

css=root/'src/extra.css'
t=css.read_text()
t+='''

/* v1.7.0 — original Gothic collectible-card collection. No rules or card identifiers change. */
:root{--gilt:#d4a95c;--gilt-light:#f0d9a0;--bronze:#84603e;--noir:#171521}
.pc{
 --k:var(--who-c);
 width:132px;aspect-ratio:2/3;min-height:0;
 display:flex;flex-direction:column;justify-content:flex-start;align-items:center;gap:0;
 padding:7px 8px 9px;border-radius:10px;overflow:hidden;
 background:linear-gradient(155deg,#4e342b 0%,#bd965f 4%,#f1d6a0 6%,#503a36 9%,#241d28 13%,#181720 86%,#62452e 94%,#d4b071 97%,#735039 100%);
 border:1px solid #c7a66c;
 box-shadow:inset 0 0 0 2px #31232a,inset 0 0 0 4px #b78b52,0 10px 24px #08091070,0 2px 1px #ffe6ae30;
 color:#f4dfb8;
 transition:transform .18s ease,box-shadow .18s ease,filter .18s ease;
}
.pc::before{inset:4px;border-radius:7px;border:1px solid #e1b77770;opacity:1;z-index:0}
.pc::after{background:linear-gradient(112deg,transparent 32%,#ffe6aa20 43%,#ffe9c94d 49%,transparent 62%);opacity:0;transform:translateX(-90%);transition:opacity .28s,transform .5s;z-index:6}
.pc.tilt::after,.pc:hover::after{opacity:.7;transform:translateX(70%)}
.pc.how{--k:#84b59b}.pc.where{--k:#8faed3}.pc.who{--k:#d395ab}
.pc-crown{font:600 9px/1 Georgia,serif;letter-spacing:.15em;color:#e2be81;flex:none;height:13px;margin-top:5px;text-shadow:0 0 8px #eac78566}
.pc-k{font:600 .61rem/1.1 var(--f-sc);letter-spacing:.18em;color:#edd4a0;text-transform:uppercase;padding:0 0 5px;flex:none}
.pc-i{display:flex;align-items:stretch;justify-content:stretch;width:100%;height:auto;aspect-ratio:260/340;max-height:none;min-height:0;flex:1 1 auto;overflow:hidden;margin:0 0 6px;padding:0;border-radius:6px;background:#1b1e29;border:1px solid #bd985b;box-shadow:inset 0 0 0 1px #f1d4a84a,0 3px 9px #0007}
.pc-art{display:block;width:100%;height:100%;object-fit:cover;max-height:100%;border-radius:5px;filter:saturate(.93) contrast(1.04)}
.pc-n{display:flex;align-items:center;justify-content:center;min-height:30px;max-width:100%;font:600 clamp(.91rem,1.25vw,1.08rem)/.99 var(--f-display);letter-spacing:.006em;color:#f6e7cb;text-wrap:balance;text-shadow:0 2px 3px #0008;overflow-wrap:anywhere}
.pc-filigree{font:14px/1 Georgia,serif;color:#d3a972;height:15px;flex:none;margin-top:2px}
.pc.sm{width:93px;aspect-ratio:2/3;padding:5px 5px 5px;border-radius:7px}
.pc.sm::before{inset:3px;border-radius:5px}
.pc.sm .pc-crown{height:9px;margin-top:3px;font-size:6px}
.pc.sm .pc-k{font-size:.46rem;letter-spacing:.11em;padding-bottom:3px}
.pc.sm .pc-i{margin:0 0 4px;border-radius:3px}
.pc.sm .pc-art{border-radius:2px}
.pc.sm .pc-n{font-size:.78rem;line-height:.97;min-height:22px}
.pc.sm .pc-filigree{font-size:11px;height:11px;margin-top:1px}
.pc.lg{width:155px}
.pc.lg .pc-n{font-size:1.25rem;min-height:35px}
.pc-tag{font-family:var(--f-body);background:#392b2b;color:#f9e3b8;border:1px solid #ac864d;z-index:6}
.cards{gap:12px}
.cards.fan{justify-content:center;padding:16px 10px 32px}
.cards.fan .pc{margin-inline:-7px;transform-origin:50% 120%}
.cards.fan.tight .pc{margin-inline:-19px}
button.pc:hover{--ty:-8px;box-shadow:inset 0 0 0 2px #31232a,inset 0 0 0 4px #e4ba71,0 15px 27px #08091088,0 0 0 2px #e4ba7155;filter:saturate(1.08)}
button.pc:focus-visible{outline:3px solid #e4c27d;outline-offset:4px;box-shadow:0 0 0 5px #281b25}
.dock-cards .pc{width:96px;min-width:96px}
.dock-cards{gap:12px;scroll-padding-inline:14px}
.dock-cards .pc .pc-n{font-size:.75rem}
.cast-list{grid-template-columns:repeat(auto-fill,minmax(min(100%,350px),1fr));gap:16px}
.cast-item{gap:14px;align-items:center}
.cast-item .pc.sm{width:107px;min-width:107px;flex:0 0 107px}
.cast-item .pc.sm .pc-n{font-size:.9rem;line-height:1}
.cast-item b{font-size:1.31rem;color:#f2d6a6;line-height:1.04;margin-bottom:8px}
.cast-item p{font-size:.97rem;line-height:1.55;color:#ebdaca}
#home .cast-item{padding:14px 15px;border-color:#c6a16c66;background:linear-gradient(130deg,#10121be8,#24202be8)}
.ref{display:inline-flex;align-items:center;gap:5px;vertical-align:middle;white-space:normal}
.ref .gothic-mini{width:23px;height:30px;object-fit:cover;border-radius:3px;border:1px solid #b08b56;box-shadow:0 2px 6px #0003;flex:none}
.ref span{line-height:1.15}
.ref.who{color:var(--who)}.ref.how{color:var(--how)}.ref.where{color:var(--where)}
.ledger tbody th .i{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;width:24px;margin-right:5px}
.ledger tbody th .gothic-mini{width:19px;height:26px;object-fit:cover;border-radius:2px;border:1px solid #a98a68}
.pick .gothic-mini{width:28px;height:36px;object-fit:cover;border-radius:3px;border:1px solid #d1ac69;flex:none}
.card-back{border-radius:9px;background:radial-gradient(circle at 50% 50%,#622c3e55,#1c1623 60%),repeating-linear-gradient(45deg,#c5a06a23 0 2px,transparent 2px 13px),#1c1722;box-shadow:inset 0 0 0 3px #201b24,inset 0 0 0 6px #b7985f,0 10px 24px #07090c90}
.card-back::before{content:"❧";position:absolute;inset:12px;border:1px solid #c8a36899;display:grid;place-items:center;color:#d5b274;font:2rem/1 var(--f-display);border-radius:6px}
.card-back::after{content:"H";background:radial-gradient(circle at 38% 32%,#ae4455,#6e1c2a 65%,#35151f);border:2px solid #c4a476;color:#ffedc1;box-shadow:0 5px 12px #0009}
.handbox .cards.fan{overflow:visible}
@media(max-width:700px){
 .pc{width:112px}.pc.lg{width:129px}.pc.sm{width:86px}
 .cards.fan .pc{margin-inline:-8px}
 .cards.fan.tight .pc{margin-inline:-17px}
 .cast-list{grid-template-columns:minmax(0,1fr)}
 .cast-item .pc.sm{width:96px;min-width:96px;flex-basis:96px}
 .dock-cards .pc{width:82px;min-width:82px}
 .pc-n{font-size:.98rem}
}
@media(max-width:380px){.cards.fan.tight .pc{margin-inline:-24px}.cards.fan .pc{margin-inline:-13px}.pc.sm{width:82px}}
@media(prefers-reduced-motion:reduce){.pc,.pc::after{transition:none}.pc.tilt{transition:none}}
'''
css.write_text(t)
print('Applied Gothic card UI changes to source')
