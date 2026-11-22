import type { RuleDomain } from '../rules-types.ts';
import { at, code, DAY, days, formatNumber, pinned, rule, sim, table } from '../rules-helpers.ts';
import { TICKS_PER_DAY, TICKS_PER_SECOND } from '../../sim/types.ts';
import { CORE_TICKS_PER_SECOND } from '../../bridge/clock-rate.ts';
import { TICKS_PER_YEAR } from '../../sim/site-climate.ts';
import { INITIAL_CALENDAR_YEAR_256 } from '../../sim/initial-calendar-256.ts';
import { SCHEDULE_ASSIGNMENTS, defaultSchedule } from '../../sim/schedule.ts';
import { BED_REST_PER_TICK, GROUND_REST_PER_TICK, HUNGER_PER_TICK, REST_PER_TICK, restFallFactor } from '../../sim/human-need-rates.ts';
import { adultHungerFactor } from '../../sim/items.ts';

import { RECREATION_DURATION, RECREATION_GAIN, RECREATION_KINDS, recreationMood } from '../../sim/recreation-rules.ts';
import { COLONY_EXPECTATIONS } from '../../sim/expectations.ts';
import { JOY_TABLES_354 } from '../../sim/joy-tables-354.ts';
import { HUMAN_COMFY_MAX_343, HUMAN_COMFY_MIN_343 } from '../../sim/first-days-memories-343.ts';
import { ROOM_SIZE_INITIAL_345 } from '../../sim/room-size-need-345.ts';
import { MOOD_BASE, MOOD_FALL_PER_HOUR, MOOD_RISE_PER_HOUR, MOOD_THOUGHTS_FOR_RULES } from '../../sim/mood.ts';
import { BREAK_MTB_DAYS, CATHARSIS_DURATION } from '../../sim/mental-state.ts';
import { MENTAL_CRISIS_CATALOG } from '../../sim/mental-catalog.ts';
import { MOOD_POOL_MEMORIES_350 } from '../../sim/mood-pool-memories-350.ts';
import { PSYCHIC_STAGES_350 } from '../../sim/mood-pool-350.ts';
import { DEATH_THOUGHT_RULES } from '../../sim/death-thoughts-rules.ts';
import { INSPIRATIONS_360, INSPIRATION_DURATION_360, INSPIRATION_MIN_MOOD_360, INSPIRATION_MTB_DAYS_AT_MAX_360, INSPIRATION_MTB_DAYS_AT_MIN_360 } from '../../sim/inspirations-360.ts';
import { TRAITS } from '../../sim/traits.ts';
import { XP_SCALE, xpRequired } from '../../sim/skills.ts';
import { BACKGROUND_SKILL_IDS, BACKGROUND_WORK_LABELS } from '../../sim/colonist-backgrounds.ts';
import { RIM_WORK_GIVER_TABLE, RIM_WORK_TYPES } from '../../sim/work-givers-rimworld.ts';
import { PLAN_INTERVAL } from '../../sim/work-planner.ts';
import type { RecreationKind } from '../../sim/recreation-rules.ts';

/** Skill names as the game shows them (ids come from BACKGROUND_SKILL_IDS). */
export const SKILL_LABELS: Readonly<Record<typeof BACKGROUND_SKILL_IDS[number], string>> = Object.freeze({
  shooting: 'Tir', melee: 'Mêlée', construction: 'Construction', mining: 'Minage', cooking: 'Cuisine',
  plants: 'Plantes', animals: 'Animaux', crafting: 'Artisanat', artistic: 'Artistique', medicine: 'Médecine',
  social: 'Social', intellectual: 'Intellectuel',
});
const RECREATION_KIND_LABELS: Readonly<Record<RecreationKind, string>> = Object.freeze({
  solitary: 'Solitaire', dexterity: 'Adresse', cerebral: 'Cérébral', social: 'Social', television: 'Télévision', chemical: 'Chimique', reading: 'Lecture',
});
const SCHEDULE_LABELS: Readonly<Record<typeof SCHEDULE_ASSIGNMENTS[number], string>> = Object.freeze({
  anything: 'Libre', work: 'Travail', sleep: 'Sommeil', recreation: 'Loisirs',
});
const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
const hours = (ticks: number): number => ticks / (DAY / 24);

