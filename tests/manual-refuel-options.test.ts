/* Préparation privée. Destination proposée : tests/manual-refuel-options.test.ts.
 * Aucun contrôle exécuté par l’auteur. Fixtures déclarées, transport réel. */
import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health';
import {asOldSchema} from './scenarios/old-schema';
import {fixtureBuilding} from './scenarios/deconstruction';
import {addGroundMaterial,refreshStock} from '../src/sim/materials';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {queryOrderOptions} from '../src/sim/player-orders';
import {footprintCells} from '../src/sim/definitions';
import {newBuildingFuel,fuelItem,fuelLimit,WOOD_BURN_TICKS} from '../src/sim/fuel';
import {newPowerState} from '../src/sim/power-rules';
import {serializeWorld,deserializeWorld,validateWorld,validateCampaignSchema378} from '../src/sim/serialization';
import type {Structure,World} from '../src/sim/types';

const kinds=['campfire','fueled-stove','passive-cooler','wood-generator','chemfuel-generator'] as const;
function scene(kind:typeof kinds[number],quantity=5){
 const w=medicalCamp(2),[p,other]=w.pawns;
 // État initial déclaré de l’unité, sans campagne ni recherche jouée créditée.
 w.research={points:0,project:null,biofuelRefining:{points:700000000,completedAt:2900}};
 for(const a of w.pawns){delete a.background;delete a.traits;}p!.priorities.haul=1;
 Object.assign(p!,{x:8,z:13});Object.assign(other!,{x:8,z:16});
 const s=fixtureBuilding(w,kind,12,13) as Structure;s.material=kind==='campfire'||kind==='passive-cooler'?'wood':'steel';
 s.fuel={...newBuildingFuel(kind),ticks:0,burned:0,autoRefuel:false};
 if(kind==='campfire'||kind==='fueled-stove')s.bills=[];
 if(kind==='wood-generator'||kind==='chemfuel-generator')s.power={...newPowerState(kind),on:false};
 const item=fuelItem(kind);addGroundMaterial(w,item,quantity,{x:10,z:13},item);refreshStock(w);
 expect(validateWorld(w)).toEqual([]);const source=w.piles.find(i=>i.item===item)!;
 return {w,p:p!,other:other!,s,source};
}
function fuelOption(w:World,pawnId:number,s:Structure,cell={x:s.x,z:s.z}){
 return queryOrderOptions(w,pawnId,cell).filter(o=>o.haulTarget?.type==='fuel'&&o.haulTarget.structureId===s.id);
}
function until(w:World,condition:()=>boolean,max=180){for(let n=0;n<max&&!condition();n++)stepWorld(w);expect(condition()).toBe(true);expect(Number(w.schemaVersion)===378?validateCampaignSchema378(w):validateWorld(w)).toEqual([]);}

test.each(kinds)('%s : option sur toute empreinte, puis vrai prélèvement entier et crédit physique',kind=>{
 const {w,p,s,source}=scene(kind),before=serializeWorld(w);
 for(const cell of footprintCells(s))expect(fuelOption(w,p.id,s,cell)).toMatchObject([{enabled:true,haulTarget:{type:'fuel',structureId:s.id}}]);
 expect(serializeWorld(w)).toBe(before);
 expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'fuel',structureId:s.id},queue:false}).ok).toBe(true);
 until(w,()=>p.haul?.phase==='deliver');const task=p.haul!,carry=w.piles.find(i=>i.id===task.carryPileId)!;
 expect(task).toMatchObject({sourcePileId:source.id,quantity:5,destination:{type:'fuel',structureId:s.id,forced:true}});expect(carry.id).not.toBe(source.id);expect(w.piles.some(i=>i.id===source.id)).toBe(false);
 expect(carry).toMatchObject({quantity:5,item:fuelItem(kind),owner:{type:'pawn',pawnId:p.id}});expect(task.pickupCell).toEqual({x:10,z:13});
 const saved=deserializeWorld(serializeWorld(w));expect(saved).toEqual(w);
 until(w,()=>p.haul===null&&s.fuel!.ticks+s.fuel!.burned===5*WOOD_BURN_TICKS);
 expect(w.piles.some(i=>i.id===carry.id)).toBe(false);stepWorld(saved,w.tick-saved.tick);expect(saved).toEqual(w);
});

