import {expect,test} from 'vitest';
import {generateWorld} from '../src/sim/generation';
import {applyCommand} from '../src/sim/engine';
import {queryArea,isAreaAction} from '../src/sim/designation';
import {applyAreaMaterialPermission256} from '../src/sim/area-material-permission-256';
import {applyMaterialPermission256,materialAllowedForPlayer256} from '../src/sim/material-permission-256';
import type {AreaCommand,MaterialPile} from '../src/sim/types';

// Prepared command fixtures only: no campaign, step, Worker or save is run.
function fixture(){const w=generateWorld(91874,32,32);w.resources=[];w.structures=[];w.jobs=[];w.piles=[];w.tiles=w.tiles.map(()=>({terrain:'soil'}));return w;}
function steel(id:number,x:number,z:number):MaterialPile{return{id,kind:'steel',item:'steel',quantity:1,owner:{type:'ground',x,z}};}
const rect=(action:'allow'|'forbid',from={x:2,z:2},to={x:4,z:4}):AreaCommand=>({type:'area',action,from,to});

test('one real rectangle handles more than the selection cap and restores exactly without advancing the world',()=>{
 const w=fixture();for(let i=0;i<240;i++)w.piles.push(steel(w.nextId++,2+i%24,2+Math.floor(i/24)));
 const actual=[...w.piles],before=JSON.stringify(w),command=rect('forbid',{x:25,z:11},{x:2,z:2});
 expect(isAreaAction('forbid')).toBe(true);expect(isAreaAction('allow')).toBe(true);
 expect(queryArea(w,command)).toMatchObject({ok:true,selected:240,skipped:0});
 expect(applyCommand(w,command)).toEqual({ok:true,affected:240,skipped:0});
 expect(w.piles.every(p=>!materialAllowedForPlayer256(p))).toBe(true);
 expect(w.piles.every((p,i)=>p===actual[i])).toBe(true);
 expect(applyCommand(w,rect('allow',{x:2,z:2},{x:25,z:11}))).toEqual({ok:true,affected:240,skipped:0});
 expect(JSON.stringify(w)).toBe(before);
});

test('preview and commit use all ground Items per known cell and preserve canonical specialized flags',()=>{
 const w=fixture();w.site={revision:3,tileId:0,mapSeed:w.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};w.exploration={revision:1};
 const ordinary=steel(w.nextId++,2,2),egg:MaterialPile={id:w.nextId++,kind:'food',item:'turkey-egg-unfertilized',quantity:1,owner:{type:'ground',x:2,z:2}},shirt:MaterialPile={id:w.nextId++,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'ground',x:2,z:2},apparel:{quality:'normal',hitPoints:100}},gun:MaterialPile={id:w.nextId++,kind:'weapon',item:'revolver',quantity:1,owner:{type:'ground',x:2,z:2},weapon:{quality:'normal',hitPoints:100}};
 const hidden=steel(w.nextId++,3,3),outside=steel(w.nextId++,8,8),already={...steel(w.nextId++,4,4),forbidden:true as const},inventory:MaterialPile={...steel(w.nextId++,2,2),owner:{type:'inventory',pawnId:w.pawns[0]!.id}},forced:MaterialPile={...shirt,id:w.nextId++,owner:{type:'apparel',pawnId:w.pawns[0]!.id},apparel:{quality:'normal',hitPoints:100,forced:true}};
 w.piles=[ordinary,egg,shirt,gun,hidden,outside,already,inventory,forced];w.tiles[3*w.width+3]={terrain:'soil-natural',fogged:true};
 const before=JSON.stringify(w),command=rect('forbid');
 expect(queryArea(w,command)).toEqual({ok:true,bounds:{minX:2,maxX:4,minZ:2,maxZ:4},cells:[2*w.width+2],selected:9,skipped:8});expect(JSON.stringify(w)).toBe(before);
 expect(applyCommand(w,command)).toEqual({ok:true,affected:4,skipped:8});
 expect(ordinary.forbidden).toBe(true);expect(egg.eggForbidden).toBe(true);expect(shirt.apparel!.forbidden).toBe(true);expect(gun.weapon!.forbidden).toBe(true);
 for(const p of [egg,shirt,gun])expect(Object.hasOwn(p,'forbidden')).toBe(false);
 for(const p of [hidden,outside,inventory,forced])expect(materialAllowedForPlayer256(p)).toBe(true);
 expect(applyCommand(w,command)).toMatchObject({ok:false,code:'missing-target'});
});

test('invalid exact envelopes and endpoints are rejected before any partial permission writes',()=>{
 const w=fixture(),pile=steel(w.nextId++,2,2);w.piles=[pile];const before=JSON.stringify(w);
 const malformed=[{...rect('forbid'),targetZoneId:1},rect('forbid',{x:-1,z:2},{x:2,z:2}),rect('forbid',{x:2.5,z:2},{x:2,z:2}),rect('forbid',{x:2,z:2},{x:32,z:2})];
 for(const command of malformed){expect(applyAreaMaterialPermission256(w,command).ok).toBe(false);expect(JSON.stringify(w)).toBe(before);}
 let reads=0;const getter={...rect('forbid')};Object.defineProperty(getter,'from',{get(){reads++;return{x:2,z:2};},enumerable:true});
 expect(applyAreaMaterialPermission256(w,getter).ok).toBe(false);expect(reads).toBe(0);expect(JSON.stringify(w)).toBe(before);
 const historical={...w,schemaVersion:255} as unknown as typeof w;expect(applyAreaMaterialPermission256(historical,rect('forbid')).ok).toBe(false);expect(JSON.stringify(w)).toBe(before);
});

test('the shared live guard preserves forced apparel and inaccessible holders in the existing single-item command',()=>{
 const w=fixture(),pawn=w.pawns[0]!,forced:MaterialPile={id:w.nextId++,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:pawn.id},apparel:{quality:'normal',hitPoints:100,forced:true}},held:MaterialPile={...steel(w.nextId++,2,2),owner:{type:'starting-pod',podId:99999}};w.piles=[forced,held];const before=JSON.stringify(w);
 expect(applyMaterialPermission256(w,{type:'material-forbid',pileId:forced.id,forbidden:true})).toEqual({ok:false,reason:'Retirer la protection du vêtement porté avant de l’interdire.'});
 expect(applyMaterialPermission256(w,{type:'material-forbid',pileId:held.id,forbidden:true})).toEqual({ok:false,reason:'Bien hors de portée de la colonie.'});
 expect(applyCommand(w,rect('forbid'))).toMatchObject({ok:false,code:'missing-target'});expect(JSON.stringify(w)).toBe(before);
});
