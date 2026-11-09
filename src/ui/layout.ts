import {SETTLEMENT_LIMIT_CHOICES} from './settlement-limit-settings';
import {THREAT_PAUSE_CHOICES} from './threat-pause-settings';
import { allowedAreaLayout } from './allowed-area-controls';
import { SCENARIOS, DEFAULT_SCENARIO } from '../sim/scenario-definitions';
import type { JobKind, WorkType } from '../sim/types';
import { scheduleLayout } from './schedule-controls';
import { foodPolicyLayout } from './food-policy-controls';
import { apparelAssignmentLayout } from './apparel-policy-controls';
import { DEFAULT_MAP_SIZE, MAP_SIZE_PRESETS } from '../sim/map-config';
import { ITEM_DEFINITIONS } from '../sim/items';
import { FLOOR_KINDS,FLOOR_DEFINITIONS,flooringRecipe,type BuildableFloorKind } from '../sim/flooring';
import { UI_FONT_CHOICES } from './ui-fonts';
import { LIGHTING_CONTROLS } from '../render/lighting-settings';
import { renderPerformanceLayout } from './render-performance-controls';
import { siteHudLayout } from './site-hud';

const mapSizeLabels: Record<number, string> = { 32: 'terrain d’essai', 64: 'compacte', 128: 'compacte', 200: 'petite', 250: 'moyenne' };

export type Tool = 'allow' | 'forbid' | 'snow-clear' | 'remove-snow-clear' | BuildableFloorKind | 'home' | 'remove-home' | 'ignore-roof' | 'haul-chunks' | 'select' | 'allowed-expand' | 'allowed-shrink' | Exclude<JobKind, 'sow'|'repair'|'fix-breakdown'|'flick'|'lay-floor'> | 'cancel' | 'stockpile' | 'remove-stockpile' | 'growing' | 'remove-growing';
export type Panel = 'quests' | 'world' | 'animals' | 'wildlife' | 'research' | 'architect' | 'work' | 'schedule' | 'assign' | 'history' | 'menu' | null;
export type ArchitectCategory = 'orders' | 'zones' | 'structure' | 'floors' | 'furniture' | 'temperature' | 'recreation' | 'production' | 'power' | 'ship';
/** Visible Core work order (naturalPriority), omitting Smithing and Tailoring
 * because Lisière has no distinct priorities for them. The same sequence owns
 * both headings and controls so a display-only reorder cannot shift a pawn's
 * actual work setting into another column. */
