import type * as THREE from 'three/webgpu';
/** Attempt every independent CPU/template owner even when one listener fails.
 * The caller retains its handles/reservation on AggregateError (quarantine). */
export function disposeTreeGeometries(geometries:Iterable<THREE.BufferGeometry>):void{const errors:unknown[]=[];for(const g of new Set(geometries))try{g.dispose();}catch(error){errors.push(error);}if(errors.length)throw new AggregateError(errors,'Tree geometry cleanup quarantine');}
