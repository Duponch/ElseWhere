import * as THREE from 'three/webgpu';
import {APPAREL} from '../../sim/apparel-rules';
import {PAWN_MODEL_SCALE} from '../../world/scale';
import {RESIDENT_WEAPON_VISUALS269} from '../weapon-shape';
import {buildOrigamiHumanReference,humanBox,humanVerticalPrism,HUMAN_REFERENCE_BIND,HUMAN_REFERENCE_PIGMENTS,HUMAN_PAINT_PROFILES as P,type HumanPoint,type OrigamiHumanPart,type HumanPaintProfile} from './human-reference';
import {registerReferencePaintProfile} from './reference-profiles';
import {createReferenceEdgeGeometry,createPhysicalEdgeWearGeometry} from './reference-edges';

/** A uniform change of model units, never a remapping of the old anatomy. */
export const HUMAN_REFERENCE_SCALE=1.04/1.22;
export const ORIGAMI_HUMAN_BIND:Readonly<Record<keyof typeof HUMAN_REFERENCE_BIND,number>>=Object.freeze({
  hipY:.56*HUMAN_REFERENCE_SCALE,headY:1.22*HUMAN_REFERENCE_SCALE,shoulderY:1.12*HUMAN_REFERENCE_SCALE,
  shoulderX:.32*HUMAN_REFERENCE_SCALE,hipX:.13*HUMAN_REFERENCE_SCALE,handY:.82*HUMAN_REFERENCE_SCALE,
  handZ:0,kneeY:.35*HUMAN_REFERENCE_SCALE,footY:.08*HUMAN_REFERENCE_SCALE,
});
// Disjoint from all current resident weapon and work-prop tags. The original
// recon tag -9 is also the EMP launcher, so the new rig gives armor its own tag.
export const ORIGAMI_DUSTER_DYE=-40;
export const ORIGAMI_PARKA_DYE=-41;
export const ORIGAMI_RECON_ARMOR_DYE=-42;

/** Registration is metadata only; rasterization is owned by the renderer. */
export function humanReferencePaintProfiles():Readonly<Record<keyof typeof P,number>> {
  return Object.fromEntries(Object.entries(P).map(([name,index])=>{
    const config=HUMAN_REFERENCE_PIGMENTS[index];return [name,registerReferencePaintProfile(`human:${name}:${config.baseColor}`,config)];
  })) as Record<keyof typeof P,number>;
}

/** Actual appearance masks still select their original 15 hair and five beard
 * identities. The crown and bun use the reference's exact hair dimensions;
 * the other existing identities are cut around that same new reference head. */
function appearanceParts():OrigamiHumanPart[] {
  const parts:OrigamiHumanPart[]=[],head:HumanPoint=[0,1.22,0];
  const hair:readonly (readonly [HumanPoint,HumanPoint])[]=[
    [[.40,.14,.40],[0,1.60,-.02]],
    [[.40,.20,.11],[0,1.50,-.18]],
    [[.20,.13,.045],[-.10,1.55,.20]],[[.20,.115,.045],[.10,1.555,.20]],
    [[.11,.17,.37],[-.195,1.51,-.015]],[[.11,.17,.37],[.195,1.51,-.015]],
    [[.40,.47,.13],[0,1.32,-.19]],
    [[.20,.20,.18],[0,1.58,-.26]],
    [[.10,.45,.37],[-.205,1.40,-.015]],[[.10,.45,.37],[.205,1.40,-.015]],
    [[.10,.23,.34],[0,1.66,-.02]],[[.23,.115,.29],[0,1.70,-.03]],
    [[.125,.125,.105],[-.12,1.655,.215]],[[.13,.10,.105],[.09,1.64,.215]],
    [[.355,.035,.34],[0,1.615,-.01]],
  ];
  hair.forEach(([size,at],index)=>parts.push({id:`identity-hair-${index}`,geometry:humanBox(...size),at,bone:1,pivot:head,dye:100+index,profile:P.hair,color:0xffffff}));
  // The lower beard is the reference miner's tapered beard. The other pieces
  // retain the game's moustache/goatee/chops/full/stubble mask semantics.
  parts.push({id:'identity-beard-0',geometry:humanVerticalPrism(.36,.24,.26,.16,.18,0,.03),at:[0,1.30,.11],bone:1,pivot:head,dye:200,profile:P.hair,color:0xffffff});
  const beard:readonly (readonly [HumanPoint,HumanPoint])[]=[
    [[.20,.045,.055],[0,1.37,.205]],[[.105,.18,.075],[0,1.25,.22]],
    [[.085,.20,.28],[-.175,1.34,.07]],[[.085,.20,.28],[.175,1.34,.07]],
  ];
  beard.forEach(([size,at],index)=>parts.push({id:`identity-beard-${index+1}`,geometry:humanBox(...size),at,bone:1,pivot:head,dye:201+index,profile:P.hair,color:0xffffff}));
  return parts;
}

