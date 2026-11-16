import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {supportedCoreProfile347} from './game-profile.ts';
/** Core-only750 composition on the SAME unpublished map and step Rand.
 * No generic symbol interpreter or external outcome callback. Human population
 * is the declared existing-NPC adaptation, not native PawnGenerator parity.
 * A dependency STOP discards the entire candidate, including private IDs. */
import {spawnFunctionalTempleThreat256} from './temple-threat-generation-256.ts';
import type {HiveAdjacentRuntime256} from './cave-hive-filth-256.ts';
import {scatterAncient750256,type AncientPlacementContext256,type AncientRect256} from './local-ancient-placement-256.ts';
import {unpublishedAncientGeneration256} from './ancient-generation-frontier-256.ts';
import {CORE_MONUMENT_CATALOGUE_256,type MonumentBuildable256} from './ancient-monument-plan-256.ts';
import {spawnAncientTempleEnvelope256,spawnResolvedAncientTempleEnvelope256} from './ancient-temple-envelope-256.ts';
import {spawnAncientShrineWarning256} from './ancient-shrine-warning-256.ts';
import {generateActualAncientTempleLoot256,spawnActualAncientTempleLoot256,type NonStartingTempleBirth256} from './ancient-temple-loot-spawn-256.ts';
import {planAncientShrinesGroup256,ancientShrineExecutionOrder256,type AncientSharedPodContents256,type AncientShrinePlacement256} from './ancient-shrine-group-plan-256.ts';
import {spawnGeneratedAncientFloor256} from './ancient-generated-floors-256.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {WorldGenerationRandom} from './world-generation-random.ts';
import {AncientTempleDependencyError256,type AncientTempleDependency256} from './ancient-temple-dependency-256.ts';
import type {AncientCasketGroupIds256} from './ancient-casket-group-ids-256.ts';
import {spawnFunctionalAncientCasket256} from './functional-ancient-population-256.ts';
import type {StartingOriginalRoster256} from './starting-original-roster-256.ts';
import type {AncientHumanNameWorking256} from './ancient-human-name-256.ts';
import type {World} from './types.ts';

export interface ActualTempleOwners256 {lordIds?:{nextId:number};working?:HiveAdjacentRuntime256;casketGroupIds:AncientCasketGroupIds256;absoluteCore?:number;roster?:StartingOriginalRoster256;humanNames?:AncientHumanNameWorking256;nonStartingBirth?:NonStartingTempleBirth256}
export type ActualTempleThreat256={kind:'mechs'|'hives';count:number}|null;
const podTypes=['ancient-friendly','ancient-incapped','ancient-half-eaten','ancient-hostile','slave'] as const;
function frontier(w:World,owners:ActualTempleOwners256){return {nextThingId:w.nextId,nextCasketGroupId:owners.casketGroupIds.nextId};}
function admitted(w:World,owners:ActualTempleOwners256,random:WorldGenerationRandom):void {
 if(!unpublishedAncientGeneration256(w,true)||!(random instanceof WorldGenerationRandom)||!owners||!owners.casketGroupIds||!Number.isInteger(owners.casketGroupIds.nextId)||owners.casketGroupIds.nextId<0||owners.casketGroupIds.nextId>2147483646)throw Error('Actual unpublished Temple750 map/step stream/casket-group authority required');
 // Easy (the tutorial's difficulty) inherits peacefulTemples=false as Medium.
 const p=w.gameProfile;if(!supportedCoreProfile347(p))throw Error('Actual Temple peacefulTemples is unresolved for this profile');
 if(!w.worldFactions||w.worldFactions.revision!==1)throw Error('Actual Temple faction registry is absent');
 for(const def of ['Mechanoid','Insect','Ancients','AncientsHostile'])if(w.worldFactions.factions.filter(f=>f.def===def).length>1)throw Error('Ambiguous actual Temple faction');
}
/** Only Core is active: no Anomaly Chance is consumed. Medium inherits
 * peacefulTemples=false. The .65 draw still occurs if Mechanoid is absent. */
export function chooseActualTempleThreat256(w:World,random:WorldGenerationRandom):ActualTempleThreat256 {
 const factions=w.worldFactions;if(!factions)throw Error('Actual Temple factions required before threat choice');
 if(random.value()<Math.fround(.65)&&factions.factions.some(f=>f.def==='Mechanoid'))return {kind:'mechs',count:random.integer(1,6)};
 if(factions.factions.some(f=>f.def==='Insect'))return {kind:'hives',count:random.integer(1,3)};
 return null;
}
/** No Empty entry is in the actual non-first enum. A shared null means this
 * exact per-casket draw, not absence of a casket or a peaceful replacement. */
export function actualAncientPodContents256(shared:AncientSharedPodContents256,random:WorldGenerationRandom):typeof podTypes[number] {
 return shared??podTypes[random.integer(1,6)-1]!;
}
function stop(w:World,owners:ActualTempleOwners256,random:WorldGenerationRandom,producer:AncientTempleDependency256,reason:string,detail:{casketId?:number;count?:number;cell?:{x:number;z:number};rect?:AncientRect256}={}):never {
 throw new AncientTempleDependencyError256(producer,reason,random,{...frontier(w,owners),...detail});
}
/** Source AncientShrine resolves its two floor children before the casket.
 * The techprint Chance is real even without DLC; its complete Core-only Def
 * pool is empty. No Royalty bladelink/psychic Chance is executed. */