const T = 'temps';
export const TIME_DOMAIN: RuleDomain = {
  id: T, label: 'Temps et vitesse', coverage: 'complete', missing: [],
  summary: 'Le tic local, la journée, le calendrier et les vitesses de jeu.',
  rules: [
    rule(T, {
      id: 'tic', title: 'Le tic, unité de simulation',
      text: 'Toute la simulation avance par tics. Le jeu fait {local} tics locaux par seconde à vitesse normale ; chaque tic local vaut {ratio} tics du jeu de base, soit {core} tics du jeu de base par seconde comme dans RimWorld.',
      values: [
        code('local', 'Tics locaux par seconde', TICKS_PER_SECOND, sim('types.ts', 'TICKS_PER_SECOND')),
        code('ratio', 'Tics du jeu de base par tic local', CORE_TICKS_PER_SECOND / TICKS_PER_SECOND, at('src/bridge/clock-rate.ts', 'CORE_TICKS_PER_SECOND')),
        code('core', 'Tics du jeu de base par seconde', CORE_TICKS_PER_SECOND, at('src/bridge/clock-rate.ts', 'CORE_TICKS_PER_SECOND')),
      ],
      fidelity: 'adaptation', fidelityNote: 'Le rythme du jeu de base est conservé ; le tic local regroupe dix tics du jeu de base pour alléger la simulation.',
      notes: ['docs/development/simulation.md'], related: ['jour', 'vitesses'],
    }),
    rule(T, {
      id: 'jour', title: 'La journée',
      text: 'Une journée compte {ticks} tics locaux, soit {perHour} tics par heure sur {hours} heures.',
      values: [
        code('ticks', 'Tics locaux par jour', TICKS_PER_DAY, sim('types.ts', 'TICKS_PER_DAY')),
        code('perHour', 'Tics locaux par heure', TICKS_PER_DAY / 24, sim('types.ts', 'TICKS_PER_DAY')),
        pinned('hours', 'Heures par jour', 24, sim('schedule.ts', 'hourOfDay'), '* 24 / TICKS_PER_DAY'),
      ],
      fidelity: 'core', notes: ['docs/development/simulation.md'], related: ['calendrier', 'travail.emploi-du-temps'],
    }),
    rule(T, {
      id: 'calendrier', title: 'Calendrier et saisons',
      text: 'Une année dure {year} jours, en quatre quadrimestres de {quadrum} jours qui portent chacun une saison (printemps, été, automne, hiver ; décalées de deux dans l’hémisphère sud). Le calendrier commence en l’an {start}. Une nouvelle partie démarre à {startHour} h du matin.',
      values: [
        code('year', 'Jours par an', days(TICKS_PER_YEAR), sim('site-climate.ts', 'TICKS_PER_YEAR'), 'jours'),
        pinned('quadrum', 'Jours par quadrimestre', 15, sim('site-climate.ts', 'climateDate'), 'day%15+1', 'jours'),
        code('start', 'Année de départ', INITIAL_CALENDAR_YEAR_256, sim('initial-calendar-256.ts', 'INITIAL_CALENDAR_YEAR_256')),
        pinned('startHour', 'Heure de départ', 6, sim('calendar.ts', 'calendarTick'), 'TICKS_PER_DAY / 4'),
      ],
      fidelity: 'core', notes: ['docs/development/site-climate.md'], related: ['climat.temperature-exterieure'],
    }),
    rule(T, {
      id: 'vitesses', title: 'Vitesses de jeu',
      text: 'Le joueur choisit pause, vitesse normale, rapide ou très rapide (multiplicateurs {x1}, {x3} et {x6}), qui valent les vitesses un, deux et trois du jeu de base. À vitesse normale une journée dure {minutes} de temps réel. Une image ne rattrape jamais plus de {cap} ms de retard, pour que le jeu ralentisse au lieu de sauter du temps.',
      values: [
        pinned('x1', 'Vitesse normale', '×1', at('src/bridge/simulation-runtime.ts', "request.type === 'speed'"), '[0, 1, 3, 6].includes(request.speed)'),
        pinned('x3', 'Vitesse rapide', '×3', at('src/bridge/simulation-runtime.ts', "request.type === 'speed'"), '[0, 1, 3, 6].includes(request.speed)'),
        pinned('x6', 'Vitesse très rapide', '×6', at('src/bridge/simulation-runtime.ts', "request.type === 'speed'"), '[0, 1, 3, 6].includes(request.speed)'),
        code('minutes', 'Durée d’une journée à vitesse normale', `${Math.floor(TICKS_PER_DAY / TICKS_PER_SECOND / 60)} min ${TICKS_PER_DAY / TICKS_PER_SECOND % 60} s`, sim('types.ts', 'TICKS_PER_DAY')),
        pinned('cap', 'Retard rattrapé au plus par passe', 250, at('src/bridge/fixed-core-clock-297.ts', 'reserve'), 'Math.min(250,this.gapMs)'),
      ],
      fidelity: 'core', fidelityNote: 'Mêmes tics par seconde que le jeu de base ; la borne de rattrapage est propre au client.',
      notes: ['docs/development/three-speed-fluency-20261031.md'], related: ['tic'],
    }),
  ],
};