export const workColumns: readonly {id: WorkType; label: string}[] = [
  {id:'firefight',label:'Incendie'}, {id:'patient',label:'Patient'},
  {id:'doctor',label:'Médecin'}, {id:'bedrest',label:'Repos au lit'},
  {id:'basic',label:'Manutention'}, {id:'warden',label:'Geôlier'},
  {id:'handle',label:'Dressage'}, {id:'cook',label:'Cuisine'},
  {id:'hunt',label:'Chasse'}, {id:'build',label:'Construction'},
  {id:'grow',label:'Culture'}, {id:'mine',label:'Minage'},
  {id:'gather',label:'Foresterie'}, {id:'smith',label:'Forge'},
  {id:'tailor',label:'Couture'}, {id:'art',label:'Art'},
  {id:'craft',label:'Artisanat'}, {id:'haul',label:'Transport'},
  {id:'clean',label:'Nettoyage'}, {id:'research',label:'Recherche'},
];
export const toolDefinitions: { id: Tool; title: string; hint: string; key: string; category: ArchitectCategory }[] = [
  {id:'ship-computer',title:'Ordinateur de vaisseau',hint:'2 × 2 fixe · 150 acier + 70 or + 4 composants avancés + 1 cœur d’IA · Construction 8 · terrain lourd sans toit · recherche Ordinateur de vaisseau · transmet le courant sans consommation',key:'',category:'ship'},
  {id:'ship-sensors',title:'Ensemble de capteurs',hint:'2 × 2 fixe · 140 acier + 4 or + 6 composants + 6 composants avancés · Construction 8 · terrain lourd sans toit · recherche Ensemble de capteurs · transmet le courant sans consommation',key:'',category:'ship'},
  {id:'ship-cryptosleep-casket',title:'Caisson spatial de cryptosommeil',hint:'1 × 2 orientable · 120 acier + 14 uranium + 3 composants + 3 composants avancés · Construction 8 · terrain lourd sans toit · tête sur une poutre achevée · éjection directe sans électricité · Q / E pour tourner',key:'',category:'ship'},
  {id:'ship-beam',title:'Poutre structurelle de vaisseau',hint:'2 × 6 orientable · 200 acier + 40 plastacier + 3 composants + 1 composant avancé · Construction 5 · terrain lourd sans toit · recherche Construction de vaisseau · Q / E pour tourner',key:'',category:'ship'},
  {id:'ship-reactor',title:'Réacteur stellaire',hint:'6 × 7 orientable · 350 acier + 280 plastacier + 70 uranium + 8 composants avancés · Construction 8 · terrain lourd sans toit · 1 000 W dès construction · recherche Réacteur stellaire · Q / E pour tourner',key:'',category:'ship'},
  {id:'ship-engine',title:'Moteur Johnson–Tanaka',hint:'3 × 4 orientable · 260 acier + 140 plastacier + 70 uranium + 6 composants avancés · Construction 8 · terrain lourd sans toit · recherche Moteur Johnson–Tanaka · Q / E pour tourner',key:'',category:'ship'},
  ...FLOOR_KINDS.map(id=>({id,title:FLOOR_DEFINITIONS[id].label,hint:`${flooringRecipe(id).ingredients.map(i=>`${i.quantity} ${ITEM_DEFINITIONS[i.item].label}`).join(' + ')} par case · Construction ${FLOOR_DEFINITIONS[id].skill}${FLOOR_DEFINITIONS[id].research==='stonecutting'?' · recherche Taille de pierre':FLOOR_DEFINITIONS[id].research==='smithing'?' · recherche Forge':FLOOR_DEFINITIONS[id].research==='sterile-materials'?' · recherche Matériaux stériles':''} · cliquer ou tracer un rectangle`,key:'',category:'floors' as const})),
  {id:'build-bridge',title:'Pont en bois',hint:'Fondation sur marais ou eau peu profonde · support léger uniquement · tracer une ligne ou un rectangle',key:'',category:'floors'},
  {id:'remove-bridge',title:'Retirer le pont',hint:'Travail de Construction · récupère 6 bois · refusé si une construction perd son support',key:'',category:'floors'},
  {id:'smooth-floor',title:'Lisser le sol',hint:'Construction · roche dégagée · sans matériau ni recherche · le travail doit être repris après un abandon',key:'',category:'floors'},
  {id:'remove-floor',title:'Retirer le sol',hint:'Travail de Construction · récupère environ la moitié du matériau · conserve le terrain naturel',key:'',category:'floors'},
  {id:'grave',title:'Tombe',hint:'1 × 2 · creusée sans matériau · un corps · Q / E pour tourner',key:'',category:'furniture'},
  { id: 'select', title: 'Inspecter', hint: 'Choisir un colon, un objet ou une zone ; survoler le terrain pour le lire', key: 'Échap', category: 'orders' },
  {id:'allow',title:'Autoriser',hint:'Cliquer ou tracer un rectangle pour autoriser les objets au sol connus. Les plantes et bâtiments ne sont pas concernés.',key:'',category:'orders'},
  {id:'forbid',title:'Interdire',hint:'Cliquer ou tracer un rectangle pour interdire les objets au sol connus. Les plantes et bâtiments ne sont pas concernés.',key:'',category:'orders'},
  { id:'mine',title:'Miner',hint:'Désigner les massifs à creuser. Les fragments restent au sol après extraction.',key:'M',category:'orders' },
  { id:'haul-chunks',title:'Transporter',hint:'Désigner les fragments à ranger dans une réserve qui les accepte. Les autres objets sont transportés automatiquement selon les réglages de stockage et de travail.',key:'',category:'orders' },
  { id: 'chop', title: 'Abattre', hint: 'Cliquer ou tracer un rectangle sur les arbres à couper. Échap annule le tracé.', key: 'C', category: 'orders' },
  { id: 'harvest', title: 'Récolter', hint: 'Cliquer ou tracer un rectangle sur les plantes récoltables.', key: 'R', category: 'orders' },
  { id: 'cut', title: 'Couper les plantes', hint: 'Libérer la case ; récupérer le produit si la plante est récoltable.', key: '', category: 'orders' },
  { id:'uninstall',title:'Désinstaller',hint:'Emballer un meuble pour le conserver et le déplacer.',key:'',category:'orders' },
  { id: 'deconstruct', title: 'Déconstruire', hint: 'Retirer un bâtiment par un travail de Construction. Environ la moitié des matériaux récupérée ; aucun remboursement pour le feu de camp.', key: '', category: 'orders' },
  { id: 'cancel', title: 'Annuler', hint: 'Cliquer ou tracer un rectangle pour retirer les ordres. Les matériaux restent sur place.', key: 'X', category: 'orders' },
  { id:'door',title:'Porte',hint:'orientation automatique · ouverture au passage · choisir le matériau',key:'',category:'structure' },
  { id:'autodoor',title:'Porte automatique',hint:'Construction 6 · recherche Portes automatiques · 50 W · passage rapide sous courant, porte ordinaire sans courant',key:'',category:'structure' },
  { id: 'wall', title: 'Mur', hint: 'cliquer ou tracer une ligne droite · mur de 2,80 m · Échap annule le tracé', key: 'B', category: 'structure' },
  {id:'mini-turret',title:'Mini-tourelle automatique',hint:'1 × 1 fixe · 100 acier + 3 composants · Construction 5 · recherche Tourelles automatiques · 180 ticks neutres · 100 PV · 80 W · canon 60 coups · acier livré pour réarmer · portée géométrique 28,9 · danger explosif 3,9 · désinstallation indisponible',key:'',category:'structure'},
  { id:'sandbags',title:'Sacs de sable',hint:'1 × 1 · 5 tissu · 18 ticks de construction neutres · couvert bas 55 % selon la direction du tir · 300 PV · ininflammable · traversée lente, sans arrêt sur la case · sans rotation',key:'',category:'structure' },
  { id: 'fence', title: 'Clôture', hint: 'cliquer ou tracer une ligne droite · 1 matériau par case · limite physique pour les herbivores errants', key: '', category: 'structure' },
  { id: 'fence-gate', title: 'Portillon', hint: '25 matériaux · accès nécessaire pour conduire les animaux dans un enclos', key: '', category: 'structure' },
  { id: 'pen-marker', title: 'Marqueur d’enclos', hint: '30 matériaux · désigne un enclos pour les herbivores errants', key: '', category: 'structure' },
  {id:'animal-sleeping-spot',title:'Emplacement de couchage animal',hint:'Gratuit et immédiat · 1 × 1 traversable · sommeil ou secours · usage médical dans son inspection',key:'',category:'furniture'},
  {id:'sleeping-spot',title:'Couchage au sol',hint:'Gratuit et immédiat · 1 × 2 traversable · une personne · affectation, usage médical ou prison dans son inspection · Q / E pour tourner',key:'',category:'furniture'},
  {id:'bedroll',title:'Sac de couchage',hint:'1 × 2 · 40 tissu ou cuir · déplaçable après minification · une personne · Q / E pour tourner',key:'',category:'furniture'},
  { id: 'bed', title: 'Lit', hint: 'empreinte 1 × 2 · Q / E pour tourner', key: 'L', category: 'furniture' },
  { id:'double-bed',title:'Lit double',hint:'2 × 2 · deux places civiles · recherche Mobilier complexe · Q / E pour tourner',key:'',category:'furniture' },
  { id: 'hospital-bed', title: 'Lit d’hôpital', hint: '1 × 2 · Construction 8 · recherche Lit d’hôpital · usage médical initial · Q / E pour tourner', key: '', category: 'furniture' },
  {id:'vitals-monitor',title:'Moniteur vital',hint:'1 × 1 · 50 acier + 3 composants · Construction 8 · recherche Moniteur vital · 80 W · à côté d’un lit d’hôpital : soins +7 points, immunité +2 points, chirurgie +0,05 · plusieurs lits possibles, sans cumul',key:'',category:'furniture'},
  { id: 'table', title: 'Table', hint: '1 × 2 · placer des tabourets contre le bord · Q / E pour tourner', key: '', category: 'furniture' },
  { id:'table-square',title:'Table carrée',hint:'2 × 2 · 50 matériaux · Q / E pour tourner',key:'',category:'furniture'},
  { id:'table-long',title:'Table longue',hint:'2 × 4 · 95 matériaux · Q / E pour tourner',key:'',category:'furniture'},
  { id:'dining-chair',title:'Chaise de salle à manger',hint:'1 × 1 · 45 bois ou acier · Construction 4 · Mobilier complexe',key:'',category:'furniture'},
  { id:'armchair',title:'Fauteuil',hint:'1 × 1 · 110 tissu ou cuir léger · Construction 5 · Mobilier complexe',key:'',category:'furniture'},
  { id:'end-table',title:'Table de chevet',hint:'1 × 1 · améliore le confort du lit adjacent · Mobilier complexe',key:'',category:'furniture'},
  { id:'dresser',title:'Commode',hint:'2 × 1 · améliore les lits dans un rayon de 6 cases · Mobilier complexe',key:'',category:'furniture'},
  { id:'shelf',title:'Étagère',hint:'2 × 1 · trois piles par case, six au total · Mobilier complexe',key:'',category:'furniture'},
  { id:'small-shelf',title:'Petite étagère',hint:'1 × 1 · trois piles · Mobilier complexe',key:'',category:'furniture'},
  { id:'flower-pot',title:'Pot de fleurs',hint:'1 × 1 · 20 matériaux · l’hémérocalle doit être semée et entretenue',key:'',category:'furniture'},
  { id: 'horseshoes', title: 'Fers à cheval', hint: '3 joueurs maximum · places de lancer à 5 cases avec vue dégagée', key: '', category: 'recreation' },
  { id: 'chess-table', title: 'Table d’échecs', hint: '1 × 1 · 70 bois, métal ou pierre · Mobilier complexe · 2 joueurs maximum avec sièges adjacents', key: '', category: 'recreation' },
  { id:'tube-television',title:'Télévision cathodique',hint:'1 × 1 orientable · 80 acier + 4 composants · recherche Télévision cathodique · Construction 7 · 1 000 ticks neutres · 100 PV · 200 W · places visibles à 2–4 cases devant l’écran, siège réel requis · survol : zone géométrique, accès et sièges à vérifier · plaisir seulement sur place et sous courant',key:'',category:'recreation' },
  {id:'torch-lamp',title:'Lampe-torche',hint:'Support léger · pleine après construction · sans réseau électrique · ravitaillement physique · aucun bois rendu au retrait',key:'',category:'furniture'},
  {id:'vent',title:'Bouche d’aération',hint:'30 acier · Mobilier complexe · deux faces libres · démolir le mur avant pose · Q/E : tourner',key:'',category:'temperature'},
  {id:'heater',title:'Radiateur',hint:'50 acier, 1 composant · Construction 5 · 175 W · thermostat',key:'',category:'temperature'},
  {id:'wind-turbine',title:'Éolienne',hint:'7 × 2 · 100 acier, 2 composants · Construction 4 · couloir de vent dégagé · Q / E pour tourner',key:'',category:'power'},
  {id:'cooler',title:'Climatiseur',hint:'Faces bleue froide / rouge chaude · Construction 5 · Climatisation requise · Q/E : tourner',key:'',category:'temperature'},
  {id:'wood-generator',title:'Générateur à bois',hint:'2 × 2 · 1 000 W · réservoir vide à remplir · 22 bois/jour',key:'',category:'power'},
  {id:'chemfuel-generator',title:'Générateur à biocarburant',hint:'2 × 2 fixe · 100 acier + 3 composants · 1 000 W · réservoir de 30 biocarburants, vide à construire · 4,5 unités/jour, arrêt par commutateur ou panne · ravitaillement au contact',key:'',category:'power'},
  {id:'power-conduit',title:'Câble électrique',hint:'cliquer ou tracer une ligne droite · 1 acier par case · peut passer sous un mur · aucun remboursement à la déconstruction',key:'',category:'power'},
  {id:'power-switch',title:'Interrupteur électrique',hint:'1 × 1 · coupe le réseau après intervention d’un colon · Travail : Manutention',key:'',category:'power'},
  {id:'battery',title:'Batterie',hint:'1 × 2 · 600 Wj · rendement de charge 50 % · recherche Batteries · Q / E pour tourner',key:'',category:'power'},
  {id:'geothermal-generator',title:'Centrale géothermique',hint:'6 × 6 fixe · 340 acier + 8 composants · Construction 8 · 3 600 W constants sans combustible · placer le geyser sur les quatre cases centrales du plan · recherche Énergie géothermique',key:'',category:'power'},
  {id:'solar-generator',title:'Générateur solaire',hint:'4 × 4 · jusqu’à 1 700 W au soleil · sans toit · Construction 6 · recherche Panneaux solaires',key:'',category:'power'},
  {id:'standing-lamp',title:'Lampe sur pied',hint:'30 W · raccordement à un réseau proche · n’éclaire que si alimentée',key:'',category:'furniture'},
  {id:'sun-lamp',title:'Lampe horticole',hint:'2 900 W · cultures sous toit dans la zone éclairée · arrêt automatique la nuit · Survol : couverture prévue si alimentée',key:'',category:'furniture'},
  { id: 'passive-cooler', title: 'Refroidisseur passif', hint: 'combustible initial inclus · seuil de 17 °C · 10 bois/jour', key: '', category: 'temperature' },
  { id: 'campfire', title: 'Feu de camp', hint: 'combustible initial inclus · brûle 10 bois par jour', key: '', category: 'temperature' },
  {id:'hydroponics-basin',title:'Bac hydroponique',hint:'1 × 4 · 100 acier + 1 composant · Construction 4 · recherche Hydroponie · 70 W continus · fertilité 280 % · riz, pommes de terre, coton ou racine médicinale · lumière et température nécessaires · sans courant, les plantes dépérissent · Q / E pour tourner',key:'',category:'production'},
  {id:'deep-drill',title:'Foreuse profonde',hint:'1 × 1 · 100 acier + 2 composants · Construction 4 · Forage profond · 200 W · travail Minage au contact · réserves souterraines finies · scanner alimenté pour voir les gisements · Q / E pour tourner',key:'',category:'production'},
  {id:'ground-scanner',title:'Scanner de sol',hint:'3 × 3 · 150 acier + 4 composants + 1 composant avancé · Construction 8 · Scanner de sol · 700 W · aucune case sous toit · travail Recherche au contact · découvre des gisements, sans créer de stock au sol · Q / E pour tourner',key:'',category:'production'},
  {id:'orbital-beacon',title:'Balise orbitale',hint:'1 × 1 fixe · 40 acier + 1 composant · Microélectronique · 40 W · couverture 7,9 cases sans traverser les portes, murs ou roche · biens et argent au sol · peut fonctionner sous toit',key:'',category:'production'},
  {id:'comms-console',title:'Console de communication',hint:'3 × 2 · 120 acier + 4 composants · Construction 5 · Microélectronique · 200 W · négociateur au contact et balise alimentée · vaisseaux de passage à stock fini · Q / E pour tourner',key:'',category:'production'},
  {id:'nutrient-paste-dispenser',title:'Distributeur de pâte nutritive',hint:'3 × 4 · 125 acier + 3 composants · Construction 5 · recherche Pâte nutritive · 200 W · 6 aliments crus dans les trémies voisines → 1 repas · retrait au contact · Q / E pour tourner',key:'',category:'production'},
  {id:'hopper',title:'Trémie',hint:'1 × 1 · 15 acier · sans énergie · placer contre un bord du distributeur ou de son plan, sans diagonale · stockage fixe d’aliments crus · priorité Important · remplissage par Transport · Q / E pour tourner',key:'',category:'production'},
  {id:'research-bench',title:'Bureau de recherche simple',hint:'3 × 2 · 75 matériaux + 25 acier · Q / E pour tourner',key:'',category:'production'},
  {id:'tailor-bench',title:'Établi de tailleur',hint:'3 × 1 · 75 matériaux · nécessite Vêtements complexes',key:'',category:'production'},
  {id:'drug-lab',title:'Laboratoire de chimie',hint:'3 × 1 · 50 bois ou acier + 75 acier + 6 composants · manuel · Construction 4 · Production de drogues',key:'',category:'production'},
  {id:'firefoam-popper',title:'Diffuseur de mousse',hint:'1 × 1 · 75 acier + 1 composant · Construction 5 · Recherche Mousse anti-incendie · Usage unique, reconstruction payée',key:'',category:'structure'},
  {id:'spike-trap',title:'Piège à pointes',hint:'1 × 1 · 45 matériaux · Construction 3 · Piège consommé au déclenchement · Aucun piège sur une case voisine, même en diagonale · Reconstruction payée si activée',key:'',category:'structure'},
  {id:'electric-crematorium',title:'Crématorium électrique',hint:'3 × 2 · 150 blocs de pierre + 20 acier + 2 composants · Construction 4 · 250 W · Détruit les dépouilles choisies par facture et leurs possessions encore attachées · Q / E pour tourner',key:'',category:'production'},
  {id:'electric-smelter',title:'Fonderie électrique',hint:'3 × 1 · 170 acier + 2 composants · Construction 4 · 350 ticks neutres · 180 PV · 700 W · Fondre les armes choisies par facture pour récupérer 25 % des métaux, aucun composant · Q / E pour tourner',key:'',category:'production'},
  {id:'fueled-smithy',title:'Forge à combustible',hint:'3 × 1 · 100 acier · Construction 4 · Forgeage · 50 bois max, 80/jour de travail · Artisanat : plaques et casques · Q / E pour tourner',key:'',category:'production'},
  {id:'electric-smithy',title:'Forge électrique',hint:'3 × 1 · 100 acier + 3 composants · Construction 5 · Forgeage · 210 W, chaleur au repos · Artisanat : plaques et casques · Q / E pour tourner',key:'',category:'production'},
  {id:'brewery',title:'Brasserie',hint:'3 × 1 · 120 bois + 30 acier · manuelle · Cuisine : 25 houblons → 5 moûts · recherche Brassage de bière · Q / E pour tourner',key:'',category:'production'},
  {id:'fermenting-barrel',title:'Tonneau de fermentation',hint:'1 × 1 · 30 bois + 10 acier · 25 moûts au maximum · 6 jours idéaux · Transport remplit et extrait au contact · recherche Brassage de bière',key:'',category:'production'},
  {id:'biofuel-refinery',title:'Raffinerie de biocarburant',hint:'3 × 2 · 150 acier + 3 composants · Construction 4 · Raffinage de biocarburant · 170 W · 70 bois ou 3,5 nutrition d’aliments crus → 35 biocarburants · factures · travail Artisanat au contact · Q / E pour tourner',key:'',category:'production'},
  {id:'art-bench',title:'Atelier de sculpture',hint:'3 × 1 · 75 bois ou acier + 50 acier · manuel · petites et grandes sculptures · Q / E pour tourner',key:'',category:'production'},
  {id:'machining-table',title:'Atelier d’usinage',hint:'3 × 1 · 150 acier + 5 composants · 350 W · Construction 4 · Usinage',key:'',category:'production'},
  {id:'hi-tech-research-bench',title:'Bureau de recherche haute technologie',hint:'5 × 2 · 250 acier + 10 composants · 250 W · Construction 6 · Microélectronique',key:'',category:'production'},
  {id:'cryptosleep-casket',title:'Caisson de cryptosommeil',hint:'1 × 2 · 180 acier + 5 uranium + 4 composants + 1 composant avancé · Construction 8 · Sans électricité',key:'',category:'furniture'},
  {id:'multi-analyzer',title:'Multi-analyseur',hint:'2 × 2 · 40 acier + 50 plastacier + 20 or + 8 composants · 200 W · Construction 8',key:'',category:'production'},
  {id:'fabrication-bench',title:'Établi de fabrication',hint:'5 × 2 · 200 acier + 12 composants + 2 composants avancés · 250 W · Construction 6',key:'',category:'production'},
  {id:'electric-tailor-bench',title:'Établi de tailleur électrique',hint:'3 × 1 · 75 matériaux + 50 acier + 2 composants · 120 W · Construction 4',key:'',category:'production'},
  {id:'crafting-spot',title:'Emplacement d’artisanat',hint:'Gratuit et immédiat · 60 tissus → tenue tribale · Q / E pour tourner',key:'',category:'production'},
  {id:'fueled-stove',title:'Cuisinière à bois',hint:'3 × 1 · 80 acier · consomme du bois pendant la cuisson · Q / E pour tourner',key:'',category:'production'},
  {id:'electric-stove',title:'Cuisinière électrique',hint:'3 × 1 · 80 acier, 2 composants · Construction 4 · 350 W · Q / E pour tourner',key:'',category:'production'},
  {id:'butcher-table',title:'Table de boucherie',hint:'3 × 1 · 95 bois · rendement du poste 100 % · Q / E pour tourner',key:'',category:'production'},
  {id:'butcher-spot',title:'Emplacement de boucherie',hint:'Gratuit et immédiat · dépouille fraîche → viande et cuir · rendement du poste 70 % · Q / E pour tourner',key:'',category:'production'},
  { id: 'stonecutter', title: 'Table de taille de pierre', hint: '3 × 1 · Q / E pour tourner · 1 fragment → 20 blocs · travail Artisanat', key: '', category: 'production' },
  { id: 'stool', title: 'Tabouret', hint: '1 × 1 · une place par colon, adjacente à une table', key: '', category: 'furniture' },
  { id: 'growing', title: 'Zone de culture', hint: 'Tracer un champ, puis choisir sa plante dans l’inspection : riz, pommes de terre, maïs, coton, racine médicinale ou foin. Semis sans graines et récolte à maturité, via le travail Culture.', key: '', category: 'zones' },
  { id:'build-roof',title:'Construire un toit',hint:'Désigner la couverture à poser par les bâtisseurs. Aucun matériau requis ; supports nécessaires.',key:'',category:'zones' },
  { id:'remove-roof',title:'Retirer un toit',hint:'Retirer physiquement la couverture et empêcher son ajout automatique.',key:'',category:'zones' },
  { id:'ignore-roof',title:'Ignorer le toit',hint:'Effacer la zone de toiture sans changer la couverture déjà posée.',key:'',category:'zones' },
  { id: 'remove-growing', title: 'Retirer une culture', hint: 'Retirer la zone conserve les plantes déjà semées.', key: '', category: 'zones' },
  { id: 'stockpile', title: 'Zone de stockage', hint: 'Tracer une zone, ou commencer dans une zone existante pour l’agrandir. Les objets mobiles restent au sol.', key: 'S', category: 'zones' },
  { id:'snow-clear',title:'Déneigement',hint:'Tracer une zone entretenue par le travail Nettoyage dès que la neige atteint20%. La neige est retirée par un vrai travail au contact.',key:'',category:'zones' },
  { id:'remove-snow-clear',title:'Retirer le déneigement',hint:'Retirer la zone conserve la neige déjà présente et libère le travail en cours.',key:'',category:'zones' },
  { id:'home',title:'Zone de foyer',hint:'Tracer les cases où les bâtisseurs doivent entretenir les ouvrages endommagés.',key:'',category:'zones' },
  { id:'remove-home',title:'Retirer le foyer',hint:'Retire la permission de réparation sans démolir les ouvrages.',key:'',category:'zones' },
  { id: 'remove-stockpile', title: 'Retirer', hint: 'Cliquer ou tracer un rectangle pour retirer des cases de réserve ; les objets restent au sol.', key: '', category: 'zones' },
];

