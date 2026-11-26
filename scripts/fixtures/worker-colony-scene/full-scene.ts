import * as THREE from 'three/webgpu';
import {WorkerColonyScene} from '../../../src/render/worker-scene/scene';
import {SceneSimulation} from '../../../src/render/worker-scene/simulation';
import {decodeStoredSave} from '../../../src/ui/save-storage-codec';
import {hitActors} from '../../../src/render/PawnSelectionInput';
import {clickedMapObject} from '../../../src/ui/map-object-selection';
import type {World} from '../../../src/sim/types';
import {prepareWorkerAsset} from './simulation-asset';
import type {Draw} from './scene';

function readPickReference(view:WorkerColonyScene,world:World) {
  const width=768,height=512,actors=view.screenPawns();
  const visible=actors.filter(a=>a.x>8&&a.x<width-8&&a.y>8&&a.y<height-8);
  const actor=visible.find(a=>hitActors(actors,Math.round(a.x),Math.round(a.y)).length===1)
    ??visible.find(a=>hitActors(actors,Math.round(a.x),Math.round(a.y))[0]?.id===a.id);
  if(!actor)throw Error('No visible actor for the selection oracle.');
  const kind=world.wildlife?.animals.some(a=>a.id===actor.id)?'animal':world.mechanoids?.some(m=>m.id===actor.id)?'mechanoid':'pawn';
  const actorPoint={x:Math.round(actor.x),y:Math.round(actor.y),id:actor.id,kind};
  for(const [x,y] of [[384,256],[412,248],[327,223],[325,278],[472,173],[260,330]] as const){
    if(hitActors(actors,x,y).length)continue;
    const wall=view.wallAttachmentCellAt(x,y),model=wall?null:view.objectPickAt(x,y);
    const cell=wall??model?.cell;
    if(cell){
      const object=clickedMapObject(world,cell,undefined,model?.preferred);
      return {width,height,tick:world.tick,actor:actorPoint,map:{x,y,cell,object:object??null}};
    }
  }
  throw Error('No map target for the selection oracle.');
}

export async function openScene(canvas:HTMLCanvasElement|OffscreenCanvas,bitmapFor?:(url:string)=>Promise<ImageBitmap>){
  await prepareWorkerAsset();
  const response=await fetch('/les-forges.json');
  if(!response.ok)throw Error('Missing Les Forges: HTTP '+response.status);
  const client=new SceneSimulation();
  const fault=new Promise<never>((_,reject)=>{
    client.onError=message=>reject(Error(message));
    client.onFault=error=>reject(Error(error.reason));
  });
  await Promise.race([client.load(await decodeStoredSave(await response.text())),fault]);
  if(!client.full||client.speed!==0)throw Error('Expected the native paused Full');
  const {world,tracks,owner}=client.full;
  const jobs:Promise<void>[]=[],assets:string[]=[];
  const view=await WorkerColonyScene.open(canvas,{width:768,height:512,pixelRatio:1},()=>false,(url,loaded,_progress,failed)=>{
    const job=(async()=>{
      const texture=bitmapFor?new THREE.Texture(await bitmapFor(url)):await new THREE.TextureLoader().loadAsync(url);
      if(bitmapFor){
        const bitmap=texture.image as ImageBitmap;
        texture.flipY=false;texture.addEventListener('dispose',()=>bitmap.close());
      }
      texture.needsUpdate=true;loaded(texture);assets.push(url);
    })();
    void job.catch(failed);jobs.push(job);
  },message=>{throw Error(message);});
  view.setWorld(world,true,0,tracks,true,owner);
  await Promise.all(jobs);await view.preparePresentation();await Promise.all(jobs);
  const camera=view.captureGraphicsView(),[x,y,z]=camera.position,[tx,,tz]=camera.target;
  let pickReference:ReturnType<typeof readPickReference>|undefined;
  client.onFull=full=>view.setWorld(full.world,full.replaced,full.speed,full.tracks,true,full.owner,full.defer);
  client.onPhase=phase=>view.setCorePhase297(phase);
  return async({view:index,advanceHour,speedHud}:Draw)=>{
    if(advanceHour){
      await client.setDevMode(true,false);
      await client.command({type:'dev-action',action:'time-advance',args:{span:'hour'}});
      if(client.full?.world.tick!==world.tick+250)throw Error('Expected 250 confirmed native ticks.');
      await view.preparePresentation();await Promise.all(jobs);
    }
    const angle=index*.84;
    view.restoreGraphicsView({...camera,position:[tx+(x-tx)*Math.cos(angle)+(z-tz)*Math.sin(angle),y,tz-(x-tx)*Math.sin(angle)+(z-tz)*Math.cos(angle)]});
    if(speedHud){
      if(typeof document==='undefined'){
        let changed=true;
        view.enableSpeedHud(1,false,{width:768,height:512,pixelRatio:1},()=>client.speed,()=>{changed=true;});
        do{
          changed=false;
          await new Promise<void>(done=>setTimeout(done,25));
          view.frameWithAdmissions(performance.now(),()=>client.queue.drainFrame());
          await view.settleDevice();
        }while(changed);
      }else{
        const reference=(window as unknown as {makeNativeSpeedReference:typeof import('./speed-reference').makeNativeSpeedReference}).makeNativeSpeedReference;
        view.afterPickDraw=reference((view as unknown as {renderer:THREE.WebGPURenderer}).renderer,client.speed);
        view.frameWithAdmissions(performance.now(),()=>client.queue.drainFrame());await view.settleDevice();
      }
    }
    view.frameWithAdmissions(performance.now(),()=>client.queue.drainFrame());await view.settleDevice();
    if(!pickReference)pickReference=readPickReference(view,world);
    return {...view.census(),assets:assets.slice().sort(),worker:typeof document==='undefined',tick:client.full!.world.tick,core:client.core,camera:view.captureGraphicsView(),style:view.graphicsStyle.preferences.style,pickReference};
  };
}