/** Resident genuine apparel, not the source demo's role/loadout presets. */
export function origamiHumanParts(includeSmithing=false,includeMace=false,includeLongsword=false,includeSpear=false):OrigamiHumanPart[] {
  const parts=[...buildOrigamiHumanReference(),...appearanceParts()];
  const hip:HumanPoint=[0,.56,0],head:HumanPoint=[0,1.22,0];
  const add=(id:string,geometry:THREE.BufferGeometry,at:HumanPoint,bone:number,pivot:HumanPoint,dye:number,profile:HumanPaintProfile,color=0xffffff,roll?:number)=>parts.push({id,geometry,at,bone,pivot,dye,profile,color,roll});
  const box=(id:string,size:HumanPoint,at:HumanPoint,bone:number,pivot:HumanPoint,dye:number,profile:HumanPaintProfile,color=0xffffff,roll?:number)=>add(id,humanBox(...size),at,bone,pivot,dye,profile,color,roll);
  const prism=(id:string,dims:readonly [number,number,number,number,number],at:HumanPoint,bone:number,pivot:HumanPoint,dye:number,profile:HumanPaintProfile,color=0xffffff)=>add(id,humanVerticalPrism(...dims),at,bone,pivot,dye,profile,color);
  for(const side of [-1,1]){
    const name=side<0?'left':'right';
    box(`identity-${name}-closed-eye`,[.07,.015,.03],[side*.09,1.44,.181],1,head,61,P.charcoal,0x1a1917);
    for(const [index,roll]of [-Math.PI/4,Math.PI/4].entries())box(`identity-${name}-dead-eye-${index}`,[.07,.015,.03],[side*.09,1.44,.182+index*.001],1,head,62,P.charcoal,0x1a1917,roll);
    // Exact source sheriff coat leaves, enabled only by the actual duster.
    prism(`apparel-duster-${name}`,[.14,.34,.18,.40,.72],[side*.19,.84,0],0,hip,ORIGAMI_DUSTER_DYE,P.outerwear);
  }
  prism('apparel-duster-back',[.48,.10,.56,.14,.72],[0,.84,-.14],0,hip,ORIGAMI_DUSTER_DYE,P.outerwear);
  prism('apparel-tribal-hem',[.50,.34,.56,.38,.28],[0,.62,0],0,hip,-3,P.shirt);
  prism('apparel-parka-coat',[.50,.34,.56,.38,.78],[0,.82,0],0,hip,ORIGAMI_PARKA_DYE,P.outerwear);
  prism('apparel-flak-vest',[.52,.38,.50,.36,.48],[0,.92,0],0,hip,-2,P.outerwear,APPAREL['flak-vest'].color);
  // Open helmets and tuque retain the real equipment tags, with silhouettes
  // rebuilt around the larger source head rather than the old jaw rings.
  prism('apparel-flak-helmet',[.36,.38,.44,.44,.24],[0,1.64,-.01],1,head,-7,P.hat,APPAREL['flak-helmet'].color);
  box('apparel-flak-rim',[.47,.035,.45],[0,1.535,.01],1,head,-7,P.hat,APPAREL['flak-helmet'].color);
  prism('apparel-tuque-crown',[.24,.26,.43,.44,.25],[0,1.67,-.01],1,head,-10,P.hat,APPAREL['cloth-tuque'].color);
  box('apparel-tuque-cuff',[.45,.075,.45],[0,1.565,-.01],1,head,-10,P.hat,APPAREL['cloth-tuque'].color);
  prism('apparel-recon-helmet',[.35,.38,.44,.44,.30],[0,1.64,-.01],1,head,-8,P.hat,APPAREL['recon-helmet'].color);
  box('apparel-recon-visor',[.38,.08,.06],[0,1.50,.20],1,head,-8,P.charcoal,0x344a57);
  box('apparel-recon-faceguard',[.18,.13,.045],[0,1.36,.205],1,head,-8,P.steel,0x536a74);
  for(const side of [-1,1])box(`apparel-recon-cheek-${side}`,[.06,.21,.27],[side*.20,1.40,.02],1,head,-8,P.steel,0x637c84);
  prism('apparel-recon-body',[.55,.39,.51,.37,.52],[0,.91,0],0,hip,ORIGAMI_RECON_ARMOR_DYE,P.outerwear,APPAREL['recon-armor'].color);
  box('apparel-recon-breastplate',[.20,.26,.045],[0,.99,.21],0,hip,ORIGAMI_RECON_ARMOR_DYE,P.steel,0x536a74);
  for(const side of [-1,1]){
    const arm=side<0?2:3,leg=side<0?4:5,calf=side<0?6:7,pivot:HumanPoint=[side*.32,1.12,0],legPivot:HumanPoint=[side*.13,.56,0];
    box(`apparel-recon-shoulder-${side}`,[.20,.14,.32],[side*.32,1.12,0],arm,pivot,ORIGAMI_RECON_ARMOR_DYE,P.outerwear,APPAREL['recon-armor'].color,-side*.2);
    prism(`apparel-recon-sleeve-${side}`,[.18,.19,.15,.17,.30],[side*.32,.99,0],arm,pivot,ORIGAMI_RECON_ARMOR_DYE,P.steel,0x657c84);
    prism(`apparel-recon-thigh-${side}`,[.22,.25,.205,.235,.21],[side*.13,.455,0],leg,legPivot,ORIGAMI_RECON_ARMOR_DYE,P.outerwear,APPAREL['recon-armor'].color);
    prism(`apparel-recon-calf-${side}`,[.205,.235,.19,.22,.21],[side*.13,.245,0],calf,legPivot,ORIGAMI_RECON_ARMOR_DYE,P.steel,0x657c84);
  }
  // Hood wraps the back and sides, leaving the source eyes/nose unobscured.
  box('apparel-parka-hood-back',[.44,.40,.12],[0,1.46,-.19],1,head,-6,P.outerwear);
  for(const side of [-1,1])box(`apparel-parka-hood-${side}`,[.07,.40,.28],[side*.225,1.46,-.015],1,head,-6,P.outerwear);
  if(includeSmithing){
    prism('apparel-plate-breast',[.56,.41,.51,.38,.55],[0,.91,0],0,hip,-11,P.steel);
    box('apparel-plate-plackart',[.14,.30,.045],[0,.96,.22],0,hip,-11,P.steel);
    prism('apparel-plate-collar',[.30,.28,.32,.30,.07],[0,1.22,0],0,hip,-11,P.steel);
    for(const side of [-1,1]){
      const arm=side<0?2:3,leg=side<0?4:5,calf=side<0?6:7,pivot:HumanPoint=[side*.32,1.12,0],legPivot:HumanPoint=[side*.13,.56,0];
      prism(`apparel-plate-pauldron-${side}`,[.20,.24,.24,.27,.20],[side*.32,1.11,0],arm,pivot,-11,P.steel);
      prism(`apparel-plate-vambrace-${side}`,[.17,.19,.15,.17,.25],[side*.32,.95,0],arm,pivot,-11,P.steel);
      prism(`apparel-plate-thigh-${side}`,[.23,.26,.21,.24,.21],[side*.13,.455,0],leg,legPivot,-11,P.steel);
      prism(`apparel-plate-calf-${side}`,[.21,.24,.19,.22,.21],[side*.13,.245,0],calf,legPivot,-11,P.steel);
    }
    prism('apparel-simple-helmet',[.08,.14,.44,.44,.26],[0,1.67,0],1,head,-12,P.steel);
    box('apparel-simple-rim',[.47,.035,.45],[0,1.55,.01],1,head,-12,P.steel);
  }
  // Keep the actual resident weapon geometry in its original game bind units:
  // its shaders use these dimensions when aiming, slinging or striking.
  for(const variant of RESIDENT_WEAPON_VISUALS269)if((variant.item!=='mace-family'||includeMace)&&(variant.item!=='longsword-family'||includeLongsword)&&(variant.item!=='spear-family'||includeSpear))for(const [i,part]of variant.parts.entries()){
    const inv=1/HUMAN_REFERENCE_SCALE;
    const long=variant.item==='bolt-action-rifle'||variant.item==='emp-launcher'||variant.item==='mace-family'||variant.item==='longsword-family'||variant.item==='spear-family';
    box(`weapon-${variant.item}-${i}`,[part.size[2]*inv/PAWN_MODEL_SCALE,part.size[0]*inv/PAWN_MODEL_SCALE,part.size[1]*inv/PAWN_MODEL_SCALE],[(.205+part.center[2]/PAWN_MODEL_SCALE)*inv,(.68+(long?1:-1)*part.center[0]/PAWN_MODEL_SCALE)*inv,part.center[1]*inv/PAWN_MODEL_SCALE],0,[0,.61*inv,0],variant.dye,P.steel,part.color);
  }
  const hand:HumanPoint=[.32,.82,.05],shoulder:HumanPoint=[.32,1.12,0];
  const tool=(id:string,size:HumanPoint,offset:HumanPoint,dye:number,profile:HumanPaintProfile,color:number,roll=0)=>box(id,size,[hand[0]+offset[0],hand[1]+offset[1],hand[2]+offset[2]],3,shoulder,dye,profile,color,roll);
  for(const [name,dye]of [['axe',-30],['pickaxe',-31],['sickle',-32]] as const)tool(`work-${name}-handle`,[.045,name==='sickle'?.45:.72,.047],[0,.14,0],dye,P.wood,0x7d4e2d);
  tool('work-axe-blade',[.26,.20,.053],[.105,.43,0],-30,P.steel,0x6c767d);
  tool('work-axe-poll',[.088,.12,.07],[-.053,.43,0],-30,P.steel,0x4c5459);
  tool('work-pickaxe-left',[.295,.065,.065],[-.083,.43,0],-31,P.steel,0x6c767d,-.12);
  tool('work-pickaxe-right',[.26,.054,.054],[.183,.406,0],-31,P.steel,0x6c767d,-.26);
  for(const [i,part]of ([[[.188,.053,.038],[.065,.283,0],.20],[[.142,.047,.035],[.206,.336,0],.55],[[.106,.041,.033],[.277,.418,0],1.03],[[.083,.033,.028],[.277,.495,0],1.75]] as const).entries())tool(`work-sickle-blade-${i}`,part[0],part[1],-32,P.steel,0x6c767d,part[2]);
  return parts;
}

