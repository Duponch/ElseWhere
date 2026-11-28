import type { Pawn,World } from './types.ts';
import type { BackgroundSkillId,BackgroundWorkTag } from './colonist-backgrounds.ts';

/** One trait degree. IDs are persisted; labels, descriptions and the derived
 * numbers are not. `since` marks the degrees a save may hold only from that
 * schema (361: the Core trait set). Numbers come from Core TraitDefs. */
export interface TraitDefinition {
  readonly label:string;
  /** Before 361: at most one trait per group. From 361 Core's own conflicts apply. */
  readonly group:string;
  readonly mood:number;readonly learning:number;
  /** MentalBreakThreshold offset, in mood points (Core 0.09 = 9). */
  readonly breakOffset:number;
  readonly description:string;
  readonly since?:361|362|368;
  /** Core TraitDef (defName) and degree; a spectrum keeps one degree per def. */
  readonly def:CoreTraitDefName;readonly degree:number;
  readonly workSpeed?:number;readonly moveSpeed?:number;
  readonly meleeHit?:number;readonly meleeDodge?:number;
  readonly shootingAccuracy?:number;readonly aimingDelay?:number;
  readonly beauty?:number;readonly psychic?:number;readonly immunity?:number;
  readonly incomingDamageFactor?:number;readonly restRate?:number;readonly hungerFactor?:number;
  readonly trapSpringFactor?:number;
  readonly skillGains?:Readonly<Partial<Record<BackgroundSkillId,number>>>;
  readonly randomDiseaseMtbDays?:number;
  /** Core TraitDef.disabledWorkTags (schema 368: Pyromaniac, Firefighting). */
  readonly disabledWorkTags?:readonly BackgroundWorkTag[];
}
export type CoreTraitDefName='SpeedOffset'|'DrugDesire'|'NaturalMood'|'Nerves'|'Neurotic'|'Industriousness'|'PsychicSensitivity'|'ShootingAccuracy'|'Beauty'|'Immunity'
  |'Nudist'|'Bloodlust'|'Kind'|'Psychopath'|'Cannibal'|'Abrasive'|'TooSmart'|'Brawler'|'Masochist'|'NightOwl'|'Greedy'|'Jealous'|'Ascetic'|'Gay'|'Bisexual'|'Asexual'
  |'AnnoyingVoice'|'CreepyBreathing'|'Pyromaniac'|'Wimp'|'Nimble'|'FastLearner'|'SlowLearner'|'Undergrounder'|'Transhumanist'|'BodyPurist'|'DislikesMen'|'DislikesWomen'
  |'GreatMemory'|'Tough'|'TorturedArtist'|'Gourmand'|'QuickSleeper';

const t=(def:CoreTraitDefName,degree:number,label:string,description:string,effects:Partial<Omit<TraitDefinition,'def'|'degree'|'label'|'description'>>={}):TraitDefinition=>
  Object.freeze({group:def,mood:0,learning:0,breakOffset:0,...effects,def,degree,label,description,...effects.skillGains?{skillGains:Object.freeze({...effects.skillGains})}:{}});
const n=(def:CoreTraitDefName,degree:number,label:string,description:string,effects:Partial<Omit<TraitDefinition,'def'|'degree'|'label'|'description'|'since'>>={}):TraitDefinition=>t(def,degree,label,description,{...effects,since:361});
/** Schema 362: the traits that link the outdoors need, inspirations and pain (trait-links-362). */
const n362=(def:CoreTraitDefName,degree:number,label:string,description:string,effects:Partial<Omit<TraitDefinition,'def'|'degree'|'label'|'description'|'since'>>={}):TraitDefinition=>t(def,degree,label,description,{...effects,since:362});
/** Schema 368: Pyromaniac and its fire-starting spree (pyromaniac-368). */
const n368=(def:CoreTraitDefName,degree:number,label:string,description:string,effects:Partial<Omit<TraitDefinition,'def'|'degree'|'label'|'description'|'since'>>={}):TraitDefinition=>t(def,degree,label,description,{...effects,since:368});

/** The first nine keys keep their historical order: the pre-361 starting
 * candidate draw ranks exactly these. */
