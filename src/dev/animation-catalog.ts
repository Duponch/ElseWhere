import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ReentrantRenderer} from '../render/ReentrantRenderer';
import {GraphicsStyleContext,withGraphicsStyle} from '../render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,type GraphicsStyle} from '../ui3d/native-preferences';
import {PawnLayer} from '../render/PawnLayer';
import {WildlifeLayer} from '../render/WildlifeLayer';
import {AnimationDetail} from '../render/AnimationDetail';
import {stageCatalogSharedSurfaces} from './asset-catalog-surface';
import {HUMAN_ANIMATIONS,ANIMAL_ANIMATIONS,ANIMATION_GROUP_LABELS,actionParticles,type HumanAnimation,type AnimalAnimation} from '../render/animation-catalogue';
import {ANIMAL_SPECIES_IDS,ANIMAL_SPECIES} from '../sim/animal-species';
import {itemCargoKind} from '../render/item-presentation';
import {downedWigglePhase,animalIdleProfile,HUMAN_GESTURE} from '../render/actor-idle-gestures';
import {WORLD_SCALE} from '../world/scale';
import {HUMAN_GAIT_RADIANS_PER_UNIT,animalGaitRadiansPerUnit} from '../render/gait-presentation';
import {HAIR_MASKS} from '../render/pawn-appearance-shape';
import {animalCore256,isAnimalSpecies256} from '../sim/animal-core-v256';
import {TICKS_PER_SECOND} from '../sim/types';
import './asset-catalog.css';

/** Développeur : la page des animations (retours du 22 novembre, point 7).
 * Like the asset workshop, it drives the game's own resident rigs (PawnLayer,
 * WildlifeLayer) by writing their instance streams directly: no World,
 * simulation, Worker or save. The streams of each entry are those the game
 * writes for the real state named in its description (animation-catalogue.ts). */
type Stream=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
type Rig={species:string;mesh:THREE.Mesh<THREE.InstancedBufferGeometry>;animationCache:{ensureCapacity(count:number):void};time:{value:number};blend:{value:number}};
const params=new URLSearchParams(location.search);
const style:GraphicsStyle=params.get('style')==='default'?'default':'origami';
const host=document.getElementById('animation-catalog');if(!host)throw Error('Animation page root missing');
host.innerHTML=`<main class="catalog-app"><header class="catalog-header"><div class="catalog-heading"><h1>Animations</h1><p>Personnes et animaux, joués par les rigs du jeu · aucun monde chargé</p></div>
<div class="catalog-toolbar"><label>Corps <select id="anim-body"></select></label><label>Action <select id="anim-action"></select></label>
<label>Vitesse <select id="anim-speed"><option value="0">Pause</option><option value="1" selected>×1</option><option value="3">×3</option><option value="6">×6</option></select></label>
<label>Texture <select id="anim-style"><option value="origami">Gouache</option><option value="default">Pastel</option></select></label></div></header>
<div class="catalog-body"><aside class="catalog-sidebar"><div class="catalog-detail" id="anim-detail" style="max-height:none;flex:1"></div><div class="catalog-inventory" id="anim-list"></div></aside>
<section class="catalog-stage" id="anim-stage"><div class="catalog-loading" id="anim-loading"><div><strong>Préparation des rigs</strong><span id="anim-loading-text">Personnes et animaux…</span></div></div>
<pre class="catalog-error" id="anim-error" hidden></pre></section></div></main>`;
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const bodySelect=$<HTMLSelectElement>('anim-body'),actionSelect=$<HTMLSelectElement>('anim-action'),speedSelect=$<HTMLSelectElement>('anim-speed'),styleSelect=$<HTMLSelectElement>('anim-style');
const stage=$('anim-stage'),detailView=$('anim-detail'),listView=$('anim-list'),errorView=$('anim-error');
styleSelect.value=style;
const failures:string[]=[];
function fail(cause:unknown):void{failures.push(cause instanceof Error?cause.stack??cause.message:String(cause));errorView.hidden=false;errorView.textContent=failures.join('\n\n');document.body.dataset.ready='error';}
// The browser's ResizeObserver loop notice is not an error of the page.
window.addEventListener('error',event=>{if(String(event.message).includes('ResizeObserver loop'))return;fail(event.error??event.message);});window.addEventListener('unhandledrejection',event=>fail(event.reason));