function resolveActualShrine256(w:World,placement:AncientShrinePlacement256,shared:AncientSharedPodContents256,groupId:number,owners:ActualTempleOwners256,random:WorldGenerationRandom):void {
 // All the current generated wall/table/prop/casket/Mineable Things are
 // destroyable. Wipe/move of any conflicting real owner is handled (or refused)
 // by the exact floor and eventual Spawn producer, never a broad absence test.
 random.value(); // Chance(.033), then empty Core Techprint pool: no selection.
 spawnGeneratedAncientFloor256(w,placement.rect,'ancient-tile');
 const at=placement.casket.cell;
 spawnGeneratedAncientFloor256(w,{minX:at.x,minZ:at.z,maxX:at.x+1,maxZ:at.z},'ancient-concrete');
 const contents=actualAncientPodContents256(shared,random);
 // The casket child rect is a SINGLE cell: both RangeInclusive endpoints are
 // equal, hence the actual RandomCell consumes no draw. MakeThing is next.
 if(!Number.isSafeInteger(w.nextId)||w.nextId<1||!Number.isSafeInteger(w.nextId+1))throw Error('Actual casket Thing identity exhausted');
 const casketId=w.nextId++;
 // Human population is the explicitly authored existing-NPC adaptation.
 // The same real casket child, original identity and branch remain; no native
 // prefix/replayed receipt or ready-but-empty holder is admitted.
 const bornDef=contents==='ancient-hostile'?'AncientsHostile':'Ancients',birth=(Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))?w.worldFactions!.factions.find(f=>f.def===bornDef):undefined;
 if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&!birth)throw Error('Selected future ancient birth lacks its actual faction instance');
 spawnFunctionalAncientCasket256(w,placement,contents,groupId,casketId,random,birth?{factions:w.worldFactions!,factionId:birth.id}:undefined);
}
/** The BaseGen LIFO order is explicit and finite: casket group children first,
 * then the already chosen threat, finally the real allocated loot Things. */
export function resolveActualAncientTempleInterior256(w:World,rect:AncientRect256,owners:ActualTempleOwners256,random:WorldGenerationRandom):void {
 admitted(w,owners,random);
 const loot=generateActualAncientTempleLoot256(w,random,owners.nonStartingBirth);
 if(loot.status==='blocked'){
  // The parent returns the real partial MakeThing STOP frontier without
  // committing a ready plan. This candidate is being discarded, but its
  // diagnostic allocator must not rewind allocations preceding that STOP.
  w.nextId=loot.nextId;
  const p=loot.producer;
  if(p==='artifacts'||p==='misc'||p==='luciferium'||p==='namespace')stop(w,owners,random,`loot-${p}`,loot.reason,{rect});
  throw Error('Actual loot returned an unknown dependency; candidate discarded');
 }
 const threat=chooseActualTempleThreat256(w,random);
 if(rect.maxX-rect.minX+1>=4&&rect.maxZ-rect.minZ+1>=3){
  const physical=captureActualLocalDistricts256(w),plan=planAncientShrinesGroup256(rect,w,random,c=>physical.standable(c.z*w.width+c.x),undefined,owners.casketGroupIds);
  if(plan.groupId===undefined)throw Error('Actual casket group allocation did not occur');
  for(const placement of ancientShrineExecutionOrder256(plan))resolveActualShrine256(w,placement,plan.sharedContents,plan.groupId,owners,random);
 }
 if(threat){if(!owners.lordIds||!owners.working)throw Error('Selected Temple threat lacks its true group/static owners');spawnFunctionalTempleThreat256(w,rect,threat,random,{lordIds:owners.lordIds,working:owners.working});}
 spawnActualAncientTempleLoot256(w,loot,rect,random,owners.nonStartingBirth);
}
function finishEnvelope(w:World,envelope:ReturnType<typeof spawnAncientTempleEnvelope256>,owners:ActualTempleOwners256,random:WorldGenerationRandom):'committed' {
 // The warning pair is created AFTER the interior symbol is pushed but BEFORE
 // it is popped. Its original IDs therefore precede all interior Things.
 if(!envelope.wallBounds)throw Error('Actual Temple warning lacks its wall bounds; no invented center');
 spawnAncientShrineWarning256(w,envelope.wallBounds);
 if(envelope.interior)resolveActualAncientTempleInterior256(w,envelope.interior,owners,random);
 return 'committed';
}
export function spawnActualAncientTemple256(w:World,rect:AncientRect256,owners:ActualTempleOwners256,random:WorldGenerationRandom):'committed' {
 admitted(w,owners,random);return finishEnvelope(w,spawnAncientTempleEnvelope256(w,rect,CORE_MONUMENT_CATALOGUE_256,random),owners,random);
}
/** Actual resolved-sketch entry for ROOT's prepared real-map composition
 * oracle: no second sketch resolution or random rewind is performed. */
export function spawnResolvedActualAncientTemple256(w:World,rect:AncientRect256,rows:readonly MonumentBuildable256[],owners:ActualTempleOwners256,random:WorldGenerationRandom):'committed' {
 admitted(w,owners,random);return finishEnvelope(w,spawnResolvedAncientTempleEnvelope256(w,rect,rows,random),owners,random);
}
/** This implements the existing factory's750 interface. A natural count0 or
 * real ScatterAt no-op succeeds; a selected missing producer throws the exact
 * dependency above. It never catches/refilters/rerolls a selected branch. */
export function generateActualShrines750256(w:World,context:AncientPlacementContext256,random:WorldGenerationRandom,owners:ActualTempleOwners256){
 admitted(w,owners,random);
 if(context.startingMap?owners.nonStartingBirth!==undefined:owners.nonStartingBirth===undefined)throw Error('Actual initial/later Temple750 birth lane differs from map generation context');
 return scatterAncient750256(w,'shrines',context,random,(rect,same)=>spawnActualAncientTemple256(w,rect,owners,same));
}
export const ACTUAL_SHRINES_750_256=Object.freeze({generate:generateActualShrines750256});
