/** Physical state on the source building itself, not a generated replacement.
 * Elapsed Core times are rebased to the current local clock; references to
 * pawns/contents are deliberately handled by their real owner importers. */
import type {ImportContext} from './convert.ts';
import type {RwsThing} from './rws-save.ts';
import {child,items,num,text} from './xml.ts';
import {coreOccupiedCells} from './local-coordinates.ts';
import type {Structure} from '../../sim/types.ts';
import {BATTERY_CAPACITY,BATTERY_ENERGY_SCALE} from '../../sim/power-battery.ts';
import {fuelLimit} from '../../sim/fuel.ts';
import {isFlickable,isPowerTrader} from '../../sim/power-rules.ts';
import {isPowerConnector} from '../../sim/power-grid.ts';
import {PowerTopologyCache,validPowerParent} from '../../sim/power-topology.ts';
import {doorMotionTicks,DOOR_CLOSE_DELAY} from '../../sim/door-rules.ts';
import {breakdownEligible} from '../../sim/breakdowns.ts';
import {deepSeed} from '../../sim/deep-resources.ts';
import {createGeothermalState264,geothermalGeyser264} from '../../sim/geothermal-state-264.ts';
import {isAncientNeutralKind256} from '../../sim/ancient-monument-runtime-256.ts';
import {newCryptosleepHolder271} from '../../sim/cryptosleep-state-271.ts';
import {newShipCasketHolder277} from '../../sim/ship-casket-state-277.ts';
import type {NaturalGeyser256} from '../../sim/local-geyser-state-256.ts';
import {effectiveCore297,effectiveLocal297} from '../../sim/core-phase-297.ts';
import {validFermentationState265} from '../../sim/fermentation-state-265.ts';
import {validFirefoamPopper290} from '../../sim/firefoam-state-290.ts';
import {SHIP_REACTOR_STARTUP_CORE_275,shipReactorEndCore275,validShipReactorState275} from '../../sim/ship-reactor-state-275.ts';

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const bool=(thing:RwsThing,key:string,otherwise=false):boolean=>{
 const raw=text(thing.node,key);return raw==='True'?true:raw==='False'?false:otherwise;
};
const savedDate=(ctx:ImportContext,n:number|undefined):number|undefined=>n!==undefined&&n>=0?clamp(Math.floor((effectiveCore297(ctx.w)-(ctx.save.ticksGame-n))/10),0,ctx.w.tick):undefined;

/** Core stores an original natural geyser even when it is covered by a
 * generator. Its source positions, never seed-generated substitutes, own
 * the exact association of subsequently imported geothermal generators. */
export function importNaturalGeysers(ctx:ImportContext):void {
 const {w,map,notes,coordinates}=ctx,sources=map.things.filter(t=>t.def==='SteamGeyser');
 if(!ctx.geographic||w.site?.revision!==3){
  for(const _t of sources){notes.countBefore('buildings');notes.def('buildings','SteamGeyser','dropped','geyser','Geyser : propriétaire naturel réservé aux cartes géographiques.');}
  return;
 }
 const result:NaturalGeyser256[]=[],occupied=new Set<number>();
 for(const t of sources){
  notes.countBefore('buildings');
  if(!t.pos){notes.def('buildings',t.def,'dropped','geyser','Position de geyser absente.');continue;}
  const cells=coreOccupiedCells(t.pos,t.rot,[2,2]).map(c=>coordinates.cell(c));
  if(cells.length!==4||cells.some(c=>!ctx.inside(c)||occupied.has(ctx.index(c)))){notes.def('buildings',t.def,'dropped','geyser','Emprise naturelle hors carte ou déjà occupée.');continue;}
  const g:NaturalGeyser256={id:w.nextId++,x:Math.min(...cells.map(c=>c.x)),z:Math.min(...cells.map(c=>c.z)),ticksUntilSpray:500,sprayTicksLeft:0};
  for(const c of cells)occupied.add(ctx.index(c));
  result.push(g);ctx.thingIds.set(t.id,g.id);notes.countAfter('buildings');
  notes.def('buildings',t.def,'adapted','geyser','Geyser réel et emprise repris ; phase de vapeur absente de la sauvegarde Core, réinitialisée.');
 }
 w.geysers={revision:1,atTick:w.tick,items:result};
}

/** The holder and its real occupants are two owners imported in separate
 * passes. A source occupied holder starts as a staging container; the
 * subsequent original-actor importer fills it or rejects it explicitly. */
