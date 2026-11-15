import type {NativeRow} from './native-contract';

/** Loading-screen tips written for Elsewhere's own controls and rules (no
 * text taken from the reference game). Each one describes something that the
 * current game does; update or remove a tip when its rule changes. */
export const GAMEPLAY_TIPS:readonly string[]=Object.freeze([
  // Interface et commandes
  'Espace met la partie en pause, puis la relance à la dernière vitesse choisie.',
  'Les touches 1, 2 et 3 règlent la vitesse sur ×1, ×3 et ×6.',
  'Tab ouvre Architecte. F1, F2 et F3 ouvrent Travail, Planning et Assignations.',
  'F8 ouvre Monde sur la liste des cartes de la campagne.',
  'H ouvre le carnet de survie : premiers gestes, commandes et conseils pour la colonie actuelle.',
  'Ctrl+S (⌘+S sur Mac) sauvegarde la partie en cours.',
  'La molette règle le zoom, le bouton droit glissé fait tourner la caméra, le bouton central ou les flèches la déplacent.',
  'Maintenez Alt au-dessus d’une case pour lire son terrain, sa fertilité, sa lumière, sa température et son toit.',
  'Q et E tournent un meuble ou un plan orientable avant sa pose.',
  'M, C, B, L, X et S choisissent directement Miner, Abattre, Mur, Lit, Annuler et Réserve.',
  'Avec des colons sélectionnés, R les mobilise ou les démobilise ; sans sélection, R choisit Récolter.',
  'Réserves, zones, abattage et récolte se tracent en rectangle : relâchez pour appliquer, Échap ou clic droit pour annuler le tracé.',
  'Avec un colon sélectionné, un clic droit sur une case liste les ordres réellement possibles à cet endroit.',
  'Maj ajoute un travail compatible à la file d’un colon au lieu de remplacer ce qu’il fait.',
  'Les boutons sous l’horloge coupent les murs, montrent les toits, masquent le feuillage ou les zones et recentrent la vue sur la colonie.',
  'Un clic sur une alerte, à droite, ouvre son détail et permet de repérer la personne ou le lieu concerné.',
  'Dans les Options, la pause automatique peut s’arrêter à toutes les menaces, aux seules menaces majeures, ou jamais.',
  // Premiers jours
  'Une nouvelle colonie commence en pause : Reprendre fait atterrir les capsules et libère les trois survivants.',
  'Du bois et de l’acier sont dispersés au sol dès l’arrivée : une réserve les regroupe à l’abri.',
  'Dans Travail, 1 est la priorité la plus forte et 0 désactive un métier.',
  'Un couchage au sol est gratuit et immédiat, mais on y récupère moins bien que dans un vrai lit.',
  'Une marque de couchage ne crée ni toit ni abri : murs, porte et toit protègent du froid et de la pluie.',
  'Une zone de culture ne nourrit personne tant que ses plants ne sont pas semés, mûrs et récoltés.',
  'Le riz mûrit en trois jours environ dans de bonnes conditions ; le maïs demande plus de onze jours mais rapporte bien davantage par plant.',
  'Les pommes de terre souffrent moins d’un sol pauvre que le riz ou le maïs.',
  'Une facture de repas, dans l’inspection d’une cuisinière ou d’un feu de camp, fait cuisiner un colon affecté à Cuisine.',
  'Une facture suspendue, ou sans ingrédient autorisé, ne produit rien.',
  'Pour équiper une arme au sol, sélectionnez un seul colon, faites un clic droit sur l’arme et choisissez Équiper.',
  'Inspectez un chantier pour savoir ce qui lui manque : matériaux, travail ou accès.',
  // Colonie
  'Une réserve de priorité plus haute attire les objets rangés dans une réserve de priorité plus basse.',
  'Une étagère construite range jusqu’à trois piles par case et possède ses propres filtres.',
  'Les objets laissés dehors se détériorent, plus vite sous la pluie ; un toit et des murs les protègent.',
  'La nourriture ne pourrit plus à 0 °C ou en dessous ; elle pourrit à pleine vitesse dès 10 °C.',
  'Dans la Zone de foyer, les colons réparent, nettoient et éteignent les incendies d’eux-mêmes.',
  'Interdire un objet au sol empêche les colons de le prendre ; Autoriser lève l’interdiction, case par case ou en rectangle.',
  'Déconstruire récupère environ la moitié des matériaux d’un bâtiment ; Désinstaller emballe un meuble pour le déplacer.',
  'Une porte en pierre s’ouvre bien plus lentement qu’une porte en bois : gardez-la à l’écart des passages fréquents.',
  'Planning règle, heure par heure, le sommeil, les loisirs et le travail de chaque colon.',
  'Assignations limite un colon à une zone autorisée et règle son régime, sa tenue et sa réaction aux menaces.',
  'La recherche avance au bureau de recherche, avec un colon affecté à Recherche dans Travail.',
  // Danger et santé
  'Un colon mobilisé abandonne son travail et attend vos ordres de déplacement ou de tir.',
  'Collés à des sacs de sable, vos tireurs profitent d’un couvert bas face aux tirs venus de l’autre côté.',
  'Un colon à terre se secourt par un clic droit d’un autre colon sur lui : Secourir le porte vers un couchage.',
  'Un couchage affecté aux soins, un médecin et des médicaments accessibles permettent de soigner les blessés.',
  'Une humeur sous le seuil personnel d’un colon l’expose à une crise ; l’alerte de risque de crise le signale à temps.',
  // Sauvegardes
  'Trois copies automatiques tournent selon l’intervalle choisi dans les Options ; la pause ne les déclenche pas.',
  'Exportez la partie pour garder un fichier indépendant du navigateur : fermer l’onglet ne garantit pas une dernière sauvegarde.',
]);

/** Real time between two tips, as on the reference loading screens. */
export const TIP_INTERVAL_MS=17_500;

export interface TipRotator {
  /** Tip to show now; the first call after a reset moves to the next tip. */
  current(now:number):string;
  /** No loading screen is shown: the next one starts with a new tip. */
  reset():void;
}

/** Tips in one random order kept for the whole session; the shown tip moves
 * on every 17.5 s of real time and as soon as a new loading screen opens. */
export function createTipRotator(options:{tips?:readonly string[];random?:()=>number}={}):TipRotator {
  const source=options.tips??GAMEPLAY_TIPS,random=options.random??Math.random;
  let order:readonly string[]|undefined,index=-1,shownAt=-1;
  return {
    current(now){
      if(!order){
        const shuffled=[...source];
        for(let i=shuffled.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[shuffled[i],shuffled[j]]=[shuffled[j]!,shuffled[i]!];}
        order=shuffled;
      }
      if(!order.length)return '';
      if(shownAt<0||now-shownAt>TIP_INTERVAL_MS){index=(index+1)%order.length;shownAt=now;}
      return order[index]!;
    },
    reset(){shownAt=-1;},
  };
}

/** One rotator shared by the loading and world-generation screens. */
export const loadingTips:TipRotator=createTipRotator();

export function nativeTipRow(tip:string,region?:NativeRow['region']):NativeRow {
  return {id:'loading-tip',label:'Astuce',detail:tip,...region?{region}:{}};
}
