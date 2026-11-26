import {openScene, type Draw} from './scene';

async function decodeTexture(worker: Worker, asset: number, url: string): Promise<void> {
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const options: ImageBitmapOptions = {imageOrientation: 'flipY', premultiplyAlpha: 'none', colorSpaceConversion: 'none'};
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(image, options);
    } catch {
      // Some SVG sources must be rasterized by their owning document first.
      const raster = document.createElement('canvas');
      raster.width = image.naturalWidth;
      raster.height = image.naturalHeight;
      const ctx = raster.getContext('2d');
      if (!ctx) throw Error('Texture needs Canvas2D: '+url);
      ctx.drawImage(image,0,0);
      bitmap = await createImageBitmap(raster, options);
    }
    worker.postMessage({asset, bitmap}, [bitmap]);
  } catch (error) {
    worker.postMessage({asset, error: String(error)});
  }
}

const canvas = document.querySelector('canvas')!;
async function createDraw() {
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
