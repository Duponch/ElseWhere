import * as THREE from 'three/webgpu';
import {BESTIARY_PAINT_DESCRIPTORS} from './bestiary-paint-descriptors';
import {bestiaryPaintProfile} from './reference-profiles';
import {GAME_UNUSED_BESTIARY_SOURCE_KEYS} from './game-paint-residency';

/** Species coats and small shape corrections (retours du 22 novembre, point 6).
 * Several species shared one source recipe and paint (the three dog breeds,
 * hare and snow hare, deer and caribou, capybara and guinea pig) or wore a
 * colour far from RimWorld's (megaspider, alpaca, capybara, labrador). The
 * colours come from the Core definitions: the lifeStage bodyGraphicData tint
 * of each PawnKindDef (Megaspider 154,125,94; Alpaca 180,148,109; Capybara
 * 109,84,49; LabradorRetriever 220,198,160; Husky 137,133,133; Snowhare
 * 180,180,180), and the usual coat of the species when the def has no tint.
 *
 * Pastel draws the vertex colour given here. Gouache paints a pigment: only
 * pigments already resident in the 78-pigment game inventory are used
 * (game-paint-residency.ts), and every source pigment a species gives up
 * stays used by another part or species, so that inventory is unchanged. The
 * canonical source recipes are not touched; only the product presentation
 * is, once, before the species batch is compiled. */
export interface CoatRule {
  /** Source pigment key of the parts to repaint (referencePaintKey), or a mesh
   * name for the legacy references. */
  readonly pigment?:string;readonly part?:string;
  /** Resident bestiary pigment painted in Gouache, and the Pastel colour. */
  readonly to:string;readonly color:string;
}
export const SPECIES_COATS:Readonly<Record<string,readonly CoatRule[]>>=Object.freeze({
  // Brown chitin as in the game; the source blue-grey stays on the mandibles.
  megaspider:[{part:'mandible',to:'matChitinSpider',color:'#3f4a54'},{pigment:'matChitinSpider',to:'matSlothEarth',color:'#9a7d5e'}],
  // Fawn wool; the cream wool stays on the new topknot.
  alpaca:[{part:'topknot',to:'matAlpacaWool',color:'#e3cfb4'},{pigment:'matAlpacaWool',to:'matCougarTawny',color:'#b4946d'}],
  capybara:[{pigment:'matCapybaraBrown',to:'matTortoiseShell',color:'#6d5431'}],
  // Grey-brown coat and pale neck ruff, unlike the auburn deer and elk.
  caribou:[{pigment:'matDeerAuburn',to:'matDonkeyDun',color:'#7f7566'},{pigment:'matDeerMane',to:'matCreamWhiteGouache',color:'#d8d0c0'}],
  'snow-hare':[{pigment:'matHareSand',to:'matSnowWhiteGouache',color:'#e2e2de'}],
  // One cream-yellow coat.
  'labrador-retriever':[{pigment:'matDogOchre',to:'matFennecSand',color:'#dcc6a0'},{pigment:'matDogSaddle',to:'matFennecSand',color:'#d2ba90'}],
  // Grey back and head, white mask, belly-grey legs.
  husky:[{part:'muzzle',to:'matSnowWhiteGouache',color:'#e6e4de'},{part:'leg',to:'matChinchillaSilver',color:'#b3b0ad'},{pigment:'matDogOchre',to:'matTimberWolfGrey',color:'#898585'},{pigment:'matDogSaddle',to:'matTimberWolfGrey',color:'#6f6c6c'},{pigment:'matCreamWhiteGouache',to:'matSnowWhiteGouache',color:'#ecebe6'}],
  // Steel-blue back, tan head and legs.
  'yorkshire-terrier':[{part:'chest',to:'matTimberWolfGrey',color:'#5d6670'},{part:'waist',to:'matTimberWolfGrey',color:'#5d6670'},{part:'tailSeg1',to:'matTimberWolfGrey',color:'#5d6670'},{pigment:'matDogOchre',to:'matCougarTawny',color:'#b98a55'},{pigment:'matDogSaddle',to:'matCougarTawny',color:'#a87a48'}],
});

