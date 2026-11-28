/** Restore actual social and mood records, under the current clock model.
 * A map starts at its adopted local tick, not the source campaign's absolute
 * tick; records requiring an absolute departure date cannot always encode
 * the old age. Retain remaining duration for expiry-based memories, and mark
 * the closest currently representable state as adapted elsewhere. */
import type {Pawn,Memory} from '../../sim/types.ts';
import {TICKS_PER_DAY} from '../../sim/types.ts';
import type {ImportContext} from './convert.ts';
import {referencedThingId,readThing,type RwsThing} from './rws-save.ts';
import {items,num,text} from './xml.ts';
import type {XmlNode} from './xml.ts';
import {socialSeed,socialMemoryDuration,memoryOffset,type SocialKind,type SocialMemory} from '../../sim/social-state.ts';
import {validateHumanSocial} from '../../sim/social-save.ts';
import {relationshipLinkCompare,type RelationshipKind,type RelationshipLink} from '../../sim/relationship-state.ts';
import {validateRelationships} from '../../sim/relationship-save.ts';
import {captureRelationshipPeople} from '../../sim/relationship-namespace.ts';
import {validRoomExperience,type RoomMemory,type RoomMemoryKind} from '../../sim/room-experience.ts';
import {ROOM_MEMORY_DURATION,ROOM_MEMORY_OFFSETS} from '../../sim/room-impressiveness.ts';
import {FIRST_DAYS_MEMORIES_343,isFirstDaysMemory343} from '../../sim/first-days-memories-343.ts';
import {MOOD_POOL_MEMORIES_350,isMoodPoolMemory350} from '../../sim/mood-pool-memories-350.ts';
import {COUPLE_MEMORY_DURATION_285,validCoupleMemories285} from '../../sim/couple-memories-285.ts';
import {sourceWorldHumans} from './import-world-people.ts';
type Human={thing:RwsThing;pawn:Pawn};
const relationKinds:Readonly<Record<string,RelationshipKind>>={Parent:'parent',Child:'parent',Sibling:'sibling',Lover:'lover',Spouse:'spouse',ExLover:'ex-lover',ExSpouse:'ex-spouse'};
const socialKinds:Readonly<Record<string,SocialKind>>={Chitchat:'chitchat',DeepTalk:'deep-talk',RapportBuilt:'rapport',KindWords:'kind-words',Slighted:'slight',Insulted:'insult',SocialFightCatharsis:'fight-cathartic',SocialFightAnger:'fight-angering',RecruitedMe:'recruited-me',CrashedTogether:'crashed-together',RescuedMe:'rescued-me'};
const mealKinds:Readonly<Record<string,Memory['kind']>>={AteWithoutTable:'ate-without-table',AteRawFood:'ate-raw-food',AteFineMeal:'ate-fine-meal',AteLavishMeal:'ate-lavish-meal',AteNutrientPaste:'ate-nutrient-paste',AteKibble:'ate-kibble'};
const roomKinds:Readonly<Record<string,RoomMemoryKind>>={SleptInBedroom:'bedroom',SleptInBarracks:'barracks',AteInImpressiveDiningRoom:'dining',JoyActivityInImpressiveRecRoom:'recreation',
 SleptInCold:'slept-in-cold',SleptInHeat:'slept-in-heat',SleptOutside:'slept-outside',SleptOnGround:'slept-on-ground',SoakingWet:'soaking-wet',SleepDisturbed:'sleep-disturbed',Nuzzled:'nuzzled',ReleasedHealthyPrisoner:'released-prisoner',BondedAnimalDied:'bonded-animal-died',BondedAnimalLost:'bonded-animal-lost',BondedAnimalReleased:'bonded-animal-released',ColonistBanished:'colonist-banished',ColonistBanishedToDie:'colonist-banished-to-die'};
const fallbackOffset:Partial<Record<SocialKind,number>>={'deep-talk':15,rapport:2,'kind-words':15,slight:-5,insult:-15,'fight-cathartic':38,'fight-angering':-22,'recruited-me':20,'crashed-together':25,'rescued-me':15};
const endpoint=(ctx:ImportContext,node:XmlNode):number|undefined=>{
 const ref=referencedThingId(text(node,'otherPawn'));return ref?ctx.thingIds.get(ref):undefined;
};
const ageCore=(node:XmlNode)=>num(node,'age')??0;
const ageLocal=(node:XmlNode)=>Math.max(0,Math.floor(ageCore(node)/10));
const memoryRows=(node:XmlNode):XmlNode[]=>items(node,'needs/needs').filter(n=>text(n,'def')==='Mood').flatMap(n=>items(n,'thoughts/memories/memories'));