export const TRAITS = Object.freeze({
  optimist:t('NaturalMood',1,'Optimiste','Humeur naturelle : +6 points en permanence.',{group:'mood',mood:6}),
  pessimist:t('NaturalMood',-1,'Pessimiste','Humeur naturelle : −6 points en permanence.',{group:'mood',mood:-6}),
  steadfast:t('Nerves',1,'Résolu','Seuil de crise mineure réduit de 9 points ; seuils majeur et extrême proportionnels.',{group:'nerves',breakOffset:-9}),
  nervous:t('Nerves',-1,'Nerveux','Seuil de crise mineure augmenté de 8 points ; ne diminue pas directement l’humeur.',{group:'nerves',breakOffset:8}),
  'fast-learner':t('FastLearner',0,'Apprentissage rapide','Apprentissage général : 175 %. Passion et saturation quotidienne se multiplient ensuite ; oubli inchangé.',{group:'learning',learning:.75}),
  'slow-learner':t('SlowLearner',0,'Apprentissage lent','Apprentissage général : 25 %. Aucun ralentissement direct du travail ; oubli inchangé.',{group:'learning',learning:-.75}),
  kind:t('Kind',0,'Aimable','N’initie ni vexation ni insulte et peut offrir des mots gentils : opinion +15 et humeur +5 pour la cible. Ne juge personne sur son apparence, sa voix ou sa respiration.',{group:'social-tone'}),
  abrasive:t('Abrasive',0,'Incisif','Vexations et insultes 2,3 fois plus probables parmi les échanges admissibles.',{group:'social-tone'}),
  bloodlust:t('Bloodlust',0,'Sanguinaire','Quatre fois plus susceptible de déclencher une bagarre après une vexation ou une insulte. Savoure les morts humaines vues et ne souffre pas des souvenirs de cadavres observés. Un colon laissé sans sépulture affecte toujours son humeur.',{group:'social-violence'}),
  // Schema 361: the rest of the Core set, degree by degree.
  slowpoke:n('SpeedOffset',-1,'Lambin','Vitesse de marche de base 4,4 cases par seconde au lieu de 4,6.',{moveSpeed:-.2}),
  'fast-walker':n('SpeedOffset',1,'Marcheur rapide','Vitesse de marche de base 4,8 cases par seconde au lieu de 4,6.',{moveSpeed:.2}),
  jogger:n('SpeedOffset',2,'Coureur','Vitesse de marche de base 5 cases par seconde au lieu de 4,6.',{moveSpeed:.4}),
  'chemical-fascination':n('DrugDesire',2,'Fasciné par les drogues','Choisit la frénésie alcoolique cinq fois plus souvent lors d’une crise majeure. Opinion −30 des abstinents envers lui, et de lui envers eux.'),
  'chemical-interest':n('DrugDesire',1,'Attiré par les drogues','Choisit la frénésie alcoolique 2,5 fois plus souvent lors d’une crise majeure. Opinion −20 des abstinents envers lui, et de lui envers eux.'),
  teetotaler:n('DrugDesire',-1,'Abstinent','Ne boit jamais de bière, ni pour le plaisir ni selon sa politique de drogues, et ne fait jamais de frénésie alcoolique. Opinion −20 des colons attirés par les drogues, −30 des fascinés.'),
  sanguine:n('NaturalMood',2,'Jovial','Humeur naturelle : +12 points en permanence.',{mood:12}),
  depressive:n('NaturalMood',-2,'Dépressif','Humeur naturelle : −12 points en permanence.',{mood:-12}),
  'iron-willed':n('Nerves',2,'Volonté de fer','Seuil de crise mineure réduit de 18 points ; seuils majeur et extrême proportionnels.',{breakOffset:-18}),
  volatile:n('Nerves',-2,'Instable','Seuil de crise mineure augmenté de 15 points ; seuils majeur et extrême proportionnels.',{breakOffset:15}),
  neurotic:n('Neurotic',1,'Névrosé','Vitesse de travail générale +20 %, mais seuil de crise mineure augmenté de 8 points.',{workSpeed:.2,breakOffset:8}),
  'very-neurotic':n('Neurotic',2,'Très névrosé','Vitesse de travail générale +40 %, mais seuil de crise mineure augmenté de 14 points.',{workSpeed:.4,breakOffset:14}),
  industrious:n('Industriousness',2,'Bourreau de travail','Vitesse de travail générale +35 %. Opinion −5 des colons sans ardeur particulière, −20 des paresseux, −30 des indolents.',{workSpeed:.35}),
  'hard-worker':n('Industriousness',1,'Travailleur','Vitesse de travail générale +20 %. Opinion −5 des colons sans ardeur particulière, −20 des paresseux, −30 des indolents.',{workSpeed:.2}),
  lazy:n('Industriousness',-1,'Paresseux','Vitesse de travail générale −20 %.',{workSpeed:-.2}),
  slothful:n('Industriousness',-2,'Indolent','Vitesse de travail générale −35 %.',{workSpeed:-.35}),
  'psychically-hypersensitive':n('PsychicSensitivity',2,'Psychiquement hypersensible','Sensibilité psychique 180 % : l’onde psychique et l’apaisement pèsent 1,8 fois sur son humeur.',{psychic:.8}),
  'psychically-sensitive':n('PsychicSensitivity',1,'Psychiquement sensible','Sensibilité psychique 140 % : l’onde psychique et l’apaisement pèsent 1,4 fois sur son humeur.',{psychic:.4}),
  'psychically-dull':n('PsychicSensitivity',-1,'Psychiquement terne','Sensibilité psychique 50 % : l’onde psychique et l’apaisement pèsent moitié moins sur son humeur.',{psychic:-.5}),
  'psychically-deaf':n('PsychicSensitivity',-2,'Psychiquement sourd','Sensibilité psychique nulle : l’onde psychique et l’apaisement n’ont aucun effet sur son humeur.',{psychic:-1}),
  'careful-shooter':n('ShootingAccuracy',1,'Tireur prudent','Vise 25 % plus longtemps avant chaque tir ; précision comme s’il avait 5 niveaux de Tir de plus.',{aimingDelay:.25,shootingAccuracy:5}),
  'trigger-happy':n('ShootingAccuracy',-1,'Gâchette facile','Vise deux fois moins longtemps avant chaque tir ; précision comme s’il avait 5 niveaux de Tir de moins.',{aimingDelay:-.5,shootingAccuracy:-5}),
  beautiful:n('Beauty',2,'Magnifique','Beauté +2 : opinion +40 des autres, sauf les aimables et les ascètes ; attire bien plus facilement en amour.',{beauty:2}),
  pretty:n('Beauty',1,'Joli','Beauté +1 : opinion +20 des autres, sauf les aimables et les ascètes ; attire bien plus facilement en amour.',{beauty:1}),
  ugly:n('Beauty',-1,'Laid','Beauté −1 : opinion −20 des autres, sauf les aimables et les ascètes ; attire bien moins en amour.',{beauty:-1}),
  'staggeringly-ugly':n('Beauty',-2,'Horriblement laid','Beauté −2 : opinion −40 des autres, sauf les aimables et les ascètes ; attire bien moins en amour.',{beauty:-2}),
  'super-immune':n('Immunity',1,'Super-immunisé','Gain d’immunité contre les maladies +30 %.',{immunity:.3}),
  sickly:n('Immunity',-1,'Maladif','Contracte de lui-même une maladie de la région en moyenne tous les 30 jours (grippe, peste, paludisme, maladie du sommeil, vers ou mécanites selon le biome). Médecine +4 à la naissance.',{randomDiseaseMtbDays:30,skillGains:{medicine:4}}),
  nudist:n('Nudist',0,'Nudiste','Humeur +20 sans vêtement couvrant le torse ou les jambes, −3 sinon.'),
  psychopath:n('Psychopath',0,'Psychopathe','Aucune empathie : ne souffre ni des morts, ni des pertes, ni des cadavres observés, ni d’un colon sans sépulture ; les discussions ne changent pas son opinion des autres et un animal lié ou une caresse ne l’émeut pas.'),
  cannibal:n('Cannibal',0,'Cannibale','Ne souffre pas de voir un cadavre humain frais. La viande humaine n’existe pas encore dans ce jeu.'),
  'too-smart':n('TooSmart',0,'Trop intelligent','Apprentissage général +75 %, mais seuil de crise mineure augmenté de 12 points.',{learning:.75,breakOffset:12}),
  brawler:n('Brawler',0,'Bagarreur','Toucher en mêlée comme avec 4 niveaux de plus. Humeur −10 en portant une arme à distance. Mêlée +4 et Tir −10 à la naissance, jamais de passion pour le tir.',{meleeHit:4,skillGains:{melee:4,shooting:-10}}),
  masochist:n('Masochist',0,'Masochiste','La douleur le réjouit : humeur +5, +10, +15 ou +20 selon la douleur, au lieu des pensées de douleur habituelles.'),
  'night-owl':n('NightOwl',0,'Oiseau de nuit','Éveillé, humeur +16 de 23 h à 5 h et −10 de 11 h à 17 h. L’obscurité ne le gêne pas.'),
  greedy:n('Greedy',0,'Avide','Humeur −8 sans chambre à lui ou dans une chambre peu impressionnante, −6 à −4 dans une chambre ordinaire, rien au-delà.'),
  jealous:n('Jealous',0,'Jaloux','Humeur −8 si un autre colon a une chambre nettement plus impressionnante que la sienne.'),
  ascetic:n('Ascetic',0,'Ascète','Aime les chambres austères (+5 à +3) et n’aime pas les chambres impressionnantes (−5). Ne se plaint pas de manger sans table et ne juge personne sur son apparence.'),
  gay:n('Gay',0,'Homosexuel','N’est attiré que par les personnes de son sexe.'),
  bisexual:n('Bisexual',0,'Bisexuel','Est attiré par les personnes des deux sexes.'),
  asexual:n('Asexual',0,'Asexuel','N’est attiré par personne ; ne tente jamais de séduire.'),
  'annoying-voice':n('AnnoyingVoice',0,'Voix agaçante','Opinion −25 des autres colons qui entendent, sauf les aimables.'),
  'creepy-breathing':n('CreepyBreathing',0,'Respiration inquiétante','Opinion −25 des autres colons qui entendent, sauf les aimables.'),
  nimble:n('Nimble',0,'Agile','Esquive en mêlée comme avec 15 niveaux de plus ; déclenche les pièges dix fois moins souvent.',{meleeDodge:15,trapSpringFactor:.1}),
  'body-modder':n('Transhumanist',0,'Transhumaniste','Humeur −4 sans partie artificielle, +4 à +13 selon leur nombre. Opinion +8 par partie artificielle des autres (au plus +40).'),
  'body-purist':n('BodyPurist',0,'Puriste du corps','Humeur −10 à −35 selon le nombre de ses parties artificielles. Opinion −8 par partie artificielle des autres (au plus −40).'),
  misandrist:n('DislikesMen',0,'Misandre','Opinion −25 de chaque homme.'),
  misogynist:n('DislikesWomen',0,'Misogyne','Opinion −25 de chaque femme.'),
  'great-memory':n('GreatMemory',0,'Grande mémoire','Oublie deux fois moins vite les compétences au-delà du niveau 10.'),
  tough:n('Tough',0,'Coriace','Subit moitié moins de dégâts des coups, balles, pièges, explosions, flammes et éboulements.',{incomingDamageFactor:.5}),
  gourmand:n('Gourmand',0,'Gourmand','Faim 50 % plus rapide. Ses crises mineures sont toujours des frénésies alimentaires, qui peuvent aussi survenir sans raison (une fois tous les 50 jours en moyenne). Cuisine +4 à la naissance.',{hungerFactor:1.5,skillGains:{cooking:4}}),
  'quick-sleeper':n('QuickSleeper',0,'Petit dormeur','Récupère son repos 50 % plus vite en dormant.',{restRate:.5}),
  // Schema 362 (trait-links-362).
  undergrounder:n362('Undergrounder',0,'Souterrain','N’a aucun besoin de plein air et l’obscurité ne le gêne pas. A besoin d’intérieur : dehors, il s’en lasse et en souffre (−1 à −8). Éveillé : +3 à l’intérieur sous un toit construit, +4 sous la roche, −3 dehors.'),
  'tortured-artist':n362('TorturedArtist',0,'Artiste torturé','Humeur −8 en permanence. Quand il se remet d’une crise causée par son humeur, une chance sur deux de recevoir une créativité inspirée. Toujours une passion pour l’art.',{mood:-8}),
  wimp:n362('Wimp',0,'Douillet','La moindre douleur le terrasse : il s’effondre dès 30 % de douleur au lieu de 80 %.'),
  // Schema 368 (pyromaniac-368).
  pyromaniac:n368('Pyromaniac',0,'Pyromane','Adore le feu : refuse toujours d’éteindre un incendie. Ses crises extrêmes sont toujours des frénésies incendiaires, qui peuvent aussi survenir sans raison (une fois tous les 50 jours en moyenne). Humeur +2 par feu proche dans la même pièce (au plus +8).',{disabledWorkTags:Object.freeze(['firefighting'] as const)}),
});
export type TraitId=keyof typeof TRAITS;
/** The degrees with Core disabledWorkTags (schema 368: Pyromaniac). */
const WORK_DISABLING_TRAITS:ReadonlySet<string>=new Set((Object.keys(TRAITS) as TraitId[]).filter(id=>TRAITS[id].disabledWorkTags?.length));
const WORK_TAGS_DISABLED_BY_TRAITS:ReadonlySet<BackgroundWorkTag>=new Set([...WORK_DISABLING_TRAITS].flatMap(id=>TRAITS[id as TraitId].disabledWorkTags??[]));
export type TraitBearer=Pick<Pawn,'traits'>;
/** The nine pre-361 ids, in their historical key order. */
export const LEGACY_TRAIT_IDS:readonly TraitId[]=Object.freeze(['optimist','pessimist','steadfast','nervous','fast-learner','slow-learner','kind','abrasive','bloodlust']);
export const isTraitsSchema361=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=361;
export const hasTrait=(pawn:TraitBearer|undefined,id:TraitId):boolean=>!!pawn?.traits?.includes(id);
/** Holds a trait of the 361 set (the nine older ones give no 361 thought). */
export const holdsCoreTrait361=(pawn:TraitBearer):boolean=>!!pawn.traits?.some(id=>TRAITS[id].since!==undefined);

