/* Murder at Hollowmere: the cards and the rules both the server and the page use. */
(function(root){
"use strict";
const SUSPECTS=[
  {id:"philippa",name:"Aunt Philippa",short:"Philippa",icon:"👒",note:"For three decades she ran Hollowmere as though it were her own. When Ambrose announced a new will, Philippa was the first to ask who would hold the keys."},
  {id:"rupert",name:"Cousin Rupert",short:"Rupert",icon:"🎩",note:"Rupert arrives with impeccable manners and creditors close behind. He claims the trip was sentimental, but a folded demand letter says otherwise."},
  {id:"beatrice",name:"Nana Beatrice",short:"Beatrice",icon:"🧶",note:"Ambrose's younger sister remembers every family slight. A quarrel from decades ago still shadows their dinners, though she insists the past is buried."},
  {id:"desmond",name:"Uncle Desmond",short:"Desmond",icon:"🔧",note:"Desmond builds peculiar machines and tells anyone who will listen that Ambrose stole his best idea. He speaks of justice with unsettling precision."},
  {id:"imogen",name:"Cousin Imogen",short:"Imogen",icon:"✒️",note:"Imogen writes mysteries for a living. Her notebook is full of observations about the family—but is she studying a plot or rehearsing one?"},
  {id:"hollis",name:"Hollis",short:"Hollis",icon:"🍳",note:"Hollis prepares every meal and overhears every argument. He knows which guests came downstairs late, and he is remarkably selective about what he remembers."}
];
const METHODS=[
  {id:"cocoa",name:"Poisoned Cocoa",short:"Cocoa",icon:"☕",note:"A favourite evening drink went untouched on the landing. The faint bitter aroma may be ordinary cocoa—or a detail worth questioning."},
  {id:"soup",name:"Mushroom Soup",short:"Soup",icon:"🍄",note:"A soup made from ingredients gathered near the woods was served at supper. Nobody agrees who tasted it first."},
  {id:"shears",name:"Garden Shears",short:"Shears",icon:"✂️",note:"An old pair of garden shears vanished from the potting shed. The gardener claims they were there at dusk."},
  {id:"foil",name:"Fencing Foil",short:"Foil",icon:"🤺",note:"The ceremonial fencing foil normally hangs above the trophies. Its blunt tip was later found where it did not belong."},
  {id:"wasps",name:"Jar of Wasps",short:"Wasps",icon:"🐝",note:"A glass jar sat where the groundskeeper swore he had left none. At Hollowmere, even the smallest creature can become a threat."},
  {id:"clock",name:"Grandfather Clock",short:"Clock",icon:"🕰️",note:"The tall clock stopped at 11:47. Its carved oak case bears a fresh mark, and the pendulum hangs unnaturally still."}
];
const ROOMS=[
  {id:"greenhouse",name:"Greenhouse",short:"Greenhouse",icon:"🌿",note:"Moonlight catches the glass roof and the orchids below. Wet soil, unlocked doors and a trail of footprints make every path suspect."},
  {id:"cellar",name:"Wine Cellar",short:"Cellar",icon:"🍷",note:"Below the kitchen, old vintages line stone shelves. A single gap in the dust suggests someone visited after the lamps were put out."},
  {id:"attic",name:"Attic",short:"Attic",icon:"🕸️",note:"Under the eaves, forgotten trunks hold letters, portraits and family secrets. One lid stands open, as though the search was interrupted."},
  {id:"boathouse",name:"Boathouse",short:"Boathouse",icon:"🛶",note:"A narrow path leads to a damp boathouse beside the black lake. The rowing boat was not secured where the keeper remembers leaving it."},
  {id:"music",name:"Music Room",short:"Music Room",icon:"🎻",note:"A piano chord was heard late in the evening, though every guest denies playing. Heavy curtains keep the room unusually quiet."},
  {id:"gallery",name:"Portrait Gallery",short:"Gallery",icon:"🖼️",note:"Generations of Hollowmeres stare from their frames. Ambrose's portrait hangs askew, its brass hook scratched against the plaster."}
];
const CARD={};
[["s",SUSPECTS],["m",METHODS],["r",ROOMS]].forEach(([k,l])=>l.forEach(c=>{c.k=k;CARD[c.id]=c;}));
const ALL=[...SUSPECTS,...METHODS,...ROOMS].map(c=>c.id);
const DETECTIVES=[
 {id:"blackwood",name:"Inspector Arthur Blackwood",title:"The Methodical Investigator",icon:"🕵️",bio:"An inspector who believes every crime leaves a pattern. He distrusts grand speeches and trusts small inconsistencies."},
 {id:"ashford",name:"Lady Evelyn Ashford",title:"The Social Strategist",icon:"🎭",bio:"A society insider who remembers what people said—and what they were careful not to say."},
 {id:"crowe",name:"Dr. Sebastian Crowe",title:"The Forensic Mind",icon:"🔍",bio:"A physician fascinated by physical evidence, odd timelines and the limits of certainty."},
 {id:"whitmore",name:"Miss Beatrice Whitmore",title:"The Fearless Investigator",icon:"🗝️",bio:"An independent investigator who asks the uncomfortable question nobody else dares to voice."},
 {id:"graves",name:"Professor Edmund Graves",title:"The Archivist",icon:"📚",bio:"An antiquarian whose memory for old letters and family histories makes him formidable."},
 {id:"noir",name:"Madame Celeste Noir",title:"The Observer",icon:"🌙",bio:"An astute reader of people who notices hesitation, deflection and carefully rehearsed answers."},
 {id:"sterling",name:"Mr. Nathaniel Sterling",title:"The Interrogator",icon:"⚖️",bio:"A former barrister who follows contradictions through even the most polished alibis."},
 {id:"ravenscroft",name:"Duchess Victoria Ravenscroft",title:"The Keen Eye",icon:"🦉",bio:"A sharp-eyed traveller and collector who rarely misses a detail in a crowded room."}
];
const DETECTIVE_BY_ID=Object.fromEntries(DETECTIVES.map(d=>[d.id,d]));
const OPENINGS=[
 {title:"The Clock That Would Not Chime",text:"At precisely 11:47, the grandfather clock fell silent. Rain scraped the windows. When the family gathered in the hall, Ambrose was gone—and somebody had already begun rearranging the truth."},
 {title:"A Will Written in Red Ink",text:"Ambrose had summoned his relatives to witness one last amendment to his will. Before the ink could dry, the master of Hollowmere was dead. Every guest remembers a different version of the evening."},
 {title:"The Last Light in the Gallery",text:"Someone saw a lantern pass the Portrait Gallery after eleven. Someone else insists the house was dark. By midnight, the doors were bolted and the family had turned upon itself."},
 {title:"A House Full of Alibis",text:"Thunder rolled over the lake as Ambrose's guests gathered for supper. By morning the manor would be full of stories, but none of them quite agreed."}
];
const MAX_SEATS=8;

/* everyone who holds cards, in seat order; Fennimore the butler sits last */
function holdersOf(g){return [...(g.order||[]),...(g.butler?["butler"]:[])];}
/* the next detective still in the running */
function nextTurn(g,from){
  const o=g.order||[],i=o.indexOf(from);
  for(let k=1;k<=o.length;k++){const u=o[(i+k)%o.length];if(!(g.out&&g.out[u]))return u;}
  return null;
}
/* who answers a question, in seat order from the asker's left; players who left are skipped */
function queueFor(g,asker){
  const o=g.order||[],i=o.indexOf(asker),q=[];
  for(let k=1;k<o.length;k++){const u=o[(i+k)%o.length];if(g.left&&g.left[u])continue;q.push(u);}
  if(g.butler)q.push("butler");
  return q;
}
/* whose move it is right now */
function actor(g){
  if(!g||g.status!=="playing")return null;
  if(g.phase==="turn"||g.phase==="asked")return g.turn;
  if(g.phase==="asking")return g.q&&g.q.queue[g.q.step];
  if(g.phase==="judging")return g.acc?g.acc.by:null;
  return null;
}
const matches=(hand,cards)=>cards.filter(c=>(hand||[]).includes(c));
function seated(g){
  return Object.entries(g.players||{}).filter(([,p])=>p).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0)).map(([u])=>u);
}
/* a question or accusation names one relative, one method and one room, in that order */
function validTrio(cards){
  return Array.isArray(cards)&&cards.length===3&&["s","m","r"].every((k,i)=>CARD[cards[i]]&&CARD[cards[i]].k===k);
}

const HM={SUSPECTS,METHODS,ROOMS,DETECTIVES,DETECTIVE_BY_ID,OPENINGS,CARD,ALL,MAX_SEATS,holdersOf,nextTurn,queueFor,actor,matches,seated,validTrio};
if(typeof module==="object"&&module.exports)module.exports=HM;
else root.HM=HM;
})(typeof self!=="undefined"?self:this);
