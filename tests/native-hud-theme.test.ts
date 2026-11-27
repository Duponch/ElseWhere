import {expect,test} from 'vitest';
import {PALETTE,seededRandom} from '../src/ui3d/prototype-art';
import {NATIVE_INK} from '../src/ui3d/native-ui-scale';
import {drawNativeColonistBand379} from '../src/ui3d/native-colonist-card-379';
import {NativeLetterStack} from '../src/ui3d/native-letter-stack';
import {LETTER_CLASSES_352} from '../src/sim/letters-352';
import {readableUiInk,uiContrast} from '../src/ui3d/ui-theme';

test('colonist card surfaces read the current theme while portrait pigments and mood colours keep their meaning',()=>{
  const previous={...PALETTE},barBack=NATIVE_INK.barBack,styles:string[]=[];
  const ctx=new Proxy({},{get:()=>()=>undefined,set:(_target,_key,value)=>{if(typeof value==='string')styles.push(value);return true;}}) as CanvasRenderingContext2D;
  const col={name:'Ada',mood:80,selected:false,skin:'#c28e68',shirt:'#6a8f85',loaded:false};
  try{
    Object.assign(PALETTE,{inkDark:'#fafafa',creamPaper:'#20242a',kraftBase:'#30343a',kraftLight:'#383d43'});NATIVE_INK.barBack='#40464f';
    drawNativeColonistBand379(col,ctx,seededRandom(42),0);expect(styles).toContain('#30343a');expect(styles).toContain('#fafafa');styles.length=0;
    drawNativeColonistBand379(col,ctx,seededRandom(42),1);expect(styles).toContain('#383d43');expect(styles).toContain(col.skin);expect(styles).toContain(col.shirt);styles.length=0;
    drawNativeColonistBand379(col,ctx,seededRandom(42),4);expect(styles).toContain('#fafafa');styles.length=0;
    drawNativeColonistBand379(col,ctx,seededRandom(42),5);expect(styles).toContain('#40464f');expect(styles).toContain('#639452');
  }finally{Object.assign(PALETTE,previous);NATIVE_INK.barBack=barBack;}
});

test('letter ink stays readable on its semantic class colour in a dark UI without changing the letter artwork',()=>{
  const previous={...PALETTE},classes=JSON.stringify(LETTER_CLASSES_352),styles:string[]=[];
  const ctx=new Proxy({},{get:(_target,key)=>key==='measureText'?()=>({width:20}):()=>undefined,set:(_target,_key,value)=>{if(typeof value==='string')styles.push(value);return true;}}) as CanvasRenderingContext2D;
  try{
    Object.assign(PALETTE,{inkDark:'#fafafa',creamPaper:'#20242a'});
    const stack=Object.create(NativeLetterStack.prototype),background=LETTER_CLASSES_352['threat-big'].color;
    stack.drawCard(ctx,200,32,seededRandom(42),{letter:{cls:'threat-big'},width:200,flashing:false},'Menace');
    const ink=readableUiInk(PALETTE.inkDark,background);expect(uiContrast(ink,background)).toBeGreaterThanOrEqual(4.5);
    expect(styles).toContain(ink);expect(styles).toContain(PALETTE.creamPaper);expect(JSON.stringify(LETTER_CLASSES_352)).toBe(classes);
  }finally{Object.assign(PALETTE,previous);}
});