/** Flatten once into the existing resident pawn batch. Flat face normals and
 * source box UVs survive the transform; all actual identity masks remain GPU
 * selected. No per-pawn object, mesh, texture or material is created here. */
export function origamiHumanGeometry(includeSmithing=false,includeMace=false,includeLongsword=false,includeSpear=false):THREE.InstancedBufferGeometry {
  const registered=humanReferencePaintProfiles(),profileIds=Object.keys(P).map(name=>registered[name as keyof typeof P]);
  const data:number[]=[],lineData:number[]=[],wearData:number[]=[],wearBase:number[]=[],wearExpand:number[]=[],ranges:{id:string;start:number;count:number;bone:number;dye:number;profile:number}[]=[],lineRanges:{id:string;start:number;count:number}[]=[],wearRanges:{id:string;start:number;count:number}[]=[];
  const parts=origamiHumanParts(includeSmithing,includeMace,includeLongsword,includeSpear),scale=HUMAN_REFERENCE_SCALE;
  const append=(target:number[],source:THREE.BufferGeometry,part:OrigamiHumanPart,base?:number[],expand?:number[])=>{
    const position=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv'),tint=new THREE.Color(part.color),c=Math.cos(part.roll??0),s=Math.sin(part.roll??0);
    const authoredBase=source.userData.basePosArray as Float32Array|undefined,authoredExpand=source.userData.expandDirArray as Float32Array|undefined;
    for(let i=0;i<position.count;i++){
      const x=position.getX(i),y=position.getY(i),z=position.getZ(i),nx=normal?.getX(i)??0,ny=normal?.getY(i)??1,nz=normal?.getZ(i)??0;
      target.push((x*c-y*s+part.at[0])*scale,(x*s+y*c+part.at[1])*scale,(z+part.at[2])*scale,nx*c-ny*s,nx*s+ny*c,nz,tint.r,tint.g,tint.b,part.bone,part.dye,profileIds[part.profile],part.pivot[0]*scale,part.pivot[1]*scale,part.pivot[2]*scale,uv?.getX(i)??0,uv?.getY(i)??0);
      if(base&&expand&&authoredBase&&authoredExpand){
        const bx=authoredBase[i*3],by=authoredBase[i*3+1],bz=authoredBase[i*3+2],ex=authoredExpand[i*3],ey=authoredExpand[i*3+1],ez=authoredExpand[i*3+2];
        base.push((bx*c-by*s+part.at[0])*scale,(bx*s+by*c+part.at[1])*scale,(bz+part.at[2])*scale);
        expand.push((ex*c-ey*s)*scale,(ex*s+ey*c)*scale,ez*scale);
      }
    }
  };
  for(const part of parts){
    const geometry=part.geometry,start=data.length/17,reference=createReferenceEdgeGeometry(geometry);
    if(part.id.includes('-trouser-')){
      // There is no authored seam around the source's single trouser prism.
      // Remove the horizontal boundary introduced solely by the rig split.
      const atKnee=part.id.endsWith('-upper')?-.105:.105,points=reference.lines.getAttribute('position'),kept:number[]=[];
      for(let i=0;i<points.count;i+=2){
        if(Math.abs(points.getY(i)-atKnee)<1e-6&&Math.abs(points.getY(i+1)-atKnee)<1e-6)continue;
        kept.push(points.getX(i),points.getY(i),points.getZ(i),points.getX(i+1),points.getY(i+1),points.getZ(i+1));
      }
      reference.lines.setAttribute('position',new THREE.BufferAttribute(new Float32Array(kept),3));
      reference.wear?.dispose();reference.wear=createPhysicalEdgeWearGeometry(reference.surface,reference.lines);
    }
    const lineStart=lineData.length/17,wearStart=wearData.length/17;
    append(data,geometry,part);append(lineData,reference.lines,part);
    if(reference.wear)append(wearData,reference.wear,part,wearBase,wearExpand);
    lineRanges.push({id:part.id,start:lineStart,count:lineData.length/17-lineStart});wearRanges.push({id:part.id,start:wearStart,count:wearData.length/17-wearStart});
    ranges.push({id:part.id,start,count:geometry.getAttribute('position').count,bone:part.bone,dye:part.dye,profile:part.profile});
    geometry.dispose();reference.surface.dispose();reference.lines.dispose();reference.wear?.dispose();
  }
  const compiled=(packed:number[],indexed:boolean)=>{
    const vertices=new THREE.InterleavedBuffer(new Float32Array(packed),17),geometry=new THREE.InstancedBufferGeometry();
    for(const [name,size,offset]of [['position',3,0],['normal',3,3],['color',3,6],['boneId',1,9],['dye',1,10],['origamiMaterialProfile',1,11],['bindPivot',3,12],['pawnRigTraits',3,9]] as const)geometry.setAttribute(name,new THREE.InterleavedBufferAttribute(vertices,size,offset));
    const uv=new THREE.InterleavedBufferAttribute(vertices,2,15);geometry.setAttribute('uv',uv);geometry.setAttribute('origamiPaintUv',uv);
    // Retain the body's ordinary portrait/index contract; companions use
    // source triangle and line order directly.
    if(indexed)geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(Array.from({length:packed.length/17},(_,i)=>i)),1));
    geometry.instanceCount=0;geometry.userData.origami=true;geometry.userData.origamiHumanReference=true;return geometry;
  };
  const geometry=compiled(data,true),lines=compiled(lineData,false),wear=compiled(wearData,false);
  wear.userData.referenceWearBasePositions=new Float32Array(wearBase);wear.userData.referenceWearExpandDirections=new Float32Array(wearExpand);
  geometry.userData.origamiLines=lines;geometry.userData.origamiWear=wear;geometry.userData.origamiReferenceScale=scale;geometry.userData.origamiHumanParts=Object.freeze(ranges.map(range=>Object.freeze(range)));geometry.userData.origamiHumanLineParts=Object.freeze(lineRanges.map(range=>Object.freeze(range)));geometry.userData.origamiHumanWearParts=Object.freeze(wearRanges.map(range=>Object.freeze(range)));return geometry;
}