/** Core TraitDef data used by generation and conflicts, for every Core def
 * (implemented or not: the sexuality draw sums all commonalities). */
export interface CoreTraitDefData {
  readonly commonality:number;readonly commonalityFemale?:number;
  readonly conflicts:readonly CoreTraitDefName[];readonly exclusionTags:readonly string[];
  readonly requiredWorkTags:readonly BackgroundWorkTag[];readonly allowOnHostileSpawn:boolean;
  /** Elsewhere degrees; empty for a def left out (it is never drawn). */
  readonly degrees:readonly TraitId[];
  readonly sexuality?:true;
}
const d=(commonality:number,degrees:readonly TraitId[],more:Partial<CoreTraitDefData>={}):CoreTraitDefData=>Object.freeze({commonality,conflicts:[],exclusionTags:[],requiredWorkTags:[],allowOnHostileSpawn:true,...more,degrees:Object.freeze([...degrees])});
export const CORE_TRAIT_DEFS:Readonly<Record<CoreTraitDefName,CoreTraitDefData>>=Object.freeze({
  SpeedOffset:d(2,['slowpoke','fast-walker','jogger']),
  DrugDesire:d(3,['chemical-fascination','chemical-interest','teetotaler']),
  NaturalMood:d(2,['sanguine','optimist','pessimist','depressive']),
  Nerves:d(2,['iron-willed','steadfast','nervous','volatile']),
  Neurotic:d(1,['neurotic','very-neurotic']),
  Industriousness:d(2,['industrious','hard-worker','lazy','slothful']),
  PsychicSensitivity:d(2,['psychically-hypersensitive','psychically-sensitive','psychically-dull','psychically-deaf']),
  ShootingAccuracy:d(2,['careful-shooter','trigger-happy'],{conflicts:['Brawler'],requiredWorkTags:['violent']}),
  Beauty:d(2,['beautiful','pretty','ugly','staggeringly-ugly']),
  Immunity:d(1,['super-immune','sickly']),
  Nudist:d(.7,['nudist']),
  Bloodlust:d(.8,['bloodlust'],{requiredWorkTags:['violent']}),
  Kind:d(2,['kind'],{conflicts:['Abrasive','Psychopath']}),
  Psychopath:d(1,['psychopath']),
  Cannibal:d(.6,['cannibal']),
  Abrasive:d(1,['abrasive'],{requiredWorkTags:['social']}),
  TooSmart:d(1,['too-smart'],{conflicts:['Nerves','SlowLearner'],requiredWorkTags:['intellectual']}),
  Brawler:d(1,['brawler'],{conflicts:['ShootingAccuracy','Wimp'],requiredWorkTags:['violent']}),
  Masochist:d(.5,['masochist'],{conflicts:['Wimp']}),
  NightOwl:d(1.3,['night-owl']),
  Greedy:d(1,['greedy'],{conflicts:['Ascetic','Jealous']}),
  Jealous:d(1,['jealous'],{conflicts:['Ascetic','Greedy']}),
  Ascetic:d(.7,['ascetic'],{conflicts:['Greedy','Jealous','Gourmand']}),
  Gay:d(.3,['gay'],{exclusionTags:['SexualOrientation'],sexuality:true}),
  Bisexual:d(.2,['bisexual'],{exclusionTags:['SexualOrientation'],sexuality:true}),
  Asexual:d(.2,['asexual'],{exclusionTags:['SexualOrientation'],sexuality:true}),
  AnnoyingVoice:d(.5,['annoying-voice']),
  CreepyBreathing:d(.5,['creepy-breathing']),
  // Schema 368: drawn only from 368 (its degree's `since`).
  Pyromaniac:d(.8,['pyromaniac']),
  Wimp:d(1,['wimp'],{conflicts:['Brawler','Masochist'],allowOnHostileSpawn:false}),
  Nimble:d(1,['nimble']),
  FastLearner:d(1,['fast-learner'],{exclusionTags:['SlowFastLearner']}),
  SlowLearner:d(1,['slow-learner'],{exclusionTags:['SlowFastLearner'],conflicts:['TooSmart']}),
  Undergrounder:d(.2,['undergrounder']),
  Transhumanist:d(.9,['body-modder'],{conflicts:['BodyPurist']}),
  BodyPurist:d(.7,['body-purist'],{conflicts:['Transhumanist']}),
  DislikesMen:d(.3,['misandrist'],{commonalityFemale:1.7}),
  DislikesWomen:d(1.7,['misogynist'],{commonalityFemale:.3}),
  GreatMemory:d(1.1,['great-memory']),
  Tough:d(1.1,['tough'],{exclusionTags:['Toughness']}),
  TorturedArtist:d(.6,['tortured-artist']),
  Gourmand:d(1,['gourmand'],{conflicts:['Ascetic']}),
  QuickSleeper:d(1,['quick-sleeper']),
});
export const CORE_TRAIT_DEF_NAMES=Object.freeze(Object.keys(CORE_TRAIT_DEFS) as CoreTraitDefName[]);
/** TraitDef.GetGenderSpecificCommonality; 'none' (sex not yet known, an
 * arrival offer) uses the mean of the two Core values. */
