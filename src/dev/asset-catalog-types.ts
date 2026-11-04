import type * as THREE from 'three/webgpu';
import type {PreparedPlantAtlasStage} from '../render/origami/baked/plants/PlantAtlasSurface';

/** Development presentation inventory only. These entries are neither game
 * entities nor a World: they carry labels, preview bounds and render ownership. */
export type CatalogStatus='reference'|'origami'|'default';
export interface CatalogItem {
  id:string;
  label:string;
  status:CatalogStatus;
  note?:string;
  /** Label anchor and complete preview bounds, local to the section group. */
  position:THREE.Vector3;
  bounds:THREE.Box3;
}
export interface CatalogSection {
  id:string;
  label:string;
  note?:string;
  group:THREE.Group;
  items:CatalogItem[];
  missing?:{id:string;label:string;reason:string}[];
}
export interface CatalogCollection {
  sections:CatalogSection[];
  /** The entry point holds exclusive renderer ownership across every await.
   * Called only after all appearance profiles have been registered/flushed. */
  prepareTrees?(renderer:THREE.WebGPURenderer,camera:THREE.Camera,lightingScene:THREE.Scene,assertCurrent:()=>void):Promise<void>;
  /** Data publication is settled by the exclusive gallery transaction. */
  stagePlants?(renderer:THREE.WebGPURenderer,camera:THREE.Camera,lightingScene:THREE.Scene,assertCurrent:()=>void):Promise<PreparedPlantAtlasStage|undefined>;
  /** Compatibility hook; style changes preserve prepared texture ownership. */
  invalidatePreparedTrees?():void;
  /** Readiness assertion only; no census, admission, compile or allocation. */
  assertFixedTreeDrawReady?():void;
  treeStatus?():unknown;
  dispose():void;
}
