/** Presentation-only user preference. No save migration or per-frame palette work. */
export interface UiTheme {background:string;text:string}
export const UI_THEME_PREFERENCE_KEY='elsewhere.ui-theme.v1';
export const DEFAULT_UI_THEME:Readonly<UiTheme>=Object.freeze({background:'#f3ead6',text:'#261e18'});
export const UI_THEME_PRESETS:readonly {label:string;theme:UiTheme}[]=Object.freeze([
 {label:'Papier',theme:{...DEFAULT_UI_THEME}},
 {label:'Sombre',theme:{background:'#252b30',text:'#f2ead9'}},
 {label:'Clair',theme:{background:'#f8f8f3',text:'#263039'}},
]);
export function uiThemeHex(value:unknown):string|undefined {
 if(typeof value!=='string')return;const s=value.trim().toLowerCase();return /^#?[\da-f]{6}$/u.test(s)?'#'+s.replace(/^#/,''):undefined;
}
export function normalizeUiTheme(value:unknown):UiTheme {
 const row=value&&typeof value==='object'&&!Array.isArray(value)?value as Partial<UiTheme>:{};
 return {background:uiThemeHex(row.background)??DEFAULT_UI_THEME.background,text:uiThemeHex(row.text)??DEFAULT_UI_THEME.text};
}
export function parseUiTheme(value:string|null):UiTheme{try{return normalizeUiTheme(JSON.parse(value??'null'));}catch{return {...DEFAULT_UI_THEME};}}
export const isDefaultUiTheme=(theme:UiTheme)=>theme.background===DEFAULT_UI_THEME.background&&theme.text===DEFAULT_UI_THEME.text;
type RGB=readonly [number,number,number];
function rgb(hex:string):RGB {const value=parseInt(hex.slice(1),16);return [(value>>16)&255,(value>>8)&255,value&255];}
function hex(rgb:RGB):string{return '#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');}
export function mixUiColor(a:string,b:string,t:number):string{const x=rgb(uiThemeHex(a)??DEFAULT_UI_THEME.background),y=rgb(uiThemeHex(b)??DEFAULT_UI_THEME.text);return hex([x[0]+(y[0]-x[0])*t,x[1]+(y[1]-x[1])*t,x[2]+(y[2]-x[2])*t]);}
export function uiColorLuminance(color:string):number{const [r,g,b]=rgb(uiThemeHex(color)??DEFAULT_UI_THEME.text).map(v=>{const x=v/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return r!*.2126+g!*.7152+b!*.0722;}
export function uiContrast(a:string,b:string):number{const x=uiColorLuminance(a),y=uiColorLuminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
/** Preserve the requested hue whenever possible, moving only as far towards
 * the more legible endpoint as necessary. White-on-white cannot hide controls. */
export function readableUiInk(foreground:string,background:string,ratio=4.5):string{
 const fg=uiThemeHex(foreground)??DEFAULT_UI_THEME.text,bg=uiThemeHex(background)??DEFAULT_UI_THEME.background;
 if(uiContrast(fg,bg)>=ratio)return fg;
 const end=uiContrast('#000000',bg)>uiContrast('#ffffff',bg)?'#000000':'#ffffff';
 let lo=0,hi=1;for(let i=0;i<14;i++){const m=(lo+hi)*.5;if(uiContrast(mixUiColor(fg,end,m),bg)>=ratio)hi=m;else lo=m;}
 return mixUiColor(fg,end,hi);
}
/** Tint a secondary surface without losing the chosen text contrast. */
export function uiTintedSurface(background:string,ink:string,tint:string,strength:number):string{
 let lo=0,hi=Math.min(1,Math.max(0,strength));if(uiContrast(ink,mixUiColor(background,tint,hi))>=4.5)return mixUiColor(background,tint,hi);
 for(let i=0;i<14;i++){const m=(lo+hi)*.5;if(uiContrast(ink,mixUiColor(background,tint,m))>=4.5)lo=m;else hi=m;}
 return mixUiColor(background,tint,lo);
}
export const uiInkWash=(ink:string,alpha:number)=>{const [r,g,b]=rgb(ink);return `rgba(${r},${g},${b},${alpha})`;};
/** DOM recovery interface uses its usual variables; default leaves the existing
 * artwork intact. Only invoked on startup or an explicit preference change. */
export function applyDomUiTheme(theme:UiTheme,root:HTMLElement=document.documentElement):void{
 const bg=theme.background,ink=readableUiInk(theme.text,bg),dark=uiColorLuminance(bg)<.35;
 const surface=(color:string,amount:number)=>uiTintedSurface(bg,ink,color,amount);
 const vars:Record<string,string>={'--ui-theme-bg':bg,'--ui-theme-text':ink,'--paper':bg,'--paper-deep':surface(ink,.12),'--paper-white':surface(dark?'#000000':'#ffffff',.12),'--panel':'var(--paper)','--ink':ink,'--muted-ink':readableUiInk(mixUiColor(ink,bg,.24),bg),'--muted':'var(--muted-ink)','--line':mixUiColor(bg,ink,.32),'--track':surface(ink,.18),'--forest':readableUiInk('#176f53',bg),'--accent':readableUiInk('#236cc3',bg),'--danger':readableUiInk('#b23845',bg),'--success':readableUiInk('#176f53',bg),'--sun-soft':surface('#ffc23c',.20),'--leaf-soft':surface('#2fc98e',.20),'--sky-soft':surface('#3e9bff',.20),'--coral-soft':surface('#ff6b5e',.20),'--hud-sky':surface('#3e9bff',.44),'--leaf':surface('#2fc98e',.44),'--sun':surface('#ffc23c',.44),'--coral':surface('#ff6b5e',.44)};
 for(const [key,value]of Object.entries(vars)){if(isDefaultUiTheme(theme))root.style.removeProperty(key);else root.style.setProperty(key,value);}
 if(isDefaultUiTheme(theme)){root.style.removeProperty('color-scheme');root.removeAttribute('data-ui-theme');}else{root.style.setProperty('color-scheme',dark?'dark':'light');root.setAttribute('data-ui-theme',dark?'dark':'light');}
}
