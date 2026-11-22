import type { RuleDomain } from '../rules-types.ts';
import { at, code, DAY, days, pinned, rule, sim, table } from '../rules-helpers.ts';
import { SCHEMA_VERSION } from '../../sim/types.ts';
import { researchProjects } from '../../ui/research-projects.ts';
import { RESEARCH_PREREQUISITES, RESEARCH_PARENT_LABELS } from '../../sim/research-prerequisites.ts';
import { TRADE_CATALOGUE } from '../../sim/trade-catalogue.ts';
import { TAINTED_VALUE_FACTOR_327 } from '../../sim/trade-prices.ts';
import { WORLD_FACTION_DEFINITIONS_256, initialWorldGoodwill256, type WorldFactionDef256 } from '../../sim/world-faction-catalog.ts';

import { CARAVAN_TRADER_KINDS_332, CARAVAN_STAY_MAX_CORE_332, CARAVAN_STAY_MIN_CORE_332 } from '../../sim/trader-caravans-332.ts';
import { ORBITAL_SHIP_LIMIT } from '../../sim/orbital-state.ts';
import { WORLD_ROADS } from '../../sim/world-roads.ts';
import { BIG_THREATS_328, FORCE_RAID_DAYS_328 } from '../../sim/big-threats-328.ts';
import { CASSANDRA_ACTIVE_TICKS, CASSANDRA_CYCLE_START, CASSANDRA_CYCLE_TICKS, CASSANDRA_MIN_SPACING, INTRO_RAID_TICK } from '../../sim/cassandra-raids.ts';
import { MISC_CATEGORY_CHANCE, MISC_CHECK_INTERVAL } from '../../sim/cassandra-misc.ts';
import { computeThreatPoints } from '../../sim/threat-points.ts';
import { RAID_KINDS_331 } from '../../sim/raid-factions-331.ts';
import { RAID_ARRIVAL_MODES_333 } from '../../sim/raid-arrival-333.ts';
import { RECENT_STORY_WEIGHT_FACTORS_341 } from '../../sim/recent-incidents-341.ts';
import { RAID_KIND_RESISTANCE_334 } from '../../sim/prisoner-resistance-334.ts';
import { PRISON_BREAK_BASE_MTB_DAYS } from '../../sim/prison-break-state.ts';
import { PRISON_CHAT_INTERVAL } from '../../sim/prisoner-state.ts';
import { LOCAL_BIOME_DATA_256 } from '../../sim/local-biome-data-v256.ts';
import { BIOME_DISEASE_FACTS_256 } from '../../sim/biome-disease-facts-256.ts';
import { BIOME_LABELS } from '../../sim/site.ts';
import { ITEM_DEFINITIONS } from '../../sim/items.ts';
import { GEOGRAPHIC_CREATION_SIZES_262 } from '../../sim/geographic-creation-options-262.ts';
import { DEFAULT_MAP_SIZE } from '../../sim/map-config.ts';
import { POPULATION_MULTIPLIERS } from '../../sim/world-climate-settings.ts';
import { SCENARIOS } from '../../sim/scenario-definitions.ts';
import { difficultyValues347 } from '../../sim/game-profile.ts';
import { MAX_SAVE_UTF8_BYTES } from '../../sim/save-text-limit.ts';
import { AUTOSAVE_MINUTES, DEFAULT_AUTOSAVE_MINUTES } from '../../ui/autosave.ts';
import type { World } from '../../sim/types.ts';

const CORE_HOUR = 2500;
const itemLabel = (id: string): string => (ITEM_DEFINITIONS as Readonly<Record<string, { label: string }>>)[id]?.label ?? id;
const biomeLabel = (id: string): string => (BIOME_LABELS as Readonly<Record<string, string>>)[id] ?? id;