{const option=document.createElement('option');option.value='human';option.textContent='Personne';bodySelect.append(option);}
for(const species of ANIMAL_SPECIES_IDS){const option=document.createElement('option');option.value=species;option.textContent=ANIMAL_SPECIES[species].label;bodySelect.append(option);}
bodySelect.value=params.get('body')&&[...bodySelect.options].some(o=>o.value===params.get('body'))?params.get('body')!:'human';

const renderer=new ReentrantRenderer({antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));renderer.onError=fail;
const scene=new THREE.Scene();scene.background=new THREE.Color('#d7c8aa');
scene.add(new THREE.HemisphereLight(0xfff5e4,0x3d352e,1.15));
const sun=new THREE.DirectionalLight(0xfff0d6,2.3);sun.position.set(6,10,7);scene.add(sun);
const rim=new THREE.DirectionalLight(0x93c5fd,.6);rim.position.set(-8,5,-6);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(14,14),new THREE.MeshStandardNodeMaterial({color:'#d8ccb4',roughness:1,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);
const grid=new THREE.GridHelper(14,14,0xb5a17a,0xc4b493);grid.position.y=0;scene.add(grid);
// Plain props for the seated poses: a stool under the seat and a table or
// workbench in front, at the game's heights (WORLD_SCALE).
const propMaterial=new THREE.MeshStandardNodeMaterial({color:'#9b7b57',roughness:.9,metalness:0,transparent:true,opacity:.55,depthWrite:false});
const stool=new THREE.Mesh(new THREE.BoxGeometry(.42,WORLD_SCALE.stoolHeight,.42),propMaterial);stool.position.y=WORLD_SCALE.stoolHeight/2;
const table=new THREE.Mesh(new THREE.BoxGeometry(.9,WORLD_SCALE.tableHeight,.7),propMaterial);
const props=new THREE.Group();props.add(stool,table);scene.add(props);
function placeProps(pose:number,activity:number,yaw:number):void {
  const seated=pose===3,front=activity===HUMAN_GESTURE.eat||activity===HUMAN_GESTURE.tableGame||activity>.5&&activity<3.5;
  stool.visible=seated;table.visible=seated&&front;props.rotation.y=yaw;table.position.set(0,WORLD_SCALE.tableHeight/2,.78);
}
const camera=new THREE.PerspectiveCamera(38,1,.05,500);camera.position.set(3.2,2.6,4.2);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.9,0);controls.maxPolarAngle=Math.PI*.49;

const detail=new AnimationDetail();detail.setSettings({enabled:false,nearPixels:24,farPixels:8,middleHz:12});
const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style});
const invoke=(target:object,name:string,...args:unknown[]):unknown=>{const method=Reflect.get(target,name);if(typeof method!=='function')throw Error('Animation page: renderer seam '+name+' changed');return Reflect.apply(method,target,args);};
function write(geometry:THREE.BufferGeometry,name:string,slot:number,values:readonly number[]):void {
  const value=geometry.getAttribute(name) as Stream|undefined;if(!value)throw Error('Animation page: missing stream '+name);
  for(let c=0;c<values.length;c++)value.setComponent(slot,c,values[c]!);
  if(value instanceof THREE.InterleavedBufferAttribute)value.data.needsUpdate=true;else value.needsUpdate=true;
}

