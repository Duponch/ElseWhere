import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import type {CardboardPiece,CardboardPieceData} from '../src/ui3d/prototype-art';

interface Hit {piece:CardboardPiece;control?:NativeControl;input?:NonNullable<NativeRow['input']>}
interface StageAccess {
  page:NativePage|null;
  pageSignature:string;
  retainedPagePieces:Map<string,{piece:CardboardPiece;hit:Hit}>;
  hits:Map<THREE.Mesh,Hit>;
  pageControls:Hit[];
  hintOwner:CardboardPiece|null;
  dropdown:{controlId:string;pageId:string;pieces:CardboardPiece[]}|undefined;
  editor:{maxLength:number}|undefined;
  editing:Hit|undefined;
  pageInkSignature(page:NativePage|null):string;
  rebuildPage(force?:boolean):void;
  rebindPage(page:NativePage|null):void;
  selectDropdown(value:string):void;
}
const page=(rows:NativeRow[]):NativePage=>({id:'hints',title:'Informations',rows});
const control=(hint='Avant'):NativeControl=>({id:'action',label:'Action',hint,onActivate:vi.fn()});
function fixture(){
  // Constructor-free native-stage harness: real Three hit meshes, no renderer,
  // DOM, browser event loop or graphics device required for binding contracts.
  const stage=Object.create(NativeStage.prototype) as StageAccess;
  Object.assign(stage,{page:null,pageSignature:'',textFontRevision:0,frontVisible:false,width:1440,height:1000,scroll:0,
    retainedPagePieces:new Map(),hits:new Map(),pageControls:[],hintOwner:null,dropdown:undefined,editor:undefined,editing:undefined,options:{onError:vi.fn()}});
  const clearHint=vi.fn(()=>{stage.hintOwner=null;}),closeDropdown=vi.fn(()=>{stage.dropdown=undefined;});
  Object.assign(stage,{clearHint,closeDropdown});
  const pieces:CardboardPiece[]=[];
  const add=(id:string,tooltip='',currentControl?:NativeControl,input?:NativeRow['input']):Hit=>{
    const piece=new THREE.Group() as CardboardPiece,mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());
    piece.add(mesh);piece.userData={nativeId:id,tooltip,mesh} as unknown as CardboardPieceData;
    piece.redraw=vi.fn();pieces.push(piece);
    const hit={piece,control:currentControl,input};stage.retainedPagePieces.set(id,{piece,hit});stage.hits.set(mesh,hit);
    if(currentControl||input)stage.pageControls.push(hit);
    return hit;
  };
  const close=()=>{for(const piece of pieces){piece.userData.mesh.geometry.dispose();(piece.userData.mesh.material as THREE.Material).dispose();}};
  return {stage,add,clearHint,closeDropdown,pieces,close};
}
afterEach(()=>vi.restoreAllMocks());

describe('native page ink and hint signatures',()=>{
  it('ignores only tooltip text in rows, columns, controls, actions and select options',()=>{
    const f=fixture();
    try{
      const original=page([{id:'row',label:'Ligne',hint:'Ancien détail',columns:[{label:'Colonne',hint:'Ancienne colonne'}],controls:[{...control(),select:{value:'a',options:[{value:'a',label:'Choix',hint:'Ancien choix'}],onChange:vi.fn()}}]}]);
      original.actions=[{...control(),id:'footer'}];
      const next=page([{...original.rows[0]!,hint:'Détail actuel',columns:[{label:'Colonne',hint:'Colonne actuelle'}],controls:[{...control('Action actuelle'),select:{value:'a',options:[{value:'a',label:'Choix',hint:'Choix actuel'}],onChange:vi.fn()}}]}]);
      next.actions=[{...control('Pied actuel'),id:'footer'}];
      expect(f.stage.pageInkSignature(next)).toBe(f.stage.pageInkSignature(original));
    }finally{f.close();}
  });

  it('keeps hit-region presence in the signature including explicit empty hints and fallback text',()=>{
    const f=fixture();
    try{
      const signature=(row:NativeRow)=>f.stage.pageInkSignature(page([row]));
      const empty={id:'empty',label:''};
      expect(signature({...empty,hint:'Une cible'})).not.toBe(signature(empty));
      expect(signature({...empty,hint:'Une cible'})).toBe(signature({...empty,hint:'Une autre cible'}));
      const fallback={id:'fallback',label:'Libellé visible'};
      expect(signature({...fallback,hint:''})).not.toBe(signature(fallback));
      expect(signature({...fallback,hint:'Explication'})).toBe(signature(fallback));
    }finally{f.close();}
  });

  it('retains visible, layout, disabled and editor/select settings as repaint triggers',()=>{
    const f=fixture();
    try{
      const row:NativeRow={id:'row',label:'Libellé',value:'Valeur',detail:'Détail',columns:[{label:'Colonne'}],meter:{value:.5,secondary:{value:.2,label:'Seuil'}},controls:[{...control(),select:{value:'a',options:[{value:'a',label:'Choix'}],onChange:vi.fn()}}],input:{value:'Texte',kind:'text',maxLength:10,onCommit:vi.fn()}};
      const original=f.stage.pageInkSignature(page([row]));
      const changed:NativeRow[]=[
        {...row,label:'Nouveau libellé'},{...row,value:'Nouvelle valeur'},{...row,detail:'Nouveau détail'},
        {...row,columns:[{label:'Nouvelle colonne'}]},{...row,meter:{...row.meter!,secondary:{value:.2,label:'Autre seuil'}}},
        {...row,controls:[{...row.controls![0]!,disabled:true}]},{...row,controls:[{...row.controls![0]!,select:{...row.controls![0]!.select!,value:'b'}}]},
        {...row,controls:[{...row.controls![0]!,select:{...row.controls![0]!.select!,options:[{value:'a',label:'Choix',disabled:true}]}}]},
        {...row,input:{...row.input!,kind:'number'}},{...row,input:{...row.input!,maxLength:20}},{...row,labelWidth:180}
      ];
      for(const next of changed)expect(f.stage.pageInkSignature(page([next]))).not.toBe(original);
    }finally{f.close();}
  });
});