const R = 'recherche';
export const RESEARCH_DOMAIN: RuleDomain = {
  id: R, label: 'Recherche', coverage: 'partial',
  missing: ['Niveau technologique de chaque projet', 'Effet de la température et de la propreté en détail'],
  summary: 'Projets, coûts, prérequis et vitesse de recherche.',
  rules: [
    rule(R, {
      id: 'vitesse', title: 'Vitesse de recherche',
      text: 'Un chercheur produit {perTick} point par tic du jeu de base, multiplié par sa vitesse personnelle ({base} plus {perLevel} par niveau d’Intellectuel, pondérée par la manipulation et la vue) et par celle de l’établi : {hiTech} pour un établi de haute technologie, {simple} pour un établi simple, plus {analyzer} avec un multi-analyseur relié à {analyzerRange} cases au plus. Dehors, l’établi est multiplié par {outdoor} ; hors d’un laboratoire, par {notLab}.',
      formula: 'points = {perTick} × personnel × établi',
      values: [
        pinned('perTick', 'Points par tic', 0.0825, sim('research.ts', 'researchRate'), '.0825*personal*bench*RESEARCH_SCALE'),
        pinned('base', 'Vitesse au niveau zéro', 0.08, sim('research.ts', 'researchRate'), '(.08+.115*skill.level)'),
        pinned('perLevel', 'Gain par niveau', 0.115, sim('research.ts', 'researchRate'), '(.08+.115*skill.level)'),
        pinned('hiTech', 'Établi de haute technologie', 1, sim('research.ts', 'benchSpeedFactor'), "hi-tech-research-bench'?1:.75"),
        pinned('simple', 'Établi simple', 0.75, sim('research.ts', 'benchSpeedFactor'), "hi-tech-research-bench'?1:.75"),
        pinned('analyzer', 'Bonus du multi-analyseur', 0.1, sim('research.ts', 'benchSpeedFactor'), '?.1:0'),
        pinned('analyzerRange', 'Portée du multi-analyseur', 8, sim('research-facilities.ts', 'researchFacilityLinked'), 'researchFacilityDistance(station,facility)>8'),
        pinned('outdoor', 'Facteur dehors', 0.75, sim('research.ts', 'benchSpeedFactor'), '(outdoor?.75:1)'),
        pinned('notLab', 'Facteur hors laboratoire', 0.8, sim('research.ts', 'benchSpeedFactor'), "room.role!=='laboratory'?.8:1"),
      ],
      fidelity: 'core', notes: ['docs/development/research.md', 'docs/gameplay/research-guidance-v357.md'], related: ['projets', 'competences.niveaux'],
    }),
    rule(R, {
      id: 'projets', title: 'Projets de recherche',
      text: 'Chaque projet coûte un nombre de points et n’est disponible qu’après ses prérequis.',
      tables: [table('projets', 'Projets', ['Projet', 'Coût (points)', 'Prérequis'],
        researchProjects.map(p => [p.title, p.cost, (RESEARCH_PREREQUISITES as Readonly<Record<string, { visible: readonly string[] }>>)[p.id]?.visible.map(id => (RESEARCH_PARENT_LABELS as Readonly<Record<string, string>>)[id] ?? id).join(', ') || '—']), at('src/ui/research-projects.ts', 'researchProjects'))],
      fidelity: 'core', fidelityNote: 'Trois prérequis adaptés (repas de survie, lit d’hôpital, tourelles avant le schéma 340).', notes: ['docs/gameplay/architect-research-v358.md'], related: ['vitesse'],
    }),
  ],
};

