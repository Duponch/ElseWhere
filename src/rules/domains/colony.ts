import type { RuleDomain } from '../rules-types.ts';
import { code, pinned, rule, sim, sorted, table } from '../rules-helpers.ts';
import { TICKS_PER_SECOND } from '../../sim/types.ts';
import type { Pawn } from '../../sim/types.ts';
import { CORE_MOVE_DIAGONAL297, HUMAN_MOVE_SPEED297, coreMoveDuration297 } from '../../sim/human-move-core-297.ts';
import { DOOR_CLOSE_DELAY, FENCE_GATE_OPEN_SPEED_303, manualDoorOpenTicks } from '../../sim/door-rules.ts';
import { DOOR_TO_DOOR_CORE303 } from '../../sim/door-to-door-303.ts';
import { ALLOWED_AREA_LIMIT, OUTSIDE_ALLOWED_AREA_SEARCH_COST } from '../../sim/allowed-area-state.ts';
import { NATURAL_TERRAIN_DEFINITIONS_256 } from '../../sim/local-terrain-definitions-256.ts';
import { snowCorePathCost } from '../../sim/snow-rules.ts';
import { BUILDING_MATERIALS } from '../../sim/building-materials.ts';
import { constructionMaterials, constructionRecipe } from '../../sim/construction-materials.ts';
import { constructionSpeed } from '../../sim/skills.ts';
import { CHUNK_CHANCE, PICK_DAMAGE, ROCK_HP } from '../../sim/mining-rules.ts';
import { miningYield } from '../../sim/mining-skills.ts';
import { ORE_DEFINITIONS } from '../../sim/ore.ts';
import { SMOOTH_FLOOR_CORE_WORK_281 } from '../../sim/smooth-floor-281.ts';
import { SMOOTH_WALL_CORE_WORK_367, SMOOTHED_WALL_BEAUTY_367 } from '../../sim/smooth-wall-367.ts';
import { FLOOR_BEAUTY, FILTH_BEAUTY } from '../../sim/room-beauty.ts';
import { FLOOR_DEFINITIONS } from '../../sim/flooring.ts';
import { ROUGH_ROCK_BEAUTY_373 } from '../../sim/rock-beauty-373.ts';
import { HARVEST_MIN_GROWTH, PLANT_DEFINITIONS, plantTemperatureFactor } from '../../sim/plants.ts';
import { BIOME_FLORA, FLORA_DEFINITIONS } from '../../sim/biome-flora.ts';
import { HYDROPONIC_FERTILITY } from '../../sim/hydroponics.ts';
import { BIOME_LABELS } from '../../sim/site.ts';
import { CROP_BLIGHT_RADIUS } from '../../sim/plant-blight.ts';
import { ANIMAL_SPECIES } from '../../sim/animal-species.ts';
import { animalWildness315 } from '../../sim/animal-domestic-v256.ts';
import { animalRevengeChances348 } from '../../sim/animal-manhunter-revenge-348.ts';
import { ANIMAL_TRAINING_INTERVAL_CORE_282, ANIMAL_TRAINING_MIN_BODY_SIZE_282, ANIMAL_TRAINING_STEPS_282 } from '../../sim/animal-training-state-282.ts';
import { ANIMAL_PRODUCTS_256 } from '../../sim/animal-products-v256.ts';
import { ANIMAL_EGG_CONTENT_256 } from '../../sim/animal-egg-content-v256.ts';
import { SLAUGHTER_WORK_TICKS } from '../../sim/animal-slaughter.ts';
import { ANIMAL_FEED_HUNGER } from '../../sim/animal-feeding-rules.ts';
import { ITEM_DEFINITIONS } from '../../sim/items.ts';
import { PRODUCTION_RECIPES } from '../../sim/production-recipes.ts';
import { ROT_DAYS } from '../../sim/food-preservation.ts';
import { cookFoodPoisonChance, rawFoodPoisonChance, roomFoodPoisonChance } from '../../sim/food-poisoning.ts';
import { INGEST_TICKS } from '../../sim/eating.ts';
import type { AnimalSpeciesId } from '../../sim/animal-species.ts';
import type { ItemId } from '../../sim/items.ts';

const itemLabel = (id: string): string => (ITEM_DEFINITIONS as Readonly<Record<string, { label: string }>>)[id]?.label ?? id;
const skilled = (skill: string, level: number): Pawn => ({ skills: { [skill]: { level, xp: 0, dailyXp: 0, passion: 0 } } }) as unknown as Pawn;