describe('native page hint rebinding',()=>{
  it('skips rebuilding ink while refreshing row/column/control hints and the current action callback',()=>{
    const f=fixture();
    try{
      const before=page([{id:'row',label:'Ligne',hint:'Avant',columns:[{label:'Colonne',hint:'Avant'}],controls:[control()]}]);
      const row=f.add('row-hint:row','Avant'),column=f.add('column:row:0','Avant'),action=f.add('action','Avant',before.rows[0]!.controls![0]);
      const activate=vi.fn(),after=page([{...before.rows[0]!,hint:'Après',columns:[{label:'Colonne',hint:'Colonne actuelle'}],controls:[{...control('Action actuelle'),onActivate:activate}]}]);
      f.stage.pageSignature=f.stage.pageInkSignature(before);f.stage.page=after;f.stage.hintOwner=column.piece;
      f.stage.rebuildPage();
      expect(row.piece.userData.tooltip).toBe('Après');expect(column.piece.userData.tooltip).toBe('Colonne actuelle');expect(action.piece.userData.tooltip).toBe('Action actuelle');
      // Since 23 November (item 27) a changed hint no longer clears the shown tooltip:
      // it stays on its piece and only its text is refreshed (TooltipHandler re-reads the text).
      expect(f.clearHint).not.toHaveBeenCalled();expect(f.stage.hintOwner).toBe(column.piece);
      action.control?.onActivate();expect(activate).toHaveBeenCalledTimes(1);
      for(const piece of f.pieces)expect(piece.redraw).not.toHaveBeenCalled();
    }finally{f.close();}
  });

  it('refreshes compact control fallbacks, current input callbacks and editor limits',()=>{
    const f=fixture();
    try{
      const oldInput={value:'A',maxLength:10,onCommit:vi.fn()},input=f.add('input','',undefined,oldInput),compact=f.add('action','Ancien',control());
      const onCommit=vi.fn(),nextInput={value:'A',maxLength:25,onCommit},next=page([{id:'input',label:'Champ',input:nextInput},{id:'compact',label:'Valeur',value:'42',compact:true,controls:[control('Explication')]}]);
      f.stage.editing=input;f.stage.editor={maxLength:10};f.stage.page=next;f.stage.rebindPage(next);
      expect(input.input).toBe(nextInput);input.input?.onCommit('B');expect(onCommit).toHaveBeenCalledWith('B');
      expect(f.stage.editor.maxLength).toBe(25);expect(compact.piece.userData.tooltip).toBe('42 · Explication');
    }finally{f.close();}
  });

  it('refreshes an already open dropdown in both tooltip sources and resolves the current onChange callback',()=>{
    const f=fixture();
    try{
      const onChange=vi.fn(),owner=f.add('action','',control()),option=f.add('select-option:action:a','Ancien choix',{id:'select-option:action:a',label:'Choix',hint:'Ancien choix',onActivate:()=>f.stage.selectDropdown('a')});
      // Popup options are deliberately outside retained page records.
      f.stage.retainedPagePieces.delete('select-option:action:a');f.stage.pageControls=f.stage.pageControls.filter(hit=>hit!==option);
      const next=page([{id:'row',label:'Ligne',controls:[{...control(),select:{value:'a',options:[{value:'a',label:'Choix',hint:'Choix actuel'}],onChange}}]}]);
      f.stage.dropdown={controlId:'action',pageId:next.id,pieces:[option.piece]};f.stage.hintOwner=option.piece;f.stage.page=next;
      f.stage.rebindPage(next);
      expect(owner.control).toBe(next.rows[0]!.controls![0]);expect(option.piece.userData.tooltip).toBe('Choix actuel');expect(option.control?.hint).toBe('Choix actuel');
      expect(f.clearHint).not.toHaveBeenCalled();expect(f.stage.hintOwner).toBe(option.piece);expect(option.piece.redraw).not.toHaveBeenCalled();
      option.control?.onActivate();expect(onChange).toHaveBeenCalledWith('a');expect(f.closeDropdown).toHaveBeenCalledTimes(1);
    }finally{f.close();}
  });
});