export function admitImportedStructureOwner(ctx:ImportContext,t:RwsThing,s:Structure):boolean {
 const {w,notes}=ctx;
 if(s.kind==='geothermal-generator'){
  const g=geothermalGeyser264(w,s);
  if(!ctx.geographic||!g||w.structures.some(b=>b.geothermal?.geyserId===g.id)){
   notes.def('buildings',t.def,'dropped',s.kind,'Générateur sans propriétaire géothermique réel à son emplacement exact.');return false;
  }
  s.geothermal=createGeothermalState264(w,s);
 }
 if(s.kind==='ship-chunk')s.factionId=null;
 if(isAncientNeutralKind256(s.kind)&&ctx.geographic&&t.faction!==ctx.save.playerFaction){
  s.factionId=null;
  if(t.faction)notes.adapted('buildings',`${t.def} : faction étrangère ${t.faction} non raccordée, ouvrage conservé neutre.`);
 }
 if(s.kind==='ancient-cryptosleep-casket'||s.kind==='cryptosleep-casket'||s.kind==='ship-cryptosleep-casket'){
  if(s.kind==='ancient-cryptosleep-casket'){
   s.factionId=null;s.casket={revision:1,groupId:-1,contentsKnown:bool(t,'contentsKnown'),heldAt:w.tick,humans:[],animals:[],items:[]};
  }else if(s.kind==='cryptosleep-casket')s.cryptosleep=newCryptosleepHolder271(w.tick);
  else s.shipCryptosleep277=newShipCasketHolder277(w.tick);
 }
 if(s.kind==='ship-reactor'&&text(t.node,'hibernateState')&&text(t.node,'hibernateState')!=='Hibernating'){
  const phase=text(t.node,'hibernateState'),rawEnd=num(t.node,'hibernateendStartupTick'),core=effectiveCore297(w);
  // Core CompHibernatable serializes state and endStartupTick only. Its
  // startup start can be recovered within the native Float32 endpoint
  // equation, but can be ambiguous by several Core ticks at large dates.
  if((phase==='Starting'||phase==='Running')&&rawEnd!==undefined&&Number.isSafeInteger(rawEnd)){
   const end=core+(rawEnd-ctx.save.ticksGame),center=end-SHIP_REACTOR_STARTUP_CORE_275;
   for(let d=0;d<=256&&!s.shipReactor275;d++)for(const start of d===0?[center]:[center-d,center+d]){
    if(start<0||shipReactorEndCore275(start)!==end)continue;
    const candidate={state:phase==='Starting'?'starting' as const:'running' as const,startCore:start,endCore:end};
    if(validShipReactorState275(candidate,core,w.schemaVersion))s.shipReactor275=candidate;
   }
  }
  if(!s.shipReactor275){notes.def('buildings',t.def,'dropped',s.kind,'Réacteur déjà réveillé : échéance de démarrage source non représentable.');return false;}
  notes.def('buildings','Démarrage du réacteur','adapted',undefined,'Échéance et état conservés ; date de départ inversée dans l’équation Core Float32.');
 }
 return true;
}

/** Existing runtime states with bounded numerical formats. No forced change
 * to research, network wiring or operational availability is necessary. */
