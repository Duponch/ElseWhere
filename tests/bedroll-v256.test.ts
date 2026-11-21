import {expect,test} from 'vitest';
import {applyCommand,canDesignate,stepWorld,serializeWorld,deserializeWorld,validateWorld,addGroundMaterial} from '../src/sim/index.ts';
import {constructionRecipe,validConstructionMaterial,constructionMaterials} from '../src/sim/construction-materials.ts';
import {BEDROLL_MATERIALS_256,BEDROLL_TEXTILES_256} from '../src/sim/bedroll-textiles-256.ts';
import {bedComfort,bedRestEffectiveness} from '../src/sim/furniture-stats.ts';
import {bedImmunityFactor,bedHealPerDay} from '../src/sim/hospital-medical-stats.ts';
import {footprintCells} from '../src/sim/definitions.ts';
import {structureMaxHp,structureFlammability} from '../src/sim/thing-damage-rules.ts';
import {canStandAt,FURNITURE_TRAVEL} from '../src/sim/furniture-travel.ts';
import {validBedrollState256,validBedrollBuilding256} from '../src/sim/bedroll-save-256.ts';
import {validatePackedFurnitureRecords} from '../src/sim/furniture-transfer-save.ts';
import {validCaravanBedrollPacks256,captureGroupBedrollDeparture256,groupBedrollDepartureCurrent256,detachGroupBedrollDeparture256} from '../src/sim/group-bedroll-capture-256.ts';
import {previewGroupBedrollLoading256,commitGroupBedrollPickup256,validGroupBedrollLoadingField256,type PreparingBedrollGroup256} from '../src/sim/group-bedroll-loading-256.ts';
import {captureGroupMass} from '../src/sim/group-capture.ts';
import {emptyGroupLedger} from '../src/sim/group-loading.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {registryCamp,preparedMap} from './helpers/world-maps-v255.ts';
import {registeredMapForValidation,registeredMap,flushRegisteredMap} from '../src/sim/world-map-context.ts';
import {serializeCampaign,deserializeCampaign} from '../src/sim/serialization.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import type {World,Structure} from '../src/sim/types.ts';
import type {PackedFurniture} from '../src/sim/furniture-rules.ts';
const building=(id:number,material:Structure['material']='cloth'):Structure=>({id,kind:'bedroll',x:15,z:17,orientation:0,footprint:'standard',material,quality:'normal'});
function until(w:World,done:()=>boolean,limit=1600){for(let n=0;n<limit&&!done();n++)stepWorld(w);expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs,packed:w.packed})).toBe(true);expect(validateWorld(w)).toEqual([]);}

test('all22 real soft materials have paid40-unit recipes and their distinct HP/fire factors; old furniture admission stays literal',()=>{
 expect(FURNITURE_TRAVEL.bedroll).toEqual({delay:1.4,stand:true,repeat:true});// Schema 358 adds devilstrand, admitted from 358 only.
 expect(BEDROLL_MATERIALS_256).toHaveLength(23);expect(BEDROLL_MATERIALS_256.at(-1)).toBe('devilstrand');expect(constructionMaterials('bedroll')).toEqual(BEDROLL_MATERIALS_256);
 for(const material of BEDROLL_MATERIALS_256){const b=building(5,material),factor=BEDROLL_TEXTILES_256[material];const since=material==='devilstrand'?358:256;expect(validConstructionMaterial('bedroll',material,since)).toBe(true);expect(validConstructionMaterial('bedroll',material,since-1)).toBe(false);expect(constructionRecipe(b)).toMatchObject({ingredients:[{item:material,quantity:40}],work:60,coreWork:600});expect(structureMaxHp(b)).toBe(Math.round(75*factor.hitPointsFactor));expect(structureFlammability(b)).toBe(factor.flammabilityFactor);}
 expect(validConstructionMaterial('armchair','rhinoceros-leather',255)).toBe(false);const b=building(5);expect(bedComfort(b)).toBe(.68);expect(bedRestEffectiveness(b)).toBe(.95);expect(bedImmunityFactor(b)).toBe(1.05);expect(bedHealPerDay(b)).toBe(4);
});