const D = 'deplacement';
export const MOVEMENT_DOMAIN: RuleDomain = {
  id: D, label: 'Déplacements et chemins', coverage: 'partial',
  missing: ['Coût de chaque meuble traversé', 'Algorithme de recherche de chemin en détail', 'Vitesse des animaux espèce par espèce (voir Animaux)'],
  summary: 'Vitesse de marche, coût des cases, portes et zones autorisées.',
  rules: [
    rule(D, {
      id: 'marche', title: 'Vitesse de marche',
      text: 'Un humain avance de {speed} cases par seconde à vitesse normale, multipliée par la lumière, la capacité de mouvement, les vêtements, la météo et les traits. Un pas en diagonale coûte {diagonal} fois plus. Le coût d’une case s’ajoute au pas ; un pas ne dépasse jamais {cap} tics du jeu de base. Un colon entravé va à {restrained} de sa vitesse, un colon qui porte quelqu’un à {carry}.',
      formula: 'durée d’un pas (tics du jeu de base) = soixante ÷ (vitesse × facteurs) × diagonale + coût de la case',
      values: [
        code('speed', 'Vitesse humaine', HUMAN_MOVE_SPEED297, sim('human-move-core-297.ts', 'HUMAN_MOVE_SPEED297'), 'cases par seconde'),
        code('diagonal', 'Facteur diagonal', CORE_MOVE_DIAGONAL297, sim('human-move-core-297.ts', 'CORE_MOVE_DIAGONAL297')),
        pinned('cap', 'Pas le plus long', 450, sim('human-move-core-297.ts', 'coreMoveDuration297'), 'Math.min(450,base+terrainDelay*10)'),
        pinned('restrained', 'Facteur entravé', 0.35, sim('human-move-speed-297.ts', 'humanMoveSpeedFactor297'), 'factor*=.35'),
        pinned('carry', 'Facteur en portant', 0.6, sim('human-move-speed-297.ts', 'humanMoveSpeedFactor297'), 'factor*=.6'),
      ],
      tables: [table('pas', 'Durée d’un pas d’humain sain (tics locaux)', ['Case', 'Droit', 'Diagonale'],
        [['Sol libre', coreMoveDuration297({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, 0, false), coreMoveDuration297({ x: 0, z: 0 }, { x: 1, z: 1 }, 1, 0, false)],
          ['Sol naturel (coût deux)', coreMoveDuration297({ x: 0, z: 0 }, { x: 1, z: 0 }, 1, .2, false), coreMoveDuration297({ x: 0, z: 0 }, { x: 1, z: 1 }, 1, .2, false)]],
        sim('human-move-core-297.ts', 'coreMoveDuration297'))],
      fidelity: 'core', notes: ['docs/gameplay/deplacement-et-redirection-20261027.md', 'docs/development/animal-movement297.md'], related: ['terrains', 'portes', 'animaux.especes'],
    }),
    rule(D, {
      id: 'terrains', title: 'Coût des terrains et de la neige',
      text: 'Chaque terrain naturel a un coût de passage en tics du jeu de base. La neige ajoute un coût selon son épaisseur ; l’eau profonde ne se traverse pas.',
      tables: [
        table('terrains', 'Terrains naturels', ['Terrain', 'Coût de passage', 'Fertilité', 'Marchable'],
          Object.entries(NATURAL_TERRAIN_DEFINITIONS_256).map(([id, t]) => [id, t.pathCostCore, t.fertility, t.affordances.includes('Walkable') ? 'oui' : 'non']), sim('local-terrain-definitions-256.ts', 'NATURAL_TERRAIN_DEFINITIONS_256')),
        table('neige', 'Coût de la neige', ['Épaisseur', 'Coût ajouté'], [0.1, 0.3, 0.6, 0.9].map(depth => [depth, snowCorePathCost(depth)]), sim('snow-rules.ts', 'snowCorePathCost')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/natural-travel-save-v411.md', 'docs/gameplay/tundra-snow-v376.md'], related: ['marche'],
    }),
    rule(D, {
      id: 'portes', title: 'Portes',
      text: 'Ouvrir une porte prend quarante-cinq tics du jeu de base divisés par la vitesse du matériau (bois plus rapide, blocs de pierre plus lents) ; une porte automatique alimentée s’ouvre quatre fois plus vite et un portail de clôture {gate} fois plus vite. Une porte reste ouverte {close} tics locaux après le passage. Passer d’une porte fermée directement à une autre ajoute {doorToDoor} tics du jeu de base.',
      values: [
        code('gate', 'Facteur du portail', FENCE_GATE_OPEN_SPEED_303, sim('door-rules.ts', 'FENCE_GATE_OPEN_SPEED_303')),
        code('close', 'Délai de fermeture', DOOR_CLOSE_DELAY, sim('door-rules.ts', 'DOOR_CLOSE_DELAY'), 'tics'),
        code('doorToDoor', 'Surcoût porte à porte', DOOR_TO_DOOR_CORE303, sim('door-to-door-303.ts', 'DOOR_TO_DOOR_CORE303'), 'tics'),
      ],
      tables: [table('ouverture-portes', 'Ouverture d’une porte manuelle (tics locaux)', ['Matériau', 'Durée'],
        (['wood', 'steel', 'granite-blocks'] as const).map(material => [itemLabel(material), manualDoorOpenTicks({ material })]), sim('door-rules.ts', 'manualDoorOpenTicks'))],
      fidelity: 'core', notes: ['docs/development/doors.md', 'docs/development/bilan-nuit-20261111.md'], related: ['marche'],
    }),
    rule(D, {
      id: 'zones', title: 'Zones autorisées',
      text: 'Le joueur peut définir jusqu’à {limit} zones autorisées par carte. Un colon limité à une zone n’en sort pas : la recherche de chemin pénalise de {cost} chaque case extérieure.',
      values: [
        code('limit', 'Zones par carte', ALLOWED_AREA_LIMIT, sim('allowed-area-state.ts', 'ALLOWED_AREA_LIMIT')),
        code('cost', 'Pénalité d’une case hors zone', OUTSIDE_ALLOWED_AREA_SEARCH_COST, sim('allowed-area-state.ts', 'OUTSIDE_ALLOWED_AREA_SEARCH_COST')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/allowed-areas-v312.md'], related: ['marche', 'animaux.aires'],
    }),
  ],
};

const C = 'construction';
const BUILD_KINDS = ['wall', 'door', 'table', 'bed'] as const;
export const CONSTRUCTION_DOMAIN: RuleDomain = {
  id: C, label: 'Construction, minage et démolition', coverage: 'partial',
  missing: ['Coût de chaque bâtiment (le tableau ne montre que des exemples)', 'Réparation', 'Toits en détail (effondrement)'],
  summary: 'Construire coûte du travail et des matériaux ; miner, lisser et démolir suivent les règles du jeu de base.',
  rules: [
    rule(C, {
      id: 'travail', title: 'Travail de construction',
      text: 'Le travail d’un ouvrage est celui de la définition multiplié par le facteur du matériau, plus son décalage. La vitesse de construction vaut {base} plus {perLevel} par niveau de Construction, multipliée par les capacités et la lumière.',
      formula: 'vitesse = {base} + {perLevel} × niveau',
      values: [
        pinned('base', 'Vitesse au niveau zéro', constructionSpeed({ skills: { construction: { level: 0 } } } as unknown as Pawn), sim('skills.ts', 'constructionSpeed'), '(3000+875*'),
        pinned('perLevel', 'Gain par niveau', 0.0875, sim('skills.ts', 'constructionSpeed'), '(3000+875*'),
      ],
      tables: [
        table('materiaux', 'Matériaux de construction', ['Matériau', 'Facteur de travail', 'Décalage de travail'],
          Object.entries(BUILDING_MATERIALS).map(([id, m]) => [itemLabel(id), m.workFactor, m.workOffset]), sim('building-materials.ts', 'BUILDING_MATERIALS')),
        table('ouvrages', 'Exemples d’ouvrages', ['Ouvrage', 'Matériau', 'Matériaux requis', 'Travail (tics du jeu de base)'],
          BUILD_KINDS.flatMap(kind => constructionMaterials(kind).slice(0, 3).map(material => {
            const recipe = constructionRecipe({ kind, material });
            return [kind, itemLabel(material), recipe.ingredients.map(i => `${i.quantity} ${itemLabel(i.item)}`).join(', '), recipe.coreWork];
          })), sim('construction-materials.ts', 'constructionRecipe')),
      ],
      fidelity: 'core', notes: ['docs/development/construction.md', 'docs/development/construction-materials.md'], related: ['echec', 'travail.types'],
    }),
    rule(C, {
      id: 'echec', title: 'Échec de construction',
      text: 'Le cadre d’un mur en bois construit par un colon peut échouer selon sa compétence de Construction ; il rend alors environ la moitié des matériaux.',
      sources: [sim('construction-success-301.ts', 'constructionSuccessChance301'), sim('wall-frame-failure-301.ts', 'failWoodWallFrame301')],
      fidelity: 'adaptation', fidelityNote: 'Depuis le schéma 301, seulement pour le mur en bois ; les autres ouvrages ne peuvent pas encore échouer.',
      notes: ['docs/development/construction-finish301.md'], related: ['travail'],
    }),
    rule(C, {
      id: 'minage', title: 'Minage',
      text: 'Chaque coup de pioche inflige {damage} points à la roche. La roche naturelle laisse un fragment {chunk} fois sur un ; un gisement rend sa quantité multipliée par le rendement de minage du mineur, au plus {maxYield}.',
      values: [
        code('damage', 'Dégâts par coup', PICK_DAMAGE, sim('mining-rules.ts', 'PICK_DAMAGE')),
        code('chunk', 'Chance de fragment', CHUNK_CHANCE, sim('mining-rules.ts', 'CHUNK_CHANCE')),
        pinned('maxYield', 'Rendement maximal', 1.25, sim('mining-skills.ts', 'miningYield'), 'Math.min(1.25,'),
      ],
      tables: [
        table('roches', 'Roches', ['Roche', 'Points de vie'], Object.entries(ROCK_HP).map(([id, hp]) => [id, hp]), sim('mining-rules.ts', 'ROCK_HP')),
        table('gisements', 'Gisements', ['Gisement', 'Points de vie', 'Quantité', 'Objet'], Object.values(ORE_DEFINITIONS).map(o => [o.label, o.hp, o.yield, itemLabel(o.item)]), sim('ore.ts', 'ORE_DEFINITIONS')),
        table('rendement-minage', 'Rendement de minage (colon sain)', ['Niveau de Minage', 'Rendement'], [0, 4, 8, 12, 16, 20].map(level => [level, miningYield(skilled('mining', level))]), sim('mining-skills.ts', 'miningYield')),
      ],
      fidelity: 'core', notes: ['docs/development/mining.md', 'docs/development/mining-skills-v204.md'], related: ['travail'],
    }),
    rule(C, {
      id: 'demolition', title: 'Démolition',
      text: 'Démolir rend la moitié (arrondie en dessous) de chaque matériau, plus une unité une fois sur deux si la moitié n’est pas entière. Une colonne électrique et une torche ne rendent rien.',
      values: [],
      sources: [sim('deconstruction.ts', 'finishDeconstruction'), sim('deconstruction-rules.ts', 'deconstructionDuration')],
      fidelity: 'core', notes: ['docs/development/deconstruction.md'], related: ['travail'],
    }),
    rule(C, {
      id: 'lissage', title: 'Lisser les sols et les murs',
      text: 'Lisser un sol rocheux demande {floor} tics de travail du jeu de base, un mur {wall}. Un mur lissé gagne en beauté selon sa roche.',
      values: [
        code('floor', 'Travail pour un sol', SMOOTH_FLOOR_CORE_WORK_281, sim('smooth-floor-281.ts', 'SMOOTH_FLOOR_CORE_WORK_281')),
        code('wall', 'Travail pour un mur', SMOOTH_WALL_CORE_WORK_367, sim('smooth-wall-367.ts', 'SMOOTH_WALL_CORE_WORK_367')),
      ],
      tables: [table('murs-lisses', 'Beauté des murs', ['Roche', 'Brut', 'Lissé'],
        Object.entries(SMOOTHED_WALL_BEAUTY_367).map(([stone, beauty]) => [stone, ROUGH_ROCK_BEAUTY_373[stone as keyof typeof ROUGH_ROCK_BEAUTY_373], beauty]), sim('smooth-wall-367.ts', 'SMOOTHED_WALL_BEAUTY_367'))],
      fidelity: 'core', notes: ['docs/gameplay/smooth-floors-v458.md', 'docs/gameplay/smooth-walls-v367.md', 'docs/gameplay/rock-beauty-v373.md'], related: ['beaute'],
    }),
    rule(C, {
      id: 'beaute', title: 'Beauté des sols et des saletés',
      text: 'La beauté perçue d’une pièce additionne celle des sols, des meubles et des saletés. Le tableau donne les sols et saletés les plus marquants.',
      tables: [
        table('beaute-sols', 'Sols', ['Sol', 'Beauté'], Object.entries(FLOOR_BEAUTY).filter(([, b]) => b !== 0).map(([id, b]) => [(FLOOR_DEFINITIONS as Readonly<Record<string, { label: string }>>)[id]?.label ?? id, b]), sim('room-beauty.ts', 'FLOOR_BEAUTY')),
        table('beaute-salete', 'Saletés', ['Saleté', 'Beauté'], Object.entries(FILTH_BEAUTY).map(([id, b]) => [id, b]), sim('room-beauty.ts', 'FILTH_BEAUTY')),
      ],
      fidelity: 'core', notes: ['docs/development/room-quality.md'], related: ['besoins.beaute', 'lissage'],
    }),
  ],
};

const P = 'plantes';
export const PLANTS_DOMAIN: RuleDomain = {
  id: P, label: 'Plantes, cultures et flore sauvage', coverage: 'partial',
  missing: ['Rendement de récolte par niveau', 'Repousse sauvage en détail', 'Gel et arbres sans feuilles'],
  summary: 'Croissance selon la lumière, la température et la fertilité ; récoltes, maladie des cultures et flore sauvage.',
  rules: [
    rule(P, {
      id: 'croissance', title: 'Croissance',
      text: 'Une plante pousse de jour, proportionnellement à la lumière, à la température et à la fertilité du sol pondérée par sa sensibilité. La température donne un facteur nul sous zéro, qui monte jusqu’à un à {warm} °C, reste plein jusqu’à {hot} °C puis retombe à zéro à {max} °C. On ne sème qu’entre zéro et {max} °C. Une récolte est possible dès {harvest} de croissance.',
      formula: 'gain par tic = lumière × facteur de température × (un − sensibilité + fertilité × sensibilité) ÷ (jours de croissance × tics par jour)',
      values: [
        pinned('warm', 'Pleine croissance dès', 6, sim('plants.ts', 'plantTemperatureFactor'), 'temperature < 6 ? clamp(temperature / 6)'),
        pinned('hot', 'Pleine croissance jusqu’à', 42, sim('plants.ts', 'plantTemperatureFactor'), 'temperature > 42 ?'),
        pinned('max', 'Température maximale', 58, sim('plants.ts', 'plantTemperatureFactor'), 'clamp((58 - temperature) / 16)'),
        code('harvest', 'Croissance minimale de récolte', `${HARVEST_MIN_GROWTH * 100} %`, sim('plants.ts', 'HARVEST_MIN_GROWTH')),
      ],
      tables: [
        table('cultures', 'Cultures', ['Culture', 'Jours de croissance', 'Fertilité minimale', 'Sensibilité', 'Rendement'],
          Object.values(PLANT_DEFINITIONS).map(p => [p.label, p.growDays, p.minFertility, p.sensitivity, p.yield]), sim('plants.ts', 'PLANT_DEFINITIONS')),
        table('facteur-temperature', 'Facteur de température', ['Température (°C)', 'Facteur'], [-5, 0, 3, 6, 25, 42, 50, 58].map(t => [t, plantTemperatureFactor(t)]), sim('plants.ts', 'plantTemperatureFactor')),
      ],
      fidelity: 'core', notes: ['docs/development/farming.md', 'docs/development/plant-temperature.md'], related: ['flore', 'climat.temperature-exterieure'],
    }),
    rule(P, {
      id: 'hydroponie', title: 'Bacs hydroponiques',
      text: 'Un bac hydroponique a une fertilité de {fertility} et n’accepte que certaines cultures.',
      values: [code('fertility', 'Fertilité', HYDROPONIC_FERTILITY, sim('hydroponics.ts', 'HYDROPONIC_FERTILITY'))],
      fidelity: 'core', notes: ['docs/gameplay/hydroponics-v268.md'], related: ['croissance', 'energie.consommation'],
    }),
    rule(P, {
      id: 'brulure', title: 'Fléau des cultures',
      text: 'Une culture atteinte se propage dans un rayon de {radius} cases une fois sa gravité à {threshold}. Le délai moyen de propagation passe alors de {mtbStart} heures à {mtbEnd} heures à gravité pleine.',
      values: [
        code('radius', 'Rayon', CROP_BLIGHT_RADIUS, sim('plant-blight.ts', 'CROP_BLIGHT_RADIUS'), 'cases'),
        pinned('threshold', 'Gravité de propagation', 0.28, sim('plant-blight.ts', 'advanceCropBlight'), 'state.severity<.28'),
        pinned('mtbStart', 'Délai moyen au début', 16.8, sim('plant-blight.ts', 'advanceCropBlight'), 'mtbHours=16.8+(2.1-16.8)'),
        pinned('mtbEnd', 'Délai moyen à la fin', 2.1, sim('plant-blight.ts', 'advanceCropBlight'), 'mtbHours=16.8+(2.1-16.8)'),
      ],
      fidelity: 'core', notes: ['docs/gameplay/crop-blight-v270.md'], related: ['croissance', 'conteur.divers'],
    }),
    rule(P, {
      id: 'flore', title: 'Flore sauvage',
      text: 'Chaque biome a une densité de plantes et repousse vers son nombre initial en un nombre de jours donné. Chaque espèce y a un poids.',
      tables: [
        table('flore', 'Plantes sauvages', ['Plante', 'Jours de croissance', 'Fertilité minimale', 'Rendement', 'Produit'],
          Object.values(FLORA_DEFINITIONS).map(f => [f.label, f.growDays, f.minFertility, f.yield, f.product ? itemLabel(f.product) : '—']), sim('biome-flora.ts', 'FLORA_DEFINITIONS')),
        table('biomes-flore', 'Flore par biome', ['Biome', 'Densité', 'Repousse (jours)'],
          Object.entries(BIOME_FLORA).map(([id, b]) => [(BIOME_LABELS as Readonly<Record<string, string>>)[id] ?? id, b.plantDensity, b.regrowDays]), sim('biome-flora.ts', 'BIOME_FLORA')),
      ],
      fidelity: 'core', notes: ['docs/development/biomes-flora.md', 'docs/gameplay/forestry-v471.md'], related: ['croissance', 'monde.biomes'],
    }),
  ],
};

const A = 'animaux';
const species = sorted(Object.values(ANIMAL_SPECIES), s => s.label);
export const ANIMALS_DOMAIN: RuleDomain = {
  id: A, label: 'Animaux', coverage: 'partial',
  missing: ['Reproduction et gestation par espèce', 'Prédation et chasse sauvage', 'Enclos et menage des animaux'],
  summary: 'Espèces, apprivoisement, dressage, produits, abattage et animaux enragés.',
  rules: [
    rule(A, {
      id: 'especes', title: 'Espèces',
      text: 'Chaque espèce a une taille, une faim quotidienne, une vitesse et un caractère sauvage qui rend l’apprivoisement plus difficile.',
      tables: [table('especes', 'Espèces animales', ['Espèce', 'Taille', 'Nourriture par jour', 'Vitesse (cases/s)', 'Sauvagerie', 'Rage si apprivoisement raté'],
        species.map(s => [s.label, s.bodySize, s.foodPerDay, TICKS_PER_SECOND / s.moveTicks, animalWildness315(s.id as AnimalSpeciesId), animalRevengeChances348(s.id as AnimalSpeciesId).onTameFail]), sim('animal-species.ts', 'ANIMAL_SPECIES'))],
      fidelity: 'core', notes: ['docs/development/fauna-diversity.md', 'docs/gameplay/work-animal-fidelity-v315.md'], related: ['apprivoisement', 'deplacement.marche'],
    }),
    rule(A, {
      id: 'apprivoisement', title: 'Apprivoisement et dressage',
      text: 'La chance d’apprivoiser vaut celle du dresseur multipliée par un facteur de sauvagerie (deux fois un moins la sauvagerie). Un dressage compte des étapes : apprivoisement {tameness}, obéissance {obedience}, transport {haul}, une tentative au plus tous les {interval} tics du jeu de base. Le transport exige une taille d’au moins {haulSize}. Un échec d’apprivoisement peut rendre l’animal enragé (colonne du tableau des espèces).',
      values: [
        code('tameness', 'Étapes d’apprivoisement', ANIMAL_TRAINING_STEPS_282.tameness, sim('animal-training-state-282.ts', 'ANIMAL_TRAINING_STEPS_282')),
        code('obedience', 'Étapes d’obéissance', ANIMAL_TRAINING_STEPS_282.obedience, sim('animal-training-state-282.ts', 'ANIMAL_TRAINING_STEPS_282')),
        code('haul', 'Étapes de transport', ANIMAL_TRAINING_STEPS_282.haul, sim('animal-training-state-282.ts', 'ANIMAL_TRAINING_STEPS_282')),
        code('interval', 'Intervalle entre tentatives', ANIMAL_TRAINING_INTERVAL_CORE_282, sim('animal-training-state-282.ts', 'ANIMAL_TRAINING_INTERVAL_CORE_282')),
        code('haulSize', 'Taille minimale pour le transport', ANIMAL_TRAINING_MIN_BODY_SIZE_282.haul, sim('animal-training-state-282.ts', 'ANIMAL_TRAINING_MIN_BODY_SIZE_282')),
      ],
      sources: [sim('animal-handling.ts', 'tameChance'), sim('animal-domestic-v256.ts', 'tameWildnessFactor315')],
      fidelity: 'core', notes: ['docs/gameplay/animal-hauling-v459.md', 'docs/gameplay/manhunter-v348.md'], related: ['especes'],
    }),
    rule(A, {
      id: 'produits', title: 'Lait, laine et autres produits',
      text: 'Un animal producteur se remplit pendant un nombre de jours fixe ; un colon le trait ou le tond alors pour une quantité qui dépend de sa compétence Animaux.',
      tables: [
        table('produits', 'Produits animaux', ['Espèce', 'Geste', 'Produit', 'Quantité', 'Tous les (jours)'],
          Object.entries(ANIMAL_PRODUCTS_256).map(([id, p]) => [ANIMAL_SPECIES[id as AnimalSpeciesId]?.label ?? id, p.kind === 'shear' ? 'tonte' : 'traite', itemLabel(p.item), p.quantity, p.days]), sim('animal-products-v256.ts', 'ANIMAL_PRODUCTS_256')),
        table('oeufs', 'Pontes', ['Espèce', 'Tous les (jours)', 'Éclosion (jours)'],
          Object.entries(ANIMAL_EGG_CONTENT_256).map(([id, e]) => [ANIMAL_SPECIES[id as AnimalSpeciesId]?.label ?? id, e.intervalDays, e.hatchDays]), sim('animal-egg-content-v256.ts', 'ANIMAL_EGG_CONTENT_256')),
      ],
      fidelity: 'core', notes: ['docs/development/animal-products.md', 'docs/gameplay/egg-box-v374.md'], related: ['especes'],
    }),
    rule(A, {
      id: 'soins', title: 'Nourrir et abattre',
      text: 'Un animal domestique sans accès à la nourriture est nourri par un colon quand sa jauge passe sous {hunger} de son maximum. L’abattage prend {slaughter} tics locaux.',
      values: [
        code('hunger', 'Seuil de nourrissage', ANIMAL_FEED_HUNGER, sim('animal-feeding-rules.ts', 'ANIMAL_FEED_HUNGER')),
        code('slaughter', 'Durée de l’abattage', SLAUGHTER_WORK_TICKS, sim('animal-slaughter.ts', 'SLAUGHTER_WORK_TICKS'), 'tics'),
      ],
      fidelity: 'adaptation', fidelityNote: 'Abattage en dix-huit tics locaux pour les cent quatre-vingts du jeu de base.',
      notes: ['docs/gameplay/animal-feeding-v279.md', 'docs/gameplay/slaughter-v309.md', 'docs/gameplay/auto-slaughter-v318.md'], related: ['especes'],
    }),
    rule(A, {
      id: 'aires', title: 'Aires des animaux',
      text: 'Chaque animal peut être limité à une zone autorisée de sa carte, comme un colon.',
      sources: [sim('animal-area-policy-287.ts', 'supportsAnimalAreas287')],
      fidelity: 'core', notes: ['docs/gameplay/animal-areas-v465.md'], related: ['deplacement.zones'],
    }),
  ],
};

const F = 'nourriture';
const meals = Object.entries(PRODUCTION_RECIPES).filter(([, r]) => r.work === 'cook');
export const FOOD_DOMAIN: RuleDomain = {
  id: F, label: 'Nourriture, cuisine et nutrition', coverage: 'partial',
  missing: ['Ingrédients exacts de chaque recette', 'Politiques alimentaires', 'Équarrissage et rendement en viande'],
  summary: 'Valeur nutritive des aliments, recettes de cuisine, intoxications et pourriture.',
  rules: [
    rule(F, {
      id: 'manger', title: 'Manger',
      text: 'Un repas prend {ingest} tics locaux. Manger sans table donne une pensée négative (voir les souvenirs de repas). La nutrition d’un aliment s’ajoute à la jauge de faim.',
      values: [
        code('ingest', 'Durée d’un repas', INGEST_TICKS, sim('eating.ts', 'INGEST_TICKS'), 'tics'),
      ],
      tables: [table('aliments', 'Valeur nutritive (sur cent points de faim)', ['Aliment', 'Nutrition'],
        sorted(Object.values(ITEM_DEFINITIONS).filter(i => i.nutrition > 0), i => i.label).map(i => [i.label, i.nutrition]), sim('items.ts', 'ITEM_DEFINITIONS'))],
      fidelity: 'core', notes: ['docs/development/food-items.md', 'docs/development/dining.md'], related: ['besoins.nourriture', 'humeur.pensees'],
    }),
    rule(F, {
      id: 'recettes', title: 'Recettes de cuisine',
      text: 'Chaque recette demande des unités d’ingrédients et un temps de travail à un poste de cuisine.',
      tables: [table('recettes', 'Recettes de cuisine', ['Recette', 'Poste', 'Unités d’ingrédients', 'Travail (tics)', 'Produits'],
        meals.map(([, r]) => [r.label, r.station, r.units, r.workTicks, r.outputUnits]), sim('production-recipes.ts', 'PRODUCTION_RECIPES'))],
      fidelity: 'core', notes: ['docs/development/cooking.md', 'docs/gameplay/pemmican-v389.md', 'docs/gameplay/nutrient-paste-v282.md'], related: ['intoxication'],
    }),
    rule(F, {
      id: 'intoxication', title: 'Intoxication alimentaire',
      text: 'À la fin d’un plat, la propreté de la cuisine est tirée d’abord : la chance vaut moins deux moins la propreté, divisé par soixante, au plus {roomMax}, et {outdoor} dehors. Puis la compétence du cuisinier : de {cook0} au niveau zéro à {cook9} dès le niveau neuf. Manger cru ajoute {raw}.',
      values: [
        code('roomMax', 'Chance maximale due à la pièce', roomFoodPoisonChance(-100), sim('food-poisoning.ts', 'roomFoodPoisonChance')),
        code('outdoor', 'Chance dehors', roomFoodPoisonChance(null), sim('food-poisoning.ts', 'roomFoodPoisonChance')),
        code('cook0', 'Cuisinier niveau zéro', cookFoodPoisonChance(0), sim('food-poisoning.ts', 'cookFoodPoisonChance')),
        code('cook9', 'Cuisinier niveau neuf et plus', cookFoodPoisonChance(9), sim('food-poisoning.ts', 'cookFoodPoisonChance')),
        code('raw', 'Aliment cru', rawFoodPoisonChance('rice'), sim('food-poisoning.ts', 'rawFoodPoisonChance')),
      ],
      tables: [table('cuisinier', 'Chance d’intoxication selon le cuisinier', ['Niveau', 'Chance'], Array.from({ length: 11 }, (_, level) => [level, cookFoodPoisonChance(level)]), sim('food-poisoning.ts', 'cookFoodPoisonChance'))],
      fidelity: 'core', notes: ['docs/development/food-poisoning.md'], related: ['sante.intoxication', 'recettes'],
    }),
    rule(F, {
      id: 'pourriture', title: 'Pourriture',
      text: 'Un aliment pourrit à une vitesse égale à la température divisée par dix, entre zéro et un : rien sous zéro degré, pleine vitesse dès {full} °C. Il se gâte après le nombre de jours du tableau à pleine vitesse.',
      values: [pinned('full', 'Pleine vitesse dès', 10, sim('food-preservation.ts', 'rotRateAtTemperature'), 'temperature / 10')],
      tables: [table('pourriture', 'Jours avant pourriture', ['Objet', 'Jours'],
        sorted(Object.entries(ROT_DAYS).map(([id, d]) => [itemLabel(id as ItemId), d] as [string, number]), r => r[0]), sim('food-preservation.ts', 'ROT_DAYS'))],
      fidelity: 'core', notes: ['docs/development/food-preservation.md', 'docs/gameplay/deterioration-v396.md'], related: ['manger', 'climat.temperature-exterieure'],
    }),
  ],
};

