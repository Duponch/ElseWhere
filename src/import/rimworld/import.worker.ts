/// <reference lib="webworker" />
import {handleRwsImportRequest,type RwsImportWorkerMessage,type RwsImportWorkerRequest} from './import-job.ts';

/* Dedicated Worker of the RimWorld save import (« Charger une partie » →
 * « Importer une sauvegarde RimWorld »). It reads the chosen file, converts it
 * and posts its progress, then the outcome; the page terminates it afterwards
 * or to cancel. It never touches the simulation Worker or its world. */
const scope=self as unknown as DedicatedWorkerGlobalScope;
scope.onmessage=(event:MessageEvent<RwsImportWorkerRequest>)=>{
 void handleRwsImportRequest(event.data,(message:RwsImportWorkerMessage)=>scope.postMessage(message));
};