test('head anchor rotates both real cells, allows standing and refuses deep water or overlapping construction',()=>{
 const w=deconstructionCamp();for(const orientation of [0,1,2,3] as const){const b={...building(w.nextId++),orientation};const cells=footprintCells(b);expect(cells).toHaveLength(2);expect(cells[0]).toEqual({x:b.x,z:b.z});expect(new Set(cells.map(c=>c.x+':'+c.z)).size).toBe(2);w.structures=[b];for(const c of cells)expect(canStandAt(w,c)).toBe(true);expect(canDesignate(w,{type:'designate',kind:'bedroll',material:'cloth',x:b.x,z:b.z,orientation}).ok).toBe(false);w.structures=[];w.tiles[cells[1]!.z*w.width+cells[1]!.x]!.terrain='water';expect(canDesignate(w,{type:'designate',kind:'bedroll',material:'cloth',x:b.x,z:b.z,orientation}).ok).toBe(false);w.tiles[cells[1]!.z*w.width+cells[1]!.x]!.terrain='grass';}
});

test('construction consumes real cloth and physical minification/reinstallation preserves one ID, material, quality and exact carried replay',()=>{
 const w=deconstructionCamp();addGroundMaterial(w,ITEM_DEFINITIONS.cloth.kind,40,{x:12,z:16},'cloth');expect(applyCommand(w,{type:'designate',kind:'bedroll',material:'cloth',x:17,z:18}).ok).toBe(true);until(w,()=>w.structures.some(s=>s.kind==='bedroll'));const b=w.structures.find(s=>s.kind==='bedroll')!,identity={id:b.id,material:b.material,quality:b.quality};expect(w.piles.filter(p=>p.item==='cloth').reduce((n,p)=>n+p.quantity,0)).toBe(0);
 expect(applyCommand(w,{type:'designate',kind:'uninstall',x:b.x,z:b.z}).ok).toBe(true);until(w,()=>w.packed.some(p=>p.building===b));expect(w.structures).not.toContain(b);expect(applyCommand(w,{type:'install',structureId:b.id,x:24,z:21,orientation:3}).ok).toBe(true);until(w,()=>w.packed.some(p=>p.building===b&&p.owner.type==='pawn'));const fork=deserializeWorld(serializeWorld(w));until(w,()=>w.structures.includes(b));stepWorld(fork,w.tick-fork.tick);expect(serializeWorld(fork)).toBe(serializeWorld(w));expect(b).toMatchObject({...identity,x:24,z:21,orientation:3});expect(w.packed).toHaveLength(0);
});

test('255 rejects bedroll on either real map before neutral256 migration and Decoder keeps its previous confirmed world',()=>{
 const w=registryCamp();preparedMap(w);const raw=JSON.parse(serializeCampaign(w));raw.schemaVersion=255;
 // A literal pre256 preparation does not own future wander/fauna components.
 for(const map of [raw,...raw.worldMaps.sites.filter((s:any)=>s.map).map((s:any)=>s.map)]){for(const pawn of map.pawns)if(pawn.mental)delete pawn.mental.wander;delete map.wildlife;}
 const before=JSON.stringify(raw);expect(()=>deserializeCampaign(before)).not.toThrow();expect(JSON.stringify(raw)).toBe(before);
 for(const mapId of [0,1]){const bad=JSON.parse(before),target=mapId===0?bad:bad.worldMaps.sites.find((s:any)=>s.id===mapId).map;target.structures.push(building(bad.nextId++));expect(()=>deserializeCampaign(JSON.stringify(bad))).toThrow();}
 const enc=new SnapshotEncoder(),dec=new SnapshotDecoder(),packet=structuredClone(enc.encode(w,0,1));const accepted=dec.adopt(packet);expect(accepted.status,JSON.stringify(accepted)).toBe('applied');if(accepted.status!=='applied'||packet.kind!=='checkpoint')throw Error('Expected real checkpoint');const frozen=structuredClone(accepted.world),badSnapshot=structuredClone(packet);badSnapshot.revision++;Object.assign(badSnapshot.world,{schemaVersion:255});badSnapshot.world.structures.push(building(badSnapshot.world.nextId++));expect(dec.adopt(badSnapshot).status).toBe('resync');expect(accepted.world).toEqual(frozen);
});

