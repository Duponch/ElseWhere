import type { RuleDomain } from '../rules-types.ts';
import { code, days, pinned, rule, sim, sorted, table } from '../rules-helpers.ts';
import type { Structure } from '../../sim/types.ts';
import { INJURY_RULES, HEAL_INTERVAL } from '../../sim/injury-rules.ts';
import { HUMAN_BODY } from '../../sim/body-definition.ts';
import { PAIN_SHOCK_THRESHOLD_362, WIMP_PAIN_SHOCK_THRESHOLD_362 } from '../../sim/trait-links-362.ts';
import { IMMUNE_DISEASE_DEFINITIONS } from '../../sim/immune-diseases-rules.ts';
import { MEDICINES } from '../../sim/medicine-rules.ts';
import { SURGERY_WORK } from '../../sim/surgery-rules.ts';
import { INFECTION_DELAY_MIN_CORE, INFECTION_DELAY_MAX_CORE } from '../../sim/infection-rules.ts';
import { ARTIFICIAL_PARTS } from '../../sim/artificial-parts-rules.ts';
import { PROSTHETIC_DEFINITIONS_273 } from '../../sim/prosthetic-content-273.ts';
import { MALNUTRITION_LABELS } from '../../sim/malnutrition.ts';
import { HEAT_LABELS } from '../../sim/heat-severity.ts';
import { QUALITY_LABELS, WEAPON_QUALITIES } from '../../sim/equipment-rules.ts';
import type { RangedWeaponItem } from '../../sim/equipment-rules.ts';
import { rangedWeaponProfile, shootingAccuracy } from '../../sim/ranged-statistics.ts';
import { meleeDodgeChance, meleeHitChance } from '../../sim/melee-statistics.ts';
import { meleeStunCore318 } from '../../sim/stun.ts';
import { BULLET_STAGGER_CORE_TICKS } from '../../sim/stagger.ts';
import { MACE_DEFINITIONS_269 } from '../../sim/mace-content-269.ts';
import { LONGSWORD_DEFINITIONS_270 } from '../../sim/longsword-content-270.ts';
import { APPAREL_MATERIAL_DEFINITIONS } from '../../sim/apparel-definitions.ts';
import { WEATHER } from '../../sim/weather-definitions.ts';
import { CLIMATE_DEFINITIONS } from '../../sim/site-climate.ts';
import { FIRE_COMPLEX_CORE, FIRE_MAX_SIZE, FIRE_MIN_SIZE, fireSpreadInterval } from '../../sim/fire-rules.ts';
import { COLD_SNAP_MAX_OFFSET, COLD_SNAP_COOLDOWN } from '../../sim/cold-snap.ts';
import { VOLCANIC_WINTER_TEMPERATURE310 } from '../../sim/volcanic-winter-state-310.ts';
import { TOXIC_FALLOUT_COOLDOWN_DAYS294, TOXIC_FALLOUT_FIRST_DAY294 } from '../../sim/toxic-fallout-state-294.ts';
import { POWER_OUTPUT, CONNECTION_RANGE, isPowerTrader, powerDemand } from '../../sim/power-rules.ts';
import { SOLAR_MAX_OUTPUT } from '../../sim/solar-rules.ts';
import { WIND_RATED_OUTPUT } from '../../sim/wind-rules.ts';
import { GEOTHERMAL_POWER_WATTS_264 } from '../../sim/geothermal-state-264.ts';
import { BATTERY_CAPACITY, BATTERY_ENERGY_SCALE, BATTERY_LEAK_PER_CORE_TICK } from '../../sim/power-battery.ts';
import { BREAKDOWN_MTB_CORE_TICKS } from '../../sim/breakdowns.ts';
import { SHORT_CIRCUIT_COOLDOWN } from '../../sim/short-circuit.ts';
import { STRUCTURE_DEFINITIONS } from '../../sim/definitions.ts';
import { ITEM_DEFINITIONS } from '../../sim/items.ts';

const itemLabel = (id: string): string => (ITEM_DEFINITIONS as Readonly<Record<string, { label: string }>>)[id]?.label ?? id;
const CORE_DAY = 60000, CORE_HOUR = CORE_DAY / 24;

