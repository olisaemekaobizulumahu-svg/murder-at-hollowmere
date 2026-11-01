/* ---------- the 3D manor board ----------
   Six rooms in a ring around the hall, where the sealed envelope lies on a table.
   Each question moves the named relative and method into the named room, the way
   the pieces travel on a mystery board. Purely visual: the game runs without it. */
const Stage=(()=>{
  const THREE_URL="three.min.js";
  const st={ok:false,dead:false,loading:false,host:null,g:null,code:null,key:null,tableKey:null,hadGame:false,
    pickMode:false,picks:{},know:null,focus:{mode:"overview"},t:0,lastDrag:-1e9,tip:"",tipUntil:0,visible:true,
    hover:null,revealKey:null,reveal:null,capHTML:null,tanH:.5,tanV:.32,
    seats:[],lastN:0,turnKey:null,qKey:null,qFly:null,boltAt:-99,nextBolt:4,flash:null,me:null,dec:{},
    follow:true,saver:false,seatHex:null,acc:0,idle:false,poke:0,lastTap:null};
  const poke=()=>{st.poke=performance.now();st.idle=false;};
  const AMB=()=>!REDUCED&&!st.saver;
  const api={onPick:null};
  let T,R,scene,camera,clock,ray,ndc,capEl,ro,io,camT,wantT,tmpA,tmpB,tmpC,right,GREY;
  const pieces={},rooms=[],pickables=[],redraws=[],faces={},labels=[];
  let envGroup,envMat,flapMat,flap,lamp,focusLight,dust,dustPos,waterMat,boat,revealCards=[];
  let hemi,moonL,conf,rain,rainPos;const figs=[],qCards=[],flyers=[],marks=[];
  const cam={az:.95,el:.9,dist:15},want={az:.95,el:.9,dist:15};
  const RIN=2.45,ROUT=6.25,FLOOR=.14,TAU=Math.PI*2,SEAT_R=7.25,TER_Y=-.3;
  const SEAT_HEX=[0xc0424f,0x2f86b3,0xc9971f,0x7a5bb5,0x3a9a68,0xc25a9f,0x4c78a8,0xd97736];
  const easeBack=x=>1+2.70158*Math.pow(x-1,3)+1.70158*Math.pow(x-1,2);
  const ang=i=>(i*60+30)*Math.PI/180;
  const roomIdx=id=>ROOMS.findIndex(r=>r.id===id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),c01=v=>clamp(v,0,1);
  const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const SUS_COL={philippa:0x8d4b98,rupert:0x3a4058,beatrice:0xd67fa0,desmond:0xd08f2c,imogen:0x2f938b,hollis:0xe9dfc8};
  const LOOK={greenhouse:[0x47684a,"tiles"],cellar:[0x52423e,"flags"],attic:[0x7d5939,"planks"],boathouse:[0x6e533a,"planks"],music:[0x6e2a3b,"carpet"],gallery:[0x4f3f5c,"parquet"]};
  const FELL='"IM Fell English SC","IM Fell English",Georgia,serif',SERIF='"IM Fell English",Georgia,serif',
        SANS='"Alegreya Sans","Gill Sans","Segoe UI",system-ui,sans-serif',EMOJI='"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

  function fail(){st.dead=true;st.ok=false;document.body.classList.add("no3d");}
  function load(){
    if(st.loading||st.ok||st.dead)return;st.loading=true;
    if(window.THREE){init();return;}
    const s=document.createElement("script");s.src=THREE_URL;s.async=true;
    s.onload=()=>init();s.onerror=()=>fail();
    (document.head||document.body).appendChild(s);
  }

  /* ---- drawing helpers ---- */
  function rr(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+W,Y,X+W,Y+H,r);x.arcTo(X+W,Y+H,X,Y+H,r);x.arcTo(X,Y+H,X,Y,r);x.arcTo(X,Y,X+W,Y,r);x.closePath();}
  function canvasTex(w,h,draw,repeat){
    const c=document.createElement("canvas");c.width=w;c.height=h;
    const tex=new T.CanvasTexture(c);
    if(repeat){tex.wrapS=tex.wrapT=T.RepeatWrapping;}
    tex.anisotropy=4;
    const run=()=>{const x=c.getContext("2d");x.clearRect(0,0,w,h);draw(x,w,h);tex.needsUpdate=true;};
    run();redraws.push(run);tex.__redraw=run;return tex;
  }
  function pattern(kind,base){
    return canvasTex(128,128,(x,w,h)=>{
      const c=new T.Color(base),hx=k=>"#"+c.clone().offsetHSL(0,0,k).getHexString();
      x.fillStyle=hx(0);x.fillRect(0,0,w,h);
      if(kind==="tiles"||kind==="parquet"||kind==="checker"){
        const n=4,s=w/n;
        for(let i=0;i<n;i++)for(let j=0;j<n;j++)if((i+j)%2){x.fillStyle=kind==="checker"?"#cdbfa8":hx(kind==="parquet"?.05:-.05);x.fillRect(i*s,j*s,s,s);}
        x.strokeStyle=hx(-.09);x.lineWidth=2;
        for(let i=0;i<=n;i++){x.beginPath();x.moveTo(i*s,0);x.lineTo(i*s,h);x.stroke();x.beginPath();x.moveTo(0,i*s);x.lineTo(w,i*s);x.stroke();}
      }else if(kind==="planks"){
        for(let i=0;i<8;i++){x.fillStyle=hx(((i*5)%3-1)*.03);x.fillRect(0,i*16,w,15);x.fillStyle=hx(-.12);x.fillRect(0,i*16+15,w,1);x.fillRect((i*41)%w,i*16,1.5,15);}
      }else if(kind==="flags"){
        x.fillStyle=hx(-.1);x.fillRect(0,0,w,h);
        for(let i=0;i<4;i++)for(let j=0;j<4;j++){x.fillStyle=hx(((i*7+j*3)%5-2)*.025);x.fillRect(i*32+1.5,j*32+1.5,29,29);}
      }else if(kind==="carpet"){
        x.strokeStyle=hx(.09);x.lineWidth=3;
        for(let i=-4;i<8;i++){x.beginPath();x.moveTo(i*32,0);x.lineTo(i*32+h,h);x.stroke();x.beginPath();x.moveTo(i*32+h,0);x.lineTo(i*32,h);x.stroke();}
      }
    },true);
  }
  function label(text,opts){
    const box={text,frac:.5};
    const tex=canvasTex(256,64,(x,w,h)=>{
      const text=box.text;if(!text)return;
      x.font=`700 32px ${SANS}`;const tw=Math.min(w-6,x.measureText(text).width+30);box.frac=tw/w;
      rr(x,(w-tw)/2,8,tw,h-16,(h-16)/2);x.fillStyle="rgba(18,12,23,.78)";x.fill();
      x.fillStyle=opts&&opts.gold?"#f0d59a":"#f6eef8";x.textAlign="center";x.textBaseline="middle";x.fillText(text,w/2,h/2+1);
    });
    const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false,sizeAttenuation:false}));
    s.scale.set(.2,.05,1);s.renderOrder=5;labels.push(s);s.userData.box=box;s.userData.pri=1;
    s.userData.setText=t=>{if(t!==box.text){box.text=t;tex.__redraw();}};
    return s;
  }
  function emojiTex(icon){
    return canvasTex(128,128,(x)=>{
      const g=x.createRadialGradient(56,52,8,64,64,64);g.addColorStop(0,"#fffaf0");g.addColorStop(1,"#eadcbc");
      x.fillStyle=g;x.beginPath();x.arc(64,64,63,0,TAU);x.fill();
      x.strokeStyle="#9a7330";x.lineWidth=5;x.beginPath();x.arc(64,64,56,0,TAU);x.stroke();
      x.font=`66px ${EMOJI}`;x.textAlign="center";x.textBaseline="middle";x.fillText(icon,64,70);
    });
  }
  function cardFace(id){
    if(faces[id])return faces[id];
    const c=CARD[id],col={s:"#8b2c3a",m:"#2b674b",r:"#2c4b7a"}[c.k];
    return faces[id]=canvasTex(256,356,(x,w,h)=>{
      x.fillStyle="#fbf6ea";x.fillRect(0,0,w,h);
      x.strokeStyle=col;x.lineWidth=4;rr(x,13,13,w-26,h-26,10);x.stroke();
      x.fillStyle=col;x.textAlign="center";x.textBaseline="alphabetic";x.font=`30px ${FELL}`;x.fillText({s:"who",m:"how",r:"where"}[c.k],w/2,58);
      x.font=`104px ${EMOJI}`;x.textBaseline="middle";x.fillText(c.icon,w/2,h/2-2);
      x.textBaseline="alphabetic";x.fillStyle="#2b2125";x.font=`33px ${SERIF}`;
      const words=c.name.split(" ");let lines=[c.name];
      if(x.measureText(c.name).width>w-44&&words.length>1){const k=Math.ceil(words.length/2);lines=[words.slice(0,k).join(" "),words.slice(k).join(" ")];}
      lines.forEach((l,i)=>x.fillText(l,w/2,h-(lines.length-i)*36+4));
    });
  }
  function drawBack(x,w,h){
    x.fillStyle="#3a2342";x.fillRect(0,0,w,h);
    x.strokeStyle="rgba(216,176,96,.35)";x.lineWidth=2;
    for(let i=-h;i<w+h;i+=22){x.beginPath();x.moveTo(i,0);x.lineTo(i+h,h);x.stroke();x.beginPath();x.moveTo(i+h,0);x.lineTo(i,h);x.stroke();}
    x.strokeStyle="#d8b060";x.lineWidth=4;x.strokeRect(11,11,w-22,h-22);
    const g=x.createRadialGradient(w*.45,h*.45,4,w/2,h/2,52);g.addColorStop(0,"#d0646c");g.addColorStop(.6,"#9b2330");g.addColorStop(1,"#5e131b");
    x.fillStyle=g;x.beginPath();x.arc(w/2,h/2,50,0,TAU);x.fill();
    x.fillStyle="#f6d9da";x.font=`58px ${SERIF}`;x.textAlign="center";x.textBaseline="middle";x.fillText("H",w/2,h/2+3);
  }

  /* ---- geometry helpers ---- */
  const polar=(r,a,y=0)=>new T.Vector3(r*Math.cos(a),y,r*Math.sin(a));
  function slab(r0,r1,a0,a1,depth,mat){
    const s=new T.Shape(),P=(r,a)=>[r*Math.cos(a),-r*Math.sin(a)],n=24;
    s.moveTo(...P(r1,a0));
    for(let k=1;k<=n;k++)s.lineTo(...P(r1,a0+(a1-a0)*k/n));
    for(let k=n;k>=0;k--)s.lineTo(...P(r0,a0+(a1-a0)*k/n));
    const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false});
    geo.rotateX(-Math.PI/2);
    const m=new T.Mesh(geo,mat);m.receiveShadow=true;return m;
  }
  const Mat=(c,o={})=>new T.MeshStandardMaterial({color:c,roughness:o.r!=null?o.r:.7,metalness:o.m||0,transparent:!!o.t,opacity:o.t||1,side:o.ds?T.DoubleSide:T.FrontSide});
  function add(geo,mat,pos,rot,parent,noShadow){
    const m=new T.Mesh(geo,mat);m.position.copy(pos);if(rot)m.rotation.set(rot[0],rot[1],rot[2]);
    m.castShadow=!noShadow;m.receiveShadow=true;parent.add(m);return m;
  }
  const V=(x,y,z)=>new T.Vector3(x,y,z);

  function props(id,a,grp){
    const P=(r,da,y)=>polar(r,a+da,y);
    if(id==="greenhouse"){
      const pot=Mat(0xa65b3c),leaf=Mat(0x4f8f4c),leaf2=Mat(0x6fa85a);
      [[5.25,-.36],[5.35,.34],[3.0,.42],[3.05,-.43]].forEach(([r,da],k)=>{
        add(new T.CylinderGeometry(.17,.12,.26,14),pot,P(r,da,FLOOR+.13),null,grp);
        if(k%2)add(new T.ConeGeometry(.2,.55,10),leaf2,P(r,da,FLOOR+.53),null,grp);
        else add(new T.SphereGeometry(.27,14,10),leaf,P(r,da,FLOOR+.43),null,grp);
      });
      add(new T.BoxGeometry(1.1,.4,.5),Mat(0xcdeee9,{r:.08,t:.32}),P(5.6,0,FLOOR+.2),[0,-a+Math.PI/2,0],grp,true);
      add(new T.BoxGeometry(1.12,.03,.52),Mat(0x6a5a3a),P(5.6,0,FLOOR+.41),[0,-a+Math.PI/2,0],grp);
    }else if(id==="cellar"){
      const oak=Mat(0x74492a),hoop=Mat(0x2b2b2b,{m:.6,r:.4});
      [[5.15,-.36],[5.15,.36]].forEach(([r,da])=>{
        const b=new T.Group();b.position.copy(P(r,da,FLOOR+.27));b.rotation.y=-(a+da);grp.add(b);
        add(new T.CylinderGeometry(.27,.27,.62,18),oak,V(0,0,0),[0,0,Math.PI/2],b);
        [-.2,.2].forEach(x=>add(new T.TorusGeometry(.275,.022,6,20),hoop,V(x,0,0),[0,Math.PI/2,0],b));
      });
      add(new T.BoxGeometry(1.05,.78,.28),Mat(0x3a2420),P(5.8,0,FLOOR+.39),[0,-a+Math.PI/2,0],grp);
      const glass=Mat(0x1f4a2c,{r:.2,m:.3});
      [-.13,-.045,.045,.13].forEach((da,k)=>[.22,.5].forEach((y,j)=>{if(!(k===2&&j===1))add(new T.SphereGeometry(.055,10,8),glass,P(5.64,da,FLOOR+y),null,grp,true);}));
      add(new T.CylinderGeometry(.06,.06,.3,10),glass,P(3.1,.42,FLOOR+.06),[Math.PI/2,0,.7],grp);
    }else if(id==="attic"){
      const trunk=Mat(0x6a3d22),band=Mat(0xb08a3a,{m:.6,r:.35});
      [[5.3,-.33,.2],[5.2,.3,-.25]].forEach(([r,da,rot])=>{
        const t=new T.Group();t.position.copy(P(r,da,FLOOR));t.rotation.y=-(a+da)+Math.PI/2+rot;grp.add(t);
        add(new T.BoxGeometry(.7,.36,.44),trunk,V(0,.18,0),null,t);
        add(new T.CylinderGeometry(.22,.22,.7,16,1,false,0,Math.PI),trunk,V(0,.36,0),[0,0,Math.PI/2],t);
        [-.22,.22].forEach(x=>add(new T.BoxGeometry(.05,.62,.46),band,V(x,.3,0),null,t));
      });
      const paper=Mat(0xf2ead8);
      for(let k=0;k<4;k++)add(new T.BoxGeometry(.22,.012,.15),paper,P(3.05,.4-k*.05,FLOOR+.008+k*.013),[0,k*.6,0],grp,true);
      add(new T.CylinderGeometry(.05,.05,1.0,8),Mat(0x5a3a26),P(5.75,0,FLOOR+.5),null,grp);
      add(new T.SphereGeometry(.17,12,10),Mat(0x8a7a6a),P(5.75,0,FLOOR+1.08),null,grp).scale.set(1,1.3,.8);
    }else if(id==="boathouse"){
      boat=new T.Group();boat.position.copy(P(5.3,0,.1));boat.rotation.y=-a+Math.PI/2;grp.add(boat);
      const hull=add(new T.SphereGeometry(1,22,10,0,TAU,Math.PI/2,Math.PI/2),Mat(0x8a5631,{ds:true}),V(0,0,0),null,boat);
      hull.scale.set(.82,.27,.32);
      add(new T.BoxGeometry(.06,.03,.6),Mat(0x5a3a22),V(0,-.03,0),null,boat);
      add(new T.BoxGeometry(1.1,.025,.05),Mat(0xc7a46a),V(.1,.02,.18),[0,.25,.05],boat);
      [-.38,.38].forEach(da=>add(new T.CylinderGeometry(.06,.07,.7,10),Mat(0x4a3322),P(4.42,da,FLOOR+.3),null,grp));
    }else if(id==="music"){
      const black=Mat(0x17131b,{r:.25,m:.2}),ivory=Mat(0xf3ecdc);
      const pg=new T.Group();pg.position.copy(P(5.3,-.1,FLOOR));pg.rotation.y=-(a-.1)+Math.PI/2;grp.add(pg);
      add(new T.BoxGeometry(1.15,.28,.72),black,V(0,.62,0),null,pg);
      add(new T.BoxGeometry(1.15,.025,.72),black,V(0,.93,.1),[-.5,0,0],pg);
      add(new T.BoxGeometry(1.0,.05,.17),ivory,V(0,.6,-.44),null,pg);
      [[-.48,-.26],[.48,-.26],[0,.28]].forEach(([x,z])=>add(new T.CylinderGeometry(.045,.045,.48,8),black,V(x,.24,z),null,pg));
      add(new T.CylinderGeometry(.17,.17,.08,16),Mat(0x6e2a3b),V(0,.44,-.82),null,pg);
      add(new T.CylinderGeometry(.04,.04,.42,8),black,V(0,.21,-.82),null,pg);
      add(new T.BoxGeometry(.3,.01,.2),ivory,V(-.25,.77,-.15),[0,.2,0],pg,true);
    }else if(id==="gallery"){
      const gold=Mat(0xb08a3a,{m:.55,r:.35}),legW=Mat(0x5a3a26);
      const cols=[0x2f4a3a,0x6a2433,0x24385a];
      [-.36,0,.36].forEach((da,k)=>{
        const e=new T.Group();e.position.copy(P(5.4+(k===1?.2:0),da,FLOOR));grp.add(e);e.lookAt(0,FLOOR,0);
        [-.2,.2].forEach(x=>add(new T.BoxGeometry(.04,.95,.04),legW,V(x,.45,-.06),[.1,0,0],e));
        add(new T.BoxGeometry(.04,.9,.04),legW,V(0,.42,-.26),[-.3,0,0],e);
        const f=new T.Group();f.position.set(0,.8,0);f.rotation.x=-.12;if(k===1)f.rotation.z=.26;e.add(f);
        add(new T.BoxGeometry(.58,.72,.05),gold,V(0,0,0),null,f);
        add(new T.BoxGeometry(.45,.58,.056),Mat(cols[k],{r:.9}),V(0,0,.004),null,f);
        add(new T.SphereGeometry(.085,10,8),Mat(0xd9b99a),V(0,.06,.034),null,f,true).scale.set(1,1.25,.25);
      });
    }
  }

  function build(){
    R.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    R.shadowMap.enabled=true;R.shadowMap.type=T.PCFSoftShadowMap;R.setClearColor(0x000000,0);
    scene=new T.Scene();scene.fog=new T.Fog(0x1a1120,20,38);
    camera=new T.PerspectiveCamera(36,1.6,.1,90);
    clock=new T.Clock();ray=new T.Raycaster();ndc=new T.Vector2();
    camT=V(0,.3,0);wantT=V(0,.3,0);tmpA=V(0,0,0);tmpB=V(0,0,0);tmpC=V(0,0,0);right=V(1,0,0);GREY=new T.Color(0x6d6672);

    hemi=new T.HemisphereLight(0xb3bcec,0x2b1a30,.66);scene.add(hemi);
    const moon=moonL=new T.DirectionalLight(0xdfe3ff,.6);moon.position.set(-7,13,6);moon.castShadow=true;
    moon.shadow.mapSize.set(1024,1024);Object.assign(moon.shadow.camera,{left:-9.5,right:9.5,top:9.5,bottom:-9.5,near:1,far:42});moon.shadow.bias=-.0015;
    scene.add(moon);
    lamp=new T.PointLight(0xffc27a,1.1,11,1.5);lamp.position.set(0,3.4,0);scene.add(lamp);
    focusLight=new T.PointLight(0xffd391,0,7.5,1.4);focusLight.position.set(0,2.6,0);scene.add(focusLight);

    // plinth and brass rim
    add(new T.CylinderGeometry(ROUT+.25,ROUT+.5,.55,80),Mat(0x2a1d30,{r:.6}),V(0,-.275,0),null,scene,true);
    add(new T.TorusGeometry(ROUT+.26,.05,8,96),Mat(0xb08a3a,{m:.6,r:.35}),V(0,0,0),[Math.PI/2,0,0],scene,true);
    // the terrace where the detectives stand
    const terTex=pattern("planks",0x3b2b26);terTex.repeat.set(4,4);
    const ter=new T.Mesh(new T.CylinderGeometry(8.15,8.4,.34,96),[Mat(0x22171d,{r:.7}),new T.MeshStandardMaterial({map:terTex,roughness:.85}),Mat(0x22171d)]);
    ter.position.y=TER_Y-.17;ter.receiveShadow=true;scene.add(ter);
    add(new T.TorusGeometry(8.16,.045,8,128),Mat(0xb08a3a,{m:.6,r:.35}),V(0,TER_Y,0),[Math.PI/2,0,0],scene,true);

    // the hall: checkered floor, table, envelope
    add(new T.CylinderGeometry(RIN-.02,RIN-.02,FLOOR,72),Mat(0x2c2230),V(0,FLOOR/2,0),null,scene,true);
    const ht=pattern("checker",0x33263a);ht.repeat.set(3,3);
    const hall=new T.Mesh(new T.CircleGeometry(RIN-.02,72),new T.MeshStandardMaterial({map:ht,roughness:.55}));
    hall.rotation.x=-Math.PI/2;hall.position.y=FLOOR+.002;hall.receiveShadow=true;
    hall.userData.info="<b>The hall</b>The sealed envelope on the table holds the answer: who, how and where.";
    scene.add(hall);pickables.push(hall);
    const wood=Mat(0x4a2f22,{r:.55});
    add(new T.CylinderGeometry(.95,.95,.07,48),wood,V(0,FLOOR+.62,0),null,scene);
    add(new T.CylinderGeometry(.11,.3,.6,20),wood,V(0,FLOOR+.3,0),null,scene);
    envGroup=new T.Group();envGroup.position.y=FLOOR+.655;scene.add(envGroup);
    envMat=new T.MeshStandardMaterial({color:0xefe2c2,roughness:.75,emissive:0xffc766,emissiveIntensity:0});
    const envBody=add(new T.BoxGeometry(1.0,.035,.68),envMat,V(0,.018,0),null,envGroup);
    envBody.userData.info="<b>The envelope</b>Sealed at the deal. Nobody sees inside until someone accuses.";pickables.push(envBody);
    flap=new T.Group();flap.position.set(0,.037,-.34);envGroup.add(flap);
    const tri=new T.Shape();tri.moveTo(-.5,0);tri.lineTo(.5,0);tri.lineTo(0,.44);tri.closePath();
    const fg=new T.ShapeGeometry(tri);fg.rotateX(Math.PI/2);
    flapMat=new T.MeshStandardMaterial({color:0xe3d2aa,roughness:.8,side:T.DoubleSide,emissive:0xffc766,emissiveIntensity:0});
    const fm=new T.Mesh(fg,flapMat);fm.castShadow=true;flap.add(fm);
    add(new T.CylinderGeometry(.085,.085,.03,24),Mat(0x9b2330,{r:.4}),V(0,.015,.3),null,flap);

    // rooms
    const wallPaper=0x76607c,trim=Mat(0x3b2a2c,{r:.6});
    ROOMS.forEach((rm,i)=>{
      const a=ang(i),a0=a-Math.PI/6,a1=a+Math.PI/6,[col,pat]=LOOK[rm.id];
      const tex=pattern(pat,col);tex.repeat.set(.45,.45);
      const mat=new T.MeshStandardMaterial({map:tex,roughness:.88,emissive:0xffb347,emissiveIntensity:0});
      const floor=slab(RIN,rm.id==="boathouse"?4.35:ROUT,a0+.004,a1-.004,FLOOR,mat);
      floor.userData.pick={k:"r",id:rm.id};scene.add(floor);pickables.push(floor);
      if(rm.id==="boathouse"){
        waterMat=new T.MeshStandardMaterial({color:0x2a5a7c,roughness:.2,metalness:.15,emissive:0x163a55,emissiveIntensity:.3,transparent:true,opacity:.92});
        const w=slab(4.35,ROUT,a0+.004,a1-.004,.07,waterMat);w.userData.pick={k:"r",id:rm.id};scene.add(w);pickables.push(w);
      }
      const wallMat=new T.MeshStandardMaterial({color:wallPaper,roughness:.9,side:T.DoubleSide,transparent:true,opacity:1});
      const wall=new T.Mesh(new T.CylinderGeometry(ROUT,ROUT,.8,24,1,true,Math.PI/2-a1,a1-a0),wallMat);
      wall.position.y=.4;wall.receiveShadow=true;scene.add(wall);
      const dv=add(new T.BoxGeometry(ROUT-RIN+.1,.5,.08),trim,polar((RIN+ROUT)/2,a0,.25),null,scene);dv.rotation.y=-a0;
      // brass name plaque on the floor, reading from outside the room
      const ptex=canvasTex(512,96,(x,w,h)=>{
        rr(x,4,8,w-8,h-16,14);x.fillStyle="rgba(24,16,28,.9)";x.fill();x.strokeStyle="#c9a35a";x.lineWidth=4;x.stroke();
        x.font=`44px ${FELL}`;const name=rm.name.toLowerCase(),tw=x.measureText(name).width,sx=(w-tw-56)/2;
        x.textBaseline="middle";x.textAlign="left";x.fillStyle="#ecd39a";x.fillText(name,sx+56,h/2+2);
        x.font=`38px ${EMOJI}`;x.textAlign="center";x.fillText(rm.icon,sx+22,h/2+3);
      });
      const pmat=new T.MeshBasicMaterial({map:ptex,transparent:true,depthWrite:false});
      const pg=new T.Group();pg.position.copy(polar(2.9,a,FLOOR+.012));pg.rotation.y=Math.PI/2-a;scene.add(pg);
      const pl=new T.Mesh(new T.PlaneGeometry(1.75,.33),pmat);pl.rotation.x=-Math.PI/2;pl.userData.pick={k:"r",id:rm.id};pg.add(pl);pickables.push(pl);
      const grp=new T.Group();scene.add(grp);props(rm.id,a,grp);
      rooms.push({i,id:rm.id,a,mat,wallMat,pmat});
    });

    // the family: pawns
    const PAWN=[[0,0],[.27,0],[.27,.05],[.22,.09],[.14,.14],[.1,.42],[.17,.47],[.17,.52],[.09,.56],[0,.57]].map(p=>new T.Vector2(p[0],p[1]));
    const pawnGeo=new T.LatheGeometry(PAWN,28),headGeo=new T.SphereGeometry(.14,20,14),haloGeo=new T.RingGeometry(.31,.42,40);
    const haloMat=new T.MeshBasicMaterial({color:0xffcf6b,transparent:true,opacity:.85,depthWrite:false,side:T.DoubleSide});
    SUSPECTS.forEach((s,i)=>{
      const g=new T.Group();
      const mat=new T.MeshStandardMaterial({color:SUS_COL[s.id],roughness:.4,metalness:.15,emissive:0xffbf55,emissiveIntensity:0});
      const body=new T.Mesh(pawnGeo,mat),head=new T.Mesh(headGeo,mat);head.position.y=.69;
      body.castShadow=head.castShadow=true;
      const halo=new T.Mesh(haloGeo,haloMat.clone());halo.rotation.x=-Math.PI/2;halo.position.y=.015;halo.visible=false;
      const lab=label(s.short);lab.position.y=1.1;
      g.add(body,head,halo,lab);scene.add(g);
      body.userData.pick=head.userData.pick={k:"s",id:s.id};pickables.push(body,head);
      pieces[s.id]={g,mat,base:new T.Color(SUS_COL[s.id]),halo,lab,kind:"s",idx:i,to:null,anim:null,glow:0};
    });
    // the methods: floating brass medallions
    const coinGeo=new T.CylinderGeometry(.3,.3,.07,36),faceGeo=new T.CircleGeometry(.27,36);
    METHODS.forEach((m,i)=>{
      const g=new T.Group(),inner=new T.Group();g.add(inner);inner.position.y=.55;
      const brass=new T.MeshStandardMaterial({color:0xb88c3c,roughness:.35,metalness:.55,emissive:0xffbf55,emissiveIntensity:0});
      const face=new T.MeshStandardMaterial({map:emojiTex(m.icon),roughness:.6});
      const coin=new T.Mesh(coinGeo,brass);coin.rotation.x=Math.PI/2;coin.castShadow=true;
      const f1=new T.Mesh(faceGeo,face);f1.position.z=.037;
      const f2=new T.Mesh(faceGeo,face);f2.position.z=-.037;f2.rotation.y=Math.PI;
      inner.add(coin,f1,f2);
      const halo=new T.Mesh(haloGeo,haloMat.clone());halo.rotation.x=-Math.PI/2;halo.position.y=.015;halo.visible=false;
      const lab=label(m.short);lab.position.y=1.05;lab.visible=false;
      g.add(halo,lab);scene.add(g);
      [coin,f1,f2].forEach(o=>{o.userData.pick={k:"m",id:m.id};pickables.push(o);});
      pieces[m.id]={g,inner,mat:brass,face,base:new T.Color(0xb88c3c),halo,lab,kind:"m",idx:i,to:null,anim:null,glow:0};
    });

    // the three cards that rise out of the envelope at the end
    const backTex=canvasTex(256,356,drawBack),edge=Mat(0xf3ead2);
    for(let k=0;k<3;k++){
      const front=new T.MeshStandardMaterial({map:backTex,roughness:.7}),back=new T.MeshStandardMaterial({map:backTex,roughness:.7});
      const c=new T.Mesh(new T.BoxGeometry(.62,.86,.012),[edge,edge,edge,edge,front,back]);c.visible=false;c.castShadow=true;
      scene.add(c);revealCards.push(c);
    }
    // the question cards that float over a room, and cards flying between detectives
    const cardGeo=new T.BoxGeometry(.62,.86,.012);
    const mkCard=()=>{const c=new T.Mesh(cardGeo,[edge,edge,edge,edge,new T.MeshStandardMaterial({map:backTex,roughness:.7}),new T.MeshStandardMaterial({map:backTex,roughness:.7})]);c.visible=false;c.castShadow=true;scene.add(c);return c;};
    for(let k=0;k<3;k++)qCards.push(mkCard());
    for(let k=0;k<3;k++)flyers.push({c:mkCard(),on:false});
    st.backTex=backTex;

    // detectives: one figure per seat, plus Fennimore the butler
    const coatGeo=new T.LatheGeometry([[0,0],[.3,0],[.3,.04],[.26,.3],[.2,.62],[.13,.76],[.15,.8],[0,.82]].map(p=>new T.Vector2(p[0],p[1])),24);
    const headGeo2=new T.SphereGeometry(.15,18,14),brimGeo=new T.CylinderGeometry(.25,.25,.03,24),crownGeo=new T.CylinderGeometry(.15,.16,.2,20);
    const ringGeo=new T.RingGeometry(.42,.56,40),beamGeo=new T.ConeGeometry(.62,4.2,28,1,true);
    const skin=Mat(0xe3c09d,{r:.6}),hatM=Mat(0x221a26,{r:.45}),brassM=Mat(0xc49a45,{m:.6,r:.3}),
          glassM=new T.MeshStandardMaterial({color:0xcfe8ff,transparent:true,opacity:.45,roughness:.05,metalness:.2});
    for(let j=0;j<7;j++){
      const g=new T.Group(),body=new T.Group();g.add(body);
      const coat=new T.MeshStandardMaterial({color:0x888888,roughness:.6,emissive:0xffc766,emissiveIntensity:0});
      const m1=new T.Mesh(coatGeo,coat),head=new T.Mesh(headGeo2,skin);head.position.y=.97;
      const brim=new T.Mesh(brimGeo,hatM);brim.position.y=1.09;
      const crown=new T.Mesh(crownGeo,hatM);crown.position.y=1.2;
      [m1,head,brim,crown].forEach(o=>{o.castShadow=true;o.userData.fig=j;pickables.push(o);});
      body.add(m1,head,brim,crown);
      const mag=new T.Group();mag.position.set(.29,.5,.1);mag.rotation.z=-.5;
      const handle=new T.Mesh(new T.CylinderGeometry(.018,.018,.22,8),Mat(0x3a2418));handle.position.y=-.11;
      const rim=new T.Mesh(new T.TorusGeometry(.085,.017,8,24),brassM);rim.position.y=.08;
      const lens=new T.Mesh(new T.CircleGeometry(.08,20),glassM);lens.position.y=.08;
      mag.add(handle,rim,lens);body.add(mag);
      const shirt=new T.Mesh(new T.BoxGeometry(.13,.22,.02),Mat(0xf2ede4));shirt.position.set(0,.6,.215);shirt.rotation.x=-.22;
      const tie=new T.Mesh(new T.BoxGeometry(.13,.045,.03),Mat(0x111111));tie.position.set(0,.73,.18);
      body.add(shirt,tie);
      const ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xffcf6b,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));
      ring.rotation.x=-Math.PI/2;ring.position.y=.02;g.add(ring);
      const beam=new T.Mesh(beamGeo,new T.MeshBasicMaterial({color:0xffd391,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending}));
      beam.position.y=2.1;beam.scale.set(1.3,1,1.3);g.add(beam);
      body.scale.setScalar(1.35);ring.scale.setScalar(1.35);
      const lab=label("",{gold:true});lab.position.y=2.12;g.add(lab);
      g.visible=false;scene.add(g);
      figs.push({g,body,coat,mag,shirt,tie,ring,beam,lab,u:null,seat:null,popT0:-9,fall:0,glow:0});
    }

    // a red cross that pops over someone who couldn't show a card
    const xTex=canvasTex(128,128,x=>{x.fillStyle="rgba(155,35,48,.92)";x.beginPath();x.arc(64,64,58,0,TAU);x.fill();
      x.strokeStyle="#f6d9da";x.lineWidth=12;x.lineCap="round";x.beginPath();x.moveTo(42,42);x.lineTo(86,86);x.moveTo(86,42);x.lineTo(42,86);x.stroke();});
    for(let k=0;k<6;k++){const sp=new T.Sprite(new T.SpriteMaterial({map:xTex,transparent:true,depthWrite:false,opacity:0}));sp.visible=false;scene.add(sp);marks.push({s:sp,t0:-9,pos:V(0,0,0)});}

    // confetti for the winner
    const CN=200,cp=new Float32Array(CN*3),cc=new Float32Array(CN*3);
    const pal=[0xc0424f,0x2f86b3,0xe0b24a,0x7a5bb5,0x3a9a68,0xf2ede4];
    for(let i=0;i<CN;i++){const c=new T.Color(pal[i%pal.length]);cc[i*3]=c.r;cc[i*3+1]=c.g;cc[i*3+2]=c.b;cp[i*3+1]=-50;}
    const cg=new T.BufferGeometry();cg.setAttribute("position",new T.BufferAttribute(cp,3));cg.setAttribute("color",new T.BufferAttribute(cc,3));
    conf={pts:new T.Points(cg,new T.PointsMaterial({size:.14,vertexColors:true,transparent:true,opacity:1,depthWrite:false})),pos:cp,vel:new Float32Array(CN*3),t0:-99,n:CN};
    conf.pts.visible=false;conf.pts.frustumCulled=false;scene.add(conf.pts);

    // the storm outside: rain beyond the terrace and a moon behind the clouds
    const RN=380;rainPos=new Float32Array(RN*6);
    for(let i=0;i<RN;i++){const r=8.9+Math.random()*7,a=Math.random()*TAU,y=Math.random()*12-1,x=r*Math.cos(a),z=r*Math.sin(a);rainPos.set([x,y,z,x-.04,y-.45,z],i*6);}
    const rg=new T.BufferGeometry();rg.setAttribute("position",new T.BufferAttribute(rainPos,3));
    rain=new T.LineSegments(rg,new T.LineBasicMaterial({color:0xa8b8dc,transparent:true,opacity:.3,depthWrite:false}));
    rain.frustumCulled=false;rain.visible=!REDUCED;scene.add(rain);
    const mTex=canvasTex(128,128,x=>{const g=x.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,"rgba(255,250,235,1)");g.addColorStop(.2,"rgba(242,238,222,.95)");g.addColorStop(.28,"rgba(200,200,255,.28)");g.addColorStop(1,"rgba(160,160,255,0)");x.fillStyle=g;x.fillRect(0,0,128,128);});
    const moonS=new T.Sprite(new T.SpriteMaterial({map:mTex,transparent:true,depthWrite:false,fog:false}));moonS.position.set(-24,15,-26);moonS.scale.set(7,7,1);scene.add(moonS);

    // drifting dust in the lamplight
    const N=150;dustPos=new Float32Array(N*3);
    for(let i=0;i<N;i++){const r=Math.sqrt(Math.random())*6.2,a=Math.random()*TAU;dustPos[i*3]=r*Math.cos(a);dustPos[i*3+1]=Math.random()*3.6;dustPos[i*3+2]=r*Math.sin(a);}
    const dg=new T.BufferGeometry();dg.setAttribute("position",new T.BufferAttribute(dustPos,3));
    dust=new T.Points(dg,new T.PointsMaterial({color:0xffe0a8,size:.045,transparent:true,opacity:.55,depthWrite:false,blending:T.AdditiveBlending}));
    scene.add(dust);

    capEl=document.createElement("div");capEl.className="stage-cap";capEl.innerHTML="<span></span>";
    bindPointer(R.domElement);
    R.domElement.addEventListener("webglcontextlost",e=>{e.preventDefault();fail();});
  }

  function applySaver(){
    if(!st.ok)return;
    R.shadowMap.enabled=!st.saver;
    scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.needsUpdate=true;});});
    rain.visible=AMB();dust.visible=AMB();
    R.setPixelRatio(Math.min(window.devicePixelRatio||1,st.saver?1.5:2));resize();poke();
  }
  function init(){
    try{
      T=window.THREE;if(!T)return fail();
      R=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
      if(!R.getContext())return fail();
      R.domElement.setAttribute("aria-hidden","true");
      build();
    }catch(e){console.error(e);return fail();}
    st.ok=true;applySaver();
    if(!REDUCED){cam.az=want.az-1.7;cam.el=1.42;cam.dist=44;}
    const h=st.host;st.host=null;mount(h);
    st.key=null;sync(st.g,st.code);
    if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>redraws.forEach(f=>f())).catch(()=>{});
    setTimeout(()=>redraws.forEach(f=>f()),3000);
    requestAnimationFrame(loop);
  }

  /* ---- pointer: drag to turn, tap to pick ---- */
  function hitsAt(e){
    const r=R.domElement.getBoundingClientRect();
    ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc,camera);
    const out=[],seen=new Set();
    for(const h of ray.intersectObjects(pickables,false)){
      const u=h.object.userData;
      if(u.fig!=null){let o=h.object,vis=true;while(o){if(!o.visible){vis=false;break;}o=o.parent;}if(!vis)continue;}
      const key=u.pick?u.pick.id:u.fig!=null?"fig"+u.fig:u.info;
      if(!(u.pick||u.info||u.fig!=null)||seen.has(key))continue;
      seen.add(key);out.push(u);
    }
    return out;
  }
  function hitAt(e){
    const r=R.domElement.getBoundingClientRect();
    ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);
    ray.setFromCamera(ndc,camera);
    for(const h of ray.intersectObjects(pickables,false)){
      const u=h.object.userData;
      if(u.fig!=null){let o=h.object,vis=true;while(o){if(!o.visible){vis=false;break;}o=o.parent;}if(!vis)continue;}
      if(u.pick||u.info||u.fig!=null)return u;
    }
    return null;
  }
  function bindPointer(cv){
    let drag=null,lastHover=0;
    cv.addEventListener("pointerdown",e=>{poke();drag={x:e.clientX,y:e.clientY,id:e.pointerId,moved:false,type:e.pointerType};});
    cv.addEventListener("pointermove",e=>{
      if(drag&&e.pointerId===drag.id){
        const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
        if(!drag.moved&&Math.hypot(dx,dy)>6){drag.moved=true;try{cv.setPointerCapture(e.pointerId);}catch(_){}}
        if(drag.moved){
          poke();want.az+=dx*.0085;
          if(drag.type==="mouse")want.el=clamp(want.el+dy*.006,.3,1.3);
          drag.x=e.clientX;drag.y=e.clientY;st.lastDrag=performance.now();
        }
      }else if(e.pointerType==="mouse"&&performance.now()-lastHover>60){
        lastHover=performance.now();
        const u=hitAt(e);const id=u&&u.pick?u.pick.id:null;
        cv.classList.toggle("pointing",!!u);if(st.hover!==id)poke();st.hover=id;
      }
    });
    cv.addEventListener("pointerup",e=>{if(drag&&e.pointerId===drag.id){if(!drag.moved)tap(e);drag=null;}});
    cv.addEventListener("pointercancel",()=>{drag=null;});
    cv.addEventListener("pointerleave",()=>{st.hover=null;cv.classList.remove("pointing");});
  }
  function tap(e){
    poke();
    const hits=hitsAt(e).filter(x=>x.pick||x.fig!=null||x.info);if(!hits.length)return;
    let u=hits[0];
    const lt=st.lastTap,now=performance.now();
    /* tapping the same spot again picks the next piece behind it */
    if(lt&&now-lt.t<2500&&Math.hypot(e.clientX-lt.x,e.clientY-lt.y)<16){
      const i=hits.findIndex(x=>x===lt.u||(x.pick&&lt.u.pick&&x.pick.id===lt.u.pick.id));
      if(i>=0)u=hits[(i+1)%hits.length];
    }
    st.lastTap={t:now,x:e.clientX,y:e.clientY,u};
    if(u.info){tip(u.info);return;}
    if(u.fig!=null){const fg=figs[u.fig];if(fg&&fg.seat)tip(figInfo(fg));return;}
    const c=CARD[u.pick.id];if(!c)return;
    if(st.pickMode&&api.onPick){
      api.onPick(u.pick.k,u.pick.id);
      const on=st.picks[u.pick.k]===u.pick.id;
      tip(`<b>${esc(c.name)}</b>${on?"is in your question.":"is out of your question."}`);
    }else tip(`<b>${esc(c.name)}</b>${esc(c.note)}`);
  }
  function figInfo(fg){
    const g=st.g,sv=fg.seat;if(!g)return "";
    const name=sv.butler?"Fennimore":nick(sv.u,g);
    let line=sv.butler?"The butler holds a hand when only two detectives play.":sv.bot?`Computer detective, ${g.players[sv.u].bot}.`:sv.u===st.me?"That's you.":"Detective.";
    const n=g.handSize&&g.handSize[sv.u];if(n!=null)line+=` ${n} cards.`;
    if(g.out&&g.out[sv.u])line+=" Out of the running.";
    return `<b>${esc(name)}</b>${esc(line)}`;
  }
  function tip(html){poke();st.tip=html;st.tipUntil=performance.now()+5200;updateCap();}
  function hint(){
    const g=st.g,f=st.focus;
    if(st.pickMode)return "Tap a relative, a method and a room to build your question.";
    if(f.mode==="room"&&f.asked){const [s,m,r]=f.asked.map(id=>CARD[id]);return `<b>${esc(r.name)}</b>Was it ${esc(s.short)}, with the ${esc(m.name)}?`;}
    if(f.mode==="envelope")return "<b>Accusation</b>Opening the envelope…";
    if(f.mode==="reveal"){const [s,m,r]=f.sol.map(id=>CARD[id]);return `<b>Solved</b>${esc(s.name)}, with the ${esc(m.name)}, in the ${esc(r.name)}.`;}
    if(g&&g.status==="playing"&&st.know&&ALL.some(id=>st.know[id]==="env"))return "Gold rings mark what your notebook proves is in the envelope.";
    return st.seats.length?"Drag to turn the manor. Tap a detective or a piece for details.":"Drag to turn the manor. Tap a piece to meet the family.";
  }
  /* labels that would overlap on screen give way to the more important one:
     pieces in the question first, then the detectives, then the rest, nearest first */
  let dcV=null;
  function declutter(){
    if(!st.vw||!st.lpx)return;
    if(!dcV)dcV=new T.Vector3();
    figs.forEach(x=>{x.lab.visible=true;});
    const L=st.lpx,cand=[];
    for(const l of labels){
      if(!l.visible||!l.userData.box||!l.userData.box.text)continue;
      let o=l.parent,shown=true;while(o){if(!o.visible){shown=false;break;}o=o.parent;}
      if(!shown)continue;
      l.getWorldPosition(dcV);dcV.project(camera);
      if(dcV.z>1||dcV.z<-1)continue;
      cand.push({l,x:(dcV.x+1)/2*st.vw,y:(1-dcV.y)/2*st.vh,z:dcV.z,pr:l.userData.pri||1});
    }
    cand.sort((a,b)=>b.pr-a.pr||a.z-b.z);
    const placed=[];
    for(const c of cand){
      const hw=c.l.userData.box.frac*L*2+1,hh=L*.375+1;
      const r=[c.x-hw,c.x+hw,c.y-hh,c.y+hh];
      if(placed.some(p=>p[0]<r[1]&&r[0]<p[1]&&p[2]<r[3]&&r[2]<p[3]))c.l.visible=false;
      else placed.push(r);
    }
  }
  function updateCap(){
    if(!capEl)return;
    const html=st.tip&&performance.now()<st.tipUntil?st.tip:hint();
    if(html!==st.capHTML){st.capHTML=html;capEl.firstChild.innerHTML=html;}
  }

  function mount(host){
    if(!host)return;
    if(!st.ok){st.host=host;return;}
    if(st.host===host&&host.contains(R.domElement))return;
    st.host=host;
    host.appendChild(R.domElement);host.appendChild(capEl);host.classList.add("ready");
    if(ro)ro.disconnect();if(io)io.disconnect();
    if(window.ResizeObserver){ro=new ResizeObserver(resize);ro.observe(host);}
    if(window.IntersectionObserver){io=new IntersectionObserver(es=>{st.visible=es[es.length-1].isIntersecting;});io.observe(host);}
    resize();
  }
  function resize(){
    const h=st.host;if(!h||!R)return;
    const w=h.clientWidth,hh=h.clientHeight;if(!w||!hh)return;
    R.setSize(w,hh,false);camera.aspect=w/hh;camera.updateProjectionMatrix();
    st.tanV=Math.tan(camera.fov*Math.PI/360);st.tanH=st.tanV*camera.aspect;st.aspect=camera.aspect;
    st.lpx=clamp(24,20,hh*.09);st.vw=w;st.vh=hh;
    const lh=st.lpx/hh*2*st.tanV;labels.forEach(l=>l.scale.set(lh*4,lh,1));
  }

  /* ---- game state -> board ---- */
  function layout(locS,locM){
    const out={},by=Array.from({length:6},()=>({s:[],m:[]}));
    SUSPECTS.forEach((s,i)=>{const r=locS[s.id];if(r==null)out[s.id]=polar(1.62,ang(i),FLOOR);else by[r].s.push(s.id);});
    METHODS.forEach(m=>by[locM[m.id]].m.push(m.id));
    by.forEach((b,ri)=>{
      const a=ang(ri);
      const place=(ids,r,sp)=>ids.forEach((id,j)=>{const t=(j-(ids.length-1)/2)*sp;out[id]=V(r*Math.cos(a)-t*Math.sin(a),FLOOR,r*Math.sin(a)+t*Math.cos(a));});
      place(b.s,3.55,.6);place(b.m,4.5,.72);
    });
    return out;
  }
  function near(a){const d=((a-want.az)%TAU+TAU*1.5)%TAU-Math.PI;return want.az+d;}
  function setFocus(f){
    const p=st.focus;st.focus=f;
    if(!st.follow)return;
    if(f.mode==="room"&&!(p.mode==="room"&&p.room===f.room)){want.az=near(ang(f.room));want.el=.74;}
    else if(f.mode!==p.mode){want.el={overview:(st.aspect||1.5)<1?1.06:.9,envelope:.62,reveal:.44,room:.78}[f.mode];}
  }
  function sync(g,code){
    st.g=g;st.code=code;
    if(!st.ok)return;
    const tk=code||"home";
    const key=`${tk}|${g?g.rev:0}|${g?g.status:""}|${g?g.phase:""}|${g&&g.solution?1:0}|${g&&g.players?Object.keys(g.players).filter(u=>g.players[u]).length:0}|${st.me}`;
    if(key===st.key){updateCap();return;}
    st.key=key;
    const fresh=st.tableKey!==tk||!st.hadGame;
    const animate=!REDUCED&&!fresh;
    st.tableKey=tk;st.hadGame=!!g||tk==="home";
    const locS={},locM={};
    METHODS.forEach((m,i)=>{locM[m.id]=i;});
    const live=g&&(g.status==="playing"||g.status==="over");
    if(live)for(const e of g.log||[])if(e.t==="ask"&&e.c&&roomIdx(e.c[2])>=0&&pieces[e.c[0]]&&pieces[e.c[1]]){locS[e.c[0]]=roomIdx(e.c[2]);locM[e.c[1]]=roomIdx(e.c[2]);}
    if(g&&g.status==="over"&&g.solution){locS[g.solution[0]]=roomIdx(g.solution[2]);locM[g.solution[1]]=roomIdx(g.solution[2]);}
    const L=layout(locS,locM);let ns=0,nm=0;
    for(const id in L){
      const pc=pieces[id],to=L[id];
      if(pc.to&&pc.to.distanceTo(to)<.01)continue;
      if(!animate||!pc.to){pc.g.position.copy(to);pc.anim=null;}
      else pc.anim={from:pc.g.position.clone(),t0:st.t+(pc.kind==="s"?ns++*.15:.3+nm++*.15),dur:1.1,hop:.8+.3*pc.g.position.distanceTo(to)/6};
      pc.to=to;
    }
    let f={mode:"overview"};
    if(g&&g.status==="playing"){
      if((g.phase==="asking"||g.phase==="asked")&&g.q)f={mode:"room",room:roomIdx(g.q.cards[2]),asked:g.q.cards};
      else if(g.phase==="judging")f={mode:"envelope",asked:g.acc?g.acc.cards:[]};
    }else if(g&&g.status==="over"&&g.solution)f={mode:"reveal",sol:g.solution,room:roomIdx(g.solution[2]),asked:g.solution};
    setFocus(f);
    if(f.mode==="reveal"){
      if(st.revealKey!==tk){
        st.revealKey=tk;
        revealCards.forEach((c,k)=>{c.material[4].map=cardFace(f.sol[k]);c.material[4].needsUpdate=true;});
        st.reveal={t0:animate?st.t:st.t-30};
      }
    }else if(st.reveal){st.reveal=null;st.revealKey=null;revealCards.forEach(c=>c.visible=false);flap.rotation.x=0;}

    // the detectives on the terrace
    const seats=seatList(g);st.seats=seats;
    const have=new Map();figs.forEach(x=>{if(x.u&&seats.some(sv=>sv.u===x.u))have.set(x.u,x);else{x.u=null;x.seat=null;}});
    seats.forEach(sv=>{
      let fg=have.get(sv.u);
      if(!fg){fg=figs.find(x=>!x.u);if(!fg)return;fg.u=sv.u;fg.popT0=animate?st.t+sv.i*.08:-9;fg.fall=(g.out&&g.out[sv.u])?1.45:0;}
      fg.seat=sv;
      fg.g.position.copy(polar(SEAT_R,sv.angle,TER_Y));fg.g.lookAt(0,TER_Y,0);
      fg.mag.visible=!sv.butler;fg.shirt.visible=fg.tie.visible=sv.butler;
      fg.lab.userData.setText(sv.u===st.me?"You":sv.name);fg.lab.userData.pri=sv.u===st.me?2.5:2;
    });
    // swing the camera behind whoever's turn it is
    if(g&&g.status==="playing"&&f.mode==="overview"){
      const ts=seats.find(sv=>sv.u===g.turn);
      let lastTurn=0;for(const e of g.log||[])if(e.t==="turn"||e.t==="start")lastTurn=e.n;
      const tkey=tk+"|"+g.turn+"|"+lastTurn;
      if(ts&&tkey!==st.turnKey&&st.follow){st.turnKey=tkey;want.az=near(ts.angle);want.el=(st.aspect||1.5)<1?.8:.62;}
      st.turnAngle=ts?ts.angle:null;
    }else st.turnAngle=null;
    // the question cards over the room
    const qk=f.mode==="room"&&f.asked?f.asked.join():"";
    if(qk&&qk!==st.qKey)f.asked.forEach((id,i)=>{const m=qCards[i].material[4];m.map=cardFace(id);m.needsUpdate=true;});
    st.qKey=qk;
    // replay what just happened at the table
    poke();
    const seq=g?(g.seq||0):0;
    if(!animate||!g){st.lastN=seq;st.qFly=null;}
    else{
      let dl=0;
      for(const e of g.log||[]){
        if(e.n<=st.lastN)continue;
        if(e.t==="ask"){st.qFly={t0:st.t+.05,from:seatPos(e.by,1.3)};dl=.9;}
        else if(e.t==="pass"){spawnMark(seatPos(e.who,1.9),dl);dl+=.45;}
        else if(e.t==="show"){spawnFlyer(e,dl);dl+=.4;}
        else if(e.t==="win")burst(seatPos(e.by,1.3),2.6);
      }
      st.lastN=seq;
    }
    updateCap();
  }
  function seatList(g){
    if(!g||!g.players||g.status==="closed")return [];
    const ids=g.status==="lobby"?seated(g):[...(g.order||[]),...(g.butler?["butler"]:[])];
    const n=Math.max(ids.length,1);
    return ids.map((u,i)=>({u,i,angle:Math.PI/2+i*TAU/n,hex:u==="butler"?0x2b2730:SEAT_HEX[i%SEAT_HEX.length],
      name:u==="butler"?"Fennimore":shortNick(nick(u,g)),bot:isBot(g,u),butler:u==="butler"}));
  }
  function seatPos(u,y){const sv=st.seats.find(x=>x.u===u);return sv?polar(SEAT_R,sv.angle,TER_Y+(y||1.25)*1.35):V(0,2,0);}
  function spawnMark(pos,dl){
    let m=marks.find(x=>x.t0<0)||marks.reduce((a,b)=>a.t0<b.t0?a:b);
    m.pos.copy(pos);m.t0=st.t+dl;
  }
  function spawnFlyer(e,dl){
    let fl=flyers.find(x=>!x.on)||flyers[0];
    fl.on=true;fl.from=seatPos(e.who,1.25);fl.to=seatPos(e.to,1.45);fl.t0=st.t+dl+.1;fl.n=e.n;fl.mine=e.to===st.me;fl.faced=false;
    const m=fl.c.material[4];m.map=st.backTex;m.needsUpdate=true;
  }
  function burst(pos,dl){
    if(REDUCED)return;
    for(let i=0;i<conf.n;i++){const j=i*3;
      conf.pos[j]=pos.x+(Math.random()-.5)*.4;conf.pos[j+1]=pos.y+Math.random()*.3;conf.pos[j+2]=pos.z+(Math.random()-.5)*.4;
      conf.vel[j]=(Math.random()-.5)*4.6;conf.vel[j+1]=3.4+Math.random()*3.8;conf.vel[j+2]=(Math.random()-.5)*4.6;}
    conf.pts.geometry.attributes.position.needsUpdate=true;conf.t0=st.t+dl;
  }

  /* ---- every frame ---- */
  function frame(dt){
    st.t+=dt;const t=st.t,f=st.focus,now=performance.now();
    const k=REDUCED?1:1-Math.exp(-dt*(t<3.6?1.25:2.6));
    // where the camera wants to be
    const tanH=st.tanH,tanV=st.tanV;
    const fm=st.follow?f.mode:"overview";
    if(fm==="room"){wantT.copy(polar(3.7,ang(f.room),.3));want.dist=clamp(Math.max(2.7/tanH,2.2/tanV),5.5,15);}
    else if(fm==="envelope"){wantT.set(0,FLOOR+.75,0);want.dist=clamp(Math.max(1.6/tanH,1.25/tanV),4.2,11);}
    else if(fm==="reveal"){wantT.set(0,FLOOR+1.35,0);want.dist=clamp(Math.max(1.9/tanH,1.25/tanV),5.2,12);}
    else{
      const home=!st.code,R0=st.seats.length?8.3:((st.aspect||1.5)<1?6.2:6.7);
      if(st.turnAngle!=null&&st.follow){const pf=(st.aspect||1.5)<1?.76:.86;wantT.copy(polar(3.6,st.turnAngle,.3));want.dist=clamp(Math.max(R0*pf/tanH,R0*.6/tanV),8,34);}
      else{wantT.set(0,home?.9:.1,0);want.dist=clamp(Math.max(R0/tanH,R0*.7/tanV),9,36);}
    }
    if(!REDUCED&&f.mode==="overview"&&now-st.lastDrag>6000&&!(st.g&&st.g.status==="playing"))want.az+=dt*.07;
    cam.az+=(want.az-cam.az)*k;cam.el+=(want.el-cam.el)*k;cam.dist+=(want.dist-cam.dist)*k;camT.lerp(wantT,k);
    const ce=Math.cos(cam.el);
    camera.position.set(camT.x+ce*Math.cos(cam.az)*cam.dist,camT.y+Math.sin(cam.el)*cam.dist,camT.z+ce*Math.sin(cam.az)*cam.dist);
    camera.lookAt(camT);
    scene.fog.near=cam.dist*.85;scene.fog.far=cam.dist*2.3;

    // fade the walls between the camera and the room, like a dollhouse
    for(const rm of rooms){
      const fa=Math.cos(rm.a-cam.az),op=fa>.1?1-.86*Math.min(1,(fa-.1)/.55):1;
      rm.wallMat.opacity=op;rm.wallMat.depthWrite=op>.95;
      const picked=st.pickMode&&st.picks.r===rm.id,kv=st.know&&st.know[rm.id];
      let em=picked?.42:(kv==="env"?.2:0);
      if(st.hover===rm.id)em=Math.max(em,.16);
      if(f.mode==="room"&&f.room===rm.i)em=Math.max(em,.1+.06*Math.sin(t*3));
      rm.mat.emissiveIntensity+=(em-rm.mat.emissiveIntensity)*.2;
      const dim=kv==="held"||kv==="faceup"||kv==="notenv";
      rm.pmat.opacity=dim?.45:1;
    }

    // pieces
    const asked=f.asked||[];
    for(const id in pieces){
      const pc=pieces[id];
      if(pc.anim){
        const q=c01((t-pc.anim.t0)/pc.anim.dur);
        if(q>0){
          const e=ease(q);
          pc.g.position.lerpVectors(pc.anim.from,pc.to,e);pc.g.position.y+=Math.sin(Math.PI*q)*pc.anim.hop;
          if(pc.kind==="s")pc.g.rotation.y=e*TAU;
        }
        if(q>=1){pc.anim=null;pc.g.position.copy(pc.to);pc.g.rotation.y=0;}
      }else if(pc.to&&asked.includes(id)&&!REDUCED){
        pc.g.position.y=pc.to.y+(pc.kind==="s"?Math.abs(Math.sin(t*2.6))*.07:0);
      }
      if(pc.kind==="m"){
        pc.g.rotation.y=Math.atan2(camera.position.x-pc.g.position.x,camera.position.z-pc.g.position.z);
        if(AMB()){pc.inner.position.y=.55+Math.sin(t*1.8+pc.idx)*.05;pc.inner.rotation.y=Math.sin(t*.9+pc.idx)*.4+(pc.anim?c01((t-pc.anim.t0)/pc.anim.dur)*TAU:0);}
      }
      const picked=st.pickMode&&(st.picks.s===id||st.picks.m===id);
      let glow=picked?.65:asked.includes(id)?.3+.18*Math.sin(t*4):0;
      if(st.hover===id)glow=Math.max(glow,.32);
      pc.glow+=(glow-pc.glow)*.2;pc.mat.emissiveIntensity=pc.glow;
      const kv=st.know&&st.know[id],dim=kv==="held"||kv==="faceup"||kv==="notenv";
      pc.mat.color.copy(pc.base);if(dim)pc.mat.color.lerp(GREY,.62);
      if(pc.face)pc.face.color.setScalar(dim?.5:1);
      const env=kv==="env"||(f.mode==="reveal"&&f.sol.includes(id));
      pc.halo.visible=env;if(env)pc.halo.material.opacity=.55+.3*Math.sin(t*3+pc.idx);
      const hot=picked||asked.includes(id)||st.hover===id||env;
      pc.lab.userData.pri=hot?3:1;
      if(pc.kind==="m")pc.lab.visible=hot;
      else pc.lab.visible=f.mode!=="reveal"||f.sol.includes(id);
    }

    // envelope: glows while an accusation is checked, opens at the end
    const judging=f.mode==="envelope";
    const eg=judging?.35+.25*Math.sin(t*5):0;
    envMat.emissiveIntensity+=(eg-envMat.emissiveIntensity)*.2;flapMat.emissiveIntensity=envMat.emissiveIntensity;
    const ey=FLOOR+.655+(judging?.22+Math.sin(t*2.2)*.04:0);envGroup.position.y+=(ey-envGroup.position.y)*k;
    if(judging&&!REDUCED)envGroup.rotation.y=Math.sin(t*1.3)*.25;else envGroup.rotation.y*=.9;
    if(st.reveal){
      const p=t-st.reveal.t0;
      flap.rotation.x=-2.5*ease(c01(p/.8));
      right.set(1,0,0).applyQuaternion(camera.quaternion);
      revealCards.forEach((c,i)=>{
        const q=c01((p-.7-i*.3)/1.5);
        c.visible=q>0;if(!c.visible)return;
        const e=ease(q);
        tmpA.set(0,envGroup.position.y+.05,0);
        tmpB.set(0,FLOOR+1.62,0).addScaledVector(right,(i-1)*.74);
        c.position.lerpVectors(tmpA,tmpB,e);c.position.y+=Math.sin(Math.PI*q)*.45+(REDUCED?0:Math.sin(t*1.6+i)*.02*e);
        const s=.35+.65*e;c.scale.set(s,s,s);
        c.lookAt(camera.position);c.rotateY(Math.PI*(1-ease(c01((q-.35)/.65))));
      });
    }

    // the detectives
    const g=st.g,act=g?actor(g):null;
    for(const fg of figs){
      if(!fg.u){fg.g.visible=false;continue;}
      fg.g.visible=true;
      const sv=fg.seat,pop=c01((t-fg.popT0)/.65);
      fg.g.scale.setScalar(Math.max(.001,pop<1?easeBack(pop):1));
      const out=!!(g&&g.status!=="lobby"&&g.out&&g.out[fg.u]);
      fg.fall+=((out?1.45:0)-fg.fall)*(REDUCED?1:.06);fg.body.rotation.z=fg.fall;
      if(st.seatHex&&!sv.butler)fg.coat.color.set(st.seatHex[sv.i%st.seatHex.length]);else fg.coat.color.setHex(sv.hex);
      if(out)fg.coat.color.lerp(GREY,.6);
      const playing=g&&g.status==="playing";
      const isTurn=playing&&g.turn===fg.u&&!out,acting=playing&&g.phase==="asking"&&act===fg.u;
      const won=g&&g.status==="over"&&g.winner===fg.u,accusing=playing&&g.phase==="judging"&&g.acc&&g.acc.by===fg.u;
      const ro=(isTurn||won)?.7+.25*Math.sin(t*3):acting?.4:0;
      fg.ring.material.opacity+=(ro-fg.ring.material.opacity)*.15;
      fg.beam.material.opacity+=(((isTurn||accusing||won)?.12:0)-fg.beam.material.opacity)*.1;
      fg.beam.material.color.setHex(accusing?0xff8f80:0xffd391);
      fg.glow+=(((isTurn||acting)?.22+.12*Math.sin(t*4):won?.3:0)-fg.glow)*.15;fg.coat.emissiveIntensity=fg.glow;
      let y=0;
      if(!REDUCED){if(won)y=Math.abs(Math.sin(t*5))*.35;else if(acting)y=Math.abs(Math.sin(t*7))*.07;else if(isTurn)y=.03+Math.sin(t*2)*.03;}
      fg.body.position.y=y;
    }

    // the question floats over the room; the asker's cards fly there first
    if(f.mode==="room"&&f.asked&&f.room>=0){
      right.set(1,0,0).applyQuaternion(camera.quaternion);
      const base=polar(3.9,ang(f.room),1.95);
      qCards.forEach((c,i)=>{
        tmpB.copy(base).addScaledVector(right,(i-1)*.66);if(!REDUCED)tmpB.y+=Math.sin(t*1.5+i)*.05;
        const p=st.qFly?c01((t-st.qFly.t0-i*.12)/.95):1,e=ease(p);
        c.visible=p>0;
        if(p<1){c.position.lerpVectors(st.qFly.from,tmpB,e);c.position.y+=Math.sin(Math.PI*p)*1.3;}else c.position.copy(tmpB);
        const sc=.78*(.4+.6*e);c.scale.set(sc,sc,sc);
        c.lookAt(camera.position);if(p<1)c.rotateY(TAU*(1-e));
      });
    }else qCards.forEach(c=>{c.visible=false;});

    // a shown card flies face down from one detective to the other; only the asker sees it turn over
    for(const fl of flyers){
      if(!fl.on){fl.c.visible=false;continue;}
      const p=t-fl.t0;fl.c.visible=p>=0;if(p<0)continue;
      const tr=c01(p/1.25);
      const dest=fl.mine?(camera.getWorldDirection(tmpC).multiplyScalar(2.5).add(camera.position),tmpC.y-=.32,tmpC):fl.to;
      if(tr<1){
        const e=ease(tr);fl.c.position.lerpVectors(fl.from,dest,e);fl.c.position.y+=Math.sin(Math.PI*tr)*(fl.mine?1.2:2.4);fl.c.scale.setScalar(fl.mine?.55+.25*e:.7);
        fl.c.lookAt(camera.position);fl.c.rotateY(Math.PI);fl.c.rotateZ(Math.sin(tr*Math.PI)*.5);
      }else{
        const h=p-1.25;
        if(fl.mine)fl.c.position.copy(dest);else{fl.c.position.copy(fl.to);fl.c.position.y+=.2+Math.min(h,.5)*.5;}
        fl.c.lookAt(camera.position);
        let flip=0;
        if(fl.mine){const d=st.dec&&st.dec[fl.n];if(d&&d.card){if(!fl.faced){fl.faced=true;fl.ft0=t;const m=fl.c.material[4];m.map=cardFace(d.card);m.needsUpdate=true;}flip=ease(c01((t-fl.ft0)/.6));}}
        fl.c.rotateY(Math.PI*(1-flip));
        const life=fl.mine?3.2:1.3,fade=c01((h-life)/.4);
        fl.c.scale.setScalar((fl.mine?.8:.7)*(1-fade)+.001);
        if(h>life+.4){fl.on=false;fl.c.visible=false;}
      }
    }
    for(const mk of marks){
      const p=mk.t0<0?-1:(t-mk.t0)/1.3;
      if(p<0||p>1){mk.s.visible=false;if(p>1)mk.t0=-9;continue;}
      mk.s.visible=true;mk.s.position.copy(mk.pos);mk.s.position.y+=p*.5;
      mk.s.material.opacity=p<.15?p/.15:1-(p-.15)/.85;
      const sc=.5*(p<.15?.6+.4*p/.15:1);mk.s.scale.set(sc,sc,1);
    }
    if(conf.t0>-90){
      const p=t-conf.t0;
      if(p>3.8){conf.pts.visible=false;conf.t0=-99;}
      else if(p>=0){
        conf.pts.visible=true;
        for(let i=0;i<conf.n;i++){const j=i*3;
          conf.vel[j+1]-=6.5*dt;conf.vel[j]*=.985;conf.vel[j+2]*=.985;
          conf.pos[j]+=conf.vel[j]*dt;conf.pos[j+1]+=conf.vel[j+1]*dt;conf.pos[j+2]+=conf.vel[j+2]*dt;
          if(conf.pos[j+1]<TER_Y){conf.pos[j+1]=TER_Y;conf.vel[j+1]*=-.2;}}
        conf.pts.geometry.attributes.position.needsUpdate=true;conf.pts.material.opacity=1-c01((p-2.8)/1);
      }
    }

    // the storm: rain and the odd flash of lightning
    if(rain.visible){
      for(let i=0;i<rainPos.length;i+=6){rainPos[i+1]-=dt*11;rainPos[i+4]-=dt*11;if(rainPos[i+4]<-2){rainPos[i+1]+=13;rainPos[i+4]+=13;}}
      rain.geometry.attributes.position.needsUpdate=true;
    }
    if(AMB()){
      if(t>st.nextBolt){st.boltAt=t;st.nextBolt=t+(st.code?60+Math.random()*60:12+Math.random()*8);}
      const bt=t-st.boltAt,amp=st.code?.4:.7;let fb=0;
      if(bt>=0&&bt<.8)fb=(bt<.08?1:bt<.16?.25:bt<.26?.8:Math.max(0,.8-(bt-.26)*1.5))*amp;
      hemi.intensity=.66+1.2*fb;moonL.intensity=.6+1*fb;
      const fv=(fb*.35).toFixed(2);if(fv!==st.flash){st.flash=fv;st.host.style.setProperty("--flash",fv);}
    }else if(st.flash!=="0.00"){st.flash="0.00";hemi.intensity=.66;moonL.intensity=.6;if(st.host)st.host.style.setProperty("--flash","0");}

    // lights and atmosphere
    lamp.intensity=1.05+(AMB()?Math.sin(t*7.3)*.04+Math.sin(t*12.1)*.03:0);
    let fl=0;
    if((f.mode==="room"||f.mode==="reveal")&&f.room>=0){focusLight.position.copy(polar(3.9,ang(f.room),2.3));fl=1.5;}
    focusLight.intensity+=(fl-focusLight.intensity)*.08;
    if(AMB()){
      if(waterMat)waterMat.emissiveIntensity=.28+.08*Math.sin(t*1.7);
      if(boat){boat.position.y=.1+Math.sin(t*1.3)*.025;boat.rotation.z=Math.sin(t*1.1)*.05;}
      for(let i=1;i<dustPos.length;i+=3){dustPos[i]+=dt*.06;if(dustPos[i]>3.6)dustPos[i]=0;}
      dust.geometry.attributes.position.needsUpdate=true;
    }
    if(st.tip&&now>st.tipUntil){st.tip="";}
    updateCap();
    declutter();
    R.render(scene,camera);
    if(st.saver){
      const settled=Math.abs(want.az-cam.az)<1e-3&&Math.abs(want.el-cam.el)<1e-3&&Math.abs(want.dist-cam.dist)<1e-2&&camT.distanceTo(wantT)<1e-3;
      const fx=Object.values(pieces).some(pc=>pc.anim)||flyers.some(x=>x.on)||marks.some(x=>x.t0>=0)||conf.t0>-90||(st.reveal&&t-st.reveal.t0<6)||(st.qFly&&t-st.qFly.t0<2.5)||figs.some(x=>x.u&&t-x.popT0<1);
      st.idle=settled&&!fx&&now-st.poke>1500&&!(f.mode==="overview"&&!(st.g&&st.g.status==="playing")&&now-st.lastDrag>6000&&!REDUCED);
    }
  }
  function loop(){
    if(st.dead)return;
    requestAnimationFrame(loop);
    let dt=Math.min(.25,clock.getDelta());
    if(!st.ok||!st.host||document.hidden||!st.visible||!st.host.clientWidth)return;
    if(st.saver){st.acc+=dt;if(st.acc<(st.idle?.5:1/30))return;dt=st.acc;st.acc=0;}
    try{frame(Math.min(.05,dt));}catch(e){console.error(e);fail();}
  }

  api.load=load;api.mount=mount;api.sync=sync;
  api.setPick=(on,p)=>{const k=JSON.stringify([!!on,p]);if(k!==st.pickK){st.pickK=k;poke();}st.pickMode=!!on;st.picks={...(p||{})};if(st.ok)updateCap();};
  api.setKnow=row=>{const k=row?JSON.stringify(row):"";if(k!==st.knowK){st.knowK=k;poke();}st.know=row||null;};
  api.setMe=(uid,dec)=>{if(st.me!==uid)poke();st.me=uid||null;st.dec=dec||{};};
  api.setSeatHex=arr=>{st.seatHex=arr&&arr.length?arr:null;};
  api.setFollow=on=>{st.follow=!!on;poke();};
  api.setSaver=on=>{st.saver=!!on;applySaver();};
  api.where=id=>{
    const pc=pieces[id];if(!st.ok||!pc)return null;
    const v=pc.g.position.clone();v.y+=pc.kind==="s"?.45:.55;v.project(camera);
    const r=R.domElement.getBoundingClientRect();
    return {x:r.left+(v.x+1)/2*r.width,y:r.top+(1-v.y)/2*r.height};
  };
  api.ready=()=>st.ok;
  return api;
})();
