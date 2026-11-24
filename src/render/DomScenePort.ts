import * as THREE from 'three/webgpu';
import {CameraRig} from './CameraRig';
import {MapLabelsOverlay} from './MapLabelsOverlay';
import type {SceneRenderHostPort} from './scene-render-ports';

interface LocalInputOwner {
  selectionReady():boolean;
  selectionActive():boolean;
  cancelSelection():boolean;
  disposeSelection():void;
  disconnectResize():void;
  removeInputListeners():void;
  presentEnvironment?(camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,height:number,cellPixels:number):void;
  prepareEnvironmentForCompile?():()=>void;
  disposeEnvironment?():void;
}

/** DOM owner for the local path. A worker will need a separately qualified
 * input/asset protocol; this closure is never transferred or emulated there. */
export function createDomPort(host:HTMLElement,renderer:THREE.WebGPURenderer):{
  port:SceneRenderHostPort;bind(owner:LocalInputOwner):void;labels():MapLabelsOverlay;
} {
  let owner:LocalInputOwner|undefined,labels:MapLabelsOverlay|undefined;
  const canvas=renderer.domElement;
  const port:SceneRenderHostPort={
    now:()=>performance.now(),hidden:()=>document.hidden,
    backend:()=>renderer.getContext() instanceof WebGL2RenderingContext?'WebGL 2':'WebGPU',
    pixelRatio:()=>window.devicePixelRatio,
    attachSurface(backend){
      canvas.setAttribute('aria-label','Carte 3D de la colonie');canvas.dataset.testid='world-canvas';
      if(import.meta.env.DEV){
        const context=renderer.getContext() as GPUCanvasContext|WebGL2RenderingContext;
        const device='getConfiguration' in context?context.getConfiguration()?.device:undefined;
        const info=device?.adapterInfo;
        console.info('Lisière renderer diagnostics',JSON.stringify({backend,context:context.constructor.name,
          browser:navigator.userAgent,adapter:info?{vendor:info.vendor,architecture:info.architecture,device:info.device,description:info.description}:null,
          maxVertexBuffers:device?.limits.maxVertexBuffers??null}));
      }
      canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;outline:none';
      canvas.tabIndex=0;host.appendChild(canvas);labels=new MapLabelsOverlay();
    },
    createCamera:()=>new CameraRig(canvas),
    viewport:()=>({width:host.clientWidth,height:host.clientHeight}),
    surfaceRect:()=>canvas.getBoundingClientRect(),
    selectionReady:()=>owner?.selectionReady()??false,
    selectionActive:()=>owner?.selectionActive()??false,
    cancelSelection:()=>owner?.cancelSelection()??false,
    disposeSelection:()=>owner?.disposeSelection(),
    releasePointer(id){if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);},
    canMoveCamera:()=>!(host.closest('[inert]')||document.querySelector('dialog[open]')),
    cursor(value){canvas.style.cursor=value;},title(value){canvas.title=value;},
    drawLabels:(world,camera,cellPixels,width,height,explorationRevision)=>{labels!.draw(world,camera,cellPixels,width,height,explorationRevision);owner?.presentEnvironment?.(camera,height,cellPixels);},
    prepareLabelsForCompile:()=>{const restore=labels!.prepareForCompile(),environment=owner?.prepareEnvironmentForCompile?.();return ()=>{restore();environment?.();};},
    disconnectResize:()=>owner?.disconnectResize(),removeInputListeners:()=>owner?.removeInputListeners(),
    disposeLabels:()=>{labels?.dispose();owner?.disposeEnvironment?.();},removeSurface:()=>canvas.remove(),
    // The exact loaded Texture instance is delivered unchanged to the resident
    // layer. Its existing disposed guard, texture options and ownership remain.
    loadTexture:(url,onLoad,onProgress,onError)=>new THREE.TextureLoader().load(url,onLoad,onProgress,onError),
  };
  return {port,bind(next){if(owner)throw Error('Local host port already bound.');owner=next;},
    labels(){if(!labels)throw Error('Local surface was not initialized.');return labels;}};
}
