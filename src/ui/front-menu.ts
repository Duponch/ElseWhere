import {worldCreationCalendarFacts262} from './world-creation-calendar-262';
import {startingOriginalRequestFromRoster256} from '../sim/starting-original-request-256';
import {createWorldCreationFlow256} from './world-creation-flow';
import {createWorldDraftParameters,defaultWorldCreationSettings,type WorldDraftParameters} from './world-draft-controls';
import {createWorldCreationSite256} from './world-creation-site';
import type {WorldCreationCallbacks256,WorldCreationPlayer256,WorldCreationProgress256} from './world-creation-contract';
import {SETTLEMENT_LIMIT_CHOICES,type SettlementLimit} from './settlement-limit-settings';
import {THREAT_PAUSE_CHOICES,type ThreatPauseMode} from './threat-pause-settings';
import { DEFAULT_MAP_SIZE } from '../sim/map-config';
import { AUTOSAVE_MINUTES } from './autosave';
import type { SiteOptions } from '../sim/site';
import {designationMinCellPixels,designationVisibilityLabel} from './designation-visibility';
import {itemLabelMinCellPixels,itemLabelVisibilityLabel} from './item-label-visibility';
import {UI_FONT_CHOICES,DEFAULT_UI_FONT,type UiFontId} from './ui-fonts';
import {DEFAULT_LIGHTING_SETTINGS,LIGHTING_CONTROLS,parseLightingSettings,lightingPercentLabel,type LightingSettings} from '../render/lighting-settings';
import {UI_ATLAS_URL} from './pictograms';
import { randomSiteSeed } from './front-site';
import './front-world.css';
import { createStartingPawnsConfiguration,type StartingPawnsConfiguration } from './front-starting-pawns';
import { createStartingCandidateRoster,startingPartyFromRoster,startingPartyMissingWork,type StartingCandidateDescriptor,type StartingParty } from '../sim/starting-candidates';
import { BACKGROUND_WORK_LABELS } from '../sim/colonist-backgrounds';
import type {StartingWorld} from '../sim/starting-world';
import { testColonyUrl, type TestColony } from './test-colonies';
import './front-menu.css';
import { renderPerformanceLayout, bindRenderPerformanceControls } from './render-performance-controls';
import { DEFAULT_SHADOW_SETTINGS, type ShadowSettings } from '../render/shadow-settings';
import { DEFAULT_ANIMATION_SETTINGS, type AnimationSettings } from '../render/animation-settings';
import {normalizeGraphicsStylePreferences,ORIGAMI_STYLE_CONTROLS,origamiStyleDisplayScale,formatOrigamiStyleValue,type OrigamiStyleControl,type GraphicsStylePreferences} from '../ui3d/native-preferences';

export interface FrontMenuDraft {
  seed: number;
  size: number;
  site: SiteOptions;
  startingParty:StartingParty;
  startingWorld:StartingWorld;
}

export interface FrontMenuSave {
  key: string;
  label: string;
  detail: string;
  disabled?: boolean;
  kind?:'manual'|'recovery'|'named'|'auto';
  savedAt?:number;
}

export interface FrontMenuOptions {
  getGraphicsStylePreferences?:()=>GraphicsStylePreferences;
  onGraphicsStylePreferencesChange?:(value:GraphicsStylePreferences)=>boolean|Promise<boolean>;
  getGraphicsStyleMeasurement?:()=>string;
  onMeasureGraphicsStyle?:()=>Promise<void>;
  canMeasureGraphicsStyle?:()=>boolean;
  getUiAutoHide?:()=>{bottom:boolean;notifications:boolean};
  onUiAutoHideChange?:(value:{bottom:boolean;notifications:boolean})=>boolean;
  getUiScale?:()=>number;
  onUiScaleChange?:(scale:number)=>boolean;
  worldCreation?:WorldCreationCallbacks256;
  getWorldCreationPlayer?:()=>WorldCreationPlayer256;
  getMaxSettlements?:()=>SettlementLimit;getMaxSettlementsPending?:()=>boolean;onMaxSettlementsChange?:(value:SettlementLimit)=>Promise<boolean>;
  getThreatPauseMode?:()=>ThreatPauseMode;getThreatPausePending?:()=>boolean;onThreatPauseModeChange?:(mode:ThreatPauseMode)=>Promise<boolean>;
  getAutosaveMinutes?:()=>number;
  onAutosaveMinutesChange?:(minutes:number)=>boolean;
  onExport?:()=>Promise<void>;
  onHelp?:()=>void;
  getShadowSettings?: () => ShadowSettings;
  onShadowSettingsChange?: (settings: ShadowSettings) => boolean;
  getAnimationSettings?: () => AnimationSettings;
  onAnimationSettingsChange?: (settings: AnimationSettings) => boolean;
  getUiFont?:()=>UiFontId;
  onUiFontChange?:(font:UiFontId)=>void;
  getDecorOcclusion?:()=>boolean;
  onDecorOcclusionChange?:(enabled:boolean)=>boolean;
  getDesignationMinCellPixels?: () => number;
  getItemLabelMinCellPixels?: () => number;
  onItemLabelMinCellPixelsChange?: (value:number) => boolean;
  onDesignationMinCellPixelsChange?: (value:number) => boolean;
  onStart: (draft: FrontMenuDraft) => Promise<void>;
  onLoad: (key: string) => Promise<void>;
  onResume: () => Promise<void>;
  getTexturesEnabled: () => boolean;
  onTexturesEnabledChange: (enabled: boolean) => boolean;
  getGroundGrassEnabled: () => boolean;
  onGroundGrassEnabledChange: (enabled: boolean) => boolean;
  getDioramaEnabled: () => boolean;
  onDioramaEnabledChange: (enabled: boolean) => boolean;
  getRoomEnabled: () => boolean;
  onRoomEnabledChange: (enabled: boolean) => boolean;
  getLightingSettings: () => LightingSettings;
  onLightingSettingsChange: (settings: LightingSettings) => boolean;
  getSoundEnabled: () => boolean;
  onSoundEnabledChange: (enabled: boolean) => boolean;
  getSoundVolume: () => number;
  onSoundVolumeChange: (volume: number) => boolean;
  onTestSound: () => Promise<void>;
  getMusicEnabled: () => boolean;
  onMusicEnabledChange: (enabled: boolean) => boolean;
  getMusicVolume: () => number;
  onMusicVolumeChange: (volume: number) => boolean;
  getSaves: () => FrontMenuSave[];
  getTestColonies: () => Promise<TestColony[]>;
  onLoadTest: (save: TestColony) => Promise<void>;
  onImport: (file: File) => Promise<void>;
}

export interface FrontMenu {
  showOptions?():void;
  showHome(hasGame?: boolean): void;
  setHasGame(hasGame: boolean): void;
  showCreation(): void;
  showLoad(): void;
  hide(): void;
  isOpen(): boolean;
  setBusy(busy: boolean, message?: string): void;
  showError(message: string): void;
}

type Page = 'home' | 'scenario' | 'story' | 'world' | 'site' | 'pawns' | 'load' | 'tests' | 'options';
type Control = HTMLButtonElement | HTMLInputElement | HTMLSelectElement;

