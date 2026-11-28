/** A Core Corpse is a container with a reference to its deceased world
 * Pawn, not a fungible food item. Resolve that actual owner before allocating
 * any native corpse identity. Preserve proven deaths, never invent a cause. */
import {ImportContext} from './convert.ts';
import {prepareRwsHumanCorpseOwner} from './import-world-people.ts';
import {importAnimalHealth} from './import-animal-state.ts';
import {placeRwsMaterial,placeRwsPacked} from './convert-items.ts';
import {ANIMAL_MAP} from './map-pawns.ts';
import {lookup,isDropped} from './mapping.ts';
import {at,items,num,text,type XmlNode} from './xml.ts';
import {readThing,referencedThingId,type RwsThing} from './rws-save.ts';
import {ImportNotes} from './notes.ts';
import type {Cell,MaterialPile,MaterialOwner,World} from '../../sim/types.ts';
import type {WildAnimal} from '../../sim/wildlife-state.ts';
import {animalCorpseItem} from '../../sim/corpses.ts';
import {HUMAN_CORPSE_MAX_HP} from '../../sim/human-corpses.ts';
import {attachGeneratedAnimalGrowth256} from '../../sim/animal-growth-runtime-256.ts';
import {animalMechanicalReadiness256} from '../../sim/animal-readiness-v256.ts';
import {isAnimalSpecies256} from '../../sim/animal-core-v256.ts';
import {validCorpseShape,validCorpseRot} from '../../sim/corpse-save.ts';
import {validHumanBodyShape,validHumanCorpseShape,validateBurials} from '../../sim/burial-save.ts';
import {animalNutritionMax} from '../../sim/animal-life.ts';
import {nativeAnimalAnatomy256} from '../../sim/native-animal-anatomy-256.ts';
import {animalPartId256} from '../../sim/animal-anatomy-v256.ts';
import {medicalModel} from '../../sim/body-model.ts';
import {projectCorpseConsumption} from '../../sim/corpse-anatomy.ts';
import {groundCapacity,groundPilesAt,nearbyGround} from '../../sim/ground-placement.ts';
import {groundMaxStacks} from '../../sim/shelf-storage.ts';
import {appendPileEntries} from '../../sim/pile-identity-directory.ts';
import {pileMaxHp} from '../../sim/thing-damage-rules.ts';
import {setMaterialForbidden256} from '../../sim/material-permission-256.ts';

type SourceBody={corpse:RwsThing;cell:Cell;owner:MaterialOwner};
const reference=(node:XmlNode|undefined)=>referencedThingId(text(node));
function sourceBodies(ctx:ImportContext):SourceBody[] {
 const result:SourceBody[]=[];
 for(const t of ctx.map.things){
  if(!t.pos)continue;const cell=ctx.coordinates.cell(t.pos);
  if(t.cls==='Corpse'){result.push({corpse:t,cell,owner:{type:'ground',...cell}});continue;}
  if(t.def==='Grave'||t.def==='Sarcophagus'){
   const g=ctx.w.structures.find(s=>s.id===ctx.thingIds.get(t.id)&&s.grave);
   for(const row of items(t.node,'innerContainer/innerList')){
    if(row.attrs?.Class!=='Corpse')continue;
    if(!g){ctx.notes.countBefore('items');ctx.notes.def('items',text(row,'def')??'Corpse','dropped',undefined,'Conteneur funéraire original non importé.');continue;}
    result.push({corpse:readThing(row,'Corpse'),cell:{x:g.x,z:g.z},owner:{type:'grave',graveId:g.id}});
   }
  }
  if(t.def==='Human'){
   const pawn=ctx.w.pawns.find(p=>p.id===ctx.thingIds.get(t.id));
   if(!pawn)continue;
   for(const row of items(t.node,'carryTracker/innerContainer/innerList'))if(row.attrs?.Class==='Corpse')
    result.push({corpse:readThing(row,'Corpse'),cell:{x:pawn.x,z:pawn.z},owner:{type:'pawn',pawnId:pawn.id}});
  }
 }
 return result;
}
function sourceDeadPawns(ctx:ImportContext):Map<string,RwsThing> {
 return new Map(items(at(ctx.save.game,'world/worldPawns'),'pawnsDead').flatMap(node=>{
  const t=readThing(node,'Pawn');return t.id?[[t.id,t] as const]:[];
 }));
}
function innerPawn(body:RwsThing,rows:Map<string,RwsThing>):RwsThing|undefined {
 const row=items(body.node,'innerContainer/innerList')[0];
 if(!row)return;
 const id=reference(row);
 return id?rows.get(id):text(row,'def')?readThing(row,'Pawn'):undefined;
}
/** Map actual absolute Core macro ticks, not a rounded elapsed interval
 * (the latter shifts death one tick earlier when both clocks have different
 * physical phases). Older converted worlds may still have an epoch offset. */
