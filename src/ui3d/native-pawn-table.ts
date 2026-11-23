/** The pawn tables of RimWorld (`PawnTable`, `PawnColumnWorker_*`, `WidgetsWork`)
 * as numbers and pure functions: row height, header height, column widths
 * (minimum, optimal and maximum of each worker class), the way `PawnTable`
 * shares the free width, and the full short labels of the work columns. The
 * layout and the painter read them; nothing here draws or touches the World. */

/** `PawnTable`/`MainTabWindow_PawnTable`/`WidgetsWork` constants. */
export const PAWN_TABLE={
  /** `PawnColumnWorker.GetMinCellHeight`. */
  rowHeight:30,
  /** `PawnColumnWorker_WorkPriority.GetMinHeaderHeight` (LabelRowHeight). */
  workHeaderHeight:50,
  /** Margin of the window, scroll bar of the table. */
  margin:6,scrollbar:16,
  /** `PawnTableDef.minWidth`. */
  minWidth:998,
  /** Work box: 25 × 25, centred in the cell, 2.5 below the top. */
  workBox:25,workBoxTop:2.5,
  /** The label of the work column moves down by 20 on every other column. */
  workLabelShift:20,
  /** Tiny gap column (`GapTiny`). */
  gapTiny:4,
  /** Header text a column keeps (the Small line). */
  headerLine:22,
} as const;

/** One column: `GetMinWidth`, `GetOptimalWidth`, `GetMaxWidth`. */
export interface PawnColumnWidth{min:number;optimal:number;max:number}
const OPEN=1_000_000;
export const col=(min:number,optimal=min,max=optimal):PawnColumnWidth=>({min,optimal,max});
/** Widths of the worker classes (Label 80/165, WorkPriority 32/39/80, Timetable
 * 360/504/600 shared by 24 hours, Outfit and its siblings 194/251, AllowedArea
 * 200/273, Checkbox 28, Icon 26, Master 100/170...). */
export const PAWN_COLUMN={
  label:col(80,165,OPEN),
  work:col(32,39,80),
  hour:col(15,21,25),
  area:col(200,273),
  policy:col(194,251),
  checkbox:col(28),
  icon:col(26),
} as const;

/** `PawnTable.RecacheColumnWidths`: start at the minimums, give the free width
 * in proportion to the optimal widths up to each optimum, then in proportion to
 * the optimal widths up to each maximum, then without limit. When the minimums
 * do not fit, the widths stay at the minimums (Elsewhere scrolls sideways where
 * the game squeezes). Integers; the last column takes the remainder, as in the
 * game. */
export function pawnTableWidths(columns:readonly PawnColumnWidth[],available:number):number[]{
  const widths=columns.map(c=>c.min);let used=widths.reduce((a,b)=>a+b,0);
  if(used>=available||!columns.length)return widths;
  for(let pass=0;pass<2;pass++){
    const limit=(c:PawnColumnWidth)=>pass===0?c.optimal:c.max;
    for(let guard=0;guard<32&&used<available-.1;guard++){
      const open=columns.map((c,i)=>widths[i]!<limit(c)?i:-1).filter(i=>i>=0);if(!open.length)break;
      const total=open.reduce((a,i)=>a+Math.max(columns[i]!.optimal,1),0),free=available-used;
      for(const i of open){const share=free*Math.max(columns[i]!.optimal,1)/total,room=limit(columns[i]!)-widths[i]!,take=Math.min(share,room);widths[i]!+=take;used+=take;}
    }
  }
  if(used<available-.1){const total=columns.reduce((a,c)=>a+Math.max(c.optimal,1),0),free=available-used;columns.forEach((c,i)=>{widths[i]=widths[i]!+free*Math.max(c.optimal,1)/total;});}
  const whole=widths.map(Math.floor);whole[whole.length-1]=Math.max(whole[whole.length-1]!,Math.floor(available)-whole.slice(0,-1).reduce((a,b)=>a+b,0));
  return whole;
}
/** Width the table asks for: the sum of the optimal widths, kept between the
 * definition's minimum and the screen (`PawnTable.RecacheSize`). */
export function pawnTableTarget(columns:readonly PawnColumnWidth[],screen:number):number{
  const optimal=columns.reduce((a,c)=>a+Math.min(c.optimal,OPEN/2),0);
  return Math.max(Math.min(optimal,screen),Math.min(PAWN_TABLE.minWidth-PAWN_TABLE.scrollbar,screen));
}

