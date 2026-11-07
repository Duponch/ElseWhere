import {describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {WEATHER_KINDS} from '../src/sim/weather-definitions';
import {drawNativeSpeedIcon,drawNativeWeatherIcon,nativeWeatherIcon,nativeWeatherOutline,nativeHudButtonPose,applyNativeHudButtonPose} from '../src/ui3d/native-hud-art';
import {seededRandom,type CardboardPiece} from '../src/ui3d/prototype-art';

function ink(){
  const commands:unknown[][]=[],state=new Map<PropertyKey,unknown>(),stack:Array<Map<PropertyKey,unknown>>=[];
  const methods=new Set(['save','restore','scale','beginPath','moveTo','lineTo','closePath','fill','stroke','arc']);
  const ctx=new Proxy({}, {get(_target,key){if(typeof key==='string'&&methods.has(key))return(...args:unknown[])=>{commands.push([key,...args]);if(key==='save')stack.push(new Map(state));if(key==='restore'){state.clear();for(const[name,value]of stack.pop()??[])state.set(name,value);}};if(key==='fillText')return()=>{throw Error('The HUD transport pictograms must be marker strokes, not text glyphs.');};return state.get(key);},set(_target,key,value){state.set(key,value);commands.push(['set',key,value]);return true;}}) as CanvasRenderingContext2D;
  return {ctx,commands,stack};
}
function cutout(icon:Parameters<typeof nativeWeatherOutline>[0]){
  const geometry=new THREE.ExtrudeGeometry(nativeWeatherOutline(icon),{depth:.046,bevelEnabled:false}),material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.updateMatrixWorld(true);
  const hit=(x:number,y:number)=>new THREE.Raycaster(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0;
  return {geometry,hit,dispose:()=>{geometry.dispose();material.dispose();}};
}
function posePiece(){
  const piece=new THREE.Group() as CardboardPiece;
  Object.assign(piece.userData,{basePos:new THREE.Vector3(1,2,3),baseRot:new THREE.Euler(.008,-.008,.02),hoverVal:0,pressVal:0,active:false,nativeActivePose:0,shadowMesh:new THREE.Object3D()});
  return piece;
}

describe('native painted HUD symbols and poses · V480',()=>{
  it('maps every delivered weather, night and eclipse without inventing a new simulation weather',()=>{
    expect(WEATHER_KINDS.map(kind=>nativeWeatherIcon(kind,true))).toEqual(['sun','fog','rain','dry-storm','rain-storm','rain','snow','snow']);
    expect(nativeWeatherIcon('clear',false)).toBe('moon');expect(nativeWeatherIcon('clear',true,true)).toBe('eclipse');
  });

  it('cuts the sun and rain out of real extruded geometry with empty surrounding areas',()=>{
    const sun=cutout('sun'),rain=cutout('rain');
    try{
      expect(sun.hit(0,0)).toBe(true);expect(sun.hit(.30,.30)).toBe(false);
      // Normalized drop x25,y79 versus the empty space x40,y79.
      expect(rain.hit(-.165,-.1914)).toBe(true);expect(rain.hit(-.066,-.1914)).toBe(false);
      sun.geometry.computeBoundingBox();expect(sun.geometry.boundingBox!.max.z-sun.geometry.boundingBox!.min.z).toBeCloseTo(.046);
    }finally{sun.dispose();rain.dispose();}
  });

  it('paints distinct speed glyphs and weather outlines with deterministic marker strokes',()=>{
    const signatures=new Set<string>();
    for(const speed of [0,1,3,6] as const){const first=ink(),second=ink();drawNativeSpeedIcon(first.ctx,144,111,speed,false,seededRandom(480));drawNativeSpeedIcon(second.ctx,144,111,speed,false,seededRandom(480));expect(first.commands).toEqual(second.commands);expect(first.stack).toHaveLength(0);expect(first.commands.some(command=>command[0]==='stroke')).toBe(true);signatures.add(JSON.stringify(first.commands));}
    expect(signatures.size).toBe(4);
    for(const icon of ['sun','moon','eclipse','fog','rain','dry-storm','rain-storm','snow'] as const){const paint=ink();drawNativeWeatherIcon(paint.ctx,icon,160,160,seededRandom(480));expect(paint.stack).toHaveLength(0);expect(paint.commands.some(command=>command[0]==='stroke')).toBe(true);for(const command of paint.commands)for(const value of command)if(typeof value==='number')expect(Number.isFinite(value)).toBe(true);}
  });

  it('keeps selected controls lifted and tilted after hover ends without changing paint resources',()=>{
    const piece=posePiece(),data=piece.userData;
    const resting=nativeHudButtonPose(piece);data.nativeActivePose=1;data.active=true;
    const active=nativeHudButtonPose(piece);
    expect(active.z-resting.z).toBeCloseTo(.065);expect(active.rx-resting.rx).toBeCloseTo(-.1);expect(active.y-resting.y).toBeCloseTo(.045);
    expect(applyNativeHudButtonPose(piece)).toBe(true);expect(applyNativeHudButtonPose(piece)).toBe(false);
    data.hoverVal=1;expect(applyNativeHudButtonPose(piece)).toBe(true);expect(piece.position.z).toBeCloseTo(active.z+.085);
    data.pressVal=1;expect(applyNativeHudButtonPose(piece)).toBe(true);expect(piece.position.z).toBeCloseTo(active.z+.085-.05);
    data.hoverVal=data.pressVal=0;applyNativeHudButtonPose(piece);expect(piece.position.z).toBe(active.z);expect(piece.rotation.x).toBe(active.rx);
    data.nativeActivePose=0;data.active=false;applyNativeHudButtonPose(piece);expect(piece.position.z).toBe(resting.z);expect(piece.rotation.x).toBe(resting.rx);
  });
  it('preserves the speed button disk while changing only the selected pictogram ink',()=>{
    for(const speed of [0,1,3,6] as const){
      const idle=ink(),active=ink();drawNativeSpeedIcon(idle.ctx,144,111,speed,false,seededRandom(480));drawNativeSpeedIcon(active.ctx,144,111,speed,true,seededRandom(480));
      const disk=(commands:unknown[][])=>commands.slice(0,commands.findIndex(x=>x[0]==='stroke')+1);
      expect(disk(active.commands)).toEqual(disk(idle.commands));
    }
  });
});
