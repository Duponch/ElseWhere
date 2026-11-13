import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validBuildingFuelShape} from './biofuel-save.ts';
import {validFirefoamPopper290} from './firefoam-state-290.ts';
import {validFermentationState265} from './fermentation-state-265.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {structureMaxHp} from './thing-damage-rules.ts';
import {validateFlowerPotState} from './flower-pot.ts';
import {isHabitatFurnitureKind,FURNITURE_DEFINITIONS} from './furniture-stats.ts';
import {validGlowPodPacked256} from './cave-glowpod-minification-256.ts';
import {validAncientMonumentBuilding256} from './ancient-monument-save-256.ts';
import {validAncientCasketWickField256} from './ancient-casket-explosive-state-256.ts';
import {animalContentsOwner256} from './animal-local-contents-256.ts';
import {validLocalRoadPropPackedBuilding256} from './local-road-props-save-256.ts';
import {validBedrollBuilding256} from './bedroll-save-256.ts';
import {groupPackedMassGrams258} from './group-freight-mass-258.ts';
import {validShelfBuildingShape} from './shelf-save.ts';
import {isShelfKind,shelfAt} from './shelf-storage.ts';
import { isBedKind } from './bed-kinds.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { isFoodWorkstation } from './food-workstations.ts';
import { fuelLimit } from './fuel.ts';
import { footprintCells } from './definitions.ts';
import { furnitureDuration, furnitureObject, minifiable } from './furniture-rules.ts';
import { groundOccupancyAllows } from './occupancy.ts';
import { deconstructionAvailable } from './deconstruction-rules.ts';
import { isArtMaterial, isArtRecipe } from './art-rules.ts';
import { isFurnitureQuality, isSculptureKind, sculptureMaxHitPoints } from './furniture-stats.ts';
import type { World } from './types.ts';
import { validSpikeTrapBuildingShape } from './spike-trap-save.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0):v is number=>Number.isSafeInteger(v)&&Number(v)>=min;
/** A minified original keeps its option, never an active wick. This field is
 * prospective290 even when this shared packed-record guard is called alone. */