const scenery = `<svg class="front-landscape" viewBox="0 0 1440 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
  <defs>
    <linearGradient id="front-sky" x2="0" y2="1"><stop stop-color="#0c2329"/><stop offset=".6" stop-color="#647c71"/><stop offset="1" stop-color="#b5a27b"/></linearGradient>
    <linearGradient id="front-river" x2=".6" y2="1"><stop stop-color="#a7bcab"/><stop offset="1" stop-color="#364e48"/></linearGradient>
  </defs>
  <path fill="url(#front-sky)" d="M0 0h1440v1000H0z"/>
  <circle cx="412" cy="244" r="79" fill="#d6c89b" opacity=".65"/>
  <path fill="#819283" d="m0 510 174-118 101 36 207-179 105 140 120-65 182 214 182-110 269 135v437H0z"/>
  <path fill="#bbc0a4" opacity=".48" d="m409 312 73-63 105 140-104-90-28 45z"/>
  <path fill="#526e65" d="m0 541 126-44 144 108 189-119 180 85 180-149 239 194 178-107 204 76v415H0z"/>
  <path fill="#34544d" d="m0 603 102-26 211 157 215-142 234 120 166-108 210 71 302-46v371H0z"/>
  <path fill="url(#front-river)" d="m734 636-77 102 100 74-116 188h303L805 811l-92-89 39-86z"/>
  <path fill="#193e36" d="m0 747 213-73 191 89 156-19 69 76-89 180H0zm1440-69-204 40-156 128-222 154h582z"/>
  <g fill="#132e2a">
    <path d="m-42 778 78-186 75 186H67v43h49L36 640l-77 181H5v47h-47l78-166 80 166H67v132H5V778z"/>
    <path d="m89 856 71-164 71 164h-44v38h50l-77-151-80 151h52v106h55V856z"/>
    <path d="m211 1000 108-257 104 257zM327 816h-19v184h19z"/>
    <path d="m1169 940 79-207 86 207h-61v60h-45v-60zm121-139 83-219 92 219h-64v46h57l-85-183-81 183h56v153h53V801z"/>
  </g>
  <g fill="#d7b578" opacity=".85"><path d="m552 794 15-12 18 12v15h-33z"/><path d="m583 813 10-8 12 8v12h-22z"/></g>
  <path fill="#3b332a" d="m547 795 20-18 23 18-6 3-17-13-14 13zm31 19 15-13 16 13-5 3-11-10-10 10z"/>
</svg>`;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function atlasMark(className: string, column: number, row: number): HTMLSpanElement {
  const mark = element('span', className);
  mark.setAttribute('aria-hidden', 'true');
  mark.style.backgroundImage = `url('${UI_ATLAS_URL}')`;
  mark.style.backgroundSize = '400% 500%';
  mark.style.backgroundPosition = `${column * 100 / 3}% ${row * 25}%`;
  mark.style.backgroundRepeat = 'no-repeat';
  return mark;
}

function action(label: string, handler: () => void, className = ''): HTMLButtonElement {
  const button = element('button', className, label);
  button.type = 'button';
  button.addEventListener('click', handler);
  return button;
}

function unavailable(label: string, note = 'À venir'): HTMLButtonElement {
  const button = element('button', 'front-unavailable', label);
  button.type = 'button';
  button.disabled = true;
  button.title = `${label} : ${note.toLocaleLowerCase('fr')}`;
  button.append(element('span', 'front-choice-note', note));
  return button;
}