/** Full short labels of the work columns (`WorkTypeDef.labelShort`), adapted in
 * French; written whole above their vertical line, never abbreviated. */
export const WORK_COLUMN_LABEL:Readonly<Record<string,string>>={
  firefight:'Incendie',patient:'Patient',doctor:'Médecin',bedrest:'Repos',basic:'Corvées',warden:'Geôlier',handle:'Dressage',cook:'Cuisine',hunt:'Chasse',build:'Construire',
  grow:'Cultiver',mine:'Miner',gather:'Plantes',smith:'Forge',tailor:'Couture',art:'Art',craft:'Artisanat',haul:'Transport',clean:'Nettoyage',research:'Recherche',
};
/** Core moves the label of every other work column down (`PawnColumnDefGenerator`:
 * the flag flips before it is given, so the first column is lowered). */
export const workLabelDown=(workIndex:number):boolean=>workIndex%2===0;

export type PawnTableKind='work'|'schedule'|'assign'|'animals'|'wildlife';
/** Exact column geometry of one table, in pixels, from the left edge. */
export interface PawnTableSpec{
  /** Width of the name column (pinned on the left). */
  name:number;
  /** Width of the activity column after the matrix (0 without it). */
  tail:number;
  widths:number[];
  /** Sum of every width (name, matrix, activity). */
  total:number;
  rowHeight:number;headerHeight:number;
}
/** Matrix columns of a table, in the order of the page. `labels` are the
 * headings (their longest word keeps the column from cutting a word). */
export function pawnTableColumns(kind:PawnTableKind,labels:readonly string[],wordWidth:(text:string)=>number):PawnColumnWidth[]{
  const word=(label:string)=>Math.ceil(Math.max(0,...label.split(/\s+/).map(wordWidth)))+2;
  const widen=(c:PawnColumnWidth,label:string)=>{const w=word(label);return col(Math.max(c.min,w),Math.max(c.optimal,w),Math.max(c.max,w));};
  if(kind==='work')return labels.map((_,i)=>i<2?col(58):PAWN_COLUMN.work);
  if(kind==='schedule')return labels.map((_,i)=>i<2?col(58):PAWN_COLUMN.hour);
  if(kind==='animals'||kind==='wildlife'){
    // Text and button cells of the animal tables: the heading's longest word is the floor.
    const animal:Record<string,PawnColumnWidth>={Sexe:col(40,64),Âge:col(56,70),Maturité:col(80,100),Soins:col(120,150),'Zone / enclos':col(150,200),Produit:col(90,110),Transport:col(90,110),Abattre:col(130,170),Repérer:col(70,80),Dossier:col(70,80),Position:col(70,90),Chasse:col(150,170),'Rage si blessé':col(96,110),Apprivoiser:col(170,200),'Rage si raté':col(96,110),Tirer:col(60,70),Mêlée:col(60,70)};
    return labels.map(label=>widen(animal[label]??col(80,100),label));
  }
  const base:Record<string,PawnColumnWidth>={Hostilité:col(84,90),Tenue:PAWN_COLUMN.policy,Auto:col(56,60),'Port forcé':col(76),Régime:PAWN_COLUMN.policy,Drogues:PAWN_COLUMN.policy,Lecture:PAWN_COLUMN.policy,Zone:PAWN_COLUMN.area};
  return labels.map(label=>widen(base[label]??PAWN_COLUMN.policy,label));
}
/** The whole table: name, matrix, activity. `screen` is the usable content width. */
export function pawnTableSpec(kind:PawnTableKind,labels:readonly string[],screen:number,wordWidth:(text:string)=>number,withTail:boolean):{spec:PawnTableSpec;target:number}{
  const matrix=pawnTableColumns(kind,labels,wordWidth),tail=withTail?col(150,192):undefined;
  const all=[PAWN_COLUMN.label,...matrix,...(tail?[tail]:[])],target=pawnTableTarget(all,screen),widths=pawnTableWidths(all,target);
  const name=widths[0]!,cells=widths.slice(1,1+matrix.length),tailWidth=tail?widths[widths.length-1]!:0;
  return {target:Math.max(target,widths.reduce((a,b)=>a+b,0)),spec:{name,tail:tailWidth,widths:cells,total:widths.reduce((a,b)=>a+b,0),rowHeight:PAWN_TABLE.rowHeight,headerHeight:kind==='work'?PAWN_TABLE.workHeaderHeight:kind==='schedule'?24:kind==='assign'?36:40}};
}
