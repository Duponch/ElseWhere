import {savedCampaignRefusal} from '../sim/serialization';
import type {SaveCheckReply,SaveCheckRequest} from './save-check';

/* Validates a save text off the simulation thread (see save-check.ts). */
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage=(event:MessageEvent<SaveCheckRequest>)=>{
 const {id,text}=event.data;let refusal:string|null;
 try{refusal=savedCampaignRefusal(text)??null;}
 catch(error){refusal=`Cannot save invalid world: ${error instanceof Error?error.message:String(error)}`;}
 scope.postMessage({id,refusal} satisfies SaveCheckReply);
};
