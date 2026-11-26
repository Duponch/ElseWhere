import {appendPileEntries} from './pile-identity-directory.ts';
import {giveBornTraits361} from './trait-generation-361.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {mechRaidGroup261} from './mechanical-raid-groups-261.ts';
import {tempMapModern261} from './temp-map-incidents-261.ts';
import {raidGroup261} from './temp-map-raids-261.ts';
import {groupProfiles} from './visitors.ts';
import {visitorPoints,visitorRandom,type VisitorCalendar} from './visitor-state.ts';
import {isColonist,distanceSquared} from './affiliation.ts';
import {candidateAccess} from './candidate-access.ts';
import {civilianAdmissionFits,civilianAwayCounts} from './civilian-away.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {hiveDoorFreePassage256} from './cave-hive-closewalk-256.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import {captureRandomClosewalk256,tryRandomClosewalkCellNear256} from './random-closewalk-256.ts';
import {stagedCampArrivalRandom256} from './camp-center-entry-256.ts';
import {footprintCells} from './definitions.ts';
import {carrierOf} from './rescue-state.ts';
import {kidnapCarrierOf261} from './caravan-kidnap-261.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {isPassageDoor} from './door-rules.ts';
import {isRoofed} from './roof-rules.ts';
import {outdoorTemperature} from './temperature.ts';
import {climateTick,siteClimateDefinition,geographicSeasonTemperature256,geographicLongitudeOffsetCore256,seasonTemperature} from './site-climate.ts';
import {startingPawn} from './starting-pawns.ts';
import {generateBornBackground} from './background-generation.ts';
import {newApparelState} from './apparel-rules.ts';
import {freshRot} from './food-preservation.ts';
import type {Cell,Pawn,MaterialPile,World} from './types.ts';

const EMPTY:ReadonlySet<number>=new Set();
const peacefulDefs=new Set(['OutlanderCivil','OutlanderRough','TribeCivil','TribeRough','TribeSavage']);
const edge=(w:World,c:Cell)=>c.x===0||c.z===0||c.x===w.width-1||c.z===w.height-1;
const pick=<T>(values:readonly T[],random:{rng:number}):T|undefined=>values.length?values[Math.floor(visitorRandom(random)*values.length)]:undefined;
/** Core CellFinder edge procedure, with the existing campaign PRNG. Chance1
 * takes no chance draw (Rand.Chance), missing roads fall through normally. */
function randomEdge(w:World,random:{rng:number},roadChance:number,valid:(c:Cell)=>boolean):Cell|null {
 if(roadChance>=1||roadChance>0&&visitorRandom(random)<roadChance){
  const road=(w.roadInfo?.edgeCells??[]).map(i=>({x:i%w.width,z:Math.floor(i/w.width)})).filter(valid),chosen=pick(road,random);if(chosen)return {...chosen};
 }
 for(let k=0;k<100;k++){
  const vertical=visitorRandom(random)<.5,low=visitorRandom(random)<.5,c=vertical?{x:low?0:w.width-1,z:Math.floor(visitorRandom(random)*w.height)}:{x:Math.floor(visitorRandom(random)*w.width),z:low?0:w.height-1};
  if(valid(c))return c;
 }
 const cells:Cell[]=[];for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++)if(edge(w,{x,z}))cells.push({x,z});
 for(let i=cells.length-1;i>0;i--){const j=Math.floor(visitorRandom(random)*(i+1));[cells[i],cells[j]]=[cells[j]!,cells[i]!];}
 return cells.find(valid)??null;
}
function hostile(w:World,a:number,b:number):boolean {
 if(a===b)return false;
 return w.worldFactions!.relations.some(r=>(r.aId===a&&r.bId===b||r.aId===b&&r.bId===a)&&r.kind==='hostile');
}
/** Core4871 AnyBlockingHostileLord's actual asymmetric predicate. An enemy
 * assault against the map owner is explicitly not this neutral-group block.
 * Current human Lord jobs all allow blocking and none is VoluntarilyJoinable.
 * Wild manhunters have no Lord; dormant Temple mechs have no active pawn. */
