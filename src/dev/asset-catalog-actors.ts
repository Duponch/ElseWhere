import * as THREE from 'three/webgpu';
import {attribute} from 'three/tsl';
import {PawnLayer} from '../render/PawnLayer';
import {WildlifeLayer} from '../render/WildlifeLayer';
import {AnimationDetail} from '../render/AnimationDetail';
import {withGraphicsStyle,type GraphicsStyleContext} from '../render/graphics-style';
import {BODY_TYPES,HEAD_TYPES,HAIR_STYLES,BEARD_STYLES} from '../sim/pawn-appearance';
import {HAIR_MASKS,BEARD_MASKS,HAIR_PARTS,BEARD_PARTS} from '../render/pawn-appearance-shape';
import {APPAREL,type ApparelItem} from '../sim/apparel-rules';
import {SIMPLE_HELMET_ITEMS267,SIMPLE_HELMET_COLORS267} from '../render/character-apparel';
import {WEAPON_VISUALS,weaponVisual} from '../render/weapon-shape';
import {MACE_ITEMS_269} from '../sim/mace-content-269';
import {LONGSWORD_ITEMS_270} from '../sim/longsword-content-270';
import {SPEAR_ITEMS_272} from '../sim/spear-content-272';
import {WEAPON_LABELS} from '../sim/equipment-rules';
import {ANIMAL_SPECIES_IDS,ANIMAL_SPECIES} from '../sim/animal-species';
import {ORIGAMI_ANIMAL_REFERENCES} from '../render/origami/animal-geometry';
import {animalParts} from '../render/animal-shape';
import {POSE_DEAD} from '../bridge/actor-phase-dependencies-297';
import {scytherGeometry} from '../render/scyther-geometry';
import {createOrigamiContour,type OrigamiContourBinding} from '../render/origami/contours';
import {rangedMechGeometry} from '../render/ranged-mech-geometry';
import {material} from '../render/primitives';
import {mechanoidDefinition,type MechanoidKind} from '../sim/mechanoid-definition';
import {mechanoidPartIndex} from '../sim/mechanoid-presentation';
import type {CatalogCollection,CatalogItem,CatalogSection,CatalogStatus} from './asset-catalog-types';

type Stream=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
type RaceRig={species:typeof ANIMAL_SPECIES_IDS[number];mesh:THREE.Mesh<THREE.InstancedBufferGeometry>;animationCache:{ensureCapacity(count:number):void};time:{value:number};blend:{value:number};origamiLines?:THREE.Mesh;origamiWear?:THREE.Mesh};
interface HumanPreview {
  id:string;label:string;note?:string;body:number;head:number;hairMask:number;beardMask:number;
  tint:number;skin:number;hair:number;silhouette:number;flags:number;pants:number;weapon:number;activity:number;pose:number;stage:number;
  palette?:number;hat?:number;
}
const PALETTES=[{skin:0xe0b18d,hair:0x4a3222,tint:0x3b6e8c},{skin:0xffefd5,hair:0x333333,tint:0x809864},{skin:0x825b30,hair:0xc19255,tint:0xc57c65}] as const;
const PANTS=[0x3c424a,0xd8c8a2,0xad8a61,0xa88b63,0x839ac5,0xc3a375,0xb3c0ba,0xb26422,0x707070] as const;
const REFERENCE_NAMES={fox:'renard',camel:'chameau',hare:'lièvre',dog:'chien',buffalo:'buffle',gazelle:'gazelle',deer:'cerf',elephant:'éléphant'} as const;
const BODY_NAMES={Male:'Masculin',Female:'Féminin',Thin:'Mince',Hulk:'Costaud',Fat:'Corpulent'} as const;
function baseHuman(id:string,label:string,index=0):HumanPreview {
  return {id,label,...PALETTES[index%PALETTES.length],body:0,head:0,hairMask:HAIR_MASKS.short,beardMask:0,silhouette:1,flags:0,pants:0,weapon:0,activity:0,pose:0,stage:0};
}
function write(geometry:THREE.BufferGeometry,name:string,slot:number,values:readonly number[]):void {
  const value=geometry.getAttribute(name) as Stream|undefined;if(!value)throw Error(`Actor catalog: missing renderer stream ${name}`);
  for(let component=0;component<values.length;component++)value.setComponent(slot,component,values[component]!);
  if(value instanceof THREE.InterleavedBufferAttribute)value.data.needsUpdate=true;else value.needsUpdate=true;
}
function invoke(target:object,name:string,...args:unknown[]):unknown {
  const method=Reflect.get(target,name);if(typeof method!=='function')throw Error(`Actor catalog: renderer preview seam ${name} changed`);return Reflect.apply(method,target,args);
}
function detail():AnimationDetail {const result=new AnimationDetail();result.setSettings({enabled:false,nearPixels:24,farPixels:8,middleHz:12});return result;}
function humanStatus(context:GraphicsStyleContext):CatalogStatus{return context.origami?'origami':'default';}
function item(id:string,label:string,status:CatalogStatus,bounds:THREE.Box3,note?:string):CatalogItem {
  const center=bounds.getCenter(new THREE.Vector3());center.y=bounds.max.y+.22;return {id,label,status,note,position:center,bounds};
}

