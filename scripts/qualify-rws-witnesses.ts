/** Local regression corpus. Reads explicitly named, private RWS files; does
 * not copy them or modify the source. The actual converter and strict
 * campaign codec are used, and measurements are emitted as JSON lines.
 *
 * npx tsx scripts/qualify-rws-witnesses.ts --ticks 600 <Yes.rws> <Test.rws> --developer-test <GeneratedSave.rws>
 */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {basename,join} from 'node:path';
import {createHash} from 'node:crypto';
import {readRwsSave,type RwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave,type RwsConversion} from '../src/import/rimworld/convert.ts';
import {captureDeveloperImport381} from '../src/import/rimworld/developer-test-import.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {FAMILIES} from '../src/import/rimworld/notes.ts';
import {gapOrigin} from '../src/import/rimworld/gap-origin.ts';
import {analyzeRwsSave} from '../src/import/rimworld/analyze.ts';
import {frenchReport} from '../src/import/rimworld/report-fr.ts';
import {items,num} from '../src/import/rimworld/xml.ts';
import {effectivePlantAgeCore256} from '../src/sim/initial-plant-age-256.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {batteryWattDays} from '../src/sim/power-battery.ts';
import {footprintCells} from '../src/sim/definitions.ts';
import {isConstructionLightPlant,constructionFinalWipesPlants} from '../src/sim/construction-plants.ts';
import {conduitKeepsPlant} from '../src/sim/power-construction.ts';
import {hydroponicPlantAllowed} from '../src/sim/farming-save.ts';
import type {World} from '../src/sim/types.ts';

const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const args=process.argv.slice(2),inputs:{file:string;developerTest:boolean}[]=[];
let ticks=600,contract=false,details=false,transport=false;
let reports:string|undefined;
for(let i=0;i<args.length;i++){
 const arg=args[i]!;
 if(arg==='--ticks'){ticks=Number(args[++i]);if(!Number.isSafeInteger(ticks)||ticks<0)throw Error('Nombre de ticks invalide.');continue;}
 if(arg==='--contract'){contract=true;continue;}
 if(arg==='--details'){details=true;continue;}
 if(arg==='--transport'){transport=true;continue;}
 if(arg==='--reports'){reports=args[++i];if(!reports||reports.startsWith('--'))throw Error('Dossier des rapports attendu.');continue;}
 const dev=arg==='--developer-test',file=dev?args[++i]:arg;
 if(!file||file.startsWith('--'))throw Error('Chemin RWS attendu.');
 inputs.push({file,developerTest:dev});
}
if(!inputs.length)throw Error('Indiquer les sauvegardes .rws.');
const sum=<T>(xs:readonly T[],value:(x:T)=>number)=>xs.reduce((acc,x)=>acc+value(x),0);
function census(w:World,conversion:RwsConversion,save:RwsSave){
 const animals=w.wildlife?.animals??[];
 const alive=w.pawns.filter(p=>p.state!=='dead'&&!p.health?.death),resources=new Map(w.resources.map(p=>[p.id,p]));
 const plantAge=save.maps[0]!.things.filter(t=>t.cls==='Plant'&&num(t.node,'age')!==undefined&&(()=>{const p=resources.get(conversion.thingIds.get(t.id)??-1);return !!p?.plantLife&&effectivePlantAgeCore256(p.plantLife)===num(t.node,'age');})()).length;
 return {
  schema:w.schemaVersion,tick:w.tick,core:effectiveCore297(w),site:w.site?.revision===3?w.site.tileId:null,
  pawns:alive.length,deadPeople:w.pawns.length-alive.length,corpses:w.piles.filter(p=>p.kind==='corpse').length,
  casketHumans:sum(w.structures,s=>s.casket?.humans.length??0),worldSites:w.worldSites263?.entries.length??0,
  animals:animals.length,domestic:animals.filter(a=>a.domestic).length,
  mechs:w.mechanoids?.length??0,structures:w.structures.length,plants:w.resources.length,daylilies:w.structures.filter(s=>s.flower?.plant).length,
  piles:w.piles.length,packed:w.packed.length,filth:w.filth?.items.length??0,
  workpieces:w.piles.filter(p=>p.kind==='unfinished').length,
  penoxyStacks:w.piles.filter(p=>p.item==='penoxycyline').map(p=>p.quantity).sort((a,b)=>a-b),
  completedResearch:w.research?Number(w.research.completedAt!==undefined)+Object.values(w.research).filter(v=>v&&typeof v==='object'&&'completedAt'in v&&v.completedAt!==undefined).length:0,
  developerFloors:w.developerPlacements381?.floors.length??0,developerBills:w.developerPlacements381?.bills?.length??0,
  stockCells:w.stockpiles.length,fieldCells:sum(w.growingZones.filter(z=>z.basinId===undefined),z=>z.cells.length),
  bills:sum(w.structures,s=>s.bills?.length??0),jobs:w.jobs.length,
  batteries:w.structures.filter(s=>s.battery).map(s=>batteryWattDays(s.battery!)),
  geothermal:w.structures.filter(s=>s.kind==='geothermal-generator').length,
  powerConsumersOn:w.structures.filter(s=>s.power?.on&&!['solar-generator','wind-turbine','geothermal-generator','wood-generator','chemfuel-generator'].includes(s.kind)).length,
  coolers:w.structures.filter(s=>s.cooler).map(s=>s.cooler!.target),
  snow:w.tiles.filter(t=>t.snowDepth).length,deepCells:w.deepResources?.cells.length??0,
  deepUnits:sum(w.deepResources?.cells??[],c=>c.count),rockDamage:w.tiles.filter(t=>t.miningDamage).length,
  plantAge,plantDamage:w.resources.filter(p=>p.damage).length,
  weather:w.weather&&{current:w.weather.current,age:w.weather.ageCore,duration:w.weather.durationCore},
  thermalRegions:w.thermal?.regions.length??0,thermalCells:sum(w.thermal?.regions??[],r=>r.cells.length),
  nativeHumans:alive.filter(p=>p.nativeHuman).length,titles:alive.filter(p=>p.identity378?.title).length,
  beards:alive.filter(p=>p.appearance?.beard&&p.appearance.beard!=='NoBeard').length,
  bestMedical:alive.filter(p=>p.medicalCare==='best').length,relations:w.relationships?.links.length??0,
  memories:sum(w.pawns,p=>p.memories.length+(p.social?.memories.length??0)+(p.roomMemories?.length??0)+(p.coupleMemories285?.length??0)),
  pregnancy:animals.filter(a=>a.pregnancy).length,fertilizedEggUnits:sum(w.piles.filter(p=>p.egg),p=>p.quantity),
  rotNonzero:w.piles.filter(p=>(p.rot?.progress??0)>0).length,archives:w.letters352?.archive.length??0,activeLetters:w.letters352?.stack.length??0,
  foodPolicies:w.foodPolicies?.length??0,apparelPolicies:w.apparelPolicies?.length??0,drugPolicies:w.drugPolicies?.length??0,
 };
}
type Census=ReturnType<typeof census>;
/** These are regression minima, not a ceiling on fidelity. Only the actual
 * source file digest selects a contract; a changed save is another witness.
 * Stable source state (date/positions etc.) is exercised by dedicated unit
 * contracts, and these real file invariants prevent silently dropping owners. */
