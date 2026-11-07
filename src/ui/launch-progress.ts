/** Loading-screen model for opening a colony (save loading or creation).
 * Presentation only: it observes reported steps and never drives them. */
export type LaunchKind='load'|'create';
export type LaunchStage=
  |'backup'|'read'|'migrate'|'validate'|'restore'|'map'|'publish'
  |'renderer'|'world'|'surfaces'|'scene'|'actors'|'shadows';

const LABELS:Record<LaunchStage,string>={
  backup:'Copie de sécurité de la colonie ouverte',
  read:'Lecture de la sauvegarde',
  migrate:'Mise à jour de la sauvegarde',
  validate:'Vérification de la colonie',
  restore:'Restauration du monde',
  map:'Génération de la carte',
  publish:'Transmission à l’affichage',
  renderer:'Initialisation du rendu',
  world:'Construction de la scène',
  surfaces:'Préparation des surfaces',
  scene:'Compilation des matériaux',
  actors:'Préparation des personnages',
  shadows:'Préparation des ombres',
};
/** Expected seconds on the reference machine; they only shape the bar. The
 * migration weight is set from the number of versions actually crossed. */
const WEIGHTS:Record<LaunchStage,number>={backup:2,read:1,migrate:0,validate:2,restore:1,map:10,publish:4,renderer:.5,world:6,surfaces:8,scene:3,actors:12.5,shadows:.5};
const MIGRATION_SECONDS_PER_VERSION=.8;
const ORDER:Record<LaunchKind,readonly LaunchStage[]>={
  load:['backup','read','migrate','validate','restore','publish','renderer','world','surfaces','scene','actors','shadows'],
  create:['backup','map','validate','publish','renderer','world','surfaces','scene','actors','shadows'],
};
/** Colony map generation steps reported by the Worker, by name prefix. */
const MAP_PHASES:readonly [RegExp,string][]=[
  [/^physical/i,'relief et terrain'],[/^roads/i,'routes'],[/^scatter/i,'ruines et sanctuaires'],[/^findplayerstart/i,'point d’arrivée'],
  [/^scenparts/i,'éléments du scénario'],[/^plants/i,'végétation'],[/^steamgeysers/i,'geysers'],[/^rockchunks/i,'débris rocheux'],
  [/^cavehives/i,'grottes'],[/^snow/i,'neige'],[/^animals/i,'faune'],[/^fog/i,'brouillard'],[/^mutator/i,'finitions'],[/^validated/i,'vérification'],
];

/** Planet generation phases in the Worker's order, with expected seconds. */
const PLANET_PHASES:readonly [string,string,number][]=[
  ['mesh','Géométrie de la planète',.7],['terrain','Reliefs et biomes',3.2],['lakes','Lacs',.1],['rivers','Rivières',.1],
  ['ancient-sites','Sites anciens',.4],['ancient-roads','Anciennes routes',.1],['foreign-factions','Factions et implantations',.2],
  ['road-prospects','Tracé des routes',2.1],['road-drawing','Routes',2],['terrain-modifiers','Particularités du terrain',1.5],
];
const PLANET_TOTAL=PLANET_PHASES.reduce((sum,[, ,weight])=>sum+weight,0);
/** Label and overall fraction of a planet generation step; unknown phases keep
 * the last known fraction. */
export function planetGenerationStep(phase:string,completed:number,total:number):{label:string;fraction:number}|undefined {
  const index=PLANET_PHASES.findIndex(([id])=>id===phase);if(index<0)return undefined;
  let before=0;for(let i=0;i<index;i++)before+=PLANET_PHASES[i]![2];
  const within=total>0?Math.min(1,completed/total):0;
  return {label:PLANET_PHASES[index]![1],fraction:Math.min(.99,(before+PLANET_PHASES[index]![2]*within)/PLANET_TOTAL)};
}

export interface LaunchProgressView {
  title:string;
  /** 0..1, never decreasing. */
  fraction:number;
  stage:string;
  detail:string;
  /** 0..1 within the current step. */
  stageFraction:number;
  elapsedSeconds:number;
  steps:readonly {label:string;state:'done'|'active'|'pending'}[];
}

export class LaunchProgress {
  private readonly order:readonly LaunchStage[];
  private readonly weights:Record<LaunchStage,number>={...WEIGHTS};
  /** Steps passed without any report (no migration for a current save, no
   * open colony to back up...): they leave the bar and the list. */
  private readonly skipped=new Set<LaunchStage>();
  private current=0;
  private sub=0;
  private detail='';
  private shown=0;
  constructor(readonly kind:LaunchKind,private readonly startedAt:number,hadColony:boolean){
    this.order=ORDER[kind];
    if(!hadColony){this.skipped.add('backup');this.current=1;}
  }
  /** Moves forward only: a late report for an earlier step is ignored. */
  report(stage:LaunchStage,completed=0,total=1,phase?:string):void {
    const index=this.order.indexOf(stage);
    if(index<0||index<this.current)return;
    if(stage==='migrate'&&total>0)this.weights.migrate=total*MIGRATION_SECONDS_PER_VERSION;
    for(let i=this.current+1;i<index;i++)this.skipped.add(this.order[i]!);
    if(index>this.current){this.current=index;this.sub=0;}
    this.sub=Math.max(this.sub,total>0?Math.min(1,completed/total):0);
    this.detail=detailFor(stage,completed,total,phase);
  }
  view(now:number):LaunchProgressView {
    let total=0,done=0;
    for(const [i,stage] of this.order.entries()){
      if(this.skipped.has(stage))continue;
      const weight=this.weights[stage];total+=weight;
      if(i<this.current)done+=weight;else if(i===this.current)done+=weight*this.sub;
    }
    this.shown=Math.max(this.shown,total>0?Math.min(.995,done/total):0);
    const stage=this.order[this.current]!;
    return {
      title:this.kind==='create'?'Création de la colonie':'Chargement de la colonie',
      fraction:this.shown,stage:LABELS[stage],detail:this.detail,stageFraction:this.sub,
      elapsedSeconds:Math.max(0,Math.floor((now-this.startedAt)/1000)),
      steps:this.order.flatMap((s,i)=>this.skipped.has(s)||s==='migrate'&&this.weights.migrate===0?[]
        :[{label:LABELS[s],state:i<this.current?'done' as const:i===this.current?'active' as const:'pending' as const}]),
    };
  }
}

function detailFor(stage:LaunchStage,completed:number,total:number,phase?:string):string {
  if(stage==='map'&&phase){const label=MAP_PHASES.find(([pattern])=>pattern.test(phase))?.[1];return label?`Étape ${Math.min(total,completed+1)} / ${total} · ${label}`:'';}
  if(stage==='migrate')return total>0?`Version ${completed} / ${total} à mettre à jour`:'';
  if(stage==='scene')return total>1?`${completed} / ${total} objets`:'';
  if(stage==='actors')return total===2?(completed===0?'Variantes de corps':'Ombres de la scène'):'';
  return '';
}
