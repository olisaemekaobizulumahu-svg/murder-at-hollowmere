#!/usr/bin/env python3
"""Generate eighteen original Victorian-Gothic illustrated card portraits (SVG).
Fixed, non-executable local SVG assets. Game rules/cards remain untouched.
"""
from pathlib import Path
from html import escape
import math

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/cards'
OUT.mkdir(parents=True,exist_ok=True)
PAL={
 's':dict(ink='#301d2a',shadow='#160f1b',highlight='#bd8b9d',light='#f6d9cb',border='#ad7382',accent='#69364e',bg='#443443',category='SUSPECT'),
 'm':dict(ink='#222c27',shadow='#101b17',highlight='#91b2a4',light='#d9e7d1',border='#729284',accent='#356c5e',bg='#30423b',category='METHOD'),
 'r':dict(ink='#212b3b',shadow='#0d1627',highlight='#9eb5cd',light='#d9e1ef',border='#7693b4',accent='#3b5b8a',bg='#354159',category='LOCATION'),
}

def P(d,fill='ink',stroke=None,sw=None,extra=''):
    attrs=f'fill="{fill}"'
    if stroke: attrs+=f' stroke="{stroke}" stroke-width="{sw or 2}" stroke-linejoin="round" stroke-linecap="round"'
    return f'<path d="{d}" {attrs} {extra}/>'
def C(x,y,r,fill,stroke=None,sw=2):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>'
def E(x,y,rx,ry,fill,stroke=None,sw=2):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>'
def R(x,y,w,h,r,fill,stroke=None,sw=2):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '')+'/>'
def L(d,color='#bd9b64',w=2.5):return P(d,'none',color,w)

