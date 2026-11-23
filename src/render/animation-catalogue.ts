/** Catalogue of the people and animal animations (page « Animations »,
 * animations.html; retours du 22 novembre, point 7). Pure data: each entry
 * gives the presentation streams that select the animation in the resident
 * rigs (pose, activity, locomotion, cargo, strike clock) and the real game
 * state that produces it, so the page plays exactly what the game draws and
 * a test can check that every entry is reachable from a real state. */
import {HUMAN_GESTURE,ANIMAL_POSTURE_DOWNED} from './actor-idle-gestures';
import {POSE_SLEEP,POSE_DEAD,POSE_FIGHT_READY,READING_ACTIVITY295} from '../bridge/actor-phase-dependencies-297';
import {WORK_POSE} from './work-presentation';
import type {ItemId} from '../sim/items';

export type AnimationGroup='repos'|'loisirs'|'travail'|'deplacement'|'allonge'|'combat';
export const ANIMATION_GROUP_LABELS:Readonly<Record<AnimationGroup,string>>=Object.freeze({
  repos:'Repos et besoins',loisirs:'Loisirs',travail:'Travail',deplacement:'Déplacements',allonge:'Allongé',combat:'Combat et santé',
});
export interface HumanAnimation {
  readonly id:string;readonly label:string;readonly group:AnimationGroup;readonly description:string;
  /** Real state that selects it, in words (checked by the tests). */
  readonly state:string;
  readonly pose:number;readonly activity:number;readonly walking?:boolean;
  readonly cargo?:ItemId;
  /** The strike/shot clock (aMotion.w) restarts every `repeat` seconds. */
  readonly repeat?:number;readonly downed?:boolean;readonly carried?:boolean;
}
export const HUMAN_ANIMATIONS:readonly HumanAnimation[]=Object.freeze([
  {id:'idle',label:'Debout, au repos',group:'repos',pose:0,activity:0,state:'inoccupé, en attente, ou arrêté entre deux tâches',
    description:'Respire, se balance un peu, regarde autour de lui en tenant la tête à gauche puis à droite ; toutes les 17 s environ, porte une main à la tête.'},
  {id:'walk',label:'Marche',group:'deplacement',pose:0,activity:0,walking:true,state:'tout déplacement',
    description:'Jambes et bras au pas, la phase suit la distance réellement parcourue ; les pieds se rejoignent à l’arrêt.'},
  {id:'carry',label:'Porter une charge',group:'deplacement',pose:0,activity:0,walking:true,cargo:'wood',state:'transport d’une pile',
    description:'Les bras tiennent la charge devant soi pendant la marche.'},
  {id:'eat-table',label:'Manger à table',group:'repos',pose:3,activity:HUMAN_GESTURE.eat,cargo:'simple-meal',state:'repas assis sur une chaise devant une table',
    description:'Assis, penché vers l’assiette ; chaque bouchée monte à la bouche et la tête vient à sa rencontre.'},
  {id:'eat-standing',label:'Manger debout',group:'repos',pose:2,activity:HUMAN_GESTURE.eat,cargo:'simple-meal',state:'repas sans table ni chaise',
    description:'Debout, le repas en main ; la tête accompagne chaque bouchée.'},
  {id:'read-seated',label:'Lire assis',group:'loisirs',pose:3,activity:READING_ACTIVITY295,cargo:'novel',state:'lecture d’un livre sur un siège',
    description:'Le livre ouvert tenu immobile, les yeux baissés ; une page tournée de temps en temps.'},
  {id:'read-standing',label:'Lire debout',group:'loisirs',pose:0,activity:READING_ACTIVITY295,cargo:'novel',state:'lecture d’un livre sans siège',
    description:'Debout, le livre ouvert devant soi, la tête penchée ; une page tournée de temps en temps.'},
  {id:'table-game',label:'Jeu de table',group:'loisirs',pose:3,activity:HUMAN_GESTURE.tableGame,state:'échecs, poker ou jeu d’Ur sur un siège',
    description:'Avant-bras sur la table, regard sur le plateau ; lève les yeux vers l’adversaire et avance une pièce de temps en temps.'},
  {id:'television',label:'Regarder la télévision',group:'loisirs',pose:3,activity:HUMAN_GESTURE.television,state:'télévision sur un siège',
    description:'Adossé, les mains sur les genoux ; un rire de temps en temps secoue la tête et penche le corps.'},
  {id:'chat-seated',label:'Discuter assis',group:'loisirs',pose:3,activity:HUMAN_GESTURE.chat,state:'détente sociale ou visite à un malade, sur un siège',
    description:'Parle avec les mains puis écoute en hochant la tête, tourné vers les autres.'},
  {id:'party',label:'Fête : discuter debout',group:'loisirs',pose:0,activity:HUMAN_GESTURE.chat,state:'fête de la colonie',
    description:'Debout, parle avec les mains puis écoute en hochant la tête, regarde autour de lui.'},
  {id:'view-art',label:'Admirer une œuvre d’art',group:'loisirs',pose:0,activity:HUMAN_GESTURE.viewArt,state:'admirer une sculpture',
    description:'Mains dans le dos, le regard levé vers l’œuvre, qu’il parcourt lentement.'},
  {id:'throw',label:'Lancer (fer à cheval, anneau, billard)',group:'loisirs',pose:4,activity:0,state:'fer à cheval, anneau de pierre ou billard',
    description:'Le bras lance en cadence vers la cible.'},
  {id:'skygaze',label:'Regarder le ciel',group:'loisirs',pose:5,activity:0,state:'contemplation du ciel',
    description:'Allongé sur le dos, respire et tourne doucement la tête.'},
  {id:'bench-cook',label:'Cuisiner assis',group:'travail',pose:3,activity:2,state:'facture à un fourneau avec un tabouret sur la case de travail',
    description:'Assis face au fourneau, penché sur la préparation ; les mains remuent à la cadence de la cuisine.'},
  {id:'bench-research',label:'Chercher assis',group:'travail',pose:3,activity:3,state:'recherche à un bureau avec une chaise',
    description:'Assis au bureau, la tête baissée ; les mains notent et tapotent lentement.'},
  {id:'bench-craft',label:'Fabriquer assis',group:'travail',pose:3,activity:1,state:'facture à un établi avec un tabouret',
    description:'Assis à l’établi, penché sur l’ouvrage ; les mains travaillent en alternance.'},
  {id:'craft',label:'Fabriquer debout',group:'travail',pose:WORK_POSE.craft,activity:1,state:'facture à un établi sans siège',
    description:'Debout à l’établi, les mains travaillent en alternance.'},
  {id:'cook',label:'Cuisiner debout',group:'travail',pose:WORK_POSE.craft,activity:2,state:'facture à un fourneau sans siège',
    description:'Debout au fourneau, remue la préparation.'},
  {id:'mine',label:'Miner',group:'travail',pose:WORK_POSE.mine,activity:-31,state:'minage d’une roche',
    description:'La pioche frappe la roche au rythme du travail, le torse accompagne.'},
  {id:'chop',label:'Abattre un arbre',group:'travail',pose:WORK_POSE.chop,activity:-30,state:'abattage',
    description:'La hache frappe le tronc, l’autre main tient le manche.'},
  {id:'build',label:'Construire',group:'travail',pose:WORK_POSE.build,activity:1,state:'construction ou réparation',
    description:'Un bras frappe, l’autre tient la pièce.'},
  {id:'ground',label:'Travail au sol',group:'travail',pose:WORK_POSE.ground,activity:-32,state:'semis, récolte ou coupe d’une plante',
    description:'Accroupi, les mains travaillent au sol à la faucille.'},
  {id:'sleep',label:'Dormir',group:'allonge',pose:POSE_SLEEP,activity:0,state:'sommeil dans un lit ou par terre',
    description:'Allongé, les yeux fermés ; la poitrine se soulève lentement.'},
  {id:'rest',label:'Allongé éveillé',group:'allonge',pose:1,activity:0,state:'repos au lit ou convalescence',
    description:'Allongé, respire et tourne la tête sur l’oreiller.'},
  {id:'downed',label:'À terre',group:'combat',pose:1,activity:HUMAN_GESTURE.downed,downed:true,state:'blessé à terre, hors d’un lit',
    description:'Comme dans le jeu de base, le corps pivote lentement sur le sol (31,5° puis retour, toutes les 10 s) ; respiration courte, une main se tend.'},
  {id:'carried',label:'Porté',group:'combat',pose:6,activity:0,carried:true,state:'secouru ou capturé, porté par un autre',
    description:'Porté en travers des épaules du porteur.'},
  {id:'dead',label:'Mort',group:'combat',pose:POSE_DEAD,activity:0,state:'mort',
    description:'Allongé, immobile, les yeux en croix.'},
  {id:'melee-ready',label:'En garde',group:'combat',pose:POSE_FIGHT_READY,activity:0,state:'bagarre sociale ou corps à corps en attente',
    description:'Garde haute, le corps danse d’un pied sur l’autre.'},
  {id:'melee-strike',label:'Frappe au corps à corps',group:'combat',pose:8,activity:0,repeat:1.2,state:'coup de corps à corps',
    description:'Le bras frappe et tout le corps se projette vers la cible, comme dans le jeu de base.'},
  {id:'aim',label:'Viser',group:'combat',pose:7,activity:0,state:'tir en préparation',
    description:'Les deux bras tendus vers la cible.'},
  {id:'shoot',label:'Tirer',group:'combat',pose:15,activity:0,repeat:1,state:'tir',
    description:'Le recul du tir relève les bras puis ils reviennent en joue.'},
  {id:'vomit',label:'Vomir',group:'combat',pose:10,activity:0,state:'intoxication alimentaire, grippe ou paludisme',
    description:'À genoux, penché en avant.'},
  {id:'stunned',label:'Étourdi',group:'combat',pose:9,activity:0,state:'étourdissement',
    description:'Debout, immobile un instant.'},
]);

