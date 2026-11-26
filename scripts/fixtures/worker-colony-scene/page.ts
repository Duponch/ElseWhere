import {decodeSceneTexture} from '../../../src/render/worker-scene/texture';
import {openScene, type Draw} from './scene';

async function decodeTexture(worker: Worker, asset: number, url: string): Promise<void> {
  try {
    const bitmap = await decodeSceneTexture(url);
    worker.postMessage({asset, bitmap}, [bitmap]);
  } catch (error) {
    worker.postMessage({asset, error: String(error)});
  }
}

const canvas = document.querySelector('canvas')!;
declare const CHECK_NATIVE_SPEED_HUD:boolean;
async function createDraw() {
  if(CHECK_NATIVE_SPEED_HUD&&location.search!=='?worker'){
    const {makeNativeSpeedReference}=await import('./speed-reference');
    Object.assign(window,{makeNativeSpeedReference});
  }
  if (location.search !== '?worker') return openScene(canvas);
  const worker = new Worker('./worker.js', {type: 'module'});
  function send(request: object, transfers: Transferable[] = []) {
    return new Promise((resolve, reject) => {
      worker.onmessage = ({data}) => {
        if (data.asset) { void decodeTexture(worker, data.asset, data.url); return; }
        if (data.error) reject(Error(data.error));
        else resolve(data);
      };
      worker.onmessageerror = () => reject(Error('Could not read Worker reply'));
      worker.onerror = event => reject(Error(event.message));
      worker.postMessage(request, transfers);
    });
  }
  const surface = canvas.transferControlToOffscreen();
  await send({canvas: surface}, [surface]);
  return (draw: Draw) => send({draw});
}
// The runner sends commands sequentially and closes the whole realm afterwards.
const ready = createDraw();
Object.assign(window, {drawColonyView: async (draw: Draw) => (await ready)(draw)});