export function blockingTempTravelerLord261(w:World,forFaction:number):boolean {
 const parent=w.worldFactions?.playerFactionId;if(parent===undefined)return false;
 const blocks=(id:number|undefined)=>id!==undefined&&id!==forFaction&&id!==parent&&hostile(w,id,forFaction)&&!hostile(w,id,parent);
 for(const g of w.visitors?.groups??[]){
  const members=w.pawns.filter(p=>p.visitor?.group===g.id&&g.members.includes(p.id)&&p.state!=='dead');
  if(members.some(p=>blocks(p.worldAffiliation259?.factionId??undefined)))return true;
 }
 // The real member mandate identifies every independent raid group; there
 // is no temporary active swap and no fabricated faction for historical pawns.
 for(const p of w.pawns)if(p.raid&&raidGroup261(w,p.raid.group)?.members.includes(p.id)&&!p.prisoner&&p.state!=='dead'&&blocks(p.worldAffiliation259?.factionId??undefined))return true;
 for(const m of w.mechanoids??[])if(m.state!=='dead'&&(mechRaidGroup261(w,m.raid?.group)?.members.includes(m.id)||m.temple?.awakeAtCore!==undefined&&m.temple.awakeAtCore!==null)&&blocks(m.worldFaction259?.factionId))return true;
 for(const lord of w.wildlife?.hiveLords??[])if(blocks(lord.factionId)&&(w.wildlife?.animals??[]).some(a=>lord.memberIds.includes(a.id)&&a.state!=='dead'))return true;
 return false;
}
function season(w:World):number {
 const d=siteClimateDefinition(w),civil=climateTick(w);
 return w.climate?.revision===4?geographicSeasonTemperature256(d,civil*10-geographicLongitudeOffsetCore256(d.longitude)):seasonTemperature(d.latitude,d.meanTemperature,civil);
}
/** Ground/Core no-expansion faction facts, inherited Outlander/Tribe Peaceful
 * makers and -40..45 arrival range. Candidate order is the real manager order.
 * Desperate resolution skips temperature only, exactly like PawnsArrive. */
function faction(w:World,random:{rng:number}):number|undefined {
 const registry=w.worldFactions;if(!registry)return;
 const outside=outdoorTemperature(w),seasonal=season(w);
 const candidates=registry.factions.filter(f=>f.id!==registry.playerFactionId&&!f.hidden&&!!f.lifecycle259&&!f.lifecycle259.defeated&&!f.lifecycle259.temporary
  &&peacefulDefs.has(f.def)&&!hostile(w,f.id,registry.playerFactionId)&&!blockingTempTravelerLord261(w,f.id));
 const temperate=outside>=-40&&outside<=45&&seasonal>=-40&&seasonal<=45;
 return pick(temperate?candidates:[],random)?.id??pick(candidates,random)?.id;
}
interface Entry261 {entry:Cell;blocked:Uint8Array;occupied:Set<number>;stand:(c:Cell)=>boolean}
function entry(w:World,random:{rng:number}):Entry261|null {
 const physical=captureActualLocalDistricts256(w),size=w.width*w.height,passDoors=Uint8Array.from({length:size},(_,i)=>physical.normalWalkable(i)?0:1),stand=(c:Cell)=>physical.standable(c.z*w.width+c.x);
 const occupied=new Set([...w.pawns,...w.wildlife?.animals??[],...w.mechanoids??[]].filter(p=>p.state!=='dead').flatMap(p=>[p.z*w.width+p.x,...p.motion&&p.motion.end>w.tick?[p.motion.from.z*w.width+p.motion.from.x]:[]]));
 const connected=new Uint8Array(size),queue=new Int32Array(size);let head=0,tail=0;
 const add=(i:number)=>{if(i>=0&&i<size&&!passDoors[i]&&!connected[i]){connected[i]=1;queue[tail++]=i;}};
 for(const p of w.pawns)if(isColonist(p)&&!p.prisoner&&p.state!=='dead'&&!carrierOf(w,p.id)&&!kidnapCarrierOf261(w,p.id))add(p.z*w.width+p.x);
 for(const a of w.wildlife?.animals??[])if(a.domestic&&a.state!=='dead'&&!animalCarrier(w,a.id))add(a.z*w.width+a.x);
 for(const s of w.structures)if(s.factionId===undefined||s.factionId===w.worldFactions!.playerFactionId)for(const c of footprintCells(s)){
  const i=c.z*w.width+c.x;if(c.z)add(i-w.width);if(c.x)add(i-1);if(c.x+1<w.width)add(i+1);if(c.z+1<w.height)add(i+w.width);
 }
 while(head<tail){const i=queue[head++]!,x=i%w.width;if(i>=w.width)add(i-w.width);if(x)add(i-1);if(x+1<w.width)add(i+1);if(i+w.width<size)add(i+w.width);}
 const chosen=randomEdge(w,random,.75,c=>{const i=c.z*w.width+c.x;return connected[i]===1&&stand(c)&&!isRoofed(w,i)&&w.tiles[i]!.fogged!==true&&physical.district(i)?.touchesMapEdge===true;});if(!chosen)return null;
 // Native NoPassClosedDoors uses FreePassage, including doors about to close.
 // Reuse the established live DoorState translation instead of open alone.
 const blocked=passDoors.slice();
 for(const s of w.structures)if(isPassageDoor(s.kind)&&!hiveDoorFreePassage256(w,s))blocked[s.z*w.width+s.x]=1;
 // The exact CanReach overload has no Pawn. Region.Allows gates DangerFor on
 // tp.pawn!=null, so Danger.None here invents no thermal/fire predicate.
 return {entry:{...chosen},blocked,occupied,stand};
}
/** Opposite edge first, then the exact native >10000 and >2500 fallbacks.
 * Native edge procedure uses road chance1 on all three destination attempts.
 * No visit-table or colony parking query participates in a Traveler arrival. */