// One person, painted like the workshop's first preview.
const pawns=withGraphicsStyle(context,()=>new PawnLayer(undefined,detail));
invoke(pawns,'createPawnMesh',1);Reflect.set(pawns,'nativeBody',true);invoke(pawns,'selectBodyMaterial');
const pawnBody=Reflect.get(pawns,'pawnMesh') as THREE.Mesh<THREE.InstancedBufferGeometry>,person=pawnBody.geometry;
const cargoMesh=Reflect.get(pawns,'cargoMesh') as THREE.Mesh<THREE.InstancedBufferGeometry>;
for(const child of pawns.group.children)if(child!==pawnBody&&child!==cargoMesh&&child!==Reflect.get(pawns,'wearEffect'))child.visible=false;
person.instanceCount=1;cargoMesh.geometry.instanceCount=1;pawns.animationCache.ensureCapacity(1);
{
  const palette=context.registerHumanAppearance({skin:0xe0b18d,hair:0x4a3222,shirt:0x3b6e8c,outerwear:0x3b6e8c,pants:0x3c424a,hat:0x8c5832,vest:0x8c5832,reconArmor:0x8c5832,plate:0x3b6e8c});
  const tint=new THREE.Color(0x3b6e8c),skin=new THREE.Color(0xe0b18d),hair=new THREE.Color(0x4a3222);
  write(person,'aTint',0,tint.toArray());write(person,'aSkin',0,skin.toArray());write(person,'aHairBlood',0,[hair.r,hair.g,hair.b,0]);
  write(person,'aShape',0,[0,0,HAIR_MASKS.short,palette*32]);write(person,'aEquipment',0,[0,1,0,0]);write(person,'aCargo',0,[0,0,0,0]);
}
invoke(pawns,'syncBodyInstances',person);scene.add(pawns.group);

// Every species rig, one instance shown at a time.
const wild=withGraphicsStyle(context,()=>new WildlifeLayer(undefined,undefined,detail)),rigs=Reflect.get(wild,'rigs') as Rig[];
for(const child of wild.mesh.children)child.visible=false;
for(const rig of rigs){const g=rig.mesh.geometry;rig.animationCache.ensureCapacity(1);g.instanceCount=0;
  write(g,'aBiology',0,[1,0,0]);write(g,'aCarrier',0,[0,0,0,0]);write(g,'aCorpseHandoff',0,[0,0]);write(g,'aCorpseFrom',0,[0,0,0,0]);write(g,'aCorpseTo',0,[0,0,0,0]);}
scene.add(wild.mesh);

let tick=0,lastNow=performance.now(),origin=0,nextRepeat=0,edge={from:-2.5,to:2.5,start:0,end:0,phase:0};
const humanAction=()=>HUMAN_ANIMATIONS.find(a=>a.id===actionSelect.value)??HUMAN_ANIMATIONS[0]!;
const animalAction=()=>ANIMAL_ANIMATIONS.find(a=>a.id===actionSelect.value)??ANIMAL_ANIMATIONS[0]!;
const selectedRig=()=>rigs.find(rig=>rig.species===bodySelect.value);
const speciesFacts=(species:string)=>isAnimalSpecies256(species)?{body:animalCore256(species).race.body as string,food:String(animalCore256(species).race.foodType)}:{body:undefined,food:undefined};

