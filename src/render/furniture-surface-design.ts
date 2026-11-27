import type { Structure, World } from '../sim/types';
import type { Placement } from './primitives';

/** The strokes fit the authored face, not the world-space noise crop. Tiny
 * fittings retain the existing paint: at gameplay distance their silhouettes
 * already give more information than a microscopic screw drawing. */
export const FurniturePaint = {
  tabletop:3, panel:4, cushion:5, blanket:6, pillow:7,
  metal:11, grille:12, dresser:13, control:14, worktop:15,
  parcel:19, carving:20, stove:21, shelf:22, paper:23, hospital:24,
  casket:25, solar:26, cabinet:27, screen:28, gate:29, door:30,
} as const;

const {tabletop,panel,cushion,blanket,pillow,metal,grille,dresser,control,worktop,parcel,carving,stove,shelf,paper,hospital,casket,solar,cabinet,screen,gate,door}=FurniturePaint;
/** Face-mask bits X, Y(top), Z, and all Y. CPU and shader use the same table.
 * A drawer belongs to its actual opening; a tabletop has a painted top only. */
export const furnitureFaceMask=(tile:number):number=>{
  switch(tile){
    case tabletop:case blanket:case pillow:case worktop:case stove:case shelf:case paper:case hospital:case solar:return 2;
    case panel:case screen:case gate:case door:case cabinet:return 4;
    case dresser:return 1;
    case cushion:case metal:case grille:case control:case carving:case casket:return 7;
    case parcel:return 15;
    default:return 15;
  }
};
export function furnitureTileForNormal(tile:number,nx:number,ny:number,nz:number):number{
  const face=nx!==0?1:ny>0?2:nz!==0?4:8;
  return (furnitureFaceMask(tile)&face)!==0?tile:0;
}

