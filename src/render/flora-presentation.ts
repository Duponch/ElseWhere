import {floraSize,isMedicinalPlant} from '../bridge/natural-appearance-values';
export {RESIDENT_CROP_KINDS,type ResidentCropKind,isResidentCrop,isMedicinalPlant,floraSize} from '../bridge/natural-appearance-values';
import { plantLeafless } from '../sim/plant-life';
import type { Resource,World } from '../sim/types';
import type { Placement } from './primitives';
import type { NaturalObservation } from './natural-presentation-events';
import { hydroponicBasinAt } from '../sim/hydroponics';
import { HYDROPONIC_SUPPORT_HEIGHT } from './hydroponics-parts';

const FLORA_COLORS={glowstool:0xa79583,agarilux:0xb6a1bc,bryolux:0x7b8eaa,pine:0x47684c,birch:0x8fa467,oak:0x57754d,poplar:0x849752,drago:0x728966,saguaro:0x698661,agave:0x839c89,moss:0x718356,grass:0x929357,'tall-grass':0x7d8a4f,brambles:0x556648,'berry-bush':0x677b55,'healroot-wild':0x829b74,'alocasia':0x789c80,'astragalus':0xb2a6bd,'bush':0x687c58,'chokevine':0x69745a,'clivia':0x9c9a72,'dandelion':0xc6b567,'pincushion-cactus':0x88a381,'rafflesia':0xb67874,'low-shrub':0x879573,'bamboo':0x899c66,'cecropia':0x729977,'cypress':0x678c76,'maple':0xaa986b,'palm':0x8da170,'teak':0x65816b,'willow':0x8fa58a};
export const BLIGHT_COLOR=0xa26b32;
export const floraColor=(r:Resource):number=>r.blight?BLIGHT_COLOR:FLORA_COLORS[isMedicinalPlant(r)?'healroot-wild':r.species??'berry-bush'];
export const isClusterPlantSpecies=(species:Resource['species']):boolean=>species==='grass'||species==='tall-grass';
export const floraTreeHeight=(r:Resource):number=>r.species==='saguaro'?2.2:r.species==='drago'?3.25:r.species==='pine'?4.6:r.species==='poplar'?4.3:r.species==='bamboo'?3.4:r.species==='palm'?4.5:r.species==='cypress'?4.8:r.species==='willow'?3.6:3.8;
export const hydroponicFloraHeight=(world:World,r:Resource):number=>r.kind==='healroot'&&hydroponicBasinAt(world,r)?HYDROPONIC_SUPPORT_HEIGHT:0;
export const floraIdentity=(world:World,r:Resource,appearance?:NaturalObservation):string=>{
  const support=hydroponicFloraHeight(world,r);
  return `${r.kind}:${r.x}:${r.z}:${r.stone??''}:${r.species??''}:${appearance?.size??floraSize(world,r)}:${isMedicinalPlant(r)&&(appearance?.leafless??plantLeafless(world,r))}${r.blight?':blight':''}${support?`:support=${support}`:''}`;
};

export interface FloraParts {trunks:Placement[];crowns:Placement[];cones:Placement[];bushes:Placement[];blades:Placement[];cacti:Placement[];fruit:Placement[]}
/** Compact 3D meshes for trees, shrubs and agave. Grass species use their one
 * resident cluster batch rather than duplicating geometry in every chunk. */
