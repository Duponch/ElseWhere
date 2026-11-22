/** Colonists and animals: identity, age, appearance, traits, backstories,
 * skills, passions, work priorities, health, apparel, equipment, inventory,
 * beds; colony and wild animals with names, masters and bonds. */
import type {Pawn,BedSlot,MaterialKind} from '../../sim/types.ts';
import {readThing,referencedThingId,type RwsThing} from './rws-save.ts';
import {items as listItems,text,num,at,child,type XmlNode} from './xml.ts';
import {isDropped,lookup,mappingStatus} from './mapping.ts';
import {ANIMAL_MAP,TRAIT_MAP,traitKey,SKILL_MAP,PASSION_MAP,CORE_WORK_TYPES,WORK_MAP,closestBackgrounds,HUMAN_PART_MAP,INJURY_MAP,ADDED_PART_MAP,NON_COLONIST_NOTE,OTHER_HEDIFF_NOTE} from './map-pawns.ts';
import {ITEM_MAP,APPAREL_MAP,WEAPON_MAP} from './map-items.ts';
import {placeGear,type ImportContext} from './convert.ts';
import {startingPawn} from '../../sim/starting-pawns.ts';
import {validTraits,type TraitId} from '../../sim/traits.ts';
import {CHILDHOODS,ADULTHOODS,BACKGROUND_ADULT_MIN_TICKS,backgroundWorkRefusal} from '../../sim/colonist-backgrounds.ts';
import {xpRequired} from '../../sim/skills.ts';
import {createMedicalRecord} from '../../sim/injury-state.ts';
import {installArtificialPart} from '../../sim/artificial-parts.ts';
import {BODY_PARTS,type BodyPartId} from '../../sim/body-definition.ts';
import {validatePawnHealthRecord} from '../../sim/health-save.ts';
import {bornWimpRecord362} from '../../sim/wimp-record-362.ts';
import {HAIR_STYLES} from '../../sim/pawn-appearance.ts';
import {addMaterial} from '../../sim/materials.ts';
import {validTradeInventoryCustody} from '../../sim/trade-save.ts';
import {ITEM_DEFINITIONS} from '../../sim/items.ts';
import type {WildAnimal} from '../../sim/wildlife-state.ts';
import {adultAgeTicks,animalNutritionMax} from '../../sim/animal-life.ts';
import {attachGeneratedAnimalGrowth256} from '../../sim/animal-growth-runtime-256.ts';
import {initializeAnimalEggLayer256} from '../../sim/animal-egg-local-v256.ts';
import {isAnimalSpecies256} from '../../sim/animal-core-v256.ts';
import {animalMechanicalReadiness256} from '../../sim/animal-readiness-v256.ts';
import {productKind} from '../../sim/animal-products.ts';
import {TAMENESS_DECAY} from '../../sim/animal-handling.ts';
import {HUMAN_YEAR_TICKS} from '../../sim/human-age.ts';
import type {ScarPain} from '../../sim/injury-rules.ts';

const MIN_ADULT_TICKS=18*HUMAN_YEAR_TICKS;
const PAIN:Readonly<Record<string,ScarPain>>={Painless:0,LowPain:1,MediumPain:3,HighPain:6} as Readonly<Record<string,ScarPain>>;