export function storageSettings(prefix: string): string {
  return `<div class="storage-settings" id="${prefix}-settings"><div id="${prefix}-items"></div></div>`;
}

export function gameLayout(): string {
  const tabs = [
    ['architect', 'Architecte'], ['work', 'Travail'], ['schedule', 'Planning'], ['assign', 'Assignations'],
    ['animals', 'Animaux'], ['wildlife', 'Faune'], ['research', 'Recherche'], ['quests', 'Quêtes'],
    ['world', 'Monde'], ['history', 'Historique'], ['factions', 'Factions'], ['menu', 'Menu'],
  ];
  return `<main class="game-shell">
    <div id="viewport" aria-label="Carte de la colonie en trois dimensions"></div>
    <header class="colonist-bar" aria-label="Colons"><div id="colonists"></div></header>
    <div id="map-jump-to-host"></div>
    <aside class="resource-list panel" aria-label="Ressources disponibles" title="Objets au sol et portés. Les matériaux déjà livrés aux chantiers sont comptés séparément.">
      <div class="resource-heading">Ressources</div>
      <div id="resources">
      <div class="resource"><span class="resource-symbol wood">▤</span><span>Bois</span><strong id="wood">—</strong></div>
      <div class="resource"><span class="resource-symbol">▱</span><span>Acier</span><strong id="steel">—</strong></div>
      <div class="resource" id="plasteel-stock" hidden><span class="resource-symbol">▱</span><span>Plastacier</span><strong id="plasteel">—</strong></div>
      <div class="resource" id="uranium-stock" hidden><span class="resource-symbol">▰</span><span>Uranium</span><strong id="uranium">—</strong></div>
      <div class="resource" id="gold-stock" hidden><span class="resource-symbol">◆</span><span>Or</span><strong id="gold">—</strong></div>
      <div class="resource" id="cloth-stock" hidden><span class="resource-symbol">▤</span><span>Tissu</span><strong id="cloth">—</strong></div>
      <div class="resource"><span class="resource-symbol">⚙</span><span>Composants</span><strong id="component">—</strong></div><div class="resource"><span class="resource-symbol">¤</span><span>Argent</span><strong id="silver">—</strong></div>
      <div class="resource" id="advanced-component-stock" hidden><span class="resource-symbol">⚙</span><span>Comp. avancés</span><strong id="advanced-component">—</strong></div>
      <div class="resource" id="chemfuel-stock" hidden><span class="resource-symbol">▥</span><span>Biocarburant</span><strong id="chemfuel">—</strong></div>
      <div class="resource"><span class="resource-symbol">✚</span><span>Médicaments</span><strong id="medicine">—</strong></div>
      <div class="resource"><span class="resource-symbol">▦</span><span>Blocs</span><strong id="blocks">—</strong></div>
      <div class="resource"><span class="resource-symbol food">⁙</span><span>Nutrition</span><strong id="food">—</strong></div>
      </div><div id="food-items"></div>
      <div id="material-status" class="material-status"></div>
      <div class="resource-foot"><span id="population">3</span> colons · <span id="map-size">${DEFAULT_MAP_SIZE} × ${DEFAULT_MAP_SIZE}</span></div>
    </aside>
    <span id="fps-counter" aria-live="off" title="Cadence du rendu, indépendante de la vitesse de simulation">— FPS</span>
    <div class="corner-tools"><span class="game-title">ELSEWHERE</span><button id="help-open" aria-label="Ouvrir l’aide" title="Guide complet">?</button></div>
    <details class="learning-readout" aria-label="Conseils de jeu"><summary>Conseils</summary>
      <div class="learning-concepts"><div id="first-gestures-guide" aria-label="Parcours facultatif des premiers gestes"></div><div id="first-day-guide" aria-label="Préparer les premiers jours"></div><p>Notions disponibles</p>
        <details><summary>Emploi du temps</summary><p>Planning règle les heures de travail, de loisir et de repos de chaque colon.</p><button data-guide-panel="schedule" type="button">Ouvrir Planning</button></details>
        <details><summary>Ordres sur la carte</summary><p>Dans Ordres, au-dessus de la barre de gestion, désignez les arbres à abattre et les plantes à récolter. Les colons exécutent ces ordres selon leurs priorités et leur accès.</p><button data-guide-map-tools="orders" type="button">Ouvrir Ordres</button></details>
        <details><summary>Recherche</summary><p>Choisissez un projet ; un colon affecté à la recherche pourra progresser à un bureau construit et utilisable.</p><button data-guide-panel="research" type="button">Ouvrir Recherche</button></details>
      </div>
    </details>
    <aside id="alerts" class="alerts" aria-label="Alertes de la colonie"><div id="status-alerts"></div><div class="alert-jumps"><button id="inspect-threat" hidden>Menace armée · voir</button><button id="inspect-fire" hidden>Incendie · voir</button><button id="inspect-blight" hidden>Fléau des cultures · voir</button></div></aside>
    <div id="pause-banner" hidden>EN PAUSE</div>
    <div id="notice" role="status" aria-live="polite" hidden></div>
    <div id="area-feedback" role="status" aria-live="polite" hidden></div>
    <aside id="map-hover-readout" aria-label="Informations sous le pointeur" aria-live="off" hidden></aside>
    <aside id="map-cell-details" aria-label="Détails de la case sous le pointeur" aria-live="off" hidden></aside>

    <section id="inspector" class="inspector panel" aria-label="Inspection" hidden></section>
    <section id="architect-panel" class="management-panel architect-panel panel" aria-label="Architecte" hidden>
      <div class="panel-heading"><h2>Architecte</h2><button data-close-panel aria-label="Fermer Architecte">×</button></div>
      <div class="architect-body"><nav class="architect-categories" aria-label="Catégories de construction">
        <button data-category="orders" class="active">Ordres</button><button data-category="zones">Zones</button>
        <button data-category="temperature">Température</button><button data-category="structure">Structure</button><button data-category="floors">Sols</button><button data-category="furniture">Meubles</button>
        <button data-category="recreation">Loisirs</button><button data-category="production">Production</button><button data-category="power">Énergie</button><button data-category="ship" hidden>Vaisseau</button><button disabled>Sécurité</button>
      </nav><div class="architect-content">
        <div class="tools">${toolDefinitions.map(tool => `<button data-tool="${tool.id}" data-tool-category="${tool.category}" title="${tool.hint}" aria-label="${tool.title}" aria-pressed="false" class="tool"><span class="tool-icon" aria-hidden="true"></span><span>${tool.title}</span><kbd>${tool.key}</kbd></button>`).join('')}</div>
        <div class="architect-options"><p id="tool-instruction">Choisissez un ordre, puis cliquez sur la carte.</p>
        <label id="construction-material-controls" hidden>Matériau <select id="construction-material"><option value="wood">Bois</option><option value="steel">Acier</option></select></label>
        <div id="placement-controls" hidden><button id="rotate-building" aria-label="Tourner la construction">Tourner · E</button><span id="placement-orientation">0°</span></div>
        <div id="storage-options" hidden>${storageSettings('stockpile')}<p class="muted">Une zone partage ses réglages. Tracez depuis une zone existante pour l’agrandir ; sa priorité attire les objets.</p></div>
        <p class="muted" id="job-count">Aucun ordre en cours</p></div>
      </div></div>
    </section>
    <section id="work-panel" class="management-panel work-panel panel" aria-label="Travail" hidden>
      <div class="panel-heading"><h2>Travail</h2><button data-close-panel aria-label="Fermer Travail">×</button></div>
      <p>Priorités manuelles : <b>1</b> haute · <b>4</b> basse · <b>0</b> désactivée. Le transport livre aussi les chantiers.</p>
      <div class="work-table-wrap"><table><thead><tr><th>Colon</th>${workColumns.map(column=>`<th data-work-heading="${column.id}">${column.label}</th>`).join('')}<th>Activité</th></tr></thead><tbody id="work-rows"></tbody></table></div>
    </section>
    ${scheduleLayout()}
    ${apparelAssignmentLayout(foodPolicyLayout())}
    ${allowedAreaLayout()}
    <section id="animals-panel" class="management-panel panel" aria-label="Animaux domestiques" hidden><div class="panel-heading"><h2>Animaux domestiques</h2><button data-close-panel aria-label="Fermer">×</button></div><div id="animals-content"></div></section>
    <section id="wildlife-panel" class="management-panel panel" aria-label="Faune" hidden><div class="panel-heading"><h2>Faune</h2><button data-close-panel aria-label="Fermer Faune">×</button></div><div id="wildlife-content"></div></section>
    <section id="research-panel" class="management-panel panel" aria-label="Recherche" hidden><div class="panel-heading"><h2>Recherche</h2><button data-close-panel aria-label="Fermer Recherche">×</button></div><div id="research-content"></div></section>
    <section id="world-panel" class="management-panel panel" aria-label="Monde" hidden><div class="panel-heading"><h2>Monde</h2><button data-close-panel aria-label="Fermer Monde">×</button></div><nav class="world-tabs" role="tablist" aria-label="Vues du monde"><button id="world-tab-maps" role="tab" aria-controls="maps-content" aria-selected="false" tabindex="-1" data-world-tab="maps">Cartes et colonies</button><button id="world-tab-group" role="tab" aria-controls="group-content" aria-selected="false" tabindex="-1" data-world-tab="group">Globe et caravanes</button><button id="world-tab-individual" role="tab" aria-controls="individual-world-content" aria-selected="true" data-world-tab="individual">Voyages individuels</button></nav><div id="maps-content" role="tabpanel" aria-labelledby="world-tab-maps" hidden><div id="maps-globe"></div><div id="maps-list"></div><button id="show-world-globe" type="button">Afficher le globe</button></div><div id="group-content" role="tabpanel" aria-labelledby="world-tab-group" hidden></div><div id="individual-world-content" role="tabpanel" aria-labelledby="world-tab-individual"><div id="scout-content" class="scout-content"></div><div id="commercial-content" class="scout-content"></div></div></section>
    <section id="quests-panel" class="management-panel panel" aria-label="Quêtes" hidden><div class="panel-heading"><h2>Quêtes</h2><button data-close-panel aria-label="Fermer Quêtes">×</button></div><div id="quests-content" class="scout-content"></div></section>
    <section id="history-panel" class="management-panel history-panel panel" aria-label="Historique" hidden>
      <div class="panel-heading"><h2>Historique</h2><button data-close-panel aria-label="Fermer Historique">×</button></div>
      <div id="colony-economy"></div>
      <div id="journal-items"></div>
    </section>
    <section id="menu-panel" class="management-panel menu-panel panel" aria-label="Menu du jeu" hidden>
      <div class="panel-heading"><h2>Elsewhere</h2><button data-close-panel aria-label="Fermer Menu">×</button></div><p id="scenario-current" class="muted"></p><div id="climate-options"></div>
      <div id="save-management"></div>
      <fieldset class="presentation-settings"><legend>Jeu</legend>
        <label class="presentation-setting"><span><strong id="threat-pause-label">Pause automatique</strong><small id="threat-pause-description">Nouvelles menaces sur les cartes de la partie. La vue actuelle est conservée.</small><small data-threat-pause-status role="status"></small></span><select id="threat-pause-mode" data-threat-pause-mode aria-labelledby="threat-pause-label" aria-describedby="threat-pause-description">${THREAT_PAUSE_CHOICES.map(choice=>`<option value="${choice.value}">${choice.label}</option>`).join('')}</select></label>
        <label class="presentation-setting"><span><strong id="max-settlements-label">Nombre maximal de colonies</strong><small id="max-settlements-description">Option globale. Les camps ne comptent pas ; diminuer la limite conserve les colonies existantes.</small><small data-max-settlements-status role="status"></small></span><select id="max-settlements" data-max-settlements aria-labelledby="max-settlements-label" aria-describedby="max-settlements-description">${SETTLEMENT_LIMIT_CHOICES.map(value=>`<option value="${value}">${value}</option>`).join('')}</select></label>
      </fieldset>
      <fieldset class="presentation-settings"><legend>Affichage</legend>
        <label class="presentation-setting"><span><strong id="ui-font-label">Typographie</strong><small id="ui-font-description">Police de toute l’interface. Choix conservé dans ce navigateur.</small></span><select id="ui-font" aria-labelledby="ui-font-label" aria-describedby="ui-font-description">${UI_FONT_CHOICES.map(font=>`<option value="${font.id}">${font.label}</option>`).join('')}</select></label>
          <label class="presentation-setting"><span><strong id="item-label-visibility-label">Quantités et qualités des objets</strong><small id="item-label-visibility-description">Seuil de zoom des chiffres et qualités. 0 : toujours visibles.</small><output id="item-label-visibility-value"></output></span><input id="item-label-visibility" type="range" min="0" max="160" step="1" value="96" aria-labelledby="item-label-visibility-label" aria-describedby="item-label-visibility-description item-label-visibility-value"></label>
        <label class="presentation-setting"><span><strong id="designation-visibility-label">Icônes des ordres</strong><small id="designation-visibility-description">Seuil de zoom : 0 les affiche toujours ; sinon elles disparaissent quand une case devient plus petite que ce seuil.</small><output id="designation-visibility-value"></output></span><input id="designation-visibility" type="range" min="0" max="96" step="1" value="32" aria-labelledby="designation-visibility-label" aria-describedby="designation-visibility-description designation-visibility-value"></label>
        <label class="presentation-setting"><span><strong id="textures-enabled-label">Textures 3D stylisées</strong><small id="textures-enabled-description">Détails peints des volumes 3D. Choix conservé dans ce navigateur.</small></span><input id="textures-enabled" type="checkbox" aria-labelledby="textures-enabled-label" aria-describedby="textures-enabled-description" checked></label>
        <label class="presentation-setting"><span><strong id="ground-grass-label">Tapis d’herbe</strong><small id="ground-grass-description">Brins décoratifs sur la terre visible. Désactivé : aucun brin ni traitement associé.</small></span><input id="ground-grass-enabled" type="checkbox" aria-labelledby="ground-grass-label" aria-describedby="ground-grass-description" checked></label>
        <label class="presentation-setting"><span><strong id="diorama-label">Diorama en carton</strong><small id="diorama-description">Table et boîte en carton autour de la carte. Choix conservé dans ce navigateur.</small></span><input id="diorama-enabled" type="checkbox" aria-labelledby="diorama-label" aria-describedby="diorama-description" checked></label>
        <label class="presentation-setting"><span><strong id="room-label">Chambre autour de la carte</strong><small id="room-description">Décor de chambre autour de la carte, indépendant du diorama. Choix conservé dans ce navigateur.</small></span><input id="room-enabled" type="checkbox" aria-labelledby="room-label" aria-describedby="room-description" checked></label>
        <label class="presentation-setting"><input id="decor-occlusion-enabled" type="checkbox" checked aria-labelledby="decor-occlusion-label" aria-describedby="decor-occlusion-description"><span><strong id="decor-occlusion-label">Masquer le décor devant la carte</strong><small id="decor-occlusion-description">Masque les parties des nuages et suspensions qui passent entre la caméra et le plateau, dans les deux vues.</small></span></label>
        ${LIGHTING_CONTROLS.map(({key,label,description}) => `<label class="presentation-setting"><span><strong id="lighting-${key}-label">${label}</strong><small id="lighting-${key}-description">${description}</small><output id="lighting-${key}-value">100 %</output></span><input id="lighting-${key}" type="range" min="0" max="300" step="5" value="100" aria-labelledby="lighting-${key}-label" aria-describedby="lighting-${key}-description lighting-${key}-value"></label>`).join('')}
        <button id="lighting-reset" type="button">Réinitialiser l’éclairage</button>
      </fieldset>
      <fieldset class="presentation-settings render-performance-settings"><legend>Performances visuelles</legend>${renderPerformanceLayout('game-')}</fieldset>
      <fieldset class="presentation-settings audio-settings"><legend>Son</legend>
        <label class="presentation-setting"><span><strong id="sound-enabled-label">Effets sonores</strong><small id="sound-enabled-description">Bruitages et ambiances, indépendants de la musique. Choix conservé dans ce navigateur.</small></span><input id="sound-enabled" type="checkbox" aria-labelledby="sound-enabled-label" aria-describedby="sound-enabled-description" checked></label>
        <label class="presentation-setting"><span><strong id="sound-volume-label">Volume des effets</strong><small id="sound-volume-description">Réglage général des bruitages.</small></span><input id="sound-volume" type="range" min="0" max="100" step="1" value="75" aria-labelledby="sound-volume-label" aria-describedby="sound-volume-description"></label>
        <button id="test-sound" type="button">Essayer le son</button><p id="test-sound-status" class="muted" role="status" aria-live="polite"></p>
        <label class="presentation-setting"><span><strong id="music-enabled-label">Musique</strong><small id="music-enabled-description">Compositions instrumentales longues. Choix conservé dans ce navigateur.</small></span><input id="music-enabled" type="checkbox" aria-labelledby="music-enabled-label" aria-describedby="music-enabled-description" checked></label>
        <label class="presentation-setting"><span><strong id="music-volume-label">Volume de la musique</strong><small id="music-volume-description">Indépendant des effets sonores.</small></span><input id="music-volume" type="range" min="0" max="100" step="1" value="50" aria-labelledby="music-volume-label" aria-describedby="music-volume-description"></label>
      </fieldset>
      <details class="legacy-scenario-settings"><summary>Événements d’une ancienne colonie</summary><p class="muted">Ces activations ajoutent des événements futurs aux sauvegardes historiques, sans en inventer dans leur passé.</p><div class="legacy-event-controls"><button id="enable-arrivals">Activer les demandes d’accueil</button><button id="enable-raids">Activer les raids du camp</button><button id="enable-mech-raids">Admettre les raids mécaniques futurs</button><button id="enable-heatwaves">Activer les canicules du camp</button></div></details>
      <button id="save">Sauvegarder</button><button id="load">Recharger</button><button id="browse-saves">Charger une partie</button><button id="new-colony">Nouvelle colonie</button>
      <button id="return-home">Sauvegarder et accueil</button><button id="restore-previous" disabled>Colonie précédente</button><button id="show-diagnostics">Afficher les diagnostics</button>
      <p class="muted">Sauvegarde locale à ce navigateur.</p>
    </section>

    <aside class="time-panel panel" aria-label="Temps et commandes de vue">
      ${siteHudLayout()}<p id="campaign-clock" hidden></p>
      <div class="time-controls" aria-label="Vitesse de simulation">
        <button data-speed="0" aria-label="Pause" title="Pause · Espace">Ⅱ</button><button data-speed="1" aria-label="Vitesse normale" title="1× · touche 1">▷</button>
        <button data-speed="3" aria-label="Vitesse 3 fois" title="3× · touche 2">▷▷</button><button data-speed="6" aria-label="Vitesse 6 fois" title="6× · touche 3">▷▷▷</button>
      </div>
      <div class="view-controls" aria-label="Commandes de vue"><button id="wall-cutaway" aria-pressed="false" aria-label="Murs : hauts" title="Coupe visuelle : les murs gardent leurs collisions"><span class="ui-icon" aria-hidden="true"></span><span class="view-control-label">Murs : hauts</span></button><button id="roof-toggle" aria-pressed="false" aria-label="Toits : masqués" title="Afficher la couverture ; masquer ne retire pas le toit"><span class="ui-icon" aria-hidden="true"></span><span class="view-control-label">Toits : masqués</span></button><button id="foliage-toggle" aria-pressed="false" aria-label="Feuillage" title="Masquer le feuillage pour voir les colons"><span class="ui-icon" aria-hidden="true"></span><span class="view-control-label">Feuillage</span></button><button id="zones-toggle" aria-pressed="true" aria-label="Zones : visibles" title="Afficher ou masquer les zones sans changer leurs règles"><span class="ui-icon" aria-hidden="true"></span><span class="view-control-label">Zones : visibles</span></button><button id="view-home" aria-label="Recentrer sur la colonie" title="Recentrer sur la colonie"><span class="ui-icon" aria-hidden="true"></span><span class="view-control-label">Recentrer sur la colonie</span></button><button id="camera-mode" aria-pressed="false" aria-label="Vue : iso" title="Basculer en perspective ; glisser avec le bouton droit pour tourner"><span class="ui-icon" aria-hidden="true"></span><span class="view-control-label">Vue : iso</span></button></div>
    </aside>
    <div id="metrics" class="diagnostics" hidden></div>
    <nav class="main-tabs panel" aria-label="Gestion de la colonie">${tabs.map(([id, label]) => `<button data-panel="${id}" ${['architect', 'work', 'schedule', 'assign', 'history', 'menu', 'research', 'wildlife', 'animals', 'world', 'quests'].includes(id) ? 'aria-pressed="false"' : 'disabled title="Fonctionnalité à venir"'}>${label}</button>`).join('')}</nav>
    <div id="loading" class="loading"><h1>ELSEWHERE</h1><p>Préparation de votre colonie…</p></div>
    <dialog id="help" class="help-dialog" aria-labelledby="help-title"><form method="dialog"><button class="close" aria-label="Fermer l’aide">×</button></form><span class="section-label">CARNET DE SURVIE</span><h2 id="help-title">Votre première journée</h2>
      <p>Vous donnez les ordres. Les colons choisissent leurs tâches et se déplacent de façon autonome.</p>
      <p><b>Nouvelle partie</b> : choisir le scénario, le narrateur, le monde, le lieu et trois personnes. Le départ est en pause ; <b>Reprendre</b> fait descendre puis ouvrir leurs capsules. Les scénarios grisés et le tutoriel restent indisponibles.</p>
      <ol><li><b>Travail</b> : vérifier les capacités des colons et activer construction, culture et transport. 1 est la plus forte priorité ; 0 désactive un métier. Planning règle les heures de repos, de loisirs et de travail.</li><li><b>Zones → Réserve</b> : tracer des cases accessibles, puis inspecter la réserve pour choisir ses filtres et sa priorité. Les transporteurs y regroupent les objets physiques. Une étagère construite offre trois piles par case et ses propres filtres.</li><li><b>Ordres</b> : récolter les plantes mûres et abattre les arbres. Les produits apparaissent au sol ; ils doivent être transportés. Pour les armes initiales, sélectionner un seul colon, faire un clic droit sur l’arme au sol et choisir Équiper. Les politiques d’Assignation ne choisissent pas une arme à sa place.</li><li><b>Architecte → Meubles / Structure</b> : un couchage au sol est immédiat et gratuit ; un lit, des murs et des portes demandent des matériaux livrés puis du travail de construction. <b>Q / E</b> tourne le meuble. Inspecter un chantier indique ce qui lui manque.</li><li><b>Zones → Culture</b> : choisir une plante adaptée au sol et au climat. Le riz pousse vite ; une zone dessinée ne fournit pas de nourriture immédiatement. Le semis et la récolte demandent un colon affecté à Culture.</li><li><b>Architecte → Production</b> : construire une cuisinière et ajouter une facture de repas dans son inspection. Il faut un cuisinier, des ingrédients accessibles et, selon le poste, du combustible ou de l’électricité.</li><li><b>Abri et santé</b> : contrôler le toit au-dessus des couchages et la température des pièces. Un couchage affecté aux soins, un médecin et des médicaments accessibles permettent les soins ; inspecter Santé pour comprendre une blessure. Les alertes conduisent aux personnes concernées.</li><li><b>Menu → Sauvegardes</b> : créer une copie nommée (jusqu’à douze) ou <b>Exporter la partie actuelle</b> pour conserver son checkpoint en JSON. Trois copies automatiques tournent à un intervalle de jeu actif réglable dans les Options, cinq minutes réelles par défaut ; la pause ne déclenche pas ces captures. Les copies locales appartiennent à ce navigateur et cette adresse. <b>Charger une partie</b> ou <b>Importer un fichier</b> reprend en pause. Exporter avant de quitter : fermer l’onglet ne garantit pas une dernière sauvegarde automatique.</li></ol>
      <p><b>Conseils</b>, en haut à droite, montre l’état actuel des premières préparations. Ce carnet est facultatif : il ne donne aucun objet, ne règle aucune priorité et ne remplace pas les alertes.</p>
      <p>Abattage, récolte, réserves et annulation : cliquer ou maintenir le bouton gauche pour tracer un rectangle. Les cases retenues sont surlignées. Relâcher applique ; Échap ou clic droit annule le tracé.</p>
      <p><b>Espace</b> : pause · <b>1 / 2 / 3</b> : vitesse · <b>Tab</b> : Architecte · <b>F1</b> : Travail · <b>F2</b> : Planning · <b>Échap</b> : annuler le tracé, puis fermer · <b>Ctrl+S</b> : sauvegarder.</p>
      <p>Molette : zoom · glisser le bouton droit : tourner · bouton central ou flèches : déplacer la caméra. La coupe des murs sert à voir les intérieurs ; leurs obstacles restent en place.</p>
      <p class="muted">Inspectez un chantier pour comprendre son attente, ou une réserve pour modifier ses filtres. Planning permet de régler les plages de travail et de repos. Un piquet de fers à cheval offre une autre famille de loisirs que l’observation du ciel. Les onglets grisés indiquent les domaines actuellement indisponibles.</p>
    </dialog>
    <dialog id="new-world-dialog" class="help-dialog"><form id="new-world-form"><button type="button" class="close" id="new-world-close" aria-label="Fermer la création">×</button><h2>Nouvelle colonie</h2>
      <label class="field">Graine<input id="world-seed" inputmode="numeric" type="number" min="0" max="4294967295" value="42" required></label>
      <label class="field">Taille de la carte<select id="world-size">${[32, ...MAP_SIZE_PRESETS].map(size => `<option value="${size}"${size === DEFAULT_MAP_SIZE ? ' selected' : ''}>${size} × ${size} · ${mapSizeLabels[size]} · ${(size * size).toLocaleString('fr-FR')} cases</option>`).join('')}</select></label>
      <label class="field">Scénario<select id="world-scenario">${Object.entries(SCENARIOS).map(([id,s])=>`<option value="${id}"${id===DEFAULT_SCENARIO?' selected':''}>${s.label}</option>`).join('')}</select></label>
      <p id="scenario-description">${SCENARIOS[DEFAULT_SCENARIO].description}</p>
      <p>Ce dialogue sert aux départs de diagnostic. Le menu public propose le choix du monde, du site et des personnes, avec les trois biomes actuels. Un scénario, sa graine et sa taille reproduisent le même départ de diagnostic. La partie actuelle restera accessible avec « Colonie précédente ».</p>
      <p id="new-world-error" role="alert" hidden></p>
      <button type="submit" class="primary-action">Créer la colonie</button>
    </form></dialog>
  </main>`;
}
