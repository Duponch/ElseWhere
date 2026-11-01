import type {NativeControl,NativePage,NativeRow} from './native-contract';

export type NativeFrontScreen='home'|'scenario'|'story'|'world'|'site'|'pawns'|'load'|'tests'|'options';
interface FrontPresentation {
  button:(id:string,label:string,action:()=>unknown,disabled?:boolean,active?:boolean)=>NativeControl;
  field:(id:string,label:string,value:string,commit:(value:string)=>unknown,kind?:'text'|'number',maxLength?:number)=>NativeRow;
  tests:{selected?:string;search:string};
}
const dimensions:Record<NativeFrontScreen,number>={home:480,scenario:1100,story:1100,world:1100,site:1260,pawns:1260,load:900,tests:1100,options:900};
const normalize=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
/** Presentation only. The original guarded controls keep their callbacks;
 * selection, search and grouping never stand in for a generation/load ACK. */
export function presentNativeFront(page:NativePage,screen:NativeFrontScreen,context:FrontPresentation):NativePage {
  page.layout='setup';page.width??=dimensions[screen];page.height??=764;
  page.rows=page.rows.map(row=>row.id==='front-error'||row.id==='front-status'?{...row,region:'navigation' as const}:row);
  page.contentKey??='front-'+screen;
  const notices=page.rows.filter(row=>row.region==='navigation'),content=page.rows.filter(row=>row.region!=='navigation');
  if(screen==='home'){
    page.setupAnchor='right';page.width=480;page.height=560;
    page.rows=[...notices,...content.map(row=>row.controls?.length===1?{...row,label:'',region:'catalogue' as const,controlStyle:'button' as const}: {...row,region:'catalogue' as const})];
  }else if(screen==='scenario'){
    page.setupCatalogueWidth=250;
    const current=content.find(row=>row.id==='scenario'),others=content.find(row=>row.id==='other-scenarios');
    const choices:NativeRow[]=[];
    if(current?.controls?.[0])choices.push({id:'scenario-choice-current',label:'',region:'catalogue',controlStyle:'button',controls:[{...current.controls[0],label:current.label,hint:current.detail}]});
    for(const [index,control]of (others?.controls??[]).entries())choices.push({id:'scenario-choice-'+index,label:'',region:'catalogue',controlStyle:'button',controls:[{...control,hint:control.hint??'Ce scénario est indisponible.'}]});
    page.rows=[...notices,...choices,...content.filter(row=>row.id!=='other-scenarios').map(row=>({...row,region:'details' as const,...(row.id==='scenario'?{controls:undefined}: {})}))];
  }else if(screen==='story'){
    page.setupCatalogueWidth=220;
    const narrator=content.find(row=>row.id==='narrator'),difficulty=content.find(row=>row.id==='difficulty'),saving=content.find(row=>row.id==='saving');
    const selectedDifficulty=difficulty?.controls?.some(control=>control.active&&!control.disabled),selectedSaving=saving?.controls?.some(control=>control.active&&!control.disabled);
    const rows:NativeRow[]=[...notices];
    if(narrator){rows.push({id:'narrator-choice',label:'Conteur disponible',region:'catalogue',controls:[context.button('narrator-current',narrator.label,()=>undefined,false,true)]});rows.push({...narrator,region:'details'});}
    for(const [row,column]of [[difficulty,0],[saving,1]] as const){
      if(!row)continue;rows.push({id:row.id+'-heading',label:row.label,region:'details',setupColumn:column,emphasis:'heading'});
      for(const [index,control]of (row.controls??[]).entries())rows.push({id:row.id+'-choice-'+index,label:'',region:'details',setupColumn:column,controlStyle:'button',controls:[control]});
    }
    page.rows=rows;page.actions=page.actions?.map(control=>control.id==='story-next'?{...control,disabled:!!control.disabled||!selectedDifficulty||!selectedSaving}:control);
  }else if(screen==='tests'){
    page.setupCatalogueWidth=460;
    const cards=content.filter(row=>row.id.startsWith('test-')&&row.controls?.some(control=>control.id.startsWith('load-test-')));
    if(!cards.some(row=>row.id===context.tests.selected))context.tests.selected=cards[0]?.id;
    const chosen=cards.find(row=>row.id===context.tests.selected),query=normalize(context.tests.search.trim());
    const matches=cards.filter(row=>!query||normalize(row.controls!.map(control=>[control.label,control.caption,control.description].join(' ')).join(' ')).includes(query));
    const search=context.field('test-catalogue-search','Rechercher une colonie de test',context.tests.search,value=>{context.tests.search=value;});search.region='navigation';
    const list:NativeRow[]=matches.map(row=>{const load=row.controls!.find(control=>control.id.startsWith('load-test-'))!,download=row.controls!.find(control=>control.id.startsWith('download-test-'));
      return{id:row.id,label:'',region:'catalogue',controlStyle:'button',controls:[context.button('inspect-'+row.id,load.label,()=>{context.tests.selected=row.id;},false,row.id===context.tests.selected),{...load,label:'Charger',presentation:'button',caption:undefined,description:undefined},...(download?[{...download,label:'Télécharger',presentation:'button' as const,caption:undefined,description:undefined}]:[])]};
    });
    const selectedLoad=chosen?.controls?.find(control=>control.id.startsWith('load-test-'));
    page.rows=[...notices,search,{id:'test-catalogue-count',label:`${matches.length} / ${cards.length} colonies`,region:'navigation'},...list,
      ...(!matches.length?[{id:'test-no-match',label:'Aucune colonie ne correspond à cette recherche.',region:'catalogue' as const}]:[]),
      ...(selectedLoad?[{id:'test-current-details',label:selectedLoad.label,value:selectedLoad.caption,detail:selectedLoad.description,region:'details' as const}]:[]),
      ...content.filter(row=>row.id==='test-preservation').map(row=>({...row,region:'details' as const}))];
    page.contentKey='front-tests:'+context.tests.search+':'+context.tests.selected;
  }
  return page;
}