export function traitDefCommonality(def:CoreTraitDefName,sex:'male'|'female'|'none'):number {
  const data=CORE_TRAIT_DEFS[def];
  if(data.commonalityFemale===undefined||sex==='male')return data.commonality;
  return sex==='female'?data.commonalityFemale:(data.commonality+data.commonalityFemale)/2;
}
/** TraitDef.ConflictsWith, symmetric through both conflict lists and the exclusion tags. */
export function traitDefsConflict(a:CoreTraitDefName,b:CoreTraitDefName):boolean {
  const x=CORE_TRAIT_DEFS[a],y=CORE_TRAIT_DEFS[b];
  return x.conflicts.includes(b)||y.conflicts.includes(a)||x.exclusionTags.some(tag=>y.exclusionTags.includes(tag));
}
/** Core Pawn.CombinedDisabledWorkTags reads the traits' disabledWorkTags with
 * the backstory's: the first held trait that disables `tag`. Only Pyromaniac
 * (schema 368, Firefighting) has one, so no older save meets it. Tolerant of
 * raw save data, as some readers run during validation. */
export function traitDisablingWorkTag(pawn:{readonly traits?:readonly TraitId[]}|undefined,tag:BackgroundWorkTag):TraitId|undefined {
  if(!WORK_TAGS_DISABLED_BY_TRAITS.has(tag))return undefined;
  const traits=pawn?.traits;if(!Array.isArray(traits)||!traits.length)return undefined;
  // In the pawn's trait order (Core's order); a hot reader: the few degrees
  // with disabled work are listed once.
  for(const id of traits)if(WORK_DISABLING_TRAITS.has(id)&&TRAITS[id as TraitId].disabledWorkTags!.includes(tag))return id as TraitId;
  return undefined;
}
export const traitDegree=(pawn:TraitBearer|undefined,def:CoreTraitDefName):number|undefined=>{
  for(const id of pawn?.traits??[])if(TRAITS[id].def===def)return TRAITS[id].degree;
  return undefined;
};

