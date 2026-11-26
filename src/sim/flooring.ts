import {filterPileEntries} from './pile-identity-directory.ts';
import {markTerrainCellChanged} from './terrain-mutation-journal.ts';
import {isAncientGeneratedFloor256,type AncientGeneratedFloor256} from './ancient-generated-floor-state-256.ts';
import {refreshDuckWaterCell256} from './duck-water-256.ts';
import {geyserBlocksPlantOrFloor256} from './local-geyser-state-256.ts';
import {terrainSupportsFloor256} from './natural-terrain-runtime-256.ts';
import {ROAD_FLAGSTONES_256,type RoadFloor256,isRoadFloor256} from './road-ground-256.ts';
import type { ConstructionRecipe } from './construction-materials.ts';
import type { BlockMaterial } from './building-materials.ts';
import { isBlockMaterial } from './building-materials.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { addMaterial,materialCanFit,refreshStock } from './materials.ts';
import { groundCapacity,planGroundPlacement } from './ground-placement.ts';
import { footprintContains } from './definitions.ts';
import { researchUnlocked } from './research.ts';
import {CARPET_FLOORS_355,CARPET_FACTS_355,isCarpetFloor355,carpetLabel355,isCarpetSchema355,type CarpetFloor355} from './carpet-355.ts';
import {STRAW_MATTING_365,isStrawCouchSchema365} from './straw-couch-365.ts';
import { removeFilth } from './filth.ts';
import { isFloorLightPlant } from './construction-plants.ts';
import {planConstructionPlantRetirement,commitConstructionPlantRetirement} from './plant-retirement.ts';
import type { Cell,CommandResult,DesignateCommand,Job,World } from './types.ts';

