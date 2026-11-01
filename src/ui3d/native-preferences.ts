export interface NativeDockPreferences {bottom:boolean;notifications:boolean}
export const NATIVE_DOCK_PREFERENCE_KEY='elsewhere.ui3d.auto-hide.v1';
export const NATIVE_UI_SCALE_PREFERENCE_KEY='elsewhere.ui3d.scale.v1';
export const NATIVE_UI_SCALE_LIMITS={min:.75,max:2,step:.05,default:1} as const;
/** One logical scale shared by scene layout and pointer conversion. This is a
 * display preference only; it never enters a colony or campaign save. */
export function normalizeNativeUiScale(value:number):number {
 if(!Number.isFinite(value))return NATIVE_UI_SCALE_LIMITS.default;
 return Math.round(Math.max(NATIVE_UI_SCALE_LIMITS.min,Math.min(NATIVE_UI_SCALE_LIMITS.max,value))*20)/20;
}
export function parseNativeUiScale(raw:string|null):number {
 try{const value:unknown=raw===null?undefined:JSON.parse(raw);if(typeof value==='number')return normalizeNativeUiScale(value);}catch{ /* Keep the default if browser storage is unreadable. */ }
 return NATIVE_UI_SCALE_LIMITS.default;
}
export function parseNativeDockPreferences(raw:string|null):NativeDockPreferences {
 try{const value:unknown=raw?JSON.parse(raw):undefined;if(value&&typeof value==='object')return {bottom:'bottom'in value&&value.bottom===true,notifications:'notifications'in value&&value.notifications===true};}catch{ /* Keep visible controls when storage is unreadable. */ }
 return {bottom:false,notifications:false};
}

export type GraphicsStyle='default'|'origami';
export interface GraphicsStylePreferences {
 style:GraphicsStyle;
 impasto:number;
 edges:number;
 wear:number;
 contourImperfection:number;
}
/** Browser display preference, deliberately separate from World and save data. */
export const GRAPHICS_STYLE_PREFERENCE_KEY='elsewhere.graphics-style.v1';
export const DEFAULT_GRAPHICS_STYLE_PREFERENCES:Readonly<GraphicsStylePreferences>=Object.freeze({style:'default',impasto:1,edges:.65,wear:.75,contourImperfection:.60});
export const ORIGAMI_STYLE_CONTROLS=[
 {key:'impasto',label:'Relief empâtement gouache',min:0,max:2.2,step:.01},
 {key:'edges',label:'Arêtes et pliures carton kraft',min:0,max:1,step:.01},
 {key:'wear',label:'Usure et écaillage des arêtes',min:0,max:1,step:.01},
 {key:'contourImperfection',label:'Imperfection du remplissage des contours',min:0,max:1,step:.01},
] as const;
export function normalizeGraphicsStylePreferences(value:unknown):GraphicsStylePreferences {
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const result:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:data.style==='origami'?'origami':'default'};
 for(const {key,min,max} of ORIGAMI_STYLE_CONTROLS){
  const number=data[key];
  result[key]=typeof number==='number'&&Number.isFinite(number)?Math.max(min,Math.min(max,number)):DEFAULT_GRAPHICS_STYLE_PREFERENCES[key];
 }
 return result;
}
export function parseGraphicsStylePreferences(raw:string|null):GraphicsStylePreferences {
 try{return normalizeGraphicsStylePreferences(raw===null?undefined:JSON.parse(raw));}catch{return normalizeGraphicsStylePreferences(undefined);}
}