function traitSum(pawn:TraitBearer|undefined,key:'workSpeed'|'moveSpeed'|'meleeHit'|'meleeDodge'|'shootingAccuracy'|'aimingDelay'|'beauty'|'psychic'|'immunity'|'restRate'):number {
  let sum=0;for(const id of pawn?.traits??[]){const v=TRAITS[id][key];if(v)sum+=v;}return sum;
}
export const globalLearningFactor=(pawn:TraitBearer):number=>1+(pawn.traits?.reduce((sum,id)=>sum+TRAITS[id].learning,0)??0);
/** Core MentalBreakThreshold: base 0.35 plus offsets, clamped to [0.01, 0.50].
 * No pre-361 trait set reaches either bound. */
export const minorBreakThreshold=(pawn:TraitBearer):number=>Math.max(1,Math.min(50,35+(pawn.traits?.reduce((sum,id)=>sum+TRAITS[id].breakOffset,0)??0)));
/** Core derives major/extreme from the modified minor threshold. Do not add the
 * trait offset separately to all three historical 35/20/5 boundaries. */
export function breakThresholds(pawn:TraitBearer):readonly [number,number,number] {
  const minor=minorBreakThreshold(pawn);return [minor,minor*4/7,minor/7];
}
/** Core WorkSpeedGlobal from traits: base 1 plus offsets (min 0.3). Exactly 1
 * without such a trait, so a multiplication by it is skipped. */
