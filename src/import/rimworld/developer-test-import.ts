import type {RwsConversion} from './convert.ts';
import {DEV_BUILDING_RESEARCH381,devConcreteCell381,type DevPlacements381,type DevBuilding381} from '../../sim/developer-import-381.ts';
import {footprintCells} from '../../sim/definitions.ts';
import {terrainSupportsFloor256} from '../../sim/natural-terrain-runtime-256.ts';
import {marshSupportsFootprint} from '../../sim/marsh.ts';
import {researchUnlocked} from '../../sim/research.ts';
import {productionResearchUnlocked} from '../../sim/machining.ts';

/** Called *only* by the explicit developer-test entry point, after conversion
 * has finished with its genuine source ID map. We don't touch research,
 * pose, tiles, supplies or any other original owner. Unknown unsupported
 * content still fails the ordinary validators just as before.
 */
export function captureDeveloperImport381(conversion:RwsConversion,announce=true):DevPlacements381 {
 const w=conversion.world,ids=new Set(conversion.thingIds.values());
 const p:DevPlacements381={revision:1,floors:[],buildings:[],crops:[]};
 for(let index=0;index<w.tiles.length;index++){
  const tile=w.tiles[index]!;
  if(tile.terrain==='soft-sand'&&tile.floor==='ancient-concrete'&&!terrainSupportsFloor256(tile,w)){
   const row=devConcreteCell381(tile,index);
   if(row)p.floors.push(row);
  }
 }
 for(const b of w.structures){
  if(!ids.has(b.id))continue;
  for(const bill of b.bills??[])if(ids.has(bill.id)&&!productionResearchUnlocked(w,bill.recipe)){
   (p.bills??=[]).push({id:bill.id,recipe:bill.recipe,station:{id:b.id,kind:b.kind,x:b.x,z:b.z,orientation:b.orientation,footprint:b.footprint,
    ...b.material!==undefined?{material:b.material}:{}}});
  }
  const project=DEV_BUILDING_RESEARCH381[b.kind];
  const research=project&&!researchUnlocked(w,project)?project:undefined;
  const support=footprintCells(b).filter(c=>!marshSupportsFootprint(w,[c],b)).flatMap(c=>{
   const index=c.z*w.width+c.x,tile=w.tiles[index];
   if(!tile||tile.terrain!=='soft-sand'&&b.kind!=='grave')return [];
   const row=devConcreteCell381(tile,index);
   return row?[row]:[];
  });
  if(research||support.length){
   const row:DevBuilding381={id:b.id,kind:b.kind,x:b.x,z:b.z,orientation:b.orientation,footprint:b.footprint,
    ...b.material!==undefined?{material:b.material}:{},...research?{research}:{},...support.length?{support}:{}};
   p.buildings.push(row);
  }
 }
 for(const z of w.growingZones??[])if(z.plant==='devilstrand'&&!researchUnlocked(w,'devilstrand')){
  p.crops.push({id:z.id,plant:z.plant,cells:[...z.cells]});
 }
 w.developerTest381=true;
 w.developerPlacements381=p;
 if(announce)conversion.notes.adapted('world',`Colonie de test réservée au mode développeur : ${p.floors.length} cases préexistantes, ${p.buildings.length} bâtiments, ${p.crops.length} zones, ${p.bills?.length??0} factures bénéficient d'une admission individuelle (aucune recherche ajoutée, aucune quantité modifiée ; les factures verrouillées attendent la recherche).`);
 return p;
}
