import * as THREE from 'three/webgpu';
import {StartingArrivalLayer,STARTING_ARRIVAL_PARTS} from '../render/StartingArrivalLayer';
import {PodRescueLayer,POD_RESCUE_PARTS} from '../render/PodRescueLayer';
import {OrbitalDeliveryLayer} from '../render/OrbitalDeliveryLayer';
import type {BoxMesh} from '../render/BoxMesh';
import type {CatalogCollection,CatalogItem} from './asset-catalog-types';

/** Narrow development ports for existing render recipes. These are not game
 * state, incidents or an admitted World. No adoption/advancement of simulation
 * is performed: the orbital reader only copies its five visual placement fields
 * into its existing capsule batch. Source PARTS are never duplicated here. */
interface OrbitalPreviewRecord {
  orbital:{pending:readonly {id:number;cell:{x:number;z:number};createdAt:number;landAt:number;openAt:number}[]};
}
interface OrbitalPreviewReader {adopt(record:OrbitalPreviewRecord):void}
interface RescuePosePort {readonly times:{value:THREE.Vector3}}

function closedBoxBounds(mesh:BoxMesh):THREE.Box3 {
  mesh.geometry.computeBoundingBox();const base=mesh.geometry.boundingBox!,bounds=new THREE.Box3(),matrix=new THREE.Matrix4();
  for(let i=0;i<mesh.activeCount;i++){mesh.getMatrixAt(i,matrix);bounds.union(base.clone().applyMatrix4(matrix));}return bounds;
}

export function createTransportAssetCatalog():CatalogCollection {
  const group=new THREE.Group();group.name='Catalog — real closed transport capsules';const items:CatalogItem[]=[];
  const starting=new StartingArrivalLayer(),rescue=new PodRescueLayer(),orbital=new OrbitalDeliveryLayer();
  // Frozen visual coefficients select closed shells on the ground. There is
  // no animation loop or simulated time progression attached to these layers.
  starting.tick.value=15;starting.mesh.activeCount=STARTING_ARRIVAL_PARTS;
  (rescue as unknown as RescuePosePort).times.value.set(0,1,4);rescue.tick.value=1;rescue.mesh.activeCount=POD_RESCUE_PARTS;
  const orbitalPlacement:OrbitalPreviewRecord={orbital:{pending:[{id:1,cell:{x:0,z:0},createdAt:0,landAt:6,openAt:10}]}};
  (orbital as unknown as OrbitalPreviewReader).adopt(orbitalPlacement);orbital.tick.value=6;
  starting.syncContours();rescue.syncContours();orbital.syncContours();
  for(const [index,layer,id,label]of [
    [0,starting,'transport:starting-arrival','Capsule d’arrivée initiale'],
    [1,rescue,'transport:rescue','Capsule de secours'],
    [2,orbital,'transport:orbital','Capsule de livraison orbitale'],
  ] as const){
    const model=new THREE.Group();model.position.x=index*4;layer.mesh.frustumCulled=false;model.add(layer.group);group.add(model);
    const bounds=closedBoxBounds(layer.mesh).translate(model.position),center=bounds.getCenter(new THREE.Vector3());items.push({id,label,status:'default',note:'Modèle actuel de la capsule, présentée fermée au sol. Version Origami spécifique non disponible.',bounds,position:new THREE.Vector3(center.x,bounds.max.y+.20,center.z)});
  }
  return {sections:[{id:'transports',label:'Transports',note:'Trois modèles de capsules existants, en pose fermée fixe. Les effets animés transitoires ne font pas partie de cet inventaire de modèles.',group,items}],dispose(){starting.dispose();rescue.dispose();orbital.dispose();group.clear();}};
}
