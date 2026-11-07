import type {NativePage,NativeRow} from './native-contract';
import type {LaunchProgressView} from '../ui/launch-progress';

const elapsed=(seconds:number):string=>seconds<60?`${seconds} s`:`${Math.floor(seconds/60)} min ${String(seconds%60).padStart(2,'0')} s`;

/** Loading screen while a colony opens. Presentation only; the stop action is
 * offered only when a request stopped reporting progress. */
export function buildNativeLaunchPage(view:LaunchProgressView,waiting?:{message:string;onStop:()=>void}):NativePage {
  const percent=Math.floor(view.fraction*100);
  const rows:NativeRow[]=[
    {id:'launch-progress',label:'Progression',meter:{value:view.fraction,max:1,label:`${percent} %`,color:'#63885d',secondary:{value:view.stageFraction,max:1,color:'#987743'}}},
    {id:'launch-stage',label:view.stage,...view.detail?{value:view.detail}:{},emphasis:'heading'},
    ...view.steps.map((step,index):NativeRow=>({id:`launch-step-${index}`,label:`${step.state==='done'?'✓':step.state==='active'?'▸':'·'}  ${step.label}`,emphasis:step.state==='pending'?'muted':'normal',dense:true})),
    {id:'launch-elapsed',label:'Temps écoulé',value:elapsed(view.elapsedSeconds),dense:true},
  ];
  if(waiting)rows.push({id:'launch-waiting',label:waiting.message,emphasis:'heading'});
  return {id:'native-launch',title:view.title,modal:true,closable:false,rows,
    ...waiting?{actions:[{id:'launch-stop',label:'Arrêter la simulation',onActivate:waiting.onStop}]}:{}};
}
