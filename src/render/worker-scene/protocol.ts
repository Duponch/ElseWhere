import type {MapObjectSelection} from '../../ui/map-object-selection';
import type {ColonyGraphicsPreferences} from '../colony-graphics-preferences';

export type ColonySpeed = 0 | 1 | 3 | 6;
export interface CameraInput {orbit?: number; panX?: number; panZ?: number; zoom?: number}
export interface SceneSize {width: number; height: number; pixelRatio: number}
export interface SpeedHudHits {
  width:number; height:number;
  buttons:{speed:ColonySpeed; transform:number[]; bounds:number[]; vertices?:Float32Array}[];
}
export type PickTarget=
 | {kind:'pawn'|'animal'|'mechanoid';id:number}
 | {kind:MapObjectSelection['kind'];id:number;x:number;z:number}
 | {kind:'terrain';x:number;z:number}
 | {kind:'outside'};
export interface PresentedPick {
  frame:number; tick:number; presentationTick:number; map:number;
  epoch?:number; revision?:number;
  camera:WorkerColonyState['camera']; viewport:SceneSize; u:number; v:number; target:PickTarget;
}
export interface PickImage {pick:PresentedPick;bitmap:ImageBitmap}
export interface WorkerColonyState {
  sampledAt: number;
  tick: number; core: number; speed: ColonySpeed; frames: number; fps: number;
  fulls: number; phases: number; queueDepth: number; queueMax: number; overflow: number;
  drawCalls: number; triangles: number; width: number; height: number;
  camera: {mode: string; position: number[]; target: number[]; zoom: number};
}
export type SceneRequest =
  | {type:'open'; canvas:OffscreenCanvas; save:File|string; size:SceneSize; visible:boolean; graphics?:ColonyGraphicsPreferences}
  | {type:'speed'; id:number; speed:ColonySpeed}
  | {type:'speed-hud'; uiScale:number; reducedMotion:boolean}
  | {type:'speed-hud-pointer'; hover:ColonySpeed|null; press:boolean}
  | {type:'camera'; input:CameraInput}
  | {type:'resize'; size:SceneSize}
  | {type:'visible'; visible:boolean}
  | {type:'pick'; id:number; u:number; v:number;size:SceneSize}
  | {type:'cancel-pick';id:number}
  | {type:'texture'; id:number; bitmap:ImageBitmap}
  | {type:'texture-error'; id:number; message:string};
export type SceneReply =
  | {type:'ready';graphics:{backend:'webgpu';vendor:string;architecture:string}}
  | {type:'speed-hud-hits';hits:SpeedHudHits}
  | {type:'state'; state:WorkerColonyState}
  | {type:'progress'|'fatal'; message:string}
  | {type:'ack'; id:number; error?:string}
  | ({type:'pick-image';id:number}&PickImage)
  | {type:'pick-unavailable';id:number;message:string}
  | {type:'texture'; id:number; url:string};