function clothingPreview(id:ApparelItem,index:number):HumanPreview {
  const definition=APPAREL[id],result=baseHuman(`apparel:${id}`,`Vêtement · ${definition.label}`,index),family=definition.family;
  result.tint=definition.color;
  if(family==='tribalwear')result.silhouette=2;
  else if(family==='duster')result.silhouette=3;
  else if(family==='parka')result.silhouette=4;
  else if(family==='pants')result.pants=Math.max(1,['cloth','light-leather','plainleather','bluefur','camelhide','muffalo-wool','foxfur'].indexOf(definition.material??'cloth')+1);
  else if(family==='tuque'){result.flags=id==='muffalo-wool-tuque'?8:6;result.hat=id==='muffalo-wool-tuque'?0xb3c0ba:definition.color;}
  else if(id==='flak-vest')result.flags=1;
  else if(id==='flak-pants')result.pants=8;
  else if(id==='recon-armor')result.silhouette=5;
  else if(id.endsWith('-plate-armor'))result.silhouette=6;
  if(id==='flak-helmet'||id==='plasteel-flak-helmet'){result.flags=2;result.hat=definition.color;if(id==='plasteel-flak-helmet')result.pants+=.5;}
  else if(id==='recon-helmet'){result.flags=4;result.hat=definition.color;}
  else if(id.endsWith('-simple-helmet')){result.flags=10;const materialIndex=SIMPLE_HELMET_ITEMS267.indexOf(id as typeof SIMPLE_HELMET_ITEMS267[number]);result.pants+=(materialIndex+1)/16;result.hat=SIMPLE_HELMET_COLORS267[materialIndex]??definition.color;}
  result.note='Vêtement existant, avec sa forme et sa couleur actuelles.';return result;
}
function humanPreviews():HumanPreview[] {
  const rows:HumanPreview[]=[];
  BODY_TYPES.forEach((body,index)=>rows.push({...baseHuman(`body:${body.id}`,`Corps · ${BODY_NAMES[body.id]}`,index),body:index}));
  HEAD_TYPES.forEach((head,index)=>rows.push({...baseHuman(`head:${head.id}`,`Tête ${head.sex==='female'?'féminine':'masculine'} · ${head.width==='narrow'?'étroite':'moyenne'} · mâchoire ${{normal:'normale',pointy:'pointue',wide:'large'}[head.jaw]}`,index),body:head.sex==='female'?1:0,head:index}));
  HAIR_STYLES.forEach((hair,index)=>rows.push({...baseHuman(`hair:${hair.id}`,`Cheveux · ${hair.id}`,index),hairMask:HAIR_MASKS[hair.shape],note:'Coupe existante ; certains noms du catalogue partagent la même forme.'}));
  BEARD_STYLES.forEach((beard,index)=>rows.push({...baseHuman(`beard:${beard.id}`,`Barbe · ${beard.id}`,index),beardMask:BEARD_MASKS[beard.shape]}));
  HAIR_PARTS.forEach((_,index)=>rows.push({...baseHuman(`hair-part:${index}`,`Pièce de cheveux · ${index+1}`),hairMask:2**index,note:'Élément de coiffure isolé pour en vérifier la forme.'}));
  BEARD_PARTS.forEach((_,index)=>rows.push({...baseHuman(`beard-part:${index}`,`Pièce de barbe · ${index+1}`),hairMask:0,beardMask:2**index,note:'Élément de barbe isolé pour en vérifier la forme.'}));
  (Object.keys(APPAREL) as ApparelItem[]).forEach((id,index)=>rows.push(clothingPreview(id,index)));
  for(const [index,id]of [...WEAPON_VISUALS.map(visual=>visual.item),...MACE_ITEMS_269,...LONGSWORD_ITEMS_270,...SPEAR_ITEMS_272].entries())rows.push({...baseHuman(`weapon:${id}`,`Arme · ${WEAPON_LABELS[id]}`,index),weapon:weaponVisual(id)!.equipment,note:'Version et matière existantes de cette arme, montrée sur un colon.'});
  for(const [index,name]of ['Hache','Pioche','Faucille'].entries())rows.push({...baseHuman(`work-tool:${index}`,`Outil visuel · ${name}`),activity:[-30,-31,-32][index]!,note:'Outil de travail du style Origami, présenté au repos.'});
  return rows;
}
function palette(context:GraphicsStyleContext,row:HumanPreview):void {
  row.palette=context.origami?context.registerHumanAppearance({skin:row.skin,hair:row.hair,shirt:row.tint,outerwear:row.tint,pants:PANTS[Math.floor(row.pants)]??PANTS[0],hat:row.hat??APPAREL['flak-helmet'].color,vest:APPAREL['flak-vest'].color,reconArmor:APPAREL['recon-armor'].color,plate:row.tint}):0;
}