export const workSpeedGlobal361=(pawn:TraitBearer):number=>{const s=traitSum(pawn,'workSpeed');return s?Math.max(.3,1+s):1;};
/** Core MoveSpeed base 4.6 plus the SpeedOffset degree, as a factor of 4.6. */
export const moveSpeedFactor361=(pawn:TraitBearer):number=>{const s=traitSum(pawn,'moveSpeed');return s?(4.6+s)/4.6:1;};
export const meleeHitOffset361=(pawn:TraitBearer):number=>traitSum(pawn,'meleeHit');
export const meleeDodgeOffset361=(pawn:TraitBearer):number=>traitSum(pawn,'meleeDodge');
export const shootingAccuracyOffset361=(pawn:TraitBearer):number=>traitSum(pawn,'shootingAccuracy');
/** Core AimingDelayFactor: base 1 plus offsets (min 0.01). */
export const aimingDelayFactor361=(pawn:TraitBearer):number=>{const s=traitSum(pawn,'aimingDelay');return s?Math.max(.01,1+s):1;};
/** Core PawnBeauty (no other source in this game). */
export const pawnBeauty361=(pawn:TraitBearer):number=>traitSum(pawn,'beauty');
/** Core PsychicSensitivity: base 1 plus offsets (min 0). */
export const psychicSensitivity361=(pawn:TraitBearer):number=>Math.max(0,1+traitSum(pawn,'psychic'));
export const immunityGainFactor361=(pawn:TraitBearer):number=>1+traitSum(pawn,'immunity');
/** The medical context field of a Super-immune person (absent otherwise). */
export const superImmune361=(pawn:TraitBearer):{traitImmunityFactor361?:1.3}=>pawn.traits?.includes('super-immune')?{traitImmunityFactor361:1.3}:{};
/** GeneUtility.AddedAndImplantedPartsWithXenogenesCount: every installed
 * artificial part here is an AddedBodyPartBase (peg leg, wooden hand and
 * foot, prosthetic arm and leg). */
