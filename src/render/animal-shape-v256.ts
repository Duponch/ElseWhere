import {animalCore256,isAnimalSpecies256} from '../sim/animal-core-v256.ts';
import type {AnimalSpeciesId256} from '../sim/animal-core-data-v256.ts';
import {CORE_ANIMAL_BODIES_256} from '../sim/animal-anatomy-data-v256.ts';
import {animalPartId256} from '../sim/animal-anatomy-v256.ts';
import type {BodyPartId} from '../sim/body-definition.ts';
import type {HarePart} from './hare-shape';
import type {AnimalCoreRing} from './animal-shape';
type Family='hoof'|'bear'|'cat'|'dog'|'rodent'|'bird'|'snake'|'turtle'|'monkey'|'elephant'|'rhino'|'boar'|'insect';
/** Original shape decisions, not measured Core meshes or copied silhouettes.
 * Adult scale follows the species size; ratios/colours express our3D language. */
const forms:Readonly<Record<AnimalSpeciesId256,readonly [Family,number,number,number,number]>>={
 goat:['hoof',.48,.66,1.06,0xc5bcaa],pig:['boar',.71,.48,1.26,0xd8aaa0],thrumbo:['hoof',.78,.95,1.58,0xe1dfd7],
 megascarab:['insect',.77,.19,.96,0x9da78e],spelopede:['insect',.52,.24,1.64,0xa39782],megaspider:['insect',.94,.34,1.31,0x858f9b],
 cat:['cat',.42,.34,.88,0xb3a18b],'yorkshire-terrier':['dog',.38,.31,.80,0x9f927b],'labrador-retriever':['dog',.51,.51,1.10,0xb6a384],husky:['dog',.48,.56,1.13,0x9aa09b],
 alpaca:['hoof',.48,.72,1.10,0xc7bba5],'grizzly-bear':['bear',.78,.64,1.38,0x897665],'polar-bear':['bear',.78,.69,1.48,0xd7d8ce],bison:['hoof',.80,.64,1.36,0x847b71],boomalope:['hoof',.53,.62,1.18,0xa6a082],boomrat:['rodent',.37,.25,.73,0xa59b83],capybara:['rodent',.53,.38,.98,0x9b8b73],caribou:['hoof',.53,.69,1.10,0x9e9685],cassowary:['bird',.49,.73,.77,0x6c7c7c],chinchilla:['rodent',.47,.34,.69,0xaaa9a4],cobra:['snake',.15,.13,1.65,0x8c9875],cougar:['cat',.49,.48,1.22,0xb9a382],donkey:['hoof',.51,.73,1.20,0xaaa79b],duck:['bird',.51,.28,.77,0xaaa997],elephant:['elephant',.90,.85,1.47,0xa0a49c],elk:['hoof',.59,.79,1.20,0x9c8a72],emu:['bird',.48,.86,.84,0x9c9a8d],'arctic-fox':['dog',.40,.41,.94,0xe0dfd2],'fennec-fox':['dog',.42,.42,.91,0xcbb68e],'guinea-pig':['rodent',.49,.27,.73,0xb5a08e],horse:['hoof',.51,.83,1.36,0x978577],ibex:['hoof',.49,.63,1.01,0xa59277],iguana:['turtle',.35,.19,1.05,0x94a079],lynx:['cat',.54,.47,.98,0xaaa18a],megasloth:['bear',.87,.67,1.51,0x9c947b],monkey:['monkey',.39,.52,.73,0xa08f79],ostrich:['bird',.51,.98,.91,0x908f88],panther:['cat',.47,.48,1.23,0x626c68],raccoon:['rodent',.46,.40,.94,0x9c9d93],rat:['rodent',.37,.22,.73,0x96968b],rhinoceros:['rhino',.82,.65,1.46,0xaaa99b],squirrel:['rodent',.38,.31,.72,0xb19a7a],tortoise:['turtle',.72,.28,.83,0x9a9a79],turkey:['bird',.60,.58,.82,0x9c9585],warg:['dog',.60,.59,1.26,0x888b80],'wild-boar':['boar',.66,.45,1.13,0x968a78],'arctic-wolf':['dog',.48,.57,1.14,0xd1d4ca],'timber-wolf':['dog',.50,.58,1.17,0x92998c],yak:['hoof',.73,.65,1.30,0x958c7c]
};
export const animalShapeFamily256=(species:string):Family|undefined=>isAnimalSpecies256(species)?forms[species][0]:undefined;
export function animalShape256(species:AnimalSpeciesId256):{rings:readonly AnimalCoreRing[];headPivot:readonly [number,number,number];parts:readonly HarePart[]} {
 const [family,bw,legHeight,length,tint]=forms[species],definition=animalCore256(species),scale=Math.cbrt(definition.race.baseBodySize),body=definition.race.body,rows=CORE_ANIMAL_BODIES_256[body];
 if(family==='insect')return insectShape256(species,body,scale,bw,legHeight,length,tint);
 const w=bw*scale,l=length*scale,leg=legHeight*scale,h=(family==='bird'?.55:family==='snake'?.14:family==='turtle'?.32:family==='bear'?.64:.46)*scale;
 const find=(defs:readonly string[],fallback:BodyPartId='torso')=>{const row=rows.find(row=>defs.includes(row.defId));return row?animalPartId256(body,row.index):fallback;};
 const head=find(['Head','HeadWithEarHoles','SnakeHead']),neck=find(['Neck']),mouth=find(['AnimalJaw','SnakeMouth','Beak','TurtleBeak'],'head');
 const headY=family==='snake'?h*.9:family==='turtle'?leg+h*.4:leg+h+(family==='bird'?.36:.12)*scale,headZ=l*.47;
 const headPivot:HarePart['pivot']=[0,leg+h*.6,l*.28],rings:AnimalCoreRing[]=[];
 const ring=(z:number,width:number,bottom:number,top:number,headWeight:number,part:BodyPartId,color=tint)=>rings.push({z,halfWidth:width,bottom,top,headWeight,part,color});
 if(family==='snake'){
  ring(-l*.60,w*.13,.025,h*.6,0,'torso');ring(-l*.37,w*.48,.025,h,0,'torso');ring(0,w*.58,.025,h*1.15,0,'torso');ring(l*.29,w*.51,.025,h*1.20,0,'torso');ring(l*.45,w*.85,.02,h*1.8,.5,'torso');ring(l*.57,w*.57,.03,h*1.2,1,head);ring(l*.69,w*.34,.03,h*.9,1,mouth);
 }else{
  ring(-l*.5,w*.30,leg,leg+h*.78,0,'torso');ring(-l*.31,w*.48,leg,leg+h,0,'torso');ring(l*.05,w*.5,leg,leg+h,0,'torso');ring(l*.29,w*.40,leg+h*.12,leg+h*.92,0,'torso');
  ring(headZ,w*.24,headY-h*.37,headY+h*.23,.5,neck);ring(headZ+l*.12,w*.25,headY-h*.20,headY+h*.24,1,head);ring(headZ+l*(family==='cat'?.29:.32),w*.16,headY-h*.18,headY+h*.07,1,mouth);
 }
 const parts:HarePart[]=[],add=(size:HarePart['size'],center:HarePart['center'],part:BodyPartId,bone=0,color=tint,pivot:HarePart['pivot']=[0,0,0],core=false)=>parts.push({size,center,bodyPart:part,bone,color,pivot,core});
 add([w,h,l],[0,leg+h*.5,0],'torso',0,tint,[0,0,0],true);
 // One actual anatomical leg record per rendered limb. Birds have two, snakes
 // none, monkey has its true two legs plus arms rather than four false legs.
 const legs=rows.filter(row=>row.depth==='outside'&&row.defId==='Leg');
 for(let i=0;i<legs.length;i++){
  const row=legs[i]!,side=row.side==='left'?-1:row.side==='right'?1:i%2===0?-1:1,front=legs.length<=2?0:i<2?1:-1;
  const x=side*w*.37,z=front*l*.31,pivot:HarePart['pivot']=[x,leg,z],part=animalPartId256(body,row.index),bone=i%2+1;
  add([w*.19,leg+.08*scale,.13*scale],[x,(leg+.08*scale)/2,z],part,bone,tint,pivot);
  const foot=rows.find(child=>child.parent===row.index&&['Paw','Hoof','Foot'].includes(child.defId));
  if(foot)add([w*.23,.09*scale,.19*scale],[x,.045*scale,z+.025*scale],animalPartId256(body,foot.index),bone,0x69675c,pivot);
 }
 if(family==='monkey')for(const side of [-1,1]){
  const shoulder=rows.find(row=>row.defId==='Arm'&&row.side===(side<0?'left':'right'))!,hand=rows.find(row=>row.defId==='Hand'&&row.side===(side<0?'left':'right'))!;
  const pivot:HarePart['pivot']=[side*w*.5,leg+h*.8,l*.18];
  add([w*.22,h*.9,.17*scale],[side*w*.57,leg+h*.38,l*.18],animalPartId256(body,shoulder.index),side<0?1:2,tint,pivot);
  add([w*.25,.12*scale,.18*scale],[side*w*.57,leg-h*.02,l*.21],animalPartId256(body,hand.index),side<0?1:2,0x837967,pivot);
 }
 for(const row of rows){
  if(row.depth!=='outside')continue;const id=animalPartId256(body,row.index),side=row.side==='left'?-1:1;
  if(row.defId==='Eye')add([.025*scale,.035*scale,.045*scale],[side*w*.25,headY+.06*scale,headZ+l*.16],id,3,0x303b38,headPivot);
  if(row.defId==='Ear'){
   const ear=species==='labrador-retriever'?.20:species==='husky'?.19:species==='yorkshire-terrier'?.16:species==='cat'?.17:species==='fennec-fox'?.34:species==='donkey'?.28:family==='elephant'?.42:.12;
   if(species==='labrador-retriever')add([w*.25,ear*scale,.12*scale],[side*w*.31,headY-ear*scale*.28,headZ+.025*scale],id,3,tint,headPivot);else add([family==='elephant'?w*.47:w*.24,ear*scale,.09*scale],[side*w*.30,headY+ear*scale*.55,headZ+.015*scale],id,3,tint,headPivot);
  }
  if(row.defId==='Tail'){
   const fluffy=['squirrel','arctic-fox','fennec-fox','raccoon'].includes(species),tail=family==='monkey'?.95:fluffy?.63:.34;
   add([w*(fluffy?.52:.12),h*(fluffy?.65:.25),tail*scale],[0,leg+h*.35,-l*.5-tail*scale*.3],id,0,tint);
  }
  if(row.defId==='Trunk')add([w*.20,.69*scale,.21*scale],[0,headY-.38*scale,headZ+l*.41],id,3,tint,headPivot);
  if(row.defId==='Tusk')add([.075*scale,.10*scale,.43*scale],[side*w*.21,headY-.11*scale,headZ+l*.35],id,3,0xd9cfad,headPivot);
  if(row.defId==='Horn')add([.13*scale,.28*scale,.18*scale],[0,headY+.19*scale,headZ+l*.28],id,3,0xc5bea2,headPivot);
  if(row.defId==='Hump')add([w*.84,h*.55,l*.40],[0,leg+h*1.08,-l*.15],id,0,tint);
  if(['Beak','TurtleBeak'].includes(row.defId))add([w*.26,.10*scale,.24*scale],[0,headY-.03*scale,headZ+l*.33],id,3,0xbba66d,headPivot);
 }
 if(family==='bird'){
  for(const side of [-1,1])add([w*.18,h*.68,l*.62],[side*w*.47,leg+h*.45,-l*.05],'torso');
  if(species==='cassowary')add([.12*scale,.26*scale,.22*scale],[0,headY+.22*scale,headZ+.08*scale],head,3,0xb3ac87,headPivot);
  if(species==='turkey')for(const side of [-1,1])add([w*.52,h*.85,.13*scale],[side*w*.22,leg+h*.61,-l*.51],'tail',0,0xaaa38e);
 }
 if(family==='turtle'&&species==='tortoise')add([w*.96,h*.65,l*.78],[0,leg+h*.83,0],'torso',0,0x7f8b73);
 if(['caribou','elk','ibex','bison','yak'].includes(species))for(const side of [-1,1]){
  add([.075*scale,.37*scale,.09*scale],[side*w*.29,headY+.28*scale,headZ+.04*scale],head,3,0xc5bda1,headPivot);
  if(species==='elk'||species==='caribou')add([.27*scale,.07*scale,.09*scale],[side*w*.40,headY+.41*scale,headZ+.04*scale],head,3,0xc5bda1,headPivot);
 }
 if(species==='boomalope'||species==='boomrat')for(const side of [-1,1])add([w*.30,h*.62,l*.42],[side*w*.51,leg+h*.38,-l*.10],'torso',0,0xb6ac78);
 return {rings:Object.freeze(rings),headPivot,parts:Object.freeze(parts)};
}
/** Original chalk-like arthropods, sharing the resident shell/limb rig.
 * Every visible appendage uses its actual body record; both bodies have six
 * legs, not a mammal fallback or an invented eight-leg spider anatomy. */
