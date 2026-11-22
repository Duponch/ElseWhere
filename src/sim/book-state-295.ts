import {WEAPON_QUALITIES,type WeaponQuality} from './equipment-rules.ts';

/** Core 1.6.4871 Novel facts. HP have one authority: MaterialPile.damage. */
export const NOVEL_ITEM_295='novel' as const;
export const NOVEL_MAX_HIT_POINTS_295=60;
export const NOVEL_TITLE_MAX_LENGTH_295=96;
export const NOVEL_DESCRIPTION_MAX_LENGTH_295=640;
export const NOVEL_JOY_FACTORS_295=Object.freeze([1.2,1.4,1.6,1.8,2,2.25,2.5] as const);
export interface NovelBook295 {revision:1;quality:WeaponQuality;title:string;description:string}
export const novelJoyFactor295=(quality:WeaponQuality):number=>NOVEL_JOY_FACTORS_295[WEAPON_QUALITIES.indexOf(quality)]!;

const text=(v:unknown,max:number):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&v.trim()===v&&!/[\u0000-\u001f\u007f]/.test(v);
/** Strict data-only book state; inspecting a getter must never run its body. */
export function isNovelBook295(value:unknown):value is NovelBook295 {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 try{
  const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)return false;
  const keys=Reflect.ownKeys(value);if(keys.length!==4||keys.some(k=>typeof k!=='string'||!['revision','quality','title','description'].includes(k)))return false;
  const fields=Object.getOwnPropertyDescriptors(value);
  if(keys.some(k=>!fields[k as string]?.enumerable||!Object.hasOwn(fields[k as string]!,'value')))return false;
  return fields.revision!.value===1&&(WEAPON_QUALITIES as readonly unknown[]).includes(fields.quality!.value)
   &&text(fields.title!.value,NOVEL_TITLE_MAX_LENGTH_295)&&text(fields.description!.value,NOVEL_DESCRIPTION_MAX_LENGTH_295);
 }catch{return false;}
}
export function copyNovelBook295(book:NovelBook295):NovelBook295 {
 return {revision:book.revision,quality:book.quality,title:book.title,description:book.description};
}

const TITLE_START=['Le chemin','Le dernier été','La maison','Les voix','Le jardin','La promesse','Le voyage','Les lumières'] as const;
const TITLE_END=['des lucioles','au bord du ciel','de la vallée oubliée','sous la pluie','des jours tranquilles','derrière les collines','de la petite gare','au-delà du fleuve'] as const;
const STORIES=[
 'Une voyageuse suit un ancien sentier et découvre les histoires des personnes qui vivent encore au bord du chemin.',
 'Deux amis se retrouvent après des années et tentent de terminer un ouvrage commencé durant leur enfance.',
 'Dans une maison isolée, une famille apprend à vivre ensemble au rythme des saisons et des visiteurs inattendus.',
 'Un jardin laissé à l’abandon devient le point de rencontre de voisins qui ne se connaissaient pas encore.',
 'Une lettre oubliée conduit une jeune personne de village en village, entre souvenirs et rencontres nouvelles.',
 'Au terme d’un long voyage, une petite communauté décide de construire un nouveau foyer au bord d’un fleuve.',
 'Le gardien d’une gare presque déserte recueille les récits des rares voyageurs et reprend goût au départ.',
 'Deux sœurs échangent leurs souvenirs d’un été et cherchent ce qui les a éloignées sans vraiment les séparer.',
] as const;
/** Read by the lore registry (src/lore); the lists are unchanged. */
export {TITLE_START as NOVEL_TITLE_STARTS_295,TITLE_END as NOVEL_TITLE_ENDS_295,STORIES as NOVEL_STORIES_295};
/** Only quality consumes the commercial stream (two draws, same bounded
 * Gaussian as visitor stock). Original fiction has an identity-local stream;
 * neither lookup nor copying regenerates the saved text. */
export function generateNovelBook295(identity:number,random:()=>number):NovelBook295 {
 if(!Number.isSafeInteger(identity)||identity<=0)throw RangeError('Invalid Novel identity.');
 const draw=()=>{const n=random();if(!Number.isFinite(n)||n<0||n>=1)throw RangeError('Invalid Novel commercial draw.');return n;};
 const gaussian=Math.sqrt(-2*Math.log(Math.max(1/4294967296,draw())))*Math.sin(2*Math.PI*draw());
 const quality=WEAPON_QUALITIES[Math.max(2,Math.min(5,Math.floor(2.5+gaussian)))]!;
 let seed=((identity>>>0)^Math.floor(identity/4294967296)^0xb00c4295)>>>0;if(!seed)seed=1;
 const select=<T>(values:readonly T[]):T=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;seed>>>=0;return values[seed%values.length]!;};
 return {revision:1,quality,title:`${select(TITLE_START)} ${select(TITLE_END)}`,description:select(STORIES)};
}