/** Documented development-only bridge to the existing resident render kernel.
 * It initializes static renderer attributes directly: no Pawn/World cast,
 * admission, owner, command, Engine, clock advance, Worker or save exists here.
 * The Native original graph is the only displayed/compiled body variant. */
function pawnSection(context:GraphicsStyleContext,id:string,label:string,rows:HumanPreview[]):{section:CatalogSection;dispose():void} {
  const layer=withGraphicsStyle(context,()=>new PawnLayer(undefined,detail()));
  for(const name of ['smithingGeometry','maceGeometry','longswordGeometry','spearGeometry'])Reflect.set(layer,name,true);
  invoke(layer,'createPawnMesh',rows.length);Reflect.set(layer,'nativeBody',true);invoke(layer,'selectBodyMaterial');
  const body=Reflect.get(layer,'pawnMesh') as THREE.Mesh<THREE.InstancedBufferGeometry>,geometry=body.geometry;
  const companions=[Reflect.get(layer,'origamiLineMesh'),Reflect.get(layer,'origamiWearMesh')];
  for(const child of layer.group.children)if(child!==body&&!companions.includes(child))child.visible=false;
  geometry.instanceCount=rows.length;layer.animationCache.ensureCapacity(rows.length);layer.time.value=layer.travelTime.value=0;
  const items:CatalogItem[]=[],columns=9;
  rows.forEach((row,index)=>{
    const x=index%columns*4.2,z=Math.floor(index/columns)*4.8;
    write(geometry,'aFrom',index,[x,0,z,.12*Math.PI]);write(geometry,'aTo',index,[x,0,z,.12*Math.PI]);write(geometry,'aTravel',index,[0,0,0,0]);
    write(geometry,'aMotion',index,[0,row.activity,row.pose,0]);write(geometry,'aCargo',index,[0,0,0,0]);
    const tint=new THREE.Color(row.tint),skin=new THREE.Color(row.skin),hair=new THREE.Color(row.hair);
    write(geometry,'aTint',index,tint.toArray());write(geometry,'aSkin',index,skin.toArray());write(geometry,'aHairBlood',index,[hair.r,hair.g,hair.b,0]);
    write(geometry,'aShape',index,[row.body+row.stage*10,row.head,row.hairMask,row.beardMask+(row.palette??0)*32]);
    write(geometry,'aEquipment',index,[row.weapon,row.silhouette,row.flags,row.pants]);
    const bounds=new THREE.Box3(new THREE.Vector3(x-1.6,-.05,z-1.8),new THREE.Vector3(x+1.6,2.9,z+1.8));
    const note=!context.origami&&row.id==='apparel:recon-armor'?'Aperçu du modèle actuel : anomalie connue de la tenue recon en style par défaut.':row.note;
    items.push(item(row.id,row.label,humanStatus(context),bounds,[note,'Aperçu statique du générateur courant ; cadrage large pour voir aussi les accessoires.'].filter(Boolean).join(' ')));
  });
  invoke(layer,'syncOrigamiInstances',geometry);layer.group.name=label;
  return {section:{id,label,group:layer.group,items,note:'Variantes actuelles du générateur ; les combinaisons de corps, coiffures et tenues ne sont pas toutes déroulées.'},dispose:()=>layer.dispose()};
}