export function importPeople(ctx:ImportContext):void {
 const {map,save,notes}=ctx,player=save.playerFaction;
 const colonists:{thing:RwsThing;pawn:Pawn}[]=[];const animals:{thing:RwsThing;animal:WildAnimal}[]=[];
 for(const t of map.things){
  if(t.cls!=='Pawn'||!t.pos)continue;
  const race=t.def,kind=text(t.node,'kindDef')??race;
  if(race==='Human'){
   notes.countBefore('colonists');
   const guest=child(t.node,'guest'),host=text(guest,'hostFaction'),prisoner=text(guest,'guestStatus')==='Prisoner'||!!host&&host===player&&t.faction!==player;
   if(prisoner){notes.def('colonists',kind,'dropped',undefined,NON_COLONIST_NOTE.prisoner);continue;}
   if(t.faction!==player){notes.def('colonists',kind,'dropped',undefined,host===player?NON_COLONIST_NOTE.guest:NON_COLONIST_NOTE.hostile);continue;}
   const pawn=importColonist(ctx,t,colonists.length);if(pawn){colonists.push({thing:t,pawn});notes.countAfter('colonists');}
   continue;
  }
  const species=lookup(ANIMAL_MAP,race);
  if(!species){notes.countBefore('colonists');notes.def('colonists',kind,'dropped',undefined,race.startsWith('Mech_')?NON_COLONIST_NOTE.mechanoid:'Espèce ou race inconnue : non importée.');continue;}
  notes.countBefore('animals');
  if(isDropped(species)){notes.def('animals',race,'dropped',undefined,species.drop);continue;}
  const animal=importAnimal(ctx,t,species.to,t.faction===player);
  if(animal){animals.push({thing:t,animal});notes.countAfter('animals');notes.def('animals',`${race}${t.faction===player?' (colonie)':' (sauvage)'}`,mappingStatus(species),species.to,'adapt' in species?species.adapt:undefined);}
 }
 // Beds and their owners.
 for(const t of map.things){
  if(t.cls!=='Building_Bed')continue;const bedId=ctx.thingIds.get(t.id),bed=ctx.w.structures.find(s=>s.id===bedId);if(!bed)continue;
  const owners=listItems(t.node,'assignedPawns').map(n=>referencedThingId(n.text.trim())).filter(Boolean) as string[];
  const human=bed.kind!=='animal-sleeping-spot';
  owners.forEach((owner,slot)=>{
   const id=ctx.thingIds.get(owner);if(id===undefined)return;
   if(human){const p=colonists.find(c=>c.pawn.id===id)?.pawn;if(!p||p.bedId!==null)return;const two=bed.kind==='double-bed'||bed.kind==='double-bedroll'||bed.kind==='double-sleeping-spot';
    if(!two&&slot>0)return;p.bedId=bed.id;if(two)p.bedSlot=slot as BedSlot;notes.mapped('colonists',`Lit attribué à ${p.name}.`);}
  });
 }
 // Animal names, masters and bonds (kept through Elsewhere's starting-pet record).
 for(const {thing,animal} of animals){
  if(!animal.domestic)continue;
  const name=text(thing.node,'name/name')??text(thing.node,'name/first');
  const master=referencedThingId(text(thing.node,'playerSettings/master')),bond=listItems(thing.node,'social/directRelations').find(r=>text(r,'def')==='Bond');
  const bonded=bond?referencedThingId(text(bond,'otherPawn')):undefined,masterId=master?ctx.thingIds.get(master):undefined,bondedId=bonded?ctx.thingIds.get(bonded):undefined;
  const learned=listItems(at(thing.node,'training/learned'),'vals').map(n=>n.text.trim()==='True');
  if(name){
   animal.startingPet={revision:1,name:name.slice(0,80)};
   if(masterId!==undefined&&masterId===bondedId&&learned[0]){animal.startingPet.masterId=masterId;animal.startingPet.bondedPawnId=bondedId;animal.startingPet.obedience={steps:3,wanted:true};notes.mapped('animals',`${name} : maître et lien repris.`);}
   else if(master||bonded)notes.adapted('animals',`${name} : maître ou lien non repris (Elsewhere ne garde un maître que pour un animal lié et obéissant).`);
  }
 }
 if(animals.some(a=>a.animal.domestic&&listItems(at(a.thing.node,'training/learned'),'vals').some((n,i)=>i>0&&i<4&&n.text.trim()==='True')))
  notes.adapted('animals','Dressage : seule l’obéissance des animaux liés est reprise ; libération, sauvetage et transport appris ne le sont pas dans cette étape.');
 if(save.game&&text(save.game,'playSettings/useWorkPriorities')==='True')delete ctx.w.simpleWorkTab344;
}