export function importBuildingSnapshot(ctx:ImportContext,t:RwsThing,s:Structure):void {
 const saved=(key:string)=>num(t.node,key);
 const {w,notes}=ctx;
 if(s.battery){
  const quanta=clamp(Math.round((saved('storedPower')??0)*BATTERY_ENERGY_SCALE*2),0,BATTERY_CAPACITY*2);
  s.battery.stored=Math.floor(quanta/2);if(quanta%2)s.battery.half=true;
 }
 if(s.wind){
  const watts=saved('cachedPowerOutput'),counter=saved('updateCounter');
  if(watts!==undefined){
   s.wind.cachedWatts=clamp(Math.round(watts),0,3450);
   if(s.wind.cachedWatts!==watts)notes.def('buildings','Puissance éolienne en cache','adapted',undefined,'Les watts sont entiers dans Elsewhere.');
  }
  if(counter!==undefined){s.wind.updateCounter=clamp(Math.floor(counter/10),0,24);}
  const filter=child(t.node,'autoCutFilter');
  if(filter){
   s.wind.autoCut=items(filter,'allowedDefs').some(n=>/^Plant_(Tree|Timbershroom)/.test(text(n)??''));
   if(s.wind.autoCut)notes.def('buildings','Coupe automatique éolienne','adapted',undefined,'Activation reprise ; sélection détaillée des arbres indisponible.');
  }
 }
 if(s.fermentation){
  const receipt={wort:saved('wortCount')??0,progress:saved('progress')??0,ruin:saved('ruinedPercent')??0};
  if(validFermentationState265(receipt)){s.fermentation=receipt;notes.def('buildings','Fermentation','exact','moût, maturation, dommage thermique');}
  else notes.def('buildings','Fermentation','dropped',undefined,'Contenu ou maturation non admis par le modèle.');
 }
 if(['table','table-square','table-long','table-large','campfire'].includes(s.kind)&&text(t.node,'active')==='False')s.gatherSpot=false;
 if(s.heater)s.heater.target=clamp(saved('targetTemperature')??21,-273.15,1000);
 if(s.cooler)s.cooler.target=clamp(saved('targetTemperature')??21,-273.15,1000);
 if(s.power&&isFlickable(s.kind)&&text(t.node,'switchOn')!==undefined){
  s.power.switchOn=bool(t,'switchOn',true);if(!s.power.switchOn)s.power.on=false;
  // A pending switch change belongs to the source designation pass.
 }
 if(s.vent){const on=text(t.node,'switchOn');if(on!==undefined)s.vent.open=bool(t,'switchOn',true);}
 if(s.fuel){
  // Core omits a zero float. Do not turn an empty or partly used fuel tank
  // into a fresh full object just because the construction initializer did.
  const capacity=s.kind==='wood-generator'?75:s.kind==='chemfuel-generator'?30:s.kind==='campfire'||s.kind==='torch-lamp'?20:50;
  s.fuel.ticks=clamp(Math.round((saved('fuel')??0)*fuelLimit(s.kind)/capacity),0,fuelLimit(s.kind));
  s.fuel.autoRefuel=bool(t,'allowAutoRefuel',true);
 }
 if(s.turret){
  s.turret.ammoQ=clamp(Math.round((saved('fuel')??0)*4),0,240);
  s.turret.autoReload=bool(t,'allowAutoRefuel',true);s.turret.holdFire=bool(t,'holdFire');
  if((saved('burstCooldownTicksLeft')??0)>0)s.turret.cooldownCore=clamp(Math.round(saved('burstCooldownTicksLeft')!),0,288);
 }
 if(s.door){
  const open=bool(t,'open'),hold=bool(t,'holdOpen'),ticksOpen=saved('ticksOpen');
  const core=effectiveCore297(w),now=core/10;
  s.door.open=open;s.door.holdOpen=hold;s.door.forbidden=t.forbidden;s.door.changedAt=now;
  s.door.from=ticksOpen===undefined?(open?1:0):clamp(ticksOpen/(doorMotionTicks(s)*10),0,1);
  const remaining=saved('ticksUntilClose');
  s.door.closeAt=open&&!hold?(core+clamp(remaining===undefined?DOOR_CLOSE_DELAY*10:remaining,0,210))/10:null;
  const touch=saved('lastFriendlyTouchTick');if(touch!==undefined)s.door.lastTouch=clamp((core-Math.max(0,ctx.save.ticksGame-touch))/10,-12,now);
 }
 if(breakdownEligible(s)&&bool(t,'brokenDown'))s.breakdown={brokenAt:w.tick};
 if(s.kind==='deep-drill'){
  const progress=saved('portionProgress'),yieldPct=saved('portionYieldPct');
  if(progress!==undefined||yieldPct!==undefined){
   s.deepDrill={progress:clamp(progress??0,0,10000),yieldPct:clamp(yieldPct??0,0,2),rng:deepSeed(w.seed,s.id^0x280d111)};
   const stamp=savedDate(ctx,saved('lastUsedTick'));if(stamp!==undefined)s.deepDrill.lastUsedAt=stamp;
   notes.adapted('buildings',`${t.def} : progression reprise, générateur aléatoire de rendement recréé.`);
  }
 }
 if(s.kind==='ground-scanner'){
  const days=saved('daysWorkingSinceLastFinding'),speed=saved('lastUserSpeed'),stamp=savedDate(ctx,saved('lastScanTick'));
  if(days!==undefined||stamp!==undefined){
   s.deepScanner={daysWorking:clamp(days??0,0,6.01)};
   if(stamp!==undefined&&speed!==undefined&&speed>=.1&&speed<=100){s.deepScanner.lastScanAt=stamp;s.deepScanner.lastUserSpeed=speed;}
  }
 }
}