// Authored face-relative guides. Brush edges are slightly interrupted and
// vary in weight; everything is evaluated only while baking the small atlas.
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
function lineDistance(x:number,y:number,a:number,b:number,c:number,d:number):number{
  const dx=c-a,dy=d-b,t=clamp(((x-a)*dx+(y-b)*dy)/(dx*dx+dy*dy||1));
  return Math.hypot(x-a-t*dx,y-b-t*dy);
}
export function paintFurnitureSurfaceDesign(tile:number,u:number,v:number,referenceAspect=1):number {
  let paint=1;
  // All widths are measured in units of the short physical edge. A screw or
  // burner stays round when this layout is redrawn for a long/narrow face.
  const short=Math.min(referenceAspect,1),mx=referenceAspect/short,my=1/short;
  const bend=.006*Math.sin(u*35+tile)+.004*Math.sin(v*51+tile*.7);
  const ink=(distance:number,width:number,dark=.48)=>{
    const edge=1-clamp((distance-width*.62)/(width*.95));
    paint=Math.min(paint,1-(1-dark)*edge);
  };
  const line=(a:number,b:number,c:number,d:number,width=.019,dark=.48)=>
    ink(lineDistance((u+bend)*mx,(v-bend)*my,a*mx,b*my,c*mx,d*my),width,dark);
  const rect=(x:number,y:number,w:number,h:number,width=.022,dark=.48)=>{
    line(x,y,x+w,y,width,dark);line(x+w,y,x+w,y+h,width,dark);
    line(x+w,y+h,x,y+h,width,dark);line(x,y+h,x,y,width,dark);
  };
  const dot=(x:number,y:number,radius=.035,dark=.40)=>ink(Math.hypot((u-x)*mx,(v-y)*my),radius,dark);
  const ring=(x:number,y:number,rx:number,ry:number,width=.025,dark=.5)=>
    ink(Math.abs(Math.hypot((u-x)*mx/rx,(v-y)*my/ry)-1)*Math.min(rx,ry),width,dark);
  const screws=()=>{for(const x of [.1,.9])for(const y of [.11,.89])dot(x,y,.030,.37);};
  const frame=()=>rect(.10,.10,.8,.8);
  switch(tile){
    case tabletop:case shelf:
      rect(.035,.055,.93,.89,.019,.54);
      for(const y of [.28,.51,.74])line(.05,y,.95,y,.020,.45);
      line(.13,.18,.68,.20,.011,.72);line(.39,.39,.90,.42,.012,.72);
      line(.12,.87,.72,.85,.011,.74);ring(.33,.62,.11,.035,.011,.63);
      break;
    case panel:
      frame();rect(.18,.18,.64,.64,.016,.70);
      break;
    case cushion:
      rect(.10,.12,.80,.76,.018,.53);rect(.15,.17,.70,.66,.011,.76);
      line(.14,.78,.29,.70,.022,.70);line(.69,.28,.87,.18,.020,.67);
      break;
    case blanket:case hospital:
      // Hem, turned flap, cloth folds. No grid of repeated fabric stamps.
      rect(.055,.045,.89,.91,.020,.49);
      line(.06,.73,.94,.73,.033,.51);line(.07,.79,.93,.79,.016,.72);
      line(.19,.16,.28,.33,.018,.69);line(.28,.33,.23,.47,.013,.75);
      line(.78,.16,.70,.34,.017,.70);line(.70,.34,.76,.48,.012,.78);
      if(tile===hospital){line(.12,.12,.88,.12,.016,.60);line(.12,.17,.88,.17,.015,.72);}
      break;
    case pillow:
      rect(.12,.12,.76,.76,.026,.57);line(.15,.15,.33,.34,.018,.66);
      line(.85,.15,.67,.31,.018,.66);line(.14,.82,.30,.72,.015,.73);
      line(.86,.82,.71,.73,.015,.73);
      break;
    case metal:case control:
      frame();screws();
      if(tile===control){rect(.21,.50,.58,.28,.024,.36);line(.27,.58,.73,.58,.014,.63);
        for(const x of [.28,.50,.72])dot(x,.29,.047,.46);}
      else{line(.15,.25,.85,.25,.022,.70);line(.63,.68,.83,.86,.011,.72);}
      break;
    case grille:
      rect(.10,.12,.80,.76);screws();
      for(const y of [.24,.35,.46,.57,.68,.79])line(.19,y,.81,y,.027,.34);
      break;
    case dresser:case cabinet:
      frame();
      for(const y of [.38,.65])line(.11,y,.89,y,.025,.38);
      for(const y of [.25,.515,.785]){
        line(.40,y,.60,y,.027,.40);dot(.39,y,.027,.43);dot(.61,y,.027,.43);
      }
      break;
    case worktop:
      rect(.05,.06,.90,.88,.017,.53);line(.12,.33,.45,.36,.012,.65);
      line(.38,.43,.78,.40,.013,.69);line(.63,.58,.89,.65,.016,.67);
      line(.17,.71,.42,.73,.010,.70);line(.21,.65,.35,.64,.013,.70);
      break;
    case parcel:
      line(.11,.06,.11,.94,.026,.54);line(.89,.06,.89,.94,.026,.54);
      line(.34,.02,.34,.98,.039,.44);line(.66,.02,.66,.98,.039,.44);
      rect(.40,.36,.20,.30,.016,.62);
      line(.44,.41,.56,.41,.013,.70);line(.44,.48,.56,.48,.013,.70);
      break;
    case carving:
      frame();rect(.16,.16,.68,.68,.016,.68);ring(.50,.51,.20,.24,.024,.57);
      line(.30,.51,.70,.51,.018,.63);line(.50,.29,.50,.75,.018,.63);
      break;
    case stove:
      frame();
      for(const x of [.30,.70])for(const y of [.30,.70]){
        ring(x,y,.15,.15,.021,.38);ring(x,y,.09,.09,.016,.61);
      }
      break;
    case paper:
      // A heading, faded handwriting and a small ruled schematic on the sheet.
      line(.10,.83,.67,.83,.023,.52);
      for(const y of [.70,.59,.48,.37,.26]){
        line(.12,y,.46,y,.011,.67);
        if(y>.45)line(.52,y,.89,y,.011,.65);
      }
      rect(.55,.22,.32,.28,.014,.70);line(.58,.26,.82,.46,.013,.70);
      break;
    case casket:
      frame();rect(.21,.18,.58,.64,.021,.53);line(.21,.63,.79,.63,.024,.46);
      screws();line(.34,.26,.66,.26,.024,.42);
      break;
    case solar:
      rect(.035,.04,.93,.92,.021,.52);
      for(const x of [.25,.50,.75])line(x,.04,x,.96,.015,.52);
      for(const y of [.33,.66])line(.04,y,.96,y,.018,.48);
      break;
    case screen:
      rect(.06,.08,.88,.84,.023,.46);
      // Small, dull analogue glass reflection. The screen colour/power state
      // is still authored by its actual television/monitor producer.
      line(.14,.72,.42,.88,.017,.73);line(.16,.63,.60,.87,.014,.77);
      break;
    case gate:
      rect(.10,.08,.80,.84,.028,.48);
      line(.11,.12,.89,.88,.039,.44);line(.13,.20,.86,.88,.015,.66);
      break;
    case door:
      rect(.075,.055,.85,.89,.025,.41);
      rect(.16,.12,.68,.32,.024,.53);rect(.16,.51,.68,.36,.024,.53);
      rect(.21,.17,.58,.22,.012,.73);rect(.21,.56,.58,.26,.013,.73);
      // The leaves are symmetric on opposite faces and slide together; the
      // little plate is central so a mirrored model never changes hand.
      rect(.39,.45,.22,.05,.017,.40);
      break;
  }
  return paint;
}