const N = 'besoins';
const thought = MOOD_THOUGHTS_FOR_RULES;
export const NEEDS_DOMAIN: RuleDomain = {
  id: N, label: 'Besoins', coverage: 'partial',
  missing: ['Besoin de nourriture des animaux et des enfants', 'Détail du tirage de la malnutrition', 'Besoins des invités et des prisonniers'],
  summary: 'Nourriture, repos, loisirs, confort, beauté, espace, plein air et température : chaque besoin est une jauge de zéro à cent.',
  rules: [
    rule(N, {
      id: 'nourriture', title: 'Faim',
      text: 'La nutrition baisse de {perDay} points par jour pour un adulte. La baisse est ralentie quand la jauge est basse : facteur {f24} sous {t24}, {f12} sous {t12}, nulle à zéro. Un colon va manger à {eat} ou moins (à {eatSleep} s’il dort, à {eatCrisis} en crise) ; à {hungry} ou moins il passe à l’état « affamé ».',
      values: [
        code('perDay', 'Baisse par jour', HUNGER_PER_TICK * DAY, sim('human-need-rates.ts', 'HUNGER_PER_TICK'), 'points'),
        pinned('t24', 'Seuil de ralentissement', 24, sim('items.ts', 'adultHungerFactor'), 'level < 24 ? 0.5'),
        code('f24', 'Facteur sous ce seuil', adultHungerFactor(20), sim('items.ts', 'adultHungerFactor')),
        pinned('t12', 'Second seuil', 12, sim('items.ts', 'adultHungerFactor'), 'level < 12 ? 0.25'),
        code('f12', 'Facteur sous le second seuil', adultHungerFactor(5), sim('items.ts', 'adultHungerFactor')),
        pinned('eat', 'Seuil pour aller manger', 30, sim('needs.ts', 'offerFoodNeed300'), "?12.5:30)"),
        pinned('eatSleep', 'Seuil pendant le sommeil', 12.5, sim('needs.ts', 'offerFoodNeed300'), "'sleep'?12.5:30"),
        pinned('eatCrisis', 'Seuil en crise', 5, sim('needs.ts', 'offerFoodNeed300'), 'pawn.mental?.crisis?5:'),
        pinned('hungry', 'Seuil « affamé »', 20, sim('needs.ts', 'processNeeds'), 'pawn.hunger <= 20'),
      ],
      fidelity: 'core', fidelityNote: 'Le seuil de 12,5 pendant le sommeil n’a pas d’équivalent trouvé dans le jeu de base.',
      notes: ['docs/development/needs.md', 'docs/gameplay/mood-fidelity-v313.md', 'docs/development/malnutrition.md'],
      related: ['humeur.pensees', 'nourriture.manger', 'sante.exposition'],
    }),
    rule(N, {
      id: 'repos', title: 'Repos et sommeil',
      text: 'Le repos baisse de {perDay} points par jour, multiplié selon le niveau : {f28} au-dessus de {t28}, {f14} au-dessus de {t14}, {f1} au-dessus de {t1}, {f0} en dessous. Un lit remplit la jauge en {bedHours} heures, le sol avec un facteur {ground}. Un colon se couche sous {sleepSlot} pendant ses heures de sommeil, sous {sleepFree} sinon, et se réveille à {wake}.',
      values: [
        code('perDay', 'Baisse par jour', REST_PER_TICK * DAY, sim('human-need-rates.ts', 'REST_PER_TICK'), 'points'),
        pinned('t28', 'Premier seuil', 28, sim('human-need-rates.ts', 'restFallFactor'), 'rest>=28?1:rest>=14?.7:rest>=1?.3:.6'),
        code('f28', 'Facteur au-dessus', restFallFactor(50), sim('human-need-rates.ts', 'restFallFactor')),
        pinned('t14', 'Deuxième seuil', 14, sim('human-need-rates.ts', 'restFallFactor'), 'rest>=14?.7'),
        code('f14', 'Facteur', restFallFactor(20), sim('human-need-rates.ts', 'restFallFactor')),
        pinned('t1', 'Troisième seuil', 1, sim('human-need-rates.ts', 'restFallFactor'), 'rest>=1?.3'),
        code('f1', 'Facteur', restFallFactor(5), sim('human-need-rates.ts', 'restFallFactor')),
        code('f0', 'Facteur à zéro', restFallFactor(0), sim('human-need-rates.ts', 'restFallFactor')),
        code('bedHours', 'Heures pour remplir la jauge au lit', hours(100 / BED_REST_PER_TICK), sim('human-need-rates.ts', 'BED_REST_PER_TICK')),
        code('ground', 'Facteur du sol', GROUND_REST_PER_TICK / BED_REST_PER_TICK, sim('human-need-rates.ts', 'GROUND_REST_PER_TICK')),
        pinned('sleepSlot', 'Coucher pendant les heures de sommeil', 75, sim('schedule.ts', 'wantsSleep'), "assignment === 'sleep' ? pawn.rest < 75"),
        pinned('sleepFree', 'Coucher le reste du temps', 30, sim('schedule.ts', 'wantsSleep'), 'pawn.rest < 30'),
        pinned('wake', 'Réveil', 100, sim('sleeping.ts', 'processSleeping'), 'pawn.rest >= 100'),
      ],
      fidelity: 'core', notes: ['docs/development/needs.md', 'docs/development/schedules.md'], related: ['epuisement', 'travail.emploi-du-temps'],
    }),
    rule(N, {
      id: 'epuisement', title: 'Effondrement d’épuisement',
      text: 'À repos nul, un tirage peut faire s’effondrer le colon sur place. Son délai moyen raccourcit avec le temps passé à zéro : {d0} jour au début, puis {d1}, {d2} et enfin {d3} jour.',
      values: [
        pinned('d0', 'Délai moyen au début', 0.25, sim('rest.ts', 'collapseProbability'), 'zeroTicks < 1500 ? 0.25'),
        pinned('d1', 'Après un quart de jour', 0.125, sim('rest.ts', 'collapseProbability'), 'zeroTicks < 3000 ? 0.125'),
        pinned('d2', 'Après un demi-jour', '1/12', sim('rest.ts', 'collapseProbability'), 'zeroTicks < 4500 ? 1 / 12'),
        pinned('d3', 'Ensuite', 0.0625, sim('rest.ts', 'collapseProbability'), ': 0.0625'),
      ],
      fidelity: 'core', notes: ['docs/development/needs.md'], related: ['repos'],
    }),
    rule(N, {
      id: 'loisirs', title: 'Loisirs et tolérance',
      text: 'Les loisirs baissent de {fall} points par jour (facteur {f30} sous {t30}, {f15} sous {t15}). Une activité rend {gain} points par heure, réduits par la tolérance du genre de loisir. La tolérance monte de {tol} point par point gagné et baisse chaque jour selon les attentes de la colonie ; au-dessus de {bored}, le colon se lasse de ce genre jusqu’à ce que la tolérance repasse sous {unbored}. Une séance dure {duration} tics locaux.',
      values: [
        pinned('fall', 'Baisse par jour', 60, sim('recreation-rules.ts', 'updateRecreation'), '- 60 / TICKS_PER_DAY * factor'),
        pinned('t30', 'Seuil', 30, sim('recreation-rules.ts', 'updateRecreation'), 'joy.level < 30 ? .7'),
        pinned('f30', 'Facteur', 0.7, sim('recreation-rules.ts', 'updateRecreation'), 'joy.level < 30 ? .7'),
        pinned('t15', 'Seuil', 15, sim('recreation-rules.ts', 'updateRecreation'), 'joy.level < 15 ? .4'),
        pinned('f15', 'Facteur', 0.4, sim('recreation-rules.ts', 'updateRecreation'), 'joy.level < 15 ? .4'),
        code('gain', 'Gain par heure', RECREATION_GAIN * DAY / 24, sim('recreation-rules.ts', 'RECREATION_GAIN'), 'points'),
        pinned('tol', 'Tolérance par point gagné', 0.65, sim('recreation-rules.ts', 'gainRecreation'), 'gained * .65'),
        pinned('bored', 'Seuil de lassitude', 50, sim('recreation-rules.ts', 'gainRecreation'), '> 50) joy.bored[kind] = true'),
        pinned('unbored', 'Fin de lassitude', 30, sim('recreation-rules.ts', 'updateRecreation'), 'joy.tolerance[kind] < 30'),
        code('duration', 'Durée d’une séance', RECREATION_DURATION, sim('recreation-rules.ts', 'RECREATION_DURATION'), 'tics'),
      ],
      tables: [
        table('genres-loisirs', 'Genres de loisirs', ['Identifiant', 'Genre'], RECREATION_KINDS.map(kind => [kind, RECREATION_KIND_LABELS[kind]]), sim('recreation-rules.ts', 'RECREATION_KINDS')),
        table('tables-de-jeu', 'Tables et jeux', ['Objet', 'Genre', 'Gain', 'Joueurs au plus'],
          Object.values(JOY_TABLES_354).map(t => [t.label, RECREATION_KIND_LABELS[t.joyKind as RecreationKind] ?? t.joyKind, t.joyGainFactor, t.maxParticipants]), sim('joy-tables-354.ts', 'JOY_TABLES_354')),
      ],
      fidelity: 'core', notes: ['docs/development/recreation.md', 'docs/gameplay/joy-tables-v354.md'], related: ['attentes', 'humeur.pensees'],
    }),
    rule(N, {
      id: 'attentes', title: 'Attentes de la colonie',
      text: 'Le patrimoine de la colonie fixe ses attentes : une pensée d’humeur et la vitesse à laquelle la tolérance aux loisirs retombe. Plus la colonie est riche, plus les attentes sont hautes.',
      tables: [table('attentes', 'Paliers d’attentes', ['Attentes', 'Humeur', 'Baisse de tolérance par jour', 'Genres de loisirs requis', 'Patrimoine dès'],
        COLONY_EXPECTATIONS.map(e => [e.label, signed(e.moodOffset), e.joyToleranceDropPerDay, e.joyKindsNeeded, e.minWealth]), sim('expectations.ts', 'COLONY_EXPECTATIONS'))],
      fidelity: 'core', notes: ['docs/gameplay/mood-fidelity-v313.md'], related: ['loisirs', 'humeur.base'],
    }),
    rule(N, {
      id: 'confort', title: 'Confort',
      text: 'Le confort tend vers celui du meuble occupé : il monte de {up} points par heure et descend de {down} par heure.',
      values: [
        pinned('up', 'Montée par heure', 60, sim('wellbeing.ts', 'updateWellbeing'), 'pawn.comfort < ceiling ? 60 : -4'),
        pinned('down', 'Descente par heure', 4, sim('wellbeing.ts', 'updateWellbeing'), 'pawn.comfort < ceiling ? 60 : -4'),
      ],
      fidelity: 'core', notes: ['docs/development/habitat-comfort.md'], related: ['humeur.pensees'],
    }),
    rule(N, {
      id: 'beaute', title: 'Beauté',
      text: 'La jauge de beauté tend vers {base} plus {factor} fois la beauté perçue autour du colon ; elle monte de {up} points par heure et descend de {down}.',
      values: [
        pinned('base', 'Base', 40, sim('beauty-need.ts', 'advanceBeautyNeeds'), '40+perceived*10'),
        pinned('factor', 'Facteur de la beauté perçue', 10, sim('beauty-need.ts', 'advanceBeautyNeeds'), '40+perceived*10'),
        pinned('up', 'Montée par heure', 32, sim('beauty-need.ts', 'RISE_PER_HOUR'), 'RISE_PER_HOUR=32'),
        pinned('down', 'Descente par heure', 8, sim('beauty-need.ts', 'FALL_PER_HOUR'), 'FALL_PER_HOUR=8'),
      ],
      fidelity: 'core', notes: ['docs/development/habitat-comfort.md'], related: ['construction.beaute', 'humeur.pensees'],
    }),
    rule(N, {
      id: 'espace', title: 'Besoin d’espace',
      text: 'À l’intérieur, la jauge d’espace suit la taille de la pièce. Elle part de {initial}. Sous {cramped} la pièce est exiguë ({cOff}), sous {veryCramped} confinée ({vOff}) ; à {spacious} ou plus elle est spacieuse ({sOff}).',
      values: [
        code('initial', 'Valeur de départ', ROOM_SIZE_INITIAL_345, sim('room-size-need-345.ts', 'ROOM_SIZE_INITIAL_345')),
        pinned('veryCramped', 'Seuil confiné', 0.01, sim('room-size-need-345.ts', 'roomSizeCategory345'), 'VERY_CRAMPED=f(.01)'),
        pinned('cramped', 'Seuil exigu', 0.3, sim('room-size-need-345.ts', 'roomSizeCategory345'), 'CRAMPED=f(.3)'),
        pinned('spacious', 'Seuil spacieux', 0.7, sim('room-size-need-345.ts', 'roomSizeCategory345'), 'SPACIOUS=f(.7)'),
        pinned('vOff', 'Humeur confinée', -10, sim('room-size-need-345.ts', 'roomSizeThought345'), "'Intérieur confiné',offset:-10"),
        pinned('cOff', 'Humeur exiguë', -5, sim('room-size-need-345.ts', 'roomSizeThought345'), "'Intérieur exigu',offset:-5"),
        pinned('sOff', 'Humeur spacieuse', 5, sim('room-size-need-345.ts', 'roomSizeThought345'), "'Intérieur spacieux',offset:5"),
      ],
      fidelity: 'core', fidelityNote: 'Jauge visible et gelée hors de la carte (adaptation).', notes: ['docs/gameplay/mood-basics-v345.md'], related: ['humeur.pensees'],
    }),
    rule(N, {
      id: 'plein-air', title: 'Plein air',
      text: 'Le besoin de plein air monte dehors et baisse sous un toit, plus vite sous un toit épais. Vitesses par jour (en millièmes de jauge) : dehors à découvert {outOpen}, dehors sous toit mince {outThin}, dedans à découvert {inOpen}. Les Troglodytes n’ont pas ce besoin mais celui d’intérieur.',
      values: [
        pinned('outOpen', 'Dehors à découvert', 8, sim('outdoors-need-359.ts', 'outdoorsStep359'), "'outdoors-open':8"),
        pinned('outThin', 'Dehors sous toit mince', 1, sim('outdoors-need-359.ts', 'outdoorsStep359'), "'outdoors-thin':1"),
        pinned('inOpen', 'Dedans à découvert', 5, sim('outdoors-need-359.ts', 'outdoorsStep359'), "'indoors-open':5"),
      ],
      fidelity: 'core', fidelityNote: 'Les invités en sont exclus (adaptation).', notes: ['docs/gameplay/outdoors-need-v359.md'], related: ['humeur.pensees'],
    }),
    rule(N, {
      id: 'temperature', title: 'Température ressentie',
      text: 'Un humain est à l’aise entre {min} et {max} °C ; les vêtements portés déplacent ces bornes. Au-delà, une pensée de froid ou de chaud apparaît, de plus en plus forte par paliers de {step} degrés d’écart : {o1}, {o2}, {o3} puis {o4}.',
      values: [
        code('min', 'Confort minimal', HUMAN_COMFY_MIN_343, sim('first-days-memories-343.ts', 'HUMAN_COMFY_MIN_343'), '°C'),
        code('max', 'Confort maximal', HUMAN_COMFY_MAX_343, sim('first-days-memories-343.ts', 'HUMAN_COMFY_MAX_343'), '°C'),
        pinned('step', 'Palier', 10, sim('thermal-mood-v460.ts', 'thermalMoodStage460'), 'excess<10?0:excess<20?1:excess<30?2:3'),
        pinned('o1', 'Premier palier', -4, sim('thermal-mood-v460.ts', 'thermalMoodThoughts460'), 'offsets=[-4,-8,-12,-16]'),
        pinned('o2', 'Deuxième palier', -8, sim('thermal-mood-v460.ts', 'thermalMoodThoughts460'), 'offsets=[-4,-8,-12,-16]'),
        pinned('o3', 'Troisième palier', -12, sim('thermal-mood-v460.ts', 'thermalMoodThoughts460'), 'offsets=[-4,-8,-12,-16]'),
        pinned('o4', 'Quatrième palier', -16, sim('thermal-mood-v460.ts', 'thermalMoodThoughts460'), 'offsets=[-4,-8,-12,-16]'),
      ],
      fidelity: 'core', notes: ['docs/gameplay/thermal-mood-v460.md'], related: ['sante.exposition', 'climat.temperature-exterieure'],
    }),
  ],
};