const H = 'sante';
const diseaseLabels: Readonly<Record<string, string>> = { malaria: 'Malaria', plague: 'Peste', 'sleeping-sickness': 'Maladie du sommeil' };
export const HEALTH_DOMAIN: RuleDomain = {
  id: H, label: 'Santé, blessures, maladies et chirurgie', coverage: 'partial',
  missing: ['Grippe et infections en détail', 'Drogues et alcool', 'Toutes les opérations', 'Calcul complet des capacités'],
  summary: 'Blessures, saignement, douleur, guérison, maladies, soins et opérations.',
  rules: [
    rule(H, {
      id: 'blessures', title: 'Blessures, douleur et saignement',
      text: 'Chaque blessure a un genre qui fixe sa douleur, son saignement et sa cicatrice. Le corps humain compte {parts} parties, chacune avec ses points de vie.',
      values: [code('parts', 'Parties du corps humain', HUMAN_BODY.length, sim('body-definition.ts', 'HUMAN_BODY'))],
      tables: [
        table('blessures', 'Genres de blessure', ['Blessure', 'Douleur', 'Saignement', 'Cicatrice'],
          Object.values(INJURY_RULES).map(r => [r.label, r.painUnits, r.bleedUnits, r.scar ? 'oui' : 'non']), sim('injury-rules.ts', 'INJURY_RULES')),
        table('corps', 'Parties du corps (vingt premières)', ['Partie', 'Points de vie', 'Exposition'],
          HUMAN_BODY.slice(0, 20).map(p => [p.label, p.hp, p.coverage]), sim('body-definition.ts', 'HUMAN_BODY')),
      ],
      fidelity: 'core', notes: ['docs/development/injuries.md', 'docs/development/body.md', 'docs/gameplay/health-fidelity-v317.md'], related: ['guerison', 'capacites', 'combat.armure'],
    }),
    rule(H, {
      id: 'guerison', title: 'Guérison',
      text: 'Tous les {interval} tics locaux, une blessure au hasard guérit de {standing} millièmes de point de vie debout, {lying} couché, plus le bonus du lit (quatre par jour, dix pour un lit d’hôpital). Une blessure soignée guérit en plus de {tendBase} plus la qualité du soin.',
      values: [
        code('interval', 'Intervalle', HEAL_INTERVAL, sim('injury-rules.ts', 'HEAL_INTERVAL'), 'tics'),
        pinned('standing', 'Debout', 80, sim('injury-evolution.ts', 'advanceMedical'), "posture==='standing'?80:120"),
        pinned('lying', 'Couché', 120, sim('injury-evolution.ts', 'advanceMedical'), "posture==='standing'?80:120"),
        pinned('tendBase', 'Base du soin', 40, sim('injury-evolution.ts', 'advanceMedical'), '(40+Math.min(1000,injury.tended!)*.08)'),
      ],
      fidelity: 'core', notes: ['docs/development/injuries.md', 'docs/gameplay/hospital-support-v276.md'], related: ['blessures', 'soins'],
    }),
    rule(H, {
      id: 'capacites', title: 'Capacités et chute',
      text: 'Une personne tombe au sol quand sa douleur atteint {shock} ({wimp} pour un Douillet), quand sa conscience passe sous {awake} ou quand son mouvement ne dépasse pas {moving}.',
      values: [
        code('shock', 'Seuil de choc', PAIN_SHOCK_THRESHOLD_362, sim('trait-links-362.ts', 'PAIN_SHOCK_THRESHOLD_362')),
        code('wimp', 'Seuil d’une Mauviette', WIMP_PAIN_SHOCK_THRESHOLD_362, sim('trait-links-362.ts', 'WIMP_PAIN_SHOCK_THRESHOLD_362')),
        pinned('awake', 'Conscience minimale', 0.3, sim('body-capacities.ts', 'calculate'), 'canBeAwake=consciousness>=.3'),
        pinned('moving', 'Mouvement minimal', 0.15, sim('body-capacities.ts', 'calculate'), 'movingCapable:moving>.15'),
      ],
      fidelity: 'core', notes: ['docs/development/body.md'], related: ['blessures'],
    }),
    rule(H, {
      id: 'soins', title: 'Soins et médicaments',
      text: 'La qualité d’un soin vaut la compétence médicale du soignant multipliée par la puissance du médicament, plus le bonus d’un lit d’hôpital, bornée par la qualité maximale du médicament, puis tirée à plus ou moins {spread} près. Se soigner soi-même la multiplie par {self}.',
      values: [
        pinned('spread', 'Écart aléatoire', 0.25, sim('medicine-rules.ts', 'tendQuality'), '+random*.5-.25'),
        pinned('self', 'Facteur pour soi', 0.7, sim('medicine-rules.ts', 'tendQuality'), '(self?.7:1)'),
      ],
      tables: [table('medicaments', 'Médicaments', ['Médicament', 'Puissance', 'Qualité maximale'],
        [['Sans médicament', 0.3, 0.7], ...Object.entries(MEDICINES).map(([id, m]) => [itemLabel(id), m.potency, m.maxQuality])], sim('medicine-rules.ts', 'MEDICINES'))],
      fidelity: 'core', notes: ['docs/development/tending.md', 'docs/development/medicines.md'], related: ['guerison', 'maladies'],
    }),
    rule(H, {
      id: 'maladies', title: 'Maladies immunisantes',
      text: 'La gravité d’une maladie monte chaque jour ; l’immunité aussi. Une fois l’immunité pleine, la gravité redescend. Un soin fait baisser la gravité selon sa qualité. Une blessure peut s’infecter : le délai est tiré entre {min} et {max} heures.',
      values: [
        code('min', 'Délai minimal d’infection', INFECTION_DELAY_MIN_CORE / CORE_HOUR, sim('infection-rules.ts', 'INFECTION_DELAY_MIN_CORE')),
        code('max', 'Délai maximal d’infection', INFECTION_DELAY_MAX_CORE / CORE_HOUR, sim('infection-rules.ts', 'INFECTION_DELAY_MAX_CORE')),
      ],
      tables: [table('maladies', 'Maladies', ['Maladie', 'Gravité par jour', 'Gravité par jour, immunisé', 'Immunité par jour', 'Baisse par soin et par jour'],
        Object.entries(IMMUNE_DISEASE_DEFINITIONS).map(([id, d]) => [diseaseLabels[id] ?? id, d.severityPerDay, d.severityPerDayImmune, d.immunityPerDay, d.tendedPerDay]), sim('immune-diseases-rules.ts', 'IMMUNE_DISEASE_DEFINITIONS'))],
      fidelity: 'core', notes: ['docs/gameplay/immune-diseases-v272.md', 'docs/gameplay/sleeping-sickness-v309.md', 'docs/development/infections.md'], related: ['soins', 'monde.biomes'],
    }),
    rule(H, {
      id: 'chirurgie', title: 'Chirurgie et prothèses',
      text: 'Une opération demande {work} tics de travail du jeu de base. Sa réussite vaut la chance du médecin multipliée par le lit, la pièce et le médicament, au plus {max}. Un échec est catastrophique {catastrophic} fois sur un ; sinon il peut être ridicule.',
      values: [
        code('work', 'Travail d’une opération', SURGERY_WORK, sim('surgery-rules.ts', 'SURGERY_WORK')),
        pinned('max', 'Réussite maximale', 0.98, sim('surgery-rules.ts', 'surgerySuccessChance'), 'Math.min(.98,'),
        pinned('catastrophic', 'Part d’échecs catastrophiques', 0.45, sim('surgery-outcomes.ts', 'resolveSurgeryOutcome'), "draw()<.45?'catastrophic'"),
      ],
      tables: [
        table('parties-artificielles', 'Parties artificielles', ['Partie', 'Efficacité'], Object.values(ARTIFICIAL_PARTS).map(p => [p.label, p.efficiency]), sim('artificial-parts-rules.ts', 'ARTIFICIAL_PARTS')),
        table('protheses', 'Prothèses industrielles', ['Prothèse', 'Efficacité', 'Travail'], Object.values(PROSTHETIC_DEFINITIONS_273).map(p => [p.label, p.efficiency, p.work]), sim('prosthetic-content-273.ts', 'PROSTHETIC_DEFINITIONS_273')),
      ],
      fidelity: 'core', notes: ['docs/development/surgery-v192.md', 'docs/gameplay/industrial-prostheses-v449.md', 'docs/gameplay/wooden-prostheses-v275.md'], related: ['soins'],
    }),
    rule(H, {
      id: 'exposition', title: 'Hypothermie, coup de chaleur et malnutrition',
      text: 'Au-delà de dix degrés hors de la plage de confort, l’hypothermie ou le coup de chaleur s’aggrave ; dans la plage, il régresse. La malnutrition monte à faim nulle et passe par plusieurs stades.',
      tables: [
        table('chaleur', 'Stades du coup de chaleur', ['Stade'], HEAT_LABELS.map(label => [label]), sim('heat-severity.ts', 'HEAT_LABELS')),
        table('malnutrition', 'Stades de malnutrition', ['Stade'], MALNUTRITION_LABELS.map(label => [label]), sim('malnutrition.ts', 'MALNUTRITION_LABELS')),
      ],
      sources: [sim('heat-severity.ts', 'nextHeatSeverity'), sim('cold-rules.ts', 'nextColdSeverity')],
      fidelity: 'core', notes: ['docs/development/malnutrition.md', 'docs/gameplay/clinical-survival-v362.md'], related: ['besoins.temperature', 'besoins.nourriture'],
    }),
    rule(H, {
      id: 'intoxication', title: 'Intoxication alimentaire',
      text: 'Une personne intoxiquée vomit et souffre pendant environ un jour ; les chances viennent de la cuisine (voir Nourriture).',
      sources: [sim('food-poisoning.ts', 'foodPoisoningStage')],
      fidelity: 'core', notes: ['docs/development/food-poisoning.md'], related: ['nourriture.intoxication'],
    }),
  ],
};