/** Owners initialized by the building insertion path are restored only
 * after all source buildings and their actual auxiliary fields exist. */
export function importDeferredBuildingState(ctx:ImportContext):void {
 const {w,notes}=ctx,core=effectiveCore297(w),sources=new Map(ctx.map.things.flatMap(t=>{const id=ctx.thingIds.get(t.id);return id===undefined?[]:[[id,t] as const];}));
 for(const s of w.structures){
  const t=sources.get(s.id);if(!t)continue;
  if(s.firefoam290){
   s.firefoam290.autoRebuild=bool(t,'autoRebuild');
   const remaining=num(t.node,'countdownTicksLeft');
   if(remaining!==undefined&&Number.isSafeInteger(remaining)&&remaining>0&&remaining<=150){
    const state={...s.firefoam290,wick:{startedAtCore:Math.max(0,core-(140-remaining)),endCore:core+remaining}};
    // When the inferred start would be beyond the current physical core,
    // the minimum-duration choice cannot describe that valid active wick.
    state.wick.startedAtCore=Math.min(core,state.wick.startedAtCore);
    if(w.firefoam290&&validFirefoamPopper290(state,w.schemaVersion)){
     s.firefoam290=state;notes.def('buildings','Mèche de mousse','adapted',undefined,'Échéance exacte ; durée initiale aléatoire non sauvegardée.');
    }else notes.def('buildings','Mèche de mousse','dropped',undefined,'Chronologie de mèche non représentable.');
   }
  }
  if(s.art){
   const spawned=savedDate(ctx,num(t.node,'spawnedTick'));
   if(spawned!==undefined){s.art.createdAt=spawned;notes.def('buildings','Date d’œuvre','adapted',undefined,'Date de pose connue ; fabrication antérieure non sauvegardée dans le propriétaire.');}
   if(text(t.node,'title'))notes.def('buildings','Titre d’œuvre','dropped',undefined,'Le modèle d’œuvre stocke auteur et date, pas le titre.');
  }
 }
}

/** Final pass after every transmitter and consumer has its local identity.
 * Core's CompPowerTrader omits powerOn when true; false is written. Preserve
 * the explicitly connected real transmission owner where the target grid
 * accepts it, and do not reset powered appliances merely because the network
 * had to be constructed before the cross-reference could resolve. */
export function restoreImportedPowerState(ctx:ImportContext):void {
 const {w,notes}=ctx,topology=new PowerTopologyCache().read(w);
 const sourceById=new Map(ctx.map.things.map(t=>[t.id,t]));
 const sourceForLocal=new Map<number,RwsThing>();
 for(const [key,id] of ctx.thingIds){const source=sourceById.get(key);if(source)sourceForLocal.set(id,source);}
 let parents=0,reconnected=0,disconnected=0,on=0,traders=0;
 for(const s of w.structures){
  if(!s.power||!isPowerTrader(s.kind))continue;
  const t=sourceForLocal.get(s.id);if(!t)continue;
  // Plain analysis fixtures may omit the entire CompPower section. When
  // no serialized field proves that owner or operational state, retain the
  // canonical initializer rather than fabricate supply for the fixture.
  if(!child(t.node,'parentThing')&&!child(t.node,'powerOn'))continue;
  traders++;
  if(isPowerConnector(s.kind)){
   const parent=text(t.node,'parentThing')?.replace(/^Thing_/,''),mapped=parent?ctx.thingIds.get(parent):undefined;
   if(mapped!==undefined&&validPowerParent(topology,s,mapped,ctx.w.schemaVersion)){s.power.parentId=mapped;parents++;}
   else if(!parent){s.power.parentId=null;disconnected++;}
   else{reconnected++;notes.adapted('buildings',`${t.def} : parent électrique ${parent} non représentable, connexion admissible recalculée.`);}
  }
  const requested=bool(t,'powerOn',true),allowed=s.power.switchOn!==false&&!s.breakdown&&(!isPowerConnector(s.kind)||s.power.parentId!==null)&&(!['wood-generator','chemfuel-generator'].includes(s.kind)||!!s.fuel?.ticks);
  s.power.on=requested&&allowed;if(s.power.on)on++;
 }
 if(traders)notes.mapped('buildings',`Réseau électrique : ${parents} parents originaux repris, ${disconnected} consommateurs déconnectés, ${reconnected} connexions adaptées ; ${on}/${traders} traders initialement actifs.`);
}