function destination(w:World,e:Entry261,random:{rng:number}):Cell|null {
 const access=candidateAccess(w,e.entry,e.blocked,EMPTY,true),opposite=(c:Cell)=>e.entry.x===0?c.x===w.width-1:e.entry.x===w.width-1?c.x===0:e.entry.z===0?c.z===w.height-1:c.z===0;
 // Destination need not share the entry's fog/colony-reach predicate. It must
 // itself be standable, unroofed and reachable through FreePassage doors.
 const valid=(c:Cell)=>{const i=c.z*w.width+c.x;return !e.blocked[i]&&e.stand(c)&&!isRoofed(w,i)&&access.has(i);};
 for(const predicate of [opposite,(c:Cell)=>distanceSquared(c,e.entry)>10000,(c:Cell)=>distanceSquared(c,e.entry)>2500]){
  const chosen=randomEdge(w,random,1,c=>predicate(c)&&valid(c));if(chosen)return chosen;
 }
 return null;
}
function spawnSites(w:World,e:Entry261,count:number,random:{rng:number}):Cell[]|null {
 const passage=new Map(w.structures.filter(s=>isPassageDoor(s.kind)).map(s=>[s.z*w.width+s.x,e.blocked[s.z*w.width+s.x]===0]));
 const reach=captureGeographicGenerationReachability256(w,passage),capture=captureRandomClosewalk256(w,reach),stream=stagedCampArrivalRandom256(random.rng);
 const rng={value:stream.value,integer:stream.integer,float:(min:number,max:number)=>max<=min?min:Math.fround(Math.fround(stream.value()*Math.fround(max-min))+min)};
 const used=new Set(e.occupied),sites:Cell[]=[];
 try {
  for(let i=0;i<count;i++){
   const at=tryRandomClosewalkCellNear256(capture,e.entry.z*w.width+e.entry.x,5,rng,c=>!used.has(c),r=>r.type==='normal'||r.type==='fence'||r.type==='portal'&&passage.get(r.cells[0]!)===true);
   if(at===null)return null;used.add(at);sites.push({x:at%w.width,z:Math.floor(at/w.width)});
  }
  return sites;
 } finally {random.rng=stream.rng;}
}
/** Delegate of CaravanMeeting on the existing real TempMap, not Caravan target.
 * The same provisional actor/background/apparel/food producers are retained.
 * A supplied nonnegative points budget is preserved; only negative points use
 * the native Traveler curve. No trader role, trade stock or home agenda exists.
 * Rejected admission commits no identities, possessions or owner. Resolution
 * RNG survives every actual attempt, including failure; the caller commits it. */
