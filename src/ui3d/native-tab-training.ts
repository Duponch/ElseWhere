import type {NativeControl} from './native-contract';
import {CardBuilder,wrapCardText,type CardMeasure,type NativeTabCard} from './native-tab-card';
import {NATIVE_INK,NATIVE_LINE} from './native-ui-scale';

/** The Training tab of an animal (RimWorld `ITab_Pawn_Training`,
 * `TrainingCardUtility.DrawTrainingCard`). Core facts: the window is 300 wide
 * and `112 + 28 × rows` high; the card sits in the window contracted by 17 with
 * 10 more under the top edge; a `Listing_Standard` of labels of 22 (2 apart),
 * the master line of 25, a gap of 12, then one row of 28 per trainable: a
 * checkbox with the trainable's label (indented 10 per level) and, in a column
 * of 33 at the right edge, « steps / total » (green once learned). */
export interface TrainingLineSpec {id:string;label:string;value?:string;hint:string}
export interface TrainingRowSpec {id:string;label:string;steps:string;learned:boolean;wanted:boolean;disabled:boolean;hint:string;control:NativeControl}
export interface TrainingSpec {type:'training';lines:readonly TrainingLineSpec[];rows:readonly TrainingRowSpec[];minimumHeight?:number}
export const TRAINING_SIZE={width:300,margin:17,top:10,line:22,spacing:2,gap:12,row:28,column:50,columnShift:17} as const;
export function layoutTrainingTab(spec:TrainingSpec,measure:CardMeasure):NativeTabCard{
  const T=TRAINING_SIZE,inner={x:T.margin,y:T.margin+T.top,width:T.width-T.margin*2},builder=new CardBuilder(T.width,0,measure);
  let y=inner.y;
  for(const line of spec.lines){
    const text=line.value?`${line.label} : ${line.value}`:line.label,wrapped=wrapCardText(text,inner.width,measure,'small'),height=Math.max(T.line,wrapped.length*NATIVE_LINE.small);
    wrapped.forEach((entry,index)=>builder.label(inner.x,y+index*NATIVE_LINE.small,inner.width,entry));
    builder.target({id:'training-line:'+line.id,x:inner.x,y,w:inner.width,h:height,hint:line.hint,highlight:true});y+=height+T.spacing;
  }
  if(spec.rows.length)y+=T.gap;
  for(const row of spec.rows){
    const box=24;
    builder.glyph('check',inner.x,y+(T.row-box)/2,box,box,{on:row.wanted,disabled:row.disabled});
    builder.text(inner.x+box+4,y,inner.width-T.column-box-4,T.row,row.label,{truncate:true,ink:row.disabled?NATIVE_INK.disabled:NATIVE_INK.text});
    builder.text(inner.x+inner.width-T.column+T.columnShift,y,T.column-T.columnShift,T.row,row.steps,{ink:row.learned?NATIVE_INK.good:NATIVE_INK.text});
    builder.target({id:'training-row:'+row.id,x:inner.x,y,w:inner.width,h:T.row,hint:row.hint,control:row.control,highlight:true});
    y+=T.row;
  }
  builder.height=Math.max(y+T.margin,spec.minimumHeight??0);
  return builder.card();
}
