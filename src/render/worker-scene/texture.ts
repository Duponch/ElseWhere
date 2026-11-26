/** Canvas2D rasterizes SVG sources that the native ImageBitmap decoder cannot
 * consume directly. In both cases the bitmap already has Three's Y flip. */
export async function decodeSceneTexture(url:string):Promise<ImageBitmap> {
  const image=new Image();
  image.src=url;
  await image.decode();
  const options:ImageBitmapOptions={imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'};
  try{return await createImageBitmap(image,options);}catch{
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const context=canvas.getContext('2d');
    if(!context)throw Error('Décodage Canvas2D indisponible.');
    context.drawImage(image,0,0);
    return createImageBitmap(canvas,options);
  }
}