function importRelationships(ctx:ImportContext,humans:readonly Human[],humanIds:ReadonlySet<number>):void {
 const {w,notes}=ctx,people=captureRelationshipPeople(w);
 const candidates:{link:RelationshipLink;def:string;at:number}[]=[],seen=new Set<string>();
 for(const {thing,pawn} of humans)for(const row of items(thing.node,'social/directRelations')){
  const def=text(row,'def')??'?',kind=relationKinds[def],other=endpoint(ctx,row);
  if(def==='Bond')continue; // animal's dedicated owner imports this bond.
  if(!kind||other===undefined||!humanIds.has(other)||other===pawn.id){
   notes.def('social',`Relation : ${def}`,'dropped',undefined,!kind?'Type de relation absent du modèle.':'Personne référencée non importée.');continue;
  }
  const aId=def==='Parent'?pawn.id:def==='Child'?other:Math.min(pawn.id,other),
   bId=def==='Parent'?other:def==='Child'?pawn.id:Math.max(pawn.id,other);
  const key=`${kind}:${aId}:${bId}`;if(seen.has(key))continue;seen.add(key);
  const at=num(row,'startTicks')??0;
  candidates.push({link:{kind,aId,bId,recordedAt:Math.max(0,Math.min(w.tick,Math.floor(at/10)))},def,at});
 }
 // Retain kinship first, then the most recent actual active partner when
 // Core has multiple living partners (the current EW graph allows one).
 const weight=(l:RelationshipLink)=>l.kind==='parent'||l.kind==='sibling'?0:l.kind==='lover'||l.kind==='spouse'?1:2;
 candidates.sort((a,b)=>weight(a.link)-weight(b.link)||b.at-a.at||relationshipLinkCompare(a.link,b.link));
 // Base generation can create links between the placeholder starters. Those
 // IDs now own source people, not the generated identities: neither retain
 // a fictional link nor let it block a real source relation.
 const links:RelationshipLink[]=[];
 for(const {link,def,at} of candidates){
  const next=[...links,link].sort(relationshipLinkCompare),errs:string[]=[];
  if(validateRelationships({links:next},{tick:w.tick,nextId:w.nextId,people},w.schemaVersion,errs)){
   links.push(link);notes.def('social',`Relation : ${def}`,at===link.recordedAt*10?'exact':'adapted',link.kind,at===link.recordedAt*10?undefined:'Horodatage arrondi au tick local.');
  }else notes.def('social',`Relation : ${def}`,'dropped',link.kind,`Graphe actuel incompatible : ${errs[0]??'invariant'}`);
 }
 if(links.length)w.relationships={links:links.sort(relationshipLinkCompare)};
 else delete w.relationships;
}

function importMemories(ctx:ImportContext,h:Human,humanIds:ReadonlySet<number>):void {
 const {w,notes}=ctx,{pawn:p,thing}=h;
 const rows=memoryRows(thing.node).sort((a,b)=>ageCore(a)-ageCore(b));
 p.social??={rng:socialSeed(w.seed,p.id),memories:[]};
 for(const row of rows){
  const def=text(row,'def')??'?',age=ageLocal(row),meal=mealKinds[def],room=roomKinds[def];
  const exactTime=ageCore(row)%10===0,plainMood=(num(row,'moodPowerFactor')??1)===1;
  if(meal){
   if(age>=TICKS_PER_DAY||p.memories.some(m=>m.kind===meal)){notes.def('social',def,'dropped',meal,'Souvenir expiré ou doublon non admis.');continue;}
   p.memories.push({kind:meal,expiresAt:w.tick+TICKS_PER_DAY-age});
   notes.def('social',def,exactTime&&plainMood?'exact':'adapted',meal,'Durée restante reprise.');continue;
  }
  if(room){
   const pool=isMoodPoolMemory350(room)?MOOD_POOL_MEMORIES_350[room]:undefined;
   const duration=pool?.duration??(isFirstDaysMemory343(room)?FIRST_DAYS_MEMORIES_343[room].duration:ROOM_MEMORY_DURATION);
   const otherId=pool?.perOther?endpoint(ctx,row):undefined;
   if(age>=duration||pool?.perOther&&otherId===undefined){notes.def('social',def,'dropped',room,'Souvenir expiré ou référent absent.');continue;}
   const stage=pool||isFirstDaysMemory343(room)?0:num(row,'stageIndex')??0;
   const entry:RoomMemory={kind:room,stage,expiresAt:w.tick+duration-age,...otherId!==undefined?{otherId}:{}};
   const next=[...(p.roomMemories??[]),entry];
   if(validRoomExperience({...p,roomMemories:next},w.schemaVersion,w.tick)){
    p.roomMemories=next;notes.def('social',def,exactTime&&plainMood?'exact':'adapted',room,'Durée restante reprise.');
   }else notes.def('social',def,'dropped',room,'Stade ou cumul incompatible avec les règles actuelles.');
   continue;
  }
  const kind=socialKinds[def],other=endpoint(ctx,row);
  if(def==='GotSomeLovin'){
   if(other===undefined||!humanIds.has(other)||other===p.id||age>=COUPLE_MEMORY_DURATION_285){notes.def('social',def,'dropped',undefined,'Partenaire absent ou souvenir expiré.');continue;}
   const at=Math.max(0,w.tick-age),next=[...(p.coupleMemories285??[]),{otherId:other,at}];
   if(validCoupleMemories285(next,w.schemaVersion,w.tick)){
    p.coupleMemories285=next;notes.def('social',def,age<=w.tick&&exactTime?'exact':'adapted','souvenir intime',age>w.tick?'Âge antérieur à l’horloge de la carte ; date bornée.':undefined);
   }else notes.def('social',def,'dropped',undefined,'Cumul incompatible.');
   continue;
  }
  if(!kind||other===undefined||!humanIds.has(other)||other===p.id){
   notes.def('social',def,'dropped',kind,!kind?'Souvenir non représenté dans le modèle actuel.':'Personne référencée non importée.');continue;
  }
  const raw=num(row,'opinionOffset')??fallbackOffset[kind];
  const duration=socialMemoryDuration(kind),at=Math.max(0,w.tick-age);
  if(raw===undefined||raw===0||(kind!=='chitchat'&&age>=duration)){
   notes.def('social',def,'dropped',kind,'Valeur nulle, absente ou souvenir expiré.');continue;
  }
  // EW's active opinion curve agrees with Core for these supported kinds.
  // When the old creation tick is negative in the adopted clock, variable
  // offsets may encode the current decayed effect (not its future expiry).
  let offset=raw;
  if(kind==='chitchat'&&age>w.tick)offset=Math.max(0,raw-Math.floor((age-w.tick)/TICKS_PER_DAY));
  else if(age>w.tick&&!['fight-cathartic','fight-angering','recruited-me','crashed-together','rescued-me'].includes(kind)){
   const target=memoryOffset({otherId:other,kind,at:0,offset:raw},age);
   const factor=memoryOffset({otherId:other,kind,at,offset:1},w.tick);
   if(factor>0)offset=target/factor;
  }
  const memory:SocialMemory={kind,otherId:other,at,offset};
  p.social.memories.push(memory);
  if(validateHumanSocial(p,w.schemaVersion,w.tick,humanIds,w.pawns).length){
   p.social.memories.pop();notes.def('social',def,'dropped',kind,'Valeur ou cumul incompatible avec les règles actuelles.');continue;
  }
  const adapted=age>w.tick||offset!==raw||!exactTime||!plainMood;
  notes.def('social',def,adapted?'adapted':'exact',kind,adapted?'Effet d’opinion conservé au plus proche ; âge antérieur à l’horloge locale ou autre facteur non représenté.':undefined);
 }
 if(!p.social.memories.length)delete p.social;
}

