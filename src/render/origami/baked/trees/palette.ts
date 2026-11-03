/** Existing protected tree paint metadata only. No pigment registration, seed reset,
 * painter, geometry, World, pixels, texture, renderer or per-frame decision. */
import {REFERENCE_PAINT_DESCRIPTORS} from '../../reference-paint-seeds';
import type {ReferencePaintDescriptor} from '../../reference-paint-library';
import type {ForestrySpecies291} from '../../../../sim/forestry-content-291';

export type LegacyTreePaintRole='trunk'|'canopy'|'cactus';
export const LEGACY_REFERENCE_PAINT_IDS=Object.freeze({generic:0,pinkFlower:3,trunk:4,poplar:5,oak:6,pine:7,saguaro:8} as const);
type AuthoredReference='poplar'|'oak'|'pine'|'cactus';
type TreeFact=Readonly<{species:ForestrySpecies291;mode:'authored-origami'|'generic-legacy-color';reference?:AuthoredReference;roles:Readonly<Partial<Record<LegacyTreePaintRole,number>>>;missingShapeFeatures:readonly string[]}>;
const roles=(trunk:number,canopy:number)=>Object.freeze({trunk,canopy});
const none:readonly string[]=Object.freeze([]),generic=(species:ForestrySpecies291):TreeFact=>Object.freeze({species,mode:'generic-legacy-color',roles:roles(0,0),missingShapeFeatures:none});
/** Complete actual thirteen-species domain. The erased ForestrySpecies291
 * Record checks completeness without importing its World/simulation module. */
export const LEGACY_TREE_PAINT_TABLE:Readonly<Record<ForestrySpecies291,TreeFact>>=Object.freeze({
 oak:Object.freeze({species:'oak',mode:'authored-origami',reference:'oak',roles:roles(4,6),missingShapeFeatures:none}),
 poplar:Object.freeze({species:'poplar',mode:'authored-origami',reference:'poplar',roles:roles(4,5),missingShapeFeatures:none}),
 pine:Object.freeze({species:'pine',mode:'authored-origami',reference:'pine',roles:roles(4,7),missingShapeFeatures:none}),
 birch:generic('birch'),
 saguaro:Object.freeze({species:'saguaro',mode:'authored-origami',reference:'cactus',roles:Object.freeze({cactus:8}),missingShapeFeatures:Object.freeze(['Reference cactus has a pink flower (matPinkEarGouache, virtual3). Legacy saguaro has no flower geometry; no pink stem/top face is invented.'])}),
 drago:generic('drago'),bamboo:generic('bamboo'),cecropia:generic('cecropia'),cypress:generic('cypress'),maple:generic('maple'),palm:generic('palm'),teak:generic('teak'),willow:generic('willow'),
});
export const LEGACY_TREE_PAINT_FACTS:readonly TreeFact[]=Object.freeze(Object.values(LEGACY_TREE_PAINT_TABLE));
type BorrowedDescriptor=Readonly<ReferencePaintDescriptor>;
export interface LegacyTreePaintChoice {readonly virtualId:number;readonly descriptor:BorrowedDescriptor;readonly colorMultiplier:'identity'|'source-vertex-color';readonly ownership:'borrowed existing registry metadata; no new pigment';}
const stable=(value:unknown):string=>JSON.stringify(value,(_key,v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const expectedKeys:Readonly<Record<number,string>>=Object.freeze({3:'matPinkEarGouache',4:'matTrunkBark',5:'matPoplarGreen',6:'matOakGreen',7:'matPineGreen',8:'matCactusGreen'});
const genericFingerprint=stable({key:'generic-gouache',config:{baseColor:'#ffffff',secondaryColor:'#ded8cc',strokeStyle:'directional',strokeCount:300},seed:1337});

/** Pass referencePaintProfiles()/BASE_REFERENCE_PAINT_DESCRIPTORS already held
 * by the caller. We return those EXACT objects, never recolor or re-register.
 * Protected IDs derive from reference-profiles.ts: generic0 followed by the
 * literal canonical REFERENCE_PAINT_DESCRIPTORS in their original order. */
export function createLegacyTreePaintResolver(existingProfiles:readonly ReferencePaintDescriptor[]){
 const pinned=new Map<number,{descriptor:ReferencePaintDescriptor;fingerprint:string}>();
 for(const id of [0,3,4,5,6,7,8]){
  const actual=existingProfiles[id];if(!actual)throw Error('Existing Legacy/Origami paint registry missing virtual '+id);
  const expected=id===0?genericFingerprint:stable(REFERENCE_PAINT_DESCRIPTORS[id-1]);
  if(id>0&&(REFERENCE_PAINT_DESCRIPTORS[id-1]?.key!==expectedKeys[id]||REFERENCE_PAINT_DESCRIPTORS[id-1]?.sourceIndex!==id-1))throw Error('Protected canonical flora paint order changed');
  const fingerprint=stable(actual);if(fingerprint!==expected)throw Error('Existing protected paint differs from full Source descriptor at '+id);pinned.set(id,{descriptor:actual,fingerprint});
 }
 const assertCurrent=()=>{for(const[id,p]of pinned)if(existingProfiles[id]!==p.descriptor||stable(p.descriptor)!==p.fingerprint)throw Error('Borrowed Legacy tree paint metadata changed at '+id);};
 const choice=(id:number):Readonly<LegacyTreePaintChoice>=>{const row=pinned.get(id);if(!row)throw Error('Unknown protected Legacy tree paint ID');return Object.freeze({virtualId:id,descriptor:row.descriptor,colorMultiplier:id===0?'source-vertex-color':'identity',ownership:'borrowed existing registry metadata; no new pigment'});};
 const fact=(species:ForestrySpecies291):TreeFact=>{if(!Object.hasOwn(LEGACY_TREE_PAINT_TABLE,species))throw Error('Unknown actual forestry species');return LEGACY_TREE_PAINT_TABLE[species];};
 return Object.freeze({
  facts:LEGACY_TREE_PAINT_FACTS,
  assertCurrent,
  resolve(species:ForestrySpecies291,role:LegacyTreePaintRole){assertCurrent();const row=fact(species),id=row.roles[role];if(id===undefined)throw Error('Legacy shape has no '+role+' paint role for '+species);return choice(id);},
  plan(species:ForestrySpecies291){assertCurrent();const row=fact(species),entries=Object.entries(row.roles).map(([role,id])=>{if(id===undefined||!Number.isSafeInteger(id))throw Error('Incomplete canonical Legacy role');return[role as LegacyTreePaintRole,id] as const;}),parts=Object.freeze(Object.fromEntries(entries.map(([role,id])=>[role,choice(id)]))),requiredVirtualIds=Object.freeze([...new Set([0,...entries.map(([,id])=>id)])].sort((a,b)=>a-b));return Object.freeze({...row,parts,requiredVirtualIds,unmappedReferencePaint:species==='saguaro'?Object.freeze([choice(3)]):Object.freeze([]),paletteFingerprint:stable(entries.map(([role,id])=>({role,virtualId:id,descriptor:pinned.get(id)!.descriptor})))});},
 });
}
