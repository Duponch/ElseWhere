import {isConduitKind} from '../sim/conduit-kinds-382.ts';
import { PowerTopologyCache, connectedPowerGroups } from '../sim/power-topology';
import { isElectrical, isPowerActive, isPowerTrader, powerWatts, powerDemand } from '../sim/power-rules';
import { batteryWattDays } from '../sim/power-battery';
import { solarUnroofedCells } from '../sim/solar-rules';
import { annualNaturalLight } from '../sim/environment';
import { windIntensity, windObstructions } from '../sim/wind-rules';
import { temperatureAt } from '../sim/temperature';
import { sunLampActive, sunLampScheduled } from '../sim/sun-lamp';
import { activeEclipse } from '../sim/eclipse';
import { isRainElectricalKind, rainElectricalEligible } from '../sim/rain-electric';
import { isRoofed } from '../sim/roof-rules';
import { deepDrillingInspection } from './deep-drilling-inspection';
import { orbitalInspection } from './orbital-inspection';
import { nutrientPasteInspection } from './nutrient-paste-inspection';
import { FUEL_UNIT_TICKS, fuelLimit } from '../sim/fuel';
import type { Structure, World } from '../sim/types';

const cache = new PowerTopologyCache();
const watts = (n: number) => `${n.toLocaleString('fr-FR', {maximumFractionDigits: 1})} W`;

export function biofuelPowerInspection(world:World,structure:Structure):string {
  if(structure.kind==='biofuel-refinery'){
    const state=structure.breakdown?'En panne':structure.power?.switchOn===false?'Arrêt manuel':isPowerActive(structure)?'Alimentée':'Sans alimentation';
    return `${state} · 170 W · Factures : 70 bois ou 3,5 nutrition d’aliments crus → 35 biocarburants · travail Artisanat sur place · filtre organique initial végétal, viandes et lait au choix`;
  }
  if(structure.kind!=='chemfuel-generator')return '';
  const state=structure.breakdown?'En panne':structure.power?.switchOn===false?'Arrêt manuel':!structure.fuel?.ticks?'Réservoir vide':isPowerActive(structure)?'En marche':'Démarrage en attente';
  const reserve=(structure.fuel?.ticks??0)/FUEL_UNIT_TICKS;
  return `${state} · Production ${watts(Math.max(0,powerWatts(structure,world)))} / 1 000 W · Réservoir ${reserve.toLocaleString('fr-FR',{maximumFractionDigits:2})} / ${fuelLimit(structure.kind)/FUEL_UNIT_TICKS} biocarburants · 4,5 unités/jour · débit arrêté par le commutateur ou une panne · EMP : production suspendue, combustible consommé · ravitaillement avec le biocarburant réellement porté · chaleur et faible lumière locale en marche`;
}

export function geothermalPowerInspection(world:World,structure:Structure):string {
  if(structure.kind!=='geothermal-generator')return '';
  const state=structure.breakdown?'En panne':structure.emp&&structure.emp.untilCore>world.tick*10?'Neutralisée par EMP':isPowerActive(structure)?'En marche':'Démarrage en attente';
  return `${state} · Production ${watts(Math.max(0,powerWatts(structure,world)))} / 3 600 W · constante jour et nuit, même sous toit · sans combustible · centrale fixe sur son geyser · vapeur et chaleur intermittentes, indépendantes du courant, des pannes et des EMP · risque de surchauffe dans une pièce fermée · isoler le réseau avec un interrupteur de circuit`;
}

export function hydroponicsPowerInspection(structure:Structure):string {
  if(structure.kind!=='hydroponics-basin')return '';
  const state=structure.breakdown?'Pompe en panne':structure.power?.switchOn===false?'Pompe arrêtée manuellement':isPowerActive(structure)?'Pompe alimentée':'Pompe sans alimentation';
  return `${state} · 70 W continus, même la nuit · Fertilité 280 %${isPowerActive(structure)?' · semis autorisés selon température et accès · lumière nécessaire à la croissance':' · nouveaux semis suspendus · plantes endommagées progressivement, sans mort instantanée'} · Rétablir le courant ne répare pas les dégâts déjà subis`;
}