const localClock=(ctx:ImportContext,core:number)=>Math.floor(core/10)+ctx.w.tick-Math.floor(ctx.save.ticksGame/10);
function deathAt(ctx:ImportContext,c:RwsThing):{core:number;local:number}|undefined {
 const core=num(c.node,'timeOfDeath');
 if(core===undefined||!Number.isSafeInteger(core)||core<0||core>ctx.save.ticksGame)return;
 const local=localClock(ctx,core);
 return local>=0?{core,local}:undefined;
}
function corpseDestination(ctx:ImportContext,pile:MaterialPile,requested:MaterialOwner,cell:Cell):MaterialOwner|undefined {
 const w=ctx.w;
 if(requested.type==='grave'){
  const g=w.structures.find(s=>s.id===requested.graveId);
  return g?.grave&&g.grave.corpseId===undefined&&pile.item==='human-corpse'?requested:undefined;
 }
 if(requested.type==='pawn'){
  const p=w.pawns.find(p=>p.id===requested.pawnId);
  if(p&&p.state==='idle'&&!p.path.length&&p.jobId===null&&!p.haul&&!p.cooking&&!p.need&&p.orders.active===null&&!w.piles.some(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)&&!w.packed.some(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id))return requested;
 }
 const free=(c:Cell)=>ctx.inside(c)&&groundPilesAt(w,c).length<groundMaxStacks(w,c)&&groundCapacity(w,c,pile)>=1;
 const slot=free(cell)?cell:nearbyGround(w,cell).find(free);
 return slot?{type:'ground',...slot}:undefined;
}
const sameOwner=(a:MaterialOwner,b:MaterialOwner)=>JSON.stringify(a)===JSON.stringify(b);
function mergeNotes(ctx:ImportContext,notes:ImportNotes):void {
 for(const [family,table] of notes.tallies)for(const row of table.values())ctx.notes.def(family,row.def,row.status,row.to,row.note,row.count,row.origin);
 for(const row of notes.messages)ctx.notes[row.kind](row.family,row.text);
 for(const [family,count] of notes.before)ctx.notes.countBefore(family,count);
 for(const [family,count] of notes.after)ctx.notes.countAfter(family,count);
}
function setCarriedOrGrave(w:World,p:MaterialPile):void {
 const owner=p.owner;
 if(owner.type==='grave'){const g=w.structures.find(s=>s.id===owner.graveId);if(g?.grave)g.grave.corpseId=p.id;}
 else if(owner.type==='pawn'){const actor=w.pawns.find(p=>p.id===owner.pawnId);if(actor)actor.interruptedCargo=true;}
}
function corpseCondition(ctx:ImportContext,c:RwsThing,pile:MaterialPile,death:number,why:string[]):boolean {
 const rot=num(c.node,'rotProg')??0,max=ctx.w.tick-death;
 if(!Number.isFinite(rot)||rot<0)return false;
 const progress=rot/10;
 // Permit the unavoidably sub-tick boundary mismatch only. Older/invalid
 // physiological histories require a representable owner clock, not a fake
 // recent death or a fresh corpse.
 if(progress>max+1)return false;
 if(progress>max)why.push('Âge de pourriture ajusté à la frontière du pas local.');
 pile.rot={progress:Math.min(progress,max),atTick:ctx.w.tick,...pile.owner.type==='grave'?{rate:0}:{}};
 const maxHp=pile.item==='human-corpse'?HUMAN_CORPSE_MAX_HP:pileMaxHp(pile,ctx.w.schemaVersion);
 if(c.hp!==undefined&&maxHp>0){const damage=Math.min(maxHp-1,Math.max(0,Math.round(maxHp-c.hp)));if(damage)pile.damage=damage;}
 if(c.forbidden&&pile.owner.type==='ground')setMaterialForbidden256(pile,true);
 return true;
}
/** Core writes missing descendants after scavenging a body. These parts
 * must never be added to the pre-death medical history (doing so could invent
 * a vital failure); the native consumed-parts field preserves their actual
 * frozen absence separately. */
