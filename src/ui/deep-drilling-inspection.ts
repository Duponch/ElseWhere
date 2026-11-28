import { footprintCells } from '../sim/definitions';
import { deepBedrock,deepScannerOverlayPowered,nextDeepResource } from '../sim/deep-resources';
import { deepWorkInProgress } from '../sim/deep-drilling';
import { ITEM_DEFINITIONS } from '../sim/items';
import { powerWatts } from '../sim/power-rules';
import { isRoofed } from '../sim/roof-rules';
import type { Structure,World } from '../sim/types';

const percentage=(value:number)=>`${Math.round(Math.max(0,Math.min(1,value))*100)} %`;

/** Snapshot projection: neither discovers reserves nor promises that an
 * assigned worker has already reached the interaction cell. */
export function deepDrillingInspection(world:World,structure:Structure):string {
  if(structure.kind!=='deep-drill'&&structure.kind!=='ground-scanner')return '';
  const powered=powerWatts(structure,world)<0;
  const state=structure.breakdown?'En panne':structure.power?.switchOn===false?'Arrêt manuel':powered?'Alimenté':'Sans alimentation';
  const worker=world.pawns.find(p=>p.deepWork?.structureId===structure.id);
  const work=worker?` · ${worker.name} ${deepWorkInProgress(world,structure.id)?'travaille au contact':'rejoint le poste'}`:' · en attente d’un travailleur disponible et d’un accès';
  if(structure.kind==='ground-scanner'){
    const roofed=footprintCells(structure).some(c=>isRoofed(world,c.z*world.width+c.x));
    return `${state} · 700 W · ${!deepBedrock(world)?'Absence de socle rocheux':roofed?'Scanner bloqué : une partie de son empreinte est sous toit':'Empreinte sans toit'}${work}`+
      ` · Découverte garantie : ${percentage((structure.deepScanner?.daysWorking??0)/6)} du travail nécessaire`+
      ' · La progression dépend du temps réellement travaillé et de la vitesse de recherche ; elle ne mesure pas une probabilité'+
      ` · ${world.deepResources?.discoveries??0} découverte(s) sur la carte · les minerais restent souterrains jusqu’à leur extraction`;
  }
  const resource=nextDeepResource(world,structure);
  const reserve=resource?`Prochaine réserve : ${ITEM_DEFINITIONS[resource.item].label} · ${resource.count} unité(s) en ${resource.cell.x}, ${resource.cell.z}`:
    deepBedrock(world)?'Aucun minerai dans les 21 cases de portée · le forage de roche dépend du terrain et de l’accès':'Aucun minerai dans les 21 cases de portée · absence de socle rocheux';
  return `${state} · 200 W${work} · Portion en cours : ${percentage((structure.deepDrill?.progress??0)/10000)} · ${reserve}`+
    (deepScannerOverlayPowered(world)?' · Sélectionner la foreuse ou placer une foreuse pour voir les gisements':' · Alimenter un scanner de sol pour afficher les gisements')+
    ' · Réserves finies ; rendement selon le mineur, dépôt physique après extraction';
}