function validPackedFirefoam290(b:Record<string,unknown>,version:number):boolean {
 const d=Object.getOwnPropertyDescriptor(b,'firefoam290');
 if(!d)return !('firefoam290'in b)&&b.kind!=='firefoam-popper';
 const kind=Object.getOwnPropertyDescriptor(b,'kind'),material=Object.getOwnPropertyDescriptor(b,'material'),footprint=Object.getOwnPropertyDescriptor(b,'footprint');
 return (version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))&&Object.getPrototypeOf(b)===Object.prototype&&d.enumerable===true&&Object.hasOwn(d,'value')
  &&kind?.enumerable===true&&Object.hasOwn(kind,'value')&&kind.value==='firefoam-popper'
  &&material?.enumerable===true&&Object.hasOwn(material,'value')&&material.value==='steel'
  &&footprint?.enumerable===true&&Object.hasOwn(footprint,'value')&&footprint.value==='standard'
  &&validFirefoamPopper290(d.value,version)&&!Object.hasOwn(d.value,'wick');
}
export function validateFurniture(world:World,version:number,ids:Set<number>,shapesOnly=false):string[] {
  const errors:string[]=[];
  if(version<25) return world.packed!==undefined||world.jobs.some(j=>j.furniture!==undefined)?['Legacy save contains furniture transfers.']:[];
  if(!Array.isArray(world.packed)||world.packed.length>32768)return ['Invalid packed furniture collection.'];
  errors.push(...validatePackedFurnitureRecords(world.packed,world,version,ids,shapesOnly));
  if(version>=256)for(const p of world.packed){const owner=p.owner;if(owner.type==='inventory'&&!world.pawns.some(a=>a.id===owner.pawnId)&&!animalContentsOwner256(world,owner.pawnId))errors.push('Missing actual animal/human packed owner.');}
  if(errors.length)return errors;
  const seen=new Set<number>();
  for(const job of world.jobs) {
    const f=job.furniture;
    if(job.installationWork!==undefined&&(version<26||job.kind!=='install'||!['build','haul'].includes(job.installationWork)||job.reservedBy===null))errors.push('Invalid installation work assignment.');
    if(!['install','uninstall'].includes(job.kind)){if(f!==undefined)errors.push('Unexpected furniture target.');continue;}
    if(!record(f)||!integer(f.structureId,1)||!minifiable(f.kind)||f.kind==='firefoam-popper'&&(version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||version<256&&(f.kind==='bedroll'||f.kind==='glow-pod')||version<229&&isShelfKind(f.kind)||version<226&&f.kind==='spike-trap'||version<224&&f.kind==='double-bed'||version<206&&f.kind==='drug-lab'||version<190&&f.kind==='tube-television'||version<187&&f.kind==='hospital-bed'||version<122&&f.kind==='chess-table'||version<31&&f.kind==='stonecutter'||version<73&&(f.kind==='research-bench'||f.kind==='tailor-bench')||version<177&&f.kind==='sun-lamp'||version<42&&f.kind==='standing-lamp'||version<85&&f.kind==='battery'||version<84&&isFoodWorkstation(f.kind)||version<90&&f.kind==='electric-tailor-bench'||version<101&&f.kind==='machining-table'||version<104&&['art-bench','small-sculpture','large-sculpture'].includes(f.kind)||Object.keys(f).some(k=>!['structureId','kind'].includes(k))){errors.push('Invalid furniture target.');continue;}
    const source=furnitureObject(world,f.structureId);
    if(world.packed.some(p=>p.building.id===f.structureId&&p.owner.type==='inventory'))errors.push('Merchant possession has a colonial furniture order.');
    if(source&&!targetBuildingPlayerUse263(world,source))errors.push('Furniture job does not own its actual original');
    if(!source||source.kind!==f.kind||source.footprint!==job.footprint||seen.has(f.structureId)||job.deconstruction!==undefined||job.growingZoneId!==undefined||job.escrow.wood||job.escrow.food)errors.push('Invalid or duplicated furniture intent.');
    seen.add(f.structureId);
    if(['spike-trap','sun-lamp','standing-lamp','small-sculpture','large-sculpture'].includes(f.kind)&&job.orientation!==0)errors.push('Furniture installation cannot rotate.');
    if(job.kind==='install'&&job.construction!=='blueprint')errors.push('Installation must remain a blueprint.');
    if(job.kind==='uninstall'&&(!world.structures.includes(source!)||source!.x!==job.x||source!.z!==job.z||source!.orientation!==job.orientation))errors.push('Uninstall target moved.');
    if(job.progress>=furnitureDuration(world,job)||job.progress>0&&!world.pawns.some(p=>p.jobId===job.id))errors.push('Invalid furniture work progress.');
    if(!shapesOnly&&world.structures.includes(source!)&&job.reservedBy!==null&&!deconstructionAvailable(world,{...job,deconstruction:{structureId:source!.id,kind:source!.kind}},job.reservedBy))errors.push('Furniture transfer conflicts with usage.');
  }
  if(shapesOnly)return errors;
  const ground=new Set<number>(),carriers=new Set<number>();
  for(const pack of world.packed) {
    const o=pack.owner,id=pack.building.id;
    if(world.structures.some(s=>s.id===id)||world.jobs.some(j=>j.deconstruction?.structureId===id))errors.push('Packed furniture is also installed or deconstructed.');
    if(o.type==='ground') {
      const key=o.z*world.width+o.x;
      if(ground.has(key)||shelfAt(world,o)||!groundOccupancyAllows(world,o)||world.piles.some(p=>p.owner.type==='ground'&&p.owner.x===o.x&&p.owner.z===o.z))errors.push('Furniture ground slot is occupied.');
      ground.add(key);
    } else if(o.type==='inventory') {
      const trader=world.pawns.find(p=>p.id===o.pawnId);
      // Cancellation may leave the same acquired package with its real local
      // holder.258 admits only the existing freight set; old bedroll/trade
      // permissions and the full component/identity guards above stay literal.
      const caravanPack=(version>=258?groupPackedMassGrams258(pack,version)!==undefined:version>=256&&pack.building.kind==='bedroll')
        &&(world.pawns.some(p=>p.id===o.pawnId)||animalContentsOwner256(world,o.pawnId)!==undefined);
      if(!caravanPack&&(version<105||!isSculptureKind(pack.building.kind)||trader?.visitor?.role!=='trader'||trader.body?.lostAt!==undefined))errors.push('Invalid merchant furniture inventory.');
    } else {
      const pawn=world.pawns.find(p=>p.id===o.pawnId),job=world.jobs.find(j=>j.id===pawn?.jobId);
      const artOutput=version>=104&&isSculptureKind(pack.building.kind)&&isArtRecipe(pawn?.cooking?.recipe)
        &&pawn?.cooking?.phase==='output'&&pawn.cooking.productId===id&&pawn.cooking.recipe===pack.building.kind;
      if(carriers.has(o.pawnId)||!pawn||!(version>=44&&pawn.interruptedCargo||job?.kind==='install'&&job.furniture?.structureId===id||version>=26&&pawn?.haul?.whole&&pawn.haul.phase==='deliver'&&pawn.haul.carryPileId===id||artOutput)||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===o.pawnId))errors.push('Invalid furniture carrier.');
      carriers.add(o.pawnId);
    }
  }
  for(const j of world.jobs)if(j.kind==='install'&&world.resources.some(r=>r.kind==='rock'&&footprintCells(j).some(c=>c.x===r.x&&c.z===r.z)))errors.push('Installation overlaps a rock resource.');
  for(const j of world.jobs)if(j.kind==='install'&&world.structures.some(s=>s.id!==j.furniture?.structureId&&sharesConstructionLayer(s.kind,j.furniture!.kind)&&footprintCells(s).some(c=>footprintCells(j).some(d=>c.x===d.x&&c.z===d.z))))errors.push('Installation overlaps another building.');
  return errors;
}