const tables=new Set(['table','stool','table-square','table-long','table-large','end-table','dining-chair','chess-table','billiards-table','poker-table','horseshoes','game-of-ur-board']);
const beds=new Set(['bed','double-bed','hospital-bed','bedroll','double-bedroll']);
const workshops=new Set(['butcher-table','machining-table','research-bench','tailor-bench','electric-tailor-bench','stonecutter','art-bench','drug-lab','hi-tech-research-bench','fabrication-bench','brewery','electric-smithy','fueled-smithy']);
const machines=new Set(['power-switch','heater','cooler','battery','wind-turbine','geothermal-generator','wood-generator','chemfuel-generator','electric-smelter','biofuel-refinery','nutrient-paste-dispenser','multi-analyzer','deep-drill','ground-scanner','comms-console','orbital-beacon','vitals-monitor','electric-crematorium','firefoam-popper','mini-turret','ship-computer','ship-sensors','ship-reactor','ship-engine','ship-beam','ship-chunk']);

/** Select designs only for a recognisable broad component belonging to a real
 * structure. Thin edges, pegs, bolts, lamps, wires, etc. keep existing paint. */
export function furnitureSurfaceDesign(item:Placement,kind:Structure['kind'],material:Structure['material']):number {
  const {sx=1,sy=1,sz=1,y,color}=item;
  if(Math.max(sx*sy,sx*sz,sy*sz)<.15)return 0;
  const top=sx>=.38&&sz>=.28&&sy<=.24;
  const vertical=sy>=.24&&Math.max(sx,sz)>=.4;
  const wood=material==='wood'||material===undefined;
  if(beds.has(kind)){
    if((kind==='bedroll'||kind==='double-bedroll')&&y<.22)
      return top?(sz<=.42?pillow:sz>=.65?blanket:0):0;
    if(top&&y>=.38)return sz<=.42?pillow:kind==='hospital-bed'?hospital:blanket;
    if(vertical&&Math.min(sx,sz)<=.14)return panel;
    return top&&wood?tabletop:0;
  }
  if(tables.has(kind)){
    // Geometry already represents felt and each authored game square.
    if((kind==='billiards-table'||kind==='poker-table')&&(color===0x4f7a55||color===0x3d5f43))return 0;
    if((kind==='chess-table'||kind==='game-of-ur-board')&&sy<.05)return 0;
    if(top)return wood?tabletop:worktop;
    return kind==='dining-chair'&&vertical?panel:0;
  }
  if(kind==='shelf'||kind==='small-shelf')return top?wood?shelf:worktop:vertical?panel:0;
  if(kind==='dresser')return vertical&&sy>=.7?dresser:top?(wood?tabletop:worktop):0;
  if(kind==='tool-cabinet')return vertical?cabinet:top?metal:0;
  if(kind==='armchair'||kind==='couch')return cushion;
  if(kind==='solar-generator')return top&&color===0x345673?solar:0;
  if(kind==='fueled-stove'||kind==='electric-stove')return top?stove:vertical?metal:0;
  if(kind==='vent'||kind==='passive-cooler')return vertical?grille:0;
  if(kind==='tube-television'||kind==='vitals-monitor')return vertical&&sz<.035?screen:vertical?metal:0;
  if(kind==='ancient-cryptosleep-casket'||kind==='cryptosleep-casket'||kind==='ship-cryptosleep-casket')return casket;
  if(kind==='grave'||kind==='sarcophagus'||kind==='stele-large'||kind==='stele-grand'||kind==='small-sculpture'||kind==='large-sculpture'||kind==='urn'||kind==='column')return vertical?carving:0;
  if(kind==='egg-box')return vertical?panel:top?shelf:0;
  if(kind==='fermenting-barrel')return vertical?panel:top?tabletop:0;
  if(kind==='hydroponics-basin'||kind==='hopper')return top?worktop:vertical?metal:0;
  if(kind==='heater'||kind==='cooler')return vertical?grille:top?metal:0;
  if(workshops.has(kind)){
    if(top&&((kind==='research-bench'&&color===0xe1d8ba)||(kind==='hi-tech-research-bench'&&color===0xd9d2b2)))return paper;
    return top?worktop:vertical?metal:0;
  }
  if(kind==='comms-console'||kind==='ground-scanner'||kind==='ship-computer'||kind==='ship-sensors')return vertical&&sz<=.055?screen:top&&sy<.09?control:vertical||top?metal:0;
  if(machines.has(kind))return vertical||top?metal:0;
  return 0;
}

/** The same placement writer serves the full, sparse, catalogue and preview
 * builds. This table is consulted only when real geometry is republished. */
export function decorateFurniturePlacements(world:Pick<World,'structures'|'packed'>,items:Placement[]):Placement[] {
  const subjects=new Map(world.structures.map(s=>[s.id,s]));
  const packed=new Set((world.packed??[]).filter(p=>p.owner.type==='ground').map(p=>p.building.id));
  for(const item of items){
    if(item.targetId===undefined||item.surfaceDesign!==undefined)continue;
    const s=subjects.get(item.targetId);
    const design=s?furnitureSurfaceDesign(item,s.kind,s.material):packed.has(item.targetId)&&(item.sx??1)*(item.sz??1)>.14?parcel:0;
    if(design)item.surfaceDesign=design;
  }
  return items;
}