const M = 'humeur';
const thoughtRows = (group: string, list: readonly { label: string; offset: number; description: string }[]) =>
  list.map(t => [group, t.label, signed(t.offset), t.description]);
export const MOOD_DOMAIN: RuleDomain = {
  id: M, label: 'Humeur, pensées et crises', coverage: 'partial',
  missing: ['Pensées sociales et d’opinion', 'Pensées de chaque trait', 'Détail des crises une par une'],
  summary: 'L’humeur suit la somme des pensées ; sous les seuils de rupture, une crise peut éclater.',
  rules: [
    rule(M, {
      id: 'base', title: 'Humeur et pensées',
      text: 'L’humeur tend vers {base} plus la somme des pensées, bornée entre zéro et cent. Elle monte de {up} points par heure et descend de {down}. Elle reste figée pendant le sommeil et l’inconscience.',
      values: [
        code('base', 'Humeur de base', MOOD_BASE, sim('mood.ts', 'MOOD_BASE')),
        code('up', 'Montée par heure', MOOD_RISE_PER_HOUR, sim('mood.ts', 'MOOD_RISE_PER_HOUR')),
        code('down', 'Descente par heure', MOOD_FALL_PER_HOUR, sim('mood.ts', 'MOOD_FALL_PER_HOUR')),
      ],
      fidelity: 'core', notes: ['docs/development/mood.md', 'docs/gameplay/mood-fidelity-v313.md'], related: ['pensees', 'ruptures'],
    }),
    rule(M, {
      id: 'pensees', title: 'Pensées de situation et souvenirs de repas',
      text: 'Chaque besoin bas, chaque douleur ou maladie et chaque repas ajoute une pensée. Les souvenirs de repas durent un jour.',
      tables: [
        table('pensees-situation', 'Pensées de situation', ['Origine', 'Pensée', 'Humeur', 'Condition'], [
          ...thoughtRows('Faim', thought.hunger), ...thoughtRows('Malnutrition', thought.starvation), ...thoughtRows('Repos', thought.fatigue),
          ...thoughtRows('Confort', thought.comforts), ...thoughtRows('Beauté', thought.beauty), ...thoughtRows('Loisirs', thought.leisure),
          ...thoughtRows('Douleur', thought.pains), ...thoughtRows('Maladie', [thought.sick]), ...thoughtRows('Vêtements', thought.apparel),
        ], sim('mood.ts', 'MOOD_THOUGHTS_FOR_RULES')),
        table('souvenirs-repas', 'Souvenirs de repas', ['Souvenir', 'Humeur'],
          Object.entries(thought.memoryOffsets).map(([id, offset]) => [thought.memoryLabels[id as keyof typeof thought.memoryLabels], signed(offset)]), sim('mood.ts', 'MOOD_THOUGHTS_FOR_RULES')),
        table('loisirs-humeur', 'Humeur selon les loisirs', ['Loisirs', 'Humeur'],
          [0, 10, 20, 50, 80, 100].map(level => [level, signed(recreationMood(level))]), sim('recreation-rules.ts', 'recreationMood')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/mood-fidelity-v313.md'], related: ['base', 'besoins.nourriture', 'besoins.loisirs'],
    }),
    rule(M, {
      id: 'souvenirs', title: 'Souvenirs marquants',
      text: 'Certains événements laissent un souvenir qui dure plusieurs jours et peut se cumuler.',
      tables: [
        table('souvenirs-morts', 'Morts et deuils', ['Souvenir', 'Humeur', 'Durée (jours)', 'Cumul au plus'],
          Object.values(DEATH_THOUGHT_RULES).map(r => [r.label, signed(r.offset), days(r.duration), r.limit]), sim('death-thoughts-rules.ts', 'DEATH_THOUGHT_RULES')),
        table('souvenirs-divers', 'Autres souvenirs', ['Souvenir', 'Humeur', 'Durée (jours)', 'Cumul au plus'],
          Object.values(MOOD_POOL_MEMORIES_350).map(r => [r.label, signed(r.offset), days(r.duration), r.stack]), sim('mood-pool-memories-350.ts', 'MOOD_POOL_MEMORIES_350')),
        table('ondes-psychiques', 'Ondes psychiques', ['Onde', 'Humeur'],
          Object.values(PSYCHIC_STAGES_350).map(s => [s.label, signed(s.offset)]), sim('mood-pool-350.ts', 'PSYCHIC_STAGES_350')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/death-thoughts-v274.md', 'docs/gameplay/mood-pool-v350.md'], related: ['base'],
    }),
    rule(M, {
      id: 'ruptures', title: 'Seuils de rupture et crises',
      text: 'Le seuil de rupture mineure vaut {minor} plus les décalages des traits ; le seuil majeur en vaut les quatre septièmes et l’extrême un septième. Il faut rester plus de {exposure} tics du jeu de base sous un seuil ; un tirage a alors lieu avec un délai moyen de {m0} jours (mineure), {m1} (majeure) ou {m2} (extrême). La crise est tirée au poids parmi celles de l’intensité la plus haute possible. Après la crise vient une catharsis de {catharsis} jours.',
      formula: 'mineur = {minor} + traits ; majeur = mineur × quatre septièmes ; extrême = mineur ÷ sept',
      values: [
        pinned('minor', 'Seuil mineur de base', 35, sim('traits.ts', 'minorBreakThreshold'), 'Math.min(50,35+'),
        pinned('exposure', 'Exposition requise', 2000, sim('mental-break.ts', 'updateMentalBreak'), 'm.below[2]>2000?2'),
        code('m0', 'Délai moyen, rupture mineure', BREAK_MTB_DAYS[0], sim('mental-state.ts', 'BREAK_MTB_DAYS'), 'jours'),
        code('m1', 'Délai moyen, rupture majeure', BREAK_MTB_DAYS[1], sim('mental-state.ts', 'BREAK_MTB_DAYS'), 'jours'),
        code('m2', 'Délai moyen, rupture extrême', BREAK_MTB_DAYS[2], sim('mental-state.ts', 'BREAK_MTB_DAYS'), 'jours'),
        code('catharsis', 'Durée de la catharsis', days(CATHARSIS_DURATION), sim('mental-state.ts', 'CATHARSIS_DURATION'), 'jours'),
      ],
      tables: [table('crises', 'Crises mentales', ['Crise', 'Intensité', 'Poids', 'Durée (jours du jeu de base)', 'Délai moyen de guérison (jours)'],
        Object.values(MENTAL_CRISIS_CATALOG).map(c => [c.label, ['mineure', 'majeure', 'extrême'][c.intensity] ?? `${c.intensity}`, c.weight, `${formatNumber(c.minCore / 60000)} à ${formatNumber(c.maxCore / 60000)}`, c.recoveryMtb]), sim('mental-catalog.ts', 'MENTAL_CRISIS_CATALOG'))],
      fidelity: 'core', notes: ['docs/development/mental-break.md', 'docs/gameplay/mood-pool-v350.md'], related: ['base', 'competences.traits'],
    }),
    rule(M, {
      id: 'inspirations', title: 'Inspirations',
      text: 'Quand l’humeur dépasse {minMood}, une inspiration peut survenir : son délai moyen passe de {mtbMin} jours à cette humeur à {mtbMax} jours à l’humeur maximale. Elle dure {duration} jours.',
      values: [
        code('minMood', 'Humeur minimale', `${INSPIRATION_MIN_MOOD_360 * 100} %`, sim('inspirations-360.ts', 'INSPIRATION_MIN_MOOD_360')),
        code('mtbMin', 'Délai moyen au seuil', INSPIRATION_MTB_DAYS_AT_MIN_360, sim('inspirations-360.ts', 'INSPIRATION_MTB_DAYS_AT_MIN_360')),
        code('mtbMax', 'Délai moyen au maximum', INSPIRATION_MTB_DAYS_AT_MAX_360, sim('inspirations-360.ts', 'INSPIRATION_MTB_DAYS_AT_MAX_360')),
        code('duration', 'Durée', days(INSPIRATION_DURATION_360), sim('inspirations-360.ts', 'INSPIRATION_DURATION_360')),
      ],
      tables: [table('inspirations', 'Inspirations', ['Inspiration', 'Âge minimal', 'Effet'],
        INSPIRATIONS_360.map(i => [i.label, i.minAge, i.begin]), sim('inspirations-360.ts', 'INSPIRATIONS_360'))],
      fidelity: 'core', fidelityNote: 'Flux de tirage privé (adaptation).', notes: ['docs/gameplay/inspirations-v360.md'], related: ['base'],
    }),
  ],
};

const S = 'competences';
const SKILL_DECAY = [100, 200, 400, 600, 1000, 1800, 2800, 4000, 6000, 8000, 12000] as const;
export const SKILLS_DOMAIN: RuleDomain = {
  id: S, label: 'Compétences, passions et traits', coverage: 'partial',
  missing: ['Gains d’expérience de chaque travail', 'Tirage des histoires et des traits à la naissance en détail'],
  summary: 'Douze compétences de zéro à vingt, apprises en travaillant, oubliées lentement au-delà du niveau dix.',
  rules: [
    rule(S, {
      id: 'niveaux', title: 'Niveaux et expérience',
      text: 'Chaque compétence va de zéro à {max}. L’expérience nécessaire pour passer au niveau suivant est donnée par le tableau.',
      values: [pinned('max', 'Niveau maximal', 20, sim('skills.ts', 'learnSkill'), 'skill.level<20')],
      tables: [
        table('competences', 'Les compétences', ['Identifiant', 'Compétence'], BACKGROUND_SKILL_IDS.map(id => [id, SKILL_LABELS[id]]), sim('colonist-backgrounds.ts', 'BACKGROUND_SKILL_IDS')),
        table('experience', 'Expérience par niveau', ['Niveau', 'Expérience pour passer au suivant'],
          Array.from({ length: 20 }, (_, level) => [level, xpRequired(level) / XP_SCALE]), sim('skills.ts', 'xpRequired')),
      ],
      fidelity: 'core', notes: ['docs/development/skills.md'], related: ['apprentissage'],
    }),
    rule(S, {
      id: 'apprentissage', title: 'Apprentissage et passions',
      text: 'L’expérience gagnée est multipliée par la passion : {none} sans passion, {minor} pour une passion, {major} pour une passion brûlante, puis par les traits. Au-delà de {cap} points gagnés dans la journée, le gain tombe à {capped}. Le compteur quotidien se remet à zéro dans la première heure de la journée.',
      values: [
        pinned('none', 'Sans passion', 0.35, sim('skills.ts', 'learningFactor'), '[0.35,1,1.5]'),
        pinned('minor', 'Passion', 1, sim('skills.ts', 'learningFactor'), '[0.35,1,1.5]'),
        pinned('major', 'Passion brûlante', 1.5, sim('skills.ts', 'learningFactor'), '[0.35,1,1.5]'),
        pinned('cap', 'Plafond quotidien', 4000, sim('skills.ts', 'learningFactor'), 'skill.dailyXp>4000*XP_SCALE ? .2'),
        pinned('capped', 'Facteur au-delà', 0.2, sim('skills.ts', 'learningFactor'), 'skill.dailyXp>4000*XP_SCALE ? .2'),
      ],
      fidelity: 'core', notes: ['docs/development/skills.md', 'docs/gameplay/skills-passions-v372.md'], related: ['niveaux', 'oubli', 'travail.passion'],
    }),
    rule(S, {
      id: 'oubli', title: 'Oubli au-delà du niveau dix',
      text: 'À partir du niveau {from}, une compétence perd de l’expérience tous les {interval} tics locaux ; la perte grandit avec le niveau. Le trait « Grande mémoire » la divise par deux.',
      values: [
        pinned('from', 'Premier niveau concerné', 10, sim('skills.ts', 'tickSkillsAt'), 'decay[skill.level-10]'),
        pinned('interval', 'Intervalle', 20, sim('skills.ts', 'tickSkillsAt'), '(tick%20+pawn.id%20)%20'),
      ],
      tables: [table('oubli', 'Perte d’expérience par jour', ['Niveau', 'Perte par jour'],
        SKILL_DECAY.map((loss, i) => [10 + i, loss / XP_SCALE * DAY / 20]), sim('skills.ts', 'tickSkillsAt'), '[100,200,400,600,1000,1800,2800,4000,6000,8000,12000]')],
      fidelity: 'core', notes: ['docs/development/skills.md'], related: ['niveaux'],
    }),
    rule(S, {
      id: 'naissance', title: 'Compétences et passions à la naissance',
      text: 'Les compétences de départ viennent des histoires d’enfance et d’adulte, des traits et de l’âge, comme dans le jeu de base. Les passions se tirent sur un budget de {budget} points plus un écart gaussien ; une passion brûlante coûte {major} point.',
      values: [
        pinned('budget', 'Budget de passions', 5, sim('skill-generation-372.ts', 'generateCoreSkills372'), 'points=f(5+clamp(gaussian(birth.draw),-4,4))'),
        pinned('major', 'Coût d’une passion brûlante', 1.5, sim('skill-generation-372.ts', 'generateCoreSkills372'), 'points>=1.5&&birth.draw()<.5'),
      ],
      fidelity: 'core', fidelityNote: 'Mêmes formules (PawnGenerator) ; flux de naissance privé.', notes: ['docs/gameplay/skills-passions-v372.md', 'docs/gameplay/backstories-v370.md'], related: ['traits'],
    }),
    rule(S, {
      id: 'traits', title: 'Traits',
      text: 'Chaque personne porte de un à trois traits tirés selon leur fréquence et leurs incompatibilités. Un trait peut changer l’humeur, l’apprentissage, le seuil de rupture, la vitesse de travail ou de marche, ou interdire des travaux.',
      tables: [table('traits', 'Les traits', ['Trait', 'Effet'], Object.values(TRAITS).map(t => [t.label, t.description]), sim('traits.ts', 'TRAITS'))],
      fidelity: 'core', notes: ['docs/gameplay/traits-v361.md', 'docs/gameplay/trait-links-v362.md'], related: ['humeur.ruptures'],
    }),
  ],
};

const W = 'travail';
export const WORK_DOMAIN: RuleDomain = {
  id: W, label: 'Travail, priorités et emploi du temps', coverage: 'partial',
  missing: ['Liste complète des donneurs de travail et de leurs conditions', 'Vitesse de chaque travail'],
  summary: 'Vingt types de travail, quatre priorités et un emploi du temps heure par heure.',
  rules: [
    rule(W, {
      id: 'types', title: 'Types de travail',
      text: 'Le colon parcourt les types de travail dans l’ordre de ses priorités, puis dans l’ordre naturel du jeu (le plus grand d’abord). Le tableau donne cet ordre naturel et les compétences de chaque type. Le jeu compte {givers} donneurs de travail répartis entre ces types.',
      values: [code('givers', 'Donneurs de travail', RIM_WORK_GIVER_TABLE.length, sim('work-givers-rimworld.ts', 'RIM_WORK_GIVER_TABLE'))],
      tables: [table('types-travail', 'Types de travail du jeu de base', ['Type', 'Ordre naturel', 'Toujours actif', 'Compétences'],
        Object.values(RIM_WORK_TYPES).map(t => [BACKGROUND_WORK_LABELS[t.work], t.natural, t.always ? 'oui' : 'non', t.skills.map(s => SKILL_LABELS[s as keyof typeof SKILL_LABELS] ?? s).join(', ') || '—']), sim('work-givers-rimworld.ts', 'RIM_WORK_TYPES'))],
      fidelity: 'core', notes: ['docs/development/work-planner-rimworld.md'], related: ['priorites', 'planificateur'],
    }),
    rule(W, {
      id: 'priorites', title: 'Priorités',
      text: 'En mode manuel chaque travail reçoit une priorité de un (la plus haute) à {lowest}, ou zéro pour ne pas le faire. En mode simple, tout travail actif compte comme {simple}.',
      values: [
        pinned('lowest', 'Priorité la plus basse', 4, sim('work-tab-344.ts', 'nextCellPriority344'), 'shown-1<0?4:shown-1'),
        pinned('simple', 'Priorité en mode simple', 3, sim('work-tab-344.ts', 'nextCellPriority344'), 'shown>0?0:3'),
      ],
      fidelity: 'core', notes: ['docs/gameplay/work-tab-v344.md'], related: ['types', 'planificateur'],
    }),
    rule(W, {
      id: 'planificateur', title: 'Choix d’une tâche',
      text: 'Un colon libre cherche une tâche au plus tous les {interval} tics locaux. Les donneurs sont triés par priorité du colon, ordre naturel du type, priorité dans le type puis ordre de définition ; le premier qui trouve une cible l’emporte. La cible est cherchée par régions puis par distance.',
      values: [code('interval', 'Intervalle de recherche', PLAN_INTERVAL, sim('work-planner.ts', 'PLAN_INTERVAL'), 'tics')],
      sources: [sim('work-givers-rimworld.ts', 'compareRimWorkGivers')],
      fidelity: 'core', notes: ['docs/development/work-planner-rimworld.md'], related: ['types', 'priorites'],
    }),
    rule(W, {
      id: 'emploi-du-temps', title: 'Emploi du temps',
      text: 'Chaque heure de la journée porte une affectation. Par défaut, le colon dort de {sleep} h à {wake} h et fait ce qu’il veut le reste du temps. Une heure de travail ne déclenche jamais le sommeil.',
      values: [
        pinned('sleep', 'Coucher par défaut', 22, sim('schedule.ts', 'defaultSchedule'), "h >= 6 && h < 22 ? 'anything' : 'sleep'"),
        pinned('wake', 'Lever par défaut', 6, sim('schedule.ts', 'defaultSchedule'), "h >= 6 && h < 22 ? 'anything' : 'sleep'"),
      ],
      tables: [table('affectations', 'Affectations horaires', ['Identifiant', 'Affectation', 'Heures par défaut'],
        SCHEDULE_ASSIGNMENTS.map(a => [a, SCHEDULE_LABELS[a], defaultSchedule().filter(s => s === a).length]), sim('schedule.ts', 'SCHEDULE_ASSIGNMENTS'))],
      fidelity: 'core', notes: ['docs/development/schedules.md'], related: ['besoins.repos', 'temps.jour'],
    }),
    rule(W, {
      id: 'passion', title: 'Travail passionné',
      text: 'Un colon qui exerce une compétence pour laquelle il a une passion reçoit une pensée de {minor} (passion) ou {major} (passion brûlante) le temps du travail.',
      values: [
        pinned('minor', 'Passion', 8, sim('passionate-work-345.ts', 'passionateWorkThought345'), "'Passion pour son travail',offset:8"),
        pinned('major', 'Passion brûlante', 14, sim('passionate-work-345.ts', 'passionateWorkThought345'), "'Passion brûlante pour son travail',offset:14"),
      ],
      fidelity: 'core', notes: ['docs/gameplay/mood-basics-v345.md'], related: ['competences.apprentissage'],
    }),
  ],
};
