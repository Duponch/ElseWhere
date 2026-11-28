/** Existing mechanical owners are originals from RimWorld, not additional
 * generated residents. Core BodyDef indexes are resolved independently of
 * the model's compiled array (Core groups sight sensors before hearing ones).
 * A real source Lord can become the existing local assault/sleep owner; no
 * population budget, incident, or unrelated raid is manufactured. */
import type {ImportContext} from './convert.ts';
import type {RwsThing} from './rws-save.ts';
import {items,num,text,at,isNull,type XmlNode} from './xml.ts';
import {lookup,isDropped,mappingStatus} from './mapping.ts';
import {INJURY_MAP} from './map-pawns.ts';
import type {Mechanoid} from '../../sim/mechanoid-state.ts';
import type {MechanoidKind} from '../../sim/mechanoid-definition.ts';
import type {BodyPartId} from '../../sim/body-definition.ts';
import {mechanoidBodyModel} from '../../sim/mechanoid-anatomy.ts';
import {HP_UNIT} from '../../sim/injury-rules.ts';
import {medicalStatus,reconcileMedicalDeath} from '../../sim/injury-state.ts';
import {createMechaMedicalRecord} from '../../sim/mechanoid-health.ts';
import {validateMechanoidMedicalRecord} from '../../sim/injury-validation.ts';
import {actualMechanicalBirthFaction259} from '../../sim/mechanoid-world-faction-259.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';

export const RWS_MECH_KIND:Readonly<Record<string,MechanoidKind>>={Mech_Scyther:'scyther',Mech_Lancer:'lancer',Mech_Pikeman:'pikeman'};
const rawBodies:Readonly<Record<MechanoidKind,string>>={scyther:'Scyther',lancer:'Lancer',pikeman:'Pikeman'};
const ref=(s:string|undefined):string|undefined=>s?.replace(/^Thing_/, '');
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** 1.6 Core Bodies_Mechanoid.xml: indexes 5/6 swap because our model
 * declares each side's visual/auditory sensors as a pair. All remaining
 * parts use the same pre-order, including the Scyther's two blades. */
export function coreMechanoidPart(kind:MechanoidKind,body:string|undefined,index:number|undefined):BodyPartId|undefined {
 if(body!==rawBodies[kind]||index===undefined||!Number.isInteger(index)||index<0)return undefined;
 return mechanoidBodyModel(kind).parts[index===5?6:index===6?5:index]?.id;
}

function importMechHealth(ctx:ImportContext,t:RwsThing,m:Mechanoid):void {
 const {w,notes}=ctx,hediffs=items(t.node,'healthTracker/hediffSet/hediffs');
 if(!hediffs.length){const state=text(t.node,'healthTracker/healthState');if(state==='Down'||state==='Dead')notes.lost('health',`${t.def} : pose clinique ${state} sans blessure mécanique représentable.`);return;}
 const model=mechanoidBodyModel(m.mechKind),partOf=(h:XmlNode)=>coreMechanoidPart(m.mechKind,text(h,'part/body'),num(h,'part/index'));
 let record=createMechaMedicalRecord(w.tick,m.mechKind);
 const ancestors=(id:BodyPartId)=>{const a:BodyPartId[]=[];let next=model.byId[id]?.parent;while(next){a.push(next);next=model.byId[next].parent;}return a;};
 const missing=new Set(hediffs.filter(h=>h.attrs?.Class==='Hediff_MissingPart').map(partOf).filter((p):p is BodyPartId=>p!==undefined));
 const covered=(p:BodyPartId)=>record.missing.some(x=>x.part===p||ancestors(p).includes(x.part));
 const accept=(draft:typeof record):boolean=>{
  // The engine must decide the clinical status from the admitted body.
  // Never invent a missing/damaged part just to force a source's stance.
  reconcileMedicalDeath(draft);
  if(draft.death&&text(t.node,'healthTracker/healthState')!=='Dead'||validateMechanoidMedicalRecord(draft,w.schemaVersion,m.mechKind))return false;
  record=draft;return true;
 };
 for(const part of missing){
  if(ancestors(part).some(p=>missing.has(p)))continue;
  const draft=structuredClone(record);draft.missing.push({part,bornAt:w.tick});
  if(accept(draft))notes.def('health','MissingBodyPart','exact',part);
  else notes.def('health','MissingBodyPart','dropped',part,'Partie mécanique non admissible dans le modèle existant.');
 }
 for(const h of hediffs){
  const cls=h.attrs?.Class,def=text(h,'def')??'?',part=partOf(h);
  if(cls==='Hediff_MissingPart'){
   if(part===undefined)notes.def('health',def,'dropped',undefined,'Index de partie mécanique inconnu.');continue;
  }
  const mapping=lookup(INJURY_MAP,def),severity=Math.round((num(h,'severity')??0)*HP_UNIT);
  if(cls!=='Hediff_Injury'||!mapping||isDropped(mapping)||!part||covered(part)||severity<1){notes.def('health',def,'dropped',undefined,'État mécanique non représentable par le propriétaire clinique actuel.');continue;}
  const draft=structuredClone(record);draft.injuries.push({id:draft.nextInjuryId++,part,kind:mapping.to,severity,bornAt:w.tick});
  if(accept(draft))notes.def('health',def,mappingStatus(mapping),mapping.to,'adapt' in mapping?mapping.adapt:undefined);
  else notes.def('health',def,'dropped',mapping.to,'Blessure mécanique incompatible avec la clinique ou la pose du pion source.');
 }
 if(record.injuries.length||record.missing.length||record.death)m.health=record;
 if(m.health){const status=medicalStatus(m.health);m.state=status==='mobile'?'idle':status;}
 const state=text(t.node,'healthTracker/healthState');
 if(state==='Down'&&m.state!=='downed'||state==='Dead'&&m.state!=='dead'||state==='Mobile'&&m.state!=='idle')notes.lost('health',`${t.def} : état clinique mécanique source ${state} non reproduit avec les blessures admissibles.`);
}

