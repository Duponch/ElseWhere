/** Highlight tags of the native interface (Core UIHighlighter). A concept or a
 * lesson names tags; every control carrying one of them pulses while the
 * concept is shown. Core builds its tags from the def or designator names
 * (MainTab-Work-Closed, Designator-Mine, ITab-Bills-Closed, TimeControls…);
 * Elsewhere names its own controls the same way. Interface only: a tag is a
 * string, never a World value, a command or a permission. */

/** Core tags ending in -Closed pulse only while their tab or palette is not
 * open (MainButtonWorker, MainTabWindow_Architect, InspectPaneUtility). The
 * same holds here for these families. */
const WHILE_CLOSED=['tab:','tools:','category:','inspector:'] as const;
export const highlightOnlyWhileClosed=(tag:string):boolean=>WHILE_CLOSED.some(prefix=>tag.startsWith(prefix));

/** Native ids whose tag is fixed (inspector actions, panel buttons). */
const BY_ID:Readonly<Record<string,string>>=Object.freeze({
  'map-dock:orders':'tools:orders','map-dock:zones':'tools:zones',
  'hud:alerts:all':'alerts',
  'draft-pawn':'draft',
  'station-bills':'inspector:bills','pane-tab-bills':'inspector:bills','pane-tab-storage':'inspector:storage','shelf-policy':'inspector:storage','stockpile-settings':'inspector:storage',
  'pawn-tab-needs':'inspector:needs','pawn-tab-prisoner':'inspector:prisoner',
  'train-obedience':'animal-training','train-haul':'animal-training',
  'object-action-material-permission':'forbid','equipment-permission':'forbid','egg-permission':'forbid',
  'door-forbidden':'forbid-door',
  'primary-information':'info-card',
  'assign-manage-apparel':'manage-outfits','assign-manage-drugs':'manage-drug-policies',
  'zones-areas-open':'zones:allowed-areas','areas-manage':'zones:allowed-areas',
  'group-formation-open':'world:form-caravan',
  'animal-tame':'tame',
  // Schema 349, the tutorial's lessons: page Next buttons, the plant
  // selector of a growing zone and the storyteller choice of the Menu.
  'generate-world':'next-page','confirm-site':'next-page','start-colony':'next-page',
  'special-crop-select':'growing-plant','menu-choose-storyteller':'choose-storyteller',
});
/** Families of ids, tested in order after the fixed ones. */
const BY_PATTERN:readonly [RegExp,(match:RegExpExecArray)=>string][]=[
  [/^tab:([a-z]+)$/,match=>`tab:${match[1]}`],
  [/^hud:speed:\d+$/,()=>'time-controls'],
  [/^hud:alert:/,()=>'alerts'],
  [/^category-([a-z-]+)$/,match=>`category:${match[1]}`],
  [/^tool-([a-z0-9-]+)-select$/,match=>`tool:${match[1]}`],
  [/^(?:apparel|inventory)-information-\d+$/,()=>'info-card'],
  [/^assign-response-\d+$/,()=>'hostility-response'],
  [/^assign-reading-\d+$/,()=>'reading-policy'],
  [/^wildlife-\d+-tame$/,()=>'tame'],
  [/^tool-([a-z0-9-]+)-material$/,match=>`material:${match[1]}`],
  [/^(?:promote|up)-\d+$/,()=>'reorder-pawn'],
  [/^reroll-\d+$/,()=>'randomize-pawn'],
];
const cache=new Map<string,string|null>();
/** Tag of an existing native control, read from its stable id (no tag:
 * undefined). The explicit `highlight` of a control is added by the stage. */
export function nativeHighlightTag(id:string):string|undefined {
  const known=cache.get(id);
  if(known!==undefined)return known??undefined;
  let tag:string|undefined=BY_ID[id];
  if(tag===undefined)for(const [pattern,name] of BY_PATTERN){const match=pattern.exec(id);if(match){tag=name(match);break;}}
  // Ids are a bounded vocabulary (tables reuse the same per-row patterns).
  if(cache.size>4096)cache.clear();
  cache.set(id,tag??null);
  return tag;
}

/** Tags to pulse for the notions shown in the advice card, deduplicated and
 * sorted (a stable key: equal lists are equal strings). */
export function learningHighlightTags(shown:readonly string[],tagsOf:(id:string)=>readonly string[]|undefined):string[] {
  const tags=new Set<string>();
  for(const id of shown)for(const tag of tagsOf(id)??[])tags.add(tag);
  return [...tags].sort();
}
