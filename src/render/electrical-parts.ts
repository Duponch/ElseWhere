import {shipComputerSensorsParts298} from './ship-computer-sensors-parts298';
import {shipCasketParts277} from './ship-casket-parts277';
import {shipReactorParts275} from './ship-reactor-parts275';
import {shipHullParts276} from './ship-hull-parts276';
import {geothermalParts264} from './geothermal-parts264';
import { isPowerActive } from '../sim/power-rules';
import { sunLampActive } from '../sim/sun-lamp';
import { isPowerTransmitter } from '../sim/power-grid';
import { footprintCells } from '../sim/definitions';
import type { Structure, World } from '../sim/types';
import { WORLD_SCALE } from '../world/scale';
import type { Placement } from './primitives';
import {WALL_APPLIANCE_BOTTOM,WALL_APPLIANCE_TOP} from './wall-appliance';

/** Parts share the prepared furniture batch. Light is a shared field, never
 * a PointLight or shadow map per appliance. */
export function electricalParts(world:World,cutaway=false,subjects:readonly Structure[]=world.structures):Placement[] {
  const out:Placement[]=[];
  const byId=new Map(world.structures.map(s=>[s.id,s]));
  const transmitters=new Set<number>();
  for(const s of world.structures)if(isPowerTransmitter(s.kind))for(const c of footprintCells(s))transmitters.add(c.z*world.width+c.x);
  for(const s of subjects) {
    const on=s.kind==='sun-lamp'?sunLampActive(world,s):isPowerActive(s);
    if(s.kind==='power-conduit') {
      out.push({targetId:s.id,x:s.x,z:s.z,y:.055,sx:.18,sy:.07,sz:.18,color:0xac8258});
      for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const x=s.x+dx!,z=s.z+dz!;
        if(x<0||z<0||x>=world.width||z>=world.height||!transmitters.has(z*world.width+x))continue;
        out.push({targetId:s.id,x:s.x+dx!*.25,z:s.z+dz!*.25,y:.06,sx:dx?.55:.085,sy:.055,sz:dz?.55:.085,color:0xa7784d});
      }
    } else if(s.kind==='power-switch') {
      const closed=s.power?.switchOn!==false;
      out.push({targetId:s.id,x:s.x,z:s.z,y:.13,sx:.67,sy:.26,sz:.67,color:0x67766b},
        {targetId:s.id,x:s.x,z:s.z,y:.275,sx:.53,sy:.04,sz:.53,color:0x313e39},
        {targetId:s.id,x:s.x,z:s.z+(closed?.13:-.13),y:.36,sx:.16,sy:.16,sz:.3,color:closed?0x85b982:0xcf9a67});
    } else if(s.kind==='heater') {
      out.push({targetId:s.id,x:s.x,z:s.z,y:.1,sx:.87,sy:.2,sz:.72,color:0x526762},
        {targetId:s.id,x:s.x,z:s.z,y:.56,sx:.84,sy:.76,sz:.54,color:0x9ba896},
        {targetId:s.id,x:s.x+.31,z:s.z+.3,y:.66,sx:.12,sy:.22,sz:.07,color:on?0xc6925a:0x58665c});
      for(const x of [-.3,-.2,-.1,0,.1,.2,.3])out.push({targetId:s.id,x:s.x+x,z:s.z-.28,y:.56,sx:.035,sy:.6,sz:.065,color:0x596f68});
    } else if(s.kind==='wind-turbine') {
      const ry=s.orientation*Math.PI/2,dx=Math.sin(ry),dz=Math.cos(ry),x=s.x+dx*.5,z=s.z+dz*.5;
      out.push({targetId:s.id,x,z,y:.1,sx:6.7,sy:.2,sz:1.7,ry,color:0x57645f},
        {targetId:s.id,x,z,y:.24,sx:1.2,sy:.28,sz:1.2,ry,color:0x82918a},
        {targetId:s.id,x,z,y:2,sx:.25,sy:3.5,sz:.28,ry,color:0x99a99d},
        {targetId:s.id,x,z,y:3.73,sx:.53,sy:.43,sz:1.17,ry,color:0x6b807a},
        {targetId:s.id,x:x+dx*.64,z:z+dz*.64,y:3.73,sx:.45,sy:.45,sz:.24,ry,color:0xb6beac});
      for(const across of [-2.7,2.7])out.push({targetId:s.id,x:x+dz*across,z:z-dx*across,y:.29,sx:.38,sy:.38,sz:1.4,ry,color:0x7a8980});
    } else if(s.kind==='battery') {
      const cells=footprintCells(s),last=cells[cells.length-1]!,x=(s.x+last.x)/2,z=(s.z+last.z)/2,ry=s.orientation*Math.PI/2;
      out.push({targetId:s.id,x,z,y:.13,sx:.86,sy:.26,sz:1.83,ry,color:0x4b5957},
        {targetId:s.id,x,z,y:.57,sx:.79,sy:.7,sz:1.69,ry,color:0x7a8d75},
        {targetId:s.id,x,z,y:.94,sx:.86,sy:.08,sz:1.82,ry,color:0x54655c},
        // Dark recessed display makes the stored-charge bars legible when the
        // resident emissive batch has no active segments.
        {targetId:s.id,x,z,y:.989,sx:.70,sy:.018,sz:.31,ry,color:0x304644});
      for(const sign of [-1,1])out.push({targetId:s.id,x:x+Math.sin(ry)*sign*.58,z:z+Math.cos(ry)*sign*.58,y:1.04,sx:.23,sy:.14,sz:.2,ry,color:sign>0?0xb07152:0xa8b5ae});
    } else if(s.kind==='ship-computer'||s.kind==='ship-sensors') {
      out.push(...shipComputerSensorsParts298(s));
    } else if(s.kind==='ship-cryptosleep-casket') {
      out.push(...shipCasketParts277(s));
    } else if(s.kind==='ship-beam'||s.kind==='ship-engine') {
      out.push(...shipHullParts276(s));
    } else if(s.kind==='ship-reactor') {
      out.push(...shipReactorParts275(s));
    } else if(s.kind==='geothermal-generator') {
      out.push(...geothermalParts264(s));
    } else if(s.kind==='solar-generator') {
      const x=s.x+1.5,z=s.z+1.5;
      for(const dz of [-1.42,-.47,.47,1.42]) {
        out.push({targetId:s.id,x,z:z+dz,y:.44,sx:3.83,sy:.12,sz:.85,color:0x768888},
          {targetId:s.id,x,z:z+dz,y:.515,sx:3.66,sy:.035,sz:.72,color:0x345673});
        for(const dx of [-1.22,0,1.22])out.push({targetId:s.id,x:x+dx,z:z+dz,y:.2,sx:.09,sy:.4,sz:.64,color:0x536360});
        for(const dx of [-.92,0,.92])out.push({targetId:s.id,x:x+dx,z:z+dz,y:.538,sx:.025,sy:.009,sz:.72,color:0x82a5b8});
      }
    } else if(s.kind==='cooler') {
      if(cutaway)continue;
      const h=WALL_APPLIANCE_TOP-WALL_APPLIANCE_BOTTOM,ry=s.orientation*Math.PI/2;
      out.push({targetId:s.id,x:s.x,z:s.z,y:WALL_APPLIANCE_BOTTOM+h/2,sx:1,sy:h,sz:.88,ry,color:0x8d9d98});
      for(const sign of [-1,1])for(const y of [.25,.5,.75])out.push({targetId:s.id,x:s.x+Math.sin(ry)*.455*sign,z:s.z+Math.cos(ry)*.455*sign,y:WALL_APPLIANCE_BOTTOM+y*h,sx:.68,sy:.055,sz:.055,ry,color:sign>0?0x559bb6:0xb77757});
    } else if(s.kind==='sun-lamp') {
      // Broad chalk reflector and two downward strips share the resident
      // furniture material; illumination comes from the common light field.
      out.push({targetId:s.id,x:s.x,z:s.z,y:.055,sx:.56,sy:.11,sz:.56,color:0x68786f},
        {targetId:s.id,x:s.x,z:s.z,y:WORLD_SCALE.lampHeight/2,sx:.1,sy:WORLD_SCALE.lampHeight,sz:.1,color:0x8b9a8e},
        {targetId:s.id,x:s.x,z:s.z,y:WORLD_SCALE.lampHeight+.08,sx:.9,sy:.16,sz:.72,color:0xabb9a2},
        {targetId:s.id,x:s.x,z:s.z,y:WORLD_SCALE.lampHeight+.18,sx:.74,sy:.05,sz:.56,color:0x7d9085});
      for(const z of [-.2,.2])out.push({targetId:s.id,x:s.x,z:s.z+z,y:WORLD_SCALE.lampHeight-.015,sx:.76,sy:.055,sz:.12,color:on?0xf3f1cc:0x879287});
    } else if(s.kind==='wall-lamp') {
      // Schema 363: a plate on the supporting wall face (0.9 cell towards it in
      // Core), a short arm and a warm shade; the light itself is the shared field.
      const d=[[0,1],[1,0],[0,-1],[-1,0]][s.orientation??0]!,ry=(s.orientation??0)*Math.PI/2,h=WORLD_SCALE.lampHeight+.35;
      out.push({targetId:s.id,x:s.x+d[0]!*.47,z:s.z+d[1]!*.47,y:h,sx:.26,sy:.34,sz:.05,color:0x5f6f6c,ry},
        {targetId:s.id,x:s.x+d[0]!*.36,z:s.z+d[1]!*.36,y:h+.02,sx:.06,sy:.06,sz:.2,color:0x758580,ry},
        {targetId:s.id,x:s.x+d[0]!*.24,z:s.z+d[1]!*.24,y:h-.05,sx:.3,sy:.2,sz:.3,color:on?0xffdfa0:0x8a8d7e,ry},
        {targetId:s.id,x:s.x+d[0]!*.24,z:s.z+d[1]!*.24,y:h+.07,sx:.36,sy:.05,sz:.36,color:0x5f6f6c,ry});
    } else if(s.kind==='standing-lamp') {
      out.push({targetId:s.id,x:s.x,z:s.z,y:.05,sx:.44,sy:.1,sz:.44,color:0x5f6f6c},
        {targetId:s.id,x:s.x,z:s.z,y:WORLD_SCALE.lampHeight/2,sx:.08,sy:WORLD_SCALE.lampHeight,sz:.08,color:0x758580},
        {targetId:s.id,x:s.x,z:s.z,y:WORLD_SCALE.lampHeight,sx:.4,sy:.24,sz:.4,color:on?0xffdfa0:0x8a8d7e},
        {targetId:s.id,x:s.x,z:s.z,y:WORLD_SCALE.lampHeight+.15,sx:.49,sy:.06,sz:.49,color:0x5f6f6c});
    } else if(s.kind==='wood-generator') {
      const x=s.x+.5,z=s.z+.5;
      out.push({targetId:s.id,x,z,y:.13,sx:1.85,sy:.26,sz:1.85,color:0x4e615c},
        {targetId:s.id,x:x-.37,z,y:WORLD_SCALE.generatorHeight/2+.12,sx:.9,sy:WORLD_SCALE.generatorHeight,sz:1.42,color:0x7e8c79},
        {targetId:s.id,x:x+.45,z:z+.15,y:.63,sx:.54,sy:.76,sz:.96,color:0x596c68},
        {targetId:s.id,x:x-.37,z:z+.73,y:.57,sx:.56,sy:.39,sz:.045,color:on?0xeb9542:0x514e42},
        {targetId:s.id,x:x-.37,z:z-.54,y:WORLD_SCALE.generatorHeight+.35,sx:.23,sy:.7,sz:.23,color:0x535e58});
      // Align all three light slats with the top of the smaller front housing.
      for(const dz of [-.25,.05,.35])out.push({targetId:s.id,x:x+.45,z:z+dz,y:1.06,sx:.48,sy:.055,sz:.095,color:0x9eab97});
    }
  }
  // Consumer leads are visual links to the saved connection, not guessed by
  // proximity. Reconnection changes only this resident furniture batch.
  for(const s of subjects)if(s.power?.parentId!=null) {
    const parent=byId.get(s.power.parentId);if(!parent)continue;
    const nearest=footprintCells(parent).reduce((a,b)=>(a.x-s.x)**2+(a.z-s.z)**2<=(b.x-s.x)**2+(b.z-s.z)**2?a:b);
    const dx=nearest.x-s.x,dz=nearest.z-s.z,length=Math.hypot(dx,dz);if(!length)continue;
    out.push({targetId:s.id,x:(s.x+nearest.x)/2,z:(s.z+nearest.z)/2,y:.065,sx:.025,sy:.025,sz:length,ry:Math.atan2(dx,dz),color:0x9d8665});
  }
  return out;
}
