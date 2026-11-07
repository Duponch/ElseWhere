import {modelIconUrl,pictogramDataUrl} from './pictograms';
import {ROAD_FLAGSTONES_256} from '../sim/road-ground-256';
const ATLAS_COLUMNS = 6;
const ATLAS_ROWS = 5;

export const ARCHITECT_ICON_ATLASES = [
  '/assets/ui/elsewhere/v304/architect-1.svg',
  '/assets/ui/elsewhere/v304/architect-2.svg',
] as const;

const FIRST_ATLAS = [
  'wood-planks', 'granite-tile', 'limestone-tile', 'marble-tile', 'sandstone-tile', 'slate-tile',
  'steel-tile', 'remove-floor', 'grave', 'select', 'mine', 'haul-chunks',
  'chop', 'harvest', 'cut', 'uninstall', 'deconstruct', 'cancel',
  'door', 'wall', 'bed', 'table', 'table-square', 'table-long',
  'dining-chair', 'armchair', 'end-table', 'dresser', 'flower-pot', 'horseshoes',
] as const;

const SECOND_ATLAS = [
  'heater', 'wind-turbine', 'cooler', 'wood-generator', 'power-conduit', 'power-switch',
  'battery', 'solar-generator', 'standing-lamp', 'passive-cooler', 'campfire', 'research-bench',
  'tailor-bench', 'electric-tailor-bench', 'crafting-spot', 'fueled-stove', 'electric-stove', 'butcher-table',
  'butcher-spot', 'stonecutter', 'stool', 'growing', 'build-roof', 'remove-roof',
  'ignore-roof', 'remove-growing', 'stockpile', 'home', 'remove-home', 'remove-stockpile',
] as const;
export const ARCHITECT_ATLAS_IDS=Object.freeze([FIRST_ATLAS,SECOND_ATLAS]);

export const ARCHITECT_ICON_ORDER = Object.freeze([...FIRST_ATLAS.flatMap(id=>id==='door'?[id,'autodoor']:id==='wall'?[id,'spike-trap','mini-turret','sandbags','fence','fence-gate','pen-marker']:id==='dresser'?[id,'shelf','small-shelf']:id==='bed'?[id,'cryptosleep-casket','bedroll','sleeping-spot','double-bed','hospital-bed','vitals-monitor','animal-sleeping-spot']:id==='steel-tile'?[id,'sterile-tile']:id==='horseshoes'?[id,'chess-table','tube-television']:[id]), ...SECOND_ATLAS.flatMap(id=>id==='solar-generator'?[id,'geothermal-generator']:id==='standing-lamp'?[id,'sun-lamp']:id==='growing'?[id,'hydroponics-basin']:id==='tailor-bench'?[id,'electric-crematorium','electric-smelter','biofuel-refinery','fueled-smithy','electric-smithy','brewery','fermenting-barrel','chemfuel-generator','nutrient-paste-dispenser','hopper','orbital-beacon','comms-console','deep-drill','ground-scanner','drug-lab','art-bench','machining-table','hi-tech-research-bench','multi-analyzer','fabrication-bench']:[id]),'smooth-floor','snow-clear','remove-snow-clear','build-bridge','remove-bridge','vent','torch-lamp',...ROAD_FLAGSTONES_256,'ship-reactor','ship-beam','ship-engine','ship-cryptosleep-casket','ship-computer','ship-sensors','firefoam-popper','column','urn','stele-large','stele-grand','sarcophagus','ancient-road-barrier','ancient-road-lamp','allow','forbid']);
/** Every visible tool has its own model/action image. The old sheet addresses
 * below remain solely the fixed world-marker UV layout. */
export const ARCHITECT_ICON_URLS:Readonly<Record<string,string>>=Object.freeze(Object.fromEntries(ARCHITECT_ICON_ORDER.map(id=>[id,id==='smooth-floor'||id==='snow-clear'||id==='remove-snow-clear'||id==='build-bridge'||id==='remove-bridge'?pictogramDataUrl(id):modelIconUrl(id)])));