export const FLOOR_KINDS=['wood-planks','granite-tile','limestone-tile','marble-tile','sandstone-tile','slate-tile','steel-tile','sterile-tile',...ROAD_FLAGSTONES_256,...CARPET_FLOORS_355,'straw-matting'] as const;
export type BuildableFloorKind=typeof FLOOR_KINDS[number];
export type FloorKind=BuildableFloorKind|'burned-wood'|'burned-carpet'|'burned-straw-matting'|RoadFloor256|AncientGeneratedFloor256;
export interface FloorDefinition {label:string;item:ItemId|null;quantity:number;salvage?:number;ingredients?:ConstructionRecipe['ingredients'];coreWork:number;cleanliness:number;cleaningTime:number;flammability:number;pathCost:number;skill:number;research:'stonecutting'|'smithing'|'sterile-materials'|'carpet-making'|null}
const stone=(label:string,item:BlockMaterial):FloorDefinition=>({label,item,quantity:4,coreWork:1100,cleanliness:0,cleaningTime:.8,flammability:0,pathCost:0,skill:3,research:'stonecutting'});
const flagstone=(label:string,item:BlockMaterial):FloorDefinition=>({label,item,quantity:4,salvage:0,coreWork:500,cleanliness:0,cleaningTime:.8,flammability:0,pathCost:0,skill:0,research:null});
export const FLOOR_DEFINITIONS:Readonly<Record<FloorKind,FloorDefinition>>=Object.freeze({
  'granite-flagstone':flagstone('Pavage de granite','granite-blocks'),'limestone-flagstone':flagstone('Pavage de calcaire','limestone-blocks'),
  'marble-flagstone':flagstone('Pavage de marbre','marble-blocks'),'sandstone-flagstone':flagstone('Pavage de grès','sandstone-blocks'),'slate-flagstone':flagstone('Pavage d’ardoise','slate-blocks'),
  'ancient-tile':{label:'Dalles anciennes',item:null,quantity:0,salvage:0,coreWork:1,cleanliness:.2,cleaningTime:.6,flammability:0,pathCost:0,skill:0,research:null},
  'ancient-concrete':{label:'Béton ancien',item:null,quantity:0,salvage:0,coreWork:1,cleanliness:0,cleaningTime:.8,flammability:0,pathCost:0,skill:0,research:null},
  'broken-asphalt':{label:'Asphalte dégradé',item:null,quantity:0,salvage:0,coreWork:0,cleanliness:-2,cleaningTime:1,flammability:0,pathCost:0,skill:0,research:null},
  'wood-planks':{label:'Plancher bois',item:'wood',quantity:3,coreWork:85,cleanliness:0,cleaningTime:1,flammability:.22,pathCost:0,skill:0,research:null},
  'granite-tile':stone('Dalles de granite','granite-blocks'), 'limestone-tile':stone('Dalles de calcaire','limestone-blocks'),
  'marble-tile':stone('Dalles de marbre','marble-blocks'), 'sandstone-tile':stone('Dalles de grès','sandstone-blocks'), 'slate-tile':stone("Dalles d’ardoise",'slate-blocks'),
  'steel-tile':{label:'Dalles en acier',item:'steel',quantity:7,coreWork:800,cleanliness:.2,cleaningTime:.6,flammability:0,pathCost:0,skill:3,research:'smithing'},
  'sterile-tile':{label:'Dalles stériles',item:'steel',quantity:3,ingredients:[{item:'steel',quantity:3},{item:'silver',quantity:12}],coreWork:1600,cleanliness:.6,cleaningTime:.6,flammability:0,pathCost:0,skill:6,research:'sterile-materials'},
  'burned-wood':{label:'Plancher brûlé',item:null,quantity:0,coreWork:0,cleanliness:0,cleaningTime:1,flammability:0,pathCost:1,skill:0,research:null},
  // Schema 355 Core carpets (one TerrainDef per Structure colour) and their burned floor.
  ...Object.fromEntries(CARPET_FLOORS_355.map(id=>[id,{label:carpetLabel355(id),item:'cloth',quantity:CARPET_FACTS_355.cloth,coreWork:CARPET_FACTS_355.coreWork,cleanliness:CARPET_FACTS_355.cleanliness,cleaningTime:CARPET_FACTS_355.cleaningTime,flammability:CARPET_FACTS_355.flammability,pathCost:0,skill:CARPET_FACTS_355.skill,research:'carpet-making'} satisfies FloorDefinition])) as Record<CarpetFloor355,FloorDefinition>,
  'burned-carpet':{label:'Tapis brûlé',item:null,quantity:0,coreWork:0,cleanliness:0,cleaningTime:1,flammability:0,pathCost:1,skill:0,research:null},
  // Schema 365 Core StrawMatting (2 hay, no research) and BurnedStrawMatting.
  'straw-matting':{label:STRAW_MATTING_365.label,item:'hay',quantity:STRAW_MATTING_365.hay,coreWork:STRAW_MATTING_365.coreWork,cleanliness:STRAW_MATTING_365.cleanliness,cleaningTime:1,flammability:STRAW_MATTING_365.flammability,pathCost:STRAW_MATTING_365.pathCost,skill:0,research:null},
  'burned-straw-matting':{label:'Natte de paille brûlée',item:null,quantity:0,coreWork:0,cleanliness:0,cleaningTime:1,flammability:0,pathCost:1,skill:0,research:null},
});
export const isFloorKind=(v:unknown):v is FloorKind=>typeof v==='string'&&Object.hasOwn(FLOOR_DEFINITIONS,v);
export const isBuildableFloor=(v:unknown):v is BuildableFloorKind=>isFloorKind(v)&&v!=='burned-wood'&&v!=='burned-carpet'&&v!=='burned-straw-matting'&&v!=='broken-asphalt'&&!isAncientGeneratedFloor256(v);
export const floorAvailable=(v:unknown,version:number):v is FloorKind=>isFloorKind(v)&&(!(isRoadFloor256(v)||isAncientGeneratedFloor256(v))||version>=256)&&(!(isCarpetFloor355(v)||v==='burned-carpet')||isCarpetSchema355(version))&&(!(v==='straw-matting'||v==='burned-straw-matting')||isStrawCouchSchema365(version));
export function flooringRecipe(floor:FloorKind|undefined,remove=false):ConstructionRecipe {
  const d=floor&&FLOOR_DEFINITIONS[floor];return {ingredients:!remove&&d?.item?d.ingredients??[{item:d.item,quantity:d.quantity}]:[],work:remove?200/10:(d?.coreWork??0)/10,coreWork:remove?200:d?.coreWork??0};
}
export const floorAt=(w:World,c:Cell):FloorKind|undefined=>w.tiles[c.z*w.width+c.x]?.floor;
/** Floors coexist with furniture and its plans. CoversFloor walls/coolers,
 * another floor order remain exclusive. Plant designations may coexist; their
 * exact source is retired only when the floor successfully changes terrain. */