function fillActions():void {
  actionSelect.replaceChildren();const human=bodySelect.value==='human';
  if(human){for(const [group,label] of Object.entries(ANIMATION_GROUP_LABELS)){const g=document.createElement('optgroup');g.label=label;for(const a of HUMAN_ANIMATIONS.filter(x=>x.group===group)){const o=document.createElement('option');o.value=a.id;o.textContent=a.label;g.append(o);}if(g.children.length)actionSelect.append(g);}}
  else for(const a of ANIMAL_ANIMATIONS){const o=document.createElement('option');o.value=a.id;o.textContent=a.label;actionSelect.append(o);}
  const wanted=params.get('action');if(wanted&&[...actionSelect.options].some(o=>o.value===wanted))actionSelect.value=wanted;
}
function describe():void {
  detailView.replaceChildren();const human=bodySelect.value==='human',entry:HumanAnimation|AnimalAnimation=human?humanAction():animalAction();
  const h=document.createElement('h2');h.textContent=entry.label;const p=document.createElement('p');p.textContent=entry.description;
  const s=document.createElement('p');s.className='catalog-subtle';s.textContent='Dans le jeu : '+entry.state+'.';detailView.append(h,p,s);
  if(!human){const profile=animalIdleProfile(bodySelect.value,speciesFacts(bodySelect.value).body,speciesFacts(bodySelect.value).food);
    const f=document.createElement('p');f.className='catalog-subtle';f.textContent=`Famille : ${({quadruped:'quadrupède',canine:'canidé',feline:'félin',bird:'oiseau',insect:'insecte',snake:'serpent',turtle:'tortue',lizard:'lézard',primate:'primate'} as const)[profile.family]}${profile.graze?' · broute':''}${profile.peck?' · picore':''}${profile.tailAmplitude?' · queue':''}${profile.shake?' · s’ébroue':''}${profile.ruffle?' · ébouriffe ses ailes':''}.`;detailView.append(f);}
  listView.replaceChildren();const head=document.createElement('h2');head.className='catalog-section-heading';head.textContent=human?'Toutes les animations des personnes':'Toutes les animations des animaux';listView.append(head);
  for(const a of human?HUMAN_ANIMATIONS:ANIMAL_ANIMATIONS){const b=document.createElement('button');b.className='catalog-entry';b.setAttribute('aria-current',String(a.id===entry.id));b.title=a.description;const t=document.createElement('span');t.className='entry-name';t.textContent=a.label;b.append(t);b.onclick=()=>{actionSelect.value=a.id;select();};listView.append(b);}
  const particles=actionParticles(),ph=document.createElement('h2');ph.className='catalog-section-heading';ph.textContent='Particules d’action';listView.append(ph);
  const pp=document.createElement('p');pp.className='catalog-subtle';pp.style.padding='0 6px';pp.textContent=particles.length?particles.map(x=>`${x.label} : ${x.description}`).join('\n'):'Le catalogue des particules d’action sera listé ici quand il sera livré.';listView.append(pp);
}
function frame(focusY:number,distance:number):void {controls.target.set(0,focusY,0);const dir=camera.position.clone().sub(controls.target).normalize();camera.position.copy(controls.target).addScaledVector(dir,distance);controls.update();}
function select():void {
  const human=bodySelect.value==='human';edge={from:-2.5,to:2.5,start:(tick-origin)/TICKS_PER_SECOND,end:(tick-origin)/TICKS_PER_SECOND,phase:0};nextRepeat=0;
  pawns.group.visible=human;props.visible=human;for(const rig of rigs){const on=!human&&rig.species===bodySelect.value;rig.mesh.visible=on;rig.mesh.geometry.instanceCount=on?1:0;for(const c of rig.mesh.children)c.visible=on;}
  if(human){const a=humanAction();write(person,'aCargo',0,[a.cargo?itemCargoKind(a.cargo):0,a.cargo?1:0,0,0]);invoke(pawns,'syncMainCargoKinds');invoke(pawns,'refreshBodyPartUnion',pawnBody.geometry);frame(a.pose===1||a.pose===5||a.pose===18||a.pose===19?.5:.95,4.6);}
  else{const rig=selectedRig();if(rig){invoke(rig,'syncOrigamiInstances');invoke(rig,'setOrigamiCount',1);rig.mesh.geometry.computeBoundingBox();const box=rig.mesh.geometry.boundingBox!;const size=box.getSize(new THREE.Vector3());frame(Math.max(.3,size.y*.45),Math.max(2.4,Math.max(size.x,size.y,size.z)*2.6));}}
  const url=new URL(location.href);url.searchParams.set('body',bodySelect.value);url.searchParams.set('action',actionSelect.value);url.searchParams.set('style',style);history.replaceState(null,'',url);
  describe();
}
/** One frame of the selected entry: the same clocks as SceneRenderCore
 * (presentation time wrapped at 2π, travel time from a 1024-tick origin). */