// Small original vector additions share the existing Architecte icon installer.
// They do not change the historical two-atlas coordinates.
const vectorIcon=(body:string):string=>`url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><g fill="none" stroke="#365647" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`)}")`;
const CUSTOM_ICONS:Readonly<Record<string,string>>=Object.freeze({
  'cryptosleep-casket':vectorIcon('<path d="M12 5h16l4 5v24H8V10z" fill="#b9c8bd"/><path d="M14 11h12v16H14z" fill="#668e91"/><path d="M14 30h12M8 35h24"/><circle cx="20" cy="8" r="1"/>'),
  'biofuel-refinery':vectorIcon('<path d="M5 32h30M8 32V13h9v19M23 32V13h9v19M8 13l2-6h5l2 6M23 13l2-6h5l2 6M17 18h6M17 25h6M11 17h3M26 17h3" fill="#c3c3a1"/><path d="M17 31v-7h6v7" fill="#a3baaa"/>'),
  'chemfuel-generator':vectorIcon('<path d="M4 33h32M7 33V13h18v20M11 18h10M11 23h10M11 28h10M28 33V14h6v19M28 14v-4h6v4M8 13V8h5v5" fill="#aec0aa"/><path d="m17 16-4 7h4l-2 7 7-10h-4l2-4" stroke="#987b4e"/>'),
  'nutrient-paste-dispenser':vectorIcon('<path d="M6 4h28v31H6zM10 8h7v12h-7zM23 8h7v12h-7zM15 24h10v8H15zM12 34h16" fill="#b8c6b0"/><path d="M19 27h2" stroke="#47766b"/>'),
  hopper:vectorIcon('<path d="M5 11h30l-6 20H11zM5 11l7-5h16l7 5M11 31v5M29 31v5M10 14h20" fill="#c7c9aa"/><path d="M15 19h10M18 24h4" stroke="#7a9869"/>'),
  'orbital-beacon':vectorIcon('<path d="M7 31h26M12 24h16M20 24v10M8 16l12 8 12-8M20 16V6M13 6l7 5 7-5"/><circle cx="20" cy="4" r="2" fill="#b8cc9e"/>'),
  'comms-console':vectorIcon('<path d="M4 30h32M7 30v6M33 30v6M7 8h26v15H7zM11 12h18v7H11zM9 26h22"/><path d="M15 15h10" stroke="#63a995"/>'),
  'deep-drill':vectorIcon('<path d="M7 34h26M10 30V8h20v22M15 9l10 7-10 7 10 7M20 3v5M20 30v7"/><path d="M9 24H5v9h7M28 24h7v9h-7" fill="#a9b9ac"/>'),
  'ground-scanner':vectorIcon('<path d="M5 32h30M9 32V18h22v14M20 18V7M8 6l24 8M11 5l-2 7M20 7l-2 8M29 10l-2 8M13 23h14v6H13z"/><path d="M15 26h10" stroke="#63a995"/>'),
  'vitals-monitor':vectorIcon('<rect x="5" y="6" width="30" height="20" rx="2" fill="#b6c9c4"/><path d="M9 17h5l3-7 4 12 3-5h7M20 27v7M12 35h16"/><path d="M10 17h4l3-7 4 12 3-5h6" stroke="#63a995"/>'),
  'sterile-tile':vectorIcon('<path d="M3 15 20 5l17 10-17 10zM3 15v10l17 10 17-10V15M20 25v10M12 10l17 10M11 20 28 10" fill="#cadbd8"/><path d="M20 10v10M15 15h10" stroke="#6b9693"/>'),
  'drug-lab':vectorIcon('<path d="M5 29h30M8 29v7M32 29v7M11 5v9L5 25h17l-6-11V5M8 5h11M8 21h11M29 8v8l-4 8h11l-4-8V8M26 8h9"/><path d="M8 22h11M28 20h5" stroke="#70aaa2"/>'),
  'hydroponics-basin':vectorIcon('<rect x="4" y="18" width="32" height="13" rx="2" fill="#b6c9c4"/><path d="M6 24h28M11 18v13M20 18v13M29 18v13M7 32v3M33 32v3"/><path d="M15 19v-8m0 4c-5 0-6-4-6-6 4 0 6 2 6 6m0-1c0-4 3-6 6-6 0 4-2 6-6 6M26 19v-6m0 3c-4 0-5-3-5-5 3 0 5 2 5 5" stroke="#628564"/>'),
  'tube-television':vectorIcon('<rect x="5" y="10" width="30" height="22" rx="4" fill="#b9aa8e"/><rect x="9" y="14" width="19" height="14" rx="3" fill="#a9cec6"/><circle cx="31" cy="17" r="1"/><circle cx="31" cy="24" r="1"/><path d="M11 33v3M29 33v3M15 5l5 5 6-6"/>'),
  sandbags:vectorIcon('<rect x="5" y="24" width="15" height="9" rx="3" fill="#d7cba5"/><rect x="20" y="24" width="15" height="9" rx="3" fill="#cec19b"/><rect x="10" y="15" width="20" height="9" rx="3" fill="#e0d4b3"/><path d="M8 29h9M23 29h9M14 20h12" stroke="#a99e7e" stroke-width="1"/>'),
  'hospital-bed':vectorIcon('<path d="M6 18v16M34 18v16M6 27h28M10 18h20v9H10zM6 20h4M30 20h4M12 17v-4h7v4"/><path d="M26 5v10M21 10h10" stroke="#6d9f99"/><path d="M9 31h22"/>'),
  'sun-lamp':vectorIcon('<path d="M8 9h24l3 6H5zM20 15v19M13 35h14M10 20l-2 5M30 20l2 5M15 20v4M25 20v4"/><path d="M24 32c0-5 4-6 8-5-1 4-4 6-8 5M24 32l5-3" fill="#b8cc9e"/>'),
  autodoor:vectorIcon('<path d="M5 7h30v29H5zM10 12h9v20h-9zM21 12h9v20h-9zM20 8v27"/><path d="m25 16-3 5h3l-2 5 5-7h-3l2-3"/><circle cx="7.5" cy="20" r="1.3" fill="#365647" stroke="none"/>'),
  fence:vectorIcon('<path d="M5 9v27M20 9v27M35 9v27M5 15h30M5 29h30"/><path d="M5 9l3 3M20 9l3 3M35 9l-3 3"/>'),
  'fence-gate':vectorIcon('<path d="M5 9v27M35 9v27M5 15h30M5 29h30M12 15v14M28 15v14M20 16v13"/><circle cx="24" cy="23" r="1" fill="#365647"/>'),
  'pen-marker':vectorIcon('<path d="M20 8v28M11 12h18v16H11zM15 16c2-2 4-2 5 0 1-2 3-2 5 0M16 23h8"/>'),
  'chess-table':vectorIcon('<rect x="5" y="5" width="30" height="30" rx="2"/><path d="M12.5 5v30M20 5v30M27.5 5v30M5 12.5h30M5 20h30M5 27.5h30" stroke-width="1"/><path d="M13 7h6v5h-6zM28 7h5v5h-5zM6 13h6v6H6zM21 13h6v6h-6zM13 21h6v6h-6zM28 21h5v6h-5zM6 28h6v5H6zM21 28h6v5h-6z" fill="#365647" stroke="none"/><circle cx="9" cy="9" r="2" fill="#e6c989" stroke="none"/><circle cx="31" cy="31" r="2" fill="#e6c989" stroke="none"/>'),
  'hi-tech-research-bench':vectorIcon('<path d="M4 27h32M8 27V12h24v15M13 16h14v8H13zM17 32h6M20 27v5"/><path d="M15 19h10M15 22h7"/>'),
  'multi-analyzer':vectorIcon('<path d="M8 30h24M12 30V11h16v19M16 15h8v10h-8zM19 8h2M6 18h4M30 18h4"/><circle cx="20" cy="20" r="2"/>'),
  'fabrication-bench':vectorIcon('<path d="M4 27h32M8 27V13h24v14M12 18h16M14 21l4-3 4 3 4-3M13 31h3M24 31h3"/><circle cx="20" cy="10" r="2"/>'),
});

