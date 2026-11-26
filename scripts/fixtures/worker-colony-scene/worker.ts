import {openScene, type Draw} from './scene';

type Input = {canvas: OffscreenCanvas} | {draw: Draw} | {asset: number; bitmap?: ImageBitmap; error?: string};
let draw: Awaited<ReturnType<typeof openScene>>;
const assets = new Map<number,{resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void}>();
let nextAsset = 1;

function decodeTexture(url: string): Promise<ImageBitmap> {
  const asset = nextAsset++;
  return new Promise((resolve,reject) => {
    assets.set(asset,{resolve,reject});
    self.postMessage({asset,url});
  });
}

self.onmessage = async ({data}: MessageEvent<Input>) => {
  try {
    if ('asset' in data) {
      const request = assets.get(data.asset);
      if (!request) throw Error('Unknown texture request');
      assets.delete(data.asset);
      if (data.bitmap) request.resolve(data.bitmap);
      else request.reject(Error(data.error || 'Failed to decode texture'));
    } else if ('canvas' in data) {
      draw = await openScene(data.canvas,decodeTexture);
      self.postMessage({ready: true});
    } else {
      self.postMessage(await draw(data.draw));
    }
  } catch (error) {
    self.postMessage({error: error instanceof Error ? error.stack : String(error)});
  }
};