const materials=new Map<string,THREE.MeshBasicMaterial>();
function coatMaterial(to:string,color:string):THREE.MeshBasicMaterial {
  const key=`${to}:${color}`,cached=materials.get(key);if(cached)return cached;
  if((GAME_UNUSED_BESTIARY_SOURCE_KEYS as readonly string[]).includes(to))throw Error('Coat pigment is not resident: '+to);
  const descriptor=BESTIARY_PAINT_DESCRIPTORS.find(d=>d.sourceKey===to);if(!descriptor)throw Error('Unknown coat pigment: '+to);
  const material=new THREE.MeshBasicMaterial({color});
  material.userData.referencePaintKey=descriptor.key;material.userData.referencePaintConfig=descriptor.config;
  material.userData.referencePaintIndex=bestiaryPaintProfile(to);material.userData.referencePaintProfileKey=descriptor.key;
  materials.set(key,material);return material;
}
const sourceKey=(material:THREE.Material):string=>String(material.userData.referencePaintKey??'').replace(/^best46:/,'');
function inLeg(mesh:THREE.Object3D,root:THREE.Object3D):boolean {const legs=(root.userData.legs??[]) as THREE.Object3D[];for(let node:THREE.Object3D|null=mesh;node;node=node.parent)if(legs.includes(node))return true;return false;}

/** Repaints a freshly built presentation root of `species` (never a shared
 * source mesh material: each repainted part receives a coat material). */
export function applySpeciesCoat(species:string,root:THREE.Group):void {
  reshapeSpecies(species,root);
  const rules=SPECIES_COATS[species];if(!rules)return;
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||!(object.material instanceof THREE.MeshBasicMaterial))return;
    const mesh=object as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>,key=sourceKey(mesh.material);
    const rule=rules.find(r=>r.part!==undefined&&(r.part==='leg'?inLeg(mesh,root)&&key!=='matCreamWhiteGouache'&&key!=='matCharcoalGouache':mesh.name===r.part||mesh.userData.speciesCoatPart===r.part))
      ??rules.find(r=>r.pigment!==undefined&&key===r.pigment);
    if(rule)mesh.material=coatMaterial(rule.to,rule.color);
  });
  root.userData.speciesCoat=species;
}

/** Shape corrections: floppy labrador ears, a husky's tail curled over its
 * back, an alpaca's wool topknot, named megaspider mandibles. */
function reshapeSpecies(species:string,root:THREE.Group):void {
  const head=root.userData.headGroup as THREE.Group|undefined;
  if(species==='labrador-retriever')root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name==='earBase'){const side=Math.sign(object.position.z)||1;object.position.set(.05,.13,side*.215);object.rotation.set(side*2.75,0,.18);}});
  if(species==='husky'){const tail=root.userData.tailGroup as THREE.Group|undefined;if(tail)tail.rotation.z=-.95;}
  if(species==='megaspider'&&head)for(const part of head.children)if(part instanceof THREE.Mesh&&sourceKey(part.material as THREE.Material)==='matCharcoalGouache')part.userData.speciesCoatPart='mandible';
  if(species==='alpaca'&&head){
    // Box on top of the head, in the head's frame; the head is the second
    // source child (neck, head, ears). Painted with the source cream wool.
    const skull=head.children[1];
    if(skull instanceof THREE.Mesh){
      const wool=(skull.material as THREE.MeshBasicMaterial).userData.referencePaintIndex===bestiaryPaintProfile('matAlpacaWool')?skull.material as THREE.MeshBasicMaterial:undefined;
      if(wool){skull.geometry.computeBoundingBox();const box=skull.geometry.boundingBox!,size=box.getSize(new THREE.Vector3());
        const topknot=new THREE.Mesh(new THREE.BoxGeometry(size.x*.42,size.y*.55,size.z*1.05).toNonIndexed(),wool);
        topknot.geometry.computeVertexNormals();topknot.name='topknot';topknot.userData.referenceEdgeAngle=22;topknot.userData.referenceAnatomyRole='head';topknot.userData.speciesCoatPart='topknot';
        topknot.position.set(box.min.x+size.x*.18,box.max.y+size.y*.12,0);skull.add(topknot);}
    }
  }
}
