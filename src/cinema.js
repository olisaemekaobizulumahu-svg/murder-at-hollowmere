/* Hollowmere cinematic director — original, deterministic animated 2D storytelling.
   All illustration is drawn at runtime; no remote videos or dependencies are required.
   Intentionally keeps the solution secret: atmosphere is NOT evidence. */
(function(root){"use strict";
 const W=1600,H=900, PI=Math.PI,TAU=PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 function rng(n){let x=Math.sin(n*17.771+49.81)*43758.5453;return x-Math.floor(x);}
 function poly(ctx,points,color){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);ctx.closePath();ctx.fill();}
 function round(ctx,x,y,w,h,r,fill,stroke,lw=1){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
 function line(ctx,x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
 function circle(ctx,x,y,r,color){ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=color;ctx.fill();}
 function gradient(ctx,x1,y1,x2,y2,stops){const g=ctx.createLinearGradient(x1,y1,x2,y2);for(const [p,c]of stops)g.addColorStop(p,c);return g;}
 function radial(ctx,x,y,r,stops){const g=ctx.createRadialGradient(x,y,0,x,y,r);for(const [p,c]of stops)g.addColorStop(p,c);return g;}
 function glow(ctx,x,y,r,col){ctx.save();ctx.globalCompositeOperation="screen";circle(ctx,x,y,r,radial(ctx,x,y,r,[[0,col],[1,"#00000000"]]));ctx.restore();}
 function backdrop(ctx,t,theme){
  const colors=theme==="train"?["#13172a","#26304c","#080e1c"]:theme==="ball"?["#161023","#51304b","#170f21"]:theme==="island"?["#0c1926","#234254","#06101b"]:["#0a1022","#293954","#0a121f"];
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,colors[0]],[.5,colors[1]],[1,colors[2]]]);ctx.fillRect(0,0,W,H);
  for(let i=0;i<95;i++){let x=rng(i+101)*W,y=rng(i+201)*510;circle(ctx,x,y,rng(i+301)*1.4+.3,`rgba(255,235,199,${.12+rng(i+401)*.5})`);}
  const mx=1240+Math.sin(t*.08)*9,my=160,moon=ctx.createRadialGradient(mx,my,9,mx,my,108);moon.addColorStop(0,"#ffefd4");moon.addColorStop(.75,"#dbcab4");moon.addColorStop(1,"#b4b6c000");ctx.fillStyle=moon;ctx.beginPath();ctx.arc(mx,my,108,0,TAU);ctx.fill();glow(ctx,mx,my,340,"#cdd7ff27");
  for(let j=0;j<5;j++){let y=570+j*46;poly(ctx,[[0,y+100],[170,y-50],[380,y+40],[690,y-130],[950,y+25],[1230,y-65],[1600,y+50],[1600,H],[0,H]],`rgba(8,14,27,${.06+j*.12})`);}
 }
 function rain(ctx,t,strength=1){ctx.save();ctx.strokeStyle=`rgba(202,218,243,${.23*strength})`;ctx.lineWidth=1.6;for(let i=0;i<155;i++){const x=(rng(i+999)*W+(t*100+i*2))%W,y=(rng(i+1222)*H+(t*460+i*17))%H;line(ctx,x,y,x-14,y+38,`rgba(214,222,237,${(.07+rng(i+1542)*.24)*strength})`,1.5);}ctx.restore();}
 function mist(ctx,t){for(let i=0;i<6;i++){ctx.save();ctx.globalAlpha=.16+i*.018;const x=250+i*240+Math.sin(t*.22+i)*45,y=740+i*18;ctx.fillStyle=radial(ctx,x,y,240,[[0,"#b8c8d266"],[1,"#e3e4ee00"]]);ctx.beginPath();ctx.ellipse(x,y,400,116,0,0,TAU);ctx.fill();ctx.restore();}}
 function bolt(ctx,x,y,t){ctx.save();ctx.shadowColor="#d9e7ff";ctx.shadowBlur=45;let xx=x,yy=0;ctx.beginPath();ctx.moveTo(xx,yy);for(let i=0;i<9;i++){xx+=(-1+2*rng(50+i))*56;yy+=50+rng(80+i)*55;ctx.lineTo(xx,yy);}ctx.strokeStyle="#e8efff";ctx.lineWidth=7;ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=2;ctx.strokeStyle="#fff";ctx.stroke();ctx.restore();}
 function manor(ctx,t){
  backdrop(ctx,t,"manor");
  const z=1.05+Math.min(t/8,1)*.11;ctx.save();ctx.translate(W/2,540);ctx.scale(z,z);ctx.translate(-W/2,-540);
  const ground=gradient(ctx,0,650,0,900,[[0,"#17212a"],[1,"#05080f"]]);ctx.fillStyle=ground;ctx.fillRect(0,690,W,210);
  poly(ctx,[[270,720],[320,320],[500,310],[580,240],[690,320],[985,320],[1060,220],[1145,320],[1300,315],[1360,720]],"#121523");
  round(ctx,330,348,962,365,4,gradient(ctx,340,330,1270,800,[[0,"#252c39"],[.5,"#161923"],[1,"#0b0d19"]]),"#7e705644",3);
  poly(ctx,[[286,350],[460,245],[1050,260],[1296,350]],"#101522");poly(ctx,[[515,340],[610,210],[714,340]],"#171c2c");
  poly(ctx,[[1020,344],[1085,175],[1150,344]],"#111522");round(ctx,1050,296,72,414,0,"#202332","#97744955");
  for(let i=0;i<7;i++){const x=395+i*120;for(let row=0;row<2;row++){const y=402+row*124;const flick=.76+.16*Math.sin(t*1.5+i+row*3);round(ctx,x,y,53,80,24,`rgba(220,158,85,${flick})`,"#9a805b",3);line(ctx,x+27,y,x+27,y+80,"#231a1d",5);line(ctx,x,y+42,x+53,y+42,"#231a1d",5);glow(ctx,x+26,y+42,73,"#ffd28e18");}}
  round(ctx,760,520,100,198,50,"#090c18","#a88352",6);line(ctx,810,545,810,700,"#9d7243",4);circle(ctx,843,635,5,"#d1ad63");
  for(let i=0;i<10;i++){let y=710+i*14;line(ctx,700-i*6,y,912+i*6,y,"#d2b47c22",2);}
  for(let i=0;i<9;i++){const x=290+i*132;line(ctx,x,350,x,700,"#c7a57822",3);}
  ctx.restore();
  // A horse-drawn carriage glides into the foreground; it never discloses suspect identity.
  const x=-430+Math.min(t/8,1)*1020,y=735+Math.sin(t*8)*2;
  ctx.save();ctx.translate(x,y);ctx.fillStyle="#07080e";
  for(let i=0;i<2;i++){circle(ctx,95+i*185,40,55,"#080a12");circle(ctx,95+i*185,40,43,"#45352a");circle(ctx,95+i*185,40,33,"#0b0c13");for(let j=0;j<8;j++)line(ctx,95+i*185,40,95+i*185+Math.cos(j*PI/4)*35,40+Math.sin(j*PI/4)*35,"#887151",3);}
  round(ctx,40,-140,325,140,30,"#1a161e","#94714c",5);poly(ctx,[[30,-145],[140,-206],[282,-206],[375,-145]],"#0b0e19");round(ctx,155,-130,96,94,5,"#c39a6040","#876b4d",4);line(ctx,204,-130,204,-36,"#98704a",3);line(ctx,365,-42,500,-40,"#a98a66",4);
  // horse silhouette
  ctx.fillStyle="#080a10";ctx.beginPath();ctx.ellipse(555,-34,80,40,0,0,TAU);ctx.fill();poly(ctx,[[595,-60],[629,-100],[654,-103],[640,-36]],"#090b11");circle(ctx,648,-107,25,"#080a10");for(const leg of [510,555,592,621])line(ctx,leg,-20,leg-6,66,"#07080c",12);
  ctx.restore();
  rain(ctx,t,1);mist(ctx,t);
  const flash=(t%9.3>5.78&&t%9.3<5.97)?1:0;if(flash){ctx.fillStyle="#d2def73a";ctx.fillRect(0,0,W,H);bolt(ctx,1150,0,t);}
 }
 function tablePerson(ctx,x,y,scale,color,phase,hat=false){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.fillStyle=color;
  // deliberate body motion and gestures
  let sway=Math.sin(phase)*5;poly(ctx,[[-34,0],[32,0],[50,116],[-53,116]],color);circle(ctx,sway,-34,31,"#25202b");ctx.fillStyle="#b49a7d";ctx.beginPath();ctx.ellipse(sway,-33,19,26,0,0,TAU);ctx.fill();if(hat){poly(ctx,[[-35,-51],[36,-51],[22,-91],[-24,-91]],"#0c0d14");}
  line(ctx,-29,22,-62+Math.sin(phase)*17,95,color,20);line(ctx,29,22,67+Math.cos(phase)*15,89,color,20);ctx.restore();}
 function parlor(ctx,t,theme){
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,"#16111e"],[.62,"#432b37"],[1,"#110d17"]]);ctx.fillRect(0,0,W,H);
  // tall-panelled walls and gothic leaded windows
  for(let i=0;i<9;i++){let x=60+i*182;round(ctx,x,120,146,575,3,"#392834","#a5805b77",9);line(ctx,x+18,140,x+18,679,"#946f5533",4);}
  for(let i=0;i<3;i++){const x=220+i*460;round(ctx,x,180,165,358,82,"#0b1424","#97764d",12);round(ctx,x+17,200,131,310,68,gradient(ctx,0,200,0,500,[[0,"#56627e"],[1,"#0e1426"]]),"#aaa4a055",3);line(ctx,x+83,190,x+83,515,"#c5b58e",7);line(ctx,x+22,356,x+148,356,"#bca77d",7);glow(ctx,x+80,280,180,"#8399b72a");}
  poly(ctx,[[0,715],[1600,715],[1600,900],[0,900]],"#160e14");for(let i=0;i<23;i++)line(ctx,i*74,720,780+(i-10)*120,900,"#c08b5930",2);
  round(ctx,520,565,590,218,100,gradient(ctx,500,560,1100,800,[[0,"#51332a"],[.5,"#3b211e"],[1,"#1d1115"]]),"#ac8350",10);
  for(let i=0;i<5;i++){let x=590+i*106;tablePerson(ctx,x,530,.68,i%2?"#312334":"#261d2c",t*1.6+i*1.3,i===2);}
  // Ambrose stands at the end of the table reading the will
  tablePerson(ctx,820,397,.94,"#171823",t*.8+2,true);
  // rustling document lifted, lowered
  ctx.save();ctx.translate(820,525-10*Math.sin(t*1.2));ctx.rotate(.03*Math.sin(t));poly(ctx,[[-54,-49],[58,-52],[48,15],[-59,23]],"#cbb991");for(let k=0;k<6;k++)line(ctx,-40,-32+k*9,34,-33+k*9,"#84694c",2);ctx.restore();
  // chandelier drifts slightly
  ctx.save();ctx.translate(800+Math.sin(t*.38)*4,0);line(ctx,0,0,0,178,"#c2a26c",7);poly(ctx,[[-115,181],[116,181],[77,238],[-74,238]],"#b88b4e");for(let i=-2;i<=2;i++){let x=i*49;line(ctx,x,210,x,251,"#c7a66a",6);glow(ctx,x,251,56,"#efaf582d");circle(ctx,x,252+Math.sin(t*2+i)*2,9,"#ffe5a1");}ctx.restore();
  // right candle, and light fades sharply for later part
  glow(ctx,1330,600,170,"#f6af4d33");round(ctx,1320,563,20,85,5,"#ead2aa");circle(ctx,1330,555+Math.sin(t*4)*4,12,"#ffc76b");
  if(t>5.4){let fade=ease((t-5.4)/1.9);ctx.fillStyle=`rgba(4,5,12,${fade*.85})`;ctx.fillRect(0,0,W,H);if(t>6.8&&t<7.1){ctx.fillStyle="#b1c3e533";ctx.fillRect(0,0,W,H);}}
  rain(ctx,t,.25);
 }
 function clock(ctx,t){
  ctx.fillStyle=gradient(ctx,0,0,W,H,[[0,"#1a1520"],[.55,"#392931"],[1,"#090c18"]]);ctx.fillRect(0,0,W,H);
  for(let i=0;i<16;i++){let x=i*120;line(ctx,x,0,x,H,"#b18a5630",5);}
  glow(ctx,835,435,550,"#b48e5230");
  ctx.save();ctx.translate(835,432);let zoom=1+.23*ease(t/7);ctx.scale(zoom,zoom);
  circle(ctx,0,0,312,"#151019");circle(ctx,0,0,299,"#9e713d");circle(ctx,0,0,282,"#2d2024");circle(ctx,0,0,266,radial(ctx,0,0,275,[[0,"#d7c29c"],[.8,"#a28c71"],[1,"#64503f"]]));circle(ctx,0,0,231,"#e6d5b330");
  ctx.fillStyle="#433124";ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="bold 47px Georgia";
  const numerals=["XII","I","II","III","IV","V","VI","VII","VIII","IX","X","XI"];
  for(let i=0;i<12;i++){let a=i*TAU/12-PI/2;ctx.fillText(numerals[i],Math.cos(a)*212,Math.sin(a)*212);}
  for(let i=0;i<60;i++){let a=i*TAU/60-PI/2;line(ctx,Math.cos(a)*241,Math.sin(a)*241,Math.cos(a)*(i%5===0?256:249),Math.sin(a)*(i%5===0?256:249),"#5a4432",i%5===0?3:1.4);}
  // From nearly midnight, minute hand sweeps and visibly stops at 11:47.
  const moving=ease(Math.min(t/4.6,1)); const minAngle=(45+moving*2)*TAU/60; const hourAngle=(11+47/60)*TAU/12;
  ctx.save();ctx.rotate(hourAngle);poly(ctx,[[-8,15],[8,15],[7,-140],[0,-195],[-7,-140]],"#201a20");ctx.restore();
  ctx.save();ctx.rotate(minAngle);poly(ctx,[[-5,22],[5,22],[4,-182],[0,-234],[-4,-182]],"#21191b");ctx.restore();circle(ctx,0,0,18,"#947048");circle(ctx,0,0,8,"#2f2420");ctx.restore();
  if(t>4.6){const a=ease(Math.min((t-4.6)/1.4,1));ctx.fillStyle=`rgba(5,6,13,${a*.78})`;ctx.fillRect(0,0,W,H);ctx.fillStyle=`rgba(246,210,159,${a})`;ctx.textAlign="center";ctx.font="bold 78px Georgia";ctx.fillText("11 : 47",835,765);}
  if(t>5.3&&t<5.55){ctx.fillStyle="#dee6ff45";ctx.fillRect(0,0,W,H);bolt(ctx,1210,0,t);}
 }
 function corridor(ctx,t){
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,"#15121d"],[.5,"#32212a"],[1,"#080a11"]]);ctx.fillRect(0,0,W,H);
  for(let i=0;i<6;i++){const inset=i*125;ctx.strokeStyle=`rgba(183,140,95,${.36-i*.04})`;ctx.lineWidth=12-i;ctx.strokeRect(inset,inset*.38,W-2*inset,H-inset*.46);}
  const floor=gradient(ctx,0,570,0,900,[[0,"#563c37"],[1,"#0b0a11"]]);poly(ctx,[[0,900],[650,530],[950,530],[1600,900]],floor);
  for(let i=1;i<8;i++){let d=i/8,y=530+Math.pow(d,1.8)*390;line(ctx,0,y,W,y,"#b48b6830",2);}
  // Murder-room door opens and a witness's lantern moves toward the discovery.
  round(ctx,610,70,390,600,170,"#110e16","#93734b",22);
  poly(ctx,[[650,110],[957,110],[957,625],[650,625]],"#060913");
  const opening=ease(clamp((t-1.3)/3.2,0,1));
  poly(ctx,[[650,112],[952-opening*184,112+opening*38],[952-opening*184,620-opening*19],[650,625]],"#302128");
  for(let i=0;i<4;i++)line(ctx,682,150+i*109,900-opening*165,150+i*109,"#b98a5b42",8);
  circle(ctx,927-opening*166,400,8,"#d0af6a");
  // shadow, still unidentified, falling across the door; no culprit implied.
  if(t>3){const alpha=clamp((t-3)/1.3,0,.85);ctx.globalAlpha=alpha;ctx.fillStyle="#090910";ctx.beginPath();ctx.ellipse(795,600,110,29,-.12,0,TAU);ctx.fill();poly(ctx,[[710,570],[789,560],[865,589],[900,610],[746,630]],"#12111a");ctx.globalAlpha=1;}
  // witness walks in with a lantern
  const walk=ease(t/6),x=1360-walk*500;ctx.save();ctx.translate(x,600);poly(ctx,[[-40,-100],[50,-102],[90,170],[-95,170]],"#0a0c15");circle(ctx,0,-150,45,"#11111a");line(ctx,-60,-75,-110,20,"#0c0d12",25);
  ctx.save();ctx.translate(-110,20);glow(ctx,0,0,250,"#f1b15a50");round(ctx,-20,-35,40,75,9,"#9c7246","#d3b477",3);circle(ctx,0,8,15,"#ffdf8c");ctx.restore();ctx.restore();
  mist(ctx,t*.4);if(t>6.1){ctx.fillStyle=`rgba(11,8,14,${ease((t-6.1)/1.5)*.7})`;ctx.fillRect(0,0,W,H);}
 }
 function evidence(ctx,t){
  ctx.fillStyle=gradient(ctx,0,0,W,H,[[0,"#111c29"],[.5,"#2b2934"],[1,"#090d17"]]);ctx.fillRect(0,0,W,H);
  // evidence desk in cinematic perspective
  poly(ctx,[[0,650],[1600,540],[1600,900],[0,900]],"#30221e");for(let i=0;i<12;i++){let y=570+i*37;line(ctx,0,y+70,W,y,"#93694b25",2);}
  // detective silhouette and hat approach; anonymous detective, not a named suspect.
  const x=160+ease(t/4)*210;
  ctx.save();ctx.translate(x,440);glow(ctx,40,180,360,"#5f90b22c");poly(ctx,[[-150,120],[90,120],[205,460],[-280,460]],"#0b101a");circle(ctx,-28,25,80,"#15151e");poly(ctx,[[-180,-27],[155,-27],[106,-58],[-138,-58]],"#090b13");poly(ctx,[[-95,-47],[98,-47],[65,-164],[-62,-164]],"#10111b");
  line(ctx,105,200,390,390,"#12131b",47);ctx.restore();
  // Leather folder opens, sealed case envelope and three cards fly out.
  ctx.save();ctx.translate(965,665);ctx.rotate(-.14);round(ctx,-250,-130,500,210,16,"#472d24","#ba9059",8);
  for(let i=0;i<5;i++)line(ctx,-200,-70+i*26,170,-85+i*26,"#ab835a80",3);
  ctx.save();ctx.translate(0,-30);let open=ease(clamp((t-1.2)/2.3,0,1));poly(ctx,[[-187,-45],[190,-45],[190+40*open,-160-120*open],[-170-90*open,-180-130*open]],"#b39264");line(ctx,-180,-44,190,-44,"#e9c996",5);
  circle(ctx,0,-22,30,"#8b2534");circle(ctx,0,-22,19,"#b7444c");ctx.restore();ctx.restore();
  const slots=[[-220,-135,-.25],[50,-210,.12],[275,-118,.26]];
  for(let i=0;i<3;i++){let grow=ease(clamp((t-2.8-i*.55)/2,0,1));if(!grow)continue;const [ox,oy,rot]=slots[i];ctx.save();ctx.translate(945+ox*grow,565+oy*grow);ctx.rotate(rot*grow);ctx.globalAlpha=grow;round(ctx,-76,-119,150,225,12,"#ddc9a1","#a07843",5);round(ctx,-65,-109,130,203,7,"#eaddc5","#86633c",2);ctx.fillStyle="#674c32";ctx.textAlign="center";ctx.font="bold 18px Georgia";ctx.fillText(["SUSPECT","METHOD","LOCATION"][i],0,-65);circle(ctx,0,4,38,"#9d805155");for(let j=0;j<3;j++)line(ctx,-35,58+j*17,35,58+j*17,"#765b42",2);ctx.restore();}
  ctx.save();ctx.globalAlpha=.15;ctx.fillStyle="#ffe8af";for(let i=0;i<50;i++){const x=rng(i+61)*W,y=(rng(i+97)*H+t*11)%H;circle(ctx,x,y,rng(i+19)*1.5+.5,"#ffdbac");}ctx.restore();
 }
 function train(ctx,t){backdrop(ctx,t,"train");const z=ease(t/9);ctx.save();ctx.translate(-25+60*z,0);round(ctx,-150,460,1900,270,13,"#121b29","#a0835866",5);for(let i=0;i<12;i++){let x=i*166-60;round(ctx,x,495,106,115,12,"#b17e4c","#99754d",6);round(ctx,x+9,505,88,96,8,"#292842");glow(ctx,x+53,555,67,"#e3a55c26");}for(let i=0;i<22;i++)circle(ctx,i*84,735,42,"#050811");ctx.restore();for(let i=0;i<22;i++){const x=i*95-(t*260)%95;line(ctx,x,775,x-70,900,"#a8b8d032",4);}mist(ctx,t);rain(ctx,t,.7);}
 function masquerade(ctx,t){parlor(ctx,t,"ball");ctx.fillStyle="#6e35461f";ctx.fillRect(0,0,W,H);for(let i=0;i<6;i++){const x=210+i*225,y=475+Math.sin(t+i)*15;ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(t*1.5+i)*.15);tablePerson(ctx,0,0,.7,i%2?"#5a2947":"#322941",t*1.5+i,true);ctx.restore();}for(let i=0;i<30;i++){const x=rng(i+900)*W+Math.sin(t+i)*20,y=(rng(i+500)*H+t*25)%H;circle(ctx,x,y,2,"#d9c09b55");}}
 function lighthouse(ctx,t){backdrop(ctx,t,"island");poly(ctx,[[0,680],[200,610],[370,660],[550,580],[800,650],[1050,600],[1420,690],[1600,665],[1600,900],[0,900]],"#111d23");ctx.fillStyle="#172533";poly(ctx,[[890,695],[960,220],[1085,220],[1140,695]],"#c2b69b");poly(ctx,[[955,220],[970,162],[1072,162],[1088,220]],"#101b2b");round(ctx,964,184,110,34,2,"#f8c97e");glow(ctx,1017,199,260,"#e9d8aa55");ctx.save();ctx.translate(1015,199);ctx.rotate(Math.sin(t*.7)*.85);poly(ctx,[[0,0],[660,-175],[660,175]],"#f4e6b51a");ctx.restore();for(let i=0;i<3;i++)round(ctx,985,315+i*120,50,70,25,"#f2cf8655");rain(ctx,t,1.2);mist(ctx,t);}
 /* Final act is a film, not the same illustrated slide reused at the end.
    Each shot uses moving subjects, staged light, camera travel and progressive reveals. */
 function finaleCouncil(ctx,t){
  parlor(ctx,Math.min(t,5),"manor");
  ctx.save();
  const dim=.30+.09*Math.sin(t*.9);ctx.fillStyle=`rgba(7,6,14,${dim})`;ctx.fillRect(0,0,W,H);
  // Push in on the sealed evidence across a long oak table.
  const shift=ease(t/9),cx=800+Math.sin(t*.28)*12,cy=690-shift*52;
  ctx.translate(cx,cy);ctx.scale(.9+shift*.17,.9+shift*.17);
  ctx.fillStyle=radial(ctx,0,0,510,[[0,"#f3d39d59"],[1,"#f3d39d00"]]);ctx.fillRect(-530,-490,1060,980);
  round(ctx,-305,-110,610,205,35,"#4b2d27","#ac8958",9);
  for(let i=0;i<6;i++)line(ctx,-260,-68+i*24,260,-84+i*24,"#d5ad7255",3);
  const open=ease(clamp((t-5)/3,0,1));
  ctx.save();ctx.rotate(-.11);round(ctx,-145,-84,294,153,12,"#c7b38b","#92683f",5);
  poly(ctx,[[-148,-82],[144,-84],[140+open*11,-142-open*110],[-138-open*14,-147-open*105]],"#dec397");
  circle(ctx,0,1,28,"#8e2a38");circle(ctx,0,1,16,"#b6464e");ctx.restore();ctx.restore();
  // Candle flames and faint smoke act as the only light in the verdict hall.
  for(let i=0;i<3;i++){const x=175+i*560,y=600+Math.sin(t*2+i)*4;
   glow(ctx,x,y,110,"#fbc98533");round(ctx,x-9,y,18,113,3,"#e0c29b");circle(ctx,x,y-5,12,"#ffc36b");}
 }
 function finaleRevelation(ctx,t,details){
  ctx.fillStyle=gradient(ctx,0,0,0,H,[[0,"#16121c"],[.65,"#261a1c"],[1,"#0c0d15"]]);ctx.fillRect(0,0,W,H);
  const x=800,y=525;ctx.fillStyle=radial(ctx,x,y,700,[[0,"#c3a16e50"],[1,"#00000000"]]);ctx.fillRect(0,0,W,H);
  // A circular carved table with a moving overhead pool of lamplight.
  ctx.save();ctx.translate(x,y+105);ctx.scale(1,.44);circle(ctx,0,0,680,"#4c3125");circle(ctx,0,0,650,"#9c754e");circle(ctx,0,0,620,"#3e281f");ctx.restore();
  const labels=["THE SUSPECT","THE METHOD","THE LOCATION"];
  const names=details?.solution||["SEALED","SEALED","SEALED"];
  // In portrait mode the original film would crop two of the three cards.
  // Stack all three inside the mobile camera's safe central field instead.
  if(details?.portrait){
   for(let i=0;i<3;i++){
    const reveal=ease(clamp((t-.7-i*1.4)/1.4,0,1));if(!reveal)continue;
    const turn=ease(clamp((t-2.8-i*1.25)/1.2,0,1)),centerY=203+i*215;
    ctx.save();ctx.globalAlpha=reveal;ctx.translate(800,centerY+55*(1-reveal));ctx.scale(Math.max(.05,Math.abs(Math.cos(turn*PI))),1);
    ctx.shadowColor="#000000b8";ctx.shadowBlur=15;ctx.shadowOffsetY=8;
    round(ctx,-190,-90,380,180,10,turn>.5?"#f0dfbf":"#815a42","#bb905d",6);
    ctx.shadowColor="transparent";round(ctx,-180,-80,360,160,6,turn>.5?"#e4d3b3":"#714b37","#af8d5e",2);
    ctx.textAlign="center";
    if(turn>.5){ctx.fillStyle="#755437";ctx.font="bold 19px Georgia";ctx.fillText(labels[i],0,-43);
     let title=String(names[i]||"Unknown");let font=title.length>19?22:title.length>13?27:35;
     ctx.font=`bold ${font}px Georgia`;ctx.fillStyle="#302021";
     const words=title.split(" "),rows=[];let part="";
     for(const word of words){let next=part?part+" "+word:word;if(ctx.measureText(next).width>315&&part){rows.push(part);part=word;}else part=next;}if(part)rows.push(part);
     rows.slice(0,3).forEach((str,k)=>ctx.fillText(str,0,13+(k-(rows.length-1)/2)*35));
    }else{circle(ctx,0,0,30,"#aa3545");}
    ctx.restore();
   }
   return;
  }
  for(let i=0;i<3;i++){
   const arrive=ease(clamp((t-.6-i*1.25)/1.6,0,1));if(!arrive)continue;
   let xx=355+i*445,yy=490-50*arrive,flip=ease(clamp((t-3.6-i*1.6)/1.4,0,1));
   const scaleX=Math.max(.045,Math.abs(Math.cos(flip*PI)));
   ctx.save();ctx.globalAlpha=arrive;ctx.translate(xx,yy+190*(1-arrive));ctx.scale(scaleX,1);
   ctx.shadowColor="#000000aa";ctx.shadowBlur=35;ctx.shadowOffsetY=18;
   round(ctx,-156,-213,312,428,19,flip>.5?"#eadbc2":"#b98c5b","#6f4a2b",10);ctx.shadowColor="transparent";
   round(ctx,-138,-191,276,382,11,flip>.5?"#eee2ca":"#714834","#c4a472",5);
   if(flip>.5){ctx.save();ctx.textAlign="center";
    ctx.font="bold 23px Georgia";ctx.fillStyle="#69492c";ctx.fillText(labels[i],0,-137);
    const name=String(names[i]||"Unknown").replace(/\s+/g," ");
    ctx.fillStyle="#3a2122";ctx.font=`bold ${name.length>22?24:name.length>15?29:39}px Georgia`;
    const parts=name.split(" "),rows=[],maxWidth=228;let row="";
    for(const word of parts){const attempt=row?row+" "+word:word;if(ctx.measureText(attempt).width>maxWidth&&row){rows.push(row);row=word;}else row=attempt;}if(row)rows.push(row);
    rows.slice(0,4).forEach((lineText,k)=>ctx.fillText(lineText,0,8+(k-(rows.length-1)/2)*45));
    ctx.font="bold 22px Georgia";ctx.fillStyle="#a17e52";ctx.fillText("HOLLOWMERE",0,150);ctx.restore();
   }else{ctx.strokeStyle="#d3ad77";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-105,-142);ctx.lineTo(105,143);ctx.moveTo(105,-142);ctx.lineTo(-105,143);ctx.stroke();circle(ctx,0,0,52,"#822c36");}
   ctx.restore();
  }
  for(let i=0;i<70;i++){const a=rng(i+710)*W,b=(rng(i+400)*H+t*17)%H;circle(ctx,a,b,.6+rng(i+152)*1.4,"#e6d4aa22");}
 }
 function finaleEpilogue(ctx,t,details){
  const success=!!details?.success;
  backdrop(ctx,t,"manor");
  // Dawn brightens after conviction; an unsolved case fades to blue-black.
  ctx.fillStyle=radial(ctx,1250,170,700,[[0,success?"#eebf7a70":"#7191b228"],[1,"#00000000"]]);ctx.fillRect(0,0,W,H);
  const z=1+ease(t/13)*.18;ctx.save();ctx.translate(800,500);ctx.scale(z,z);ctx.translate(-800,-500);
  poly(ctx,[[260,780],[330,290],[485,280],[610,210],[745,300],[1015,300],[1090,170],[1200,295],[1350,310],[1430,780]],"#0f1421");
  round(ctx,353,328,940,440,0,"#202335","#bc95644d",6);
  poly(ctx,[[275,332],[440,227],[1100,227],[1350,332]],"#101420");
  round(ctx,748,565,154,204,74,"#080d18","#ad875a",6);
  for(let i=0;i<6;i++){let x=443+i*145,y=423;round(ctx,x,y,55,110,25,success?"#d1a26c":"#55667a","#aa8555",4);glow(ctx,x+25,y+45,95,success?"#ffdd9e28":"#abc6ef0c");}
  ctx.restore();mist(ctx,t);if(!success)rain(ctx,t,.46);
  const portrait=details?.portraitImage;
  if(success&&portrait?.complete&&portrait.naturalWidth){
   const reveal=ease(clamp((t-2.5)/3,0,1));if(reveal){ctx.save();ctx.globalAlpha=reveal;const portraitMode=details?.portrait;
    const x=portraitMode?665:1128,y=portraitMode?190:248,w=portraitMode?270:235,h=portraitMode?340:294;
    round(ctx,x-13,y-13,w+26,h+26,16,"#a77d51","#e8cba0",8);
    ctx.drawImage(portrait,x,y,w,h);ctx.restore();}
  }
  // The verdict seal is struck over the closing frame.
  const appear=ease(clamp((t-5)/2.5,0,1));if(appear){ctx.save();ctx.globalAlpha=appear;ctx.translate(800,430);ctx.rotate((1-appear)*.38);ctx.scale(.5+.5*appear,.5+.5*appear);
    circle(ctx,0,0,134,success?"#aa7244":"#344765");circle(ctx,0,0,112,success?"#ad2636":"#26354a");
    ctx.strokeStyle="#d0a879";ctx.lineWidth=7;ctx.beginPath();ctx.arc(0,0,105,0,TAU);ctx.stroke();ctx.textAlign="center";ctx.fillStyle="#ffe8c2";
    ctx.font="bold 28px Georgia";ctx.fillText(success?"CASE CLOSED":"UNSOLVED",0,11);ctx.restore();}
 }
 function paint(ctx,theme,kind,t,details){
  ctx.save();ctx.clearRect(0,0,W,H);
  if(kind==="arrival"){
   if(theme==="train")train(ctx,t);else if(theme==="ball")masquerade(ctx,t);else if(theme==="island")lighthouse(ctx,t);else manor(ctx,t);
  }else if(kind==="gathering")parlor(ctx,t,theme);
  else if(kind==="clock")clock(ctx,t);
  else if(kind==="discovery")corridor(ctx,t);
  else if(kind==="evidence")evidence(ctx,t);
  else if(kind==="finalGathering")finaleCouncil(ctx,t);
  else if(kind==="finalReveal")finaleRevelation(ctx,t,details);
  else if(kind==="finalEpilogue")finaleEpilogue(ctx,t,details);
  else if(kind==="ending")evidence(ctx,t);
  else if(kind==="event")corridor(ctx,t);
  else if(kind==="portrait")evidence(ctx,t);
  else manor(ctx,t);
  // 2.39:1 film projection, grain, vignette, and rolling film-light artifacts.
  const vg=ctx.createRadialGradient(800,390,160,800,445,1040);vg.addColorStop(0,"#00000000");vg.addColorStop(1,"#000000bb");ctx.fillStyle=vg;ctx.fillRect(0,0,W,H);
  for(let i=0;i<90;i++){let x=rng(i*3+17+t*.01)*W,y=rng(i*5+29)*H;ctx.fillStyle="rgba(248,224,187,.04)";ctx.fillRect(x,y,1.3,1.3);}
  ctx.restore();
 }
 let audio=null;
 function sound(on){
  if(!on){if(audio){for(const o of audio.sources)try{o.stop()}catch(e){};audio.ctx.close().catch(()=>{});audio=null;}return false;}
  if(audio)return true;
  const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return false;
  try{
   const ctx=new Ctx(),master=ctx.createGain();master.gain.value=.14;master.connect(ctx.destination);
   const sources=[];
   for(const [f,volume] of [[73.42,.18],[110,.08],[146.83,.055]]){
    const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.value=f;gain.gain.value=volume;osc.connect(gain);gain.connect(master);osc.start();sources.push(osc);
   }
   const n=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),v=n.getChannelData(0);
   for(let i=0;i<v.length;i++)v[i]=2*rng(i+641)-1;
   const noise=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),g=ctx.createGain();noise.buffer=n;noise.loop=true;filter.type="lowpass";filter.frequency.value=360;g.gain.value=.12;noise.connect(filter);filter.connect(g);g.connect(master);noise.start();sources.push(noise);
   audio={ctx,sources};ctx.resume().catch(()=>{});return true;
  }catch(e){return false;}
 }
 let active=null;
 function stop(){if(!active)return;active.cancelled=true;if(active.frame)cancelAnimationFrame(active.frame);if(active.observer)active.observer.disconnect();active=null;}
 function mount(canvas,scene,theme,getElapsed,details){stop();if(!canvas)return;
  const ctx=canvas.getContext("2d",{alpha:false});if(!ctx)return;
  const obj={cancelled:false,frame:0,canvas,observer:null};active=obj;
  let portraitImage=null;
  if(details?.success&&/^[a-z]+$/.test(details.character||"")){
   portraitImage=new Image();portraitImage.src=`/assets/detectives/${details.character}.webp`;
  }
  function resize(){const w=canvas.clientWidth||innerWidth,h=canvas.clientHeight||innerHeight,dpr=Math.min(devicePixelRatio||1,1.7);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  resize();if(typeof ResizeObserver!=="undefined"){obj.observer=new ResizeObserver(resize);obj.observer.observe(canvas);}else window.addEventListener("resize",resize,{once:true});
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function frame(){if(obj.cancelled)return;const elapsed=reduced?3.5:getElapsed();const sx=canvas.width/W,sy=canvas.height/H,scale=Math.max(sx,sy);ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle="#05070b";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.setTransform(scale,0,0,scale,(canvas.width-W*scale)/2,(canvas.height-H*scale)/2);paint(ctx,theme,scene,Math.max(0,elapsed),{...details,portrait:canvas.height>canvas.width*1.1,portraitImage});obj.frame=requestAnimationFrame(frame);}
  frame();
 }
 const api={mount,stop,paint,sound};if(typeof module==="object"&&module.exports)module.exports=api;else root.HollowmereCinema=api;
})(typeof window!=="undefined"?window:globalThis);