function animate(now:number):void {
  const speed=Number(speedSelect.value),dt=Math.min(.1,Math.max(0,(now-lastNow)/1000));lastNow=now;tick+=dt*TICKS_PER_SECOND*speed;
  const newOrigin=Math.floor(tick/1024)*1024;if(newOrigin!==origin){const shift=(newOrigin-origin)/TICKS_PER_SECOND;edge.start-=shift;edge.end-=shift;nextRepeat-=shift;origin=newOrigin;}
  const time=(tick/TICKS_PER_SECOND)%(2*Math.PI),travel=(tick-origin)/TICKS_PER_SECOND;
  const human=bodySelect.value==='human',moving=human?!!humanAction().walking:animalAction().moving>.5;
  if(moving&&travel>=edge.end){const rate=human?HUMAN_GAIT_RADIANS_PER_UNIT:animalGaitRadiansPerUnit(bodySelect.value),cellsPerSecond=human?4.6:4;
    const next={from:edge.to,to:edge.from,start:travel,end:travel+Math.abs(edge.to-edge.from)/cellsPerSecond,phase:(edge.phase+Math.abs(edge.to-edge.from)*rate)%(2*Math.PI)};edge=next;}
  const yaw=moving?Math.atan2(edge.to-edge.from,0):-.75;
  if(human){
    const a=humanAction();placeProps(moving?0:a.pose,a.activity,yaw);pawns.time.value=time;pawns.travelTime.value=travel;pawns.blend.value=1;
    if(a.repeat&&travel>=nextRepeat)nextRepeat=travel+a.repeat;
    const phase=moving?edge.phase:a.repeat?nextRepeat-a.repeat:a.downed?downedWigglePhase(7,origin):7*1.7;
    write(person,'aFrom',0,moving?[edge.from,0,0,yaw]:[0,0,0,yaw]);write(person,'aTo',0,moving?[edge.to,0,0,yaw]:[0,0,0,yaw]);
    write(person,'aTravel',0,moving?[edge.start,edge.end,0,1]:[0,0,0,2]);write(person,'aMotion',0,[moving?1:0,a.activity,a.pose,phase]);
  }else{
    const a=animalAction(),rig=selectedRig();
    if(rig){const g=rig.mesh.geometry;rig.time.value=time;rig.blend.value=1;wild.travelTime.value=travel;
      if(a.repeat&&travel>=nextRepeat)nextRepeat=travel+a.repeat;
      const seed=moving?edge.phase:a.repeat?nextRepeat-a.repeat:a.posture===ANIMAL_ANIMATIONS.find(x=>x.id==='downed')!.posture?downedWigglePhase(7,origin):7;
      g.computeBoundingBox();const lift=-g.boundingBox!.min.y;
      write(g,'aFrom',0,moving?[edge.from,lift,0,yaw]:[0,lift,0,yaw]);write(g,'aTo',0,moving?[edge.to,lift,0,yaw]:[0,lift,0,yaw]);
      write(g,'aTravel',0,moving?[edge.start,edge.end,0,1]:[0,0,0,2]);write(g,'aAnimal',0,[moving?1:0,a.eating,a.posture,seed]);}
  }
  controls.update();renderer.render(scene,camera);
  requestAnimationFrame(animate);
}
let preparing=true,resizePending=false;
/** The shared surface preparation keys on the camera: hold resizes until it is published. */
function resize():void{if(preparing){resizePending=true;return;}const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
bodySelect.onchange=()=>{fillActions();select();};actionSelect.onchange=select;
styleSelect.onchange=()=>{const url=new URL(location.href);url.searchParams.set('style',styleSelect.value);location.href=url.href;};
Object.assign(window,{animationPage:{human:HUMAN_ANIMATIONS,animals:ANIMAL_ANIMATIONS,select:(body:string,action:string)=>{bodySelect.value=body;fillActions();actionSelect.value=action;select();},setSpeed:(value:number)=>{speedSelect.value=String(value);}}});

async function init():Promise<void>{
  await renderer.init();stage.prepend(renderer.domElement);preparing=false;resize();preparing=true;new ResizeObserver(resize).observe(stage);
  fillActions();select();controls.enabled=false;
  $('anim-loading-text').textContent='Peinture et compilation…';
  context.flushPaint();
  const shared=await stageCatalogSharedSurfaces(context,{renderer,scene,camera,assertCurrent:()=>{}},'initial');
  try{shared?.publish();await renderer.compileAsync(scene,camera);shared?.commit();}catch(error){shared?.rollback();throw error;}finally{shared?.dispose();}
  preparing=false;controls.enabled=true;if(resizePending)resize();
  $('anim-loading').hidden=true;document.body.dataset.ready='ready';lastNow=performance.now();requestAnimationFrame(animate);
}
init().catch(fail);