const contracts:Record<string,{developerTest:boolean;exact:Partial<Census>;minimum:Partial<Record<keyof Census,number>>}>={
 'bd9af6c8d0da9c9f29ff98ae2193f0ebb64f95614ec51021f6f5ae5fa2e952b3':{
  developerTest:false,exact:{site:86845,core:12305756,domestic:100,pawns:12,daylilies:13,geothermal:2,batteries:[600,600,600],coolers:[-3,-3,-3,21],snow:35,pregnancy:14,fertilizedEggUnits:51,nativeHumans:12,titles:10,bestMedical:12,stockCells:690,fieldCells:2060,casketHumans:1,worldSites:1,
   weather:{current:'clear',age:63152,duration:92110}},
  minimum:{animals:149,mechs:1,structures:2152,filth:1331,bills:29,packed:7,deepCells:58,deepUnits:17265,rockDamage:13,plantAge:21364,deadPeople:6,corpses:7,memories:394,relations:9,rotNonzero:257,archives:200,foodPolicies:6,apparelPolicies:5,drugPolicies:4}
 },
 '50232588cecceb82dabb2c26c14bc78b1774488eae465413ee65f7f7758ff064':{
  developerTest:false,exact:{site:59170,core:1376,pawns:3,domestic:1,nativeHumans:3,bestMedical:3,mechs:0,casketHumans:3},
  minimum:{animals:60,structures:436,filth:2517,plants:27834,plantAge:27820,archives:1}
 },
 '6ea7c4dd0b78eabe97629909344b82f918b3ae10c9b0bba54c3b123a743c992a':{
  developerTest:true,exact:{site:55885,core:12068,pawns:29,daylilies:1,penoxyStacks:[150,150,150],completedResearch:5,developerFloors:206,developerBills:54,mechs:1,casketHumans:6},
  minimum:{structures:3295,plants:11,piles:1564,filth:3812,bills:131,workpieces:3,archives:13}
 }
};
function contractErrors(digest:string,val:Census,developerTest:boolean,normalErrors:unknown):string[]{
 const c=contracts[digest];if(!c)return ['Empreinte du témoin non reconnue ; enregistrer explicitement le nouveau contrat.'];
 const errors:string[]=[];
 if(c.developerTest!==developerTest)errors.push('Mode attendu différent.');
 if(c.developerTest&&(!Array.isArray(normalErrors)||!normalErrors.length))errors.push('La sauvegarde de test ne doit pas être admise en mode normal.');
 for(const [k,v] of Object.entries(c.exact))if(JSON.stringify(val[k as keyof Census])!==JSON.stringify(v))errors.push(`${k} : attendu ${JSON.stringify(v)}, reçu ${JSON.stringify(val[k as keyof Census])}.`);
 for(const [k,v] of Object.entries(c.minimum)){const actual=val[k as keyof Census];if(typeof actual!=='number'||actual<v)errors.push(`${k} : minimum ${v}, reçu ${JSON.stringify(actual)}.`);}
 return errors;
}
function invalidResourceOverlaps(w:World){
 const map=new Map<number,World['structures'][number]>();
 for(const s of w.structures)for(const cell of footprintCells(s)){
  const index=cell.z*w.width+cell.x;
  if(!map.has(index)||s.kind!=='power-conduit')map.set(index,s);
 }
 return w.resources.flatMap(r=>{
  const index=r.z*w.width+r.x,s=map.get(index);
  if(!s||isConstructionLightPlant(r)&&!constructionFinalWipesPlants(s.kind)||conduitKeepsPlant(s.kind,r.kind)||
   s.kind==='animal-sleeping-spot'&&r.kind!=='rock'||s.kind==='sleeping-spot'&&!['rock','tree'].includes(r.kind)||
   s.kind==='hydroponics-basin'&&hydroponicPlantAllowed(w,s.id,r))return [];
  return [{resource:{id:r.id,kind:r.kind,species:r.species,x:r.x,z:r.z,growth:r.growth},structure:{id:s.id,kind:s.kind,x:s.x,z:s.z},zones:w.growingZones.filter(z=>z.cells.includes(index)).map(z=>({id:z.id,plant:z.plant,allowSow:z.allowSow,allowCut:z.allowCut,basinId:z.basinId})),jobs:w.jobs.filter(j=>j.x===r.x&&j.z===r.z).map(j=>({id:j.id,kind:j.kind}))}];
 });
}
let failed=false;
for(const {file,developerTest} of inputs){
 const bytes=readFileSync(file),sourceHash=hash(bytes),started=performance.now(),name=basename(file);
 const result:Record<string,unknown>={name,developerTest,sourceHash};
 try{
  const save=readRwsSave(bytes.toString('utf8')),map=save.maps[0]!;
  result.source={version:save.meta.gameVersion,ticks:save.ticksGame,worldSeed:save.world?.seed,dimensions:[map.width,map.height],things:map.things.length,
   bills:sum(map.things,t=>items(t.node,'billStack/bills').length),archive:items(save.game,'history/archive/archivables').length};
  const c=convertRwsSave(save,{developerTest,onStage:(stage,part)=>{if(part===undefined)console.error(`${name}: ${stage}`);}}),w=c.world;
  if(developerTest){result.normalErrors=validateWorld(w);captureDeveloperImport381(c);}
  const errors=validateWorld(w),facts=census(w,c,save);result.errors=errors;result.census=facts;
  const worldOwners=new Set((w.worldPawns?.owners??[]).filter(o=>o.kind==='human').map(o=>o.actor.id));
  const leaders=new Set((w.worldFactions?.leaders??[]).map(l=>l.pawn.id));
  const sourceIds=[...items(save.game,'world/worldPawns/pawnsAlive'),...items(save.game,'world/worldPawns/pawnsMothballed'),...items(save.game,'world/worldPawns/pawnsDead')].map(n=>n.children.find(c=>c.name==='id')?.text.trim()).filter((id):id is string=>!!id);
  const people={sourceIds:sourceIds.length,mappedOwners:sourceIds.filter(id=>worldOwners.has(c.thingIds.get(id)??-1)).length,mappedLeaders:sourceIds.filter(id=>leaders.has(c.thingIds.get(id)??-1)).length};
  result.worldPeople=people;
  if(contract){const e=contractErrors(sourceHash,facts,developerTest,result.normalErrors);
   if(contracts[sourceHash]&&(people.mappedOwners<5||people.mappedLeaders<6))e.push('Régression des identités hors carte / chefs de faction.');
   const expectedJobs=sourceHash==='bd9af6c8d0da9c9f29ff98ae2193f0ebb64f95614ec51021f6f5ae5fa2e952b3'?9:sourceHash==='50232588cecceb82dabb2c26c14bc78b1774488eae465413ee65f7f7758ff064'?3:11;
   if(contracts[sourceHash]&&(c.notes.after.get('active-jobs')??0)<expectedJobs)e.push('Régression des tâches en cours.');
   result.contractErrors=e;if(e.length)failed=true;}
  result.families=Object.fromEntries(FAMILIES.map(f=>[f,{before:c.notes.before.get(f),after:c.notes.after.get(f),...c.notes.summary(f)}]));
  if(details)result.gaps=FAMILIES.flatMap(f=>[...(c.notes.tallies.get(f)?.values()??[])].filter(row=>row.status!=='exact').map(row=>({family:f,...row,origin:gapOrigin(f,row)})));
  result.losses=c.notes.messages.filter(m=>m.kind==='lost');
  if(errors.length)failed=true;
  else{
   const raw=serializeWorld(w),loaded=deserializeWorld(raw);
   result.roundTrip=serializeWorld(loaded)===raw;
   const digestBefore=hash(Buffer.from(raw));
   result.convertedHash=digestBefore;
   const encoder=transport?new SnapshotEncoder({structureDelta:true,minimumStructures:1000}):undefined,decoder=transport?new SnapshotDecoder():undefined;
   const received:{tick:number;status:string;reason?:string}[]=[];
   const publish=(full:boolean)=>{if(!encoder||!decoder)return;const r=decoder.adopt(structuredClone(encoder.encode(loaded,0,full?0:1,full)));received.push({tick:loaded.tick,status:r.status,...r.status==='resync'?{reason:r.reason}:{}});};
   publish(true);
   let played=0,after:string[]=[];
   for(;played<ticks;){stepWorld(loaded);played++;if(transport&&played<=15&&played%5===0)publish(false);if(played%60===0||played===ticks){after=validateWorld(loaded);if(after.length)break;}}
   if(transport){result.transport=received;if(received.some(r=>r.status!=='applied'))failed=true;}
   result.ticksRun=played;result.afterTicks=after;
   result.coreAfter=effectiveCore297(loaded);if(played===ticks&&result.coreAfter!==save.ticksGame+played*10)failed=true;
   if(after.includes('Resource overlaps a structure.'))result.resourceOverlaps=invalidResourceOverlaps(loaded);
   result.afterRoundTrip=after.length?false:(()=>{const next=serializeWorld(loaded);return serializeWorld(deserializeWorld(next))===next;})();
   if(!result.roundTrip||after.length||!result.afterRoundTrip)failed=true;
  }
  if(reports){
   mkdirSync(reports,{recursive:true});
   const body=frenchReport({title:`Qualification de ${name} — phase 1`,analysis:analyzeRwsSave(save),conversion:c,checks:{valid:errors.length===0,errors,roundTrip:result.roundTrip===true,ticksRun:Number(result.ticksRun??0),validAfterTicks:Array.isArray(result.afterTicks)&&result.afterTicks.length===0,planetMode:c.planetMode,elapsedMs:performance.now()-started}});
   const snapshots=Array.isArray(result.transport)?result.transport as {tick:number;status:string;reason?:string}[]:[];
   writeFileSync(join(reports,`${name.replace(/\.rws$/i,'')}-phase1.md`),`${body}\n## Qualification du client\n\n${snapshots.map((s,i)=>`- ${i===0?'Checkpoint complet':'Delta'} au tick ${s.tick} : ${s.status}${s.reason?` (${s.reason})`:''}.`).join('\n')}\n\nEmpreinte source : ${sourceHash}.\n`);
  }
 }catch(e){result.failure=e instanceof Error?e.stack??e.message:String(e);failed=true;}
 result.sourceUnchanged=sourceHash===hash(readFileSync(file));if(!result.sourceUnchanged)failed=true;
 result.elapsedMs=performance.now()-started;
 console.log(JSON.stringify(result));
}
if(failed)process.exitCode=1;