export function appendFlora(parts:FloraParts,world:World,r:Resource,turn:number,size?:number):void {
  if(isClusterPlantSpecies(r.species))return;
  const {x,z}=r,s=size??floraSize(world,r),color=floraColor(r),leaves=-r.id*2,fruit=-r.id*2-1,support=hydroponicFloraHeight(world,r);
  const add=(items:Placement[],p:Omit<Placement,'x'|'z'> & {dx?:number;dz?:number})=>{
    const {dx=0,dz=0,...shape}=p;
    items.push({...shape,x:x+dx*s,z:z+dz*s,y:support?p.y*s+support:p.y*s,sx:(p.sx??1)*s,sy:(p.sy??1)*s,sz:(p.sz??1)*s,color:p.color??color,key:p.key??leaves});
  };
  if(r.kind==='tree') {
    const height=floraTreeHeight(r);
    if(r.species==='saguaro') {
      add(parts.cacti,{y:height/2,sx:.32,sy:height,sz:.32,key:r.id});
      for(const side of [-1,1]){add(parts.cacti,{dx:side*.35,y:1,sy:.22,sx:.65,sz:.22,key:r.id});add(parts.cacti,{dx:side*.6,y:1.4,sy:1,sx:.22,sz:.22,key:r.id});}
    } else {
      const drago=r.species==='drago';
      add(parts.trunks,{y:height*(drago?.36:.25),sx:r.species==='birch'?.85:1,sy:height*(drago?.72:.5),sz:1,color:r.species==='birch'?0xcac9b4:0x70573e,key:r.id});
      if(r.species==='pine'||r.species==='cypress') {
        add(parts.cones,{y:height*.53,sx:1,sy:height*.6,sz:1,ry:turn});
        add(parts.cones,{y:height*.70,sx:.7,sy:height*.4,sz:.7,ry:turn+.3});
      } else if(r.species==='palm'||r.species==='bamboo') {
        // Original compressed crown; no new batch, texture or material.
        add(parts.crowns,{y:height*.88,sx:r.species==='palm'?1.2:.55,sy:height*.13,sz:r.species==='palm'?1.2:.55,ry:turn});
      } else {
        add(parts.crowns,{y:height*(drago?.79:.65),sx:drago?1.43:r.species==='poplar'?.7:1,sy:height*(drago?.16:.24),sz:drago?1.43:r.species==='poplar'?.7:1,ry:turn});
        if(!drago)add(parts.crowns,{y:height*.87,sx:.66,sy:height*.16,sz:.66,ry:turn+.5});
      }
    }
  } else if(r.species==='glowstool'||r.species==='agarilux'||r.species==='bryolux') {
    const h=r.species==='agarilux'?.62:r.species==='bryolux'?.3:.4;
    add(parts.trunks,{y:h*.43,sx:.12,sy:h*.75,sz:.12,color:0xc6bd9e,key:r.id});
    add(parts.crowns,{y:h*.83,sx:h*.85,sy:h*.26,sz:h*.85,ry:turn});
    if(r.species==='bryolux')add(parts.crowns,{dx:.18,dz:.12,y:h*.6,sx:.17,sy:.10,sz:.17,ry:turn+.5});
  } else if(isMedicinalPlant(r)) {
    // A low rosette and three pale leaves share the existing bush geometry and
    // chunk buffers. The mauve crown distinguishes the medicinal plant from
    // ordinary brambles without adding a resident species-sized batch.
    add(parts.bushes,{y:.19,sx:.30,sy:.20,sz:.30,ry:turn,key:r.id});
    for(let i=0;i<3;i++) {
      const angle=turn+i*2*Math.PI/3;
      add(parts.bushes,{dx:Math.sin(angle)*.20,dz:Math.cos(angle)*.20,y:.22,
        sx:.12,sy:.20,sz:.23,ry:angle,color:r.blight?BLIGHT_COLOR:0xa6b896});
    }
    add(parts.bushes,{y:.37,sx:.10,sy:.10,sz:.10,color:r.blight?0x68513a:0xb7a5b9});
  } else if(r.species==='pincushion-cactus') {
    add(parts.cacti,{y:.18,sx:.35,sy:.36,sz:.35,key:r.id});
  } else if(r.species==='agave') {
    const h=.4;
    for(let i=0;i<6;i++) {const angle=turn+i*Math.PI/3;add(parts.blades,{dx:Math.sin(angle)*.13,dz:Math.cos(angle)*.13,y:h*.5,sx:.15,sy:h,sz:.65,ry:angle});}
  } else if(r.species==='brambles'||r.species==='chokevine'||r.species==='astragalus'||r.species==='dandelion'||r.species==='low-shrub') {
    // Real ground-cover Resources retain their colour, footprint and identity.
    // Their low crown differs from selectable Bush without another draw batch.
    add(parts.bushes,{y:.12,sx:.43,sy:.12,sz:.41,ry:turn});
  } else {
    const moss=r.species==='moss';
    add(parts.bushes,{y:moss?.04:.3,sx:.43,sy:moss?.055:.37,sz:.41,ry:turn});
    if(r.kind==='berries')for(let i=0;i<5;i++){const angle=turn+i*2.4;add(parts.fruit,{dx:Math.sin(angle)*.25,dz:Math.cos(angle)*.25,y:.42+(i%2)*.09,sx:1,sy:1,sz:1,color:0xb96f63,key:fruit});}
  }
}