export function admitTempMapTraveler261(w:World,points:number,random:{rng:number}):boolean {
 if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||!tempMapModern261(w)||!w.worldFactions||!Number.isFinite(points)||!Number.isInteger(random.rng)||random.rng<=0||random.rng>0xffffffff)return false;
 const old=w.visitors;
 if((old?.serial??0)>=Number.MAX_SAFE_INTEGER||(old?.departed.length??0)+w.pawns.length+civilianAwayCounts(w).people>=w.width*w.height)return false;
 const draft={rng:random.rng};
 try {
 const arrival=entry(w,draft);if(!arrival)return false;
 const factionId=faction(w,draft);if(factionId===undefined)return false;
 const budget=points<0?visitorPoints(draft,'traveler'):points,spot=destination(w,arrival,draft);if(!spot)return false;
 // ensureCanGenerateAtLeastOnePawn is projected through the already adopted
 // Peaceful local profile; its sole fighter minimum is60. The tribal roster
 // remains this same declared provisional producer, not a second points draw.
 const profiles=groupProfiles(draft,Math.max(60,budget));if(!profiles.length||!civilianAdmissionFits(w,profiles.length))return false;
 const id=(old?.serial??0)+1,pawns:Pawn[]=[],piles:MaterialPile[]=[];let nextId=w.nextId;
 for(let i=0;i<profiles.length;i++){
  const p=startingPawn(nextId++,`${profiles[i]} ${id}.${i+1}`,arrival.entry.x,arrival.entry.z,0,55,w.seed,w.tick,w.schemaVersion);
  p.faction='outlanders';p.worldAffiliation259={revision:1,factionId,hostFactionId:null,guestStatus:'Guest'};p.foodPolicyId=w.foodPolicies[0]!.id;
  delete p.apparelPolicyId;delete p.apparelAutomation;delete p.nextApparelCheckAt;
  for(const value of Object.values(p.skills))if(typeof value==='object'){value.level=0;value.passion=0;}
  generateBornBackground(w,p,w.seed,profiles[i]==='Garde',false,{violent:true});giveBornTraits361(w,p);
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  p.visitor={group:id,role:'traveler',phase:'arriving',goal:{...spot},personalFoodIds:[]};
  piles.push({id:nextId++,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState('cloth-shirt',undefined,w.schemaVersion)});
  const foodDraw=visitorRandom(draft),item=foodDraw<.75?'simple-meal':'survival-meal',quantity=visitorRandom(draft)<5/6?3:2,foodId=nextId++;
  piles.push({id:foodId,kind:'food',item,quantity,owner:{type:'inventory',pawnId:p.id},...freshRot(item,w.tick)});p.visitor.personalFoodIds=[foodId];pawns.push(p);
 }
 if(!Number.isSafeInteger(nextId)||!civilianAdmissionFits(w,pawns.length,piles.length))return false;
 const sites=spawnSites(w,arrival,pawns.length,draft);if(!sites)return false;
 for(let i=0;i<pawns.length;i++)Object.assign(pawns[i]!,sites[i]!);
 const owner:VisitorCalendar=old??{profile:'temp-travelers261-v1',adoptedAt:w.tick,rng:draft.rng,serial:0,groups:[],departed:[]};
 w.nextId=nextId;w.pawns.push(...pawns);appendPileEntries(w.piles,...piles);owner.serial=id;
 owner.groups.push({id,kind:'traveler',members:pawns.map(p=>p.id),entry:arrival.entry,spot,phase:'arriving',startedAt:w.tick,arrivedAt:null,durationCore:0,hostile:false});
 if(owner.profile==='temp-travelers261-v1')owner.rng=draft.rng;
 w.visitors=owner;
 w.events.push({tick:w.tick,type:'command',message:`${pawns.length} passant(s) traverse(nt) la région.`});if(w.events.length>80)w.events.splice(0,w.events.length-80);
 return true;
 } finally {random.rng=draft.rng;}
}
