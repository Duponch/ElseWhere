import type {ItemShape} from './item-geometry';

/** These marks describe a repeatable material, rather than a seam tied to
 * an authored silhouette. They use the exact physical crop of a square chart.
 * Apparel, hides, leaves, books and panel/label layouts keep their authored UV. */
export const ITEM_GRAIN_DESIGNS=Object.freeze([43,49,53,56,57,61]);
export const itemSurfaceDesignIsGrain=(tile:number):boolean=>ITEM_GRAIN_DESIGNS.includes(tile);

/** Reserved charts in the shared rigid/item atlas. The large front faces of
 * loose clothes deserve their own drawings. Thin edges and tiny, ambiguous
 * primitives retain the general painted material. */
export function itemSurfaceTile(shape:ItemShape|undefined,nx:number,ny:number,nz:number):number {
  switch(shape){
    case 'item-shirt': return ny>.5?32:ny<-.5?33:0;
    case 'item-pants': return Math.abs(ny)>.5?34:0;
    case 'item-coat': return ny>.5?35:ny<-.5?36:0;
    case 'item-vest': return ny>.5?37:ny<-.5?38:0;
    case 'item-helmet': return 39;
    case 'item-ingot': return ny>.5?40:0;
    default:return 0;
  }
}

type Point=readonly[number,number];
function pointSegment(x:number,y:number,a:Point,b:Point):number {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);
}

/** Draw the seams and hardware *inside* the existing apparel outline. Each
 * tile is a neutral role mask, so every dye, hide and metal palette works.
 * The common atlas adds the paint grain; only this authored value changes
 * between designs. Coordinates are the real item's unscaled planar UVs. */
