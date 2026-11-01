import type * as THREE from 'three/webgpu';

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
  dispose():void;
}