/** Presentation only: the caller owns pause acknowledgements, persistence and world publication. */
export function createFrontMenu(host: HTMLElement, options: FrontMenuOptions): FrontMenu {
  const root = element('section', 'front-menu');
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'front-title');
  root.innerHTML = `${scenery}<div class="front-shade" aria-hidden="true"></div>
    <header class="front-top"><span class="front-wordmark">ELSEWHERE</span><span>Un simulateur de colonie</span></header>
    <div class="front-frame">
      <div class="front-heading"><p class="front-eyebrow"></p><h1 id="front-title" tabindex="-1"></h1><ol class="front-steps" aria-label="Étapes de création"></ol></div>
      <div class="front-content"></div>
      <div class="front-feedback"><p class="front-error" role="alert" hidden></p><p class="front-status" role="status" aria-live="polite" hidden></p></div>
      <footer class="front-footer"></footer>
    </div><div class="front-bottom"><span>ELSEWHERE · EN DÉVELOPPEMENT</span><span class="front-pause-note"></span></div>`;
  host.append(root);

  const find = <T extends HTMLElement>(selector: string) => root.querySelector<T>(selector)!;
  const title = find<HTMLHeadingElement>('#front-title');
  const eyebrow = find<HTMLParagraphElement>('.front-eyebrow');
  const steps = find<HTMLOListElement>('.front-steps');
  const content = find<HTMLDivElement>('.front-content');
  const footer = find<HTMLElement>('.front-footer');
  const error = find<HTMLParagraphElement>('.front-error');
  const status = find<HTMLParagraphElement>('.front-status');
  const pauseNote = find<HTMLSpanElement>('.front-pause-note');
  let page: Page = 'home';
  let hasGame = false;
  let busy = false;
  let operationPending = false;
  let previousFocus: HTMLElement | null = null;
  let enabledBeforeBusy: Control[] = [];
  let seed = '';
  const backend=options.worldCreation;
  const worldCreation=backend&&typeof backend.generate==='function'&&typeof backend.confirmSite==='function'&&typeof backend.start==='function'?createWorldCreationFlow256(backend):undefined;
  let worldParameters:WorldDraftParameters={seed:'',settings:defaultWorldCreationSettings(),size:250,season:'auto'};
  let worldGenerationRun=0;
  let selectedTile:number|null=null;
  let teamSeed=0;
  let roster:StartingCandidateDescriptor[]=[];
  let disposePage:(()=>void)|undefined;
  let disposeDialog:(()=>void)|undefined;
  let pawnsPage:StartingPawnsConfiguration|undefined;
  let difficultyChosen = false;
  let reloadChosen = false;
  let selectedSave: string | undefined;
  let homeResume: HTMLButtonElement | undefined;
  let homeStart: HTMLButtonElement | undefined;

  function clearError(): void {
    error.hidden = true;
    error.textContent = '';
  }

  function showError(message: string): void {
    error.textContent = message;
    error.hidden = false;
  }

  function setBusy(next: boolean, message = 'Préparation de la colonie…'): void {
    if (next && !busy) {
      enabledBeforeBusy = [...root.querySelectorAll<Control>('button, input, select')].filter(control => !control.disabled);
      for (const control of enabledBeforeBusy) control.disabled = true;
    } else if (!next && busy) {
      for (const control of enabledBeforeBusy) if (control.isConnected) control.disabled = false;
      enabledBeforeBusy = [];
    }
    busy = next;
    content.inert=next;
    pawnsPage?.setBusy(next);
    root.setAttribute('aria-busy', String(busy));
    status.hidden = !busy;
    status.textContent = busy ? message : '';
  }

  async function run(operation: () => Promise<void>, message: string): Promise<void> {
    if (busy || operationPending) return;
    operationPending = true;
    clearError();
    setBusy(true, message);
    try {
      await operation();
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : 'L’opération a échoué. Vos choix et vos sauvegardes sont conservés.');
    } finally {
      operationPending = false;
      setBusy(false);
      if (!root.hidden && !root.contains(document.activeElement)) title.focus();
    }
  }

  function reveal(): void {
    if (root.hidden) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    root.hidden = false;
    pauseNote.textContent = hasGame ? 'COLONIE EN PAUSE' : '';
  }

  function navigate(next: Page): void {
    if (busy || operationPending) return;
    disposeDialog?.();disposeDialog=undefined;
    disposePage?.();disposePage=undefined;pawnsPage=undefined;
    if((page==='site'&&next==='world')||(['world','site','pawns'].includes(page)&&!['world','site','pawns'].includes(next))){worldCreation?.cancel();selectedTile=null;}
    page = next;
    clearError();
    content.replaceChildren();
    footer.replaceChildren();
    steps.replaceChildren();
    root.dataset.page = page;
    eyebrow.textContent = page === 'home' ? 'UNE HISTOIRE À CONSTRUIRE' : page === 'tests' ? 'EXPLORER ET ESSAYER' : page === 'load' ? 'VOS COLONIES' : page === 'options' ? 'PRÉFÉRENCES LOCALES' : 'NOUVELLE PARTIE';
    title.textContent = { home: 'Elsewhere', scenario: 'Choisir un scénario', story: 'Choisir votre narrateur', world:'Créer un monde',site:'Choisir un lieu de départ',pawns:'Créer les personnages',load: 'Charger une partie', tests: 'Colonies de test', options: 'Options' }[page];
    if (page === 'home') renderHome();
    else if (page === 'scenario') renderScenario();
    else if (page === 'story') renderStory();
    else if (page === 'world') renderWorld();
    else if (page === 'site') renderSite();
    else if (page === 'pawns') renderPawns();
    else if (page === 'tests') renderTests();
    else if (page === 'options') renderOptions();
    else renderLoad();
    reveal();
    title.focus({ preventScroll: true });
    content.scrollTop = 0;
  }

  function resumeAction(): HTMLButtonElement {
    return action('Reprendre la colonie', () => {
      if (hasGame) void run(options.onResume, 'Reprise de la colonie…');
    }, 'front-primary');
  }

  function renderHome(): void {
    const intro = element('div', 'front-home-intro');
    intro.append(element('p', '', 'Trois vies. Un nouveau foyer.'), element('p', 'front-home-subtitle', 'À vous d’écrire la suite.'));
    const nav = element('nav', 'front-home-actions');
    nav.setAttribute('aria-label', 'Menu principal');
    homeResume = hasGame ? resumeAction() : undefined;
    if (homeResume) nav.append(homeResume);
    homeStart = action('Nouvelle partie', showCreation, hasGame ? '' : 'front-primary');
    nav.append(homeStart, action('Charger une partie', showLoad));
    if (options.onHelp) nav.append(action('Aide', () => {
      if (busy || operationPending) return;
      options.onHelp?.();
    }));
    const later = element('div', 'front-later');
    later.append(unavailable('Tutoriel'), action('Options', () => navigate('options')), unavailable('Mods'), unavailable('Crédits'));
    nav.append(later);
    content.append(intro, nav);
  }

  function renderOptions(): void {
    const card = element('section', 'front-card front-options');
    if(options.getAutosaveMinutes&&options.onAutosaveMinutesChange){
      card.append(element('h2','','Sauvegardes'));
      const setting=element('label','front-relief front-texture-setting');
      const select=element('select');select.id='front-autosave-minutes';
      for(const minutes of AUTOSAVE_MINUTES){const choice=element('option','',minutes===0?'Désactivée':`${minutes} min`);choice.value=String(minutes);select.append(choice);}
      select.value=String(options.getAutosaveMinutes());
      const text=element('span');text.append(element('strong','','Sauvegarde automatique'),element('span','','Minutes réelles de jeu actif. Trois copies conservées dans ce navigateur.'));
      select.addEventListener('change',()=>{
        clearError();if(!options.onAutosaveMinutesChange!(Number(select.value)))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver.');
      });
      setting.append(select,text);card.append(setting);
    }
    if(options.getThreatPauseMode&&options.onThreatPauseModeChange){
      card.append(element('h2','','Jeu'));
      const setting=element('label','front-relief front-texture-setting'),select=element('select'),text=element('span');select.id='front-threat-pause-mode';select.dataset.threatPauseMode='';
      for(const choice of THREAT_PAUSE_CHOICES){const option=element('option','',choice.label);option.value=choice.value;select.append(option);}
      const title=element('strong','','Pause automatique'),description=element('span','','Nouvelles menaces sur les cartes de la partie. La vue actuelle est conservée.'),status=element('span');status.dataset.threatPauseStatus='';status.setAttribute('role','status');
      title.id='front-threat-pause-label';description.id='front-threat-pause-description';select.setAttribute('aria-labelledby',title.id);select.setAttribute('aria-describedby',description.id);
      select.value=options.getThreatPauseMode();select.disabled=options.getThreatPausePending?.()??false;status.textContent=select.disabled?'Application du choix en attente…':'';
      select.addEventListener('change',async()=>{const mode=select.value as ThreatPauseMode;select.value=options.getThreatPauseMode!();select.disabled=true;clearError();
        try{if(!await options.onThreatPauseModeChange!(mode))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');}
        catch(cause){showError(cause instanceof Error?cause.message:String(cause));}
        finally{select.value=options.getThreatPauseMode!();select.disabled=options.getThreatPausePending?.()??false;}
      });
      text.append(title,description,status);setting.append(select,text);card.append(setting);
    }
    if(options.getMaxSettlements&&options.onMaxSettlementsChange){
      if(!options.getThreatPauseMode)card.append(element('h2','','Jeu'));
      const setting=element('label','front-relief front-texture-setting'),select=element('select'),text=element('span');select.id='front-max-settlements';select.dataset.maxSettlements='';
      for(const value of SETTLEMENT_LIMIT_CHOICES){const option=element('option','',String(value));option.value=String(value);select.append(option);}
      const title=element('strong','','Nombre maximal de colonies'),description=element('span','','Option globale. Les camps ne comptent pas ; diminuer la limite conserve les colonies existantes.'),status=element('span');status.dataset.maxSettlementsStatus='';status.setAttribute('role','status');
      title.id='front-max-settlements-label';description.id='front-max-settlements-description';select.setAttribute('aria-labelledby',title.id);select.setAttribute('aria-describedby',description.id);
      select.value=String(options.getMaxSettlements());select.disabled=options.getMaxSettlementsPending?.()??false;status.textContent=select.disabled?'Application du choix en attente…':'';
      select.addEventListener('change',async()=>{const value=Number(select.value) as SettlementLimit;select.value=String(options.getMaxSettlements!());select.disabled=true;clearError();try{if(!await options.onMaxSettlementsChange!(value))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');}catch(cause){showError(cause instanceof Error?cause.message:String(cause));}finally{select.value=String(options.getMaxSettlements!());select.disabled=options.getMaxSettlementsPending?.()??false;}});
      text.append(title,description,status);setting.append(select,text);card.append(setting);
    }
    card.append(element('h2', '', 'Affichage'));
    if(options.getGraphicsStylePreferences&&options.onGraphicsStylePreferencesChange){
      const current=()=>normalizeGraphicsStylePreferences(options.getGraphicsStylePreferences!());
      const styleSetting=element('label','front-relief front-texture-setting'),style=element('select'),styleText=element('span');
      style.id='front-graphics-style';style.setAttribute('aria-label','Style graphique');
      for(const [value,label] of [['default','Par défaut'],['origami','Origami']] as const){const entry=element('option','',label);entry.value=value;style.append(entry);}
      styleText.append(element('strong','','Style graphique'),element('span','','Choix visuel conservé dans ce navigateur, indépendant des colonies.'));
      styleSetting.append(style,styleText);card.append(styleSetting);
      const controls=element('div','front-origami-settings');controls.setAttribute('role','group');controls.setAttribute('aria-label','Réglages Origami');card.append(controls);
      const sliders:{control:OrigamiStyleControl;slider:HTMLInputElement;output:HTMLOutputElement}[]=[];
      const refresh=()=>{const settings=current();style.value=settings.style;controls.hidden=settings.style!=='origami';for(const {control,slider,output} of sliders){slider.value=String(settings[control.key]*origamiStyleDisplayScale(control));output.textContent=formatOrigamiStyleValue(control,settings[control.key]);}};
      const apply=(patch:Partial<GraphicsStylePreferences>,origamiOnly=false)=>{
        if(root.hidden||page!=='options'||busy||operationPending||!card.isConnected)return;
        const settings=current();if(origamiOnly&&settings.style!=='origami')return;
        void run(async()=>{if(!await options.onGraphicsStylePreferencesChange!(normalizeGraphicsStylePreferences({...settings,...patch})))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');},'Application du style graphique…').finally(refresh);
      };
      style.addEventListener('change',()=>{if(style.value==='default'||style.value==='origami')apply({style:style.value});else refresh();});
      for(const control of ORIGAMI_STYLE_CONTROLS){
        const {key,label,min,max,step}=control,scale=origamiStyleDisplayScale(control);
        const setting=element('label','front-relief front-texture-setting front-volume-setting'),text=element('span'),slider=element('input'),output=element('output');
        slider.id=`front-origami-${key}`;slider.type='range';slider.min=String(min*scale);slider.max=String(max*scale);slider.step=String(step*scale);slider.setAttribute('aria-label',label);output.setAttribute('for',slider.id);
        text.append(element('strong','',label),output);setting.append(text,slider);controls.append(setting);sliders.push({control,slider,output});
        slider.addEventListener('input',()=>{const value=Number(slider.value);if(Number.isFinite(value))apply({[key]:value/scale},true);else refresh();});
      }
      refresh();
    }
    if(options.onMeasureGraphicsStyle){
      const information=element('p','front-small',options.getGraphicsStyleMeasurement?.()||'Mettez la colonie en pause pour mesurer les intervalles, les soumissions CPU, les appels et les triangles. GPU non mesuré.');
      information.id='front-graphics-measurement';information.style.whiteSpace='pre-line';
      const measure=action('Mesurer ce style (5 s)',()=>{
        if(root.hidden||page!=='options'||busy||operationPending||!card.isConnected||!options.canMeasureGraphicsStyle?.())return;
        void run(options.onMeasureGraphicsStyle!,'Mesure du style graphique…').finally(()=>{
          if(root.hidden){const failure=error.hidden?'':error.textContent;navigate('options');if(failure)showError(failure);}
          else if(card.isConnected){information.textContent=options.getGraphicsStyleMeasurement?.()||'Mettez la colonie en pause pour mesurer les intervalles, les soumissions CPU, les appels et les triangles. GPU non mesuré.';measure.disabled=!options.canMeasureGraphicsStyle?.();}
        });
      });
      measure.id='front-graphics-measure';measure.disabled=!options.canMeasureGraphicsStyle?.();
      card.append(element('p','front-small','Le changement de style prépare les ressources avant la mesure. La scène sera affichée pendant une seconde de préparation, puis cinq secondes de mesure.'),information,measure);
    }
    const setting = element('label', 'front-relief front-texture-setting');
    const checkbox = element('input');
    checkbox.type = 'checkbox';
    checkbox.checked = options.getTexturesEnabled();
    checkbox.setAttribute('aria-labelledby', 'front-textures-label');
    checkbox.setAttribute('aria-describedby', 'front-textures-description');
    checkbox.addEventListener('change', () => {
      clearError();
      if (!options.onTexturesEnabledChange(checkbox.checked)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    const text = element('span');
    const label = element('strong', '', 'Textures 3D stylisées');
    label.id = 'front-textures-label';
    const description = element('span', '', 'Détails peints des volumes 3D. Choix conservé dans ce navigateur.');
    description.id = 'front-textures-description';
    text.append(label, description);
    setting.append(checkbox, text);
    card.append(setting);
    const grassSetting = element('label', 'front-relief front-texture-setting');
    const grassCheckbox = element('input');
    grassCheckbox.type = 'checkbox';
    grassCheckbox.checked = options.getGroundGrassEnabled();
    grassCheckbox.setAttribute('aria-labelledby', 'front-ground-grass-label');
    grassCheckbox.setAttribute('aria-describedby', 'front-ground-grass-description');
    grassCheckbox.addEventListener('change', () => {
      clearError();
      if (!options.onGroundGrassEnabledChange(grassCheckbox.checked)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    const grassText = element('span');
    const grassLabel = element('strong', '', 'Tapis d’herbe');
    grassLabel.id = 'front-ground-grass-label';
    const grassDescription = element('span', '', 'Brins décoratifs sur la terre visible. Désactivé : aucun brin ni traitement associé.');
    grassDescription.id = 'front-ground-grass-description';
    grassText.append(grassLabel, grassDescription);
    grassSetting.append(grassCheckbox, grassText);
    card.append(grassSetting);
    const dioramaSetting = element('label', 'front-relief front-texture-setting');
    const dioramaCheckbox = element('input');
    dioramaCheckbox.id = 'front-diorama-enabled';
    dioramaCheckbox.type = 'checkbox';
    dioramaCheckbox.checked = options.getDioramaEnabled();
    dioramaCheckbox.setAttribute('aria-labelledby', 'front-diorama-label');
    dioramaCheckbox.setAttribute('aria-describedby', 'front-diorama-description');
    dioramaCheckbox.addEventListener('change', () => {
      clearError();
      if (!options.onDioramaEnabledChange(dioramaCheckbox.checked)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    const dioramaText = element('span');
    const dioramaLabel = element('strong', '', 'Diorama en carton');
    dioramaLabel.id = 'front-diorama-label';
    const dioramaDescription = element('span', '', 'Table et boîte en carton autour de la carte. Choix conservé dans ce navigateur.');
    dioramaDescription.id = 'front-diorama-description';
    dioramaText.append(dioramaLabel, dioramaDescription);
    dioramaSetting.append(dioramaCheckbox, dioramaText);
    card.append(dioramaSetting);
    const roomSetting = element('label', 'front-relief front-texture-setting');
    const roomCheckbox = element('input');
    roomCheckbox.id = 'front-room-enabled';
    roomCheckbox.type = 'checkbox';
    roomCheckbox.checked = options.getRoomEnabled();
    roomCheckbox.setAttribute('aria-labelledby', 'front-room-label');
    roomCheckbox.setAttribute('aria-describedby', 'front-room-description');
    roomCheckbox.addEventListener('change', () => {
      clearError();
      if (!options.onRoomEnabledChange(roomCheckbox.checked)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    const roomText = element('span');
    const roomLabel = element('strong', '', 'Chambre autour de la carte');
    roomLabel.id = 'front-room-label';
    const roomDescription = element('span', '', 'Décor de chambre autour de la carte, indépendant du diorama. Choix conservé dans ce navigateur.');
    roomDescription.id = 'front-room-description';
    roomText.append(roomLabel, roomDescription);
    roomSetting.append(roomCheckbox, roomText);
    card.append(roomSetting);
    const decorSetting=element('label','front-relief front-texture-setting');
    const decorCheckbox=element('input');decorCheckbox.id='front-decor-occlusion-enabled';decorCheckbox.type='checkbox';
    decorCheckbox.checked=options.getDecorOcclusion?.()??true;
    decorCheckbox.setAttribute('aria-labelledby','front-decor-occlusion-label');
    decorCheckbox.setAttribute('aria-describedby','front-decor-occlusion-description');
    decorCheckbox.addEventListener('change',()=>{clearError();if(options.onDecorOcclusionChange&&!options.onDecorOcclusionChange(decorCheckbox.checked))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');});
    const decorText=element('span'),decorTitle=element('strong','','Masquer le décor devant la carte');decorTitle.id='front-decor-occlusion-label';
    const decorDescription=element('span','','Masque les parties des nuages et suspensions qui passent entre la caméra et le plateau, dans les deux vues.');decorDescription.id='front-decor-occlusion-description';
    decorText.append(decorTitle,decorDescription);decorSetting.append(decorCheckbox,decorText);card.append(decorSetting);
    const lightingSliders: { key: keyof LightingSettings; slider: HTMLInputElement; output: HTMLOutputElement }[] = [];
    const refreshLighting = () => {
      const settings = parseLightingSettings(options.getLightingSettings());
      for (const { key, slider, output } of lightingSliders) {
        slider.value = String(Math.round(settings[key] * 100)); output.textContent = lightingPercentLabel(settings[key]);
      }
    };
    for (const { key, label, description } of LIGHTING_CONTROLS) {
      const setting = element('label', 'front-relief front-texture-setting front-volume-setting'), text = element('span');
      const title = element('strong', '', label); title.id = `front-lighting-${key}-label`;
      const detail = element('span', '', description); detail.id = `front-lighting-${key}-description`;
      const output = element('output'); output.id = `front-lighting-${key}-value`;
      const slider = element('input'); slider.id = `front-lighting-${key}`; slider.type = 'range';
      slider.min = '0'; slider.max = '300'; slider.step = '5';
      slider.setAttribute('aria-labelledby', title.id); slider.setAttribute('aria-describedby', `${detail.id} ${output.id}`);
      lightingSliders.push({ key, slider, output });
      slider.addEventListener('input', () => {
        clearError();
        const stored = options.onLightingSettingsChange({ ...options.getLightingSettings(), [key]: Number(slider.value) / 100 });
        refreshLighting();
        if (!stored) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
      });
      text.append(title, detail, output); setting.append(text, slider); card.append(setting);
    }
    refreshLighting();
    const resetLighting = element('button', 'front-secondary', 'Réinitialiser l’éclairage');
    resetLighting.id = 'front-lighting-reset'; resetLighting.type = 'button';
    resetLighting.addEventListener('click', () => {
      clearError(); const stored = options.onLightingSettingsChange({ ...DEFAULT_LIGHTING_SETTINGS }); refreshLighting();
      if (!stored) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    card.append(resetLighting);
    const iconSetting=element('label','front-relief front-texture-setting front-volume-setting');
    const iconText=element('span');
    const iconLabel=element('strong','','Icônes des ordres');iconLabel.id='front-designation-label';
    const iconDescription=element('span','','Seuil de zoom : 0 les affiche toujours ; sinon elles disparaissent quand une case devient plus petite que ce seuil.');iconDescription.id='front-designation-description';
    const iconOutput=element('output');iconOutput.id='front-designation-value';
    const iconSlider=element('input');iconSlider.id='front-designation-visibility';iconSlider.type='range';iconSlider.min='0';iconSlider.max='96';iconSlider.step='1';
    iconSlider.value=String(designationMinCellPixels(options.getDesignationMinCellPixels?.()));
    iconOutput.textContent=designationVisibilityLabel(Number(iconSlider.value));
    iconSlider.setAttribute('aria-labelledby',iconLabel.id);iconSlider.setAttribute('aria-describedby',`${iconDescription.id} ${iconOutput.id}`);
    iconSlider.addEventListener('input',()=>{
      clearError();const value=designationMinCellPixels(iconSlider.value);
      iconOutput.textContent=designationVisibilityLabel(value);
      if(options.onDesignationMinCellPixelsChange && !options.onDesignationMinCellPixelsChange(value))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    iconText.append(iconLabel,iconDescription,iconOutput);iconSetting.append(iconText,iconSlider);card.append(iconSetting);
    const labelsSetting=element('label','front-relief front-texture-setting front-volume-setting');
    const labelsText=element('span');
    const labelsTitle=element('strong','','Quantités et qualités des objets');labelsTitle.id='front-item-label-label';
    const labelsDescription=element('span','','Seuil de zoom des chiffres et qualités au-dessus des objets. 0 : toujours visibles.');labelsDescription.id='front-item-label-description';
    const labelsOutput=element('output');labelsOutput.id='front-item-label-value';
    const labelsSlider=element('input');labelsSlider.id='front-item-label-visibility';labelsSlider.type='range';labelsSlider.min='0';labelsSlider.max='160';labelsSlider.step='1';
    labelsSlider.value=String(itemLabelMinCellPixels(options.getItemLabelMinCellPixels?.()));labelsOutput.textContent=itemLabelVisibilityLabel(Number(labelsSlider.value));
    labelsSlider.setAttribute('aria-labelledby',labelsTitle.id);labelsSlider.setAttribute('aria-describedby',`${labelsDescription.id} ${labelsOutput.id}`);
    labelsSlider.addEventListener('input',()=>{clearError();const value=itemLabelMinCellPixels(labelsSlider.value);labelsOutput.textContent=itemLabelVisibilityLabel(value);if(options.onItemLabelMinCellPixelsChange&&!options.onItemLabelMinCellPixelsChange(value))showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');});
    labelsText.append(labelsTitle,labelsDescription,labelsOutput);labelsSetting.append(labelsText,labelsSlider);card.append(labelsSetting);
    const fontSetting=element('label','front-relief front-texture-setting');
    const fontText=element('span'),fontTitle=element('strong','','Typographie');fontTitle.id='front-ui-font-label';
    fontText.append(fontTitle,element('span','','Police de toute l’interface. Choix conservé dans ce navigateur.'));
    const fontSelect=element('select');fontSelect.id='front-ui-font';fontSelect.setAttribute('aria-labelledby',fontTitle.id);
    for(const font of UI_FONT_CHOICES){const option=element('option','',font.label);option.value=font.id;fontSelect.append(option);}
    fontSelect.value=options.getUiFont?.()??DEFAULT_UI_FONT;
    fontSelect.addEventListener('change',()=>{clearError();options.onUiFontChange?.(fontSelect.value as UiFontId);});
    fontSetting.append(fontText,fontSelect);card.append(fontSetting);
    content.append(card);
    const performanceCard = element('section', 'front-card front-options presentation-settings');
    performanceCard.append(element('h2', '', 'Performances visuelles'));
    const performanceControls = element('div', 'render-performance-settings');
    performanceControls.innerHTML = renderPerformanceLayout('front-');
    performanceCard.append(performanceControls);content.append(performanceCard);
    bindRenderPerformanceControls(performanceControls, 'front-', {
      getShadows: options.getShadowSettings ?? (() => ({...DEFAULT_SHADOW_SETTINGS})),
      setShadows: settings => options.onShadowSettingsChange?.(settings) ?? true,
      getAnimations: options.getAnimationSettings ?? (() => ({...DEFAULT_ANIMATION_SETTINGS})),
      setAnimations: settings => options.onAnimationSettingsChange?.(settings) ?? true,
      onStorageFailure: () => showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.'),
    });
    const audioCard = element('section', 'front-card front-options');
    audioCard.append(element('h2', '', 'Son'));
    const soundSetting = element('label', 'front-relief front-texture-setting');
    const soundCheckbox = element('input');
    soundCheckbox.type = 'checkbox';
    soundCheckbox.checked = options.getSoundEnabled();
    soundCheckbox.addEventListener('change', () => {
      clearError();
      if (!options.onSoundEnabledChange(soundCheckbox.checked)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    const soundText = element('span');
    soundText.append(element('strong', '', 'Effets sonores'), element('span', '', 'Bruitages et ambiances, indépendants de la musique.'));
    soundSetting.append(soundCheckbox, soundText);
    audioCard.append(soundSetting);
    const volumeSetting = element('label', 'front-relief front-texture-setting front-volume-setting');
    const volumeText = element('span');
    volumeText.append(element('strong', '', 'Volume des effets'));
    const volumeSlider = element('input');
    volumeSlider.type = 'range';
    volumeSlider.min = '0'; volumeSlider.max = '100'; volumeSlider.step = '1';
    volumeSlider.value = String(Math.round(options.getSoundVolume() * 100));
    volumeSlider.addEventListener('input', () => {
      clearError();
      if (!options.onSoundVolumeChange(Number(volumeSlider.value) / 100)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    volumeSetting.append(volumeText, volumeSlider);
    audioCard.append(volumeSetting);
    const testSound = action('Essayer le son', () => {
      if (testSound.disabled) return;
      clearError();
      testSound.disabled = true;
      testResult.textContent = 'Chargement du son d’essai…';
      void options.onTestSound().then(() => {
        testResult.textContent = 'Son d’essai lancé. Vérifiez le volume de votre appareil si vous ne l’entendez pas.';
      }).catch(cause => {
        testResult.textContent = '';
        showError(cause instanceof Error ? cause.message : 'Le son d’essai a échoué.');
      }).finally(() => { if (testSound.isConnected) testSound.disabled = false; });
    });
    testSound.id = 'front-test-sound';
    const testResult = element('p', 'front-small');
    testResult.setAttribute('role', 'status');
    audioCard.append(testSound, testResult);
    const musicSetting = element('label', 'front-relief front-texture-setting');
    const musicCheckbox = element('input');
    musicCheckbox.type = 'checkbox';
    musicCheckbox.id = 'front-music-enabled';
    musicCheckbox.checked = options.getMusicEnabled();
    musicCheckbox.addEventListener('change', () => {
      clearError();
      if (!options.onMusicEnabledChange(musicCheckbox.checked)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    const musicText = element('span');
    musicText.append(element('strong', '', 'Musique'), element('span', '', 'Compositions instrumentales longues, jouées entre des pauses.'));
    musicSetting.append(musicCheckbox, musicText);
    audioCard.append(musicSetting);
    const musicVolumeSetting = element('label', 'front-relief front-texture-setting front-volume-setting');
    const musicVolumeText = element('span');
    musicVolumeText.append(element('strong', '', 'Volume de la musique'));
    const musicVolumeSlider = element('input');
    musicVolumeSlider.type = 'range';
    musicVolumeSlider.id = 'front-music-volume';
    musicVolumeSlider.min = '0'; musicVolumeSlider.max = '100'; musicVolumeSlider.step = '1';
    musicVolumeSlider.value = String(Math.round(options.getMusicVolume() * 100));
    musicVolumeSlider.addEventListener('input', () => {
      clearError();
      if (!options.onMusicVolumeChange(Number(musicVolumeSlider.value) / 100)) showError('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.');
    });
    musicVolumeSetting.append(musicVolumeText, musicVolumeSlider);
    audioCard.append(musicVolumeSetting);
    content.append(audioCard);
    footer.append(action('Retour', () => navigate('home'), 'front-back'));
  }

  function addNavigation(back: () => void, nextLabel?: string, next?: () => void): void {
    footer.append(action('Retour', back, 'front-back'));
    if (nextLabel && next) footer.append(action(nextLabel, next, 'front-primary front-next'));
  }

  function renderScenario(): void {
    content.innerHTML = `<div class="front-split">
      <div class="front-choice-list" aria-label="Scénarios">
        <button type="button" class="front-scenario-selected" aria-pressed="true"><strong>Atterrissage forcé</strong><span>Trois personnes pour bâtir une colonie.</span><span class="front-tag">Adaptation partielle</span></button>
      </div>
      <article class="front-card front-scenario-detail"><p class="front-kicker">LE DÉPART CLASSIQUE</p><h2>Atterrissage forcé</h2>
        <p>Trois survivants arrivent dans un territoire inconnu. Vos provisions vous laissent le temps de choisir un abri, de vous installer et de préparer les prochaines récoltes.</p>
        <h3>Vos provisions</h3><dl class="front-supplies">
          <div><dt>Bois</dt><dd>300</dd></div><div><dt>Acier</dt><dd>450</dd></div><div><dt>Composants</dt><dd>30</dd></div>
          <div><dt>Rations de survie</dt><dd>50</dd></div><div><dt>Médicaments</dt><dd>30</dd></div><div><dt>Argent</dt><dd>800</dd></div>
          <div><dt>Fusil à verrou</dt><dd>1</dd></div><div><dt>Revolver</dt><dd>1</dd></div><div><dt>Couteau en plastacier</dt><dd>1</dd></div><div><dt>Gilet pare-balles</dt><dd>1</dd></div>
        </dl><p class="front-small">Trois personnes choisies parmi huit candidats. Chaque personne porte une chemise en tissu. Taille de pierre, Mobilier complexe, Vêtements complexes et Climatisation sont déjà connus.</p>
        <div class="front-limitation"><strong>Une adaptation encore partielle</strong><p>Les survivants et leurs fournitures arrivent en capsules. Le casque, le pantalon de protection, l’animal domestique et les provisions dispersées du scénario de référence restent absents.</p></div>
      </article></div>`;
    const list = find<HTMLDivElement>('.front-choice-list');
    list.append(unavailable('Tribu perdue'), unavailable('Le riche explorateur'), unavailable('Brutalité nue'), unavailable('Personnalisé'),unavailable('Steam Workshop'));
    addNavigation(() => navigate('home'), 'Suivant', () => navigate('story'));
  }

  function radioChoice(group: HTMLFieldSetElement, name: string, label: string, checked: boolean, disabled: boolean, onChange?: () => void): HTMLInputElement {
    const row = element('label', `front-radio${disabled ? ' front-radio-disabled' : ''}`);
    const input = element('input');
    input.type = 'radio';
    input.name = name;
    input.value = label;
    input.checked = checked;
    input.disabled = disabled;
    if (onChange) input.addEventListener('change', onChange);
    row.append(input, element('span', '', label));
    if (disabled) row.append(element('small', '', 'À venir'));
    group.append(row);
    return input;
  }

  function renderStory(): void {
    const split = element('div', 'front-story-layout');
    const list=element('div','front-choice-list front-storytellers');list.setAttribute('aria-label','Narrateurs');
    const cassandra=action('Cassandra Classique',()=>{} ,'front-scenario-selected');cassandra.setAttribute('aria-pressed','true');
    list.append(cassandra,unavailable('Phoebe Amicale'),unavailable('Randy Aléatoire'));
    const narrator = element('article', 'front-card front-narrator');
    narrator.innerHTML=`<svg class="front-storyteller-illustration" viewBox="0 0 300 310" aria-hidden="true"><path fill="#cde7dc" d="M12 10h276v284H12z"/><path fill="#8faa9c" d="m12 242 42-42 34 29 59-58 71 63 34-25 36 34v51H12z"/><path fill="#554338" d="m95 87 17-42 57-12 43 38-7 80-37 27-68-36z"/><path fill="#e5bf99" d="m118 68 63 4 15 59-39 29-40-23-16-36z"/><path fill="#554338" d="m100 97 23-15 17-21 24 17 33 13-11-37-40-9-33 15z"/><path fill="#775c4d" d="m126 99 11-1 1 8-11 1zm39 1 10 1-1 8-10-1z"/><path fill="#dda691" d="m147 127 18-1-8 8z"/><path fill="#6f8f7b" d="m111 150-37 22-17 100 170 3-13-109-36-19-21 18z"/><path fill="#eee3bc" d="m132 150 21 25 20-27-8 74-30-5z"/><path fill="#e6cdb1" d="m89 224 23-16 34 27-11 16-31-11zm115-3-31-10-15 28 17 13 27-15z"/><path fill="#8d7160" stroke="#3b3e45" stroke-width="4" d="m103 211 50 14 48-9-9 44-42 7-41-17z"/><path fill="#f2e6c9" d="m111 218 40 12 38-6-6 29-33 8-33-15z"/><path fill="none" stroke="#897766" stroke-width="3" d="m150 230 1 29m-29-28 16 6m-15 4 14 6m30-10 12-3m-14 11 12-4"/></svg>`;
    narrator.insertAdjacentHTML('beforeend', `<p class="front-kicker">NARRATEUR</p><h2>Cassandra Classique</h2><span class="front-tag">Introduction partielle</span><p>Une installation, des rencontres et des menaces : Cassandra donne un rythme au début de la colonie.</p><p class="front-small">La suite du narrateur et la variété de ses événements restent incomplètes.</p>`);
    const choices = element('div', 'front-story-choices');
    const difficulty = element('fieldset', 'front-fieldset');
    difficulty.append(element('legend', '', 'Niveau d’aventure'));
    let difficultyInput: HTMLInputElement | undefined;
    for (const label of ['Pacifique', 'Bâtisseur de communauté', 'Récit d’aventure', 'Lutte pour la survie', 'De sang et de poussière', 'Perdre est amusant', 'Personnalisation en détail']) {
      const available = label === 'Récit d’aventure';
      const input = radioChoice(difficulty, 'front-difficulty', label, available && difficultyChosen, !available, () => { difficultyChosen = true; clearError(); });
      if (available) difficultyInput = input;
    }
    const help = element('p', 'front-choice-help', 'Récit d’aventure laisse de la marge pour établir votre colonie, tout en conservant des dangers. Les réglages s’appliquent aux systèmes présents ; le jeu de référence reste plus complet.');
    help.id = 'front-difficulty-help';
    difficultyInput!.setAttribute('aria-describedby', help.id);
    difficulty.append(help);
    const saving = element('fieldset', 'front-fieldset');
    saving.append(element('legend', '', 'Mode de sauvegarde'));
    const reloadInput = radioChoice(saving, 'front-save-mode', 'Rechargeable à tout moment', reloadChosen, false, () => { reloadChosen = true; clearError(); });
    reloadInput.setAttribute('aria-describedby', 'front-save-help');
    radioChoice(saving, 'front-save-mode', 'Engagement', false, true);
    const saveHelp = element('p', 'front-choice-help', 'Vous pouvez sauvegarder et revenir à une partie enregistrée dans ce navigateur.');
    saveHelp.id = 'front-save-help';
    saving.append(saveHelp);
    choices.append(difficulty, saving);
    split.append(list,choices,narrator);
    content.append(split);
    addNavigation(() => navigate('scenario'), 'Suivant', () => {
      if (!difficultyChosen || !reloadChosen) {
        showError(!difficultyChosen && !reloadChosen ? 'Choisissez Récit d’aventure et le mode de sauvegarde pour continuer.' : !difficultyChosen ? 'Choisissez un niveau d’aventure pour continuer.' : 'Choisissez le mode de sauvegarde pour continuer.');
        (!difficultyChosen ? difficultyInput : reloadInput)?.focus();
        return;
      }
      navigate('world');
    });
  }

  function renderWorld():void {
    const parameters=createWorldDraftParameters({value:worldParameters,onChange:next=>{worldParameters=next;seed=next.seed;worldCreation?.cancel();selectedTile=null;clearError();},onRandom:()=>randomSiteSeed(),onError:showError});
    content.append(parameters.element);disposePage=parameters.dispose;
    addNavigation(()=>navigate('story'),'Générer',()=>{
      const input=parameters.validate();if(!input||!worldCreation||!options.getWorldCreationPlayer)return;
      let player:WorldCreationPlayer256;try{player=options.getWorldCreationPlayer();}catch(cause){showError(cause instanceof Error?cause.message:'Le scénario de départ est indisponible.');return;}worldParameters=input;selectedTile=null;const mine=++worldGenerationRun;
      clearError();setBusy(true,'Préparation de la planète…');
      const cancel=action('Annuler la génération',()=>{if(mine!==worldGenerationRun)return;worldGenerationRun++;worldCreation.cancel();setBusy(false);navigate('world');});
      cancel.id='front-cancel-world-generation';footer.append(cancel);cancel.focus();
      const progress=(p:WorldCreationProgress256)=>{if(mine!==worldGenerationRun)return;const phases:Record<string,string>={mesh:'Géométrie de la planète',terrain:'Reliefs et biomes',lakes:'Lacs',rivers:'Rivières','ancient-sites':'Sites anciens','foreign-factions':'Factions et implantations','ancient-roads':'Anciennes routes',roads:'Routes','terrain-modifiers':'Particularités du terrain'};status.textContent=`${phases[p.phase]??'Génération du monde'}${p.total?` · ${p.completed} / ${p.total}`:''}…`;};
      void worldCreation.generate({seed:input.seed,settings:input.settings,player},progress).then(()=>{
        if(mine!==worldGenerationRun)return;setBusy(false);navigate('site');
      }).catch(cause=>{if(mine!==worldGenerationRun)return;setBusy(false);showError(cause instanceof Error?cause.message:'Le monde n’a pas pu être généré.');}).finally(()=>cancel.remove());
    });
    if(!worldCreation||typeof options.getWorldCreationPlayer!=='function'){footer.querySelector<HTMLButtonElement>('.front-next')!.disabled=true;showError('La préparation du monde n’est pas disponible. Vous pouvez conserver vos paramètres.');}
    const resets=element('div','front-world-resets');resets.append(action('Réinitialiser tout',()=>{try{worldCreation?.cancel();worldParameters={seed:randomSiteSeed(),settings:defaultWorldCreationSettings(),size:250,season:'auto'};seed=worldParameters.seed;selectedTile=null;navigate('world');}catch{showError('La graine aléatoire est indisponible.');}}));footer.insertBefore(resets,footer.lastElementChild);
  }

  function confirmDraft(message:string,accept:()=>void):void {
    disposeDialog?.();
    const dialog=element('dialog','front-world-advanced');dialog.setAttribute('aria-label','Confirmer le départ');
    const previous=document.activeElement;
    const close=()=>{if(dialog.open)dialog.close();dialog.remove();disposeDialog=undefined;if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
    disposeDialog=close;
    dialog.append(element('p','',message),action('Annuler',close),action('Confirmer',()=>{close();accept();},'front-primary'));
    dialog.addEventListener('keydown',event=>event.stopPropagation());dialog.addEventListener('cancel',event=>{event.preventDefault();close();});content.append(dialog);dialog.showModal();
  }

  function renderSite():void {
    const preview=worldCreation?.preview;if(!preview){navigate('world');return;}
    const configuration=createWorldCreationSite256({preview,choices:{size:worldParameters.size,season:worldParameters.season},selected:selectedTile,onSelected:id=>{selectedTile=id;clearError();const next=footer.querySelector<HTMLButtonElement>('.front-next');if(next)next.disabled=!configuration.canContinue();},onError:showError});
    content.append(configuration.element);disposePage=configuration.dispose;
    addNavigation(()=>{worldCreation!.cancel();navigate('world');},'Suivant',()=>{
      const tile=configuration.validate();if(tile===undefined)return;
      const calendar=worldCreationCalendarFacts262(preview.geography.surface.tiles[tile]!,worldParameters.season);
      confirmDraft(`Confirmer ce lieu de départ · ${worldParameters.size} × ${worldParameters.size} · ${calendar.choice} · ${calendar.date} ?`,()=>{
        // Navigation follows an actual worker ACK; selecting a tile alone
        // never creates a local map or invents a confirmed colony.
        const mine=worldGenerationRun;setBusy(true,'Confirmation du lieu de départ…');
        void worldCreation!.confirmSite(tile,{size:worldParameters.size,season:worldParameters.season}).then(()=>{if(mine!==worldGenerationRun||root.hidden)return;setBusy(false);navigate('pawns');}).catch(cause=>{if(mine!==worldGenerationRun||root.hidden)return;worldCreation!.cancel();selectedTile=null;setBusy(false);navigate('world');showError(cause instanceof Error?cause.message:'Le lieu n’a pas pu être confirmé. Générez le monde à nouveau.');});
      });
    });
    footer.querySelector<HTMLButtonElement>('.front-next')!.disabled=!configuration.canContinue();
  }

  function renderPawns():void {
    if(!worldCreation?.preview||!worldCreation.ticket){navigate('world');return;}
    const configuration=createStartingPawnsConfiguration({seed:teamSeed,roster,onRosterChange:next=>{roster=next;clearError();},onError:showError});
    content.append(configuration.element);pawnsPage=configuration;disposePage=configuration.dispose;
    addNavigation(()=>navigate('site'),'Démarrer',()=>{
      if(!configuration.validate())return;
      const startingParty=startingOriginalRequestFromRoster256(teamSeed,roster);
      const launch=()=>void run(async()=>{
        const progressBar=element('progress','front-creation-progress');progressBar.setAttribute('aria-label','Préparation de la colonie');progressBar.max=1;progressBar.value=0;
        const cancel=action('Annuler la préparation',()=>{cancel.disabled=true;worldCreation.cancel();status.textContent='Annulation demandée…';progressBar.removeAttribute('value');});cancel.id='front-cancel-local-generation';
        footer.append(progressBar,cancel);cancel.focus();
        try{await worldCreation.start(startingParty,p=>{
          const phases:Record<string,string>={'physical10-220':'Terrain et reliefs',Roads390:'Routes',ScatterShrines750:'Sites anciens',ScatterRuinsSimple750:'Ruines',FindPlayerStartSpot850:'Lieu d’arrivée',ScenParts875:'Personnages et possessions',Plants900:'Végétation',SteamGeysers950:'Geysers',RockChunks970:'Roches et débris',CaveHives1120:'Grottes',Snow1150:'Neige',Animals1200:'Faune',Fog1500:'Exploration',MutatorFinal1600:'Finitions','validated-private-candidate':'Vérification de la colonie'};
          status.textContent=`${phases[p.phase]??'Préparation de la colonie'}…`;progressBar.max=Math.max(1,p.total);progressBar.value=p.completed;
        });}catch(cause){worldCreation.cancel();selectedTile=null;throw cause;}finally{cancel.remove();progressBar.remove();}
      },'Génération de la carte et préparation de la colonie…').then(()=>{if(!root.hidden&&!worldCreation.ticket){const failure=error.hidden?undefined:error.textContent;navigate('world');showError(failure??'Le monde préparé n’est plus disponible. Générez-le à nouveau.');}});
      const missing=startingPartyMissingWork(teamSeed,startingParty.selected);
      if(missing.length)confirmDraft(`Personne dans cette équipe ne peut assurer : ${missing.map(work=>BACKGROUND_WORK_LABELS[work]).join(', ')}. Commencer malgré ces incapacités ?`,launch);
      else launch();
    });
  }

  function renderLoad(): void {
    let saves: FrontMenuSave[];
    try {
      saves = options.getSaves();
    } catch (cause) {
      saves = [];
      showError(cause instanceof Error ? cause.message : 'Les sauvegardes de ce navigateur ne sont pas accessibles.');
    }
    content.append(element('p', 'front-load-intro', 'Choisissez une sauvegarde, puis confirmez le chargement. La colonie sera ouverte en pause.'));
    const extra = element('div','front-load-actions');
    const file = element('input'); file.type='file'; file.accept='.json,application/json'; file.hidden=true;
    file.addEventListener('change',()=>{const chosen=file.files?.[0];file.value='';if(chosen)void run(()=>options.onImport(chosen),'Vérification du fichier et préparation de la colonie…');});
    extra.append(action('Colonies de test',()=>navigate('tests')),action('Importer un fichier',()=>file.click()),file);
    if(hasGame&&options.onExport)extra.append(action('Exporter la partie actuelle',()=>void run(options.onExport!,'Préparation du fichier de la partie actuelle…')));
    content.append(extra);
    const list = element('fieldset', 'front-save-list');
    list.append(element('legend', 'front-visually-hidden', 'Sauvegardes disponibles'));
    const loadButton = action('Charger', () => {
      if (selectedSave === undefined) return;
      const key = selectedSave;
      void run(() => options.onLoad(key), 'Vérification et chargement de la sauvegarde…');
    }, 'front-primary front-next');
    loadButton.disabled = true;
    selectedSave = undefined;
    for (const save of saves) {
      const row = element('label', `front-save${save.disabled ? ' front-save-disabled' : ''}`);
      const radio = element('input');
      radio.type = 'radio';
      radio.name = 'front-save';
      radio.value = save.key;
      radio.disabled = save.disabled ?? false;
      const text = element('span');
      text.append(element('strong', '', save.label), element('span', '', save.detail));
      if(save.savedAt!==undefined)text.append(element('span','',`${save.kind==='auto'?'Automatique · ':''}${new Date(save.savedAt).toLocaleString('fr-FR')}`));
      if (save.disabled) text.append(element('span', 'front-save-unavailable', 'Indisponible'));
      radio.addEventListener('change', () => { selectedSave = save.key; loadButton.disabled = false; clearError(); });
      row.append(radio, text);
      list.append(row);
    }
    if (saves.length === 0) {
      const empty = element('div', 'front-empty');
      empty.append(atlasMark('front-empty-mark',0,3), element('h2', '', 'Aucune colonie enregistrée'), element('p', '', 'Vos sauvegardes apparaîtront ici après avoir commencé et enregistré une partie.'));
      content.append(empty);
    } else content.append(list);
    addNavigation(() => navigate('home'));
    footer.append(loadButton);
  }

  function renderTests(): void {
    const intro = element('p','front-load-intro','Des colonies prêtes à jouer pour explorer les systèmes et comparer les performances. Chaque chargement ouvre une nouvelle copie en pause.');
    content.append(intro);
    addNavigation(()=>navigate('load'));
    void run(async()=>{
      const saves=await options.getTestColonies();
      const split=element('div','front-test-layout');
      const list=element('fieldset','front-test-list');
      list.append(element('legend','front-visually-hidden','Configurations de test'));
      const detail=element('article','front-card front-test-detail');
      let selected=saves[0]!;
      const describe=(save:TestColony)=>{
        selected=save;
        detail.replaceChildren(element('span','front-tag',save.prepared?'Situation préparée':'Colonie jouée'),element('h2','',save.label),element('p','',save.description));
        const metadata=element('p','front-test-metadata',`${save.colonists} colons · carte ${save.width} × ${save.height}`);
        const focus=element('p','front-test-focus',save.focus.join(' · '));
        const instructions=element('ol','front-test-instructions');
        for(const step of save.steps)instructions.append(element('li','',step));
        detail.append(metadata,focus,element('h3','','À essayer'),instructions,element('p','front-small',save.provenance));
      };
      for(const [index,save] of saves.entries()) {
        const row=element('label','front-save front-test-save'),radio=element('input');
        radio.type='radio';radio.name='test-colony';radio.value=save.id;radio.checked=index===0;
        radio.addEventListener('change',()=>{describe(save);clearError();});
        const text=element('span');text.append(element('strong','',save.label),element('span','',`${save.colonists} colons · ${save.width} × ${save.height}`));
        row.append(radio,text);list.append(row);
      }
      describe(selected);split.append(list,detail);content.append(split);
      content.append(element('p','front-small front-test-preservation','La sauvegarde manuelle reste intacte. Si une colonie est ouverte, elle est conservée dans « Colonie précédente ». Sauvegardez votre progression avant de multiplier les essais.'));
      footer.append(action('Télécharger le fichier',()=>{
        const link=element('a');link.href=testColonyUrl(selected);link.download=selected.filename;link.click();
      },'front-quiet'),action('Charger cette colonie',()=>{void run(()=>options.onLoadTest(selected),'Chargement de la colonie de test…');},'front-primary front-next'));
    },'Chargement du catalogue de test…');
  }

  function showHome(nextHasGame = hasGame): void {
    if (busy || operationPending) return;
    hasGame = nextHasGame;
    navigate('home');
  }

  function setHasGame(next: boolean): void {
    const changed = hasGame !== next;
    hasGame = next;
    pauseNote.textContent = hasGame ? 'COLONIE EN PAUSE' : '';
    if (!changed || page !== 'home') return;
    const nav = content.querySelector('.front-home-actions');
    if (!nav) return;
    const restoreFocus = homeResume === document.activeElement;
    homeResume?.remove();
    homeResume = hasGame ? resumeAction() : undefined;
    if (homeResume) {
      nav.prepend(homeResume);
      if (busy || operationPending) {
        homeResume.disabled = true;
        enabledBeforeBusy.push(homeResume);
      }
    }
    homeStart?.classList.toggle('front-primary', !hasGame);
    if (restoreFocus && !root.hidden) title.focus({ preventScroll: true });
  }

  function showCreation(): void {
    if (busy || operationPending) return;
    difficultyChosen = false;
    reloadChosen = false;
    seed = '';
    worldCreation?.cancel();selectedTile=null;
    try { seed = randomSiteSeed();teamSeed=Number(randomSiteSeed()); } catch {teamSeed=0; /* Manual entry remains available. */ }
    worldParameters={seed,settings:defaultWorldCreationSettings(),size:250,season:'auto'};
    roster=createStartingCandidateRoster(teamSeed);
    navigate('scenario');
  }

  function showLoad(): void {
    navigate('load');
  }

  function hide(): void {
    worldGenerationRun++;worldCreation?.cancel();if(busy&&!operationPending)setBusy(false);
    disposeDialog?.();disposeDialog=undefined;
    disposePage?.();disposePage=undefined;pawnsPage=undefined;
    root.hidden = true;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      if (busy || operationPending) return;
      if(page==='pawns')navigate('site');
      else if(page==='site')navigate('world');
      else if(page==='world')navigate('story');
      else if (page === 'story') navigate('scenario');
      else if (page === 'tests') navigate('load');
      else if (page !== 'home') navigate('home');
      else if (hasGame) void run(options.onResume, 'Reprise de la colonie…');
    } else if (event.key === 'Tab') {
      const candidates = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length > 0);
      const first = candidates[0];
      const last = candidates.at(-1);
      if (!first || !last) {
        event.preventDefault();
        title.focus();
      } else if (event.shiftKey && (document.activeElement === first || document.activeElement === title)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  for (const type of ['keyup', 'pointerdown', 'pointerup', 'click', 'dblclick', 'wheel'] as const) {
    root.addEventListener(type, event => event.stopPropagation());
  }

  return { showHome, setHasGame, showCreation, showOptions:()=>navigate('options'), showLoad, hide, isOpen: () => !root.hidden, setBusy, showError };
}
