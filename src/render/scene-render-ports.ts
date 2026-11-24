import type * as THREE from 'three/webgpu';
import type {CameraMode} from './CameraRig';
import type {World} from '../sim/types';

/** Local adapter returns the existing CameraRig itself: no second camera state
 * and no projection/navigation equations copied into the scene core. */
export interface SceneCameraPort {
  readonly orthographic:THREE.OrthographicCamera;
  readonly perspective:THREE.PerspectiveCamera;
  readonly camera:THREE.OrthographicCamera|THREE.PerspectiveCamera;
  readonly controls:{target:THREE.Vector3;enabled:boolean;update():unknown};
  readonly span:number;
  readonly mode:CameraMode;
  pageZoom?(direction:'in'|'out'):void;
  setMode(mode:CameraMode):void;
  setRoomEnabled?(enabled:boolean):void;
  constrainRoom?():boolean;
  configureMap(width:number,height:number,landing?:{x:number;z:number}):void;
  resize(width:number,height:number):void;
  pixelsPerCell(height:number):number;
  dispose():void;
}
export interface SceneSurfaceRect {left:number;top:number;width:number;height:number}
export type SceneTextureLoader=(url:string,onLoad:(texture:THREE.Texture)=>void,onProgress:undefined,onError:()=>void)=>unknown;
export interface RendererLifetime {closed:boolean}

/** Explicit synchronous local boundary, not a postMessage protocol. No World
 * validation/adoption capability is introduced by any of these methods. */
export interface SceneRenderHostPort {
  now():number;
  hidden():boolean;
  backend():string;
  pixelRatio():number;
  attachSurface(backend:string):void;
  createCamera():SceneCameraPort;
  viewport():{width:number;height:number};
  surfaceRect():SceneSurfaceRect;
  selectionReady():boolean;
  selectionActive():boolean;
  cancelSelection():boolean;
  disposeSelection():void;
  releasePointer(pointerId:number):void;
  canMoveCamera():boolean;
  cursor(value:string):void;
  title(value:string):void;
  drawLabels(world:World|null,camera:THREE.OrthographicCamera|THREE.PerspectiveCamera,cellPixels:number,width:number,height:number,explorationRevision?:number):void;
  prepareLabelsForCompile?():()=>void;
  disconnectResize():void;
  removeInputListeners():void;
  disposeLabels():void;
  removeSurface():void;
  readonly loadTexture:SceneTextureLoader;
}
