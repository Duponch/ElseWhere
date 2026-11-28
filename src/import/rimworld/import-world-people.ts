/** Actual humans whose existing nonspatial owner can be reconstructed.
 * No map origin, identity, cause of death or body age is manufactured for
 * world-pawn rows that lack the current model's mandatory witnesses. */
import {ImportContext,placeGear} from './convert.ts';
import {importHealth} from './convert-pawns.ts';
import {importStoredHumanMedicalState} from './import-human-medical-state.ts';
import {importTerminalHumanMedical} from './import-terminal-human.ts';
import {importHumanAppearance,importHumanName,importHumanNeeds} from './import-human-state.ts';
import {placeRwsMaterial,placeRwsPacked} from './convert-items.ts';
import {readThing,referencedThingId,type RwsThing} from './rws-save.ts';
import {at,items,text,num,type XmlNode} from './xml.ts';
import {ImportNotes} from './notes.ts';
import {isDropped,lookup} from './mapping.ts';
import {APPAREL_MAP,WEAPON_MAP} from './map-items.ts';
import {TRAIT_MAP,traitKey,closestBackgrounds,CORE_WORK_TYPES,WORK_MAP,SKILL_MAP,PASSION_MAP} from './map-pawns.ts';
import {validTraits,type TraitId} from '../../sim/traits.ts';
import {HUMAN_YEAR_TICKS} from '../../sim/human-age.ts';
import {BACKGROUND_ADULT_MIN_TICKS,backgroundWorkRefusal} from '../../sim/colonist-backgrounds.ts';
import {xpRequired} from '../../sim/skills.ts';
import {startingPawn} from '../../sim/starting-pawns.ts';
import {validPawnNameInput378} from '../../sim/pawn-identity-state-378.ts';
import type {Cell,Pawn,World,MaterialPile} from '../../sim/types.ts';
import type {PackedFurniture} from '../../sim/furniture-rules.ts';
import type {WorldPawnOwner256} from '../../sim/world-pawn-state-256.ts';
import {suspendWorldPawnGoods259} from '../../sim/world-pawn-held-259.ts';
import {validateWorldPawnOwners256,validWorldPawnsEnvelope256} from '../../sim/world-pawn-save-256.ts';
import {validateWorldFactionRegistry256} from '../../sim/world-faction-save.ts';
import {validateDetachedPawnRecordShape} from '../../sim/pawn-record-save.ts';
import {validatePawnHealthRecord} from '../../sim/health-save.ts';
import {validateRecreationRecordShape} from '../../sim/recreation-save.ts';
import {planetTileCount} from '../../sim/planet-geography-256.ts';
import {effectiveCore297} from '../../sim/core-phase-297.ts';
import {createMedicalRecord} from '../../sim/injury-state.ts';
import {validateAncientCasketRecord256} from '../../sim/ancient-casket-save-256.ts';
import {isAncientCasket256,type AncientCasket256,type AncientHeldPile256} from '../../sim/ancient-casket-state-256.ts';
import {isPlayerCasket271,type PlayerCasket271} from '../../sim/cryptosleep-state-271.ts';
import {validateRetainedCryptosleepOwner271} from '../../sim/cryptosleep-owner-save-271.ts';
import {isShipCasket277,type ShipCasket277} from '../../sim/ship-casket-state-277.ts';
import {validateRetainedShipCasketOwner277} from '../../sim/ship-casket-owner-save-277.ts';
import {isPerishable,rotAge} from '../../sim/food-preservation.ts';
import {captureRelationshipPeople} from '../../sim/relationship-namespace.ts';

export interface WorldSourceHuman {thing:RwsThing;mode:'active'|'mothballed'|'dead'}
export function sourceWorldHumans(ctx:ImportContext):WorldSourceHuman[] {
 const world=at(ctx.save.game,'world/worldPawns');
 return ([['pawnsAlive','active'],['pawnsMothballed','mothballed'],['pawnsDead','dead']] as const).flatMap(([key,mode])=>items(world,key).filter(x=>text(x,'def')==='Human').map(x=>({thing:readThing(x,'Pawn'),mode})));
}
const name=(n:XmlNode)=>{const first=text(n,'name/first'),nick=text(n,'name/nick'),last=text(n,'name/last');return (text(n,'name/name')??[first,nick&&nick!==first&&nick!==last?`« ${nick} »`:undefined,last].filter(Boolean).join(' ')).trim();};
const idFromRef=(v:string|undefined):number|undefined=>v&&/_(\d+)$/.test(v)?Number(/_(\d+)$/.exec(v)![1]):undefined;
const occupiedIds=(w:World)=>new Set([...w.pawns,...w.piles,...w.structures,...w.jobs,...w.resources,...w.stockpiles,...(w.wildlife?.animals??[]),...(w.mechanoids??[]),...w.growingZones,...(w.packed??[]).map(x=>x.building)].map(x=>x.id));