export interface AnimalAnimation {
  readonly id:string;readonly label:string;readonly description:string;readonly state:string;
  readonly moving:number;readonly eating:number;readonly posture:number;readonly repeat?:number;
}
export const ANIMAL_ANIMATIONS:readonly AnimalAnimation[]=Object.freeze([
  {id:'idle',label:'Debout, au repos',moving:0,eating:0,posture:0,state:'animal inoccupé ou en attente',
    description:'Respire et regarde autour de lui. Les herbivores baissent la tête pour brouter, les oiseaux picorent et ébouriffent leurs ailes, la queue bat (vite chez les chiens et les loups, en balancement lent chez les félins), et les mammifères s’ébrouent de temps en temps.'},
  {id:'walk',label:'Marche et course',moving:1,eating:0,posture:0,state:'tout déplacement',
    description:'Pattes en diagonale au pas, le corps rebondit ; la phase suit la distance parcourue.'},
  {id:'eat',label:'Manger',moving:0,eating:1,posture:0,state:'repas : plante ou nourriture au sol',
    description:'La tête baissée mâche en cadence.'},
  {id:'attack',label:'Attaque',moving:0,eating:2,posture:0,repeat:1.2,state:'morsure, griffes ou charge',
    description:'La tête frappe et tout le corps se projette vers la cible.'},
  {id:'rest',label:'Couché, endormi',moving:0,eating:0,posture:1,state:'sommeil ou repos',
    description:'Couché sur le flanc ; le corps se soulève à chaque respiration, la queue bouge à peine.'},
  {id:'downed',label:'À terre',moving:0,eating:0,posture:ANIMAL_POSTURE_DOWNED,state:'blessé à terre',
    description:'Comme dans le jeu de base, le corps pivote lentement sur le sol ; respiration courte.'},
  {id:'dead',label:'Mort',moving:0,eating:0,posture:2,state:'mort',
    description:'Couché sur le flanc, les yeux en croix.'},
]);

/** Action particles (lot « particules », point 8). Hook: the particles
 * catalogue registers its list here when it lands; the page shows it. */
export interface ActionParticleEntry {readonly id:string;readonly label:string;readonly description:string}
const particleEntries:ActionParticleEntry[]=[];
export function registerActionParticles(entries:readonly ActionParticleEntry[]):void {particleEntries.splice(0,particleEntries.length,...entries);}
export function actionParticles():readonly ActionParticleEntry[]{return particleEntries;}