function postmortemAnimalParts(ctx:ImportContext,t:RwsThing,pile:MaterialPile,deathCore:number,why:string[]):void {
 const corpse=pile.corpse! ,body=nativeAnimalAnatomy256(corpse.species).body,model=medicalModel(corpse.health);
 const rows=items(t.node,'healthTracker/hediffSet/hediffs').filter(h=>h.attrs?.Class==='Hediff_MissingPart'&&(num(h,'tickAdded')??0)>deathCore);
 const mapped=rows.flatMap(row=>{
  const index=num(row,'part/index');if(index===undefined||!Number.isSafeInteger(index)||text(row,'part/body')!==body)return [];
  try{const part=animalPartId256(body,index);return model.byId[part]?[{part,row}]:[];}catch{return [];}
 });
 const strip=new Set(mapped.map(p=>p.part));let represented=0;
 for(const {part,row} of mapped.sort((a,b)=>num(a.row,'tickAdded')!-num(b.row,'tickAdded')!)){
  let parent=model.byId[part].parent,descendant=false;
  while(parent){if(strip.has(parent)){descendant=true;break;}parent=model.byId[parent].parent;}
  if(descendant)continue;
  if(text(row,'lastInjury')!=='Bite'){why.push('Partie absente après le décès sans trace compatible de consommation.');continue;}
  const atTick=Math.max(corpse.health.death!.tick,localClock(ctx,num(row,'tickAdded')!));
  if(atTick>ctx.w.tick)continue;
  const projected=projectCorpseConsumption(corpse,part,atTick);
  if(!projected||projected.consumesWhole||!projected.consumedParts){why.push('Partie consommée après décès non représentable.');continue;}
  corpse.consumedParts=projected.consumedParts;represented++;
 }
 if(mapped.length<rows.length)why.push('Certaines parties post mortem n’ont pas d’anatomie correspondante.');
 if(represented)why.push(`${represented} absence(s) post mortem conservée(s) en parties consommées (morsure source).`);
}
function importHumanBody(ctx:ImportContext,b:SourceBody,t:RwsThing,clock:{core:number;local:number},why:string[]):string|undefined {
 const w=ctx.w,death=clock.local,prepared=prepareRwsHumanCorpseOwner(ctx,t,b.cell,death,clock.core);
 if(!prepared)return 'Identité ou décès clinique original non représentable.';
 const pawn=prepared.pawn;
 const pile:MaterialPile={id:prepared.nextId,kind:'corpse',item:'human-corpse',quantity:1,owner:b.owner,humanCorpse:{pawnId:pawn.id}};
 const target=corpseDestination(ctx,pile,b.owner,b.cell);if(!target)return 'Aucun emplacement physique admis pour ce corps.';
 pile.owner=target;
 if(!sameOwner(target,b.owner))why.push('Emplacement du corps adapté à une case disponible.');
 if(!corpseCondition(ctx,b.corpse,pile,death,why))return 'Âge de pourriture hors de la chronologie représentable.';
 if(target.type!=='grave'){
  const next=num(b.corpse.node,'nextSpawnTimestamp');
  if(next!==undefined&&next>=0){
   const local=localClock(ctx,next);
   if(local>=0&&local<=w.tick+6000)pile.humanCorpse!.nextBileTick=local;
  }
 }
 pawn.body={observedAt:death,pileId:pile.id};
 if(target.type==='ground'){pawn.x=target.x;pawn.z=target.z;}
 const graveId=target.type==='grave'?target.graveId:null,carrier=target.type==='pawn'?target.pawnId:null;
 const trial:World={...w,pawns:[...w.pawns,pawn].map(p=>p.id===carrier?{...p,interruptedCargo:true}:p),structures:w.structures.map(s=>s.id===graveId&&s.grave?{...s,grave:{...s.grave,corpseId:pile.id}}:s),piles:[...w.piles,...prepared.items,pile],packed:[...w.packed,...prepared.packed],nextId:pile.id+1};
 if(!validHumanCorpseShape(pile.humanCorpse,w.schemaVersion,w.tick)||!validHumanBodyShape(pawn.body,w.schemaVersion,w.tick,pawn.health)||!validCorpseRot(pile.rot,w.tick,death,w.schemaVersion,pawn.health)||validateBurials(trial,w.schemaVersion).length)return 'Provenance terminale du corps refusée par Elsewhere.';
 // All owner and corpse checks succeeded. Now move the prepared original
 // records as one closure; the putative dead owner was not left in the map.
 w.pawns.push(pawn);for(const p of prepared.items)appendPileEntries(w.piles,p);
 appendPileEntries(w.piles,pile);w.packed.push(...prepared.packed);w.nextId=pile.id+1;
 setCarriedOrGrave(w,pile);for(const [source,id] of prepared.thingIds)ctx.thingIds.set(source,id);
 ctx.thingIds.set(t.id,pawn.id);ctx.thingIds.set(b.corpse.id,pile.id);mergeNotes(ctx,prepared.notes);
 return undefined;
}
function importAnimalBody(ctx:ImportContext,b:SourceBody,t:RwsThing,clock:{core:number;local:number},why:string[]):string|undefined {
 const w=ctx.w,m=lookup(ANIMAL_MAP,t.def),age=num(t.node,'ageTracker/ageBiologicalTicks');
 if(!m||isDropped(m)||isAnimalSpecies256(m.to)&&!animalMechanicalReadiness256(m.to).ok||age===undefined||!Number.isSafeInteger(age)||age<0)return 'Espèce ou âge de la dépouille non représenté.';
 const species=m.to,atTick=clock.local;
 const trial:World={...w,tick:atTick,phaseCore297:clock.core%10};
 const notes=new ImportNotes(),stage=new ImportContext({...ctx.save,ticksGame:clock.core},ctx.map,trial,notes,ctx.geographic,ctx.factionIds);
 const animal:WildAnimal={id:w.nextId,species,sex:text(t.node,'gender')==='Male'?'male':'female',x:b.cell.x,z:b.cell.z,ageTicks:Math.floor(age/10),ageCoreRemainder:age%10,food:0,rest:0,state:'idle',path:[],nextDecision:atTick} as WildAnimal;
 attachGeneratedAnimalGrowth256(animal,clock.core,w.schemaVersion);
 const growth=num(t.node,'ageTracker/growth');
 if(animal.growthTracker&&growth!==undefined&&growth>=0&&growth<=1){animal.growthTracker.value=Math.fround(growth);if(growth===1)animal.growthTracker.nextCheckCore=null;}
 animal.food=animalNutritionMax(animal)*.5;
 importAnimalHealth(stage,t,animal,{allowDeath:true});
 const health=animal.health;
 if(!health?.death||health.death.tick!==atTick)return 'Aucun décès clinique représenté par les blessures et états originaux.';
 const id=w.nextId,item=animalCorpseItem(species);
 const pile:MaterialPile={id,kind:'corpse',item,quantity:1,owner:b.owner,corpse:{animalId:id,species,sex:animal.sex,ageTicks:animal.ageTicks,ageCoreRemainder:animal.ageCoreRemainder,growthTracker:animal.growthTracker,health,facing:ctx.coordinates.rotation(b.corpse.rot)===3?-Math.PI/2:ctx.coordinates.rotation(b.corpse.rot)*Math.PI/2}};
 const target=corpseDestination(ctx,pile,b.owner,b.cell);if(!target)return 'Aucun emplacement physique admis pour ce corps.';
 pile.owner=target;
 if(!sameOwner(target,b.owner))why.push('Emplacement du corps adapté à une case disponible.');
 postmortemAnimalParts(ctx,t,pile,clock.core,why);
 if(!corpseCondition(ctx,b.corpse,pile,atTick,why)||!validCorpseRot(pile.rot,w.tick,atTick,w.schemaVersion,health)||!validCorpseShape(pile as unknown as Record<string,unknown>,w.schemaVersion))return 'Dépouille animale refusée par les contrôles de provenance ou d’âge.';
 if('adapt' in m&&m.adapt)why.push(m.adapt);
 w.nextId++;appendPileEntries(w.piles,pile);setCarriedOrGrave(w,pile);
 ctx.thingIds.set(t.id,id);ctx.thingIds.set(b.corpse.id,id);mergeNotes(ctx,notes);
 for(const row of items(t.node,'inventory/innerContainer/innerList')){
  const original=readThing(row);if(original.def==='MinifiedThing')placeRwsPacked(ctx,original,{type:'inventory',pawnId:id});
  else placeRwsMaterial(ctx,original,{type:'inventory',pawnId:id});
 }
 return undefined;
}