export function canDesignateFloor(w:World,c:DesignateCommand):CommandResult {
  const refuse=(reason:string,code:CommandResult['code']='invalid-command'):CommandResult=>({ok:false,code,reason});
  if(w.schemaVersion<89||(c.kind!=='lay-floor'&&c.kind!=='remove-floor')||c.material!==undefined||c.orientation!==undefined&&c.orientation!==0||c.targetId!==undefined)return refuse('Ordre de sol invalide.');
  if(!Number.isInteger(c.x)||!Number.isInteger(c.z)||c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)return refuse('Case hors de la carte.','out-of-bounds');
  const tile=w.tiles[c.z*w.width+c.x]!;
  if(c.floor!==undefined&&!floorAvailable(c.floor,w.schemaVersion))return refuse('Sol incompatible avec cette sauvegarde.');
  if(w.schemaVersion<211&&(c.floor==='sterile-tile'||tile.floor==='sterile-tile'))return refuse('Ce sol nécessite une colonie compatible.');
  if(c.kind==='lay-floor'){
    if(geyserBlocksPlantOrFloor256(w,c))return refuse('Un geyser ne peut pas recevoir de revêtement.','occupied');
    if(!isBuildableFloor(c.floor))return refuse('Choisissez un sol constructible.');
    const research=FLOOR_DEFINITIONS[c.floor].research;if(research&&!researchUnlocked(w,research))return refuse(research==='carpet-making'?'Recherchez Fabrication de tapis pour poser ce tapis.':research==='stonecutting'?'Recherchez Taille de pierre pour poser ces dalles.':research==='sterile-materials'?'Recherchez Matériaux stériles pour poser ces dalles.':'Recherchez Forge pour poser ces dalles.');
    if(tile.floor)return refuse('Retirez le revêtement existant avant de poser ce sol.','occupied');
  }else if(!tile.floor||c.floor!==undefined&&c.floor!==tile.floor)return refuse('Aucun revêtement correspondant à retirer.','missing-target');
  if(!terrainSupportsFloor256(tile,w))return refuse('Ce terrain ne peut pas recevoir ce sol.','incompatible-resource');
  const covers=(kind:unknown)=>kind==='wall'||kind==='cooler';
  if(w.structures.some(s=>covers(s.kind)&&footprintContains(s,c))||w.jobs.some(j=>footprintContains(j,c)&&(covers(j.furniture?.kind??j.kind)||j.kind==='lay-floor'||j.kind==='remove-floor'||w.schemaVersion<235&&['sow','cut','chop','harvest'].includes(j.kind)||j.kind==='mine')))return refuse('Un ouvrage ou un travail incompatible occupe cette case.','occupied');
  if(c.kind==='lay-floor'&&[...w.structures,...w.jobs].some(s=>s.kind==='grave'&&footprintContains(s,c)))return refuse('Une tombe doit conserver son terrain creusable.','incompatible-resource');
  if(w.resources.some(r=>r.kind==='rock'&&r.x===c.x&&r.z===c.z))return refuse('Dégagez la roche avant de poser ce sol.','incompatible-resource');
  return {ok:true};
}
/** Called only after the ordinary construction clearance has finished. Does
 * not remove the job: the central finish transaction owns activity cleanup. */