/** Reuse the same actual item and health converters in a private owner-only
 * staging world, never append a detached person to the adopted local map. */
function isolated(ctx:ImportContext):ImportContext {
 const w:World={...ctx.w,pawns:[],piles:[],packed:[],resources:[],structures:[],jobs:[],stockpiles:[],growingZones:[]};
 delete w.worldPawns;delete w.worldMaps;delete w.secondarySite;delete w.relationships;
 return new ImportContext(ctx.save,ctx.map,w,new ImportNotes(),ctx.geographic,ctx.factionIds);
}
function mergeNotes(target:ImportNotes,source:ImportNotes):void {
 for(const table of source.tallies.values())for(const row of table.values())target.def('world',`Personne hors carte : ${row.def}`,row.status,row.to,row.note,row.count);
}
function projectHuman(ctx:ImportContext,t:RwsThing,template:Pawn,leader:boolean,terminalAt?:number,terminalCore?:number):Pawn|undefined {
 const {w}=ctx,node=t.node,n=name(node);
 const rawAge=num(node,'ageTracker/ageBiologicalTicks');
 if(!n||n.length>80||rawAge===undefined||!Number.isSafeInteger(rawAge)||rawAge<18*HUMAN_YEAR_TICKS*10)return undefined;
 const p=startingPawn(template.id,n,template.x,template.z,0,66,w.seed,w.tick,w.schemaVersion);
 // The actual faction/guest owner was proved before projection. Preserve its
 // mapped ID; never derive a new faction from the source name.
 if(template.faction)p.faction=template.faction;
 if(template.worldAffiliation259)p.worldAffiliation259={...template.worldAffiliation259};
 const age=Math.round(rawAge/10),birth=num(node,'ageTracker/birthAbsTicks');
 p.age={biologicalTicks:age,chronologicalTicks:Math.max(age,birth===undefined?age:Math.floor((ctx.save.gameStartAbsTick+ctx.save.ticksGame-birth)/10))};
 importHumanAppearance(ctx,p,node);
 const traits:TraitId[]=[];
 for(const row of items(node,'story/traits/allTraits')){
  const def=text(row,'def')??'',m=lookup(TRAIT_MAP,traitKey(def,num(row,'degree')));
  if(m&&!isDropped(m)&&validTraits([...traits,m.to],w.schemaVersion))traits.push(m.to);
  else ctx.notes.def('traits',def,'dropped',undefined,'Trait non représenté.');
 }
 if(traits.length)p.traits=traits;else delete p.traits;
 if(!leader){
  const choice=closestBackgrounds(text(node,'story/childhood'),text(node,'story/adulthood'),age>=BACKGROUND_ADULT_MIN_TICKS);
  p.background={childhood:choice.childhood,...choice.adulthood?{adulthood:choice.adulthood}:{}};
 }
 for(const row of items(node,'skills/skills')){
  const id=SKILL_MAP[text(row,'def')??''];if(!id)continue;
  const level=Math.max(0,Math.min(20,Math.round(num(row,'level')??0))),xp=Math.max(level===0?0:-999999,Math.min(xpRequired(level)-(level===20?1000:1),Math.round((num(row,'xpSinceLastLevel')??0)*1000)));
  const dailyXp=Math.max(-3600000,Math.min(id==='melee'?140000000:39375000,Math.round((num(row,'xpSinceMidnight')??0)*1000)));
  p.skills[id]={level,xp,dailyXp,passion:PASSION_MAP[text(row,'passion')??'None']??0};
 }
 p.skills.lastResetTick=w.tick;
 const priorities=items(at(node,'workSettings/priorities'),'vals').map(v=>Number(v.text.trim()));
 if(priorities.length===CORE_WORK_TYPES.length)CORE_WORK_TYPES.forEach((core,i)=>{(p.priorities as Record<string,number>)[WORK_MAP[core]!]=Math.max(0,Math.min(4,Math.round(priorities[i]??0)));});
 for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])if(backgroundWorkRefusal(p,key as never))(p.priorities as Record<string,number>)[key]=0;
 importHumanNeeds(ctx,p,node,true);
 const downed=!leader&&terminalAt===undefined&&text(node,'healthTracker/healthState')==='Down';
 if(terminalAt===undefined&&!downed){
  importHealth(ctx,p,node,traits.includes('wimp'));
 }else p.health=createMedicalRecord(w.tick);
 if(!leader)importHumanName(ctx,p,node);
 else{
  // The current faction-owner whitelist has no nativeHuman, personal
  // backstory, room need, hostility or arbitrary policy registry reference.
  const title=text(node,'story/title');if(title&&validPawnNameInput378(title))p.identity378={revision:1,title};
  delete p.selfTend;delete p.hostilityResponse;delete p.outdoors359;delete p.indoors362;delete p.roomSize345;
 }
 if(terminalAt===undefined&&!downed)importStoredHumanMedicalState(ctx,p,node);
 if(!leader){
  const id=idFromRef(text(node,'foodRestriction/curRestriction'));if(id&&w.foodPolicies.some(x=>x.id===id))p.foodPolicyId=id;
  const outfit=idFromRef(text(node,'outfits/curOutfit'));if(outfit&&w.apparelPolicies?.some(x=>x.id===outfit))p.apparelPolicyId=outfit;
  const drug=idFromRef(text(node,'drugs/curAssignedDrugs'));if(drug&&w.drugPolicies?.some(x=>x.id===drug))p.drugPolicyId=drug;
 }
 if(terminalAt!==undefined&&!importTerminalHumanMedical(ctx,p,node,terminalAt,false,terminalCore))return undefined;
 if(downed&&!importTerminalHumanMedical(ctx,p,node,w.tick,true,effectiveCore297(w)))return undefined;
 return p;
}
function importGoods(ctx:ImportContext,t:RwsThing,p:Pawn):{items:MaterialPile[];packed:PackedFurniture[]} {
 ctx.w.pawns.push(p);ctx.thingIds.set(t.id,p.id);
 for(const row of items(t.node,'apparel/wornApparel/innerList'))placeGear(ctx,readThing(row),{type:'apparel',pawnId:p.id});
 for(const row of items(t.node,'equipment/equipment/innerList')){
  if(ctx.w.piles.some(x=>x.owner.type==='equipment')){ctx.notes.def('weapons',text(row,'def')??'Equipement','dropped',undefined,'Le propriétaire courant n’admet qu’une arme équipée.');continue;}
  placeGear(ctx,readThing(row),{type:'equipment',pawnId:p.id});
 }
 for(const row of items(t.node,'inventory/innerContainer/innerList')){
  const thing=readThing(row);if(thing.def==='MinifiedThing')placeRwsPacked(ctx,thing,{type:'inventory',pawnId:p.id});
  else if(Object.hasOwn(APPAREL_MAP,thing.def)||Object.hasOwn(WEAPON_MAP,thing.def))placeGear(ctx,thing,{type:'inventory',pawnId:p.id});
  else placeRwsMaterial(ctx,thing,{type:'inventory',pawnId:p.id});
 }
 const carried=items(t.node,'carryTracker/innerContainer/innerList');
 if(carried.length)ctx.notes.def('items','Objet en cours de transport','dropped',undefined,'Pas de propriétaire de travail en cours dans ce conteneur suspendu ou terminal.',carried.length);
 return {items:ctx.w.piles,packed:ctx.w.packed};
}
const goodsCount=(node:XmlNode)=>items(node,'apparel/wornApparel/innerList').length+items(node,'equipment/equipment/innerList').length+items(node,'inventory/innerContainer/innerList').length;
function humanAffiliation(ctx:ImportContext,t:RwsThing):Pick<Pawn,'faction'|'worldAffiliation259'>|undefined {
 const {w,factionIds}=ctx;
 const actual=t.faction?factionIds?.get(t.faction):null;
 if(!w.worldFactions){if(t.faction!==ctx.save.playerFaction)return undefined;return {};}
 if(t.faction&&actual===undefined)return undefined;
 const sourceFaction=ctx.save.factions.find(f=>f.loadId===t.faction);
 const sourcePlayer=ctx.save.factions.find(f=>f.loadId===ctx.save.playerFaction);
 const isPlayer=actual===w.worldFactions.playerFactionId;
 const hostile=sourceFaction?.relations.some(r=>r.other===ctx.save.playerFaction&&r.kind==='Hostile')||sourcePlayer?.relations.some(r=>r.other===t.faction&&r.kind==='Hostile');
 return {faction:isPlayer?'colony':hostile?'outlaws':'outlanders',worldAffiliation259:{revision:1,factionId:actual??null,hostFactionId:null,guestStatus:'Guest'}};
}
function starterTemplate(ctx:ImportContext,t:RwsThing,cell:Cell):Pawn|undefined{
 const mapped=humanAffiliation(ctx,t);if(!mapped)return undefined;
 return {...startingPawn(ctx.w.nextId++,name(t.node),cell.x,cell.z,0,66,ctx.w.seed,ctx.w.tick,ctx.w.schemaVersion),...mapped};
}
/** Private body transaction for the corpse importer. The caller owns the
 * matching body/pile/ground/grave and commits all of these records together. */
