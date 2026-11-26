import type {Pawn,World} from '../sim/types';
/** Player-facing descriptions of accepted jobs, independent from the command
 * discriminants used by the Worker. No target becomes a new work order. */
const labels:Readonly<Record<string,string>>={
 'order-job':'Travail prioritaire','order-cook':'Production','order-haul':'Transport',
 'order-consume':'Consommer','order-capture':'Capturer','order-arrest':'Arrêter',
 'order-feed':'Nourrir','order-tend':'Soigner','order-drafted-tend':'Soigner en étant mobilisé',
 'order-rescue':'Secourir','order-equipment':'Équipement','order-bury':'Enterrer',
 'clean-room':'Nettoyer','order-strip':'Déshabiller','order-open-casket':'Ouvrir le caisson',
 'order-animal-rescue':'Secourir un animal','order-extinguish':'Éteindre',
 'read-book-295':'Lire','order-open-cryptosleep':'Ouvrir le caisson',
 'order-enter-cryptosleep':'Entrer dans le caisson','order-carry-cryptosleep':'Porter au caisson',
 'order-enter-ship-casket':'Entrer dans le caisson du vaisseau','order-carry-ship-casket':'Porter au vaisseau',
 'firefoam-trigger':'Déclencher la mousse','draft-move':'Se déplacer','shoot':'Tirer','melee':'Attaquer au contact',
};
export function queuedOrderLabels378(w:World,p:Pawn):string[] {
 const legacy=p.orders.queue.map(id=>w.jobs.some(job=>job.id===id)?'Travail prioritaire':'Travail planifié');
 const personal=(p.orderedQueue378??[]).map(c=>c.type==='order-animal-378'?({hunt:'Chasser',tame:'Apprivoiser',slaughter:'Abattre'})[c.action]:labels[c.type]??'Travail imposé');
 return [...legacy,...personal,...(p.draft?.queue??[]).map(()=> 'Se déplacer')];
}
