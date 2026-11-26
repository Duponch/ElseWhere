/// <reference lib="webworker" />
import type {Texture} from 'three/webgpu';
import {applySceneTexture} from './apply-texture';
import {decodeStoredSave} from '../../ui/save-storage-codec';
import {SceneSimulation} from './simulation';
import {WorkerColonyScene} from './scene';
import type {SceneReply,SceneRequest,SceneSize,WorkerColonyState} from './protocol';

const scope=self as unknown as DedicatedWorkerGlobalScope;
const send=(event:SceneReply)=>scope.postMessage(event);
const size:SceneSize={width:1,height:1,pixelRatio:1};
let simulation:SceneSimulation|undefined, scene:WorkerColonyScene|undefined;
let surface:OffscreenCanvas|undefined;
let pendingPick:number|undefined;
let ready=false,hidden=false,opening=false,failed=false,lastStats=0,lastCameraRead=-Infinity;
let nextImage=1;
const images=new Map<number,{resolve:(image:ImageBitmap)=>void;reject:(reason:Error)=>void}>();
const initialImages:Promise<void>[]=[];
function stopPick():void {
  if(scene)scene.afterPickDraw=undefined;
  pendingPick=undefined;
}
function samplePick(request:Extract<SceneRequest,{type:'pick'}>):void {
  stopPick();
  const view=scene,canvas=surface,{id,u,v}=request;
  if(!ready||!view||!canvas||hidden||!(u>=0&&u<1&&v>=0&&v<1)
    ||size.width!==request.size.width||size.height!==request.size.height||size.pixelRatio!==request.size.pixelRatio){
    send({type:'pick-unavailable',id,message:'La vue a changé. Clique de nouveau.'});return;
  }
  pendingPick=id;
  view.afterPickDraw=()=>{
    stopPick();
    let bitmap:ImageBitmap|undefined;
    try{
      const pick=view.readPick(u,v,size);
      // The copy and the hit read are synchronous in this exact render
      // submission. A transfer on the live canvas itself would clear it.
      const copy=new OffscreenCanvas(canvas.width,canvas.height),ink=copy.getContext('2d');
      if(!ink)throw Error('La copie de l’image est indisponible.');
      ink.drawImage(canvas,0,0);
      bitmap=copy.transferToImageBitmap();
      scope.postMessage({type:'pick-image',id,pick,bitmap} satisfies SceneReply,[bitmap]);bitmap=undefined;
    }catch(error){send({type:'pick-unavailable',id,message:error instanceof Error?error.message:String(error)});}
    finally{bitmap?.close();}
  };
}

function fatal(reason:unknown):void {
  if(failed)return;
  failed=true;ready=false;stopPick();
  const message=reason instanceof Error?reason.message:String(reason);
  send({type:'fatal',message});
  for(const waiter of images.values())waiter.reject(Error(message));
  images.clear();
  try{simulation?.dispose();}finally{scene?.dispose();}
}

function state():void {
  if(!ready||!simulation||!scene)return;
  const queue=simulation.queue.diagnostics();
  const value:WorkerColonyState={
    sampledAt:performance.now(),
    tick:simulation.full!.world.tick,core:simulation.core,speed:simulation.speed,
    frames:scene.submissions,fps:scene.stats.fps,fulls:simulation.fulls,phases:simulation.phases,
    queueDepth:queue.depth,queueMax:queue.maxDepth,overflow:queue.overflow,
    drawCalls:scene.stats.drawCalls,triangles:scene.stats.triangles,
    width:size.width,height:size.height,camera:scene.captureGraphicsView(),
  };
  send({type:'state',state:value});lastStats=value.sampledAt;
}

function frame(now:number):void {
  if(!ready||!scene||!simulation||hidden)return;
  try {
    const client=simulation;
    scene.frameWithAdmissions(now,()=>client.queue.drainFrame());
    if(now-lastCameraRead>=100){
      lastCameraRead=now;client.setActualView301(scene.actualView(),now);
    }
    if(now-lastStats>=250)state();
    client.queue.notifyAvailability();
  }catch(error){fatal(error);}
}

function loadTexture(url:string,loaded:(texture:Texture)=>void,_progress:undefined,onError:()=>void):void {
  const id=nextImage++;
  const bitmap=new Promise<ImageBitmap>((resolve,reject)=>{images.set(id,{resolve,reject});});
  send({type:'texture',id,url});
  const job=applySceneTexture(bitmap,()=>failed,loaded,onError);
  if(!ready)initialImages.push(job);
  void job.catch(fatal);
}

