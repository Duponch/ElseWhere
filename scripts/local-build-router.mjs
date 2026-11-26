// Native browser fixtures can be tested without a listening TCP server.
// Only files inside an explicitly nominated, already built directory are
// served. Unmatched origins and missing assets are never fetched elsewhere.
import {realpathSync,statSync} from 'node:fs';
import {resolve,relative,isAbsolute,sep,extname} from 'node:path';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.jpeg':'image/jpeg','.jpg':'image/jpeg','.webp':'image/webp','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.wasm':'application/wasm'};
export async function installLocalBuildRoutes(context,rootPath,origin){
 const root=realpathSync(resolve(rootPath));
 const inside=file=>{const rel=relative(root,file);return rel!==''&&!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep);};
 if(!statSync(resolve(root,'index.html')).isFile())throw Error('Frozen build lacks index.html');
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==origin){await route.abort();return;}
  try{
   const pathname=decodeURIComponent(url.pathname),requested=resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));
   if(!inside(requested))throw Error('Outside frozen build');const file=realpathSync(requested);
   if(!inside(file)||!statSync(file).isFile())throw Error('Missing frozen asset');
   await route.fulfill({path:file,contentType:mime[extname(file).toLowerCase()]??'application/octet-stream'});
  }catch{await route.fulfill({status:404,body:'Frozen build asset not found'});}
 });
}
