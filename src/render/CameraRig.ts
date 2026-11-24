import { MathUtils, MOUSE, OrthographicCamera, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { WORLD_SCALE } from '../world/scale';
import { createRoomLayout, type RoomLayout } from './room-layout';
import {pageKeyCameraSpan} from '../ui/map-interaction-shortcuts';

export type CameraMode = 'orthographic' | 'perspective';
const halfHeight = WORLD_SCALE.cameraSpan * 0.53;
const slope = Math.tan(MathUtils.degToRad(45) / 2);
const rayLimit = (delta: number, origin: number, low: number, high: number): number =>
  delta > 0 ? (high - origin) / delta : delta < 0 ? (low - origin) / delta : Infinity;

/** Projection and navigation are presentation state, never part of a World. */
export class CameraRig {
  readonly orthographic = new OrthographicCamera(-20, 20, 20, -20, 0.1, 1000);
  readonly perspective = new PerspectiveCamera(45, 1, 0.1, 2000);
  readonly controls: OrbitControls;
  mode: CameraMode = 'orthographic';
  private diagonal = Math.hypot(32, 32);
  private roomEnabled = false;
  private roomLayout: RoomLayout | null = null;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private readonly offset = new Vector3();

  constructor(element: HTMLElement | null) {
    this.orthographic.position.set(41, 34, 44);
    this.controls = new OrbitControls(this.orthographic, element);
    Object.assign(this.controls, {
      enableDamping: true, dampingFactor: 0.09, screenSpacePanning: false,
      minPolarAngle: 0.2, maxPolarAngle: Math.PI / 2 - 0.2, minZoom: 0.25, maxZoom: 4.5,
    });
    this.controls.mouseButtons = { LEFT: null as unknown as MOUSE, MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE };
    this.controls.target.set(15.5, 0, 15.5);
    this.resize(1, 1);
    this.controls.update();
  }

  get camera(): OrthographicCamera | PerspectiveCamera {
    return this.mode === 'orthographic' ? this.orthographic : this.perspective;
  }

  /** Height in world units at the orbit target, shared by zoom, pan and toggle. */
  get span(): number {
    return this.mode === 'orthographic' ? 2 * halfHeight / this.orthographic.zoom
      : 2 * slope * this.perspective.position.distanceTo(this.controls.target);
  }

  /** PageUp/PageDown preserve the orbit target, angle and scene constraints. */
  pageZoom(direction:'in'|'out'):void {
    const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();
    const span=pageKeyCameraSpan(this.span,direction,2*halfHeight/this.controls.maxZoom,2*halfHeight/this.controls.minZoom);
    if(this.mode==='orthographic'){this.orthographic.zoom=2*halfHeight/span;this.orthographic.updateProjectionMatrix();}
    else{this.offset.copy(this.perspective.position).sub(this.controls.target).normalize();this.perspective.position.copy(this.controls.target).addScaledVector(this.offset,span/(2*slope));}
    this.controls.update();this.constrainRoom();this.controls.enableDamping=damping;
  }

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    // Consume residual orbit damping before transferring the pose. Otherwise
    // the old camera's unconsumed deltas kick the new projection on the next RAF.
    const damping = this.controls.enableDamping;
    this.controls.enableDamping = false; this.controls.update();
    const span = this.span;
    this.offset.copy(this.camera.position).sub(this.controls.target).normalize();
    this.mode = mode;
    this.configureDistanceLimits();
    const distance = mode === 'perspective' ? span / (2 * slope) : this.diagonal + 2 * WORLD_SCALE.treeMaxHeight;
    this.camera.position.copy(this.controls.target).addScaledVector(this.offset, distance);
    this.camera.zoom = mode === 'orthographic' ? 2 * halfHeight / span : 1;
    this.camera.updateProjectionMatrix();
    this.controls.object = this.camera;
    this.controls.update(); this.constrainRoom(); this.controls.enableDamping = damping;
  }

  configureMap(width: number, height: number, landing?:{x:number;z:number}): void {
    this.controls.enableDamping = false; this.controls.update();
    this.diagonal = Math.hypot(width, height);
    this.roomLayout = createRoomLayout(width, height);
    this.controls.target.set(landing?.x??(width - 1) / 2, 0, landing?.z??(height - 1) / 2);
    this.offset.set(0.85, 2, 0.9).normalize();
    const distance = this.mode === 'orthographic' ? this.diagonal + 2 * WORLD_SCALE.treeMaxHeight : halfHeight / slope;
    this.camera.position.copy(this.controls.target).addScaledVector(this.offset, distance);
    this.camera.zoom = 1;
    this.controls.update(); this.constrainRoom(); this.controls.enableDamping = true;
    this.resize(this.viewportWidth, this.viewportHeight);
  }

  resize(width: number, height: number): void {
    this.viewportWidth = width; this.viewportHeight = height;
    const aspect = Math.max(1, width) / Math.max(1, height);
    Object.assign(this.orthographic, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight });
    this.perspective.aspect = aspect;
    const walls = this.roomLayout?.walls;
    const margin = this.roomEnabled && walls ? Math.hypot(walls.eastX - walls.westX, walls.southZ - walls.northZ) : 0;
    this.controls.minZoom = Math.min(0.25, 2 * halfHeight * Math.min(1, aspect) / (this.diagonal + margin + 2 * WORLD_SCALE.treeMaxHeight + 8));
    this.configureDistanceLimits();
    this.orthographic.far = Math.max(300, 2 * this.diagonal + margin + 4 * WORLD_SCALE.treeMaxHeight);
    this.perspective.far = halfHeight / (slope * this.controls.minZoom) + this.diagonal + margin + 2 * WORLD_SCALE.treeMaxHeight;
    this.orthographic.updateProjectionMatrix(); this.perspective.updateProjectionMatrix();
  }

  setRoomEnabled(enabled: boolean): void {
    if (this.roomEnabled === enabled) return;
    this.roomEnabled = enabled;
    this.resize(this.viewportWidth, this.viewportHeight);
    this.constrainRoom();
  }

  /** Keep the eye inside the fixed room shell, along the current viewing ray.
   * OrbitControls consumes this corrected position on its next update, so zoom,
   * pan, inertia and projection changes share the same physical boundary. */
  constrainRoom(): boolean {
    if (!this.roomEnabled || !this.roomLayout) return false;
    const { walls, floorY, unit } = this.roomLayout;
    const eye = this.camera.position, target = this.controls.target;
    const margin = Math.max(this.camera.near * 2, unit * .04);
    this.offset.copy(eye).sub(target);
    const factor = Math.min(1,
      rayLimit(this.offset.x, target.x, walls.westX + margin, walls.eastX - margin),
      rayLimit(this.offset.z, target.z, walls.northZ + margin, walls.southZ - margin),
      rayLimit(this.offset.y, target.y, floorY + margin, walls.ceilingY - margin));
    if (factor >= 1) return false;
    eye.copy(target).addScaledVector(this.offset, Math.max(0, factor));
    this.camera.updateMatrixWorld();
    return true;
  }

  private configureDistanceLimits(): void {
    this.controls.minDistance = this.mode === 'perspective' ? halfHeight / (slope * this.controls.maxZoom) : 0;
    this.controls.maxDistance = this.mode === 'perspective' ? halfHeight / (slope * this.controls.minZoom) : Infinity;
  }

  /** Conservative size of the NEAREST possible canopy. Using target distance
   * alone would turn near trees into overview glyphs in a low perspective view. */
  pixelsPerCell(viewportHeight: number): number {
    if (this.mode === 'orthographic') return viewportHeight / this.span;
    this.offset.copy(this.controls.target).sub(this.camera.position).normalize();
    const angle = Math.acos(MathUtils.clamp(-this.offset.y, 0, 1));
    const viewHalfAngle = Math.atan(slope * Math.hypot(1, this.perspective.aspect));
    const depth = Math.max(0.1, this.camera.position.y - WORLD_SCALE.treeMaxHeight)
      * Math.cos(viewHalfAngle) / Math.cos(Math.max(0, angle - viewHalfAngle));
    return viewportHeight / (2 * slope * depth);
  }

  dispose(): void { if (this.controls.domElement) this.controls.dispose(); }
}