export function finishFloor(w:World,job:Job):boolean {
  if(geyserBlocksPlantOrFloor256(w,job))return false;
  if(job.kind!=='lay-floor'||!isBuildableFloor(job.floor)||job.floor==='sterile-tile'&&w.schemaVersion<211||isCarpetFloor355(job.floor)&&!isCarpetSchema355(w.schemaVersion)||job.floor==='straw-matting'&&!isStrawCouchSchema365(w.schemaVersion))return false;
  const tile=w.tiles[job.z*w.width+job.x];if(!tile||tile.floor||!terrainSupportsFloor256(tile,w)||w.resources.some(r=>r.x===job.x&&r.z===job.z&&!isFloorLightPlant(r)))return false;
  const recipe=flooringRecipe(job.floor),piles=w.piles.filter(p=>p.owner.type==='job'&&p.owner.jobId===job.id);
  if(piles.some(p=>!recipe.ingredients.some(c=>c.item===p.item))||recipe.ingredients.some(c=>piles.filter(p=>p.item===c.item).reduce((n,p)=>n+p.quantity,0)!==c.quantity))return false;
  // Terrain incompatibility destroys the plant, without the CutPlant producer.
  // Preflight all exact claims/cargo before any plant, material or tile mutation.
  const retirement=planConstructionPlantRetirement(w,job,job.id);
  if(!retirement||!commitConstructionPlantRetirement(w,retirement))return false;
  w.piles=filterPileEntries(w.piles,p=>p.owner.type!=='job'||p.owner.jobId!==job.id);tile.floor=job.floor;markTerrainCellChanged(w.tiles,job.z*w.width+job.x);refreshDuckWaterCell256(w,job);job.escrow.wood=0;job.escrow.food=0;
  // Keep the growing-zone intention; zero fertility prevents sowing until the
  // floor is removed. Matching plant jobs were retired by exact source IDs.
  refreshStock(w);return true;
}
/** Preflight shared ground placement and ledger before changing terrain or RNG.
 * The small preview copies only mutable material owners/escrows, not the world. */
export function removeFloor(w:World,job:Job):boolean {
  const tile=w.tiles[job.z*w.width+job.x];if(job.kind!=='remove-floor'||!tile?.floor||tile.floor!==job.floor)return false;
  if(tile.floor==='sterile-tile')return removeSterileFloor(w,job);
  const d=FLOOR_DEFINITIONS[tile.floor];let rng=w.rng,quantity=d.salvage??Math.floor(d.quantity/2);
  if(d.salvage===undefined&&d.quantity%2){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;if(rng/4294967296<.5)quantity++;}
  const view={...w,jobs:w.jobs.map(j=>({...j,escrow:{...j.escrow}})),piles:w.piles.map(p=>({...p,owner:{...p.owner}}))};
  const drops=!quantity||!d.item?[]:groundCapacity(view,job,d.item)>=quantity?[{cell:{x:job.x,z:job.z},quantity}]:planGroundPlacement(view,quantity,job,d.item);
  if(!drops)return false;
  for(const drop of drops)if(d.item){const owner={type:'ground' as const,...drop.cell},kind=ITEM_DEFINITIONS[d.item].kind;if(!materialCanFit(view,kind,drop.quantity,owner,d.item))return false;addMaterial(view,kind,drop.quantity,owner,d.item);}
  const lost=d.quantity-quantity,ledger=w.deconstructed;
  const previous=d.item==='wood'?ledger.lostWood:d.item==='steel'?ledger.lostSteel??0:d.item&&isBlockMaterial(d.item)?ledger.lostBlocks?.[d.item]??0:d.item==='cloth'?ledger.lostTextiles?.cloth??0:d.item==='hay'?ledger.lostHay365??0:0;
  if(!Number.isSafeInteger(ledger.count+1)||!Number.isSafeInteger(previous+lost))return false;
  for(const drop of drops)if(d.item)addMaterial(w,ITEM_DEFINITIONS[d.item].kind,drop.quantity,{type:'ground',...drop.cell},d.item);
  w.rng=rng;delete tile.floor;markTerrainCellChanged(w.tiles,job.z*w.width+job.x);refreshDuckWaterCell256(w,job);ledger.count++;
  if(d.item==='wood')ledger.lostWood+=lost;else if(d.item==='steel')ledger.lostSteel=(ledger.lostSteel??0)+lost;
  else if(d.item&&isBlockMaterial(d.item)){ledger.lostBlocks??={};ledger.lostBlocks[d.item]=(ledger.lostBlocks[d.item]??0)+lost;}
  else if(d.item==='cloth'&&lost>0){ledger.lostTextiles??={};ledger.lostTextiles.cloth=(ledger.lostTextiles.cloth??0)+lost;}
  else if(d.item==='hay'&&lost>0)ledger.lostHay365=(ledger.lostHay365??0)+lost;
  for(const f of [...w.filth?.items??[]])if(f.x===job.x&&f.z===job.z)removeFilth(w,f);
  refreshStock(w);return true;
}
/** Reserve both refunds in one preview. A later ingredient cannot reuse a
 * cell already occupied by an earlier refund; failure leaves even RNG intact. */