const K = 'combat';
const RANGED: readonly RangedWeaponItem[] = ['revolver', 'bolt-action-rifle', 'pump-shotgun', 'short-bow', 'recurve-bow', 'greatbow', 'autopistol', 'machine-pistol', 'chain-shotgun', 'heavy-smg', 'lmg', 'assault-rifle', 'sniper-rifle', 'emp-launcher'];
export const RULES_RANGED_WEAPONS = RANGED;
export const COMBAT_DOMAIN: RuleDomain = {
  id: K, label: 'Combat', coverage: 'partial',
  missing: ['Couverture et angle de tir en détail', 'Pièges, tourelles et mortiers', 'Outils de mêlée de chaque arme'],
  summary: 'Tir, mêlée, armures et dégâts.',
  rules: [
    rule(K, {
      id: 'tir', title: 'Précision du tir',
      text: 'La précision par case d’un tireur vient de son niveau de Tir, de sa vue et de sa manipulation ; elle est élevée à la puissance de la distance, puis multipliée par la précision de l’arme à cette distance, la météo et la couverture de la cible.',
      tables: [
        table('precision-tireur', 'Précision par case (tireur sain)', ['Niveau de Tir', 'Précision par case'],
          [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map(level => [level, shootingAccuracy(level, 1, 1).perCell]), sim('ranged-statistics.ts', 'shootingAccuracy')),
        table('armes-distance', 'Armes à distance (qualité normale)', ['Arme', 'Dégâts', 'Pénétration', 'Portée', 'Précision proche', 'Précision lointaine', 'Visée (tics du jeu de base)', 'Recharge (tics du jeu de base)'],
          RANGED.map(item => { const p = rangedWeaponProfile(item, 'normal')!; return [itemLabel(item), p.damage, p.armorPenetration, p.range, p.accuracy[1], p.accuracy[3], p.warmupCoreTicks, p.cooldownCoreTicks]; }), sim('ranged-statistics.ts', 'rangedWeaponProfile')),
      ],
      fidelity: 'core', notes: ['docs/development/shooting.md', 'docs/gameplay/combat-fidelity-v318.md', 'docs/gameplay/guns-v342.md', 'docs/gameplay/bows-v326.md'], related: ['qualite', 'armure', 'climat.meteo'],
    }),
    rule(K, {
      id: 'qualite', title: 'Qualité des armes',
      text: 'La qualité d’une arme multiplie sa précision (de {accMin} à {accMax}) et ses dégâts (de {dmgMin} à {dmgMax}).',
      values: [
        pinned('accMin', 'Précision, affreuse', 0.8, sim('ranged-statistics.ts', 'accuracyFactors'), 'accuracyFactors=[.8,.9,1,1.1,1.2,1.35,1.5]'),
        pinned('accMax', 'Précision, légendaire', 1.5, sim('ranged-statistics.ts', 'accuracyFactors'), 'accuracyFactors=[.8,.9,1,1.1,1.2,1.35,1.5]'),
        pinned('dmgMin', 'Dégâts, affreuse', 0.9, sim('ranged-statistics.ts', 'damageFactors'), 'damageFactors=[.9,1,1,1,1,1.25,1.5]'),
        pinned('dmgMax', 'Dégâts, légendaire', 1.5, sim('ranged-statistics.ts', 'damageFactors'), 'damageFactors=[.9,1,1,1,1,1.25,1.5]'),
      ],
      tables: [table('qualites', 'Revolver selon la qualité', ['Qualité', 'Dégâts', 'Précision proche'],
        WEAPON_QUALITIES.map(q => { const p = rangedWeaponProfile('revolver', q)!; return [QUALITY_LABELS[q], p.damage, p.accuracy[1]]; }), sim('equipment-rules.ts', 'WEAPON_QUALITIES'))],
      fidelity: 'core', notes: ['docs/development/shooting.md'], related: ['tir'],
    }),
    rule(K, {
      id: 'melee', title: 'Mêlée',
      text: 'La chance de toucher et d’esquiver au corps à corps dépend du niveau de Mêlée. Les dégâts d’un coup varient de plus ou moins vingt pour cent. Un coup contondant à la tête ou au torse peut étourdir {stun} tics du jeu de base ; une balle à fort arrêt fait chanceler {stagger} tics.',
      values: [
        code('stun', 'Étourdissement contondant', meleeStunCore318(Number.MAX_SAFE_INTEGER), sim('stun.ts', 'meleeStunCore318')),
        code('stagger', 'Chancellement', BULLET_STAGGER_CORE_TICKS, sim('stagger.ts', 'BULLET_STAGGER_CORE_TICKS')),
      ],
      tables: [
        table('melee', 'Toucher et esquive (combattant sain)', ['Niveau de Mêlée', 'Toucher', 'Esquive'],
          [0, 4, 8, 12, 16, 20].map(level => [level, meleeHitChance(level), meleeDodgeChance(level)]), sim('melee-statistics.ts', 'meleeHitChance')),
        table('masses', 'Masses selon le matériau', ['Matériau', 'Facteur contondant', 'Facteur de recharge'],
          Object.entries(MACE_DEFINITIONS_269).map(([id, m]) => [itemLabel(id), m.bluntMultiplier, m.cooldownMultiplier]), sim('mace-content-269.ts', 'MACE_DEFINITIONS_269')),
        table('epees', 'Épées longues selon le matériau', ['Matériau', 'Facteur tranchant'],
          Object.entries(LONGSWORD_DEFINITIONS_270).map(([id, m]) => [itemLabel(id), m.sharpMultiplier]), sim('longsword-content-270.ts', 'LONGSWORD_DEFINITIONS_270')),
      ],
      fidelity: 'core', notes: ['docs/development/melee.md', 'docs/gameplay/combat-fidelity-v318.md', 'docs/gameplay/maces-v445.md', 'docs/gameplay/longswords-v446.md'], related: ['armure'],
    }),
    rule(K, {
      id: 'armure', title: 'Armure',
      text: 'Chaque couche de vêtement est testée de l’extérieur vers l’intérieur, puis l’armure naturelle. L’armure utile vaut l’armure moins la pénétration : un tirage sous {deflect} fois cette armure dévie le coup, sous sa totalité il divise les dégâts par deux et les rend contondants. Chaque vêtement touché perd {wear} des dégâts en points de vie.',
      values: [
        pinned('deflect', 'Déviation', 0.5, sim('armor.ts', 'resolveArmor'), 'roll < effective / 2'),
        pinned('wear', 'Usure', 0.25, sim('armor.ts', 'resolveArmor'), 'amount / 4'),
      ],
      tables: [table('armure-tissus', 'Matières des vêtements', ['Matière', 'Tranchant', 'Contondant', 'Chaleur', 'Isolation au froid'],
        Object.values(APPAREL_MATERIAL_DEFINITIONS).map(m => [m.label, m.armor.sharp, m.armor.blunt, m.armor.heat, m.coldInsulation]), sim('apparel-definitions.ts', 'APPAREL_MATERIAL_DEFINITIONS'))],
      fidelity: 'core', notes: ['docs/development/armor.md', 'docs/gameplay/natural-armor-v321.md'], related: ['tir', 'melee', 'sante.blessures'],
    }),
  ],
};

const W = 'climat';
export const CLIMATE_DOMAIN: RuleDomain = {
  id: W, label: 'Température, météo et feu', coverage: 'partial',
  missing: ['Échanges de chaleur entre pièces en détail', 'Neige et dégel', 'Éclipse, aurore et éruption solaire'],
  summary: 'Température extérieure et des pièces, météo, vagues de froid ou de chaleur, incendies.',
  rules: [
    rule(W, {
      id: 'temperature-exterieure', title: 'Température extérieure',
      text: 'La température suit la saison selon la latitude, plus une oscillation quotidienne de {daily} degrés autour de la moyenne. Une vague de chaleur ajoute jusqu’à {heat} degrés, une vague de froid {cold} (une au plus tous les {coldCooldown} jours), un hiver volcanique {volcanic}.',
      values: [
        pinned('daily', 'Amplitude quotidienne', 7, sim('site-climate.ts', 'seasonalOutdoorTemperature'), '+7*Math.cos(2*Math.PI*(civil%TICKS_PER_DAY/TICKS_PER_DAY+.32))'),
        pinned('heat', 'Vague de chaleur', 17, sim('heatwave.ts', 'heatwaveOffset'), '17*Math.max(0,Math.min(1,(tick-a.start)/1200'),
        code('cold', 'Vague de froid', COLD_SNAP_MAX_OFFSET, sim('cold-snap.ts', 'COLD_SNAP_MAX_OFFSET')),
        code('coldCooldown', 'Délai entre deux vagues de froid', days(COLD_SNAP_COOLDOWN), sim('cold-snap.ts', 'COLD_SNAP_COOLDOWN')),
        code('volcanic', 'Hiver volcanique', VOLCANIC_WINTER_TEMPERATURE310, sim('volcanic-winter-state-310.ts', 'VOLCANIC_WINTER_TEMPERATURE310')),
      ],
      tables: [table('climats', 'Climats de référence', ['Climat', 'Moyenne (°C)', 'Pluie (mm par an)', 'Latitude'],
        Object.entries(CLIMATE_DEFINITIONS).map(([id, c]) => [id, c.meanTemperature, c.rainfall, c.latitude]), sim('site-climate.ts', 'CLIMATE_DEFINITIONS'))],
      fidelity: 'core', notes: ['docs/development/temperature.md', 'docs/development/site-climate.md', 'docs/gameplay/climate-incidents-v265.md', 'docs/gameplay/volcanic-winter-v310.md'], related: ['pieces', 'temps.calendrier', 'plantes.croissance'],
    }),
    rule(W, {
      id: 'pieces', title: 'Température des pièces',
      text: 'Chaque pièce échange sa chaleur avec l’extérieur selon sa part sans toit et avec ses voisines à travers murs et portes. Un radiateur chauffe moins à mesure que la pièce approche de {heaterMax} °C ; un climatiseur déplace la chaleur d’un côté vers l’autre.',
      values: [pinned('heaterMax', 'Arrêt du radiateur', 120, sim('heater.ts', 'applyHeaterHeat'), '(120-room.temperature)/100')],
      sources: [sim('temperature.ts', 'advanceTemperature'), sim('cooler.ts', 'newCoolerState')],
      fidelity: 'adaptation', fidelityNote: 'La moyenne de tous les murs remplace l’échantillon aléatoire du jeu de base.', notes: ['docs/development/temperature.md', 'docs/gameplay/vent-v383.md'], related: ['temperature-exterieure', 'energie.consommation'],
    }),
    rule(W, {
      id: 'meteo', title: 'Météo',
      text: 'Le temps est tiré au poids, corrigé par les précipitations du lieu et filtré par la température ; il dure de quelques heures à plusieurs jours et se mêle au précédent pendant {blend} tics du jeu de base. Il ralentit la marche et gêne la visée à découvert.',
      values: [pinned('blend', 'Transition', 4000, sim('weather.ts', 'weatherTransition'), 'ageCore/4000')],
      tables: [table('meteo', 'Temps possibles', ['Temps', 'Poids', 'Facteur de marche', 'Facteur de visée', 'Orage'],
        Object.values(WEATHER).map(w => [w.label, w.weight, w.movement, w.accuracy, w.storm ? 'oui' : 'non']), sim('weather-definitions.ts', 'WEATHER'))],
      fidelity: 'core', notes: ['docs/development/weather-precipitation-v166.md'], related: ['combat.tir', 'deplacement.marche'],
    }),
    rule(W, {
      id: 'feu', title: 'Incendies',
      text: 'Un feu mesure entre {min} et {max}. Il est examiné tous les {pulse} tics du jeu de base : il brûle ce qui l’entoure, grossit selon le combustible et, au-delà de la taille un, se propage à une case voisine ou par une braise. L’intervalle de propagation va de cent cinquante tics du jeu de base à {fastest} pour un grand feu. La pluie et les pompiers l’éteignent.',
      values: [
        code('min', 'Taille minimale', FIRE_MIN_SIZE, sim('fire-rules.ts', 'FIRE_MIN_SIZE')),
        code('max', 'Taille maximale', FIRE_MAX_SIZE, sim('fire-rules.ts', 'FIRE_MAX_SIZE')),
        code('pulse', 'Intervalle d’examen', FIRE_COMPLEX_CORE, sim('fire-rules.ts', 'FIRE_COMPLEX_CORE')),
        code('fastest', 'Propagation la plus rapide', fireSpreadInterval(FIRE_MAX_SIZE), sim('fire-rules.ts', 'fireSpreadInterval')),
      ],
      fidelity: 'core', notes: ['docs/development/fires.md', 'docs/gameplay/firefoam-v469.md'], related: ['energie.court-circuit'],
    }),
    rule(W, {
      id: 'retombees', title: 'Retombées toxiques',
      text: 'Les retombées toxiques ne peuvent survenir qu’après le jour {first} et au plus une fois tous les {cooldown} jours ; elles empoisonnent les personnes et les plantes à découvert.',
      values: [
        code('first', 'Premier jour possible', TOXIC_FALLOUT_FIRST_DAY294, sim('toxic-fallout-state-294.ts', 'TOXIC_FALLOUT_FIRST_DAY294')),
        code('cooldown', 'Délai', TOXIC_FALLOUT_COOLDOWN_DAYS294, sim('toxic-fallout-state-294.ts', 'TOXIC_FALLOUT_COOLDOWN_DAYS294')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/toxic-fallout-v481.md'], related: ['conteur.divers'],
    }),
  ],
};

const E = 'energie';
const consumers = Object.keys(STRUCTURE_DEFINITIONS).filter(kind => isPowerTrader(kind))
  .map(kind => [kind, powerDemand({ kind, heater: { high: true }, cooler: { high: true } } as unknown as Structure)] as [string, number])
  .filter(([, watts]) => watts > 0);
export const POWER_DOMAIN: RuleDomain = {
  id: E, label: 'Électricité', coverage: 'partial',
  missing: ['Délestage et redémarrage en détail', 'Éruption solaire'],
  summary: 'Générateurs, batteries, consommateurs, pannes et courts-circuits.',
  rules: [
    rule(E, {
      id: 'production', title: 'Production',
      text: 'Un générateur à bois ou à carburant donne {fuel} W, un panneau solaire jusqu’à {solar} W selon la lumière et les cases à découvert, une éolienne {wind} W au vent nominal, une centrale géothermique {geo} W. Un bâtiment se raccorde à un conducteur à {range} cases au plus.',
      values: [
        code('fuel', 'Générateur', POWER_OUTPUT, sim('power-rules.ts', 'POWER_OUTPUT'), 'W'),
        code('solar', 'Solaire', SOLAR_MAX_OUTPUT, sim('solar-rules.ts', 'SOLAR_MAX_OUTPUT'), 'W'),
        code('wind', 'Éolien', WIND_RATED_OUTPUT, sim('wind-rules.ts', 'WIND_RATED_OUTPUT'), 'W'),
        code('geo', 'Géothermie', GEOTHERMAL_POWER_WATTS_264, sim('geothermal-state-264.ts', 'GEOTHERMAL_POWER_WATTS_264'), 'W'),
        code('range', 'Portée de raccordement', CONNECTION_RANGE, sim('power-rules.ts', 'CONNECTION_RANGE')),
      ],
      fidelity: 'core', notes: ['docs/development/power.md', 'docs/development/wind-heater.md', 'docs/gameplay/geothermal-power-v440.md'], related: ['batteries', 'consommation'],
    }),
    rule(E, {
      id: 'consommation', title: 'Consommation',
      text: 'Chaque appareil branché consomme une puissance fixe tant qu’il est allumé.',
      tables: [table('consommateurs', 'Consommateurs', ['Appareil', 'Puissance (W)'], sorted(consumers, c => c[0]), sim('power-rules.ts', 'powerDemand'))],
      fidelity: 'core', notes: ['docs/development/power.md'], related: ['production'],
    }),
    rule(E, {
      id: 'batteries', title: 'Batteries',
      text: 'Une batterie stocke {capacity} watts-jours. Un surplus la charge avec un rendement de moitié ; chaque batterie perd {leak} W en continu.',
      values: [
        code('capacity', 'Capacité', BATTERY_CAPACITY / BATTERY_ENERGY_SCALE, sim('power-battery.ts', 'BATTERY_CAPACITY')),
        code('leak', 'Fuite', BATTERY_LEAK_PER_CORE_TICK * CORE_DAY / BATTERY_ENERGY_SCALE, sim('power-battery.ts', 'BATTERY_LEAK_PER_CORE_TICK'), 'W'),
      ],
      fidelity: 'core', notes: ['docs/development/power.md'], related: ['production', 'court-circuit'],
    }),
    rule(E, {
      id: 'pannes', title: 'Pannes',
      text: 'Un appareil sujet aux pannes tombe en panne en moyenne une fois tous les {mtb} jours ; un colon le répare avec un composant.',
      values: [code('mtb', 'Délai moyen', BREAKDOWN_MTB_CORE_TICKS / CORE_DAY, sim('breakdowns.ts', 'BREAKDOWN_MTB_CORE_TICKS'), 'jours')],
      fidelity: 'core', notes: ['docs/development/breakdown-v144.md'], related: ['consommation'],
    }),
    rule(E, {
      id: 'court-circuit', title: 'Court-circuit',
      text: 'Un court-circuit vide toutes les batteries du réseau en une explosion de flammes si l’une d’elles contient plus de {energy} watts-jours ; sinon il allume un petit feu près du conducteur. Il ne revient pas avant {cooldown} jours.',
      values: [
        pinned('energy', 'Énergie déclenchant l’explosion', 20, sim('short-circuit.ts', 'resolveSelectedShortCircuit'), 'batteryWattDays(s.battery!)>20'),
        code('cooldown', 'Délai', days(SHORT_CIRCUIT_COOLDOWN), sim('short-circuit.ts', 'SHORT_CIRCUIT_COOLDOWN')),
      ],
      fidelity: 'core', notes: ['docs/gameplay/short-circuit-v266.md'], related: ['batteries', 'climat.feu'],
    }),
  ],
};