export const artificialPartCount361=(pawn:Pick<Pawn,'health'>):number=>pawn.health?.artificialParts?.length??0;
export const restRateFactor361=(pawn:TraitBearer):number=>1+traitSum(pawn,'restRate');
export function incomingDamageFactor361(pawn:TraitBearer):number {let f=1;for(const id of pawn.traits??[]){const v=TRAITS[id].incomingDamageFactor;if(v!==undefined)f*=v;}return f;}
export function hungerRateFactor361(pawn:TraitBearer):number {let f=1;for(const id of pawn.traits??[]){const v=TRAITS[id].hungerFactor;if(v!==undefined)f*=v;}return f;}
export function trapSpringFactor361(pawn:TraitBearer):number {let f=1;for(const id of pawn.traits??[]){const v=TRAITS[id].trapSpringFactor;if(v!==undefined)f*=v;}return f;}
/** Damage after armor, Core DamageWorker_AddInjury: x IncomingDamageFactor
 * for external violence. Identity for everyone without Tough. */
export const toughDamage361=(target:unknown,amount:number):number=>{
  const traits=(target as {traits?:unknown})?.traits;
  if(!Array.isArray(traits)||!traits.includes('tough'))return amount;
  return Math.round(amount*incomingDamageFactor361(target as TraitBearer)*1000)/1000;
};