/** The condition does not override the confirmed trader or its physical switch. */
export function solarFlareInspection(world:World,structure:Structure):string {
  if(!world.worldIncidents?.active||!isElectrical(structure.kind))return '';
  if(structure.kind==='battery')return 'Éruption solaire : charge et décharge du réseau suspendues · réserve conservée · autodécharge normale de 5 W·j/jour';
  if(['ship-reactor','wood-generator','chemfuel-generator','geothermal-generator','solar-generator','wind-turbine'].includes(structure.kind))return `Éruption solaire : source ${isPowerActive(structure)?'toujours active':'actuellement arrêtée'} · potentiel de production conservé${(structure.kind==='wood-generator'||structure.kind==='chemfuel-generator')&&isPowerActive(structure)?` · le ${structure.kind==='wood-generator'?'bois':'biocarburant'} continue de brûler`:''} · stockage du surplus suspendu`;
  if(!isPowerTrader(structure.kind))return 'Éruption solaire : connexions et interrupteurs physiques conservés';
  const cause=structure.breakdown?'panne mécanique distincte':structure.power?.switchOn===false?'arrêt manuel distinct':structure.power?.parentId===null?'absence de raccordement distincte':isPowerActive(structure)?'encore alimenté avant son délestage':'actuellement sans alimentation · redémarrage suspendu';
  return `Éruption solaire : ${cause} · arrêt progressif des consommateurs${structure.kind==='electric-tailor-bench'&&!isPowerActive(structure)?' · couture manuelle possible à vitesse réduite (50 %)':''}`;
}

/** Snapshot projection only: requesting a switch or roof does not protect it. */
export function rainElectricalInspection(world: World, structure: Structure): string {
  if (world.schemaVersion < 181 || !isRainElectricalKind(structure.kind)) return '';
  if (isRoofed(world, structure.z * world.width + structure.x)) return 'Précipitations : protégé par le toit au-dessus de son ancrage';
  if (structure.kind === 'battery') return rainElectricalEligible(world, structure)
    ? 'Précipitations : batterie exposée et chargée au-delà de 100 W·j · risque de décharge et d’incendie · protéger son ancrage par un toit'
    : 'Précipitations : batterie exposée, charge de 100 W·j ou moins · sans risque de décharge à cette charge';
  return rainElectricalEligible(world, structure)
    ? 'Précipitations : appareil exposé et alimenté · risque de décharge et d’incendie · construire un toit ou demander son arrêt physique'
    : 'Précipitations : appareil exposé, actuellement arrêté ou sans alimentation · risque s’il se remet en marche';
}