export function prepareRwsHumanCorpseOwner(ctx:ImportContext,t:RwsThing,corpseCell:Cell,deathAtLocal:number,deathAtCore?:number):{pawn:Pawn;items:MaterialPile[];packed:PackedFurniture[];nextId:number;thingIds:Map<string,number>;notes:ImportNotes}|undefined {
 if(ctx.thingIds.has(t.id)||text(t.node,'healthTracker/healthState')!=='Dead')return undefined;
 const local=isolated(ctx),template=starterTemplate(local,t,corpseCell);
 if(!template)return undefined;
 const p=projectHuman(local,t,template,false,deathAtLocal,deathAtCore);
 if(!p)return undefined;
 // The clinical record is frozen at death; portable goods retain the
 // saved observation/freshness frontier until their physical corpse is
 // placed by the caller, not some guessed time of acquisition.
 const goods=importGoods(local,t,p);
 if(validatePawnHealthRecord(p,{...ctx.w,tick:ctx.w.tick},true).length)return undefined;
 // A detached caller can validate the complete pawn, but the actual body
 // alias belongs to its final map or grave transaction, not here.
 return {pawn:p,items:goods.items,packed:goods.packed,nextId:local.w.nextId,thingIds:local.thingIds,notes:local.notes};
}

function importLeaders(ctx:ImportContext,rows:readonly WorldSourceHuman[],adopted:Set<string>):void {
 const {w,notes,factionIds}=ctx,registry=w.worldFactions;
 if(!registry||!factionIds)return;
 for(const sourceFaction of ctx.save.factions){
  const ref=referencedThingId(sourceFaction.leader),factionId=factionIds.get(sourceFaction.loadId);
  if(!ref||factionId===undefined)continue;
  if(ctx.thingIds.has(ref)){notes.def('world','Chef de faction','dropped',undefined,'Un propriétaire physique existe déjà : le registre des chefs actuel ne peut pas le référencer sans le dupliquer.');continue;}
  const source=rows.find(r=>r.thing.id===ref&&r.mode!=='dead'),old=registry.leaders.find(l=>l.factionId===factionId);
  if(!source||!old||source.thing.faction!==sourceFaction.loadId){
   notes.def('world','Chef de faction','dropped',undefined,'Personne référencée ou faction réelle non disponible.');continue;
  }
  const local=isolated(ctx),p=projectHuman(local,source.thing,old.pawn,true);
  if(!p)continue;
  const candidate={...old,clock:w.tick,pawn:p,items:[],packed:[]};
  const nextRegistry={...registry,leaders:registry.leaders.map(x=>x===old?candidate:x)};
  const postIds=new Set(registry.settlements.flatMap(s=>s.postId===null?[]:[s.postId]));
  const errors=validateWorldFactionRegistry256(nextRegistry,w.schemaVersion,{present:true,tick:w.tick,width:w.width,height:w.height,nextId:w.nextId,tileCount:w.planet?planetTileCount(w.planet):0,
   postIds,knownHumanIds:new Set(w.pawns.map(q=>q.id)),occupiedThingIds:occupiedIds(w)});
  if(errors.length){notes.def('world','Chef de faction','dropped',undefined,`État personnel actuel non admis : ${errors[0]}`);continue;}
  Object.assign(old,candidate);ctx.thingIds.set(ref,p.id);adopted.add(ref);mergeNotes(notes,local.notes);
  notes.def('world','Chef de faction','adapted','identité personnelle de la source',`Le propriétaire actuel ne peut pas porter ses histoires, liens de nom natif et ${goodsCount(source.thing.node)} possessions.`);
 }
}
function importStartingLeftBehind(ctx:ImportContext,rows:readonly WorldSourceHuman[],adopted:Set<string>):void {
 const {w,notes,factionIds}=ctx,s=w.worldPawns,player=w.worldFactions?.playerFactionId;
 if(!s||!player||!factionIds||s.nativeOrder)return;
 const kept=new Set(items(at(ctx.save.game,'world/worldPawns'),'pawnsForcefullyKeptAsWorldPawns').map(r=>referencedThingId(text(r))));
 const source=rows.filter(r=>r.mode!=='dead'&&text(r.thing.node,'wasLeftBehindStartingPawn')==='True'&&r.thing.faction===ctx.save.playerFaction&&kept.has(r.thing.id));
 const mapped=new Set(ctx.thingIds.values());
 const originals=s.owners.filter((x):x is Extract<WorldPawnOwner256,{kind:'human'}>=>x.kind==='human'&&x.startingPawnLeftBehind===true&&x.factionId===player&&x.originMapId===null&&!mapped.has(x.actor.id));
 // Generated candidate placeholders belong only to private import staging.
 // Remove unmatched stand-ins rather than letting stale generated companions
 // block the actual saved people. Existing source-mapped rows stay put.
 const replaceIds=new Set(originals.map(x=>x.actor.id));s.owners=s.owners.filter(x=>!replaceIds.has(x.actor.id));
 let templateIndex=0;
 for(const entry of source){
  const t=entry.thing,enteredAtAbsCore=num(t.node,'becameWorldPawnTickAbs');
  if(ctx.thingIds.has(t.id))continue;
  if(enteredAtAbsCore===undefined||!Number.isSafeInteger(enteredAtAbsCore)||enteredAtAbsCore<0)continue;
  const local=isolated(ctx),previous=originals[templateIndex++],cell=t.pos?ctx.coordinates.cell(t.pos):{x:-1000,z:-1000};
  const template=previous?{...previous.actor,...cell}:starterTemplate(local,t,cell);
  const p=template&&projectHuman(local,t,template,false);
  if(!p)continue;
  const context=previous?.context??originals[0]?.context??{seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:w.climate}:{},...w.site?{site:w.site}:{},...w.scenario?{scenario:w.scenario}:{}};
  const goods=importGoods(local,t,p),candidate:WorldPawnOwner256={kind:'human',factionId:player,originMapId:null,context:structuredClone(context),keepForever:true,startingPawnLeftBehind:true,actor:p,clockCore:s.atCore,physicalClockCore297:effectiveCore297(w),enteredAtAbsCore,mode:'active',items:goods.items,packed:goods.packed};
  suspendWorldPawnGoods259(candidate,s.atCore,w.schemaVersion,effectiveCore297(w));
  const nextState={...s,owners:[...s.owners,candidate]},next=local.w.nextId;
  const errors=validateWorldPawnOwners256(nextState,{...w,nextId:next},occupiedIds(w),undefined,new Set(w.pawns.map(q=>q.id)));
  if(errors.length||!validWorldPawnsEnvelope256({worldPawns:nextState},w.schemaVersion,effectiveCore297(w),next)){
   notes.def('world','Survivant laissé derrière','dropped',undefined,`État réel incompatible : ${errors[0]??'enveloppe'}`);continue;
  }
  s.owners=nextState.owners;w.nextId=next;for(const [key,id] of local.thingIds)ctx.thingIds.set(key,id);adopted.add(t.id);mergeNotes(notes,local.notes);
  notes.def('world','Survivant laissé derrière',entry.mode==='active'?'exact':'adapted','original avec possessions',entry.mode==='mothballed'?'Le modèle actuel conserve le vrai humain hors carte mais ne sait pas le placer en hibernation logique (mothballed).':undefined);
 }
}