export function validatePackedFurnitureRecords(packed:readonly import('./furniture-rules.ts').PackedFurniture[],world:Pick<World,'width'|'height'|'tick'|'nextId'>,version:number,ids:Set<number>,registerIds=true):string[] {
 const errors:string[]=[];const shapesOnly=registerIds;
  const cell=(v:Record<string,unknown>)=>integer(v.x)&&integer(v.z)&&v.x<world.width&&v.z<world.height;
  for(const pack of packed) {
    if(record(pack)&&record(pack.building)&&(pack.building.kind==='vent'||Object.hasOwn(pack.building,'vent'))){errors.push('Invalid vent state on packed furniture.');continue;}
    if(!record(pack)||!record(pack.building)||!record(pack.owner)) {errors.push('Invalid furniture package.');continue;}
    const b=pack.building,o:Record<string,unknown>=pack.owner;
    if(!validPackedFirefoam290(b,version))errors.push('Invalid or future packed firefoam component.');
    if((b.kind==='fueled-smithy'||b.kind==='electric-smithy')&&(version<267||b.material!=='steel'||b.footprint!=='standard'||Object.hasOwn(b,'quality')))errors.push('Invalid or future packed smithy.');
    if(b.kind==='fermenting-barrel'?(version<265||!validFermentationState265(b.fermentation)):Object.hasOwn(b,'fermentation'))errors.push('Invalid or future packed fermentation.');
    if((b.kind==='brewery'||b.kind==='fermenting-barrel')&&(version<265||b.material!=='wood'||b.footprint!=='standard'||['quality','power','fuel'].some(k=>Object.hasOwn(b,k))))errors.push('Invalid or future packed brewing building.');
    // A minified inner pose is historical data, independent of the receiving map.
    const literalInnerPose=version>=258||version>=256&&b.kind==='bedroll';
    if(!validGlowPodPacked256(b,version,world))errors.push('Invalid or future packed Hive/GlowPod component.');
    if(!validAncientCasketWickField256(b,version,world.tick)){errors.push('Invalid future/extraneous casket wick on packed furniture.');continue;}
    if(!validBedrollBuilding256(b,version)||!validAncientMonumentBuilding256(b,version))errors.push('Invalid or future packed bedroll.');
    if(version>=258){
      if(Reflect.ownKeys(b).some(k=>typeof k!=='string'||!['id','kind','x','z','orientation','footprint','material','quality','damage','medical','prisoner','fuel','bills','flower','gatherSpot','shelf','spikeTrap','art','power','battery','heater','breakdown','deepDrill','emp','factionId','glowPod',...(version>=265?['fermentation']:[]),...((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))?['firefoam290']:[])].includes(k)))errors.push('Unknown packed building field.');
      if(b.damage!==undefined&&(!integer(b.damage,1)||b.damage>=structureMaxHp(b as unknown as import('./types.ts').Structure,version)))errors.push('Invalid packed building damage.');
      if(isHabitatFurnitureKind(b.kind)&&FURNITURE_DEFINITIONS[b.kind].quality||isSculptureKind(b.kind)){if(!isFurnitureQuality(b.quality))errors.push('Invalid packed furniture quality.');}else if(b.quality!==undefined)errors.push('Unexpected packed furniture quality.');
      if(b.flower!==undefined&&(b.kind!=='flower-pot'||validateFlowerPotState(b.flower,world.tick).length)||b.kind==='flower-pot'&&b.flower===undefined)errors.push('Invalid packed flower pot state.');
      if(b.gatherSpot!==undefined&&(!['table','table-square','table-long'].includes(b.kind)||typeof b.gatherSpot!=='boolean'))errors.push('Invalid packed gathering spot.');
    }
    if(!validShelfBuildingShape(b,version))errors.push('Invalid packed shelf storage state.');
    if(!validSpikeTrapBuildingShape(b,version,true))errors.push('Invalid packed spike trap state.');
    if(isSculptureKind(b.kind)){
      const art=b.art;
      if(version<104||!isArtMaterial(b.material,version)||!isFurnitureQuality(b.quality)
        ||!record(art)||Object.keys(art).some(k=>!['authorId','createdAt'].includes(k))
        ||!integer(art.authorId,1)||!integer(art.createdAt)||art.createdAt>world.tick
        ||b.damage!==undefined&&(!integer(b.damage,0)||b.damage>=sculptureMaxHitPoints(b.kind,b.material)))errors.push('Invalid packed sculpture.');
    }else if(b.art!==undefined)errors.push('Unexpected packed artwork.');
    if(b.medical!==undefined&&(version<46||!isBedKind(b.kind)||version<187&&b.kind==='hospital-bed'||b.medical!==true))errors.push('Invalid packed medical bed role.');
    if(b.prisoner!==undefined&&(version<86||!isBedKind(b.kind)||version<187&&b.kind==='hospital-bed'||b.prisoner!==true))errors.push('Invalid packed prisoner bed role.');
    if(!validLocalRoadPropPackedBuilding256(b,version)||!integer(b.id,1)||b.id>=world.nextId||!minifiable(b.kind)||b.kind==='firefoam-popper'&&(version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||version<256&&(b.kind==='bedroll'||b.kind==='glow-pod')||version<229&&isShelfKind(b.kind)||version<226&&b.kind==='spike-trap'||version<224&&b.kind==='double-bed'||version<222&&b.kind==='electric-smelter'||version<206&&b.kind==='drug-lab'||version<190&&b.kind==='tube-television'||version<187&&b.kind==='hospital-bed'||version<122&&b.kind==='chess-table'||version<31&&b.kind==='stonecutter'||version<73&&(b.kind==='research-bench'||b.kind==='tailor-bench')||version<177&&b.kind==='sun-lamp'||version<42&&b.kind==='standing-lamp'||version<85&&b.kind==='battery'||version<84&&isFoodWorkstation(b.kind)||version<90&&b.kind==='electric-tailor-bench'||version<101&&b.kind==='machining-table'||version<104&&['art-bench','small-sculpture','large-sculpture'].includes(b.kind)||(literalInnerPose?!integer(b.x)||!integer(b.z):!cell(b))||!integer(b.orientation)||b.orientation>3||!literalInnerPose&&footprintCells(b).some(c=>!cell({x:c.x,z:c.z}))||!['standard','legacy-single'].includes(b.footprint)||b.footprint==='legacy-single'&&b.kind!=='bed'||b.fuel!==undefined&&b.kind!=='fueled-stove'&&b.kind!=='fueled-smithy'||b.bills!==undefined&&(version<32||b.kind!=='stonecutter'&&!(version>=267&&(b.kind==='fueled-smithy'||b.kind==='electric-smithy'))&&!(version>=222&&b.kind==='electric-smelter')&&!(version>=73&&b.kind==='tailor-bench')&&!(version>=90&&b.kind==='electric-tailor-bench')&&!(version>=101&&b.kind==='machining-table')&&!(version>=104&&b.kind==='art-bench')&&!(version>=206&&b.kind==='drug-lab')&&!(version>=265&&b.kind==='brewery')&&!(version>=123&&b.kind==='fabrication-bench')&&!(version>=84&&isFoodWorkstation(b.kind))))errors.push('Invalid packed building.');
    if(b.kind==='fueled-smithy'&&!validBuildingFuelShape(b.fuel,b.kind,version,world.tick))errors.push('Invalid packed smithy fuel.');
    if(b.kind==='fueled-stove'){const f=b.fuel;if(version<84||!record(f)||!integer(f.ticks)||f.ticks>fuelLimit(b.kind)||!integer(f.burned)||f.burned>world.tick*16||typeof f.autoRefuel!=='boolean'||Object.keys(f).some(k=>!['ticks','burned','autoRefuel'].includes(k)))errors.push('Invalid packed stove fuel.');}
    if(shapesOnly){if(ids.has(b.id))errors.push('Duplicate furniture identity.');ids.add(b.id);}
    if(Object.keys(pack).some(k=>!['building','owner'].includes(k))||Object.keys(o).some(k=>!(o.type==='ground'?['type','x','z']:['type','pawnId']).includes(k))||(o.type==='ground'?!cell(o):o.type==='pawn'||version>=105&&o.type==='inventory'?!integer(o.pawnId,1):true))errors.push('Invalid furniture owner.');
  }

 return errors;
}
