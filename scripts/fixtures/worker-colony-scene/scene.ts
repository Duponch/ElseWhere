import * as THREE from 'three/webgpu';
import { CameraRig } from '../../../src/render/CameraRig';
import { AnimationDetail } from '../../../src/render/AnimationDetail';
import { DayNightLayer } from '../../../src/render/DayNightLayer';
import { DoorLayer } from '../../../src/render/DoorLayer';
import { MotionTimeline } from '../../../src/render/MotionTimeline';
import { PawnLayer } from '../../../src/render/PawnLayer';
import { ReentrantRenderer } from '../../../src/render/ReentrantRenderer';
import { WallLayer } from '../../../src/render/WallLayer';
import { adapterRendererLimits } from '../../../src/render/webgpu-device-limits';
import { calendarTick } from '../../../src/sim/calendar';
import { deserializeWorld } from '../../../src/sim/serialization';
import { decodeStoredSave } from '../../../src/ui/save-storage-codec';

export type Layer = 'walls' | 'doors' | 'pawns';
export interface Draw { view: 0 | 1; hide?: Layer | 'shadows'; advanceHour?:boolean; speedHud?:boolean }
export const WIDTH = 768, HEIGHT = 512;

/** Both realms run exactly this code. Only the type of the supplied surface differs. */
export async function openScene(canvas: HTMLCanvasElement | OffscreenCanvas, _image?: (url: string) => Promise<ImageBitmap>) {
  const response = await fetch('/les-forges.json');
  if (!response.ok) throw Error('Les Forges fixture missing');
  const world = deserializeWorld(await decodeStoredSave(await response.text()));
  const gpu = new ReentrantRenderer({
    canvas, antialias: true, alpha: false, powerPreference: 'high-performance',
    requiredLimits: await adapterRendererLimits(),
  });
  await gpu.init();
  if (!(gpu.backend as {isWebGPUBackend?: boolean}).isWebGPUBackend) throw Error('This qualification requires native WebGPU');
  const device = (gpu.getContext() as GPUCanvasContext).getConfiguration()!.device;
  gpu.info.autoReset = false;
  gpu.setPixelRatio(1);
  gpu.setSize(WIDTH, HEIGHT, false);
  gpu.shadowMap.enabled = true;
  gpu.shadowMap.type = THREE.PCFShadowMap;
  gpu.toneMapping = THREE.ACESFilmicToneMapping;
  gpu.toneMappingExposure = 1.3;

  const scene = new THREE.Scene(), rig = new CameraRig(null), light = new DayNightLayer(scene);
  const detail = new AnimationDetail(), walls = new WallLayer(), doors = new DoorLayer(undefined, detail), pawns = new PawnLayer(undefined, detail);
  const groups = { walls: walls.group, doors: doors.group, pawns: pawns.group };
  scene.add(groups.walls, groups.doors, groups.pawns);
  walls.update(world, false, true);
  doors.update(world, false, true);
  pawns.update(world, 1, true);
  const motion = world.pawns.flatMap(pawn => pawn.motion ? [{ id: pawn.id, segments: [pawn.motion] }] : []);
  const timeline = new MotionTimeline();
  timeline.adopt(world.tick, 1, motion, 0, true);
  timeline.tick = world.tick;
  // Choose two visible landmarks from the actual save, not invented objects.
  const pawn = world.pawns.find(p => p.motion) ?? world.pawns[0]!;
  const distance = (p: { x: number; z: number }) => (p.x-pawn.x)**2 + (p.z-pawn.z)**2;
  const door = world.structures.filter(s => s.door).sort((a,b) => distance(a)-distance(b))[0]!;
  const focus = { x: (pawn.x + door.x)/2, z: (pawn.z + door.z)/2 };
  rig.resize(WIDTH, HEIGHT);
  rig.configureMap(world.width, world.height, focus);
  const initialOffset = rig.camera.position.clone().sub(rig.controls.target), axis = new THREE.Vector3(0,1,0);
  light.configureShadow(world.width, world.height);
  detail.beginFrame(0, rig.camera, HEIGHT, world.tick);
  pawns.time.value = world.tick/6 % (2*Math.PI);
  pawns.blend.value = 1;
  pawns.updateTravel(world, timeline, 1/60, 1);
  pawns.presentAnimations();
  doors.present(world.tick);
  light.update(calendarTick(world), rig.controls.target, world);
  await gpu.compileAsync(scene, rig.camera);

  return async ({view, hide}: Draw) => {
    groups.walls.visible = hide !== 'walls';
    groups.doors.visible = hide !== 'doors';
    groups.pawns.visible = hide !== 'pawns';
    light.light.castShadow = hide !== 'shadows';
    rig.camera.position.copy(initialOffset).applyAxisAngle(axis, view * .84).add(rig.controls.target);
    rig.controls.update();
    rig.camera.updateMatrixWorld();
    light.fitShadow(rig.camera);
    gpu.info.reset();
    gpu.render(scene, rig.camera);
    const {drawCalls, triangles} = gpu.info.render;
    await device.queue.onSubmittedWorkDone();
    return {
      worker: typeof document === 'undefined',
      adapter: device.adapterInfo.architecture, tick: world.tick, schema: world.schemaVersion,
      pawns: world.pawns.length, wallTriangles: walls.triangles, doorLeaves: doors.mesh.activeCount,
      drawCalls, triangles, shadowMap: !!light.light.shadow.map,
      view: rig.camera.matrixWorld.elements.slice(), projection: rig.camera.projectionMatrix.elements.slice(),
    };
  };
}