/** Ground, carried and buried owners; local source IDs are registered before
 * social links or remaining possessions are rebound. */
export function importRwsCorpses(ctx:ImportContext):void {
 const dead=sourceDeadPawns(ctx);
 for(const b of sourceBodies(ctx)){
  const c=b.corpse,source=innerPawn(c,dead),clock=deathAt(ctx,c),why:string[]=[];
  ctx.notes.countBefore('items');
  const error=!source||text(source.node,'healthTracker/healthState')!=='Dead'?'Personne ou animal mort original introuvable.':ctx.thingIds.has(source.id)||ctx.thingIds.has(c.id)?'Identité terminale déjà utilisée.':!clock?'Date originale du décès hors de l’horloge locale.':source.def==='Human'?importHumanBody(ctx,b,source,clock,why):importAnimalBody(ctx,b,source,clock,why);
  if(error){ctx.notes.def('items',c.def,'dropped',undefined,error,1,!source||!clock?'source':ctx.thingIds.has(source.id)||ctx.thingIds.has(c.id)?'importer':'model');continue;}
  ctx.notes.countAfter('items');ctx.notes.def('items',c.def,why.length?'adapted':'exact',source!.def==='Human'?'human-corpse':animalCorpseItem((lookup(ANIMAL_MAP,source!.def) as {to:WildAnimal['species']}).to),why.join(' ')||undefined,1,why.length?'model':undefined);
 }
}
