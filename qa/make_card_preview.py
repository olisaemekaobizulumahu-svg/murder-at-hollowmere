#!/usr/bin/env python3
from pathlib import Path
from html import escape
root=Path(__file__).resolve().parents[1]
css=(root/'src/style.css').read_text()+(root/'src/extra.css').read_text()
sets=[('s','who',['Aunt Philippa','Cousin Rupert','Nana Beatrice','Uncle Desmond','Cousin Imogen','Hollis'],['philippa','rupert','beatrice','desmond','imogen','hollis']),
('m','how',['Poisoned Cocoa','Mushroom Soup','Garden Shears','Fencing Foil','Jar of Wasps','Grandfather Clock'],['cocoa','soup','shears','foil','wasps','clock']),
('r','where',['Greenhouse','Wine Cellar','Attic','Boathouse','Music Room','Portrait Gallery'],['greenhouse','cellar','attic','boathouse','music','gallery'])]
def card(id,name,kind,size=''):
 cls='who' if kind=='s' else 'how' if kind=='m' else 'where'
 label='WHO' if kind=='s' else 'HOW' if kind=='m' else 'WHERE'
 return f'<button type="button" class="pc {cls} {size}" data-card="{id}" aria-label="Show {escape(name)}"><span class="pc-crown" aria-hidden="true">✦ ❧ ✦</span><span class="pc-k">{label}</span><span class="pc-i" aria-hidden="true"><img class="pc-art" src="../public/assets/cards/{id}.svg" width="260" height="340" alt=""></span><span class="pc-n">{escape(name)}</span><span class="pc-filigree" aria-hidden="true">❦</span></button>'
cards=''.join(f'<h3 class="section-h">{label.upper()}</h3><div class="cards">'+''.join(card(id,name,k) for id,name in zip(ids,names))+'</div>' for k,label,names,ids in sets)
small=''.join(card(id,name,k,'sm') for k,label,names,ids in sets for id,name in zip(ids[:2],names[:2]))
cast='<div class="cast-list">'+''.join('<div class="cast-item">'+card(id,name,k,'sm')+f'<p><b>{escape(name)}</b>At Hollowmere Manor, every guest has a secret and every clue has a story.</p></div>' for k,label,names,ids in sets for id,name in zip(ids[:2],names[:2]))+'</div>'
html=f'''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hollowmere Card QA</title><style>{css}</style><body><main class="wrap" style="max-width:1380px"><header style="padding:36px 10px;text-align:center;color:#f7deb2"><p class="eyebrow">Hollowmere Manor · Investigation Collection</p><h1 style="font-size:3rem">The Gothic Evidence Deck</h1><p>Original engraved illustrations — all eighteen cards</p></header><section class="panel" style="padding:24px">{cards}</section><section style="margin-top:30px"><h2 style="color:#f4d9a0">Compact Evidence Previews</h2><div class="cards" style="padding:20px">{small}</div></section><section id="home" style="margin-top:30px"><h2 style="color:#f4d9a0">Suspect & clue gallery</h2>{cast}</section></main></body></html>'''
p=root/'qa/gothic_cards_preview.html';p.write_text(html)
print(p)
