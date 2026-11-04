import * as THREE from 'three/webgpu';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ReentrantRenderer} from '../render/ReentrantRenderer';
import {GraphicsStyleContext,withGraphicsStyle} from '../render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,ORIGAMI_STYLE_CONTROLS,formatOrigamiStyleValue,type GraphicsStyle,type GraphicsStylePreferences} from '../ui3d/native-preferences';
import {createActorCatalog} from './asset-catalog-actors';
import {createEnvironmentAssetCatalog} from './asset-catalog-environment';
import {createTransportAssetCatalog} from './asset-catalog-transports';
import type {CatalogCollection,CatalogItem,CatalogSection,CatalogStatus} from './asset-catalog-types';
import {changeCatalogSurface} from './asset-catalog-surface';
import './asset-catalog.css';

/** Independent development entry point. No Main bootstrap, simulation,
 * campaign, persistence, clock advancement or Worker is constructed here. */
const host=document.getElementById('asset-catalog');if(!host)throw new Error('Asset catalog root missing');
host.innerHTML=`<main class="catalog-app"><header class="catalog-header"><div class="catalog-heading"><h1>Atelier des assets</h1><p>Scène de développement · aucun monde chargé</p></div><div class="catalog-toolbar"><label>Texture <select id="catalog-style"><option value="origami">Gouache</option><option value="default">Pastel</option></select></label><button id="catalog-all" class="primary">Tout voir</button><button id="catalog-above">Vue du dessus</button><label><input id="catalog-labels" type="checkbox" checked>Noms au zoom</label><label><input id="catalog-floor" type="checkbox" checked>Repères</label></div></header><div class="catalog-body"><aside class="catalog-sidebar"><div class="catalog-search"><input id="catalog-search" type="search" placeholder="Rechercher et rejoindre…" aria-label="Rechercher un asset"><div id="catalog-count" class="catalog-count">Préparation du catalogue…</div><div class="catalog-legend"><span class="catalog-tag reference">Référence</span><span class="catalog-tag origami">Modèle commun</span><span class="catalog-tag default">Recette existante</span></div></div><nav id="catalog-nav" class="catalog-nav" aria-label="Types d’assets"></nav><div id="catalog-inventory" class="catalog-inventory"></div><div id="catalog-detail" class="catalog-detail"></div></aside><section id="catalog-stage" class="catalog-stage" aria-label="Catalogue des modèles 3D"><div id="catalog-overlay" class="catalog-labels" aria-hidden="true"></div><div class="catalog-status"><span id="catalog-message" class="message">Chargement…</span><span class="instructions">Glisser : tourner · molette : zoomer<br>Clic droit / deux doigts : déplacer</span></div><div id="catalog-loading" class="catalog-loading"><div><strong>Préparation de l’atelier</strong><span id="catalog-loading-text">Ouverture des recettes graphiques…</span></div></div><pre id="catalog-error" class="catalog-error" hidden></pre></section></div></main>`;
const $=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const stage=$<HTMLElement>('catalog-stage'),overlay=$('catalog-overlay'),loading=$('catalog-loading'),errorView=$('catalog-error');
const styleControl=$<HTMLSelectElement>('catalog-style'),search=$<HTMLInputElement>('catalog-search'),labelsControl=$<HTMLInputElement>('catalog-labels'),floorControl=$<HTMLInputElement>('catalog-floor');
const previewPreferences:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES};
const paintSettings=document.createElement('details');paintSettings.className='catalog-paint-settings';
const paintSummary=document.createElement('summary');paintSummary.textContent='Réglages Gouache';paintSettings.append(paintSummary);
const paintInputs:HTMLInputElement[]=[];let paintRefreshTimer:ReturnType<typeof setTimeout>|undefined;
for(const control of ORIGAMI_STYLE_CONTROLS){
  const label=document.createElement('label'),text=document.createElement('span');text.textContent=control.label;
  const input=document.createElement('input');input.type='range';input.id=`catalog-${control.key}`;input.min=String(control.min);input.max=String(control.max);input.step=String(control.step);input.value=String(previewPreferences[control.key]);input.setAttribute('aria-label',control.label);
  const output=document.createElement('output');output.setAttribute('for',input.id);const show=()=>{output.value=formatOrigamiStyleValue(control,Number(input.value));};show();
  input.oninput=()=>{
    if(busy||closed)return;
    previewPreferences[control.key]=Number(input.value);show();
    if(paintRefreshTimer){clearTimeout(paintRefreshTimer);paintRefreshTimer=undefined;}
    if(context){const next={...previewPreferences,style:context.preferences.style};paintRefreshTimer=setTimeout(()=>{paintRefreshTimer=undefined;void refreshPaint(next);},80);}
  };
  label.append(text,input,output);paintSettings.append(label);paintInputs.push(input);
}
$('catalog-nav').before(paintSettings);
const scopeNote=document.createElement('p');scopeNote.className='catalog-subtle';scopeNote.textContent='Modèles et objets disponibles ; effets animés transitoires exclus.';$('catalog-count').parentElement!.append(scopeNote);
const statusNames:Record<CatalogStatus,string>={reference:'Référence',origami:'Modèle commun',default:'Recette existante'};
const renderer=new ReentrantRenderer({antialias:true,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
const scene=new THREE.Scene();scene.background=new THREE.Color('#d7c8aa');
scene.add(new THREE.HemisphereLight(0xfff5e4,0x3d352e,1.15));
const sunlight=new THREE.DirectionalLight(0xfff0d6,2.3);sunlight.position.set(12,16,12);scene.add(sunlight);
const rim=new THREE.DirectionalLight(0x93c5fd,.65);rim.position.set(-12,8,-10);scene.add(rim);
const camera=new THREE.PerspectiveCamera(42,1,.05,10000);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.10;controls.maxPolarAngle=Math.PI*.485;controls.minDistance=.7;controls.maxDistance=5000;controls.screenSpacePanning=true;controls.zoomToCursor=true;
const catalogRoot=new THREE.Group();catalogRoot.name='Development asset catalog — presentation only';scene.add(catalogRoot);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshStandardNodeMaterial({color:'#d8ccb4',roughness:1,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
let grid:THREE.GridHelper|undefined;
type Entry={item:CatalogItem;section:CatalogSection;label:HTMLDivElement;searchText:string};
let collections:CatalogCollection[]=[],sections:CatalogSection[]=[],entries:Entry[]=[],context:GraphicsStyleContext|undefined,selected:Entry|undefined;
let wholeBounds=new THREE.Box3(new THREE.Vector3(-10,0,-10),new THREE.Vector3(10,2,10));
let sectionLabels:{section:CatalogSection;element:HTMLDivElement;anchor:THREE.Vector3}[]=[];
let frame:number|undefined,busy=false,closed=false,resizePending=false,catalogCleanupFailed=false,jobEpoch=0,activeJob:Promise<void>|undefined,initialization:Promise<void>|undefined;
const preparationFrames=new Map<number,()=>void>(),quarantinedCollections:CatalogCollection[]=[];
const failures:string[]=[];
const diagnostics:{ready:boolean;style:string;assets:number;sections:{id:string;label:string;count:number;missing:unknown[]}[];errors:string[];scope:string;backend?:unknown;trees?:unknown[]}={ready:false,style:'origami',assets:0,sections:[],errors:failures,scope:'Models, objects and content recipes; animated transient VFX, selection/designation overlays and generated landscapes are excluded. No simulation or campaign.'};
function fail(cause:unknown):void{const message=cause instanceof Error?cause.stack??cause.message:String(cause);failures.push(message);errorView.hidden=false;errorView.textContent=failures.join('\n\n');$('catalog-message').textContent='Le catalogue a rencontré une erreur ; le détail est conservé ci-dessus.';diagnostics.ready=false;document.body.dataset.ready='error';}
renderer.onError=fail;renderer.onDeviceLost=info=>fail(info.message);
window.addEventListener('error',event=>fail(event.error??event.message));window.addEventListener('unhandledrejection',event=>fail(event.reason));
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const nextFrame=()=>new Promise<void>(resolve=>{const frame=requestAnimationFrame(()=>{preparationFrames.delete(frame);resolve();});preparationFrames.set(frame,resolve);});
function lock(value:boolean):void{styleControl.disabled=value;$<HTMLButtonElement>('catalog-all').disabled=value;$<HTMLButtonElement>('catalog-above').disabled=value;search.disabled=value;labelsControl.disabled=floorControl.disabled=value;for(const input of paintInputs)input.disabled=value||styleControl.value!=='origami';}
function progress(message:string):void{$('catalog-loading-text').textContent=message;$('catalog-message').textContent=message;}
function disposeCatalog():void{
  if(catalogCleanupFailed)throw Error('Catalog cleanup is quarantined; paint context remains owned');
  const errors:unknown[]=[];for(const collection of collections)try{collection.dispose();}catch(error){errors.push(error);quarantinedCollections.push(collection);}collections=[];sections=[];entries=[];sectionLabels=[];selected=undefined;catalogRoot.clear();overlay.replaceChildren();$('catalog-detail').replaceChildren();if(!errors.length){try{context?.dispose();}catch(error){errors.push(error);}if(!errors.length)context=undefined;}if(errors.length){catalogCleanupFailed=true;throw new AggregateError(errors,'Catalog cleanup failed; unresolved owners retained');}
}
function worldBox(entry:Entry):THREE.Box3{return entry.item.bounds.clone().applyMatrix4(entry.section.group.matrixWorld);}
function sectionBox(section:CatalogSection):THREE.Box3{const box=new THREE.Box3();for(const item of section.items)box.union(item.bounds);if(box.isEmpty())box.set(new THREE.Vector3(-6,0,0),new THREE.Vector3(6,1,4));return box.applyMatrix4(section.group.matrixWorld);}
function focus(box:THREE.Box3,above=false,internal=false):void{
  if(closed||busy&&!internal)return;
  const center=box.getCenter(new THREE.Vector3()),sphere=box.getBoundingSphere(new THREE.Sphere()),radius=Math.max(.65,sphere.radius);
  const fitAspect=Math.min(1,camera.aspect),distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov*.5))*1.12/fitAspect;
  const direction=above?new THREE.Vector3(.001,1,.001).normalize():new THREE.Vector3(.34,.83,1).normalize();
  controls.target.copy(center);camera.position.copy(center).addScaledVector(direction,distance);controls.minDistance=Math.max(.3,Math.min(radius*.2,1));controls.update();requestRender();
}
function showEntryDetails(entry:Entry):void{
  const detail=$('catalog-detail');detail.replaceChildren();const heading=document.createElement('h2');heading.textContent=entry.item.label;detail.append(heading);
  const tag=document.createElement('span');tag.className=`catalog-tag ${entry.item.status}`;tag.textContent=statusNames[entry.item.status];detail.append(tag);
  const identifier=document.createElement('p'),code=document.createElement('code');code.textContent=entry.item.id;identifier.append(code);detail.append(identifier);
  const note=document.createElement('p');note.textContent=entry.item.note??entry.section.note??'Recette de présentation actuellement disponible dans le catalogue.';detail.append(note);
  const button=document.createElement('button');button.textContent='Rejoindre ce modèle';button.onclick=()=>focus(worldBox(entry));detail.append(button);
}
function selectEntry(entry:Entry,internal=false):void{
  if(closed||busy&&!internal)return;
  selected=entry;showEntryDetails(entry);focus(worldBox(entry),false,internal);renderInventory();
}
function renderInventory():void{
  const query=normalize(search.value.trim()),inventory=$('catalog-inventory'),fragment=document.createDocumentFragment();let matches=0;
  for(const section of sections){
    const rows=entries.filter(entry=>entry.section===section&&(!query||entry.searchText.includes(query)));if(!rows.length&&query)continue;
    const heading=document.createElement('h2');heading.className='catalog-section-heading';const button=document.createElement('button');button.textContent=section.label;button.onclick=()=>focus(sectionBox(section));const count=document.createElement('small');count.textContent=String(rows.length);heading.append(button,count);fragment.append(heading);
    for(const entry of rows){matches++;const button=document.createElement('button');button.className='catalog-entry';button.setAttribute('aria-current',String(selected===entry));button.title=[entry.item.label,entry.item.id,entry.item.note??''].filter(Boolean).join('\n');button.onclick=()=>selectEntry(entry);
      const text=document.createElement('span');text.className='entry-name';text.textContent=entry.item.label;const badge=document.createElement('span');badge.className=`catalog-tag ${entry.item.status}`;badge.textContent=statusNames[entry.item.status];button.append(text,badge);fragment.append(button);}
    if(!query&&section.missing?.length){const missing=document.createElement('details');missing.className='catalog-missing';const summary=document.createElement('summary');summary.textContent=`${section.missing.length} définition${section.missing.length>1?'s':''} sans modèle disponible`;missing.append(summary);for(const item of section.missing){const row=document.createElement('p');row.textContent=`${item.label} — ${item.reason}`;const id=document.createElement('code');id.textContent=item.id;row.append(document.createElement('br'),id);missing.append(row);}fragment.append(missing);}
  }
  if(!matches){const empty=document.createElement('p');empty.className='catalog-empty';empty.textContent='Aucun nom ou identifiant ne correspond.';fragment.append(empty);}
  inventory.replaceChildren(fragment);
  const missing=sections.reduce((total,section)=>total+(section.missing?.length??0),0);$('catalog-count').textContent=query?`${matches} résultat${matches>1?'s':''} · la scène reste complète`:`${entries.length} assets visibles · ${sections.length} groupes${missing?` · ${missing} sans modèle`:''}`;
}
function layout():void{
  wholeBounds.makeEmpty();entries=[];sectionLabels=[];overlay.replaceChildren();
  const nav=$('catalog-nav');nav.replaceChildren();
  const shelves=sections.map(section=>{const bounds=new THREE.Box3();for(const item of section.items)bounds.union(item.bounds);if(bounds.isEmpty())bounds.set(new THREE.Vector3(-6,0,0),new THREE.Vector3(6,1,4));return {section,bounds,size:bounds.getSize(new THREE.Vector3())};});
  const gap=10,area=shelves.reduce((sum,{size})=>sum+(size.x+gap)*(Math.max(6,size.z)+gap),0),width=Math.max(...shelves.map(({size})=>size.x),Math.sqrt(area*1.35));
  let x=0,z=0,rowDepth=0;
  for(const {section,bounds,size}of shelves){
    if(x>0&&x+size.x>width){x=0;z+=rowDepth+gap;rowDepth=0;}
    section.group.position.set(x-bounds.min.x,0,z-bounds.min.z);catalogRoot.add(section.group);section.group.updateMatrixWorld(true);const placed=bounds.clone().applyMatrix4(section.group.matrixWorld);wholeBounds.union(placed);x+=size.x+gap;rowDepth=Math.max(rowDepth,Math.max(6,size.z));
    const title=document.createElement('div');title.className='catalog-label section-label';title.textContent=`${section.label} · ${section.items.length}`;overlay.append(title);sectionLabels.push({section,element:title,anchor:new THREE.Vector3(placed.min.x+.5,.1,placed.min.z-1.6)});
    const navButton=document.createElement('button');navButton.textContent=`${section.label} ${section.items.length}`;navButton.onclick=()=>focus(sectionBox(section));nav.append(navButton);
    for(const item of section.items){const label=document.createElement('div');label.className='catalog-label';label.textContent=item.label;overlay.append(label);entries.push({item,section,label,searchText:normalize(`${item.id} ${item.label} ${item.note??''} ${section.label} ${statusNames[item.status]}`)});}
  }
  if(wholeBounds.isEmpty())wholeBounds.set(new THREE.Vector3(-10,0,-10),new THREE.Vector3(10,2,10));
  const size=wholeBounds.getSize(new THREE.Vector3()),center=wholeBounds.getCenter(new THREE.Vector3());floor.scale.set(size.x+10,size.z+10,1);floor.position.set(center.x,-.035,center.z);
  if(grid){scene.remove(grid);grid.geometry.dispose();const material=grid.material;for(const m of Array.isArray(material)?material:[material])m.dispose();}
  const gridSize=Math.max(size.x,size.z)+10;grid=new THREE.GridHelper(gridSize,Math.max(10,Math.min(500,Math.ceil(gridSize/2))),0xb5a17a,0xc4b493);grid.position.set(center.x,-.025,center.z);scene.add(grid);grid.visible=floorControl.checked;floor.visible=floorControl.checked;
  renderInventory();diagnostics.assets=entries.length;diagnostics.sections=sections.map(section=>({id:section.id,label:section.label,count:section.items.length,missing:section.missing??[]}));
}
const projected=new THREE.Vector3(),anchor=new THREE.Vector3(),bottom=new THREE.Vector3(),cameraPoint=new THREE.Vector3();
function labels():void{
  const width=stage.clientWidth,height=stage.clientHeight,candidates:{entry:Entry;x:number;y:number;distance:number;size:number}[]=[];
  for(const entry of entries){entry.label.style.display='none';if(!labelsControl.checked)continue;anchor.copy(entry.item.position).applyMatrix4(entry.section.group.matrixWorld);projected.copy(anchor).project(camera);if(projected.z<0||projected.z>1||Math.abs(projected.x)>1.05||Math.abs(projected.y)>1.05)continue;
    bottom.copy(anchor);bottom.y=entry.item.bounds.min.y+entry.section.group.position.y;bottom.project(camera);const pixels=Math.abs(bottom.y-projected.y)*height*.5;if(pixels<11&&entry!==selected)continue;
    cameraPoint.copy(anchor);candidates.push({entry,x:(projected.x*.5+.5)*width,y:(-.5*projected.y+.5)*height,distance:cameraPoint.distanceToSquared(camera.position),size:pixels});}
  candidates.sort((a,b)=>Number(b.entry===selected)-Number(a.entry===selected)||a.distance-b.distance);const occupied:{x:number;y:number}[]=[];
  for(const candidate of candidates){if(occupied.length>=100)break;if(candidate.entry!==selected&&occupied.some(at=>Math.abs(at.x-candidate.x)<84&&Math.abs(at.y-candidate.y)<20))continue;const label=candidate.entry.label;label.style.display='block';label.style.left=`${candidate.x}px`;label.style.top=`${candidate.y}px`;label.classList.toggle('selected',candidate.entry===selected);occupied.push({x:candidate.x,y:candidate.y});}
  const titles:{x:number;y:number;width:number}[]=[];
  for(const heading of [...sectionLabels].sort((a,b)=>b.section.items.length-a.section.items.length)){projected.copy(heading.anchor).project(camera);const x=(projected.x*.5+.5)*width,y=(-.5*projected.y+.5)*height,titleWidth=Math.min(340,(heading.element.textContent?.length??0)*7+24);
    const visible=labelsControl.checked&&projected.z>=0&&projected.z<=1&&Math.abs(projected.x)<1.1&&Math.abs(projected.y)<1.1&&!titles.some(other=>Math.abs(other.x-x)<(other.width+titleWidth)/2+8&&Math.abs(other.y-y)<30);
    heading.element.style.display=visible?'block':'none';if(visible){heading.element.style.left=`${x}px`;heading.element.style.top=`${y}px`;titles.push({x,y,width:titleWidth});}}
}
function requestRender():void{if(frame!==undefined||closed||busy)return;frame=requestAnimationFrame(()=>{frame=undefined;if(closed||busy)return;try{const moved=controls.update();renderer.render(scene,camera);labels();if(moved)requestRender();}catch(cause){fail(cause);}});}
controls.addEventListener('change',requestRender);
function resize():void{if(closed)return;if(busy){resizePending=true;return;}resizePending=false;const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight);renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestRender();}
const resizeObserver=new ResizeObserver(resize);
function arrange():void{
    sections=collections.flatMap(collection=>collection.sections);layout();focus(wholeBounds,false,true);
    diagnostics.trees=collections.flatMap(collection=>collection.treeStatus?[collection.treeStatus()]:[]);
}
function exclusiveCatalogJob(work:(assertCurrent:()=>void)=>Promise<void>):Promise<void>{
  if(closed)return Promise.resolve();if(catalogCleanupFailed){fail(Error('Une préparation précédente conserve des ressources non libérées ; rechargez l’atelier.'));return Promise.resolve();}if(busy)return activeJob??Promise.resolve();
  busy=true;const epoch=++jobEpoch;lock(true);controls.enabled=false;loading.hidden=false;diagnostics.ready=false;document.body.dataset.ready='preparing';if(frame!==undefined){cancelAnimationFrame(frame);frame=undefined;}
  const assertCurrent=()=>{if(closed||jobEpoch!==epoch)throw Error('Catalog preparation superseded');};
  const task=Promise.resolve().then(()=>{assertCurrent();return work(assertCurrent);}).catch(cause=>{if(!closed)fail(cause);}).finally(()=>{activeJob=undefined;busy=false;if(!closed){controls.enabled=true;loading.hidden=true;lock(false);if(resizePending)resize();else requestRender();}});activeJob=task;return task;
}
async function prepareTrees(graphics:GraphicsStyleContext,assertJobCurrent:()=>void):Promise<void>{
  const assertCurrent=()=>{assertJobCurrent();if(context!==graphics)throw Error('Catalog paint context changed');};
  assertCurrent();graphics.flushPaint();
  for(const collection of collections){await collection.prepareTrees?.(renderer,camera,scene,assertCurrent);assertCurrent();}
}
async function finishView(assertCurrent:()=>void,prepared=false):Promise<void>{
  if(!prepared){progress('Préparation des matériaux de cette vue…');await nextFrame();assertCurrent();for(const texture of context!.prepareSharedSurfaceAssets())renderer.initTexture(texture);await renderer.compileAsync(scene,camera);assertCurrent();}
  renderer.render(scene,camera);labels();diagnostics.ready=failures.length===0;document.body.dataset.ready=diagnostics.ready?'ready':'error';$('catalog-message').textContent=`${entries.length} assets agencés par type · texture ${context!.origami?'Gouache':'Pastel'}\nRechercher un nom ou choisir un groupe pour s’en approcher.`;
}
function build(style:GraphicsStyle):Promise<void>{
  return exclusiveCatalogJob(async assertCurrent=>{
    if(paintRefreshTimer){clearTimeout(paintRefreshTimer);paintRefreshTimer=undefined;}
    disposeCatalog();const graphics=context=new GraphicsStyleContext({...previewPreferences,style});diagnostics.style=style;
    progress('Humains, animaux et variantes disponibles…');await nextFrame();assertCurrent();collections.push(withGraphicsStyle(graphics,()=>createActorCatalog(graphics)));
    progress('Végétation, mobilier, fragments et objets…');await nextFrame();assertCurrent();collections.push(withGraphicsStyle(graphics,()=>createEnvironmentAssetCatalog(graphics)));
    collections.push(withGraphicsStyle(graphics,()=>createTransportAssetCatalog()));
    progress('Préparation des arbres partagés…');await prepareTrees(graphics,assertCurrent);assertCurrent();arrange();await finishView(assertCurrent);
  });
}
function refreshPaint(next:GraphicsStylePreferences):Promise<void>{
  if(paintRefreshTimer){clearTimeout(paintRefreshTimer);paintRefreshTimer=undefined;}
  const graphics=context;if(!graphics)return Promise.resolve();
  return exclusiveCatalogJob(async assertCurrent=>{
    progress('Actualisation des textures et des contours…');await nextFrame();assertCurrent();
    try{await changeCatalogSurface(graphics,next,collections,{renderer,scene,camera,assertCurrent});}
    finally{
      Object.assign(previewPreferences,graphics.preferences);styleControl.value=graphics.preferences.style;
      for(const[i,input]of paintInputs.entries()){const control=ORIGAMI_STYLE_CONTROLS[i]!;input.value=String(graphics.preferences[control.key]);(input.nextElementSibling as HTMLOutputElement).value=formatOrigamiStyleValue(control,graphics.preferences[control.key]);}
    }
    diagnostics.style=graphics.preferences.style;diagnostics.trees=collections.flatMap(collection=>collection.treeStatus?[collection.treeStatus()]:[]);
    const currentItems=new Map(sections.flatMap(section=>section.items.map(item=>[item.id,item] as const)));
    for(const entry of entries)entry.item=currentItems.get(entry.item.id)??entry.item;
    if(selected)showEntryDetails(selected);renderInventory();await finishView(assertCurrent,true);
  });
}
styleControl.onchange=()=>void refreshPaint({...previewPreferences,style:styleControl.value as GraphicsStyle});$('catalog-all').onclick=()=>{selected=undefined;focus(wholeBounds);renderInventory();};$('catalog-above').onclick=()=>focus(selected?worldBox(selected):wholeBounds,true);
search.addEventListener('input',renderInventory);search.addEventListener('keydown',event=>{if(event.key==='Escape'){search.value='';renderInventory();}});labelsControl.onchange=requestRender;floorControl.onchange=()=>{floor.visible=floorControl.checked;if(grid)grid.visible=floorControl.checked;requestRender();};
Object.assign(window,{assetCatalog:{diagnostics,overview:()=>focus(wholeBounds),focus:(id:string)=>{if(busy||closed)return false;const entry=entries.find(entry=>entry.item.id===id);if(entry)selectEntry(entry);return !!entry;},setStyle:(style:GraphicsStyle)=>{if(busy||closed)return activeJob??Promise.resolve();styleControl.value=style;return refreshPaint({...previewPreferences,style});},inventory:()=>sections.map(section=>({id:section.id,label:section.label,items:section.items.map(({id,label,status,note})=>({id,label,status,note})),missing:section.missing??[]}))}});
async function init(){await renderer.init();if(closed)return;stage.prepend(renderer.domElement);const backend=renderer.backend as unknown as {isWebGPUBackend?:boolean;device?:{limits?:{maxVertexAttributes?:number}}};diagnostics.backend={webgpu:backend.isWebGPUBackend===true,name:renderer.backend.constructor.name,maxVertexAttributes:backend.device?.limits?.maxVertexAttributes};resizeObserver.observe(stage);resize();const requested=new URLSearchParams(location.search).get('style');styleControl.value=requested==='default'?'default':'origami';await build(styleControl.value as GraphicsStyle);}
window.addEventListener('pagehide',()=>{
  if(closed)return;closed=true;jobEpoch++;if(paintRefreshTimer)clearTimeout(paintRefreshTimer);if(frame!==undefined)cancelAnimationFrame(frame);for(const [frame,resolve]of preparationFrames){cancelAnimationFrame(frame);resolve();}preparationFrames.clear();resizeObserver.disconnect();controls.enabled=false;
  // An in-flight compile/bake still owns the renderer and its borrowed paint.
  // Cancellation is checked at each await; destruction starts after settlement.
  void Promise.allSettled([activeJob,initialization]).then(async()=>{const errors:unknown[]=[];for(const dispose of [()=>controls.dispose(),disposeCatalog,()=>floor.geometry.dispose(),()=>{(floor.material as THREE.Material).dispose();},()=>{if(grid){grid.geometry.dispose();for(const material of Array.isArray(grid.material)?grid.material:[grid.material])material.dispose();}}])try{dispose();}catch(error){errors.push(error);}try{await renderer.dispose();}catch(error){errors.push(error);}if(errors.length)fail(new AggregateError(errors,'Catalog page cleanup failed'));});
});
initialization=init().catch(cause=>{if(!closed)fail(cause);});
