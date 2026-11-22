import * as THREE from 'three/webgpu';
import { cameraClipNear } from './camera-clip';

export interface ScreenRect { left: number; top: number; width: number; height: number }
export interface ActorScreenProxy { x: number; y: number; radius: number; depth: number }

const center = new THREE.Vector3(), edge = new THREE.Vector3(), side = new THREE.Vector3();
const visible = (camera: THREE.Camera, p: THREE.Vector3) => p.z >= cameraClipNear(camera) && p.z <= 1 && Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1;
const screen = (rect: ScreenRect, p: THREE.Vector3) => ({ x: rect.left + (p.x + 1) * rect.width / 2, y: rect.top + (1 - p.y) * rect.height / 2 });

/** Click disc of a standing person drawn at `x,y,z` (feet): centred on the
 * waist, reaching the head on screen and, seen from above where the body is
 * short on screen, its shoulders. Computed only for pointer gestures. */
export function humanScreenProxy(camera: THREE.Camera, rect: ScreenRect, x: number, y: number, z: number): ActorScreenProxy | undefined {
  center.set(x, y + .75, z).project(camera);
  if (!visible(camera, center)) return undefined;
  const at = screen(rect, center);
  const head = edge.set(x, y + 1.75, z).project(camera).y;
  side.setFromMatrixColumn(camera.matrixWorld, 0);
  const flank = edge.set(x, y + .75, z).addScaledVector(side, .4).project(camera).x;
  return { ...at, depth: center.z, radius: Math.max(5, Math.abs(head - center.y) * rect.height / 2, Math.abs(flank - center.x) * rect.width / 2) };
}

/** Click disc of an animal or mechanoid drawn at `x,y,z` with its height and
 * body radius: centred on the body, as wide as its larger half extent. */
export function bodyScreenProxy(camera: THREE.Camera, rect: ScreenRect, x: number, y: number, z: number, height: number, radius: number): ActorScreenProxy | undefined {
  center.set(x, y + height * .5, z).project(camera);
  if (!visible(camera, center)) return undefined;
  side.setFromMatrixColumn(camera.matrixWorld, 0);
  edge.set(x, y + height * .5, z).addScaledVector(side, Math.max(height * .5, radius)).project(camera);
  return { ...screen(rect, center), depth: center.z, radius: Math.max(6, Math.abs(edge.x - center.x) * rect.width / 2) };
}