/** Read real local assault groups after original actors have been assigned
 * their IDs. The source group keeps only supported members; one missing
 * species must never materialize as a different actor. */
function importMechDuties(ctx:ImportContext,mechs:Map<string,{thing:RwsThing;actor:Mechanoid}>):void {
 const {w,map,notes}=ctx,allocator=w.worldMaps??(w.campaignMap?.revision===2?w.campaignMap:undefined),core=effectiveCore297(w);
 for(const lord of items(map.node,'lordManager/lords')){
  const members=items(lord,'ownedPawns').map(n=>ref(text(n))).flatMap(id=>id&&mechs.has(id)?[mechs.get(id)!]:[]);
  if(!members.length)continue;
  const job=at(lord,'lordJob')?.attrs?.Class;
  if(job!=='LordJob_AssaultColony'||(num(lord,'curLordToilIdx')??0)!==0||!allocator||!Number.isSafeInteger(allocator.nextLordId)||allocator.nextLordId!>=2147483645){
   notes.lost('colonists',`Groupe mécanique ${job??'?'} : mission non représentable ; les acteurs restent présents.`);continue;
  }
  // WokenAt is not the ordinary map spawn tick: fresh ancient dormant
  // owners in Core have wokeUpTick=0 and an explicit wake signal. Use the
  // explicit awake field where present; otherwise known activation, fog
  // and actual signal distinguish dormant ancient owners from active raids.
  const awake=members.some(({thing,actor})=>{
   const explicit=text(thing.node,'awake');if(explicit==='True')return true;if(explicit==='False')return false;
   return (num(thing.node,'wokeUpTick')??0)>0||!text(thing.node,'wakeUpSignalTag')||!w.tiles[ctx.index(actor)]?.fogged;
  });
  const madeAtCore=clamp(core-Math.max(0,Math.round(num(lord,'ticksInToil')??0)),0,core),group=allocator.nextLordId!;
  allocator.nextLordId=group+1;
  const wokeAtCore=awake?members.reduce((latest,{thing})=>Math.max(latest,clamp(core-Math.max(0,ctx.save.ticksGame-(num(thing.node,'wokeUpTick')??0)),madeAtCore,core)),madeAtCore):null;
  for(const {actor} of members)actor.temple={group,madeAtCore,awakeAtCore:wokeAtCore,goal:null};
  notes.adapted('colonists',`Groupe mécanique d’assaut original : ${members.length} membre(s) repris, ${awake?'en éveil':'dormant(s)'} ; horloges anciennes rebasées et aucun nouveau raid généré.`);
 }
 for(const {thing,actor} of mechs.values())if(!actor.temple&&text(thing.node,'mindState/duty/def'))notes.lost('colonists',`${thing.def} : mission ${text(thing.node,'mindState/duty/def')} sans groupe représentable.`);
}

export function importRwsMechanoids(ctx:ImportContext):void {
 const {map,w,save,notes}=ctx,sources=map.things.filter(t=>t.cls==='Pawn'&&t.def.startsWith('Mech_'));
 // All ambient generated mechanical actors belong to the generated base,
 // not the authoritative source. No extra Scyther/Pikeman remains here.
 if(!sources.length&&!w.mechanoids?.length)return;
 const originals=new Map<string,{thing:RwsThing;actor:Mechanoid}>();
 for(const t of sources){
  notes.countBefore('colonists');
  const kind=RWS_MECH_KIND[t.def];
  if(!kind){notes.def('colonists',t.def,'dropped',undefined,`Espèce mécanique ${t.def} absente du modèle d’Elsewhere.`);continue;}
  if(!t.pos){notes.def('colonists',t.def,'dropped',kind,'Position du propriétaire mécanique absente.');continue;}
  const local=ctx.coordinates.cell(t.pos);
  if(!ctx.inside(local)||w.tiles[ctx.index(local)]?.terrain==='rock'){
   notes.def('colonists',t.def,'dropped',kind,'Position du propriétaire mécanique incompatible avec la carte convertie.');continue;
  }
  const mech:Mechanoid={id:w.nextId++,mechKind:kind,...local,state:'idle',path:[],heading:ctx.coordinates.rotation(t.rot)*Math.PI/2,moveCooldown:0,planCooldown:0};
  const fa=save.factions.find(f=>f.loadId===t.faction),actual=actualMechanicalBirthFaction259(w.worldFactions);
  if(fa?.def==='Mechanoid'&&actual)mech.worldFaction259=actual;
  else if(t.faction)notes.lost('colonists',`${t.def} : affiliation mécanique source non représentable dans le registre du monde importé.`);
  importMechHealth(ctx,t,mech);
  if(text(t.node,'pather/moving')==='True'||!isNull(at(t.node,'jobs/curJob')))notes.lost('colonists',`${t.def} : tâche et route mécaniques en cours non représentées par la reprise statique.`);
  originals.set(t.id,{thing:t,actor:mech});ctx.thingIds.set(t.id,mech.id);notes.countAfter('colonists');notes.def('colonists',t.def,'exact',kind);
 }
 w.mechanoids=[...originals.values()].map(x=>x.actor);
 importMechDuties(ctx,originals);
}