async function open(message:Extract<SceneRequest,{type:'open'}>):Promise<void> {
  if(opening)throw Error('La scène est déjà ouverte.');
  opening=true;hidden=!message.visible;Object.assign(size,message.size);
  surface=message.canvas;
  send({type:'progress',message:'Chargement de la sauvegarde'});
  let stored:string;
  if(typeof message.save==='string'){
    const url=new URL(message.save);
    if(url.origin!==scope.location.origin)throw Error('Adresse de sauvegarde invalide.');
    const response=await fetch(url);
    if(!response.ok)throw Error('Sauvegarde indisponible (HTTP '+response.status+').');
    stored=await response.text();
  }else stored=await message.save.text();
  const data=await decodeStoredSave(stored);
  const client=new SceneSimulation();simulation=client;
  client.onError=fatal;client.onFault=fault=>fatal(fault.reason);
  await client.load(data);
  if(!client.full)throw Error('Cette sauvegarde ne contient aucune carte de colonie active.');
  if(client.speed!==0)await client.setSpeed(0);
  send({type:'progress',message:'Préparation de la carte et des textures'});
  const view=await WorkerColonyScene.open(message.canvas,size,()=>hidden,loadTexture,fatal,message.graphics);
  scene=view;
  if(failed){view.dispose();return;}
  const first=client.full;
  view.setWorld(first.world,true,first.speed,first.tracks,true,first.owner);
  if(client.lastPhase)view.setCorePhase297(client.lastPhase);
  // Install subsequent publications before crossing an asynchronous boundary.
  client.onFull=next=>view.setWorld(next.world,next.replaced,next.speed,next.tracks,true,next.owner,next.defer);
  client.onPhase=owner=>view.setCorePhase297(owner);
  await Promise.all(initialImages);await view.preparePresentation();await Promise.all(initialImages);
  initialImages.length=0;
  if(failed)return;
  ready=true;client.canRender=()=>ready&&!hidden&&view.ready;
  client.onStarvation=()=>view.suspendUntilNextFrame();
  view.animate(frame);client.queue.notifyAvailability();send({type:'ready',graphics:view.adapterInfo()});state();
}

scope.onmessage=({data}:MessageEvent<SceneRequest>)=>{
  if(failed){if(data.type==='texture')data.bitmap.close();return;}
  try{
    switch(data.type){
      case 'open':void open(data).catch(fatal);break;
      case 'texture':
      case 'texture-error':{
        const waiter=images.get(data.id);
        if(!waiter){if(data.type==='texture')data.bitmap.close();break;}
        images.delete(data.id);
        if(data.type==='texture')waiter.resolve(data.bitmap);else waiter.reject(Error(data.message));
        break;
      }
      case 'speed':{
        stopPick();
        const client=simulation;
        if(!client||!ready||(hidden&&data.speed!==0)||![0,1,3,6].includes(data.speed)){send({type:'ack',id:data.id,error:'Vitesse indisponible.'});break;}
        void client.setSpeed(data.speed,{explicit:true,token:client.getThreatPauseToken()}).then(()=>{if(!failed){state();send({type:'ack',id:data.id});}},error=>{
          if(!failed)send({type:'ack',id:data.id,error:String(error)});
        });
        break;
      }
      case 'pick':samplePick(data);break;
      case 'speed-hud':
        if(ready&&scene&&simulation){
          const client=simulation;
          scene.enableSpeedHud(data.uiScale,data.reducedMotion,size,()=>client.speed,hits=>
            scope.postMessage({type:'speed-hud-hits',hits} satisfies SceneReply,hits.buttons.flatMap(button=>button.vertices?[button.vertices.buffer as ArrayBuffer]:[])));
        }
        break;
      case 'speed-hud-pointer':scene?.speedHudPointer(data.hover,data.press);break;
      case 'cancel-pick':if(pendingPick===data.id)stopPick();break;
      case 'resize':stopPick();Object.assign(size,data.size);scene?.scaleAndResize(size.pixelRatio);break;
      case 'camera':stopPick();scene?.changeCamera(data.input);break;
      case 'visible':
        if(hidden===!data.visible)break;
        hidden=!data.visible;stopPick();
        scene?.visibilityChanged();
        if(hidden&&ready&&simulation){
          simulation.setActualView301(null);void simulation.setSpeed(0).then(state,fatal);
        }
        simulation?.queue.notifyAvailability();
        break;
    }
  }catch(error){fatal(error);}
};
