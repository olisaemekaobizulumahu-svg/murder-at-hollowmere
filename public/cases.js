/* The detective engine handles 18 anonymous card slots. A case supplies fresh story and art direction for those slots. */
(function(root){"use strict";
const CASES=[
{id:"hollowmere",title:"Murder at Hollowmere",tagline:"At 11:47, the grandfather clock fell silent.",place:"Hollowmere Manor",opening:"Great-Uncle Ambrose called his family to hear a final change to his will. A storm cut the road. By midnight he was dead, and every guest told a different story.",ending:"The hall clock begins to chime again. The family gathers before the sealed evidence is opened.",theme:"manor"},
{id:"express",title:"Death on the Midnight Express",tagline:"A final whistle, a vanished ticket, one locked carriage.",place:"The Nocturne Express",opening:"The midnight express ran through the mountain pass with eight inches of snow on the tracks. When its celebrated patron was found dead, the conductor locked the doors. Nobody could board or leave.",ending:"The train emerges into a pale dawn as the final accusation echoes through the carriage.",theme:"train",names:{s:["Lady Clarissa Vale","Porter Elias Finch","Countess Mireille","Engineer Felix Marsh","Author Ada Bell","Chef Marcel Quinn"],m:["Nightcap Tonic","Truffle Bisque","Signal Hook","Ceremonial Sabre","Locked Bee Case","Carriage Coupler"],r:["Observation Car","Dining Coach","Luggage Attic","Station Platform","Piano Lounge","First-Class Corridor"]}},
{id:"masquerade",title:"The Masquerade Murder",tagline:"Behind every mask lies another alibi.",place:"Ravensgate Ballroom",opening:"An invitation with no signature drew the elite to the masquerade. At the final waltz the chandeliers dimmed; when the lights returned the host lay motionless beyond the mirrored doors.",ending:"Masks fall one by one as the ballroom orchestra falls silent.",theme:"ball",names:{s:["Lady Ophelia Vane","Lord Cassian Reed","Dowager Isolde","Master Benedict","Dancer Seraphine","Steward Lucien"],m:["Spiced Chocolate","Forbidden Broth","Silver Scissors","Dueling Rapier","Venomous Insects","Crushed Music Box"],r:["Winter Garden","Champagne Vault","Costume Loft","Moonlit Terrace","Grand Ballroom","Mirror Gallery"]}},
{id:"blackthorn",title:"Secrets of Blackthorn Island",tagline:"The sea remembers what the island hides.",place:"Blackthorn Island",opening:"A violent squall stranded a party of strangers at the island lighthouse. The keeper never returned from his final round, and the only boat drifted back without its oars.",ending:"A lighthouse beam cuts the fog while the truth is finally spoken aloud.",theme:"island",names:{s:["Captain Elara Flint","Financier Rowan Hale","Healer Miriam Frost","Inventor Dorian Pike","Journalist Isla Quinn","Caretaker Jonah Wren"],m:["Bitter Sea Tea","Wild Fungus Stew","Rusty Pruning Blade","Mariner's Sword","Hornet Nest","Iron Clock Weight"],r:["Glasshouse","Smuggler's Cellar","Lighthouse Loft","Tide Boathouse","Radio Room","Ancestral Hall"]}}
];
const CASE_NOTES={
 express:{
  s:[
   "The patron's niece booked a private compartment and changed it twice. She insists she never entered the observation car.",
   "The night porter collected every ticket but one. His ledger contains a smudged mark he cannot account for.",
   "A countess travelled under a borrowed surname. Her velvet glove was recovered far from her cabin.",
   "The engineer disputed a sudden halt on the mountain line. His pocket watch runs seven minutes fast.",
   "A celebrated crime novelist filled three pages with details of the journey before the body was found.",
   "The chef prepared a special midnight menu for one passenger. He won't say who asked for the change."
  ],
  m:[
   "A glass of the patron's usual tonic was left half-finished. The receipt for its ingredients has vanished.",
   "The truffle bisque arrived at the table without its usual silver cover; the kitchen staff remember conflicting orders.",
   "A brass signal hook went missing from the conductor's cabinet. Its chain was discovered neatly coiled.",
   "A ceremonial sabre from the dining coach display was found on a different wall than usual.",
   "A sealed travel case marked FRAGILE contained angry insects; nobody agrees on its original owner.",
   "The carriage coupler was examined after a jolt in the night. One bolt was newly polished."
  ],
  r:[
   "The observation windows look down on a black ravine. A frost-covered latch suggests someone opened a window.",
   "The dining coach's tablecloth bears a folded corner, as though an urgent search was interrupted.",
   "Several luggage trunks were shifted in the overhead loft. A ribbon trails from the highest shelf.",
   "The platform was nearly deserted. Footprints appear to turn back before reaching the signal lamp.",
   "A piano in the lounge played a single dissonant note after the final service call.",
   "The first-class corridor mirrors show a blurred reflection no passenger admits to seeing."
  ]
 },
 masquerade:{
  s:[
   "The lady of the house wore a silver mask and carried an unsealed invitation with a name crossed out.",
   "A young lord had borrowed money against an inheritance the host threatened to revoke.",
   "The dowager remembered a family scandal from twenty years before and arrived with its last surviving letter.",
   "A masked gentleman insisted the chandeliers were tampered with earlier that evening.",
   "The leading dancer disappeared between two waltzes and returned wearing a different ribbon.",
   "The household steward knows every key in the ballroom, but one key ring was found empty."
  ],
  m:[
   "A cup of spiced chocolate was served from a tray for a single guest, although the servants had counted six cups.",
   "A forbidden broth in a silver tureen was taken to the kitchens before midnight; no one witnessed its return.",
   "Silver scissors used for costume alterations disappeared beside a dressing-room mirror.",
   "A stage rapier from the masked entertainment was found beside an unused chair.",
   "A box of stinging insects appears in the masquerade inventory but not among the delivered decorations.",
   "A delicate music box stopped mid-tune and its damaged mechanism was wrapped in velvet."
  ],
  r:[
   "Moonlit vines crowd the winter garden. The terrace doors were found unlocked despite the evening's rain.",
   "Champagne bottles line the vault. One narrow gap in the dust looks much newer than the rest.",
   "A cloak stitched with golden thread lies in the costume loft where nobody admits leaving it.",
   "An empty lantern was discovered on the terrace overlooking the sleeping city.",
   "The orchestra paused as the ballroom chandelier dimmed, then resumed to find one dancer missing.",
   "The mirror gallery reflects a dozen doors and makes it impossible to agree on which way anyone left."
  ]
 },
 blackthorn:{
  s:[
   "The captain carries a torn harbour chart and refuses to discuss her last trip to Blackthorn.",
   "A financier financed the lighthouse repairs, then cancelled the final payment without explanation.",
   "The island healer prepared a sleeping draught for the keeper but insists it was never delivered.",
   "An inventor installed a faulty warning bell that rang twice when the storm reached the shore.",
   "A journalist came searching for a shipwreck story and found that her source had stopped writing.",
   "The caretaker had access to the lighthouse storehouse and an argument about supplies remained unresolved."
  ],
  m:[
   "A pot of bitter sea tea stood cooling in a locked room; its scent was sharper than usual.",
   "Wild fungus stew was prepared for the storm-bound visitors from ingredients found on the island path.",
   "A rusting pruning blade from the glasshouse was recently cleaned and returned to the wrong shelf.",
   "A mariner's sword hung above an old rescue medal. The wall behind it bears a fresh mark.",
   "A hornet nest fell from a roofbeam under suspicious circumstances, though the keeper had warned everyone away.",
   "A heavy clock weight was discovered near the stairs. The chain above it no longer reaches its hook."
  ],
  r:[
   "The island glasshouse smells of salt and wet soil. Its door will not latch unless forced.",
   "The smuggler's cellar has an unmarked passage and barrels that have been moved since last winter.",
   "From the lighthouse loft, a lantern shone seaward long after the keeper's shift had ended.",
   "The tide boathouse contained a rope tied in an unfamiliar knot beside the missing oars.",
   "The radio room held a half-written distress message and no record of a successful transmission.",
   "An ancestral hall preserves island portraits whose brass nameplates have been mysteriously switched."
  ]
 }
};
for(const c of CASES)if(CASE_NOTES[c.id])c.notes=CASE_NOTES[c.id];
const BY_ID=Object.fromEntries(CASES.map(c=>[c.id,c]));
const ids={s:["philippa","rupert","beatrice","desmond","imogen","hollis"],m:["cocoa","soup","shears","foil","wasps","clock"],r:["greenhouse","cellar","attic","boathouse","music","gallery"]};
function displayCase(c){const out=c&&c.names?c.names:{};const names={};for(const k of Object.keys(ids)){(out[k]||[]).forEach((n,i)=>{if(ids[k][i])names[ids[k][i]]=n;});}return names;}
function noteFor(c,id){if(!c||!c.notes)return null;for(const k of Object.keys(ids)){const i=ids[k].indexOf(id);if(i>=0)return c.notes[k]&&c.notes[k][i]||null;}return null;}
const api={CASES,BY_ID,ids,displayCase,noteFor};if(typeof module==="object"&&module.exports)module.exports=api;else root.HMCASES=api;
})(typeof self!=="undefined"?self:this);