export function validTraits(value:unknown,version:number):boolean {
  if(value===undefined)return true; // Neutral legacy/person with no authored traits.
  if(version<69||!Array.isArray(value)||value.length<1)return false;
  if(isTraitsSchema361(version))return validCoreTraits361(value,version);
  if(value.length>3)return false;
  const groups=new Set<string>();
  for(const id of value){if(typeof id!=='string'||!Object.hasOwn(TRAITS,id)||TRAITS[id as TraitId].since!==undefined||version<134&&(id==='kind'||id==='abrasive'||id==='bloodlust'))return false;const group=TRAITS[id as TraitId].group;if(groups.has(group))return false;groups.add(group);}
  return true;
}
/** From 361: known ids, one degree per Core def, no Core conflict, at most
 * three traits plus one sexuality (Core's count range and its separate draw). */
function validCoreTraits361(value:unknown[],version:number):boolean {
  if(value.length>4)return false;
  const defs:CoreTraitDefName[]=[];let regular=0;
  for(const id of value){
    // A degree of a later schema (362) is refused in an older save.
    if(typeof id!=='string'||!Object.hasOwn(TRAITS,id)||(TRAITS[id as TraitId].since??0)>version)return false;
    const def=TRAITS[id as TraitId].def;
    if(defs.some(o=>o===def||traitDefsConflict(o,def)))return false;
    defs.push(def);if(!CORE_TRAIT_DEFS[def].sexuality)regular++;
  }
  return regular<=3;
}
/** Authored scenario profiles, deliberately not Core's trait frequencies or
 * biographies. Each call owns a new array; no RNG, no changes to existing saves. */
export function startingTraits(index:number):TraitId[] {
  return index%3===0?['optimist','fast-learner']:index%3===1?['steadfast','slow-learner']:['pessimist','nervous'];
}
/** The provisional arrival calendar adds one social disposition without
 * consuming the simulation or arrival RNG. Existing offers keep their traits. */
export function arrivalTraits(profile:number,serial:number):TraitId[] {
  return [...startingTraits(profile),(['kind','abrasive','bloodlust'] as const)[(serial-1)%3]!];
}
/** Only new ordinary camps. The terrain/fixture factory remains neutral. */
export function initializeCampTraits(world:World):void {
  world.pawns.forEach((pawn,index)=>{if(pawn.traits===undefined)pawn.traits=startingTraits(index);});
}
