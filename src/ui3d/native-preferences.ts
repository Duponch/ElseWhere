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
 blackEdges:number;
 edgeWidth:number;
 strokeImperfection:number;
 edges:number;
 wear:number;
 contourImperfection:number;
}
/** Browser display preference, deliberately separate from World and save data. */
export const GRAPHICS_STYLE_PREFERENCE_KEY='elsewhere.graphics-style.v1';
export const DEFAULT_GRAPHICS_STYLE_PREFERENCES:Readonly<GraphicsStylePreferences>=Object.freeze({style:'default',impasto:1,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,edges:0,wear:.75,contourImperfection:.60});
const LEGACY_PAPER_DEFAULTS=Object.freeze({edges:.65,wear:.75,contourImperfection:.60,blackEdges:.45475625});
export const ORIGAMI_STYLE_CONTROLS=[
 {key:'impasto',label:'Relief empâtement gouache',min:0,max:2.2,step:.01,unit:'%'},
 {key:'blackEdges',label:'Contours noirs',min:0,max:1,step:.01,unit:'%'},
 {key:'edges',label:'Contours carton d’origine',min:0,max:1,step:.01,unit:'%'},
 {key:'edgeWidth',label:'Épaisseur des contours',min:.5,max:5,step:.1,unit:'×'},
 {key:'strokeImperfection',label:'Irrégularité du trait',min:0,max:1,step:.01,unit:'%'},
 {key:'wear',label:'Usure et écaillage des arêtes',min:0,max:1,step:.01,unit:'%'},
 {key:'contourImperfection',label:'Imperfection du remplissage des contours',min:0,max:1,step:.01,unit:'%'},
] as const;
export type OrigamiStyleControl=typeof ORIGAMI_STYLE_CONTROLS[number];
export function origamiStyleDisplayScale(control:Pick<OrigamiStyleControl,'unit'>):number{return control.unit==='%'?100:1;}
/** All display surfaces use the same units; stored values remain renderer units. */
export function formatOrigamiStyleValue(control:Pick<OrigamiStyleControl,'unit'>,value:number):string {
 return `${control.unit==='%'?Math.round(value*100):Math.round(value*10)/10} ${control.unit}`;
}
export function normalizeGraphicsStylePreferences(value:unknown):GraphicsStylePreferences {
 const data=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 const result:GraphicsStylePreferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:data.style==='origami'?'origami':'default'};
 for(const {key,min,max} of ORIGAMI_STYLE_CONTROLS){
  const number=data[key];
  result[key]=typeof number==='number'&&Number.isFinite(number)?Math.max(min,Math.min(max,number)):DEFAULT_GRAPHICS_STYLE_PREFERENCES[key];
 }
 const legacyPaperKeys=['edges','wear','contourImperfection'] as const;
 const hasLegacyPaper=legacyPaperKeys.some(key=>typeof data[key]==='number'&&Number.isFinite(data[key]));
 if(!Object.hasOwn(data,'blackEdges')&&!Object.hasOwn(data,'edgeWidth')&&!Object.hasOwn(data,'strokeImperfection')&&hasLegacyPaper){
  // Old v1 preferences linked their visible contour intensity to three paper
  // controls. Preserve that intensity once; the newly stored field then stays
  // independent from subsequent paper/wear/fill edits. New or modern partial
  // records use today's defaults. Genuine pre-black v1 records retain the old
  // paper defaults in this derivation, even when a field was absent/invalid.
  const old=(key:typeof legacyPaperKeys[number]):number=>typeof data[key]==='number'&&Number.isFinite(data[key])?Math.max(0,Math.min(1,data[key] as number)):LEGACY_PAPER_DEFAULTS[key];
  const edges=old('edges'),wear=old('wear'),fill=old('contourImperfection');
  result.blackEdges=edges===LEGACY_PAPER_DEFAULTS.edges&&wear===LEGACY_PAPER_DEFAULTS.wear&&fill===LEGACY_PAPER_DEFAULTS.contourImperfection?LEGACY_PAPER_DEFAULTS.blackEdges:
   edges*(1-Math.min(1,wear*(.2+fill*1.15))*.45);
 }
 return result;
}
export function parseGraphicsStylePreferences(raw:string|null):GraphicsStylePreferences {
 try{return normalizeGraphicsStylePreferences(raw===null?undefined:JSON.parse(raw));}catch{return normalizeGraphicsStylePreferences(undefined);}
}

export type GraphicsStylePipelineKey='default'|`origami:${'relief'|'flat'}:${'wear'|'no-wear'}`;
/** Zero disables a compiled effect. Positive intensity changes keep the same
 * resident graph; Default never rebuilds for inactive Origami preferences. */
export function graphicsStylePipelineKey(value:unknown):GraphicsStylePipelineKey {
 const settings=normalizeGraphicsStylePreferences(value);
 return settings.style==='default'?'default':`origami:${settings.impasto===0?'flat':'relief'}:${settings.wear===0?'no-wear':'wear'}`;
}
export function requiresGraphicsStyleRebuild(previous:unknown,next:unknown):boolean {
 return graphicsStylePipelineKey(previous)!==graphicsStylePipelineKey(next);
}