def family(head,gender='man',variant=0,headgear=''):
    # Bespoke carved portraits: silhouette with shoulders, collar, jacket and face.
    x,y=130,166
    jacket=['#25232a','#282636','#3e2a38','#34323a','#283c3b','#382d29'][variant]
    jacket_light=['#756577','#6c627b','#8c6475','#786b6d','#67847f','#8a7367'][variant]
    out=[]
    out.append(E(x,243,86,17,'#0a1014', '#d0a06b',2))
    out.append(P('M48 257 Q58 210 85 203 Q103 194 111 190 L145 190 Q164 191 177 206 Q203 218 211 257 Z',jacket,'#c6a57d',3))
    out.append(P('M111 187 L128 220 L147 187 L155 208 L141 249 L115 249 L103 211Z','#e0d0b1'))
    out.append(L('M120 198 L129 220 L139 198', '#8e6343',2.2))
    out.append(P('M89 202 L117 232 L104 248 L81 215Z',jacket_light))
    out.append(P('M169 202 L145 232 L154 248 L181 215Z',jacket_light))
    out.append(R(121,219,18,34,1,'#1a1f28'))
    out.append(C(129,230,2.6,'#e4c58b'))
    out.append(C(129,239,2.6,'#e4c58b'))
    out.append(P('M117 170 L117 195 Q130 208 144 195 L144 170Z','#a77d67'))
    out.append(E(130,142,43,55,'#d2a990','#8f6e5c',3))
    out.append(P('M92 129 Q83 83 128 87 Q166 83 172 121 L164 137 L160 105 Q145 119 120 112 Q113 135 94 136 Z','#251d27'))
    out.append(L('M108 148 Q114 143 121 147 M138 147 Q148 142 154 146','#4c3336',2.8))
    out.append(L('M117 171 Q128 175 142 171','#98665d',2))
    out.append(L('M130 148 L125 160 L135 160','#976f63',2))
    if gender=='woman':
        out.append(P('M92 115 Q89 156 87 183 Q96 195 106 183 L103 153Z','#261d27'))
        out.append(P('M166 116 Q171 162 175 183 Q164 193 157 182 L158 151Z','#2b202d'))
        out.append(P('M82 119 Q93 91 130 88 Q167 88 179 119 Q149 108 129 98 Q111 109 82 119Z','#49313a','#cba674',3))
        out.append(C(89,155,5,'#d8b983'))
        out.append(C(171,155,5,'#d8b983'))
    if variant==0: # Philippa: formal broad hat & rose
        out.append(E(131,109,84,12,'#311c31','#cead78',3))
        out.append(P('M89 110 Q96 62 128 63 Q163 62 171 110Z','#4e3044','#d9b47e',3))
        out.append(C(166,87,9,'#aa677d'))
        out.append(P('M165 85 Q175 73 183 86 Q175 96 165 85Z','#718c73'))
        out.append(C(103,237,7,'#9d5367','#dbb781',2))
    elif variant==1: # Rupert top hat
        out.append(R(100,53,61,67,7,'#1a1c26','#cbb080',3))
        out.append(R(88,115,87,11,5,'#1c1e26','#caac78',2))
        out.append(R(101,104,59,10,0,'#644455'))
        out.append(P('M147 205 L163 205 L150 231Z','#d9b878'))
    elif variant==2: # Beatrice hair bun + brooch
        out.append(C(98,111,19,'#3c2831'))
        out.append(P('M94 123 Q96 81 130 79 Q158 82 168 120 Q149 103 135 107 Q120 93 94 123Z','#6a5060'))
        out.append(C(129,226,8,'#b88f61','#efddb3',2))
        out.append(C(129,226,3,'#694657'))
    elif variant==3: # Desmond monocle / beard
        out.append(C(148,148,14,'none','#cdb17d',3))
        out.append(L('M160 159 Q172 178 174 195','#bda574',2))
        out.append(P('M115 178 Q130 204 148 178 Q137 198 125 193Z','#382935'))
        out.append(P('M100 105 Q113 78 130 85 Q153 84 162 105Z','#39333b'))
        out.append(C(88,227,5,'#d8bc88'))
    elif variant==4: # Imogen bonnet and quill on lapel
        out.append(P('M79 123 Q88 73 131 70 Q172 75 181 124 Q153 99 129 102 Q104 99 79 123Z','#283d41','#bfa77f',3))
        out.append(L('M91 123 Q88 141 97 171 M171 123 Q171 155 161 171','#d0aa79',2.5))
        out.append(P('M171 205 Q183 185 186 199 Q179 216 165 233Z','#b9bdad'))
    elif variant==5: # Hollis chef cap / moustache
        out.append(P('M98 104 Q91 85 109 80 Q115 63 128 78 Q148 63 156 78 Q176 79 163 105Z','#f0e6d3','#aa9e8a',2))
        out.append(R(100,104,61,15,2,'#ece0c9','#9a886d',2))
        out.append(P('M109 168 Q119 161 129 169 Q140 161 149 168 Q138 182 129 174 Q120 182 109 168Z','#4b3736'))
        out.append(P('M111 207 L146 207 L132 227 Z','#e7cfb6'))
    return ''.join(out)