function insectShape256(species:AnimalSpeciesId256,body:keyof typeof CORE_ANIMAL_BODIES_256,scale:number,bw:number,legHeight:number,length:number,tint:number):{rings:readonly AnimalCoreRing[];headPivot:readonly [number,number,number];parts:readonly HarePart[]} {
 const rows=CORE_ANIMAL_BODIES_256[body],w=bw*scale,l=length*scale,leg=legHeight*scale,h=(species==='megascarab'?.42:species==='spelopede'?.27:.39)*scale;
 const part=(def:string)=>{const row=rows.find(r=>r.defId===def);if(!row)throw Error('Missing actual insect anatomy: '+def);return animalPartId256(body,row.index);};
 const shell=part('Shell'),pronotum=part('Pronotum'),head=part('InsectHead'),mouth=part('InsectMouth');
 const headPivot:HarePart['pivot']=[0,leg+h*.46,l*.30],rings:AnimalCoreRing[]=[];
 const ring=(z:number,width:number,bottom:number,top:number,owner:BodyPartId,weight=0)=>rings.push({z,halfWidth:width,bottom,top,part:owner,headWeight:weight,color:tint});
 ring(-l*.56,w*.16,leg,leg+h*.55,shell);ring(-l*.40,w*.45,leg,leg+h*.94,shell);ring(-l*.13,w*.50,leg,leg+h,shell);
 ring(l*.15,w*.38,leg,leg+h*.86,pronotum);ring(l*.34,w*.28,leg+h*.08,leg+h*.75,pronotum,.25);
 ring(l*.48,w*.30,leg+h*.10,leg+h*.70,head,1);ring(l*.63,w*.17,leg+h*.14,leg+h*.48,mouth,1);
 const parts:HarePart[]=[],add=(size:HarePart['size'],center:HarePart['center'],owner:BodyPartId,bone=0,color=tint,pivot:HarePart['pivot']=[0,0,0],core=false)=>parts.push({size,center,bodyPart:owner,bone,color,pivot,core});
 add([w,h,l],[0,leg+h*.5,0],shell,0,tint,[0,0,0],true);
 const legs=rows.filter(r=>r.depth==='outside'&&r.defId==='InsectLeg');
 for(let i=0;i<legs.length;i++){
  const row=legs[i]!,side=row.side==='left'?-1:1,pair=Math.floor(i/2),z=l*(.29-pair*.29),x=side*w*.35,bone=(pair+(side<0?0:1))%2+1;
  const id=animalPartId256(body,row.index),pivot:HarePart['pivot']=[x,leg+h*.14,z],reach=species==='megaspider'?.64:species==='spelopede'?.48:.38;
  add([w*reach,leg*.30,.085*scale],[side*w*(.35+reach*.36),leg*.83,z-.04*scale],id,bone,tint,pivot);
  add([.085*scale,leg*.90,.11*scale],[side*w*(.35+reach*.75),leg*.45,z-.08*scale],id,bone,0x626e68,pivot);
 }
 for(const row of rows){
  const id=animalPartId256(body,row.index),side=row.side==='left'?-1:1;
  if(row.defId==='Elytra')add([w*.43,h*.20,l*.61],[side*w*.23,leg+h*.94,-l*.19],id,0,species==='megascarab'?0xb2b99e:tint);
  if(row.defId==='Antenna')add([.035*scale,.13*scale,l*.27],[side*w*.22,leg+h*.68,l*.67],id,3,0xb7baa1,headPivot);
  if(row.defId==='Eye')add([.035*scale,.045*scale,.055*scale],[side*w*.27,leg+h*.61,l*.51],id,3,0x303d38,headPivot);
  if(row.defId==='InsectMouth')for(const jaw of [-1,1])add([w*.12,.08*scale,l*.19],[jaw*w*.10,leg+h*.30,l*.66],id,3,0xc5bc9d,headPivot);
  if(row.defId==='HeadClaw')add([w*.15,h*.55,l*.17],[0,leg+h*.73,l*.59],id,3,0xbcb79f,headPivot);
 }
 // Shell ridges distinguish the elongated crawler using the same root owner.
 if(species==='spelopede')for(const z of [-.40,-.22,-.04])add([w*.88,h*.14,l*.08],[0,leg+h*.98,l*z],shell,0,0xb4aa95);
 return {rings:Object.freeze(rings),headPivot,parts:Object.freeze(parts)};
}
const cache=new Map<AnimalSpeciesId256,ReturnType<typeof animalShape256>>();
export function cachedAnimalShape256(species:string){if(!isAnimalSpecies256(species))return;let shape=cache.get(species);if(!shape){shape=animalShape256(species);cache.set(species,shape);}return shape;}