const T = 'commerce';
export const TRADE_DOMAIN: RuleDomain = {
  id: T, label: 'Commerce, factions et caravanes', coverage: 'partial',
  missing: ['Stocks de chaque marchand', 'Demandes commerciales et pourparlers en détail', 'Fourrage des caravanes'],
  summary: 'Prix, négociation, bonne volonté des factions, marchands et caravanes sur la planète.',
  rules: [
    rule(T, {
      id: 'prix', title: 'Prix d’achat et de vente',
      text: 'Le joueur achète à {buy} fois la valeur de l’objet, moins l’amélioration du négociateur ; il vend à {sell} fois la valeur multipliée par le facteur de vente de l’objet, plus l’amélioration, sans jamais dépasser le prix d’achat. L’amélioration vaut {perSocial} par niveau de Social, au plus {maxImprovement}. Un objet porté par un mort vaut {tainted} fois sa valeur.',
      formula: 'achat = valeur × {buy} × (un − amélioration) ; vente = valeur × {sell} × facteur de vente × (un + amélioration)',
      values: [
        pinned('buy', 'Facteur d’achat', 1.4, sim('trade-prices.ts', 'priceWithImprovement'), 'marketValue*1.4*(1+priceLoss)*(1-improvement)'),
        pinned('sell', 'Facteur de vente', 0.6, sim('trade-prices.ts', 'priceWithImprovement'), 'marketValue*.6*entry.sellPriceFactor'),
        pinned('perSocial', 'Amélioration par niveau', 0.015, sim('trade-negotiator.ts', 'tradeImprovement'), '.015*effectiveSkillLevel'),
        pinned('maxImprovement', 'Amélioration maximale', 0.395, sim('trade-negotiator.ts', 'tradeImprovement'), 'Math.min(.395,'),
        code('tainted', 'Facteur d’un objet de mort', TAINTED_VALUE_FACTOR_327, sim('trade-prices.ts', 'TAINTED_VALUE_FACTOR_327')),
      ],
      tables: [table('valeurs', 'Valeur de base des objets négociables', ['Objet', 'Valeur', 'Facteur de vente'],
        Object.entries(TRADE_CATALOGUE).filter(([, e]) => e.playerCanSell).map(([id, e]) => [itemLabel(id), e.baseMarketValue, e.sellPriceFactor]), sim('trade-catalogue.ts', 'TRADE_CATALOGUE'))],
      fidelity: 'core', notes: ['docs/development/trade.md', 'docs/gameplay/trade-fidelity-v327.md', 'docs/gameplay/trade-fidelity-v338.md'], related: ['factions'],
    }),
    rule(T, {
      id: 'factions', title: 'Factions et bonne volonté',
      text: 'Chaque faction a une bonne volonté envers le joueur, de moins cent à cent. Elle devient hostile à {hostile} ou moins et alliée à {ally} ou plus. Vendre à un marchand d’une faction rapporte un point de bonne volonté par tranche de {perGoodwill} d’argent.',
      values: [
        pinned('hostile', 'Seuil hostile', -10, sim('world-faction-catalog.ts', 'worldRelationKind256'), "goodwill<=-10?'hostile'"),
        pinned('ally', 'Seuil allié', 75, sim('world-faction-catalog.ts', 'worldRelationKind256'), "goodwill>=75?'ally'"),
        pinned('perGoodwill', 'Argent par point', 600, sim('trade-goodwill-338.ts', 'tradeGoodwillGain338'), 'f32(f32(sold)/600)'),
      ],
      tables: [table('factions', 'Factions', ['Faction', 'Ennemie naturelle', 'Ennemie permanente', 'Bonne volonté de départ'],
        Object.entries(WORLD_FACTION_DEFINITIONS_256).filter(([, f]) => !f.player && !f.hidden).map(([id, f]) => [id, f.naturalEnemy ? 'oui' : 'non', f.permanentEnemy ? 'oui' : 'non', initialWorldGoodwill256('PlayerColony', id as WorldFactionDef256)]), sim('world-faction-catalog.ts', 'WORLD_FACTION_DEFINITIONS_256'))],
      fidelity: 'core', notes: ['docs/gameplay/diplomatic-gifts-v450.md', 'docs/gameplay/trade-fidelity-v338.md'], related: ['prix', 'conteur.raids'],
    }),
    rule(T, {
      id: 'marchands', title: 'Marchands en visite et en orbite',
      text: 'Une caravane marchande reste entre {stayMin} et {stayMax} heures. Au plus {orbital} vaisseaux marchands peuvent être en orbite en même temps.',
      values: [
        code('stayMin', 'Séjour minimal', CARAVAN_STAY_MIN_CORE_332 / CORE_HOUR, sim('trader-caravans-332.ts', 'CARAVAN_STAY_MIN_CORE_332'), 'heures'),
        code('stayMax', 'Séjour maximal', CARAVAN_STAY_MAX_CORE_332 / CORE_HOUR, sim('trader-caravans-332.ts', 'CARAVAN_STAY_MAX_CORE_332'), 'heures'),
        code('orbital', 'Vaisseaux en orbite', ORBITAL_SHIP_LIMIT, sim('orbital-state.ts', 'ORBITAL_SHIP_LIMIT')),
      ],
      tables: [table('caravanes', 'Caravanes marchandes', ['Caravane', 'Famille'], Object.values(CARAVAN_TRADER_KINDS_332).map(k => [k.label, k.family]), sim('trader-caravans-332.ts', 'CARAVAN_TRADER_KINDS_332'))],
      fidelity: 'core', fidelityNote: 'Le marchand porte lui-même ses marchandises (adaptation).', notes: ['docs/gameplay/trader-caravans-v332.md', 'docs/gameplay/orbital-trade-v281.md'], related: ['prix'],
    }),
    rule(T, {
      id: 'caravanes', title: 'Caravanes du joueur',
      text: 'Un humain porte {human} kg ; un animal de bât {animal} kg par unité de taille. Une case de la planète prend {base} tics du jeu de base divisés par la charge (de un à deux), multipliés par la difficulté de la case et par {road} sur une route. Une caravane s’arrête la nuit.',
      values: [
        pinned('human', 'Charge d’un humain', 35, sim('group-animal-capacity-256.ts', 'caravanPawnCapacityGrams256'), 'animalCaravanCapacityGrams256(p):35000'),
        pinned('animal', 'Charge par unité de taille', 35, sim('group-animal-capacity-256.ts', 'animalCaravanCapacityGrams256'), 'animalBodySize(a)*35000'),
        pinned('base', 'Tics par case', 4420, sim('planet-navigation.ts', 'groupTicksPerMove'), '4420/(factor*(mass.ridingFactor??1))'),
        code('road', 'Facteur d’une route', WORLD_ROADS['dirt-road'].movement, sim('world-roads.ts', 'WORLD_ROADS')),
      ],
      fidelity: 'core', notes: ['docs/development/planet-group-v216.md', 'docs/gameplay/caravan-rest-v442.md', 'docs/gameplay/group-freight-v413.md'], related: ['monde.deplacement'],
    }),
  ],
};