def method(id):
    line='#dcb779';dark='#19222a';brass='#cca86d'
    if id=='cocoa':
        return (E(130,241,73,14,'#121923',line,3)+R(71,135,115,97,14,'#312d34',brass,5)+
                E(128,137,61,18,'#ead1a1',line,3)+E(128,137,51,12,'#4d2c2b')+
                L('M186 158 Q232 156 222 190 Q215 212 188 204',brass,8)+
                L('M106 126 Q96 113 106 98 M140 124 Q131 103 147 93', '#d3c5a5',3)+
                P('M122 167 L135 155 L150 166 L136 186 Z','#8d443c',brass,2)+C(134,170,4,'#f3d4a0'))
    if id=='soup':
        return (E(130,226,82,22,'#131d1f',brass,4)+P('M55 173 Q64 231 95 239 Q132 249 164 239 Q200 228 205 173Z','#5e6960',brass,4)+
                E(130,173,76,27,'#d8b989',brass,3)+E(130,173,67,18,'#746a4d')+
                P('M91 171 Q80 150 92 136 Q103 128 116 147 Q125 156 114 170Z','#9a9b77','#e4d8ad',2)+
                P('M126 172 Q118 152 132 145 Q145 140 153 157 L150 177Z','#c2bd8a','#e5dabb',2)+
                L('M75 148 L178 126',brass,7)+C(179,126,5,'#e4d09e')+
                L('M98 120 Q92 109 103 98 M142 114 Q133 103 144 89','#e0d9c9',2))
    if id=='shears':
        return (E(88,218,28,28,'none',brass,10)+E(161,215,28,28,'none',brass,10)+
                L('M103 196 L161 106 L182 83', '#c5d0c8',14)+L('M148 196 L104 107 L85 86','#879f95',14)+
                L('M102 201 L169 103','#e9e8dc',3)+L('M143 199 L102 105','#e9e8dc',3)+
                C(127,178,8,'#bc9b68','#1b2728',2)+L('M190 99 L204 84','#f0d3a2',2))
    if id=='foil':
        return (P('M92 241 L175 85 L184 65 L179 100 L100 245Z','#c5d0d0','#d9bc81',2)+
                L('M96 234 L186 70','#fff1d6',3)+E(86,219,36,22,'none',brass,5)+
                L('M63 201 L116 247',brass,6)+L('M74 228 L48 259', '#523c32',11)+
                C(49,262,8,'#b99c6b')+P('M174 77 L186 50 L187 73Z','#e7d7a3'))
    if id=='wasps':
        out=R(82,115,96,125,26,'#70838a66','#e5caa0',6)+R(96,103,68,17,4,'#be9a6e','#e5c99a',3)+R(99,89,62,12,2,'#4d4038',brass,3)
        out+=E(130,173,39,36,'#c7a16d44')
        for x,y,s in [(113,156,1),(144,190,.88),(142,150,.7),(113,201,.65)]:
            out+=E(x,y,12*s,7*s,'#d9b76e','#2c3337',2)+R(x-4*s,y-6*s,4*s,12*s,1,'#332c2a')+R(x+2*s,y-6*s,4*s,12*s,1,'#332c2a')+E(x-8*s,y-10*s,13*s,8*s,'#d8e0e4aa')+C(x+13*s,y,4*s,'#282a2a')
        return out
    if id=='clock':
        out=R(84,77,92,173,17,'#4f332f',brass,7)+P('M84 101 L92 66 L167 66 L176 101Z','#634839','#d6ae71',4)
        out+=C(130,131,39,'#e6d1a6','#9f774c',5)+C(130,131,31,'#f4e5c6','#d6b681',2)
        for k in range(12):
            a=k*math.tau/12-math.pi/2
            out+=C(round(130+25*math.cos(a),1),round(131+25*math.sin(a),1),1.7,'#483126')
        out+=L('M130 131 L130 110 M130 131 L144 137','#3b292b',4)+C(130,131,4,'#946c4b')
        out+=R(100,174,60,57,11,'#1b2424',brass,2)+L('M130 180 L130 212','#d8c29a',3)+C(130,212,11,'#b99c71','#e1c58d',2)
        return out
    raise KeyError(id)

