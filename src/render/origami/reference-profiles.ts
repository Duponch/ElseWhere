import * as THREE from 'three/webgpu';
import type {ReferencePaintConfig} from './reference-painter';
import type {ReferencePaintDescriptor} from './reference-paint-library';
import {REFERENCE_PAINT_DESCRIPTORS,REFERENCE_HUMAN_DESCRIPTORS} from './reference-paint-seeds';
import {HUMAN_REFERENCE_PIGMENTS,HUMAN_PAINT_PROFILES} from './human-reference';

/** Zero is reserved for existing assets without a supplied reference model.
 * Canonical assets always use their actual authored colored profile. */
export const GENERIC_REFERENCE_PROFILE=0;
const profiles:ReferencePaintDescriptor[]=[{key:'generic-gouache',config:{baseColor:'#ffffff',secondaryColor:'#ded8cc',strokeStyle:'directional',strokeCount:300},seed:1337}];
const indices=new Map<string,number>([['generic-gouache',0]]);
const canonical=new Map(REFERENCE_PAINT_DESCRIPTORS.map(p=>[p.key,p]));
const humanKeys=['matSkin','matShirt','matOuterwear','matPants','matHair','matHat','matCharcoalGouache','matWeaponWood','matSteelGouache'];
const humanSource:readonly ReferencePaintDescriptor[]=humanKeys.map((key,index)=>REFERENCE_HUMAN_DESCRIPTORS.find(p=>p.key===key)??canonical.get(key)??{key,config:HUMAN_REFERENCE_PIGMENTS[index],seed:1337});

function fromTemplate(key:string,config:ReferencePaintConfig,source?:ReferencePaintDescriptor):ReferencePaintDescriptor {
 return {key,config:{...config},seed:source?.seed??1337,
  ...(source?.sourceIndex!==undefined?{sourceIndex:source.sourceIndex}:{}),
  ...(source?.refreshSeed!==undefined?{refreshSeed:source.refreshSeed}:{}),
 };
}

export function registerReferencePaintProfile(key:string,config:ReferencePaintConfig):number {
 const found=indices.get(key);if(found!==undefined)return found;
 const category=key.startsWith('human:')?Object.keys(HUMAN_PAINT_PROFILES).indexOf(key.split(':')[1]):-1;
 const source=canonical.get(key)??(category>=0?humanSource[category]:undefined);
 const index=profiles.length;
 profiles.push(fromTemplate(key,config,source));indices.set(key,index);return index;
}
// Registration is metadata only. No canvas, GPU allocation or hidden renderer.
for(const descriptor of REFERENCE_PAINT_DESCRIPTORS)registerReferencePaintProfile(descriptor.key,descriptor.config);
export function referencePaintProfiles():readonly ReferencePaintDescriptor[]{return profiles;}
export function referenceProfileCount():number{return profiles.length;}
export function humanBaseProfileIds():readonly number[]{return Object.entries(HUMAN_PAINT_PROFILES).map(([name,index])=>registerReferencePaintProfile(`human:${name}:${HUMAN_REFERENCE_PIGMENTS[index].baseColor}`,HUMAN_REFERENCE_PIGMENTS[index]));}

// Fix the baseline pool before dependent modules can register any variants.
// The descriptor/ID order is generic0, 33 canonical registrations, 9 human
// templates. Later appearances append metadata without mutating this snapshot.
humanBaseProfileIds();
export const BASE_REFERENCE_PAINT_DESCRIPTORS:readonly ReferencePaintDescriptor[]=Object.freeze(profiles.map(descriptor=>Object.freeze({
 ...descriptor,config:Object.freeze({...descriptor.config,
  ...(descriptor.config.gradientTip?{gradientTip:Object.freeze({...descriptor.config.gradientTip})}:{}),
  ...(descriptor.config.flankStripe?{flankStripe:Object.freeze({...descriptor.config.flankStripe})}:{}),
 }),
})));

/** Keep the same authored brush recipe and shade ratios for genuine resident
 * appearance colors. The reference palette itself passes through unchanged. */
export function humanVariantDescriptor(category:number,color:number):ReferencePaintDescriptor {
 const original=HUMAN_REFERENCE_PIGMENTS[category];
 const hex=`#${new THREE.Color(color).getHexString()}`;
 const config:ReferencePaintConfig={...original,baseColor:hex};
 const canonicalBase=new THREE.Color(original.baseColor),target=new THREE.Color(hex);
 const shade=(source:string)=>{const value=new THREE.Color(source);value.r*=target.r/Math.max(.00001,canonicalBase.r);value.g*=target.g/Math.max(.00001,canonicalBase.g);value.b*=target.b/Math.max(.00001,canonicalBase.b);return `#${value.getHexString()}`;};
 if(hex!==original.baseColor){config.secondaryColor=shade(original.secondaryColor);if('accentColor'in original)config.accentColor=shade(original.accentColor);}
 return fromTemplate(`human:${Object.keys(HUMAN_PAINT_PROFILES)[category]}:${hex}`,config,humanSource[category]);
}

/** Global metadata compatibility path; a context may instead keep the pure
 * descriptor above in its own bounded texture-bank palette. */
export function humanVariantProfile(category:number,color:number):number {
 const descriptor=humanVariantDescriptor(category,color);
 return registerReferencePaintProfile(descriptor.key,descriptor.config);
}