const S = 'conteur';
const threat = (wealth: number): number => computeThreatPoints({ knownWealth: wealth, freeColonists: 3, colonistHealthSum: 3, elapsedDays: 60, adaptationDays: 30, seedBucket: 0 }).points;
export const STORYTELLER_DOMAIN: RuleDomain = {
  id: S, label: 'Conteur et incidents', coverage: 'partial',
  missing: ['Loterie des incidents divers ligne par ligne', 'Quêtes', 'Petites menaces en détail', 'Incidents de la planète'],
  summary: 'Cassandra choisit menaces et événements selon un cycle et la richesse de la colonie.',
  rules: [
    rule(S, {
      id: 'cycle', title: 'Cycle des grosses menaces',
      text: 'Le premier raid arrive vers le jour {intro}. À partir du jour {start}, Cassandra suit un cycle de {cycle} jours dont {active} jours actifs, avec au moins {spacing} jours entre deux grosses menaces. Jusqu’au jour {force}, chaque grosse menace est un raid ; ensuite elle est tirée au poids.',
      values: [
        code('intro', 'Premier raid', days(INTRO_RAID_TICK), sim('cassandra-raids.ts', 'INTRO_RAID_TICK')),
        code('start', 'Début du cycle', days(CASSANDRA_CYCLE_START), sim('cassandra-raids.ts', 'CASSANDRA_CYCLE_START')),
        code('cycle', 'Durée du cycle', days(CASSANDRA_CYCLE_TICKS), sim('cassandra-raids.ts', 'CASSANDRA_CYCLE_TICKS')),
        code('active', 'Jours actifs', days(CASSANDRA_ACTIVE_TICKS), sim('cassandra-raids.ts', 'CASSANDRA_ACTIVE_TICKS')),
        code('spacing', 'Écart minimal', days(CASSANDRA_MIN_SPACING), sim('cassandra-raids.ts', 'CASSANDRA_MIN_SPACING')),
        code('force', 'Raids imposés jusqu’au jour', FORCE_RAID_DAYS_328, sim('big-threats-328.ts', 'FORCE_RAID_DAYS_328')),
      ],
      tables: [table('grosses-menaces', 'Grosses menaces', ['Menace', 'Poids', 'Points minimaux'], BIG_THREATS_328.map(t => [t.id, t.weight, t.minPoints]), sim('big-threats-328.ts', 'BIG_THREATS_328'))],
      fidelity: 'core', fidelityNote: 'La composition des raids au-delà du jour vingt reste en partie adaptée ; le flux de tirage est privé.', notes: ['docs/gameplay/storyteller-fidelity-v328.md'], related: ['points', 'raids'],
    }),
    rule(S, {
      id: 'points', title: 'Points de menace',
      text: 'La force d’une menace dépend de la richesse, du nombre et de la santé des colons, des animaux de combat, de l’adaptation du conteur et du temps écoulé. Elle est bornée à {max} points.',
      formula: 'points = (richesse + colons × (part libre + part en bonne santé) + animaux) × adaptation × {factor} × facteur de temps',
      values: [
        pinned('factor', 'Facteur commun', 0.6, sim('threat-points.ts', 'computeThreatPoints'), '* adaptationFactor * .6 * timeFactor'),
        pinned('max', 'Plafond', 10000, sim('threat-points.ts', 'computeThreatPoints'), 'Math.min(10000, Math.max(minimum, unclampedPoints))'),
      ],
      tables: [table('points-menace', 'Points pour trois colons en bonne santé au jour soixante', ['Richesse', 'Points'],
        [0, 14000, 50000, 100000, 200000, 400000, 700000, 1000000].map(w => [w, Math.round(threat(w))]), sim('threat-points.ts', 'computeThreatPoints'))],
      fidelity: 'core', notes: ['docs/gameplay/storyteller-fidelity-v329.md'], related: ['cycle'],
    }),
    rule(S, {
      id: 'divers', title: 'Incidents divers',
      text: 'Un incident divers est tiré en moyenne tous les {mtb} jours ; la loterie choisit d’abord un groupe selon la population, puis un incident au poids. Un incident survenu récemment voit son poids réduit.',
      values: [code('mtb', 'Délai moyen', MISC_CHECK_INTERVAL / MISC_CATEGORY_CHANCE / DAY, sim('cassandra-misc.ts', 'MISC_CATEGORY_CHANCE'), 'jours')],
      tables: [table('recents', 'Facteurs des incidents récents (du plus récent au plus ancien)', ['Rang', 'Facteur'], RECENT_STORY_WEIGHT_FACTORS_341.map((f, i) => [i + 1, f]), sim('recent-incidents-341.ts', 'RECENT_STORY_WEIGHT_FACTORS_341'))],
      fidelity: 'core', notes: ['docs/gameplay/storyteller-fidelity-v341.md', 'docs/gameplay/misc-incidents-v305.md'], related: ['cycle'],
    }),
    rule(S, {
      id: 'raids', title: 'Raids',
      text: 'Un raid achète ses membres avec ses points selon le coût de chaque genre, choisit une façon d’arriver et peut se regrouper avant l’assaut.',
      tables: [
        table('genres-raid', 'Membres des raids par faction', ['Genre', 'Coût', 'Arme', 'Meneur'], Object.values(RAID_KINDS_331).map(k => [k.core, k.cost, itemLabel(k.weapon), k.leader ? 'oui' : 'non']), sim('raid-factions-331.ts', 'RAID_KINDS_331')),
        table('arrivees', 'Façons d’arriver', ['Mode'], RAID_ARRIVAL_MODES_333.map(m => [m]), sim('raid-arrival-333.ts', 'RAID_ARRIVAL_MODES_333')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/raid-factions-v331.md', 'docs/gameplay/raid-arrival-v333.md', 'docs/gameplay/raid-staging-v330.md'], related: ['points', 'prisonniers.resistance'],
    }),
  ],
};

const P = 'prisonniers';
export const PRISON_DOMAIN: RuleDomain = {
  id: P, label: 'Prisonniers et recrutement', coverage: 'partial',
  missing: ['Libération et exécution en détail', 'Nourriture et lits des prisonniers'],
  summary: 'Résistance, conversations du geôlier, recrutement et évasions.',
  rules: [
    rule(P, {
      id: 'resistance', title: 'Résistance et recrutement',
      text: 'Un prisonnier commence avec une résistance tirée selon son genre. Un geôlier lui parle au plus toutes les {interval} tics ; chaque conversation retire sa capacité de négociation ({base} plus {perSocial} par niveau de Social, au moins {min}) multipliée par l’humeur du prisonnier et son opinion du geôlier. À résistance nulle, le prisonnier est recruté.',
      values: [
        code('interval', 'Intervalle des conversations', PRISON_CHAT_INTERVAL, sim('prisoner-state.ts', 'PRISON_CHAT_INTERVAL'), 'tics'),
        pinned('base', 'Négociation de base', 0.4, sim('prisoner-state.ts', 'prisonerNegotiation'), '(.4+.075*(pawn.skills.social?.level??0))'),
        pinned('perSocial', 'Gain par niveau', 0.075, sim('prisoner-state.ts', 'prisonerNegotiation'), '(.4+.075*(pawn.skills.social?.level??0))'),
        pinned('min', 'Négociation minimale', 0.4, sim('prisoner-state.ts', 'prisonerNegotiation'), 'Math.max(.4,'),
      ],
      tables: [table('resistance', 'Résistance initiale', ['Genre', 'Minimum', 'Maximum'], Object.entries(RAID_KIND_RESISTANCE_334).map(([id, [min, max]]) => [id, min, max]), sim('prisoner-resistance-334.ts', 'RAID_KIND_RESISTANCE_334'))],
      fidelity: 'core', notes: ['docs/gameplay/prisoner-resistance-v334.md', 'docs/development/prisoners.md'], related: ['evasion', 'competences.niveaux'],
    }),
    rule(P, {
      id: 'evasion', title: 'Évasions',
      text: 'Une évasion survient en moyenne tous les {mtb} jours, divisés par la capacité de mouvement et le nombre de portes donnant dehors ; ce délai est bien plus court juste après la capture.',
      values: [code('mtb', 'Délai moyen de base', PRISON_BREAK_BASE_MTB_DAYS, sim('prison-break-state.ts', 'PRISON_BREAK_BASE_MTB_DAYS'), 'jours')],
      fidelity: 'core', fidelityNote: 'Vérifié tous les deux cent cinquante tics locaux (adaptation de la cadence).', notes: ['docs/gameplay/prison-break-v269.md'], related: ['resistance'],
    }),
    rule(P, {
      id: 'arrestation', title: 'Arrestation',
      text: 'Arrêter quelqu’un réussit avec une chance de {base} plus {perSocial} par niveau de Social, pondérée par la manipulation, entre {min} et un.',
      values: [
        pinned('base', 'Chance de base', 0.6, sim('arrest-rules.ts', 'arrestSuccessChance'), '(.6+.075*social)'),
        pinned('perSocial', 'Gain par niveau', 0.075, sim('arrest-rules.ts', 'arrestSuccessChance'), '(.6+.075*social)'),
        pinned('min', 'Chance minimale', 0.6, sim('arrest-rules.ts', 'arrestSuccessChance'), 'Math.max(.6,'),
      ],
      fidelity: 'core', notes: ['docs/gameplay/colonist-arrest-v278.md'], related: ['resistance'],
    }),
  ],
};

const M = 'monde';
export const DIFFICULTY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  colonistMoodOffset: 'Humeur des colons', playerPawnInfectionChanceFactor: 'Chance d’infection des colons', foodPoisonChanceFactor: 'Chance d’intoxication',
  enemyDeathOnDownedChanceFactor: 'Mort des ennemis à terre', researchSpeedFactor: 'Vitesse de recherche', cropYieldFactor: 'Rendement des cultures',
  mineYieldFactor: 'Rendement du minage', adaptationGrowthRateFactorOverZero: 'Adaptation du conteur', scariaRotChance: 'Pourriture des animaux à scarie',
  enemyReproductionRateFactor: 'Reproduction des ennemis',
});
const medium = difficultyValues347({ gameProfile: { difficulty: 'adventure-story' } } as unknown as World)!;
const easy = difficultyValues347({ gameProfile: { difficulty: 'community-builder' } } as unknown as World)!;
export const WORLD_DOMAIN: RuleDomain = {
  id: M, label: 'Monde, planète et voyages', coverage: 'partial',
  missing: ['Génération du relief, des rivières et des routes', 'Sites et établissements étrangers', 'Températures et pluies par biome'],
  summary: 'Biomes, taille des cartes, difficulté, scénarios et déplacements sur la planète.',
  rules: [
    rule(M, {
      id: 'biomes', title: 'Biomes',
      text: 'Chaque biome fixe la densité des animaux et des plantes, la difficulté de déplacement sur la planète et la fréquence des maladies.',
      tables: [
        table('biomes', 'Biomes', ['Biome', 'Animaux', 'Plantes', 'Difficulté de déplacement', 'Fourrage'],
          Object.entries(LOCAL_BIOME_DATA_256).map(([id, b]) => [biomeLabel(id), b.scalars.animalDensity, b.scalars.plantDensity, b.scalars.movementDifficulty, b.scalars.forageability]), sim('local-biome-data-v256.ts', 'LOCAL_BIOME_DATA_256')),
        table('maladies-biome', 'Maladies par biome', ['Biome', 'Délai moyen (jours)'], Object.entries(BIOME_DISEASE_FACTS_256).map(([id, d]) => [biomeLabel(id), d.mtbDays]), sim('biome-disease-facts-256.ts', 'BIOME_DISEASE_FACTS_256')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/world-generation-v408.md', 'docs/gameplay/biome-readiness-v375.md', 'docs/gameplay/malaria-geography-v454.md'], related: ['plantes.flore', 'sante.maladies'],
    }),
    rule(M, {
      id: 'deplacement', title: 'Déplacement sur la planète',
      text: 'La difficulté d’une case vaut celle de son biome plus le relief ({small} pour des collines, {large} pour de grandes collines, {mountain} pour des montagnes) plus l’hiver.',
      values: [
        pinned('small', 'Collines', 0.5, sim('world-core-movement.ts', 'coreMovementDifficulty'), "'small-hills':.5"),
        pinned('large', 'Grandes collines', 1.5, sim('world-core-movement.ts', 'coreMovementDifficulty'), "'large-hills':1.5"),
        pinned('mountain', 'Montagnes', 3, sim('world-core-movement.ts', 'coreMovementDifficulty'), 'mountainous:3'),
      ],
      fidelity: 'core', notes: ['docs/gameplay/world-maps-v407.md', 'docs/development/world-foundations.md'], related: ['commerce.caravanes'],
    }),
    rule(M, {
      id: 'partie', title: 'Nouvelle partie',
      text: 'Une carte mesure {size} cases de côté par défaut. Les tailles proposées et les scénarios sont listés ci-dessous.',
      values: [code('size', 'Taille par défaut', DEFAULT_MAP_SIZE, sim('map-config.ts', 'DEFAULT_MAP_SIZE'))],
      tables: [
        table('tailles', 'Tailles de carte', ['Côté (cases)'], GEOGRAPHIC_CREATION_SIZES_262.map(s => [s]), sim('geographic-creation-options-262.ts', 'GEOGRAPHIC_CREATION_SIZES_262')),
        table('scenarios', 'Scénarios', ['Scénario', 'Description'], Object.values(SCENARIOS).map(s => [s.label, s.description]), sim('scenario-definitions.ts', 'SCENARIOS')),
        table('population', 'Population de la planète', ['Réglage', 'Multiplicateur'], POPULATION_MULTIPLIERS.map((m, i) => [i, m]), sim('world-climate-settings.ts', 'POPULATION_MULTIPLIERS')),
      ],
      fidelity: 'adaptation', fidelityNote: 'Les scénarios reprennent en partie ceux du jeu de base.', notes: ['docs/gameplay/new-game-preparation-v333.md', 'docs/gameplay/geographic-continuation-v417.md'], related: ['difficulte'],
    }),
    rule(M, {
      id: 'difficulte', title: 'Difficulté',
      text: 'Le niveau de difficulté règle plusieurs facteurs du jeu.',
      tables: [table('difficulte', 'Facteurs de difficulté', ['Facteur', 'Aventure', 'Bâtisseur'],
        (Object.keys(medium) as (keyof typeof medium)[]).map(key => [DIFFICULTY_LABELS[key] ?? key, medium[key] as number, easy[key] as number]), sim('game-profile.ts', 'difficultyValues347'))],
      fidelity: 'core', notes: ['docs/gameplay/tutorial-profile-v347.md'], related: ['partie'],
    }),
  ],
};

const V = 'sauvegardes';
export const SAVES_DOMAIN: RuleDomain = {
  id: V, label: 'Sauvegardes et schémas', coverage: 'complete', missing: [],
  summary: 'Le format des sauvegardes porte un numéro de schéma ; chaque ancienne sauvegarde est validée puis migrée pas à pas.',
  rules: [
    rule(V, {
      id: 'schema', title: 'Numéro de schéma et migrations',
      text: 'Le schéma actuel est le {schema}. Une sauvegarde plus ancienne est validée selon les règles de son propre schéma, puis migrée d’un numéro à la fois jusqu’au schéma actuel ; aucune ressource ni progression n’est offerte au passage. Une sauvegarde invalide ne remplace jamais la partie en cours.',
      values: [code('schema', 'Schéma actuel', SCHEMA_VERSION, sim('types.ts', 'SCHEMA_VERSION'))],
      sources: [sim('serialization.ts', 'deserializeCampaign'), sim('serialization.ts', 'validateWorld')],
      fidelity: 'elsewhere', notes: ['docs/development/save-storage.md'], related: ['taille'],
    }),
    rule(V, {
      id: 'taille', title: 'Taille et sauvegarde automatique',
      text: 'Une sauvegarde ne dépasse pas {max} Mo. La sauvegarde automatique a lieu toutes les {auto} minutes de jeu actif par défaut, réglable dans les Options.',
      values: [
        code('max', 'Taille maximale', MAX_SAVE_UTF8_BYTES / 1024 / 1024, sim('save-text-limit.ts', 'MAX_SAVE_UTF8_BYTES')),
        code('auto', 'Intervalle par défaut', DEFAULT_AUTOSAVE_MINUTES, at('src/ui/autosave.ts', 'DEFAULT_AUTOSAVE_MINUTES')),
      ],
      tables: [table('autosave', 'Intervalles proposés', ['Minutes (zéro : désactivée)'], AUTOSAVE_MINUTES.map(m => [m]), at('src/ui/autosave.ts', 'AUTOSAVE_MINUTES'))],
      fidelity: 'elsewhere', notes: ['docs/development/save-off-thread-20261111.md', 'docs/gameplay/save-library-v332.md'], related: ['schema'],
    }),
  ],
};
