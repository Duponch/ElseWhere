import type * as THREE from 'three/webgpu';
import type {Resource} from '../../../../sim/types';
import type {ForestrySpecies291} from '../../../../sim/forestry-content-291';
import type {Placement} from '../../../primitives';
import type {GraphicsStyleContext} from '../../../graphics-style';
import type {BakedChartSet} from '../charts';
import type {BakedInk} from './ink';
import type {TreeModel,TreeModelVariant,TreePrimitiveKind as ModelTreePrimitiveKind} from '../../../models/TreeModels';
import type {TextureSurfaceSlot} from '../../../surfaces/TextureSurface';
export type TreeSpecies=ForestrySpecies291;
export type TreePrimitiveKind=ModelTreePrimitiveKind;
export interface TreePaintSettings {impasto:number;wear:number;edges:number;blackEdges:number;edgeWidth:number;strokeImperfection:number;contourImperfection:number}
export interface TreeRecipeOptions {paintGeneration:string;settings:Readonly<TreePaintSettings>;pageSize:2048;maxCpuBytes:number;variant?:TreeModelVariant}
export interface TreeTemplate {
 readonly id:string;readonly key:string;readonly canopy:boolean;readonly primitiveKind:TreePrimitiveKind;
 readonly modelKey:string;readonly modelSlot:string;readonly surfaceSlot:number;
 /** Ordinary raw Source fields. Never mutate or pass this borrowed master to
  * consuming mergedInstances; clone once per batch/template instead. */
 readonly geometry:THREE.BufferGeometry;readonly canonicalPlacement:Readonly<Placement>;
 readonly sourceCorner:Uint32Array;readonly profile:number;
}
export interface TreePlacement {readonly template:TreeTemplate;readonly item:Placement}
export interface TreeRecipe {
 readonly key:string;readonly species:TreeSpecies|undefined;readonly model:TreeModel;readonly options:Readonly<TreeRecipeOptions>;readonly parts:readonly TreeTemplate[];readonly charts:BakedChartSet;readonly requiredProfiles:readonly number[];readonly cpuBytes:number;readonly facts:Readonly<Record<string,unknown>>;
 assertCurrent():void;place(resource:Resource,turn:number,size:number):readonly TreePlacement[]|undefined;
 /** Owned preparation lease. Recipe retirement waits for every lease. */
 compileInk():BakedInk;dispose():void;
}
export type TreePaintLease=ReturnType<GraphicsStyleContext['prepareAtlasPaint']>;
export interface ReadyTreeRecipe {
 readonly key:string;readonly species:TreeSpecies|undefined;readonly parts:readonly TreeTemplate[];readonly cpuBytes:number;
 assertCurrent():void;place(resource:Resource,turn:number,size:number):readonly TreePlacement[]|undefined;dispose():void;
}
/** Core owns texture/leases/generation. Reading never prepares or allocates. */
export interface TreeAssetCatalog {
 readonly revision:number;readonly texture:THREE.Texture;readonly pageCount:number;
 readonly modelKeys:readonly string[];readonly slots:readonly TextureSurfaceSlot[];
 assertCurrent():void;
}