def room(id):
    brass='#c2a476'; dark='#20232e'; silver='#9bafad'
    if id=='greenhouse':
        out=P('M47 236 L47 133 L130 74 L213 133 L213 236Z','#374d48',brass,5)
        out+=P('M60 225 L60 141 L130 90 L200 141 L200 225Z','#85ac9b55','#e1c9a0',2)
        out+=L('M130 77 L130 231 M47 135 L213 135 M84 111 L84 233 M176 112 L176 233',brass,3)
        out+=R(118,153,24,84,2,'#182b2b','#cbb180',2)
        for x,y in [(73,185),(180,191),(96,221),(162,220)]:
            out+=P(f'M{x} {y+19} Q{x-19} {y-8} {x-3} {y-18} Q{x+10} {y-10} {x} {y+19}Z','#557760','#a7bc89',2)
        return out
    if id=='cellar':
        out=P('M43 239 L43 131 Q130 36 217 131 L217 239Z','#443b39','#bca07d',5)
        out+=P('M56 237 L56 133 Q130 57 204 133 L204 237Z','#303439','#a68c6a',3)
        for x in [83,131,179]:
            out+=E(x,193,24,41,'#4b2e29',brass,3)+R(x-22,178,44,10,2,'#a77a55')+R(x-22,210,44,10,2,'#a77a55')
            out+=C(x,193,5,'#b2a181')
        out+=L('M62 144 L199 144 M50 164 L209 164','#b6a088',2)
        return out
    if id=='attic':
        out=(P('M43 145 L130 65 L217 145 L217 241 L43 241Z','#393238',brass,5)+
            P('M59 145 L130 82 L200 145Z','#222a32','#c5a678',3)+L('M130 87 L130 239 M58 151 L202 151',brass,3))
        out+=R(81,178,95,59,6,'#6e523f',brass,4)+R(80,168,97,16,4,'#a17853','#e5c28d',2)
        out+=C(127,200,12,'#bc9b62','#382c2a',3)+L('M127 195 L127 211','#3a2b2b',3)
        for x,y in [(69,114),(186,121),(191,94)]:out+=C(x,y,2,'#a5a8a7')
        out+=L('M76 141 Q100 110 113 132','#bdc6cb',2)
        return out
    if id=='boathouse':
        out=P('M38 228 L38 119 L130 77 L222 119 L222 228Z','#403c3d',brass,5)+P('M55 223 L55 135 L130 98 L205 135 L205 223Z','#364350','#a6b8b7',2)
        out+=L('M130 91 L130 225 M58 142 L204 142',brass,3)
        out+=P('M61 217 Q130 254 198 217 L180 236 Q128 254 79 237Z','#7f603e','#dfc08d',3)
        out+=L('M88 213 L100 193 L164 193 L175 213','#b8a181',4)+P('M111 211 L126 180 L142 211','#886f4a')
        for y in [243,256]:out+=L(f'M50 {y} Q75 {y-8} 95 {y} T140 {y} T209 {y}','#789ca8',2)
        return out
    if id=='music':
        out=R(64,105,140,104,7,'#28232d',brass,5)+P('M66 111 Q133 79 191 119 L191 172 L72 172Z','#191923','#e2b982',3)
        out+=R(71,162,121,24,3,'#e0cfab','#d0b188',3)
        for x in range(77,190,14):out+=R(x,163,4,22,0,'#1c1b25')
        out+=L('M90 190 L81 240 M177 190 L190 240','#bb9a6f',7)
        out+=(P('M102 120 L102 76 Q121 51 136 72 Q145 85 140 100','#cbb18a','none',2)+
             C(153,87,8,'#bf9872'))
        return out
    if id=='gallery':
        out=(R(71,75,118,171,8,'#3e2f2f','#d7b27b',10)+R(81,85,98,149,4,'#aa9477','#6a4b38',4)+
            R(91,95,78,129,0,'#344052','#c9a77f',2))
        out+=C(130,143,23,'#b59982')+P('M106 143 Q111 107 128 114 Q149 110 153 143 L147 138 Q125 128 112 144Z','#342932')
        out+=P('M95 198 Q106 164 130 169 Q154 165 166 198Z','#393a45','#b7a07a',2)
        for x,y in [(76,81),(184,81),(76,241),(184,241)]:out+=C(x,y,5,'#edcd91','#70533e',1.3)
        out+=L('M113 248 L147 248','#d2b987',4)
        return out
    raise KeyError(id)