function animalSection(context:GraphicsStyleContext,dead:boolean):{section:CatalogSection;dispose():void} {
  const layer=withGraphicsStyle(context,()=>new WildlifeLayer(undefined,undefined,detail())),rigs=Reflect.get(layer,'rigs') as RaceRig[];
  const bodies=new Set(rigs.map(rig=>rig.mesh));for(const child of layer.mesh.children)if(!bodies.has(child as THREE.Mesh<THREE.InstancedBufferGeometry>))child.visible=false;
  const sizes=rigs.map(rig=>{
    const geometry=rig.mesh.geometry;geometry.computeBoundingBox();const original=geometry.boundingBox!.clone();
    if(!dead)return {rig,bounds:original.translate(new THREE.Vector3(0,-original.min.y,0)),lift:-geometry.boundingBox!.min.y};
    const center=geometry.userData.origamiBodyCenter??animalParts(rig.species)[0]!.center[1],floor=.025-original.min.x;
    const matrix=new THREE.Matrix4().set(0,-1,0,center,1,0,0,floor,0,0,1,0,0,0,0,1);
    return {rig,bounds:original.applyMatrix4(matrix),lift:0};
  });
  const columns=8,widths=Array.from({length:columns},(_,column)=>Math.max(3.7,...sizes.filter((_,index)=>index%columns===column).map(value=>value.bounds.getSize(new THREE.Vector3()).x+1.8)));
  const depths=Array.from({length:Math.ceil(sizes.length/columns)},(_,row)=>Math.max(4,...sizes.slice(row*columns,(row+1)*columns).map(value=>value.bounds.getSize(new THREE.Vector3()).z+2)));
  const offset=(values:number[],index:number)=>values.slice(0,index).reduce((sum,value)=>sum+value,0),items:CatalogItem[]=[];
  for(const {rig,bounds,lift}of sizes){
    const index=ANIMAL_SPECIES_IDS.indexOf(rig.species),x=offset(widths,index%columns),z=offset(depths,Math.floor(index/columns)),g=rig.mesh.geometry;
    rig.mesh.visible=true;g.instanceCount=1;rig.animationCache.ensureCapacity(1);rig.time.value=0;rig.blend.value=1;
    write(g,'aFrom',0,[x,lift,z,0]);write(g,'aTo',0,[x,lift,z,0]);write(g,'aTravel',0,[0,0,0,0]);write(g,'aAnimal',0,[0,0,dead?2:0,0]);write(g,'aBiology',0,[1,0,0]);
    write(g,'aCarrier',0,[0,0,0,0]);write(g,'aCorpseHandoff',0,[0,0]);write(g,'aCorpseFrom',0,[0,0,0,0]);write(g,'aCorpseTo',0,[0,0,0,0]);
    invoke(rig,'syncOrigamiInstances');invoke(rig,'setOrigamiCount',1);
    const reference=ORIGAMI_ANIMAL_REFERENCES[rig.species],status:CatalogStatus=context.origami&&reference?'reference':'default';
    const note=context.origami&&reference?`Dessin peint fourni : ${REFERENCE_NAMES[reference]}. L’espèce garde son nom du catalogue.`:context.origami?'Modèle actuel conservé ; dessin Origami de cette espèce non encore disponible.':'Modèle du style par défaut.';
    items.push(item(`${dead?'corpse':'animal'}:${rig.species}`,`${dead?'Reste · ':''}${ANIMAL_SPECIES[rig.species].label}`,status,bounds.translate(new THREE.Vector3(x,0,z)),note));
  }
  layer.mesh.name=dead?'Restes animaux':'Faune — 53 espèces existantes';
  return {section:{id:dead?'animal-corpses':'animals',label:layer.mesh.name,group:layer.mesh,items,note:'53 espèces adultes. Huit dessins fournis couvrent onze identités ; les autres modèles actuels sont conservés.'},dispose:()=>layer.dispose()};
}

