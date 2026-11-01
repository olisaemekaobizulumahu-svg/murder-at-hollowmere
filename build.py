#!/usr/bin/env python3
"""Assembles public/index.html and public/app.js from src/. Run after editing anything in src/."""
import os
here=os.path.dirname(os.path.abspath(__file__))
rd=lambda p:open(os.path.join(here,'src',p),encoding='utf-8').read()
css=rd('style.css')+rd('extra.css')
head='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Murder at Hollowmere</title>
<meta name="description" content="A family murder mystery you play together from any phone or computer. Work out who, how and where in a 3D manor.">
<meta name="theme-color" content="#3a2a45">
<meta property="og:title" content="Murder at Hollowmere">
<meta property="og:description" content="A family murder mystery you play together from any phone or computer. No accounts needed.">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%233a2a45'/%3E%3Cpath d='M14 22h36v24H14z' fill='%23fbf6ea'/%3E%3Cpath d='M14 22l18 14 18-14' fill='none' stroke='%239b2330' stroke-width='3'/%3E%3Ccircle cx='32' cy='36' r='6' fill='%239b2330'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=Courier+Prime:wght@400;700&family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&display=swap">
<style>
'''
html=head+css+'</style>\n</head>\n<body>\n'+rd('body.html')+'<script src="rules.js"></script>\n<script src="cases.js"></script>\n<script src="app.js"></script>\n</body>\n</html>\n'
js=rd('app_top.js')+'\n'+rd('stage.js')+'\n'+rd('platform.js')+'\n'+rd('app_bottom.js')
open(os.path.join(here,'public','index.html'),'w',encoding='utf-8').write(html)
open(os.path.join(here,'public','app.js'),'w',encoding='utf-8').write(js)
print('index.html',len(html),'app.js',len(js))
