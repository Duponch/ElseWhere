import * as THREE from 'three/webgpu';
import {createOrigamiBrushGeometry} from './brush-geometry';

/** New presentation-only ribbons. Canonical body/line/wear geometries remain
 * untouched; static endpoints occupy the engine's one interleaved buffer and
 * the existing actor instance streams are shared without another allocation. */
export function createRigBrushGeometry(source:THREE.InstancedBufferGeometry):THREE.InstancedBufferGeometry {
  const ribbons=createOrigamiBrushGeometry(source),geometry=new THREE.InstancedBufferGeometry();
  for(const [name,attribute]of Object.entries(ribbons.attributes))geometry.setAttribute(name,attribute);
  if(ribbons.index)geometry.setIndex(ribbons.index);geometry.userData={...ribbons.userData};
  geometry.boundingBox=ribbons.boundingBox?.clone()??null;geometry.boundingSphere=ribbons.boundingSphere?.clone()??null;
  for(const [name,attribute]of Object.entries(source.attributes))if(attribute instanceof THREE.InstancedBufferAttribute||attribute instanceof THREE.InterleavedBufferAttribute&&attribute.data instanceof THREE.InstancedInterleavedBuffer)geometry.setAttribute(name,attribute);
  geometry.instanceCount=source.instanceCount;ribbons.dispose();return geometry;
}