def svg(k,id,number):
    p=PAL[k];ink=p['ink'];border=p['border'];light=p['light'];accent=p['accent'];dark=p['shadow']
    if k=='s': image=family(130, 'woman' if number in (0,2,4) else 'man', number)
    elif k=='m':image=method(id)
    else:image=room(id)
    # Gold filigree and gothic apse framing engraved into every card. No embedded scripts/fonts/external resources.
    extra=''
    for x in (47,213):
        extra+=L(f'M{x} 68 Q{x-19 if x==47 else x+19} 82 {x} 101','#ccac76',2)
    jewels=C(130,47,6,'#9b4d57','#eed2a0',2)+C(130,47,2,'#f6dbbb')
    for a in range(6):
        x=57+a*29
        jewels+=C(x,264,1.8,'#d0b17c')
    shell=f'''<svg xmlns="http://www.w3.org/2000/svg" width="260" height="340" viewBox="0 0 260 340" role="img" aria-label="Gothic illustration of {escape(id)}">
<defs>
 <linearGradient id="vellum" x1="0" y1="0" x2=".85" y2="1"><stop stop-color="#1c1a22"/><stop offset=".49" stop-color="{p['bg']}"/><stop offset="1" stop-color="#131a22"/></linearGradient>
 <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1c7"/><stop offset=".25" stop-color="#bd8f51"/><stop offset=".65" stop-color="#f1d19b"/><stop offset="1" stop-color="#927048"/></linearGradient>
 <radialGradient id="moon" cx="50%" cy="38%" r="65%"><stop stop-color="{p['highlight']}" stop-opacity=".38"/><stop offset=".66" stop-color="{p['bg']}" stop-opacity=".06"/><stop offset="1" stop-color="#101522" stop-opacity=".7"/></radialGradient>
 <pattern id="etch" width="21" height="21" patternUnits="userSpaceOnUse"><path d="M0 21L21 0 M-6 6L6 -6 M15 27L27 15" fill="none" stroke="{p['highlight']}" stroke-opacity=".08" stroke-width="1"/></pattern>
 <clipPath id="window"><path d="M27 291 V98 Q28 49 130 18 Q232 49 233 98 V291Z"/></clipPath>
 <filter id="shadow"><feGaussianBlur stdDeviation="5"/></filter>
</defs>
<rect width="260" height="340" rx="15" fill="#0d1218"/>
<path d="M12 329V94 Q12 36 130 8 Q248 36 248 94 V329Z" fill="url(#metal)" stroke="#2a1b1e" stroke-width="3"/>
<path d="M21 319V95 Q21 46 130 17 Q239 46 239 95 V319Z" fill="{dark}" stroke="#6a4637" stroke-width="3"/>
<path d="M27 291 V98 Q28 49 130 18 Q232 49 233 98 V291Z" fill="url(#vellum)" stroke="#deba87" stroke-width="2.4"/>
<g clip-path="url(#window)"><rect x="25" y="19" width="210" height="275" fill="url(#moon)"/><rect x="25" y="19" width="210" height="275" fill="url(#etch)"/>
<path d="M38 272 L38 112 Q45 74 130 41 Q216 74 223 112 L223 272" fill="none" stroke="#e3c18e" stroke-opacity=".26" stroke-width="2"/>
<circle cx="130" cy="170" r="95" fill="#e9d2b0" fill-opacity=".10" stroke="#f1d6a0" stroke-opacity=".28" stroke-width="1.2"/>
<g id="art">{image}</g>
</g>
<path d="M22 290 H238 V328 H22Z" fill="#111a20" stroke="#d0ad76" stroke-width="2.2"/>
<path d="M27 303 H233" stroke="#ae8756" stroke-width="1" opacity=".8"/>
<path d="M32 310 Q68 303 90 310 T158 310 T228 310" fill="none" stroke="#b99a68" opacity=".55" stroke-width="1.5"/>
<path d="M40 45 Q66 46 81 71 M220 45 Q194 46 179 71" fill="none" stroke="#e5c18e" stroke-width="3"/>
<path d="M44 40 L70 40 L56 61 Z M216 40 L190 40 L204 61 Z" fill="#b99767"/>
<path d="M41 277 Q58 256 75 276 M219 277 Q202 256 185 276" fill="none" stroke="#bba16e" stroke-width="3"/>
{extra}{jewels}
<text x="130" y="324" text-anchor="middle" font-family="serif" font-size="11" fill="#e9c895" letter-spacing="2.3">HOLLOWMERE</text>
</svg>'''
    return shell

GROUPS={'s':['philippa','rupert','beatrice','desmond','imogen','hollis'],
        'm':['cocoa','soup','shears','foil','wasps','clock'],
        'r':['greenhouse','cellar','attic','boathouse','music','gallery']}
for k,items in GROUPS.items():
 for i,id in enumerate(items):
    (OUT/f'{id}.svg').write_text(svg(k,id,i),encoding='utf-8')
print(f'Generated {len(list(OUT.glob("*.svg")))} Gothic illustrations in {OUT}')
