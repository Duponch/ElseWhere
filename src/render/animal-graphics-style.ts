import type * as THREE from 'three/webgpu';
import type {GraphicsStyleContext} from './graphics-style';
import {bakeAnimalCoatCoordinates} from './animal-surface-paint';

/** The shared model's authored UV/profile remain the Origami source. Default
 * uses its original coat shader with metric coordinates on that same model;
 * this replaces only the runtime attribute, never the cached source UV array. */
export function prepareAnimalGraphicsStyle(geometry:THREE.BufferGeometry,species:string,graphics:GraphicsStyleContext|undefined){
 const referenceModel=!!geometry.userData.origamiReference,gouache=referenceModel&&graphics?.origami===true;
 if(!gouache||!geometry.hasAttribute('animalPaintUv'))bakeAnimalCoatCoordinates(geometry,species);
 return{referenceModel,gouache};
}