export function importHumanSocial(ctx:ImportContext,humans:readonly Human[]):void {
 // Only actual source-mapped originals participate. Generated external
 // placeholders must not receive a fictional relationship merely because
 // their label resembles a reference.
 const owners=new Map<number,Pawn>();
 for(const row of ctx.w.worldPawns?.owners??[])if(row.kind==='human')owners.set(row.actor.id,row.actor);
 const leaders=new Map((ctx.w.worldFactions?.leaders??[]).map(l=>[l.pawn.id,l.pawn]));
 const local=new Map(ctx.w.pawns.filter(p=>p.state==='dead'||p.health?.death).map(p=>[p.id,p]));
 const held=new Map<number,Pawn>();
 for(const s of ctx.w.structures){
  for(const p of s.casket?.humans??[])held.set(p.id,p);
  if(s.cryptosleep?.human)held.set(s.cryptosleep.human.id,s.cryptosleep.human);
  const occupant=s.shipCryptosleep277?.occupant;if(occupant?.kind==='human')held.set(occupant.pawn.id,occupant.pawn);
 }
 // Some actual dead/held people are deeply serialized inside their physical
 // owner, not separately listed in WorldPawns. Do not invent a second owner.
 const buried:RwsThing[]=[];
 const nested=(node:XmlNode)=>{for(const row of items(node,'innerContainer/innerList')){
  if(text(row,'def')==='Human')buried.push(readThing(row,'Pawn'));
  else if(row.attrs?.Class==='Corpse')nested(row);
 }};
 for(const thing of ctx.map.things){if(thing.cls==='Corpse'||['Grave','Sarcophagus','AncientCryptosleepCasket','CryptosleepCasket','Ship_CryptosleepCasket'].includes(thing.def))nested(thing.node);}
 const seen=new Set(humans.map(h=>h.pawn.id));
 const external:Human[]=[],externalMemories:Human[]=[];
 for(const thing of [...sourceWorldHumans(ctx).map(r=>r.thing),...buried]){
  const id=ctx.thingIds.get(thing.id),p=id===undefined?undefined:owners.get(id)??leaders.get(id)??local.get(id)??held.get(id);
  if(!p||seen.has(p.id))continue;seen.add(p.id);
  const h={thing,pawn:p};external.push(h);
  // The current actual faction leader's closed owner whitelist does not
  // admit social/memory fields. Its relationship graph can still refer to it.
  if(owners.has(p.id)&&p.state!=='dead'&&!p.health?.death)externalMemories.push(h);
 }
 const all=[...humans,...external],ids=new Set(all.map(h=>h.pawn.id));
 importRelationships(ctx,all,ids);
 for(const h of [...humans,...externalMemories])importMemories(ctx,h,ids);
}
