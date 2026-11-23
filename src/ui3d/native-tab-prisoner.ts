import type {NativeControl} from './native-contract';
import {CardBuilder,wrapCardText,type CardMeasure,type NativeTabCard} from './native-tab-card';
import {NATIVE_LINE} from './native-ui-scale';

/** The Prisoner tab (RimWorld `ITab_Pawn_Visitor`, `ITab_Pawn_Prisoner`). Core
 * facts: 280 wide, as tall as its content plus 20; a `Listing_Standard` in the
 * area contracted by 10 (labels of 22 and 2 between lines), then a row of 24
 * with « Autoriser les médicaments » on the left half and its button on the
 * right half, a gap of 4, and the interaction modes in a menu section (rows of
 * 28 inside a margin of 10, the radio button of 24 at the right edge). */
export interface PrisonerLineSpec {id:string;label:string;value?:string;hint:string}
export interface PrisonerModeSpec {id:string;label:string;selected:boolean;control:NativeControl;hint:string}
export interface PrisonerSpec {type:'prisoner';lines:readonly PrisonerLineSpec[];medical?:{label:string;value:string;control:NativeControl;hint:string};modes:readonly PrisonerModeSpec[]}
export const PRISONER_SIZE={width:280,pad:10,spacing:2,row:24,mode:28} as const;
export function layoutPrisonerTab(spec:PrisonerSpec,measure:CardMeasure):NativeTabCard{
  const P=PRISONER_SIZE,width=P.width-P.pad*2,builder=new CardBuilder(P.width,0,measure);
  let y=P.pad;
  for(const line of spec.lines){
    const text=line.value?`${line.label} : ${line.value}`:line.label,lines=wrapCardText(text,width,measure),height=lines.length*NATIVE_LINE.small;
    lines.forEach((entry,index)=>builder.label(P.pad,y+index*NATIVE_LINE.small,width,entry));
    builder.target({id:'prisoner-line:'+line.id,x:P.pad,y,w:width,h:height,hint:line.hint,highlight:true});y+=height+P.spacing;
  }
  if(spec.medical){
    y+=1;const half=width/2;
    builder.label(P.pad,y,half-4,spec.medical.label,{h:P.row,truncate:true});
    builder.button(P.pad+half+4,y,half-4,P.row,spec.medical.value,{dropdown:true,disabled:spec.medical.control.disabled});
    builder.target({id:'prisoner-medical',x:P.pad,y,w:width,h:P.row,hint:spec.medical.hint,control:spec.medical.control,highlight:true});
    y+=P.row+4;
  }
  if(spec.modes.length){
    const height=P.mode*spec.modes.length+20;builder.panel(P.pad,y,width,height);
    const inner=width-20;let rowY=y+10;
    for(const mode of spec.modes){
      builder.label(P.pad+10,rowY,inner-26,mode.label,{h:P.mode,truncate:true});
      builder.glyph('radio',P.pad+10+inner-24,rowY+2,24,24,{on:mode.selected,disabled:mode.control.disabled});
      builder.target({id:'prisoner-mode:'+mode.id,x:P.pad+10,y:rowY,w:inner,h:P.mode,hint:mode.hint,control:mode.control,highlight:true});
      rowY+=P.mode;
    }
    y+=height;
  }
  builder.height=y+P.pad;
  return builder.card();
}
