// Test-only observation seam. Imported by the Night project router, never src.
import {campaignAuthority} from '../../src/sim/secondary-site-context.ts';
import type {World} from '../../src/sim/types.ts';
type Owner=ReturnType<typeof import('../../src/sim/core-movement-297.ts').createCoreMovement297>;
type Factory=(world:World)=>Owner;
type Observation={mode:'full'|'daylight';bodySHA256:string;factories:number;invalidations:number;macros:number};
const references=new WeakSet<World>(),observed=new WeakMap<World,Observation>();
export function fullLightReference297(world:World):void{references.add(campaignAuthority(world));}
export function daylightFactoryObservations297(world:World):Observation|undefined{const value=observed.get(campaignAuthority(world));return value?{...value}:undefined;}
export function createDaylightFactoryForTest297(world:World,full:Factory,daylight:Factory):Owner{
 const owner=campaignAuthority(world),mode=references.has(owner)?'full':'daylight',bodySHA256=mode==='full'?'a56c6254ea76f1d85717593052a2e4320dc355f34ad54769c25bec648512dc20':'489f9a4099b17fb4409dfb61ff13d1c6cb41f6c1cbe5f742286088616cbc4088',value=(mode==='full'?full:daylight)(world);
 let n=observed.get(owner);if(n&&n.mode!==mode)throw Error('Test factory mode changed after owner capture');if(!n){n={mode,bodySHA256,factories:0,invalidations:0,macros:0};observed.set(owner,n);}n.factories++;const stats=n;
 return {...value,invalidate(...args:Parameters<Owner['invalidate']>){stats.invalidations++;return Reflect.apply(value.invalidate,value,args);},beginMacro(...args:Parameters<Owner['beginMacro']>){stats.macros++;return Reflect.apply(value.beginMacro,value,args);}};
}