/** The three source mechanical recipes are deliberately retained in both
 * styles. Their neutral/dead transforms are the existing rig's exact static
 * equations; no unexported race class or fake World is needed. */
function mechanicalSection(context:GraphicsStyleContext):{section:CatalogSection;dispose():void} {
  const group=new THREE.Group(),items:CatalogItem[]=[],kinds:MechanoidKind[]=['scyther','lancer','pikeman'];group.name='Machines — recettes existantes';
  const contours:OrigamiContourBinding[]=[],bodies:THREE.Mesh[]=[];
  for(const [index,kind]of kinds.entries())for(const dead of [false,true]){
    const geometry=kind==='scyther'?scytherGeometry(1,part=>mechanoidPartIndex(kind,part)):rangedMechGeometry(kind,1,part=>mechanoidPartIndex(kind,part));
    const position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal');
    if(dead)for(let i=0;i<position.count;i++){const x=position.getX(i),y=position.getY(i),nx=normal.getX(i),ny=normal.getY(i);position.setXYZ(i,1.12-y,x+.70,position.getZ(i));normal.setXYZ(i,-ny,nx,normal.getZ(i));}
    geometry.instanceCount=1;geometry.computeBoundingBox();const mat=material(0xffffff,{metalness:.24,roughness:.74});mat.colorNode=attribute('color','vec3');
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(index*4.5,0,dead?5:0);mesh.name=`${dead?'Carcasse':'Machine'} · ${kind}`;group.add(mesh);
    bodies.push(mesh);
    if(context.origami){mesh.updateMatrix();const contour=createOrigamiContour(mesh,context);contours.push(contour);group.add(contour.line);}
    const bounds=geometry.boundingBox!.clone().translate(mesh.position);items.push(item(`machine:${kind}:${dead?'corpse':'live'}`,`${dead?'Carcasse · ':''}${mechanoidDefinition(kind).label}`,'default',bounds,'Modèle mécanique actuel, debout ou couché. Pas de version Origami distincte.'));
  }
  return {section:{id:'machines',label:group.name,group,items},dispose(){for(const contour of contours)contour.dispose();for(const mesh of bodies){mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();}group.clear();}};
}

export function createActorCatalog(context:GraphicsStyleContext):CatalogCollection {
  const allRows=humanPreviews(),rows=context.origami?allRows:allRows.filter(row=>!row.id.startsWith('work-tool:')),corpseRows=[0,1,2].map(stage=>({...baseHuman(`human-corpse:${stage}`,['Humain · mort','Humain · putréfié','Humain · desséché'][stage]!),pose:POSE_DEAD,stage}));
  for(const row of [...rows,...corpseRows])palette(context,row);
  const humans=pawnSection(context,'humans','Humains — générateur et équipements existants',rows),corpses=pawnSection(context,'human-corpses','Restes humains — états existants',corpseRows),animals=animalSection(context,false),animalCorpses=animalSection(context,true),machines=mechanicalSection(context);
  if(!context.origami)humans.section.missing=allRows.filter(row=>row.id.startsWith('work-tool:')).map(row=>({id:row.id,label:row.label,reason:'Accessoire proposé dans le style Origami ; choisissez ce style pour le voir.'}));
  let disposed=false;return {sections:[humans.section,animals.section,corpses.section,animalCorpses.section,machines.section],dispose(){if(disposed)return;disposed=true;humans.dispose();corpses.dispose();animals.dispose();animalCorpses.dispose();machines.dispose();}};
}
