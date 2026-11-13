import {eggSpeciesForItem256} from '../sim/animal-egg-content-v256';
import {ANIMAL_MEAT_ITEMS_256} from '../sim/animal-items-v256';
import {treeCargoKind,treeVisualParts,type TreeVisualTraits} from './tree-presentation';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import {blockParts} from './block-presentation';
import {chunkParts} from './chunk-presentation';
import {weaponVisual} from './weapon-shape';
import type {Placement} from './primitives';

/** Explicit visual order, independent of save IDs and insertion order. */
export const ITEM_VISUAL_IDS:readonly ItemId[]=Object.freeze((Object.keys(ITEM_DEFINITIONS) as ItemId[]).filter(id=>!id.endsWith('-corpse')).sort());
const cargoKinds=new Map(ITEM_VISUAL_IDS.map((item,ordinal)=>[item,200+ordinal] as const));
export const itemCargoKind=(item:ItemId):number=>item==='minified-tree'?treeCargoKind():cargoKinds.get(item)??0;

/** Local ground assembly, centred on X/Z; never owns mutable gameplay state. */
export function itemGeometry(item:ItemId,quantity:number=ITEM_DEFINITIONS[item].stackLimit,anchor?:{x:number;z:number},tree?:TreeVisualTraits):Placement[] {
  const definition=ITEM_DEFINITIONS[item],color=definition.color,parts:Placement[]=[];
  if(item.endsWith('-corpse'))return parts;
  if(item==='minified-tree')return centreItemParts(treeVisualParts(tree));
  const add=(shape:Placement['shape'],x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number=color,ry=0)=>parts.push({shape,x,y,z,sx,sy,sz,color:tint,ry});
  const box=(x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number=color,ry=0)=>add(undefined,x,y,z,sx,sy,sz,tint,ry);
  const round=(x:number,y:number,z:number,sx:number,sy:number,sz:number,tint:number=color)=>add('item-round',x,y,z,sx,sy,sz,tint);
  const amount=Math.max(.65,Math.min(1,quantity/Math.max(1,definition.stackLimit)));
  if(item==='novel'){
    // Original cardboard covers and paper leaves, shared by ground/cargo/portraits.
    box(0,.025,0,.42,.028,.32);box(-.095,.071,.005,.18,.064,.275,0xe7dfbe);box(.095,.071,.005,.18,.064,.275,0xe7dfbe);
    box(-.105,.116,0,.205,.024,.32);box(.105,.116,0,.205,.024,.32);box(-.203,.07,0,.024,.10,.32,0x776647);
    box(0,.134,.018,.15,.009,.16,0xe9dfbd);box(0,.140,.008,.09,.004,.012,0x4c4938);box(0,.140,.039,.065,.004,.009,0x4c4938);
  }else if(item==='prosthetic-arm'||item==='prosthetic-leg'||item==='unfinished-prosthetic'){
    // Original assembled limb, reused by ground, cargo and portrait batches.
    const leg=item==='prosthetic-leg',unfinished=item==='unfinished-prosthetic';
    box(0,.12,-.18,.18,.16,.32);box(0,.12,.15,.15,.14,.30);
    add('item-disc',0,.12,-.01,.21,.16,.21,0x586b70);
    box(0,.12,-.36,.23,.19,.09,0x6e7f82);
    if(!unfinished){box(0,.11,.35,leg?.23:.19,.12,leg?.25:.15);box(0,.205,-.18,.06,.025,.24,0xe0dfc6);}
    else{box(.19,.07,.16,.10,.10,.18,0x788a8e);box(-.18,.04,-.05,.09,.055,.14,0xb99a5d);}
  }else if(item==='beer'){
    const count=quantity===1?1:quantity<5?2:3;
    for(let i=0;i<count;i++){
      const x=(i-(count-1)/2)*.20,z=i%2*.08-.04;
      add('item-disc',x,.16,z,.16,.30,.16,0x7c6847);add('item-disc',x,.35,z,.075,.13,.075,0x8c8055);
      add('item-disc',x,.43,z,.09,.025,.09,0xc6c8a9);box(x,.17,z+.082,.11,.12,.012,0xe4d6a6);
    }
  }else if(item==='wort'){
    add('item-disc',0,.16,0,.43,.28,.43,0xa1aa8b);add('item-disc',0,.32,0,.45,.045,.45,0x6e8477);
    box(0,.355,0,.18,.05,.07,0xd1c6a0);box(0,.16,.215,.20,.12,.015,0xc4aa6c);
  }else if(item==='hops'){
    for(let i=0;i<5;i++){const a=i*2.4;add('item-nugget',Math.cos(a)*.16,.09+(i%2)*.09,Math.sin(a)*.14,.20,.17,.18,i%2?0x9fae6b:0xb7bf7d,a);}
    box(0,.055,0,.30,.025,.04,0x6c8d5b);
  }else if(item==='wood'){
    for(const [x,y,z,turn] of [[0,.075,-.09,-.035],[.01,.075,.09,.05],[-.015,.205,0,-.08]]){
      add('item-log',x!,y!,z!, .65*amount,.14,.14,color,turn);
      for(const side of [-1,1])add('item-log',x!+side*.324*amount*Math.cos(turn!),y!,z!-side*.324*amount*Math.sin(turn!),.008,.114,.114,0xc9ad77,turn);
    }
  }else if(definition.kind==='chunk')return centreItemParts(chunkParts(anchor?.x??0,anchor?.z??0,item));
  else if(definition.kind==='blocks')return centreItemParts(blockParts(anchor?.x??0,anchor?.z??0,item,Math.min(75,quantity)));
  else if(item==='steel'){
    add('item-nugget',-.12,.10,-.06,.39,.20,.31,color,.22);add('item-nugget',.16,.08,.07,.31,.16,.25,0x687c85,-.42);add('item-nugget',.02,.23,.01,.26,.20,.22,0x9cabb1,.35);
  }else if(item==='jade'){
    // Original faceted pieces, distinct from metal bars and cut blocks.
    add('item-nugget',-.12,.10,-.05,.32,.20,.29,color,.4);add('item-nugget',.15,.08,.08,.27,.16,.24,0x8bb7a1,-.3);add('item-nugget',0,.23,0,.23,.19,.20,0x689582,.1);
  }else if(item==='gold'||item==='plasteel'||item==='uranium'){
    for(const side of [-1,1])add('item-ingot',side*.15,.075,0,.25,.14,.44,color);
    add('item-ingot',0,.19,0,.27,.10,.40,color);
    if(item==='plasteel')for(const x of [-.075,.075])box(x,.245,0,.025,.018,.35,0xc3dedc);
  }else if(item==='silver'){
    for(const [x,z,h] of [[-.18,-.06,.06],[.06,-.1,.1],[.15,.13,.045],[-.10,.16,.035]])add('item-disc',x!,h!/2,z!, .20,h!, .20,color);
  }else if(definition.kind==='weapon'||item==='unfinished-bow'||item==='unfinished-gun'||item==='unfinished-knife'||item==='unfinished-mace'||item==='unfinished-longsword'||item==='unfinished-spear'){
    const weapon=weaponVisual(item==='unfinished-bow'?'short-bow':item==='unfinished-gun'?'bolt-action-rifle':item==='unfinished-knife'?'plasteel-knife':item==='unfinished-mace'?'steel-mace':item==='unfinished-longsword'?'steel-longsword':item==='unfinished-spear'?'steel-spear':item);
    for(const [index,p] of (weapon?.parts??[]).entries()){
      // The knife blank has no sharpened point or fitted guard yet. Its broad
      // blade and bare tang reuse the original authored knife dimensions.
      if(item==='unfinished-knife'&&(index===1||index===3))continue;
      if(item==='unfinished-mace'&&index!==0&&index!==2)continue;
      if(item==='unfinished-longsword'&&index!==0&&index!==4)continue;
      if(item==='unfinished-spear'&&index!==0&&index!==5)continue;
      // The bow blank is the bare stave: no grip wrap, no string yet.
      if(item==='unfinished-bow'&&(index===0||index===7))continue;
      box(p.center[0]!, .07+p.center[2]!,p.center[1]!,p.size[0]!,p.size[2]!,p.size[1]!,item==='unfinished-bow'||item==='unfinished-gun'||item==='unfinished-knife'||item==='unfinished-mace'||item==='unfinished-longsword'||item==='unfinished-spear'?color:p.color);
    }
  }else if(item.endsWith('-plate-armor')||item==='unfinished-plate-armor'){
    add('item-vest',0,.13,0,.65,.24,.68,color);for(const side of [-1,1]){box(side*.28,.20,-.16,.21,.14,.24);box(side*.18,.08,.36,.24,.11,.28);}box(0,.27,.04,.22,.035,.29,0xb6bba7);
  }else if(item.endsWith('-simple-helmet')||item==='unfinished-simple-helmet'){
    add('item-helmet',0,.15,0,.39,.30,.37,color);add('item-disc',0,.04,.01,.46,.025,.40,color);box(0,.18,.13,.025,.18,.10,0xb6bba7);
  }else if(definition.kind==='apparel'||/^unfinished-(shirt|pants|tribalwear|duster|parka|tuque|flak|recon)/.test(item)){
    if(item.endsWith('tuque')){add('item-helmet',0,.15,0,.36,.27,.34);add('item-disc',0,.045,0,.41,.07,.38);return centreItemParts(parts);}
    const recon=item.endsWith('recon-armor'),pants=item.endsWith('pants'),helmet=item.endsWith('helmet'),coat=item.endsWith('duster')||item.endsWith('parka'),vest=item.endsWith('vest')||item.endsWith('tribalwear');
    add(helmet?'item-helmet':pants?'item-pants':coat?'item-coat':vest?'item-vest':'item-shirt',0,helmet?.15:.055,0,helmet?.38:.65,helmet?.30:.085,helmet?.38:coat?.78:.66,color);
    if(recon){for(const side of [-1,1]){box(side*.18,.15,.06,.20,.09,.35,0x536a74);box(side*.29,.10,-.20,.16,.12,.19);}box(0,.15,-.16,.18,.07,.18,0xc0d0ce);}
    if(item.endsWith('parka'))add('item-helmet',0,.12,-.28,.22,.17,.20,0xc7ba9d);
    if(item.endsWith('duster'))for(const side of [-1,1])add('item-leaf',side*.08,.11,-.24,.13,.025,.20,0x9b825f,side*.35);
    if(item.endsWith('vest')&&!item.endsWith('tribalwear'))for(const side of [-1,1])add('item-ingot',side*.09,.12,0,.16,.04,.34,0x48594f);
    if(item.endsWith('recon-helmet')){box(0,.16,.18,.30,.065,.05,0x344a57);for(const side of [-1,1])box(side*.17,.08,.10,.06,.15,.16,0x657d84);}
    else if(helmet)add('item-disc',0,.04,.01,.45,.025,.39,0x424e51);
  }else if(definition.kind==='textile'){
    if(item==='cloth'){box(0,.045,.04,.48,.065,.36);add('item-log',0,.13,-.12,.49,.19,.19);}
    else if(item.includes('wool')){round(-.13,.1,0,.25,.20,.25);round(.13,.1,0,.25,.20,.25);round(0,.22,0,.25,.20,.25);}
    else {add('item-leaf',0,.04,0,.58,.065,.65);add('item-leaf',.04,.095,.02,.50,.045,.56,color,.24);}
  }else if(item==='herbal-medicine'){
    for(const [x,z,turn] of [[-.15,0,-.4],[.12,0,.4],[0,-.12,0],[0,.12,Math.PI]])add('item-leaf',x!,.07,z!, .22,.06,.40,color,turn);
    box(0,.095,.04,.29,.025,.055,0xc5ab79);
  }else if(item==='medicine'||item==='glitterworld-medicine'||item==='neutroamine'||item==='milk'){
    if(item==='glitterworld-medicine'){
      box(0,.055,0,.48,.08,.28,0xe1e3d6);add('item-disc',-.04,.16,0,.12,.15,.12,color);box(.13,.105,0,.16,.04,.055,0x748c91);box(.24,.105,0,.07,.012,.015,0xc4d5d6);
    }else for(const x of [-.12,.12]){
      add('item-disc',x,.13,0,item==='milk'?.18:.13,.23,item==='milk'?.18:.13,color);
      add('item-disc',x,.265,0,.09,.07,.09,0xd8ddcf);add('item-disc',x,.308,0,.10,.022,.10,item==='milk'?0x7798b1:0x647f88);
    }
  }else if(item==='chemfuel'){
    box(0,.16,0,.30,.30,.28);box(.07,.33,-.07,.08,.07,.09,0x687c60);
    for(const x of [-.10,.02])box(x,.35,.03,.035,.08,.045,0x596e5b);box(-.04,.40,.03,.15,.025,.045,0x596e5b);
  }else if(item.includes('component')){
    if(item==='advanced-component'){
      box(0,.055,0,.38,.075,.31,0x52696a);box(0,.13,0,.22,.09,.20);for(const x of [-.07,0,.07])box(x,.19,0,.025,.06,.20,0xd2dbd5);
      for(const side of [-1,1])for(const z of [-.10,0,.10])box(side*.22,.06,z,.09,.025,.035,0xc3ac65);
    }else{
      add('item-disc',-.08,.075,0,.31,.09,.31);for(let i=0;i<6;i++){const a=i*Math.PI/3;box(-.08+Math.cos(a)*.17,.075,Math.sin(a)*.17,.08,.065,.07,color,a);}
      add('item-disc',-.08,.13,0,.09,.025,.09,0x52686c);box(.18,.07,.07,.15,.10,.20,0x71928b);
    }
  }else if(item==='unfinished-sculpture'){
    add('item-nugget',0,.19,0,.40,.38,.34);add('item-ingot',0,.055,0,.46,.11,.42);
  }else if(eggSpeciesForItem256(item)){
    // Original oval shells reuse the resident round mesh, never the meal plate.
    for(const [x,y,z] of [[-.13,.14,-.06],[.13,.14,.06],[0,.35,0]])round(x!,y!,z!,.23,.28,.20,color);
  }else if((ANIMAL_MEAT_ITEMS_256 as readonly string[]).includes(item)){
    // New meat has no invented legacy hare bone or species-index fallback.
    add('item-nugget',-.07,.11,0,.44,.20,.31,color,.20);
    add('item-nugget',.15,.09,.08,.27,.15,.25,color,-.35);
  }else if(item.endsWith('-meat')){
    const species=['hare','snow-hare','deer','muffalo','gazelle','dromedary','red-fox'].indexOf(item.replace('-meat',''));
    add('item-nugget',-.05,.10,0,.42,.18,.29,color,.15+species*.13);
    if(species<2||species===6){add('item-log',.19,.09,.04,.29,.09,.09,0xe2d4b5,-.3);round(.32,.09,.08,.08,.09,.10,0xe2d4b5);}
    else {add('item-disc',.07,.20,.02,.19,.035,.17,0xe2c9b6);add('item-disc',.07,.221,.02,.09,.009,.075,0x9d5149);}
    if(species===3||species===5)add('item-nugget',-.14,.22,-.02,.25,.15,.23,color,-.4);
  }else if(item==='berries'){
    for(const [x,y,z] of [[-.15,.07,-.08],[.05,.08,-.13],[.17,.08,.04],[-.09,.08,.12],[.03,.20,.01]])round(x!,y!,z!,.16,.15,.16);
    add('item-leaf',0,.25,-.04,.16,.025,.20,0x61834d,.4);
  }else if(item==='potato'){
    for(const [x,y,z,a] of [[-.14,.09,-.06,.3],[.13,.09,.01,-.3],[0,.22,.06,.8]])add('item-nugget',x!,y!,z!,.27,.18,.22,color,a);
  }else if(item==='hay'){
    // Eight long straw bundles retain a broken, fibrous outline; the bindings
    // surround the real volume instead of drawing stripes on a solid block.
    for(let layer=0;layer<2;layer++)for(let strand=0;strand<4;strand++){
      const turn=(strand%2?1:-1)*.035;
      add('item-log',(strand%2?1:-1)*.018,.063+layer*.085,(strand-1.5)*.10,
        (.64+(strand%3)*.035)*amount,.08,.115,strand%2?color:0xc8b66a,turn);
    }
    for(const x of [-.17,.17]){
      box(x,.204,0,.026,.020,.425,0x8b7952);box(x,.018,0,.026,.020,.425,0x8b7952);
      for(const side of [-1,1])box(x,.111,side*.211,.026,.186,.018,0x8b7952);
    }
  }else if(item==='kibble'){
    // Separate squat pellets, with an exposed lower ring and two upper layers.
    // The fixed assembly shares resident disc meshes with ground and cargo.
    for(let i=0;i<14;i++){
      const layer=i<8?0:i<12?1:2,index=i<8?i:i<12?i-8:i-12;
      const angle=index*2.4+layer*.6,radius=layer===0?.18:layer===1?.083:.043;
      add('item-disc',Math.cos(angle)*radius,.052+layer*.071,Math.sin(angle)*radius,
        .11,.082,.105,i%3===0?0xb9915d:i%3===1?color:0x8f704a,angle);
    }
  }else if(item==='rice'){
    for(let i=0;i<7;i++){const a=i*2.4,r=i<5?.17:.06;add('item-round',Math.cos(a)*r,.055+(i>4?.075:0),Math.sin(a)*r,.15,.075,.085,color,a);}
  }else if(item==='corn'){
    for(const z of [-.10,.10]){add('item-log',0,.09,z,.44,.14,.14,color,.13);add('item-leaf',-.04,.04,z,.50,.045,.14,0x78914c,.13);}
    for(const x of [-.14,0,.14])round(x,.17,-.10,.045,.035,.08,0xf0cf62);
  }else if(item==='agave-fruit'){
    round(0,.15,0,.37,.29,.34);for(let i=0;i<4;i++)add('item-leaf',Math.sin(i*Math.PI/2)*.09,.31,Math.cos(i*Math.PI/2)*.09,.11,.035,.30,0x5e8252,i*Math.PI/2);
  }else if(item==='pemmican'){
    // Original dried meat/grain pieces. Ground, cargo and portraits reuse
    // existing resident nugget/disc shapes; no per-unit objects or new mesh.
    for(let i=0;i<5;i++){
      const a=i*2.4,r=i===4?.035:.15;
      add('item-nugget',Math.cos(a)*r,.07+(i===4?.10:0),Math.sin(a)*r,.23,.12,.18,color,a);
    }
    for(const [x,z] of [[-.15,.04],[.09,-.13],[.10,.14]])add('item-disc',x!, .14,z!,.065,.035,.052,0xd1b173,.3);
  }else if(item==='survival-meal'){
    for(const x of [-.12,.12]){add('item-ingot',x,.06,0,.22,.09,.35);box(x,.115,-.15,.23,.025,.035,0x7f8657);}
  }else {
    // Plates carry separate physical portions. Richness and vegetarian/meat
    // recipes change the assembly itself, not a pattern painted on a cube.
    const lavish=item.includes('lavish'),paste=item==='nutrient-paste-meal',carnivore=item.startsWith('carnivore'),vegetarian=item.startsWith('vegetarian');
    add('item-disc',0,.035,0,lavish?.61:.53,.055,lavish?.53:.45,0xd8d4bd);
    if(paste){for(const x of [-.11,.11])round(x,.09,0,.20,.075,.28,color);}
    else{
      if(!carnivore)for(const [x,z] of [[-.12,-.04],[-.03,.12]])round(x!,.10,z!,.20,.10,.17,0xd9c695);
      if(!vegetarian)add('item-nugget',.12,.10,.02,.22,.12,.24,0xad6651);
      if(item!=='simple-meal'&&item!=='legacy-portion')for(const z of [-.10,.09])add('item-leaf',vegetarian?.11:-.11,.14,z,.16,.045,.15,0x6d914d,.3);
      if(lavish){round(.05,.19,-.13,.11,.11,.10,0xc48448);round(-.16,.17,.05,.10,.10,.10,0xb36759);}
    }
  }
  return centreItemParts(parts);
}

/** Bounds include the legacy rock radius (1), while new meshes use unit width. */
export function centreItemParts(parts:Placement[],centreY=false):Placement[] {
  let loX=Infinity,hiX=-Infinity,loY=Infinity,hiY=-Infinity,loZ=Infinity,hiZ=-Infinity;
  for(const p of parts){const c=Math.abs(Math.cos(p.ry??0)),s=Math.abs(Math.sin(p.ry??0)),r=p.shape==='rounded-rock'?1:.5;
    const x=r*(c*(p.sx??1)+s*(p.sz??1)),z=r*(s*(p.sx??1)+c*(p.sz??1));
    loX=Math.min(loX,p.x-x);hiX=Math.max(hiX,p.x+x);loZ=Math.min(loZ,p.z-z);hiZ=Math.max(hiZ,p.z+z);loY=Math.min(loY,p.y-r*(p.sy??1));hiY=Math.max(hiY,p.y+r*(p.sy??1));}
  if(Number.isFinite(loX))for(const p of parts){p.x-=(loX+hiX)/2;p.z-=(loZ+hiZ)/2;if(centreY)p.y-=(loY+hiY)/2;}
  return parts;
}
