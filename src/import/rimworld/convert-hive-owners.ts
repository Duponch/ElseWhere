/** Reconnect the actual CompSpawnerPawn and local Lord owners only once all
 * original animals and hives have acquired their imported physical IDs. */
import type {ImportContext} from './convert.ts';
import type {RwsThing} from './rws-save.ts';
import {at,dictionary,items,num,text,type XmlNode} from './xml.ts';
import type {HiveLord256} from '../../sim/cave-hive-state-256.ts';
import type {HiveInsectMembership256} from '../../sim/cave-insect-constructor-256.ts';
import {isCaveInsectSpecies256} from '../../sim/cave-insect-constructor-256.ts';
import {validateCaveHiveOwners256} from '../../sim/cave-hive-save-256.ts';
import type {Structure} from '../../sim/types.ts';
import type {WildAnimal} from '../../sim/wildlife-state.ts';
import type {GapOrigin} from './gap-origin.ts';

const sourceRef=(n:XmlNode):string|undefined=>text(n)?.replace(/^Thing_/,'');
const integer=(n:number|undefined,lo:number,hi:number):n is number=>n!==undefined&&Number.isSafeInteger(n)&&n>=lo&&n<=hi;
const byNumber=(n:XmlNode|undefined,key:number):XmlNode|undefined=>dictionary(n).find(([k])=>num(k)===key)?.[1];
const phases=['defend-expand','defend-aggressive','assault'] as const;

