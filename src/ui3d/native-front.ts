import type { FrontMenu, FrontMenuOptions } from '../ui/front-menu';
import type { NativeControl, NativePage, NativeRow } from './native-contract';
import { createWorldCreationFlow256 } from '../ui/world-creation-flow';
import type { WorldCreationProgress256 } from '../ui/world-creation-contract';
import { worldCreationCalendarFacts262, CREATION_SEASON_LABELS_262 } from '../ui/world-creation-calendar-262';
import { randomSiteSeed } from '../ui/front-site';
import { defaultWorldGenerationSettings, validWorldGenerationSettings, isIntrinsicWorldFaction, CONFIGURABLE_WORLD_FACTIONS, type ConfigurableWorldFaction } from '../sim/world-generation-settings';
import { GEOGRAPHIC_CREATION_SIZES_262, GEOGRAPHIC_CREATION_SEASONS_262, type GeographicCreationOptions262 } from '../sim/geographic-creation-options-262';
import { canPlaceWorldSettlement } from '../sim/world-settlement-placement';
import { describeWorldSite } from '../sim/world-site-geography';
import {BIOME_LABELS,HILLINESS_LABELS} from '../sim/site';
import {STONE_LABELS} from '../sim/geology';
import { createStartingCandidateRoster, previewStartingCandidate, previewStartingParty, rerollStartingCandidateForRoster, validStartingCandidateName, startingPartyMissingWork, type StartingCandidateDescriptor } from '../sim/starting-candidates';
import { startingOriginalRequestFromRoster256 } from '../sim/starting-original-request-256';
import { BACKGROUND_SKILL_IDS, BACKGROUND_WORK_LABELS, CHILDHOODS, ADULTHOODS, backgroundSkillRefusal, backgroundWorkRefusal } from '../sim/colonist-backgrounds';
import { biologicalYears, chronologicalYears } from '../sim/human-age';
import { captureRelationshipIndex, relationshipKinds } from '../sim/relationship-state';
import { TRAITS } from '../sim/traits';
import type { WorkType } from '../sim/types';
import { DEFAULT_LIGHTING_SETTINGS, LIGHTING_CONTROLS, parseLightingSettings } from '../render/lighting-settings';
import { DEFAULT_SHADOW_SETTINGS, SHADOW_FREQUENCY_OPTIONS, SHADOW_RESOLUTION_OPTIONS, parseShadowSettings } from '../render/shadow-settings';
import { DEFAULT_ANIMATION_SETTINGS, parseAnimationSettings, ANIMATION_SETTING_LIMITS } from '../render/animation-settings';
import { AUTOSAVE_MINUTES } from '../ui/autosave';
import { THREAT_PAUSE_CHOICES } from '../ui/threat-pause-settings';
import { SETTLEMENT_LIMIT_CHOICES } from '../ui/settlement-limit-settings';
import type { UiFontId } from '../ui/ui-fonts';
import { testColonyUrl, type TestColony } from '../ui/test-colonies';
import { XP_SCALE, xpRequired, learningFactor } from '../sim/skills';
import { BODY_PARTS } from '../sim/body-definition';
import { HP_UNIT, INJURY_RULES } from '../sim/injury-rules';
import { APPAREL } from '../sim/apparel-rules';
import { appearanceOf } from '../sim/pawn-appearance';
import { apparelAppearance } from '../render/character-apparel';
import { humanLimbVisualMask } from '../render/human-anatomy-presentation';
import { portraitDataUrl, portraitExpressionOf } from '../ui/pawn-portrait';
import { nativeClinicalConditionRows } from './native-special-inspection';
import { NATIVE_UI_SCALE_LIMITS } from './native-preferences';
import {presentNativeFront} from './native-front-presentation';

type Page = 'home' | 'scenario' | 'story' | 'world' | 'site' | 'pawns' | 'load' | 'tests' | 'options';
const names: Record<string, string> = {
  OutlanderCivil: 'Union civile', OutlanderRough: 'Union hostile', TribeCivil: 'Tribu paisible', TribeRough: 'Tribu hostile', TribeSavage: 'Tribu farouche', Pirate: 'Pirates', Mechanoid: 'Mécanoïdes', Insect: 'Insectes',
  shooting: 'Tir', melee: 'Mêlée', construction: 'Construction', mining: 'Minage', cooking: 'Cuisine', plants: 'Plantes', animals: 'Animaux', crafting: 'Artisanat', artistic: 'Artistique', medicine: 'Médecine', social: 'Social', intellectual: 'Intellectuel',
};
const fonts: readonly { id: UiFontId; label: string }[] = [
  { id: 'comfortaa', label: 'Comfortaa' }, { id: 'baloo-2', label: 'Baloo 2' }, { id: 'bree-serif', label: 'Bree Serif' },
  { id: 'grandstander', label: 'Grandstander' }, { id: 'patrick-hand', label: 'Patrick Hand' }, { id: 'quicksand', label: 'Quicksand' },
];
const storageFailure = 'Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.';
const errorMessage = (cause: unknown) => cause instanceof Error ? cause.message : String(cause);

/** Data-only front screens. The renderer owns every visible control, input,
 * layout and hit test. Only the explicit import gesture creates a file picker. */
