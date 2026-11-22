import type { Rule, RuleDomain } from './rules-types.ts';
import { MOOD_DOMAIN, NEEDS_DOMAIN, SKILLS_DOMAIN, TIME_DOMAIN, WORK_DOMAIN } from './domains/people.ts';
import { ANIMALS_DOMAIN, CONSTRUCTION_DOMAIN, FOOD_DOMAIN, MOVEMENT_DOMAIN, PLANTS_DOMAIN } from './domains/colony.ts';
import { CLIMATE_DOMAIN, COMBAT_DOMAIN, HEALTH_DOMAIN, POWER_DOMAIN } from './domains/danger.ts';
import { PRISON_DOMAIN, RESEARCH_DOMAIN, SAVES_DOMAIN, STORYTELLER_DOMAIN, TRADE_DOMAIN, WORLD_DOMAIN } from './domains/world.ts';

/** Every domain of the rules page, in reading order (docs/development/rules-page.md). */
export const RULE_DOMAINS: readonly RuleDomain[] = Object.freeze([
  TIME_DOMAIN, NEEDS_DOMAIN, MOOD_DOMAIN, SKILLS_DOMAIN, WORK_DOMAIN,
  MOVEMENT_DOMAIN, CONSTRUCTION_DOMAIN, PLANTS_DOMAIN, ANIMALS_DOMAIN, FOOD_DOMAIN,
  HEALTH_DOMAIN, COMBAT_DOMAIN, CLIMATE_DOMAIN, POWER_DOMAIN,
  RESEARCH_DOMAIN, TRADE_DOMAIN, STORYTELLER_DOMAIN, PRISON_DOMAIN, WORLD_DOMAIN, SAVES_DOMAIN,
]);

export const RULES: readonly Rule[] = Object.freeze(RULE_DOMAINS.flatMap(domain => domain.rules));
export const RULES_BY_ID: ReadonlyMap<string, Rule> = new Map(RULES.map(rule => [rule.id, rule]));

/** Parts of the game the page does not describe yet, shown at its top. */
export const UNDESCRIBED_DOMAINS: readonly { label: string; scope: string }[] = Object.freeze([
  { label: 'Vie sociale', scope: 'Conversations, opinions, relations, romance et couples, fêtes, bagarres.' },
  { label: 'Vêtements et équipement', scope: 'Politiques de tenue, usure, chaleur et froid des vêtements, armes portées.' },
  { label: 'Stockage et transport', scope: 'Zones de stockage, étagères, priorités de transport, réservations.' },
  { label: 'Production et factures', scope: 'Établis, factures, qualité des objets, art.' },
  { label: 'Visiteurs, quêtes et lettres', scope: 'Visiteurs et alliés, quêtes, lettres et alertes.' },
  { label: 'Fin de partie', scope: 'Vaisseau, réacteur, caissons et départ.' },
  { label: 'Cartes temporaires', scope: 'Camps, sites, établissements étrangers, rencontres de caravane.' },
  { label: 'Tutoriel et aide', scope: 'Leçons, conseils et assistant d’apprentissage.' },
]);