export function importRwsHiveOwners(ctx:ImportContext):void {
 const {w,map,notes}=ctx,owner=w.wildlife,insect=w.worldFactions?.factions.find(f=>f.def==='Insect')?.id;
 if(!owner||insect===undefined)return;
 const animals=new Map(owner.animals.map(a=>[a.id,a])),structures=new Map(w.structures.map(s=>[s.id,s])),
  actualAnimals=new Map<string,WildAnimal>(),actualHives=new Map<string,Structure>(),
  membership=new Map<number,HiveInsectMembership256>(),spawned=new Map<number,number[]>(),
  stagedLords=[...(owner.hiveLords??[])],sourceLords=items(map.node,'lordManager/lords'),
  allocator=w.worldMaps??(w.campaignMap?.revision===2?w.campaignMap:undefined),
  actualNext=allocator?.nextLordId,clock=w.tick*10;
 let nextLord=actualNext;
 const acceptedLords:{sourceId:number;lord:HiveLord256;phaseClockAdapted:boolean}[]=[];
 const gap=(def:string,why:string,origin:GapOrigin,status:'adapted'|'dropped'='dropped')=>notes.def('building-state',def,status,undefined,why,1,origin);
 const sourceFaction=(t:RwsThing):number|undefined=>t.faction===undefined?undefined:ctx.factionIds?.get(t.faction)??(t.faction===ctx.save.playerFaction?w.worldFactions?.playerFactionId:undefined);
 for(const t of map.things){
  const id=ctx.thingIds.get(t.id);if(id===undefined)continue;
  const a=animals.get(id),h=structures.get(id);
  if(t.cls==='Pawn'&&a&&isCaveInsectSpecies256(a.species)){
   const faction=sourceFaction(t);if(faction!==undefined&&w.worldFactions?.factions.some(f=>f.id===faction)){
    membership.set(id,{factionId:faction,lordId:null,spawnerId:null});actualAnimals.set(t.id,a);
   }else if(t.faction)gap(t.def,'Faction de cet insecte source non résolue.','importer');
  }
  if(t.def==='Hive'&&h?.kind==='insect-hive'&&h.caveHive){actualHives.set(t.id,h);spawned.set(h.id,[]);}
 }
 // Both directions are staged from the same physical receipt. A foreign,
 // absent, or multiply claimed insect is not attached to an arbitrary hive.
 const claims=new Map<number,Set<number>>();
 for(const t of map.things){
  const hive=actualHives.get(t.id);if(!hive)continue;
  for(const n of items(t.node,'spawnedPawns')){
   const key=sourceRef(n),a=key?actualAnimals.get(key):undefined;
   if(!a||membership.get(a.id)?.factionId!==insect){gap('Insecte engendré par une ruche','Insecte local référencé par la ruche non converti ou faction différente.','importer');continue;}
   const claimed=claims.get(a.id)??new Set<number>();claimed.add(hive.id);claims.set(a.id,claimed);
  }
 }
 for(const [id,hives] of claims){
  if(hives.size!==1){gap('Insecte engendré par une ruche','Plusieurs ruches source revendiquent le même insecte.','source');continue;}
  const hiveId=[...hives][0]!;membership.get(id)!.spawnerId=hiveId;spawned.get(hiveId)!.push(id);
 }
 // Distinct Lord namespace; never collide with a mechanism/human group or
 // use a Thing identity as a Lord identity. No new group absent in the RWS.
 const lordSourceIds=new Set<number>(),memberClaims=new Map<number,number>(),lordRows:{node:XmlNode;members:number[];sourceId:number}[]=[];
 for(const lord of sourceLords){
  if(at(lord,'lordJob')?.attrs?.Class!=='LordJob_DefendAndExpandHive')continue;
  const sourceId=num(lord,'loadID')??0;
  if(!integer(sourceId,0,2147483645)||lordSourceIds.has(sourceId)){gap('Lord de ruche','Identité originale de Lord invalide ou dupliquée.','source');continue;}
  lordSourceIds.add(sourceId);
  if(ctx.factionIds?.get(text(lord,'faction')??'')!==insect){gap('Lord de ruche','Faction originale de Lord non résolue.','importer');continue;}
  const members:number[]=[];
  for(const n of items(lord,'ownedPawns')){
   const key=sourceRef(n),a=key?actualAnimals.get(key):undefined;
   if(!a||membership.get(a.id)?.factionId!==insect){gap('Membre de Lord de ruche','Insecte original référencé non converti.','importer');continue;}
   if(members.includes(a.id)){gap('Membre de Lord de ruche','Référence d’insecte dupliquée.','source');continue;}
   members.push(a.id);memberClaims.set(a.id,(memberClaims.get(a.id)??0)+1);
  }
  if(!members.length&&items(lord,'ownedPawns').length)continue;
  lordRows.push({node:lord,members,sourceId});
 }
 const assignments=(toil:XmlNode|undefined,members:Set<number>,report:boolean):HiveLord256['assignedHives']=>{
  const result:HiveLord256['assignedHives']=[],seen=new Set<number>();
  for(const [key,value] of dictionary(at(toil,'assignedHives'))){
   const a=actualAnimals.get(sourceRef(key)??''),h=actualHives.get(sourceRef(value)??'');
   if(!a||!h||!members.has(a.id)||seen.has(a.id)){
    if(report)gap('Mission de ruche','Référence de mission à un insecte ou une ruche non convertis, ou contradictoire.','importer');continue;
   }
   result.push({pawnId:a.id,hiveId:h.id});seen.add(a.id);
  }return result;
 };
 for(const {node,members,sourceId} of lordRows){
  // Core 1.6 graph insertion order: DefendAndExpand, DefendHiveAggressively,
  // Assault. InsectLair's special NestAssault is a separate missing model.
  const toil=num(node,'curLordToilIdx');
  if(!integer(toil,0,2)||text(map.node,'generatorDef')==='InsectLair'){
   gap('Lord de ruche','Phase de Lord ou mission d’assaut de nid hors modèle.','model');continue;
  }
  if(!members.every(id=>memberClaims.get(id)===1)){
   gap('Lord de ruche','Insecte revendiqué par plusieurs Lords source ; aucun groupe inventé.','source');continue;
  }
  if(!allocator||!integer(nextLord,0,2147483645)){
   gap('Lord de ruche','Autorité distincte des IDs de Lord non convertie.','importer');continue;
  }
  const rawHarm=num(node,'lastPawnHarmTick')??-99999;
  let lastHarm=Math.max(0,Math.min(clock,rawHarm)),phaseClockAdapted=lastHarm!==rawHarm;
  if(toil!==0){
   // Transition 6 has Core Trigger_TicksPassedWithoutHarmOrMemos, flattened
   // trigger index 10. Its counter, not merely lastPawnHarmTick, includes hive
   // attack/despawn/burning memos, and therefore determines quiet expiry.
   const quiet=byNumber(at(node,'triggerData'),10),elapsed=quiet?num(quiet,'ticksPassed')??0:undefined;
   if(!integer(elapsed,0,ctx.save.ticksGame)){
    gap('Lord de ruche','Compteur original de retour au calme introuvable.','source');continue;
   }
   lastHarm=Math.min(clock,ctx.save.ticksGame-elapsed);
   // The engine has the same quiet duration but a committed macro boundary
   // and no separate lastPawnHarmTick beside the quiet trigger timer.
   phaseClockAdapted=lastHarm!==ctx.save.ticksGame-elapsed||lastHarm!==rawHarm;
  }
  if(!integer(lastHarm,0,clock)){
   gap('Lord de ruche','Horloge originale du Lord non représentable.','model');continue;
  }
  const memberSet=new Set(members),cached=at(node,'lordToilData'),primary=toil===1?1:0,
   primaryToil=byNumber(cached,primary),otherToil=byNumber(cached,1-primary),
   assigned=assignments(primaryToil,memberSet,true),other=assignments(otherToil,memberSet,false);
  if(other.length&&JSON.stringify([...assigned].sort((a,b)=>a.pawnId-b.pawnId))!==JSON.stringify([...other].sort((a,b)=>a.pawnId-b.pawnId)))
   gap('Cache de mission de Lord','Core garde deux caches indépendants ; seul le cache de mission actuelle (ou du retour après assaut) est représentable.','model','adapted');
  if(items(node,'ownedBuildings').length||items(node,'ownedCorpses').length||items(node,'extraForbiddenThings').length||items(node,'questTags').length)
   gap('Propriétés de mission de Lord','Propriétaires supplémentaires, interdictions ou signaux de quête du Lord non représentés.','model','adapted');
  const id=nextLord++,lord:HiveLord256={id,factionId:insect,aggressive:text(node,'lordJob/aggressive')==='True',phase:phases[toil]!,lastHarmCore:lastHarm,memberIds:members,assignedHives:assigned};
  stagedLords.push(lord);for(const member of members)membership.get(member)!.lordId=id;
  acceptedLords.push({sourceId,lord,phaseClockAdapted});
 }
 if(!membership.size&&!spawned.size&&!lordRows.length)return;
 const stagedAnimals=owner.animals.map(a=>membership.has(a.id)?{...a,hive:membership.get(a.id)!}:a),
  stagedStructures=w.structures.map(s=>spawned.has(s.id)?{...s,caveHive:{...s.caveHive!,spawnedPawnIds:spawned.get(s.id)!}}:s),
  stagedWildlife={...owner,animals:stagedAnimals,hiveLords:stagedLords};
 const errors=validateCaveHiveOwners256({...w,structures:stagedStructures,wildlife:stagedWildlife},w.schemaVersion,
  nextLord===undefined?undefined:{nextId:nextLord});
 if(errors.length){gap('Propriétaires de ruche',`Graphe original non admis sans réécriture : ${errors.join('; ')}`,'unresolved');return;}
 // Commit only after validating reciprocal source graph. Retain existing
 // in-memory identities for other importer consumers.
 for(const [id,field] of membership)animals.get(id)!.hive=field;
 for(const [id,ids] of spawned)structures.get(id)!.caveHive!.spawnedPawnIds=ids;
 if(stagedLords.length||owner.hiveLords)owner.hiveLords=stagedLords;
 if(allocator&&nextLord!==undefined)allocator.nextLordId=nextLord;
 for(const {sourceId,lord,phaseClockAdapted} of acceptedLords){
  notes.def('building-state','Lord de ruche','exact',`${lord.memberIds.length} insectes originaux`,`Lord source ${sourceId}, mission ${lord.phase}, références rétablies.`);
  if(phaseClockAdapted)gap('Chronomètre de Lord','Compteur de calme repris ; modèle à frontière macro sans second compteur lastPawnHarmTick.','model','adapted');
 }
 const count=[...spawned.values()].reduce((n,x)=>n+x.length,0);
 if(count)notes.def('building-state','Insectes engendrés par les ruches','exact','liens physiques réciproques',undefined,count);
 if(membership.size)notes.def('animals','Faction d’insecte','exact','propriétaire original',undefined,membership.size);
}