// ---- Colonists ------------------------------------------------------------------------------
function displayName(node:XmlNode):string {
 const first=text(node,'name/first'),nick=text(node,'name/nick'),last=text(node,'name/last'),single=text(node,'name/name');
 if(single)return single.slice(0,80);
 const parts=[first,nick&&nick!==first&&nick!==last?`« ${nick} »`:undefined,last].filter(Boolean).join(' ');
 return (parts||nick||'Colon importé').slice(0,80);
}
function parseColor(value:string|undefined):number|undefined {
 const m=value&&/RGBA\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(value);if(!m)return undefined;
 const c=(s:string)=>Math.max(0,Math.min(255,Math.round(Number(s)*255)));return c(m[1]!)<<16|c(m[2]!)<<8|c(m[3]!);
}
function importColonist(ctx:ImportContext,t:RwsThing,index:number):Pawn|undefined {
 const {w,notes}=ctx,node=t.node,name=displayName(node);
 const p=startingPawn(w.nextId++,name,t.pos!.x,t.pos!.z,index%3,66,(w.seed+index*7919)>>>0,w.tick,w.schemaVersion);
 ctx.thingIds.set(t.id,p.id);
 // Age (game ticks are ten times Elsewhere's).
 const bio=Math.round((num(node,'ageTracker/ageBiologicalTicks')??0)/10),birth=num(node,'ageTracker/birthAbsTicks');
 const nowAbs=ctx.save.gameStartAbsTick+ctx.save.ticksGame,chrono=birth!==undefined?Math.round((nowAbs-birth)/10):bio;
 const biological=Math.max(MIN_ADULT_TICKS,bio);
 if(bio<MIN_ADULT_TICKS)notes.adapted('colonists',`${name} : moins de 18 ans dans la sauvegarde, importé à 18 ans (Elsewhere n’a pas d’enfants).`);
 p.age={biologicalTicks:biological,chronologicalTicks:Math.max(biological,chrono)};
 // Appearance: sex, body, head, hair.
 const female=text(node,'gender')==='Female';
 if(p.appearance){
  const a=p.appearance;a.sex=female?'female':'male';
  const body=text(node,'story/bodyType');a.bodyType=(body==='Thin'||body==='Hulk'||body==='Fat'?body:female?'Female':'Male') as typeof a.bodyType;
  const head=text(node,'story/headType');a.headType=(head&&new RegExp(`^${female?'Female':'Male'}_(Average|Narrow)(Normal|Pointy|Wide)$`).test(head)?head:`${female?'Female':'Male'}_AverageNormal`) as typeof a.headType;
  const hair=text(node,'story/hairDef');if(hair&&HAIR_STYLES.some(h=>h.id===hair))a.hair=hair as typeof a.hair;
  const hairColor=parseColor(text(node,'story/hairColor'));if(hairColor!==undefined)a.hairColor=hairColor;
  if(female)a.beard='NoBeard';
 }
 notes.def('colonists','Colonist','exact','colon',undefined);
 // Traits.
 const traits:TraitId[]=[];
 for(const tr of listItems(node,'story/traits/allTraits')){
  const def=text(tr,'def')??'',degree=num(tr,'degree'),key=traitKey(def,degree),m=lookup(TRAIT_MAP,key);
  if(!m||isDropped(m)){notes.def('traits',degree?`${def} (${degree})`:def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Trait absent d’Elsewhere.');continue;}
  if(validTraits([...traits,m.to],w.schemaVersion)){traits.push(m.to);notes.def('traits',degree?`${def} (${degree})`:def,'exact',m.to);}
  else notes.def('traits',degree?`${def} (${degree})`:def,'dropped',m.to,'Incompatible avec les autres traits selon les règles d’Elsewhere.');
 }
 if(traits.length)p.traits=traits;
 // Backstories: the closest mechanical effects.
 const childDef=text(node,'story/childhood'),adultDef=text(node,'story/adulthood');
 const choice=closestBackgrounds(childDef,adultDef,biological>=BACKGROUND_ADULT_MIN_TICKS);
 p.background={childhood:choice.childhood,...choice.adulthood?{adulthood:choice.adulthood}:{}};
 if(childDef)notes.def('backstories',childDef,'adapted',choice.childhood,`Effets les plus proches (écart ${choice.childhoodDistance}) : « ${CHILDHOODS[choice.childhood].label} ».`);
 if(adultDef)notes.def('backstories',adultDef,choice.adulthood?'adapted':'dropped',choice.adulthood,choice.adulthood?`Effets les plus proches (écart ${choice.adulthoodDistance}) : « ${ADULTHOODS[choice.adulthood].label} ».`:'Âge adulte non admis ici : seule l’enfance est reprise.');
 // Skills and passions, exact levels.
 const lastReset=Math.max(-1,Math.min(w.tick,p.skills.lastResetTick));
 for(const s of listItems(node,'skills/skills')){
  const id=SKILL_MAP[text(s,'def')??''];if(!id)continue;
  const level=Math.max(0,Math.min(20,Math.round(num(s,'level')??0))),need=xpRequired(level);
  const xp=Math.max(0,Math.min(level===20?need-1000:need-1,Math.round((num(s,'xpSinceLastLevel')??0)*1000)));
  p.skills[id]={level,xp,dailyXp:0,passion:PASSION_MAP[text(s,'passion')??'None']??0};
 }
 p.skills.lastResetTick=lastReset;
 notes.def('skills','Compétences et passions','exact','niveaux, expérience, passions');
 // Work priorities in the game's saved order.
 const vals=listItems(at(node,'workSettings/priorities'),'vals').map(v=>Number(v.text.trim()));
 if(vals.length===CORE_WORK_TYPES.length){
  CORE_WORK_TYPES.forEach((core,i)=>{const work=WORK_MAP[core]!,v=Math.max(0,Math.min(4,Math.round(vals[i]??0)));(p.priorities as Record<string,number>)[work]=v;});
  notes.def('skills','Priorités de travail','exact','priorités');
 }else notes.def('skills','Priorités de travail','dropped',undefined,'Priorités absentes : valeurs par défaut.');
 for(const work of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])if(backgroundWorkRefusal(p,work as never))(p.priorities as Record<string,number>)[work]=0;
 // Needs.
 for(const n of listItems(node,'needs/needs')){
  const def=text(n,'def'),level=num(n,'curLevel');if(level===undefined)continue;const pct=Math.max(0,Math.min(100,Math.round(level*100)));
  if(def==='Food')p.hunger=pct;else if(def==='Rest')p.rest=pct;else if(def==='Mood')p.mood=pct;else if(def==='Joy')p.recreation.level=pct;else if(def==='Comfort')p.comfort=pct;else if(def==='Beauty')p.beauty=pct;
 }
 importHealth(ctx,p,node,traits.includes('wimp' as TraitId));
 // The person exists before their clothes, weapon and inventory.
 w.pawns.push(p);
 for(const a of listItems(at(node,'apparel/wornApparel/innerList')))placeGear(ctx,readThing(a),{type:'apparel',pawnId:p.id});
 for(const e of listItems(at(node,'equipment/equipment/innerList'))){if(ctx.w.piles.some(pl=>pl.owner.type==='equipment'&&pl.owner.pawnId===p.id))break;placeGear(ctx,readThing(e),{type:'equipment',pawnId:p.id});}
 for(const it of listItems(at(node,'inventory/innerContainer/innerList'))){
  const thing=readThing(it);notes.countBefore('items');
  if(Object.hasOwn(APPAREL_MAP,thing.def)||Object.hasOwn(WEAPON_MAP,thing.def)){placeGear(ctx,thing,{type:'inventory',pawnId:p.id});continue;}
  const m=lookup(ITEM_MAP,thing.def);if(!m||isDropped(m)){notes.def('items',thing.def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Objet inconnu.');continue;}
  const kind=ITEM_DEFINITIONS[m.to].kind as MaterialKind,quantity=Math.min(thing.stack,ITEM_DEFINITIONS[m.to].stackLimit),owner={type:'inventory' as const,pawnId:p.id};
  // Elsewhere's own custody rule says what a person may carry.
  if(!validTradeInventoryCustody(w,{id:0,kind,item:m.to,quantity,owner},w.schemaVersion)){notes.def('items',`${thing.def} (inventaire)`,'dropped',m.to,'Objet qu’Elsewhere ne laisse pas porter dans un inventaire.');continue;}
  try{addMaterial(w,kind,quantity,owner,m.to);notes.countAfter('items');notes.def('items',`${thing.def} (inventaire)`,mappingStatus(m),m.to,'adapt' in m?m.adapt:undefined);}
  catch{notes.def('items',`${thing.def} (inventaire)`,'dropped',m.to,'Refusé dans l’inventaire par Elsewhere.');}
 }
 return p;
}

function importHealth(ctx:ImportContext,p:Pawn,node:XmlNode,wimp:boolean):void {
 const {w,notes}=ctx,record=createMedicalRecord(w.tick);p.health=record;
 const valid=()=>validatePawnHealthRecord(p,w).length===0;
 const hediffs=listItems(at(node,'healthTracker/hediffSet/hediffs'));
 const partOf=(h:XmlNode):BodyPartId|undefined=>{const body=text(h,'part/body'),index=num(h,'part/index');return body==='Human'&&index!==undefined?HUMAN_PART_MAP[index]:undefined;};
 const ancestors=(part:BodyPartId)=>{const out:BodyPartId[]=[];let parent=BODY_PARTS[part]?.parent;while(parent){out.push(parent);parent=BODY_PARTS[parent].parent;}return out;};
 // Age conditions first.
 const ailments=hediffs.map(h=>text(h,'def')).flatMap(d=>d==='BadBack'?['bad-back' as const]:d==='Frail'?['frail' as const]:[]);
 if(ailments.length){record.ageAilments=[...new Set(ailments)];if(!valid())delete record.ageAilments;}
 // Added parts (prostheses) and the sites they replace.
 const covered=new Set<BodyPartId>();
 for(const h of hediffs){
  if(h.attrs?.Class!=='Hediff_AddedPart')continue;const def=text(h,'def')??'',part=partOf(h),m=lookup(ADDED_PART_MAP,def);
  if(!m||isDropped(m)){notes.def('health',def,m?'dropped':'unknown',undefined,m&&isDropped(m)?`${m.drop} La partie redevient naturelle.`:'Partie artificielle inconnue.');if(part)covered.add(part);continue;}
  if(!part){notes.def('health',def,'dropped',m.to,'Partie du corps introuvable.');continue;}
  const before=JSON.stringify(record);
  if(!record.missing.some(x=>x.part===part))record.missing.push({part,bornAt:w.tick,tended:true});
  if(installArtificialPart(record,part,m.to)&&valid()){covered.add(part);notes.def('health',def,mappingStatus(m),m.to,'adapt' in m?m.adapt:undefined);}
  else{Object.assign(record,JSON.parse(before));notes.def('health',def,'dropped',m.to,'Pose refusée par les règles d’Elsewhere.');}
 }
 // Missing parts: only the outermost ones (children follow).
 const missing=hediffs.filter(h=>h.attrs?.Class==='Hediff_MissingPart').map(partOf).filter((x):x is BodyPartId=>!!x);
 const missingSet=new Set(missing);
 for(const part of missing){
  if(covered.has(part)||ancestors(part).some(a=>missingSet.has(a)||covered.has(a))){continue;}
  if(record.missing.some(x=>x.part===part))continue;
  record.missing.push({part,bornAt:w.tick,tended:true});
  if(valid())notes.def('health','MissingBodyPart','exact','partie manquante');
  else{record.missing.pop();notes.def('health','MissingBodyPart','dropped',part,'Partie manquante non admise par Elsewhere à cet endroit.');}
 }
 // Injuries and scars.
 const used=new Map<BodyPartId,number>();
 for(const h of hediffs){
  if(h.attrs?.Class!=='Hediff_Injury')continue;const def=text(h,'def')??'',m=lookup(INJURY_MAP,def),part=partOf(h);
  const permanent=text(h,'isPermanent')==='True';
  if(!m||isDropped(m)){notes.def('health',def,m?'dropped':'unknown',undefined,m&&isDropped(m)?m.drop:'Blessure inconnue.');continue;}
  if(!part||covered.has(part)||missingSet.has(part)||record.missing.some(x=>x.part===part)){notes.def('health',def,'dropped',m.to,'Partie du corps absente ou remplacée.');continue;}
  const max=BODY_PARTS[part].hp*1000,taken=used.get(part)??0,severity=Math.min(Math.max(1,Math.round((num(h,'severity')??1)*1000)),max-taken-1000);
  if(severity<1){notes.def('health',def,'dropped',m.to,'La partie n’a plus assez de points de vie dans Elsewhere.');continue;}
  const injury:NonNullable<Pawn['health']>['injuries'][number]={id:record.nextInjuryId++,part,kind:m.to,severity,bornAt:w.tick,...permanent?{scar:{threshold:severity,pain:PAIN[text(h,'painCategory')??'Painless']??0}}:{tended:Math.max(0,Math.min(1300,Math.round((num(h,'tendQuality')??.5)*1000)))}};
  record.injuries.push(injury);
  if(valid()){used.set(part,taken+severity);notes.def('health',permanent?`${def} (cicatrice)`:def,mappingStatus(m),permanent?`cicatrice ${m.to}`:m.to,'adapt' in m?m.adapt:undefined);}
  else{
   // Scars on a part Elsewhere cannot scar: keep the old wound as a tended one.
   record.injuries.pop();record.nextInjuryId--;notes.def('health',def,'dropped',m.to,'Refusée par les règles d’Elsewhere (cicatrice impossible sur cette partie).');
  }
 }
 for(const h of hediffs){const cls=h.attrs?.Class;if(cls==='Hediff_Injury'||cls==='Hediff_MissingPart'||cls==='Hediff_AddedPart')continue;const def=text(h,'def')??'?';if(def==='BadBack'||def==='Frail'){notes.def('health',def,'exact',def==='BadBack'?'bad-back':'frail');continue;}notes.def('health',def,'dropped',undefined,OTHER_HEDIFF_NOTE);}
 if(wimp)bornWimpRecord362(p,w.tick);
}

// ---- Animals -----------------------------------------------------------------------------------
function importAnimal(ctx:ImportContext,t:RwsThing,species:WildAnimal['species'],tame:boolean):WildAnimal|undefined {
 const {w,notes}=ctx,i=ctx.index(t.pos!),tile=w.tiles[i]!;
 if(isAnimalSpecies256(species)&&!animalMechanicalReadiness256(species).ok){notes.def('animals',t.def,'dropped',species,'Espèce pas encore prise en charge par la simulation d’Elsewhere.');return undefined;}
 if(tile.terrain==='rock'||ctx.blocked.has(i)){notes.def('animals',t.def,'dropped',species,'Animal sur une case infranchissable dans Elsewhere.');return undefined;}
 w.wildlife??={profile:w.site?.revision===3?'geographic-fauna-v3':'temperate-hares-v1',rng:((w.seed^0x784caf31)>>>0)||1,animals:[],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 const age=Math.max(1,Math.round((num(t.node,'ageTracker/ageBiologicalTicks')??adultAgeTicks(species)*10)/10));
 const a:WildAnimal={id:w.nextId++,species,sex:text(t.node,'gender')==='Male'?'male':'female',x:t.pos!.x,z:t.pos!.z,ageTicks:age,food:0,rest:.9,state:'idle',path:[],nextDecision:w.tick+1} as WildAnimal;
 if(w.schemaVersion>=256){attachGeneratedAnimalGrowth256(a,w.tick*10,w.schemaVersion);initializeAnimalEggLayer256(a);}
 a.food=animalNutritionMax(a)*.8;
 if(tame)a.domestic={since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+TAMENESS_DECAY,...productKind(a)?{productFullness:0}:{}};
 w.wildlife.animals.push(a);ctx.thingIds.set(t.id,a.id);
 const all=listItems(at(t.node,'healthTracker/hediffSet/hediffs')),hediffs=all.filter(h=>h.attrs?.Class!=='Hediff_Pregnant');
 if(all.length>hediffs.length)notes.def('animals','Gestation','dropped',undefined,'Gestation en cours : non reprise.');
 if(hediffs.length)notes.def('health',`${t.def} : santé`,'dropped',undefined,'Blessures et parties manquantes des animaux : non reprises dans cette étape.',hediffs.length);
 return a;
}
