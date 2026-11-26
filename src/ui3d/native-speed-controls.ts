import * as THREE from 'three/webgpu';
import {applyNativeHudButtonPose,drawNativeSpeedIcon} from './native-hud-art';
import type {ColumnRect} from './native-hud-rimworld';
import {PALETTE,type CardboardPiece,type CardboardPieceOptions} from './prototype-art';

const speeds = [
  {speed: 0, title: 'Pause'},
  {speed: 1, title: 'Lecture ×1'},
  {speed: 3, title: 'Vitesse ×3'},
  {speed: 6, title: 'Vitesse ×6'}
] as const;

export type NativeSpeed=typeof speeds[number]['speed'];
export const nativeTimeBottom=(bottomDockHeight:number)=>30+Math.max(0,bottomDockHeight-96);

export function createNativeSpeedButtons(rectangles:readonly ColumnRect[],group:THREE.Group,make:(options:CardboardPieceOptions)=>CardboardPiece,
  selected:()=>number,activate:(speed:NativeSpeed)=>void):CardboardPiece[] {
  return speeds.map((cfg,index)=>{
    const rect=rectangles[index]!;
    const piece=make({w:rect.width/100,h:rect.height/100,depth:.03,bgColor:PALETTE.kraftBase,bevel:.02,hasBorder:false,
      seed:310+index*23,interactive:true,tooltip:cfg.title,drawFn:(ctx,w,h,rng)=>drawNativeSpeedIcon(ctx,w,h,cfg.speed,selected()===cfg.speed,rng),
      onClick:()=>activate(cfg.speed)});
    piece.userData.nativeId='hud:speed:'+cfg.speed;
    piece.userData.nativeToolbarPose=true;piece.userData.nativeActivePose=0;
    piece.setBaseTransform(-(rect.right+rect.width/2)/100,(rect.bottom+rect.height/2)/100,0,0);
    group.add(piece);return piece;
  });
}

export function selectNativeSpeed(buttons:readonly CardboardPiece[],speed:number,moving:Set<CardboardPiece>):void {
  buttons.forEach((piece,index)=>{
    const active=speeds[index]!.speed===speed;
    if(piece.userData.active===active)return;
    piece.userData.active=active;moving.add(piece);
    piece.redraw(undefined,active?PALETTE.terracotta:PALETTE.kraftBase);
  });
}

export function advanceNativeActivePoses(moving:Set<CardboardPiece>,deltaSeconds:number):boolean {
  let changed=false;
  for(const piece of moving){
    const target=Number(piece.userData.active),before=Number(piece.userData.nativeActivePose??0);
    const next=THREE.MathUtils.lerp(before,target,1-Math.exp(-Math.max(0,deltaSeconds)*16));
    piece.userData.nativeActivePose=Math.abs(next-target)<.001?target:next;
    changed=applyNativeHudButtonPose(piece)||changed;
    if(piece.userData.nativeActivePose===target)moving.delete(piece);
  }
  return changed;
}