export interface ArchitectIconCell {
  readonly atlas: 0 | 1;
  readonly column: number;
  readonly row: number;
}

function atlasCells(ids: readonly string[], atlas: 0 | 1): [string, ArchitectIconCell][] {
  return ids.map((id, index) => [id, {
    atlas,
    column: index % ATLAS_COLUMNS,
    row: Math.floor(index / ATLAS_COLUMNS),
  }]);
}

/** Public mapping doubles as the reviewable row-major atlas manifest. */
const originalCells:Readonly<Record<string,ArchitectIconCell>>=Object.fromEntries([
  ...atlasCells(FIRST_ATLAS, 0),
  ...atlasCells(SECOND_ATLAS, 1),
]);
// New workbenches reuse existing pictured cells; adding tools never shifts the atlas.
export const ARCHITECT_ICON_MAPPING:Readonly<Record<string,ArchitectIconCell>>=Object.freeze(Object.fromEntries(ARCHITECT_ICON_ORDER.map(id=>[id,id==='smooth-floor'?originalCells['remove-floor']!:id.endsWith('-flagstone')?originalCells[id.replace('-flagstone','-tile')]!:id==='brewery'||id==='fermenting-barrel'?originalCells['research-bench']!:id==='ship-cryptosleep-casket'?originalCells.bed!:id==='ship-beam'?originalCells.wall!:id==='ship-engine'||id==='ship-reactor'||id==='geothermal-generator'?originalCells['solar-generator']!:id==='torch-lamp'?originalCells['standing-lamp']!:id==='vent'?originalCells.heater!:id==='build-bridge'||id==='remove-bridge'?originalCells['wood-planks']!:id==='shelf'||id==='small-shelf'?originalCells.dresser!:id==='spike-trap'?originalCells.wall!:id==='electric-crematorium'||id==='electric-smelter'?originalCells['electric-stove']!:id==='bedroll'||id==='animal-sleeping-spot'||id==='sleeping-spot'||id==='double-bed'?originalCells.bed!:id==='mini-turret'?originalCells['standing-lamp']!:id==='machining-table'?originalCells['electric-tailor-bench']!:id==='art-bench'?originalCells.stonecutter!:CUSTOM_ICONS[id]?originalCells.wall!:(originalCells[id]??originalCells.wall!)])));

export interface ArchitectIconInstallReport {
  readonly installed: readonly string[];
  readonly missing: readonly string[];
  readonly absent: readonly string[];
}

/** Replaces Architect text glyphs after installVisualIdentity has decorated the shared shell. */
export function installArchitectIcons(root: HTMLElement): ArchitectIconInstallReport {
  const installed: string[] = [];
  const missing: string[] = [];
  const present = new Set<string>();

  for (const button of root.querySelectorAll<HTMLElement>('[data-tool]')) {
    const id = button.dataset.tool;
    if (!id) continue;
    present.add(id);
    const url = ARCHITECT_ICON_URLS[id];
    const icon = button.querySelector<HTMLElement>('.tool-icon');
    if (!icon || !url) {
      missing.push(id);
      continue;
    }
    icon.classList.add('ui-icon');
    icon.style.backgroundImage=`url('${url}')`;
    icon.style.backgroundSize='contain';
    icon.style.backgroundPosition='center';
    icon.style.backgroundRepeat = 'no-repeat';
    icon.textContent = '';
    icon.setAttribute('aria-hidden', 'true');
    installed.push(id);
  }

  return {
    installed,
    missing,
    absent: ARCHITECT_ICON_ORDER.filter(id => !present.has(id)),
  };
}
