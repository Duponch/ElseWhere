/// <reference lib="webworker" />
import {startSimulationWorker} from './simulation-runtime';
const scope=self as unknown as DedicatedWorkerGlobalScope;
startSimulationWorker(scope,message=>scope.postMessage(message),undefined,undefined,undefined,undefined,{});