test.each([[378,10,5],[379,15,0]])('schéma %i : prélèvement de %i bois et reste exact de %i',(version,quantity,remainder)=>{
 const original=scene('wood-generator',15),w=version===378?JSON.parse(asOldSchema(serializeWorld(original.w),version)) as World:original.w,p=w.pawns[0]!,s=w.structures.find(b=>b.id===original.s.id)!,source=w.piles.find(i=>i.id===original.source.id)!;
 expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'fuel',structureId:s.id},queue:false}).ok).toBe(true);
 until(w,()=>p.haul?.phase==='deliver');const carry=w.piles.find(i=>i.id===p.haul!.carryPileId)!;
 expect(p.haul).toMatchObject({sourcePileId:source.id,quantity,pickupCell:{x:10,z:13},destination:{type:'fuel',structureId:s.id,forced:true}});expect(carry).toMatchObject({quantity,item:'wood',owner:{type:'pawn',pawnId:p.id}});expect(carry.id).not.toBe(source.id);expect(w.piles.find(i=>i.id===source.id)?.quantity??0).toBe(remainder);
 const restored=version>=379?deserializeWorld(serializeWorld(w)):null;
 until(w,()=>p.haul===null&&s.fuel!.ticks+s.fuel!.burned===quantity*WOOD_BURN_TICKS);expect(w.piles.find(i=>i.id===source.id)?.quantity??0).toBe(remainder);expect(w.piles.some(i=>i.id===carry.id)).toBe(false);
 if(restored){stepWorld(restored,w.tick-restored.tick);expect(restored).toEqual(w);}
});

test('mauvais combustible : option désactivée et commande refusée sans effets',()=>{
 const {w,p,s}=scene('chemfuel-generator');w.piles=[];addGroundMaterial(w,'wood',5,{x:10,z:13},'wood');refreshStock(w);const before=serializeWorld(w);
 expect(fuelOption(w,p.id,s)).toMatchObject([{enabled:false,reason:expect.stringContaining('biocarburant')}]);
 expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'fuel',structureId:s.id},queue:false}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
});

test('réservation réelle exclusive : second acteur refusé sans altérer le premier trajet',()=>{
 const {w,p,other,s}=scene('wood-generator');other.priorities.haul=1;
 expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'fuel',structureId:s.id},queue:false}).ok).toBe(true);const before=serializeWorld(w);
 expect(fuelOption(w,other.id,s)).toMatchObject([{enabled:false,reason:expect.stringContaining('réservé')}]);
 expect(applyCommand(w,{type:'order-haul',pawnId:other.id,target:{type:'fuel',structureId:s.id},queue:false}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
});

test('consommateur électrique sans combustible : aucune option fuel ajoutée',()=>{
 const {w,p}=scene('wood-generator'),lamp=fixtureBuilding(w,'standing-lamp',19,13) as Structure;lamp.material='steel';lamp.power=newPowerState('standing-lamp');
 const before=serializeWorld(w);expect(fuelOption(w,p.id,lamp)).toEqual([]);expect(serializeWorld(w)).toBe(before);
});


test.each(['wood-generator','chemfuel-generator'] as const)('%s: moins d’une unité entière disponible ne permet aucun ravitaillement manuel',kind=>{
 const {w,p,s}=scene(kind);s.fuel!.ticks=fuelLimit(s.kind)-599;const before=serializeWorld(w);
 expect(fuelOption(w,p.id,s)).toMatchObject([{enabled:false,reason:expect.any(String)}]);
 expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'fuel',structureId:s.id},queue:false}).ok).toBe(false);
 expect(serializeWorld(w)).toBe(before);
});