export function powerInspection(world: World, structure: Structure, compact=false): string {
  if (!isElectrical(structure.kind) || !structure.power) return '';
  if (compact && structure.breakdown) return ` · Panne mécanique${geothermalPowerInspection(world,structure)?` · ${geothermalPowerInspection(world,structure)}`:''}${biofuelPowerInspection(world,structure)?` · ${biofuelPowerInspection(world,structure)}`:''}${nutrientPasteInspection(world,structure)?` · ${nutrientPasteInspection(world,structure)}`:''}${orbitalInspection(world,structure)?` · ${orbitalInspection(world,structure)}`:''}${deepDrillingInspection(world,structure)?` · ${deepDrillingInspection(world,structure)}`:''}${hydroponicsPowerInspection(structure)?` · ${hydroponicsPowerInspection(structure)}`:''}${solarFlareInspection(world,structure)?` · ${solarFlareInspection(world,structure)}`:''}${rainElectricalInspection(world, structure) ? ` · ${rainElectricalInspection(world, structure)}` : ''}.`;
  const topology = cache.read(world);
  const group = connectedPowerGroups(world, topology).find(g => g.some(s => s.id === structure.id));
  const supply = group?.reduce((n, s) => n + Math.max(0, powerWatts(s, world)), 0) ?? 0;
  const used = group?.reduce((n, s) => n - Math.min(0, powerWatts(s, world)), 0) ?? 0;
  const required = group?.reduce((n, s) => n + (s.power?.switchOn === false || s.breakdown || s.kind === 'sun-lamp' && !sunLampScheduled(world) ? 0 : powerDemand(s)), 0) ?? 0;
  const batteries = group?.filter(s => s.battery) ?? [];
  const stored = batteries.reduce((n, s) => n + batteryWattDays(s.battery!), 0);
  let detail: string;
  if(structure.kind==='electric-crematorium'){
    const state=structure.breakdown?'En panne':structure.power?.switchOn===false?'Arrêt manuel':isPowerActive(structure)?'Alimenté':'Sans alimentation';
    detail=`${state} · 250 W · Transport sur place · détruit une dépouille autorisée et les possessions encore attachées · aucune sortie · chaleur et lumière orange en marche`;
  } else if(structure.kind==='electric-smelter'){
    const state=structure.breakdown?'En panne':structure.power?.switchOn===false?'Arrêt manuel':isPowerActive(structure)?'Alimentée':'Sans alimentation';
    detail=`${state} · 700 W · Artisanat sur place · détruit une arme autorisée par la facture · récupère 25 % des métaux, aucun composant · chaleur et lumière orange en marche`;
  } else if(structure.kind==='biofuel-refinery'||structure.kind==='chemfuel-generator'){
    detail=biofuelPowerInspection(world,structure);
  } else if(structure.kind==='nutrient-paste-dispenser'){
    detail=nutrientPasteInspection(world,structure);
  } else if(structure.kind==='orbital-beacon'||structure.kind==='comms-console'){
    detail=orbitalInspection(world,structure);
  } else if(structure.kind==='deep-drill'||structure.kind==='ground-scanner'){
    detail=deepDrillingInspection(world,structure);
  } else if (structure.kind === 'hydroponics-basin') {
    detail=hydroponicsPowerInspection(structure);
  } else if (structure.kind === 'ship-reactor') {
    detail='Production électrique : 1 000 W · disponible dès la construction, indépendamment du démarrage stellaire';
  } else if (structure.kind === 'ship-cryptosleep-casket' || structure.kind === 'ship-beam' || structure.kind === 'ship-engine') {
    detail='Transmission électrique passive · aucune consommation propre';
  } else if (structure.kind === 'geothermal-generator') {
    detail=geothermalPowerInspection(world,structure);
  } else if (structure.kind === 'solar-generator') {
    const open = solarUnroofedCells(world, structure);
    const light = annualNaturalLight(world);
    detail = `Production ${watts(Math.max(0, powerWatts(structure, world)))} / 1 700 W · ${open}/16 cases sans toit · lumière naturelle ${Math.round(light * 100)} %`;
    if (!open) detail += ' · Entièrement sous toit';
    else if (activeEclipse(world)) detail += ' · Éclipse : lumière solaire réduite';
    else if (light === 0) detail += ' · Nuit';
    else if (!structure.breakdown && !isPowerActive(structure)) detail += ' · Démarrage en attente';
  } else if (structure.kind === 'wind-turbine') {
    const obstacles = windObstructions(world, structure).length;
    detail = `Production ${watts(Math.max(0, powerWatts(structure, world)))} / 3 450 W · vent ${Math.round(windIntensity(world) * 100)} % · ${obstacles}/112 cases de dégagement obstruées`;
    if (obstacles) detail += ` · production réduite de ${Math.min(100, obstacles * 20)} % par les obstacles`;
    detail += ' · Les toits, rochers, arbres et bâtiments hauts gênent le vent. La coupe demande le travail réel d’un colon';
  } else if (structure.kind === 'heater') {
    const temperature = temperatureAt(world, structure);
    const state = structure.breakdown ? 'En panne' : structure.power.switchOn === false ? 'Arrêt manuel' : !isPowerActive(structure) ? 'Sans alimentation' : structure.heater?.high ? 'Chauffage' : 'Veille';
    detail = `Cible ${(structure.heater?.target ?? 21).toFixed(1)} °C · air ${temperature.toFixed(1)} °C · ${state} · demande ${watts(powerDemand(structure))} · chauffe l’air de la pièce fermée, sans refroidissement`;
  } else if (structure.kind === 'sun-lamp') {
    const scheduled = sunLampScheduled(world);
    const state = structure.breakdown ? 'En panne' : structure.power.switchOn === false ? 'Arrêt manuel' : !scheduled ? 'Repos des plantes (horaire)' : structure.power.parentId === null ? 'Non raccordée' : sunLampActive(world,structure) ? 'Allumée' : 'Alimentation en attente';
    detail = `${state} · 2 900 W en activité · horaire : après 06:00 et avant 19:12 · cultures sous toit dans la zone éclairée, selon le sol et la température · Survol : couverture prévue si alimentée`;
    const parent = structure.power.parentId === null ? undefined : topology.sources.get(structure.power.parentId);
    if (parent) detail += ` · raccordée au réseau en ${parent.x}, ${parent.z}`;
  } else if (structure.kind === 'battery') {
    detail = `Stockage ${batteryWattDays(structure.battery ?? {stored: 0}).toFixed(2)} / 600 W·j · rendement de charge 50 % · autodécharge 5 W${structure.breakdown ? ' · Batterie hors service' : ''}`;
  } else if (structure.kind === 'power-switch') {
    detail = structure.power.switchOn === false ? 'Interrupteur ouvert · liaison interrompue sur cette case' : 'Interrupteur fermé · liaison établie sur cette case';
  } else if (isConduitKind(structure.kind)) {
    detail = structure.kind==='hidden-conduit'?'Conducteur dissimulé · 100 PV · incombustible · protégé des attaques et des courts-circuits · aucun remboursement à la déconstruction':'Conducteur passif · transmet le courant entre cellules voisines · aucun remboursement à la déconstruction';
  } else {
    const off = structure.power.switchOn === false;
    const state = structure.breakdown ? 'En panne' : off ? 'Arrêt manuel' : structure.kind === 'wood-generator'
      ? !structure.fuel?.ticks ? 'Sans combustible' : isPowerActive(structure) ? 'En marche' : 'Démarrage en attente'
      : structure.power.parentId === null ? 'Non raccordée' : isPowerActive(structure) ? 'Allumée' : 'Alimentation en attente';
    detail = `${state} · ${structure.kind === 'wood-generator' ? `Production ${watts(Math.max(0, powerWatts(structure, world)))} · 22 bois/jour` : `Demande ${watts(powerDemand(structure))}`}`;
    const parent = structure.power.parentId === null ? undefined : topology.sources.get(structure.power.parentId);
    if (parent) detail += ` · raccordée au réseau en ${parent.x}, ${parent.z}`;
  }
  if (group) detail += ` · Réseau : ${watts(supply)} produits, ${watts(used)} utilisés (${watts(required)} demandés) · ${batteries.length ? `${stored.toFixed(2)} / ${batteries.length * 600} W·j stockés` : 'aucune batterie raccordée'}`;
  if(structure.breakdown)detail=`Panne mécanique : composant à remplacer par un colon en Construction (1 composant ordinaire, zone de foyer requise) · ${detail}`;
  if(structure.emp&&structure.emp.untilCore>world.tick*10)detail=`EMP : neutralisé encore ${((structure.emp.untilCore-world.tick*10)/60).toFixed(1).replace('.',',')} s${structure.kind==='battery'?' · réserve conservée, charge suspendue et réserve indisponible pour alimenter le réseau':''} · ${detail}`;
  const solar=solarFlareInspection(world,structure);if(solar)detail+=` · ${solar}`;
  const rain = rainElectricalInspection(world, structure);
  if (rain) detail += ` · ${rain}`;
  return ` · ${detail}.`;
}