export function createNativeFrontMenu(options: FrontMenuOptions, show: (page: NativePage | null) => void): FrontMenu {
  const backend = options.worldCreation;
  const flow = backend && typeof backend.generate === 'function' && typeof backend.confirmSite === 'function' && typeof backend.start === 'function' ? createWorldCreationFlow256(backend) : undefined;
  let page: Page = 'home', open = false, hasGame = false, busy = false, pending = false;
  let externalPage=false;
  let error = '', status = '', generation = 0, difficultyChosen = false, reloadChosen = false;
  let parameters = { seed: '', settings: defaultWorldGenerationSettings(), size: 250 as GeographicCreationOptions262['size'], season: 'auto' as GeographicCreationOptions262['season'] };
  let teamSeed = 0, roster: StartingCandidateDescriptor[] = [], inspected = 1;
  let showCandidateClothes = true;
  let selectedTile: number | null = null, eligible: number[] = [], siteOffset = 0;
  let tests: TestColony[] | undefined;
  const testCatalogue={search:'',selected:undefined as string|undefined};
  const optionSections=[{id:'game',label:'Jeu'},{id:'interface',label:'Interface'},{id:'graphics',label:'Graphismes'},{id:'lighting',label:'Éclairage'},{id:'audio',label:'Audio'}] as const;
  let optionSection:typeof optionSections[number]['id']='game';
  let loadSearch='',selectedLoadKey:string|undefined;
  let confirmation: { message: string; accept: () => void | Promise<unknown> } | undefined;

  function paint(): void {
    if (!open||externalPage) return;
    if (confirmation) {
      show({ id: 'front-confirm', title: 'Confirmer le départ', modal: true, layout:'setup',width:620,height:280,rows: [{ id: 'confirmation', region:'details',label: confirmation.message }], actions: [
        control('confirm-cancel', 'Annuler', () => { confirmation = undefined; }),
        control('confirm-accept', 'Confirmer', () => { const accept = confirmation!.accept; confirmation = undefined; return accept(); }),
      ], onClose: () => { confirmation = undefined; paint(); } });
      return;
    }
    const result = renderPage();
    if (error) result.rows.unshift({ id: 'front-error', label: error });
    if (status) result.rows.unshift({ id: 'front-status', label: status });
    result.id = `front-${page}`; result.modal = true;
    result.onClose = () => { if (!busy && !pending) back(); };
    show(presentNativeFront(result,page,{button:control,field:input,tests:testCatalogue}));
  }
  function navigate(next: Page): void { externalPage=false;page = next; open = true; error = ''; status = ''; confirmation = undefined; paint(); }
  function fail(cause: unknown): void { error = errorMessage(cause); paint(); }
  function control(id: string, label: string, action: () => unknown, disabled = false, active = false, allowBusy = false): NativeControl {
    return { id, label, disabled: disabled || (!allowBusy && (busy || pending)), active, onActivate: async () => {
      if (disabled || (!allowBusy && (busy || pending))) return;
      error = '';
      try { await action(); } catch (cause) { error = errorMessage(cause); }
      paint();
    } };
  }
  function input(id: string, label: string, value: string, commit: (value: string) => unknown, kind: 'text' | 'number' = 'text', maxLength?: number): NativeRow {
    return { id, label, input: { value, kind, maxLength, onCommit: async next => {
      if (busy || pending) return false;
      error = ''; try { const accepted=await commit(next);paint();return accepted!==false; } catch (cause) { error = errorMessage(cause);paint();return false; }
    } } };
  }
  function choice<T extends string | number>(id: string, label: string, value: T, values: readonly T[], change: (value: T) => unknown, labelOf: (value: T) => string = String, disabled = false): NativeRow {
    const entries=values.map((candidate,index)=>control(`${id}-${index}`,labelOf(candidate),()=>change(candidate),disabled,candidate===value));
    const select=control(id,labelOf(value),()=>undefined,disabled);
    select.select={value:String(value),options:values.map(candidate=>({value:String(candidate),label:labelOf(candidate)})),onChange:async text=>{const index=values.findIndex(candidate=>String(candidate)===text);if(index>=0)await entries[index]!.onActivate();}};
    return {id,label,compact:true,controls:[select]};
  }
  function range(id: string, label: string, value: number, min: number, max: number, step: number, change: (value: number) => unknown, disabled = false, unit = ''): NativeRow {
    const apply = (next: number) => change(Math.max(min, Math.min(max, Math.round(next / step) * step)));
    return { id, label, value: `${Math.round(value * 1000) / 1000}${unit}`, controls: [
      control(`${id}-less`, '−', () => apply(value - step), disabled || value <= min),
      control(`${id}-more`, '+', () => apply(value + step), disabled || value >= max),
    ], input: { value: String(value), kind: 'number', onCommit: async text => {
      if (disabled || busy || pending) return false;
      const number = Number(text); if (!text.trim() || !Number.isFinite(number)) { fail('Saisissez un nombre valide.'); return false; }
      try { const accepted=await apply(number);paint();return accepted!==false; } catch (cause) { error = errorMessage(cause);paint();return false; }
    } } };
  }
  function toggle(id: string, label: string, value: boolean, change: (value: boolean) => unknown): NativeRow {
    return { id, label, value: value ? 'Activé' : 'Désactivé', controls: [control(id, value ? 'Désactiver' : 'Activer', () => change(!value), false, value)] };
  }
  async function preference(result: boolean | void | Promise<boolean | void>): Promise<void> { if (await result === false) error = storageFailure; }
  async function run(action: () => Promise<unknown>, message: string): Promise<boolean> {
    if (busy || pending) return false;
    busy = pending = true; status = message; error = ''; paint();
    try { await action(); return true; } catch (cause) { error = errorMessage(cause); return false; }
    finally { busy = pending = false; status = ''; paint(); }
  }
  function back(): void {
    if (page === 'home') { if (hasGame) void run(options.onResume, 'Reprise de la colonie…'); return; }
    if (page === 'site') { flow?.cancel(); selectedTile = null; navigate('world'); }
    else navigate(({ pawns: 'site', world: 'story', story: 'scenario', tests: 'load' } as Partial<Record<Page, Page>>)[page] ?? 'home');
  }
  const navigation = (next?: NativeControl): NativeControl[] => [control('front-back', 'Retour', back), ...(next ? [next] : [])];
  function invalidateDraft(): void { generation++; flow?.cancel(); selectedTile = null; eligible = []; }
  function progress(p: WorldCreationProgress256): void { status = `${p.phase}${p.total ? ` · ${p.completed} / ${p.total}` : ''}…`; paint(); }

  async function generateWorld(): Promise<void> {
    if (!flow || !options.getWorldCreationPlayer) throw Error('La préparation du monde n’est pas disponible.');
    if (!validWorldGenerationSettings(parameters.settings)) throw Error('Les paramètres du monde sont invalides. Vérifiez les factions.');
    const player = options.getWorldCreationPlayer();
    invalidateDraft(); const mine = generation;
    busy = true; status = 'Préparation de la planète…'; paint();
    try {
      const preview = await flow.generate({ seed: parameters.seed, settings: parameters.settings, player }, p => { if (mine === generation) progress(p); });
      if (mine !== generation || !open) return;
      const occupied = new Set(preview.settlements.map(settlement => settlement.tile));
      eligible = preview.geography.surface.tiles.filter(tile => canPlaceWorldSettlement(preview.geography.surface.tiles, tile.id, { settlementTiles: occupied })).map(tile => tile.id);
      siteOffset = 0; busy = false; navigate('site');
    } catch (cause) { if (mine === generation && open) { busy = false; status = ''; fail(cause); } }
  }
  async function confirmSite(): Promise<void> {
    if (!flow?.preview || selectedTile === null || !eligible.includes(selectedTile)) throw Error('Sélectionnez un lieu de départ disponible.');
    const tile = selectedTile, mine = generation;
    const accepted = await run(() => flow.confirmSite(tile, { size: parameters.size, season: parameters.season }), 'Confirmation du lieu de départ…');
    if (mine !== generation || !open) return;
    if (accepted) navigate('pawns');
    else { const reason = error; invalidateDraft(); navigate('world'); error = reason; paint(); }
  }
  async function start(): Promise<void> {
    if (!flow?.preview || !flow.ticket) throw Error('Confirmez le lieu de départ avant de démarrer.');
    const request = startingOriginalRequestFromRoster256(teamSeed, roster);
    const accepted = await run(() => flow.start(request, progress), 'Génération de la carte et préparation de la colonie…');
    if (accepted) hide();
    else if (open) { const reason = error; invalidateDraft(); navigate('world'); error = reason; paint(); }
  }
  function askStart(): void {
    const request = startingOriginalRequestFromRoster256(teamSeed, roster), missing = startingPartyMissingWork(teamSeed, request.selected);
    if (missing.length) confirmation = { message: `Personne dans cette équipe ne peut assurer : ${missing.map(work => BACKGROUND_WORK_LABELS[work]).join(', ')}. Commencer malgré ces incapacités ?`, accept: start };
    else void start();
  }

  function renderOptions(): NativePage {
    const rows: NativeRow[] = [];
    if(options.getUiScale&&options.onUiScaleChange)rows.push(range('ui-scale','Échelle de l’interface',Math.round(options.getUiScale()*100),NATIVE_UI_SCALE_LIMITS.min*100,NATIVE_UI_SCALE_LIMITS.max*100,NATIVE_UI_SCALE_LIMITS.step*100,value=>preference(options.onUiScaleChange!(value/100)),false,' %'));
    if(options.getUiAutoHide&&options.onUiAutoHideChange){
      const settings=options.getUiAutoHide();
      rows.push(toggle('auto-hide-bottom','Barre du bas escamotable',settings.bottom,bottom=>preference(options.onUiAutoHideChange!({...options.getUiAutoHide!(),bottom}))),
        toggle('auto-hide-notifications','Notifications escamotables',settings.notifications,notifications=>preference(options.onUiAutoHideChange!({...options.getUiAutoHide!(),notifications}))));
    }
    if (options.getAutosaveMinutes && options.onAutosaveMinutesChange) rows.push(choice('autosave', 'Sauvegarde automatique', options.getAutosaveMinutes(), AUTOSAVE_MINUTES, value => preference(options.onAutosaveMinutesChange!(value)), value => value ? `${value} min` : 'Désactivée'));
    if (options.getThreatPauseMode && options.onThreatPauseModeChange) rows.push(choice('threat', 'Pause automatique', options.getThreatPauseMode(), THREAT_PAUSE_CHOICES.map(c => c.value), async value => {
      await run(() => preference(options.onThreatPauseModeChange!(value)), 'Application du choix…');
    }, value => THREAT_PAUSE_CHOICES.find(c => c.value === value)!.label, options.getThreatPausePending?.()));
    if (options.getMaxSettlements && options.onMaxSettlementsChange) rows.push(choice('settlements', 'Nombre maximal de colonies', options.getMaxSettlements(), SETTLEMENT_LIMIT_CHOICES, async value => {
      await run(() => preference(options.onMaxSettlementsChange!(value)), 'Application du choix…');
    }, String, options.getMaxSettlementsPending?.()));
    rows.push(toggle('textures', 'Textures 3D stylisées', options.getTexturesEnabled(), value => preference(options.onTexturesEnabledChange(value))),
      toggle('grass', 'Tapis d’herbe', options.getGroundGrassEnabled(), value => preference(options.onGroundGrassEnabledChange(value))),
      toggle('diorama', 'Diorama en carton', options.getDioramaEnabled(), value => preference(options.onDioramaEnabledChange(value))),
      toggle('room', 'Chambre autour de la carte', options.getRoomEnabled(), value => preference(options.onRoomEnabledChange(value))));
    if (options.getDecorOcclusion && options.onDecorOcclusionChange) rows.push(toggle('occlusion', 'Masquer le décor devant la carte', options.getDecorOcclusion(), value => preference(options.onDecorOcclusionChange!(value))));
    for (const light of LIGHTING_CONTROLS) rows.push(range(`light-${light.key}`, light.label, Math.round(parseLightingSettings(options.getLightingSettings())[light.key] * 100), 0, 300, 5, value => preference(options.onLightingSettingsChange({ ...options.getLightingSettings(), [light.key]: value / 100 })), false, ' %'));
    rows.push({ id: 'light-reset', label: 'Éclairage', controls: [control('light-reset', 'Réinitialiser', () => preference(options.onLightingSettingsChange({ ...DEFAULT_LIGHTING_SETTINGS })))] });
    if (options.onDesignationMinCellPixelsChange) rows.push(range('designation', 'Icônes des ordres — seuil de zoom', options.getDesignationMinCellPixels?.() ?? 0, 0, 96, 1, value => preference(options.onDesignationMinCellPixelsChange!(value)), false, ' px'));
    if (options.onItemLabelMinCellPixelsChange) rows.push(range('item-label', 'Quantités et qualités — seuil de zoom', options.getItemLabelMinCellPixels?.() ?? 0, 0, 160, 1, value => preference(options.onItemLabelMinCellPixelsChange!(value)), false, ' px'));
    if (options.onUiFontChange) rows.push(choice('font', 'Typographie', options.getUiFont?.() ?? 'comfortaa', fonts.map(font => font.id), value => options.onUiFontChange!(value), value => fonts.find(font => font.id === value)!.label));
    const shadows = parseShadowSettings(options.getShadowSettings?.() ?? DEFAULT_SHADOW_SETTINGS);
    if (options.onShadowSettingsChange) rows.push(
      choice('shadow-frequency', 'Fréquence des ombres', shadows.frequency, SHADOW_FREQUENCY_OPTIONS.map(c => c.value), value => preference(options.onShadowSettingsChange!({ ...shadows, frequency: value })), value => SHADOW_FREQUENCY_OPTIONS.find(c => c.value === value)!.label),
      choice('shadow-resolution', 'Résolution des ombres', shadows.resolution, SHADOW_RESOLUTION_OPTIONS.map(c => c.value), value => preference(options.onShadowSettingsChange!({ ...shadows, resolution: value }))));
    const animations = parseAnimationSettings(options.getAnimationSettings?.() ?? DEFAULT_ANIMATION_SETTINGS);
    if (options.onAnimationSettingsChange) {
      rows.push(toggle('animation', 'Adapter les animations à la distance', animations.enabled, enabled => preference(options.onAnimationSettingsChange!({ ...animations, enabled }))));
      for (const [key, label] of [['nearPixels', 'Animations complètes'], ['farPixels', 'Arrêt des animations éloignées'], ['middleHz', 'Fréquence à mi-distance']] as const) {
        const limits = ANIMATION_SETTING_LIMITS[key];
        rows.push(range(`animation-${key}`, label, animations[key], limits.min, key === 'farPixels' ? Math.min(limits.max, animations.nearPixels - 1) : limits.max, limits.step, value => preference(options.onAnimationSettingsChange!(parseAnimationSettings({ ...animations, [key]: value }))), !animations.enabled, key === 'middleHz' ? ' Hz' : ' px'));
      }
    }
    if (options.onShadowSettingsChange || options.onAnimationSettingsChange) rows.push({ id: 'performance-presets', label: 'Performances visuelles', controls: [
      control('balanced', 'Équilibré', async () => { await preference(options.onShadowSettingsChange?.({ ...DEFAULT_SHADOW_SETTINGS })); await preference(options.onAnimationSettingsChange?.({ ...DEFAULT_ANIMATION_SETTINGS })); }),
      control('continuous', 'Tout animer à chaque image', async () => { await preference(options.onShadowSettingsChange?.({ ...shadows, frequency: 0 })); await preference(options.onAnimationSettingsChange?.({ ...animations, enabled: false })); }),
    ] });
    rows.push(toggle('sound', 'Effets sonores', options.getSoundEnabled(), value => preference(options.onSoundEnabledChange(value))),
      range('sound-volume', 'Volume des effets', Math.round(options.getSoundVolume() * 100), 0, 100, 1, value => preference(options.onSoundVolumeChange(value / 100)), false, ' %'),
      { id: 'test-sound', label: 'Essayer le son', controls: [control('test-sound', 'Essayer', async () => { if (await run(options.onTestSound, 'Chargement du son d’essai…')) status = 'Son d’essai lancé.'; })] },
      toggle('music', 'Musique', options.getMusicEnabled(), value => preference(options.onMusicEnabledChange(value))),
      range('music-volume', 'Volume de la musique', Math.round(options.getMusicVolume() * 100), 0, 100, 1, value => preference(options.onMusicVolumeChange(value / 100)), false, ' %'));
    const sectionOf=(id:string):typeof optionSections[number]['id']=>{
      if(['autosave','threat','settlements'].includes(id))return 'game';
      if(['ui-scale','auto-hide-bottom','auto-hide-notifications','designation','item-label','font'].includes(id))return 'interface';
      if(id.startsWith('light-'))return 'lighting';
      if(['sound','sound-volume','test-sound','music','music-volume'].includes(id))return 'audio';
      return 'graphics';
    };
    const category=optionSections.find(section=>section.id===optionSection)!;
    const catalogue:NativeRow[]=optionSections.map(section=>({id:`option-section-${section.id}`,label:'',region:'catalogue',controls:[control(`option-section-${section.id}`,section.label,()=>{optionSection=section.id;},false,optionSection===section.id)]}));
    const details:NativeRow[]=[{id:'option-section-title',label:category.label,emphasis:'heading',region:'details'},
      ...rows.filter(row=>sectionOf(row.id)===optionSection).map(row=>({...row,region:'details' as const,column:undefined}))];
    return { id:'',title:'Options',rows:[...catalogue,...details],width:900,height:760,layout:'setup',setupCatalogueWidth:180,contentKey:`options-${optionSection}`,actions:navigation() };
  }

  const nativeSiteView={scope:'',tab:'facts' as 'facts'|'places'|'factions'};
  const nativeSiteRiverNames={'huge-river':'Fleuve','large-river':'Grande rivière',river:'Rivière',creek:'Ruisseau'} as const;
  const nativeSiteRoadNames={'dirt-path':'Sentier','dirt-road':'Route en terre','stone-road':'Route pavée','ancient-asphalt-road':'Ancienne route asphaltée','ancient-asphalt-highway':'Ancienne autoroute'} as const;
  const nativeSiteBiome=(biome:ReturnType<typeof describeWorldSite>['biome'])=>biome==='ocean'?'Océan':biome==='lake'?'Lac':BIOME_LABELS[biome];

  function renderWorld(): NativePage {
    const update=(action:()=>void)=>{invalidateDraft();action();};
    const catalogue=(row:NativeRow):NativeRow=>({...row,region:'catalogue',presentation:'plain',dense:true,compact:true});
    const details=(row:NativeRow):NativeRow=>({...row,region:'details',presentation:'plain',dense:true,compact:true});
    const rows:NativeRow[]=[{id:'world-help',region:'navigation',presentation:'plain',compact:true,label:'Préparer la planète',value:'Paramètres à gauche · factions à droite',hint:'Les choix sont appliqués au prochain monde généré. Changer un paramètre invalide le brouillon actuel, comme auparavant.'},
      catalogue(input('world-seed','Graine',parameters.seed,value=>update(()=>{parameters.seed=value;}))),
      catalogue({id:'random-seed',label:'Graine aléatoire',controls:[control('random-seed','Aléatoire',()=>update(()=>{parameters.seed=randomSiteSeed();}))]}),
      catalogue(choice('coverage','Couverture de la planète',parameters.settings.coverage,[.3,.5,1] as const,value=>update(()=>{parameters.settings.coverage=value;}),value=>`${value*100} %`))];
    if(parameters.settings.coverage===1)rows.push(catalogue({id:'coverage-warning',label:'Une planète complète demande davantage de temps de préparation et de mémoire.'}));
    for(const[key,label]of[['rainfall','Précipitations'],['temperature','Température'],['population','Population']]as const)rows.push(catalogue(range(`world-${key}`,label,parameters.settings[key],0,6,1,value=>update(()=>{parameters.settings[key]=value as typeof parameters.settings[typeof key];}))));
    rows.push(catalogue(choice('map-size','Taille de la carte',parameters.size,GEOGRAPHIC_CREATION_SIZES_262,value=>update(()=>{parameters.size=value;}),value=>`${value} × ${value}`)),
      catalogue(choice('season','Saison de départ',parameters.season,GEOGRAPHIC_CREATION_SEASONS_262,value=>update(()=>{parameters.season=value;}),value=>CREATION_SEASON_LABELS_262[value])));
    if(parameters.size>280)rows.push(catalogue({id:'size-warning',label:'Les grandes cartes augmentent le coût de simulation et peuvent modifier les déplacements.'}));
    if(parameters.season==='winter')rows.push(catalogue({id:'winter-warning',label:'Commencer en hiver peut rendre la survie plus difficile.'}));
    rows.push(catalogue({id:'world-explanation',label:'La population règle les implantations du monde ; elle ne change pas votre équipe. Auto choisit la première période chaude du lieu ou son été.'}));
    rows.push(details({id:'world-factions-heading',label:'Factions installées',emphasis:'heading'}));
    parameters.settings.factions.forEach((def,index)=>{
      if(isIntrinsicWorldFaction(def))return;
      rows.push(details({id:`faction-${index}`,label:names[def]??def,controls:[control(`remove-faction-${index}`,'Retirer',()=>update(()=>{parameters.settings.factions.splice(index,1);}))]}));
    });
    const humans=parameters.settings.factions.filter(def=>!isIntrinsicWorldFaction(def)&&def!=='Mechanoid'&&def!=='Insect').length;
    rows.push(details({id:'human-faction-count',label:`${humans} / 12 factions humaines`,detail:humans?undefined:'Vous avez retiré toutes les factions humaines.'}));
    const addControls=CONFIGURABLE_WORLD_FACTIONS.filter(def=>!isIntrinsicWorldFaction(def)).map(def=>{
      const hidden=def==='Mechanoid'||def==='Insect';
      return control(`add-faction-${def}`,names[def]??def,()=>{
        // Keep the same live maximum/uniqueness constraints as the displayed
        // availability, even if a control was retained across a repaint.
        const currentHumans=parameters.settings.factions.filter(value=>!isIntrinsicWorldFaction(value)&&value!=='Mechanoid'&&value!=='Insect').length;
        if(hidden?parameters.settings.factions.includes(def):currentHumans>=12)return;
        update(()=>{parameters.settings.factions.push(def as ConfigurableWorldFaction);});
      },hidden?parameters.settings.factions.includes(def):humans>=12);
    });
    rows.push(details({id:'world-add-factions',label:'Ajouter une faction',controls:addControls}),details({id:'reset-factions',label:'Factions',controls:[control('reset-factions','Réinitialiser',()=>update(()=>{parameters.settings.factions=defaultWorldGenerationSettings().factions;}))]}));
    const primary=busy&&!pending?control('cancel-generation','Annuler la génération',()=>{invalidateDraft();busy=false;status='';paint();},false,false,true):control('generate-world','Générer',generateWorld,!flow||!options.getWorldCreationPlayer);
    return{id:'',title:'Créer le monde',layout:'setup',setupCatalogueWidth:400,rows,actions:[...navigation(),control('reset-world','Réinitialiser tout',()=>update(()=>{parameters={seed:randomSiteSeed(),settings:defaultWorldGenerationSettings(),size:250,season:'auto'};})),primary]};
  }

  function renderSite(): NativePage {
    const preview=flow?.preview;
    if(!preview)return{id:'',title:'Lieu de départ',rows:[{id:'missing-preview',label:'Le monde préparé n’est plus disponible.'}],actions:[control('regenerate','Revenir aux paramètres',()=>navigate('world'))]};
    const surface=preview.geography.surface,scope=`${generation}:${preview.generation}:${preview.key}`;
    if(nativeSiteView.scope!==scope){nativeSiteView.scope=scope;nativeSiteView.tab='facts';}
    const choose=(id:number)=>{
      if(!open||page!=='site'||busy||pending||flow?.preview!==preview)throw Error('Le choix du lieu n’est plus disponible dans cette préparation.');
      if(!Number.isSafeInteger(id)||!eligible.includes(id))throw Error('Ce lieu de départ est indisponible.');
      selectedTile=id;nativeSiteView.tab='facts';
    };
    const changeView=(tab:typeof nativeSiteView.tab)=>{if(open&&page==='site'&&!busy&&!pending&&flow?.preview===preview)nativeSiteView.tab=tab;};
    const random=control('tile-random','Lieu aléatoire',()=>{
      const limit=Math.floor(0x100000000/eligible.length)*eligible.length;let draw:number;
      do{draw=crypto.getRandomValues(new Uint32Array(1))[0]!;}while(draw>=limit);
      choose(eligible[draw%eligible.length]!);siteOffset=Math.floor(eligible.indexOf(selectedTile!)/16)*16;
    },!eligible.length);
    const rows:NativeRow[]=[{id:'site-views',region:'navigation',label:'',controlStyle:'tab',compact:true,controls:[
      control('site-view-facts','Lieu choisi',()=>changeView('facts'),false,nativeSiteView.tab==='facts'),
      control('site-view-places','Lieux disponibles',()=>changeView('places'),false,nativeSiteView.tab==='places'),
      control('site-view-factions','Factions',()=>changeView('factions'),false,nativeSiteView.tab==='factions'),
    ]},{...input('tile-input','Numéro de case',selectedTile===null?'':String(selectedTile),value=>choose(Number(value)),'number'),region:'navigation',compact:true},
      {id:'site-selection-tools',region:'navigation',presentation:'plain',compact:true,label:`${eligible.length} lieux disponibles`,controls:[random],hint:'La sélection ne génère pas de carte locale. Confirmer valide ce lieu avant le choix des personnages.'}];
    const detail=(row:NativeRow):NativeRow=>({...row,region:'details',presentation:'plain',dense:true,compact:true});
    if(nativeSiteView.tab==='facts'){
      if(selectedTile===null)rows.push(detail({id:'site-list-summary',label:'Choisissez un lieu sur le globe ou dans la liste.',hint:'Le numéro de case et le bouton Lieu aléatoire restent disponibles au-dessus.'}));
      else{
        const site=describeWorldSite(surface,preview.geography.roads,selectedTile),calendar=worldCreationCalendarFacts262(surface.tiles[selectedTile]!,parameters.season);
        const facts=[['Case',String(site.tileId)],['Biome',nativeSiteBiome(site.biome)],['Coordonnées',`${site.latitude.toFixed(2)}° / ${site.longitude.toFixed(2)}°`],['Relief',HILLINESS_LABELS[site.hilliness]],
          ['Altitude',`${Math.round(site.elevation)} m`],['Température moyenne',`${site.meanTemperature.toFixed(1)} °C`],['Précipitations',`${Math.round(site.rainfall)} mm/an`],
          ['Roches naturelles',site.hasBedrock?site.naturalRocks.map(stone=>STONE_LABELS[stone]).join(', '):'Aucune roche de sous-sol'],['Côte océanique',site.coastAngle===null?'Non':'Oui'],
          ['Cours d’eau',site.rivers.map(river=>nativeSiteRiverNames[river.river]).join(', ')||'Aucun'],['Routes',site.roads.map(road=>nativeSiteRoadNames[road.road]).join(', ')||'Aucune'],['Voisins',surface.tiles[selectedTile]!.neighbours.join(', ')],
          ['Taille de la carte',`${parameters.size} × ${parameters.size}`],['Saison choisie',calendar.choice],['Date de départ',calendar.date],['Cycle saisonnier',calendar.seasonalRange]];
        facts.forEach(([label,value],index)=>rows.push(detail({id:`site-fact-${index+2}`,label:label!,value:value!})));
      }
    }else if(nativeSiteView.tab==='places'){
      rows.push(detail({id:'site-list-summary',label:`${eligible.length} lieux disponibles`,hint:'Choisir une ligne ouvre les informations du lieu sans créer de carte.'}));
      for(const id of eligible.slice(siteOffset,siteOffset+16)){
        const tile=surface.tiles[id]!;
        rows.push(detail({id:`tile-${id}`,label:`Case ${id} · ${nativeSiteBiome(tile.biome)}`,value:`${tile.meanTemperature.toFixed(1)} °C · ${Math.round(tile.rainfall)} mm/an · ${HILLINESS_LABELS[tile.hilliness]}`,controls:[control(`choose-tile-${id}`,'Choisir',()=>choose(id),false,selectedTile===id)]}));
      }
      rows.push(detail({id:'tile-pagination',label:`${siteOffset+(eligible.length?1:0)}–${Math.min(siteOffset+16,eligible.length)} / ${eligible.length}`,controls:[
        control('tiles-previous','Précédents',()=>{siteOffset=Math.max(0,siteOffset-16);},siteOffset===0),
        control('tiles-next','Suivants',()=>{siteOffset+=16;},siteOffset+16>=eligible.length),
      ]}));
    }else{
      for(const faction of preview.factions.filter(faction=>!faction.hidden)){
        const count=preview.settlements.filter(settlement=>settlement.factionId===faction.id).length;
        rows.push(detail({id:`world-faction-${faction.id}`,label:faction.name,value:`${count} implantation${count===1?'':'s'}`}));
      }
    }
    return{id:'',title:'Choisir le lieu de départ',layout:'setup',columnRatio:.58,contentKey:`${scope}:${nativeSiteView.tab}:${selectedTile??'none'}`,rows,
      visual:{kind:'planet',surface,roads:preview.geography.roads,selected:selectedTile,markers:preview.settlements.map(settlement=>({tile:settlement.tile,label:settlement.name,color:0x8d7e9c})),onSelect:id=>{
        error='';try{choose(id);siteOffset=Math.floor(eligible.indexOf(id)/16)*16;}catch(cause){error=errorMessage(cause);}paint();
      }},actions:navigation(control('confirm-site','Suivant',()=>{
        if(selectedTile===null)return;
        const calendar=worldCreationCalendarFacts262(surface.tiles[selectedTile]!,parameters.season);
        confirmation={message:`Confirmer la case ${selectedTile} · ${parameters.size} × ${parameters.size} · ${calendar.choice} · ${calendar.date} ?`,accept:confirmSite};
      },selectedTile===null))};
  }

  function renderPawns(): NativePage {
    const draftGeneration=generation,draftSeed=teamSeed,party=previewStartingParty(teamSeed,roster.slice(0,3));
    const selectedProfiles=new Map(party.pawns.map(pawn=>[pawn.id,pawn] as const));
    const profiles=roster.map(descriptor=>selectedProfiles.get(descriptor.serial)??previewStartingCandidate(teamSeed,descriptor));
    const current=()=>open&&page==='pawns'&&generation===draftGeneration&&teamSeed===draftSeed;
    const live=(serial:number,version:number)=>current()?roster.find(candidate=>candidate.serial===serial&&candidate.generation===version):undefined;
    const reorder=(serial:number,target:number)=>{
      if(!current()||!Number.isSafeInteger(target)||target<0||target>=roster.length)return;
      const from=roster.findIndex(candidate=>candidate.serial===serial);if(from<0||from===target)return;
      const next=[...roster];next.splice(target,0,next.splice(from,1)[0]!);roster=next;
    };
    const rows: NativeRow[]=[{id:'party-help',region:'navigation',presentation:'plain',compact:true,label:'Choisir trois personnes',value:'Les trois premiers partent.',hint:'Sélectionnez un candidat dans la liste puis choisissez sa place dans le dossier. Monter et descendre conservent les huit profils et leur ordre relatif.'}];
    for(const [index,descriptor] of roster.entries()){
      if(index===0||index===3)rows.push({id:index===0?'party-selected-heading':'party-reserve-heading',region:'catalogue',presentation:'plain',compact:true,emphasis:'heading',label:index===0?'Au départ':'Laissés sur place'});
      const pawn=profiles[index]!,story=pawn.background?(pawn.background.adulthood?ADULTHOODS[pawn.background.adulthood].label:CHILDHOODS[pawn.background.childhood].label):'Passé non renseigné';
      rows.push({id:`candidate-${descriptor.serial}`,region:'catalogue',label:'',compact:true,controlStyle:'button',controls:[{
        ...control(`inspect-${descriptor.serial}`,pawn.name,()=>{if(live(descriptor.serial,descriptor.generation))inspected=descriptor.serial;},false,inspected===descriptor.serial),
        hint:[pawn.name,index<3?'Au départ':'Laissé sur place',story,pawn.age?`${biologicalYears(pawn.age)} ans biologiques · ${chronologicalYears(pawn.age)} ans chronologiques`:'Âge non renseigné'].join('\n'),
      }]});
    }
    let portrait:NativePage['portrait'];
    const descriptor=roster.find(candidate=>candidate.serial===inspected)??roster[0];
    if(descriptor){
      const position=roster.findIndex(candidate=>candidate.serial===descriptor.serial),pawn=profiles[position]!,selected=position<3;
      const details=(row:NativeRow,setupColumn:0|1|2=0):NativeRow=>({...row,region:'details',setupColumn,dense:true,compact:true});
      const heading=(id:string,label:string,setupColumn:0|1|2=0):NativeRow=>details({id,label,emphasis:'heading',presentation:'plain'},setupColumn);
      const look=apparelAppearance([]);
      // This remains a view of the cloth shirt actually supplied at departure.
      // Hiding it neither creates a pile nor changes a candidate's equipment.
      if(showCandidateClothes){look.shirt=true;look.silhouette=1;look.color=APPAREL['cloth-shirt'].color;look.signature='cloth-shirt';}
      portrait={url:portraitDataUrl(appearanceOf(pawn,teamSeed),look,undefined,portraitExpressionOf(pawn),humanLimbVisualMask(pawn)),label:`Portrait de ${pawn.name}`};
      const identity=input('candidate-name','Nom',pawn.name,value=>{
        if(!live(descriptor.serial,descriptor.generation))return false;
        const name=value.trim();if(!validStartingCandidateName(name))throw Error('Le nom doit contenir 1 à 80 caractères, sans caractères de contrôle.');
        roster=roster.map(candidate=>candidate.serial===descriptor.serial?{...candidate,nameOverride:name}:candidate);
      },'text',80);
      identity.controls=[{...control(`reroll-${descriptor.serial}`,'↻',()=>{if(live(descriptor.serial,descriptor.generation))roster=rerollStartingCandidateForRoster(teamSeed,roster,descriptor.serial);}),hint:'Renouveler ce candidat : les sept autres profils et leur ordre sont conservés.'}];
      rows.push({...identity,region:'details',dense:true,compact:true},{id:'candidate-age',region:'details',dense:true,compact:true,label:'Âge bio. / chrono.',value:pawn.age?`${biologicalYears(pawn.age)} / ${chronologicalYears(pawn.age)} ans`:'Non renseigné'});
      rows.push(details({id:'candidate-actions',label:'',controls:[
        {...control(`promote-${descriptor.serial}`,selected?'Laisser sur place':'Choisir pour le départ',()=>{if(live(descriptor.serial,descriptor.generation))reorder(descriptor.serial,roster.findIndex(candidate=>candidate.serial===descriptor.serial)<3?3:2);}),hint:selected?'Place ce profil après les trois personnes choisies ; le candidat suivant rejoint le départ.':'Place ce profil en troisième position ; la dernière personne choisie passe dans les réserves.'},
        {...control(`up-${descriptor.serial}`,'↑',()=>{if(live(descriptor.serial,descriptor.generation))reorder(descriptor.serial,roster.findIndex(candidate=>candidate.serial===descriptor.serial)-1);},position===0),hint:'Monter ce candidat d’une place.'},
        {...control(`down-${descriptor.serial}`,'↓',()=>{if(live(descriptor.serial,descriptor.generation))reorder(descriptor.serial,roster.findIndex(candidate=>candidate.serial===descriptor.serial)+1);},position===roster.length-1),hint:'Descendre ce candidat d’une place.'},
      ]}));
      rows.push(details({id:'candidate-clothing',label:'Tenue du portrait',controls:[control('candidate-clothing',showCandidateClothes?'Masquer les vêtements':'Montrer les vêtements',()=>{if(current())showCandidateClothes=!showCandidateClothes;},false,showCandidateClothes)]}));
      rows.push(heading('candidate-story-heading','Histoire'));
      if(pawn.background){
        const childhood=CHILDHOODS[pawn.background.childhood];rows.push(details({id:'childhood',label:'Enfance',value:childhood.label,hint:childhood.description}));
        if(pawn.background.adulthood){const adulthood=ADULTHOODS[pawn.background.adulthood];rows.push(details({id:'adulthood',label:'Adulte',value:adulthood.label,hint:adulthood.description}));}
      }else rows.push(details({id:'candidate-story-none',label:'Passé non renseigné'}));
      rows.push(heading('candidate-traits','Traits'));
      for(const id of pawn.traits??[])rows.push(details({id:`candidate-trait-${id}`,label:TRAITS[id].label,hint:TRAITS[id].description}));
      if(!pawn.traits?.length)rows.push(details({id:'candidate-traits-none',label:'Aucun trait'}));
      rows.push(heading('candidate-work-heading','Incapable de'));
      let refused=0;
      for(const work of Object.keys(BACKGROUND_WORK_LABELS) as WorkType[]){const refusal=backgroundWorkRefusal(pawn,work);if(refusal){refused++;rows.push(details({id:`refused-${work}`,label:BACKGROUND_WORK_LABELS[work],hint:refusal}));}}
      if(!refused)rows.push(details({id:'candidate-work-none',label:'Aucune incapacité enregistrée'}));
      rows.push(heading('candidate-skills-heading','Compétences',1));
      for(const skill of BACKGROUND_SKILL_IDS){
        const record=pawn.skills[skill]??{level:0,xp:0,dailyXp:0,passion:0 as const},refusal=backgroundSkillRefusal(pawn,skill),passion=record.passion===2?'Forte passion':record.passion===1?'Passion':'Sans passion';
        rows.push(details({id:`skill-${skill}`,label:names[skill]!,value:refusal?'Incapable':`${record.level} / 20`,meter:{value:refusal?0:record.level,max:20,passion:record.passion,label:refusal?'Incapable':`${record.level} / 20`},hint:[names[skill],refusal?`${refusal} · Niveau enregistré ${record.level} / 20`:undefined,passion,`${(record.xp/XP_SCALE).toFixed(1)} / ${xpRequired(record.level)/XP_SCALE} XP`,`Apprentissage ${Math.round(learningFactor(record,pawn)*100)} %`].filter(Boolean).join('\n')},1));
      }
      const health=pawn.health;
      const conditions:NativeRow[]=[...(health?.injuries??[]).map(injury=>({id:`candidate-injury-${injury.id}`,label:BODY_PARTS[injury.part].label,value:`${injury.scar?.pain!==undefined?'Cicatrice':INJURY_RULES[injury.kind].label} · −${(injury.severity/HP_UNIT).toFixed(1)} PV`})),
        ...(health?.missing??[]).map(part=>({id:`candidate-missing-${part.part}`,label:BODY_PARTS[part.part].label,value:'Partie perdue'})),
        ...(health?.ageAilments??[]).map(ailment=>({id:`candidate-age-condition-${ailment}`,label:ailment==='bad-back'?'Lumbago':'Frêle',hint:ailment==='bad-back'?'Mouvement −30 points · Manipulation −10 points':'Mouvement et manipulation −30 points'})),
        ...nativeClinicalConditionRows(health)];
      rows.push(heading('candidate-health-heading','Santé',2),...conditions.map(row=>details(row,2)));
      if(!conditions.length)rows.push(details({id:'candidate-health-none',label:'Aucun problème de santé enregistré'},2));
      rows.push(heading('candidate-relations-heading','Relations',2));
      const relationships=captureRelationshipIndex(party.relationships);let related=0;
      for(const other of party.pawns){if(other.id===pawn.id)continue;const kinds=relationshipKinds(relationships,pawn.id,other.id);if(kinds.length){related++;rows.push(details({id:`relationship-${other.id}`,label:other.name,value:kinds.map(kind=>({parent:'Parent',child:'Enfant',sibling:'Fratrie',lover:'Partenaire',spouse:'Conjoint','ex-lover':'Ancien partenaire','ex-spouse':'Ancien conjoint'})[kind]).join(', ')},2));}}
      if(!related)rows.push(details({id:'candidate-relations-none',label:'Aucun lien connu dans l’équipe choisie'},2));
      BACKGROUND_SKILL_IDS.forEach(skill=>{
        const usable=party.pawns.filter(person=>!backgroundSkillRefusal(person,skill));
        const best=usable.reduce<typeof usable[number]|undefined>((previous,person)=>{const record=person.skills[skill],before=previous?.skills[skill];return!previous||(record?.level??0)>(before?.level??0)||(record?.level??0)===(before?.level??0)&&(record?.passion??0)>(before?.passion??0)?person:previous;},undefined);
        rows.push({id:`team-${skill}`,region:'graph',presentation:'plain',dense:true,compact:true,label:names[skill]!,labelWidth:100,value:best?`${best.skills[skill]?.level??0} / 20`:'—',meter:{value:best?.skills[skill]?.level??0,max:20,passion:best?.skills[skill]?.passion??0,label:best?`${best.skills[skill]?.level??0} / 20`:'Incapable'},hint:[`Compétence utilisable de l’équipe · ${names[skill]}`,best?`Meilleur niveau : ${best.name}`:'Aucune personne choisie ne peut pratiquer cette compétence.',...party.pawns.map(person=>`${person.name} : ${backgroundSkillRefusal(person,skill)?'Incapable':`${person.skills[skill]?.level??0} / 20 · ${person.skills[skill]?.passion===2?'Forte passion':person.skills[skill]?.passion===1?'Passion':'Sans passion'}`}`)].join('\n')});
      });
    }
    if(busy&&pending)rows.push({id:'cancel-local',region:'navigation',label:'Préparation de la colonie',controls:[control('cancel-local','Annuler la préparation',()=>{flow?.cancel();status='Annulation demandée…';},false,false,true)]});
    return{id:'',title:'Préparer les personnages',layout:'setup',contentKey:`${draftGeneration}:${draftSeed}:${descriptor?.serial??''}`,setupCatalogueWidth:240,width:1260,height:764,rows,portrait,actions:navigation(control('start-colony','Démarrer',askStart,!flow?.ticket))};
  }

  function importFile(): void {
    // Browser-owned picker only: hidden, never measured or used for native UI
    // layout. DOM ownership keeps it alive until selection or cancellation.
    const picker = document.createElement('input'); picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true;
    const cleanup = () => { picker.removeEventListener('change', selected); picker.removeEventListener('cancel', cleanup); picker.remove(); };
    const selected = () => { try { const file = picker.files?.[0]; if (file) void run(() => options.onImport(file), 'Vérification du fichier et préparation de la colonie…'); } finally { cleanup(); } };
    picker.addEventListener('change', selected, { once: true }); picker.addEventListener('cancel', cleanup, { once: true });
    try { document.body.append(picker); picker.click(); } catch (cause) { cleanup(); throw cause; }
  }
  function downloadTest(save: TestColony): void {
    // Browser download service, as in the original catalogue. This unattached
    // link supplies no visible control/layout and also works without the File
    // System Access API (notably Firefox).
    const link=document.createElement('a');link.href=testColonyUrl(save);link.download=save.filename;link.click();
  }
  async function loadTestCatalogue(): Promise<void> {
    navigate('tests');
    if (tests) return;
    const loaded = await run(async () => { tests = await options.getTestColonies(); }, 'Chargement du catalogue de test…');
    if (loaded) paint();
  }
  function renderLoad():NativePage {
    let saves:ReturnType<FrontMenuOptions['getSaves']>=[];try{saves=options.getSaves();}catch(cause){error=errorMessage(cause);}
    const kinds={manual:'Sauvegarde manuelle',recovery:'Colonie précédente',named:'Sauvegarde nommée',auto:'Copie automatique'} as const;
    const entries=saves.map(save=>{
      const caption=[save.kind?kinds[save.kind]:'Colonie enregistrée',save.savedAt===undefined?'':new Date(save.savedAt).toLocaleString('fr-FR')].filter(Boolean).join(' · ');
      // Keep the former load control and its fresh repository lookup intact.
      const load=control(`load-save-${save.key}`,save.label,()=>run(async()=>{const current=options.getSaves().find(entry=>entry.key===save.key);if(!current||current.disabled)throw Error('Cette sauvegarde n’est plus disponible. Actualisez la liste avant de la charger.');await options.onLoad(current.key);},'Vérification et chargement de la sauvegarde…'),save.disabled);
      return{save,caption,load};
    });
    const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
    const query=fold(loadSearch.trim()),visible=entries.filter(({save,caption})=>!query||fold([save.label,caption,save.detail].join(' ')).includes(query));
    const selected=entries.find(({save})=>save.key===selectedLoadKey);
    const search={...input('load-search','Rechercher une colonie',loadSearch,value=>{loadSearch=value;selectedLoadKey=undefined;},'text',160),region:'navigation' as const};
    const rows:NativeRow[]=[search,{id:'load-count',label:`${visible.length} / ${saves.length} copies`,region:'navigation',dense:true},
      ...visible.map(({save,caption}):NativeRow=>({id:`save-${save.key}`,label:'',region:'catalogue',controls:[{
        ...control(`select-save-${save.key}`,save.label,()=>{selectedLoadKey=save.key;},false,selectedLoadKey===save.key),hint:[save.label,caption,save.detail].join('\n'),
      }]}))];
    if(!visible.length)rows.push({id:'no-save',label:saves.length?'Aucune copie ne correspond à la recherche.':'Aucune colonie enregistrée',region:'catalogue'});
    if(selected){
      rows.push({id:'selected-save-name',label:selected.save.label,emphasis:'heading',region:'details'},
        {id:'selected-save-kind',label:'Type de copie',value:selected.save.kind?kinds[selected.save.kind]:'Colonie enregistrée',region:'details'},
        {id:'selected-save-time',label:'Enregistrée',value:selected.save.savedAt===undefined?'Date non enregistrée':new Date(selected.save.savedAt).toLocaleString('fr-FR'),region:'details'},
        {id:'selected-save-detail',label:'Détails',detail:selected.save.detail,region:'details'},
        {id:'selected-save-availability',label:selected.save.disabled?'Chargement indisponible':'Copie sélectionnée',detail:'La sélection ne charge pas la colonie. Le bouton Charger vérifie de nouveau sa disponibilité.',region:'details'});
    }else rows.push({id:'load-selection-help',label:'Choisissez une copie',detail:'Sélectionnez une sauvegarde pour lire ses informations, puis utilisez Charger.',region:'details'});
    const load=selected?control('load-selected','Charger',()=>{
      if(selectedLoadKey!==selected.save.key)throw Error('Le choix de sauvegarde a changé. Sélectionnez de nouveau une copie.');
      return selected.load.onActivate();
    },!!selected.load.disabled):control('load-selected','Charger',()=>{},true);
    return{id:'',title:'Charger une partie',subtitle:'Sélectionner une copie affiche ses informations ; Charger ouvre la colonie en pause.',rows,width:900,height:760,layout:'setup',setupCatalogueWidth:300,contentKey:`load-${loadSearch}`,
      actions:[...navigation(),control('test-colonies','Colonies de test',loadTestCatalogue),control('import','Importer un fichier',importFile),
        ...(hasGame&&options.onExport?[control('export','Exporter la partie actuelle',()=>run(options.onExport!,'Préparation du fichier de la partie actuelle…'))]:[]),load]};
  }

  function renderPage(): NativePage {
    if (page === 'options') return renderOptions();
    if (page === 'world') return renderWorld();
    if (page === 'site') return renderSite();
    if (page === 'pawns') return renderPawns();
    if (page === 'home') return { id: '', title: 'ELSEWHERE', subtitle: 'Trois vies. Un nouveau foyer. À vous d’écrire la suite.', rows: [
      ...(hasGame ? [{ id: 'resume', label: 'Colonie en pause', controls: [control('resume', 'Reprendre la colonie', () => run(options.onResume, 'Reprise de la colonie…'))] }] : []),
      { id: 'home-new', label: 'Nouvelle partie', controls: [control('new-game', 'Nouvelle partie', showCreation)] },
      { id: 'home-load', label: 'Vos colonies', controls: [control('load-game', 'Charger une partie', () => navigate('load'))] },
      { id: 'home-options', label: 'Préférences locales', controls: [control('options', 'Options', () => navigate('options'))] },
      ...(options.onHelp ? [{ id: 'home-help', label: 'Aide', controls: [control('help', 'Aide', () => {externalPage=true;options.onHelp!();})] }] : []),
      { id: 'later', label: 'En développement', controls: ['Tutoriel', 'Mods', 'Crédits'].map(label => control(`later-${label}`, label, () => {}, true)) },
    ] };
    if (page === 'scenario') return { id: '', title: 'Scénario', rows: [
      { id: 'scenario', label: 'Atterrissage forcé', detail: 'Trois survivants arrivent dans un territoire inconnu. Adaptation partielle.', controls: [control('crashlanded', 'Choisi', () => {}, false, true)] },
      { id: 'supplies', label: 'Vos provisions', value: 'Bois 300 · Acier 450 · Composants 30 · Rations 50 · Médicaments 30 · Argent 800' },
      { id: 'equipment', label: 'Équipement', value: 'Fusil à verrou · Revolver · Couteau en plastacier · Gilet pare-balles · Chemises en tissu' },
      { id: 'knowledge', label: 'Trois personnes parmi huit candidats', detail: 'Taille de pierre, Mobilier complexe, Vêtements complexes et Climatisation déjà connus. Casque, pantalon de protection, animal domestique et provisions dispersées restent absents.' },
      { id: 'other-scenarios', label: 'Autres scénarios', controls: ['Tribu perdue', 'Le riche explorateur', 'Brutalité nue', 'Personnalisé', 'Steam Workshop'].map(label => control(label, label, () => {}, true)) },
    ], actions: navigation(control('scenario-next', 'Suivant', () => navigate('story'))) };
    if (page === 'story') return { id: '', title: 'Narrateur et aventure', rows: [
      { id: 'narrator', label: 'Cassandra Classique', detail: 'Introduction partielle : installation, rencontres et menaces. La variété des événements reste incomplète.' },
      { id: 'difficulty', label: 'Niveau d’aventure', controls: ['Pacifique', 'Bâtisseur de communauté', 'Récit d’aventure', 'Lutte pour la survie', 'De sang et de poussière', 'Perdre est amusant', 'Personnalisation en détail'].map(label => control(`difficulty-${label}`, label, () => { difficultyChosen = true; }, label !== 'Récit d’aventure', difficultyChosen && label === 'Récit d’aventure')) },
      { id: 'saving', label: 'Mode de sauvegarde', controls: [control('reloadable', 'Rechargeable à tout moment', () => { reloadChosen = true; }, false, reloadChosen), control('commitment', 'Engagement', () => {}, true)] },
    ], actions: navigation(control('story-next', 'Suivant', () => { if (!difficultyChosen || !reloadChosen) throw Error('Choisissez Récit d’aventure et le mode de sauvegarde pour continuer.'); navigate('world'); })) };
    if (page === 'tests') {
      const rows: NativeRow[] = [];
      for (const save of tests ?? []) {
        const caption=`${save.colonists} colons · ${save.width} × ${save.height} · ${save.prepared?'Situation préparée':'Colonie jouée'}`;
        const description=[save.description,save.focus.length?`À explorer : ${save.focus.join(' · ')}`:'',...save.steps.map((step,index)=>`${index+1}. ${step}`),save.provenance].filter(Boolean).join('\n');
        rows.push({id:`test-${save.id}`,label:'',controlStyle:'card',controls:[
          {...control(`load-test-${save.id}`,save.label,()=>run(()=>options.onLoadTest(save),'Chargement de la colonie de test…')),presentation:'card',icon:'load',color:'#f3ead6',caption,description,hint:[save.label,caption,description].join('\n')},
          {...control(`download-test-${save.id}`,'Télécharger ce fichier',()=>downloadTest(save)),presentation:'icon',icon:'load',hint:`Télécharger « ${save.label} » sans ouvrir la colonie.`},
        ]});
      }
      rows.push({ id: 'test-preservation', label: 'La sauvegarde manuelle reste intacte. La colonie ouverte est conservée dans « Colonie précédente ». Sauvegardez votre progression avant de multiplier les essais.' });
      return { id: '', title: 'Colonies de test', rows, actions: navigation() };
    }
    return renderLoad();
  }

  function showCreation(): void {
    if (busy || pending) return;
    difficultyChosen = reloadChosen = false; invalidateDraft();
    let seed = ''; try { seed = randomSiteSeed(); teamSeed = Number(randomSiteSeed()); } catch { teamSeed = 0; }
    parameters = { seed, settings: defaultWorldGenerationSettings(), size: 250, season: 'auto' };
    roster = createStartingCandidateRoster(teamSeed); inspected = roster[0]!.serial; navigate('scenario');
  }
  function hide(): void { generation++; flow?.cancel(); confirmation = undefined; open = false; if (!pending) busy = false; show(null); }
  return {
    showHome(nextHasGame = hasGame) { if (busy || pending) return; hasGame = nextHasGame; navigate('home'); },
    setHasGame(next) { hasGame = next; if (page === 'home') paint(); },
    showCreation,
    showOptions(){if(!busy&&!pending)navigate('options');},
    showLoad() { if (!busy && !pending) navigate('load'); },
    hide, isOpen: () => open,
    setBusy(next, message = 'Préparation de la colonie…') { busy = next; status = next ? message : ''; paint(); },
    showError(message) { error = message; paint(); },
  };
}