/** Each held person and their possessions is staged with the actual holder,
 * and committed only if the original owner's existing validator accepts it.
 * No pawn is spawned on the map, no remote human identity is copied. */
function importHeldPeople(ctx:ImportContext,rows:readonly WorldSourceHuman[],adopted:Set<string>):void {
 const {w,notes}=ctx,sourceIds=new Map(rows.map(r=>[r.thing.id,r.thing]));
 const asThing=(node:XmlNode):RwsThing|undefined=>text(node,'def')?readThing(node):sourceIds.get(referencedThingId(text(node))??'');
 const freeze=(piles:MaterialPile[])=>{for(const pile of piles)if(isPerishable(pile.item)&&pile.rot)pile.rot={progress:rotAge(pile,w.tick),atTick:w.tick,rate:0};};
 const commit=(local:ImportContext)=>{w.nextId=local.w.nextId;for(const [key,id] of local.thingIds)if(key){ctx.thingIds.set(key,id);adopted.add(key);}mergeNotes(notes,local.notes);};
 for(const source of ctx.map.things){
  if(!['AncientCryptosleepCasket','CryptosleepCasket','Ship_CryptosleepCasket'].includes(source.def))continue;
  const id=ctx.thingIds.get(source.id),building=w.structures.find(s=>s.id===id);
  if(!building)continue;
  const content=items(source.node,'innerContainer/innerList');
  const refuseHolder=()=>{
   // This source casket was occupied. A counterfeit empty replacement is
   // not faithful; retract the private draft and its uncommitted mapping.
   w.structures=w.structures.filter(s=>s!==building);ctx.thingIds.delete(source.id);
   const table=notes.tallies.get('buildings');
   for(const [key,row] of table??[])if(row.def===source.def&&row.to===building.kind&&(row.status==='exact'||row.status==='adapted')){if(--row.count===0)table!.delete(key);break;}
   if((notes.after.get('buildings')??0)>0)notes.countAfter('buildings',-1);notes.def('buildings',source.def,'dropped',building.kind,'Caisson occupé dont aucun propriétaire réel n’a pu être importé ; pas de caisson vide fictif.');
  };
  if(isAncientCasket256(building)){
   const group=num(source.node,'groupID')??-1;
   if(Number.isSafeInteger(group)&&group>=0&&group<Number.MAX_SAFE_INTEGER){
    if(w.worldMaps?.nextAncientCasketGroupId!==undefined){building.casket.groupId=group;w.worldMaps.nextAncientCasketGroupId=Math.max(w.worldMaps.nextAncientCasketGroupId,group+1);}
    else notes.def('world','Groupe de capsules antiques','dropped',undefined,'Registre de groupes absent du monde local.');
   }
   for(const row of content){
    const t=asThing(row);
    if(!t||!t.id||ctx.thingIds.has(t.id)){notes.def('world','Contenu de capsule antique','dropped',undefined,'Référence absente ou déjà possédée ailleurs.');continue;}
    const local=isolated(ctx),candidate:AncientCasket256={...building,casket:{...building.casket,humans:[...building.casket.humans],items:[...building.casket.items]}};
    if(t.def==='Human'){
     if(text(t.node,'healthTracker/healthState')==='Dead'){notes.def('world','Humain mort en capsule','dropped',undefined,'Le propriétaire terminal requiert le corps et sa cause réelle de décès.');continue;}
     // Held Things retain their true last Position; Core's never-spawned
     // IntVec3.Invalid value is represented without granting map authority.
     const cell=t.pos?ctx.coordinates.cell(t.pos):{x:-1000,z:-1000},template=starterTemplate(local,t,cell);
     const p=template&&projectHuman(local,t,template,false);
     if(!p){notes.def('world','Humain en capsule antique','dropped',undefined,'Identité, faction ou état clinique source incompatible.');continue;}
     const goods=importGoods(local,t,p);freeze(goods.items);
     if(goods.packed.length){
      notes.def('world','Meubles miniaturisés en capsule antique','dropped',undefined,'Le propriétaire antique ne dispose pas de tableau de meubles emballés.',goods.packed.length);
      const discardedIds=new Set(goods.packed.map(g=>g.building.id));
      for(const [key,id] of local.thingIds)if(discardedIds.has(id))local.thingIds.delete(key);
     }
     candidate.casket.humans.push(p);candidate.casket.items.push(...goods.items);
    }else{
     if(t.cls==='Pawn'||t.def==='MinifiedThing'){notes.def('world','Contenu de capsule antique','dropped',undefined,'Propriétaire imbriqué non admis par le modèle antique actuel.');continue;}
     const owner={type:'ground' as const,x:building.x,z:building.z};
     const pile=Object.hasOwn(APPAREL_MAP,t.def)||Object.hasOwn(WEAPON_MAP,t.def)?placeGear(local,t,owner):placeRwsMaterial(local,t,owner);
     if(!pile){mergeNotes(notes,local.notes);continue;}
     freeze(local.w.piles);
     candidate.casket.items.push(...local.w.piles.map((p):AncientHeldPile256=>({...p,owner:{type:'ancient-casket',casketId:building.id}})));
    }
    const errors=validateAncientCasketRecord256(candidate,{...w,nextId:local.w.nextId});
    if(errors.length){notes.def('world',`Contenu antique : ${t.def}`,'dropped',undefined,`Propriétaire existant incompatible : ${errors[0]}`);continue;}
    building.casket=candidate.casket;commit(local);
    notes.def('world',t.def==='Human'?'Humain en capsule antique':'Objet en capsule antique','adapted','propriétaire et contenu réels','Horloge de suspension ancrée à l’observation sauvegardée ; date d’entrée non enregistrée.');
   }
   if(content.length&&!building.casket.humans.length&&!building.casket.items.length&&!building.casket.animals.length)refuseHolder();
   continue;
  }
  if(!content.length)continue;
  if(!isPlayerCasket271(building)&&!isShipCasket277(building))continue;
  const t=content.length===1?asThing(content[0]!):undefined;
  if(!t||t.def!=='Human'||!t.id||ctx.thingIds.has(t.id)||text(t.node,'healthTracker/healthState')==='Dead'){
   notes.def('world','Capsule spatiale occupée','dropped',undefined,'Le modèle actuel demande un occupant humain vivant unique et son véritable propriétaire.');refuseHolder();continue;
  }
  const local=isolated(ctx),cell=t.pos&&ctx.inside(ctx.coordinates.cell(t.pos))?ctx.coordinates.cell(t.pos):{x:building.x,z:building.z};
  const template=starterTemplate(local,t,cell),p=template&&projectHuman(local,t,template,false);
  if(!p){notes.def('world','Humain en capsule spatiale','dropped',undefined,'Identité, faction ou état clinique source incompatible.');refuseHolder();continue;}
  const goods=importGoods(local,t,p);freeze(goods.items);
  const context={...w,nextId:local.w.nextId},people=new Set([...captureRelationshipPeople(w).keys(),p.id]);
  let errors:string[];
  if(isPlayerCasket271(building)){
   p.cryptosleepHeldAt271=w.tick;
   const candidate:PlayerCasket271={...building,cryptosleep:{...building.cryptosleep,heldAt:w.tick,heldAtCore297:effectiveCore297(w),human:p,...goods}};
   errors=validateRetainedCryptosleepOwner271(candidate,context,people,w.tick,effectiveCore297(w));
   if(!errors.length)building.cryptosleep=candidate.cryptosleep;
  }else{
   p.shipCryptosleepHeldAt277=w.tick;
   const candidate:ShipCasket277={...building,shipCryptosleep277:{...building.shipCryptosleep277,heldAt:w.tick,heldAtCore297:effectiveCore297(w),occupant:{kind:'human',pawn:p},...goods}};
   errors=validateRetainedShipCasketOwner277(candidate,context,people,w.tick,effectiveCore297(w));
   if(!errors.length)building.shipCryptosleep277=candidate.shipCryptosleep277;
  }
  if(errors.length){notes.def('world','Humain en capsule spatiale','dropped',undefined,`Propriétaire existant incompatible : ${errors[0]}`);refuseHolder();continue;}
  commit(local);notes.def('world','Humain en capsule spatiale','adapted','original avec possessions','Horloge de suspension et position du propriétaire ancrées à l’observation sauvegardée.');
 }
}

/** Capture real holders before resolving social endpoints. Source bodies
 * already adopted by the corpse transaction must not become a second owner. */
export function importWorldPeople(ctx:ImportContext):void {
 const rows=sourceWorldHumans(ctx),adopted=new Set<string>();
 importHeldPeople(ctx,rows,adopted);importLeaders(ctx,rows,adopted);importStartingLeftBehind(ctx,rows,adopted);
 for(const row of rows){
  if(adopted.has(row.thing.id)||ctx.thingIds.has(row.thing.id))continue;
  ctx.notes.def('world',row.mode==='dead'?'Personne décédée hors carte':'Personne hors carte','dropped',undefined,row.mode==='dead'?'Corps absent, non admis par le modèle clinique terminal ou provenance de sortie de carte non enregistrée : aucune cause ni carte inventée.':'Propriétaire historique sans carte d’origine réelle identifiée : non inventée.');
 }
}