export function paintItemSurfaceDesign(tile:number,u:number,v:number):number {
  let value=1;
  const line=(points:readonly Point[],width=.022,dark=.52)=>{
    for(let i=1;i<points.length;i++){
      const d=pointSegment(u,v,points[i-1]!,points[i]!);
      const coverage=Math.max(0,Math.min(1,(width+.018-d)/.03));
      value=Math.min(value,1-coverage*(1-dark));
    }
  };
  const dot=(x:number,y:number,r=.033,dark=.3)=>{
    const a=Math.max(0,Math.min(1,(r+.018-Math.hypot(u-x,v-y))/.025));
    value=Math.min(value,1-a*(1-dark));
  };
  const pocket=(x:number,y:number,w:number,h:number)=>{
    line([[x,y],[x+w,y],[x+w,y+h-.025],[x+w*.5,y+h],[x,y+h-.025],[x,y]],.016,.54);
    line([[x-.012,y+.018],[x+w+.012,y+.018]],.019,.37);
  };
  const fold=(a:Point,b:Point,c:Point)=>line([a,b,c],.012,.76);
  if(tile===32||tile===33){
    // Buttoned shirt, collar and two deliberately broad seams.
    line([[.32,.04],[.43,.20],[.5,.13],[.57,.20],[.68,.04]],.024,.48);
    line([[.29,.89],[.7,.89]],.016,.72);
    fold([.32,.30],[.37,.45],[.33,.60]);
    fold([.69,.28],[.63,.42],[.68,.58]);
    line([[.12,.28],[.21,.19],[.27,.25]],.016,.67);
    line([[.88,.28],[.79,.19],[.73,.25]],.016,.67);
    if(tile===32){
      line([[.48,.15],[.48,.88]],.026,.47);
      line([[.53,.15],[.53,.88]],.014,.7);
      pocket(.57,.31,.12,.16);
      for(const y of [.26,.44,.62,.8])dot(.505,y,.022,.25);
    }else{
      line([[.32,.29],[.5,.33],[.68,.29]],.024,.57);
      fold([.42,.37],[.43,.55],[.40,.74]);
      fold([.57,.37],[.56,.55],[.61,.78]);
    }
  }else if(tile===34){
    // Trouser waist, fly, diagonal pockets, separate leg folds and hems.
    line([[.16,.14],[.84,.14]],.032,.44);
    line([[.49,.14],[.49,.36],[.55,.45]],.024,.48);
    dot(.50,.075,.031);
    line([[.18,.22],[.34,.34],[.37,.47]],.023,.49);
    line([[.82,.22],[.66,.34],[.63,.47]],.023,.49);
    fold([.23,.51],[.31,.61],[.29,.74]);
    fold([.77,.51],[.69,.6],[.71,.74]);
    line([[.10,.90],[.36,.90]],.02,.62);
    line([[.64,.90],[.90,.90]],.02,.62);
  }else if(tile===35||tile===36){
    // Long coat: lapels, opening, belt seam and flap pockets. The lower
    // split already exists in the geometry; no painted seam floats across it.
    line([[.33,.05],[.40,.18],[.36,.23],[.50,.43],[.64,.23],[.60,.18],[.67,.05]],.025,.37);
    line([[.19,.88],[.42,.88]],.025,.65);
    line([[.58,.88],[.81,.88]],.025,.65);
    line([[.28,.44],[.72,.44]],.023,.68);
    if(tile===35){
      line([[.50,.42],[.50,.69]],.035,.35);
      for(const y of [.48,.58,.68])dot(.54,y,.031,.24);
      pocket(.25,.53,.15,.14);
      pocket(.60,.53,.15,.14);
    }else{
      line([[.5,.11],[.5,.68]],.024,.49);
      line([[.32,.43],[.37,.55],[.37,.74]],.018,.56);
      line([[.68,.43],[.63,.55],[.63,.74]],.018,.56);
    }
    fold([.22,.71],[.27,.76],[.22,.84]);
    fold([.78,.71],[.73,.76],[.78,.84]);
  }else if(tile===37||tile===38){
    line([[.19,.09],[.31,.21],[.5,.33],[.69,.21],[.81,.09]],.025,.5);
    line([[.22,.87],[.78,.87]],.025,.67);
    line([[.28,.34],[.32,.61],[.30,.81]],.024,.62);
    line([[.72,.34],[.68,.61],[.70,.81]],.024,.62);
    // Vest and armour use the same geometry. Keep this seam broad rather
    // than impose shirt hardware on every plate/tribal garment.
    if(tile===37){
      line([[.50,.33],[.50,.86]],.025,.48);
      line([[.35,.60],[.47,.60]],.021,.57);
      line([[.53,.60],[.65,.60]],.021,.57);
    }else line([[.33,.43],[.50,.49],[.67,.43]],.025,.56);
  }else if(tile===39){
    // Gentle crown panels fit a cap, hood or helmet equally. The brim is
    // a separate disc with no false crown design.
    line([[0,.78],[1,.78]],.032,.65);
    for(const x of [.125,.375,.625,.875])line([[x,.15],[x,.68]],.013,.76);
  }else if(tile===40){
    // Pressed bevel marks on the broad face of a small ingot/flat package.
    line([[.16,.20],[.84,.20],[.84,.80],[.16,.80],[.16,.20]],.022,.73);
  }else if(tile===41){
    // Book covers: inset border and an ornament. The existing book pages,
    // title plaque and spine remain separate parts.
    line([[.12,.09],[.88,.09],[.88,.91],[.12,.91],[.12,.09]],.027,.47);
    line([[.20,.17],[.8,.17],[.8,.83],[.20,.83],[.20,.17]],.012,.67);
    line([[.5,.25],[.64,.39],[.5,.53],[.36,.39],[.5,.25]],.023,.44);
    line([[.3,.68],[.7,.68]],.025,.60);
  }else if(tile===42){
    // Pharmaceutical/industrial label; symbolic brush inscription.
    line([[.10,.18],[.90,.18],[.90,.82],[.10,.82],[.10,.18]],.028,.52);
    line([[.20,.36],[.80,.36]],.027,.46);
    line([[.20,.48],[.66,.48]],.034,.68);
    line([[.20,.64],[.43,.64]],.018,.48);
    line([[.65,.59],[.80,.59],[.80,.70],[.65,.70],[.65,.59]],.017,.65);
  }else if(tile===43||tile===49){
    // Bark and wood fibres parallel to a roll's axial direction or plank
    // face. Distinctive gentle grain, not a stamped geometric motif.
    const along=tile===43?v:u,across=tile===43?u:v;
    const curve=across+Math.sin(along*8+across*2)*.045+Math.sin(along*20-across*7)*.018;
    const channel=Math.max(0,Math.cos(curve*(tile===43?38:27)))**10;
    value=1-channel*(tile===43?.45:.22);
    if(tile===49){
      const knot=Math.hypot((u-.73)*2,(v-.39)*4);
      if(knot<.44)value=Math.min(value,1-.18*Math.max(0,Math.cos(knot*36))**6);
    }
  }else if(tile===44){
    // Broad cloth folds with stitched selvedge; neutral enough for all dyes.
    line([[.07,.08],[.07,.92]],.024,.6);
    line([[.93,.08],[.93,.92]],.024,.6);
    line([[.18,.23],[.55,.27],[.81,.21]],.026,.65);
    line([[.12,.55],[.45,.59],[.86,.50]],.024,.7);
    line([[.20,.82],[.51,.77],[.82,.81]],.024,.67);
  }else if(tile===45){
    // The outline is an actual irregular hide mesh. A restrained border
    // and curving crease follow it instead of pretending it is a leaf.
    line([[.5,.07],[.28,.29],[.10,.58],[.24,.84],[.50,.91],[.75,.84],[.9,.58],[.72,.29],[.50,.07]],.022,.63);
    fold([.28,.46],[.38,.52],[.42,.75]);
    fold([.72,.46],[.62,.58],[.58,.77]);
  }else if(tile===46){
    line([[.50,.07],[.47,.44],[.5,.93]],.030,.48);
    for(const [y,side] of [[.32,1],[.53,-1],[.7,1],[.8,-1]] as const){
      line([[.50,y],[.50+side*.16,y+.08],[.50+side*.28,y+.1]],.021,.62);
    }
  }else if(tile===47){
    // Modular armour panel; cut silhouettes and equipment colours remain.
    line([[.16,.16],[.38,.16],[.48,.24],[.52,.24],[.62,.16],[.84,.16]],.027,.47);
    line([[.19,.38],[.4,.38],[.4,.61],[.31,.7],[.19,.61],[.19,.38]],.025,.49);
    line([[.81,.38],[.6,.38],[.6,.61],[.69,.7],[.81,.61],[.81,.38]],.025,.49);
    line([[.30,.82],[.70,.82]],.03,.6);
  }else if(tile===48){
    line([[.09,.12],[.91,.12],[.91,.88],[.09,.88],[.09,.12]],.026,.51);
    line([[.08,.32],[.92,.32]],.023,.60);
    line([[.36,.53],[.64,.53]],.04,.68);
  }else if(tile===50){
    // Simple pressed panel for a visibly broad metal part. Small fittings
    // and narrow objects have their own geometry and remain unadorned.
    line([[.10,.12],[.9,.12],[.9,.88],[.10,.88],[.10,.12]],.02,.63);
    for(const x of [.16,.84])for(const y of [.2,.8])dot(x,y,.025,.40);
  }else if(tile===51){
    // Knit crown with broad ribbing at its band.
    const rib=Math.max(0,Math.cos(u*Math.PI*12))**8;
    value=1-rib*(v>.68?.34:.13);
    line([[0,.72],[1,.72]],.025,.55);
  }else if(tile===52){
    // Quilted parka. Keep the hood separate in the source model.
    line([[.5,.04],[.5,.74]],.034,.42);
    for(const y of [.25,.44,.63,.83])line([[.17,y],[.38,y+.025],[.62,y+.025],[.83,y]],.025,.64);
    pocket(.24,.53,.16,.13);pocket(.60,.53,.16,.13);
  }else if(tile===53){
    // Sawn growth rings rather than bark on the end of a cut log.
    const ring=Math.hypot(u-.48,(v-.52)*1.06)+.022*Math.sin(Math.atan2(v-.52,u-.48)*5);
    value=1-.31*Math.max(0,Math.cos(ring*57))**9;
  }else if(tile===54){
    // Electronics: metallic traces around a separate chip.
    for(const y of [.15,.28,.72,.85])line([[.08,y],[.28,y],[.4,(y-.5)*.75+.5],[.92,(y-.5)*.75+.5]],.02,.55);
    for(const x of [.08,.92])for(const y of [.15,.28,.72,.85])dot(x,y,.028,.42);
  }else if(tile===55){
    // Pull-over/T-shirt: round collar, hem and the two sleeve seams,
    // with no opening or buttons borrowed from a buttoned shirt.
    line([[.35,.045],[.39,.17],[.5,.23],[.61,.17],[.65,.045]],.028,.52);
    line([[.28,.89],[.72,.89]],.024,.66);
    line([[.12,.29],[.23,.23],[.29,.30]],.019,.67);
    line([[.88,.29],[.77,.23],[.71,.30]],.019,.67);
    fold([.33,.38],[.37,.55],[.34,.74]);
    fold([.67,.38],[.63,.55],[.66,.74]);
  }else if(tile===56){
    // Corn cob, organised staggered kernel rows rather than unrelated spots.
    const row=Math.floor(v*6),across=u*7+(row%2)*.5;
    const x=across-Math.floor(across)-.5,y=v*6-row-.5;
    value=1-.24*Math.max(0,(Math.max(Math.abs(x),Math.abs(y))-.28)*4);
  }else if(tile===57){
    const straw=u+Math.sin(v*9+u*3)*.022;
    value=1-.24*Math.max(0,Math.cos(straw*62))**8;
  }else if(tile===58){
    line([[.13,.34],[.87,.34],[.87,.65],[.13,.65],[.13,.34]],.028,.53);
    line([[.31,.48],[.69,.48]],.037,.46);
  }else if(tile===59){
    line([[.35,.04],[.45,.2],[.5,.12],[.55,.2],[.65,.04]],.027,.48);
    line([[.5,.13],[.5,.92]],.032,.40);
    dot(.54,.3,.026,.44);
    pocket(.29,.56,.14,.14);pocket(.57,.56,.14,.14);
    line([[.28,.88],[.72,.88]],.026,.59);
  }else if(tile===61){
    // Yarn: loose curves across an actual ball of wool, not an animal skin.
    const coil=u+(Math.sin(v*14)*.044+Math.sin(v*5)*.12);
    value=1-.21*Math.max(0,Math.cos(coil*51))**11;
  }
  return value;
}