test('packed bedroll inner pose remains nonspatial across200/250 while its real carrier/quality/future fields stay strict',()=>{
 const w=deconstructionCamp(),p=w.pawns[0]!,b={...building(w.nextId++),x:249,z:249},pack:PackedFurniture={building:b,owner:{type:'inventory',pawnId:p.id}};w.packed.push(pack);expect(validCaravanBedrollPacks256([pack],[p],w.nextId,256)).toBe(true);expect(validatePackedFurnitureRecords([pack],{width:200,height:200,tick:w.tick,nextId:w.nextId},256,new Set())).toEqual([]);expect(validatePackedFurnitureRecords([pack],{width:250,height:250,tick:w.tick,nextId:w.nextId},255,new Set()).length).toBeGreaterThan(0);
 const capture=captureGroupBedrollDeparture256(w,[p])!;expect(capture.packs[0]).toBe(pack);b.damage=1;expect(groupBedrollDepartureCurrent256(w,capture)).toBe(false);delete b.damage;expect(groupBedrollDepartureCurrent256(w,capture)).toBe(true);expect(detachGroupBedrollDeparture256(w,capture)[0]).toBe(pack);expect(w.packed).toHaveLength(0);expect(validBedrollBuilding256({...b,extra:true},256)).toBe(false);expect(validBedrollState256({...w,structures:[b]},256)).toBe(false);
});

test('formation loads at genuine finished contact, refuses future markers, and cancellation keeps the original inventory package',()=>{
 const w=deconstructionCamp(),p=w.pawns[0]!,b=building(w.nextId++),pack:PackedFurniture={building:b,owner:{type:'ground',x:20,z:20}};w.packed=[pack];const mass=captureGroupMass([p],[])!,preview=previewGroupBedrollLoading256(w,[b.id],[p],mass,()=> 'reachable');expect(preview.kind).toBe('ready');if(preview.kind!=='ready')throw Error('Expected prepared loading');expect(preview.preview.mass.grams).toBe(2500);
 const g:PreparingBedrollGroup256={id:1,startedAt:w.tick,destination:1,ledger:emptyGroupLedger(),travelPreparation:true,phase:'loading',memberIds:[p.id],rendezvous:{x:p.x,z:p.z},meeting:[{pawnId:p.id,cell:{x:p.x,z:p.z}}],manifest:[],cursor:0,exits:[{pawnId:p.id,cell:{x:0,z:0}}],bedrollLoading:preview.preview.loading};w.group=g;const before=JSON.stringify(pack);expect(commitGroupBedrollPickup256(w,g,p)).toBe(false);expect(JSON.stringify(pack)).toBe(before);Object.assign(p,{x:19,z:20,moveCooldown:1});expect(commitGroupBedrollPickup256(w,g,p)).toBe(false);p.moveCooldown=0;delete p.motion;expect(commitGroupBedrollPickup256(w,g,p)).toBe(true);expect(pack.owner).toEqual({type:'inventory',pawnId:p.id});expect(g.bedrollLoading!.manifest[0]!.loaded).toBe(true);expect(validGroupBedrollLoadingField256(g,w,255)).toBe(false);delete w.group;expect(w.packed[0]).toBe(pack);expect(pack.building).toBe(b);
});