function removeSterileFloor(w:World,job:Job):boolean {
  if(w.schemaVersion<211)return false;
  const ledger=w.deconstructed,view={...w,jobs:w.jobs.map(j=>({...j,escrow:{...j.escrow}})),piles:w.piles.map(p=>({...p,owner:{...p.owner}}))};
  if(!Number.isSafeInteger(ledger.count+1))return false;
  let rng=w.rng;
  const refunds:{item:ItemId;quantity:number;cell:Cell}[]=[],losses:{item:'steel'|'silver';quantity:number}[]=[];
  for(const cost of FLOOR_DEFINITIONS['sterile-tile'].ingredients!){
    let quantity=Math.floor(cost.quantity/2);
    if(cost.quantity%2){rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;rng>>>=0;if(rng/4294967296<.5)quantity++;}
    const item=cost.item as 'steel'|'silver',lost=cost.quantity-quantity,previous=item==='steel'?ledger.lostSteel??0:ledger.lostSilver??0;
    if(!Number.isSafeInteger(previous+lost))return false;
    const drops=groundCapacity(view,job,item)>=quantity?[{cell:{x:job.x,z:job.z},quantity}]:planGroundPlacement(view,quantity,job,item);
    if(!drops)return false;
    for(const drop of drops){
      const owner={type:'ground' as const,...drop.cell},kind=ITEM_DEFINITIONS[item].kind;
      if(!materialCanFit(view,kind,drop.quantity,owner,item))return false;
      addMaterial(view,kind,drop.quantity,owner,item);refunds.push({item,...drop});
    }
    losses.push({item,quantity:lost});
  }
  for(const refund of refunds)addMaterial(w,ITEM_DEFINITIONS[refund.item].kind,refund.quantity,{type:'ground',...refund.cell},refund.item);
  w.rng=rng;delete w.tiles[job.z*w.width+job.x]!.floor;markTerrainCellChanged(w.tiles,job.z*w.width+job.x);refreshDuckWaterCell256(w,job);ledger.count++;
  for(const loss of losses)if(loss.item==='steel')ledger.lostSteel=(ledger.lostSteel??0)+loss.quantity;else ledger.lostSilver=(ledger.lostSilver??0)+loss.quantity;
  for(const f of [...w.filth?.items??[]])if(f.x===job.x&&f.z===job.z)removeFilth(w,f);
  refreshStock(w);return true;
}
/** A burned floor is a distinct nonflammable surface with no recipe refund.
 * Fire's resource ledger records the original three wooden units as lost.
 * Schema 355: a carpet becomes BurnedCarpet, its seven cloth lost. */
export function burnFloor(w:World,c:Cell):boolean {
  const carpet=w.tiles[c.z*w.width+c.x]?.floor;
  // Schema 365: straw matting becomes BurnedStrawMatting, its two hay lost.
  if(carpet==='straw-matting'){
    const tile=w.tiles[c.z*w.width+c.x]!;if(!isStrawCouchSchema365(w.schemaVersion)||!w.fires||!Number.isSafeInteger((w.fires.ledger.items.hay??0)+STRAW_MATTING_365.hay))return false;
    tile.floor='burned-straw-matting';markTerrainCellChanged(w.tiles,c.z*w.width+c.x);refreshDuckWaterCell256(w,c);w.fires.ledger.items.hay=(w.fires.ledger.items.hay??0)+STRAW_MATTING_365.hay;return true;
  }
  if(isCarpetFloor355(carpet)){
    const tile=w.tiles[c.z*w.width+c.x]!;if(!isCarpetSchema355(w.schemaVersion)||!w.fires||!Number.isSafeInteger((w.fires.ledger.items.cloth??0)+CARPET_FACTS_355.cloth))return false;
    tile.floor='burned-carpet';markTerrainCellChanged(w.tiles,c.z*w.width+c.x);refreshDuckWaterCell256(w,c);w.fires.ledger.items.cloth=(w.fires.ledger.items.cloth??0)+CARPET_FACTS_355.cloth;return true;
  }
  const tile=w.tiles[c.z*w.width+c.x];if(tile?.floor!=='wood-planks'||!w.fires||!Number.isSafeInteger((w.fires.ledger.items.wood??0)+3))return false;
  tile.floor='burned-wood';markTerrainCellChanged(w.tiles,c.z*w.width+c.x);refreshDuckWaterCell256(w,c);w.fires.ledger.items.wood=(w.fires.ledger.items.wood??0)+3;return true;
}
