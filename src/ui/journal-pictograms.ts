import type {JournalPictogram} from './journal-events';
import {drawPicto} from './picto-artwork';

/** One recipe reused in the world atlas and both journal surfaces. */
export function drawJournalPictogram(ctx:CanvasRenderingContext2D,icon:JournalPictogram,cx:number,cy:number,r:number,ink='#44392f'):void {
  const existing=icon==='shot'?'target':icon==='combat'?'longsword':icon==='health'?'medicine':icon==='work'?'travail':icon==='command'?'information':undefined;
  if(existing&&drawPicto(ctx,existing,cx,cy,r,ink))return;
  ctx.save();ctx.translate(cx,cy);ctx.scale(r,r);ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=.14;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();
  if(icon==='romance'||icon==='breakup'){
    ctx.moveTo(0,.72);ctx.bezierCurveTo(-1,-.05,-.85,-.95,-.28,-.68);ctx.quadraticCurveTo(-.04,-.58,0,-.35);ctx.bezierCurveTo(.34,-1.05,1,-.65,.69,-.04);ctx.quadraticCurveTo(.45,.4,0,.72);
    if(icon==='breakup'){ctx.moveTo(.08,-.55);ctx.lineTo(-.13,-.17);ctx.lineTo(.15,.03);ctx.lineTo(-.08,.47);}
  }else if(icon==='mental'){
    for(let i=0;i<=40;i++){const angle=i*.32,rad=.04+i*.017,x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
    ctx.moveTo(-.62,.55);ctx.lineTo(-.7,.8);ctx.lineTo(-.38,.7);
  }else{
    ctx.moveTo(-.72,-.6);ctx.quadraticCurveTo(0,-.82,.7,-.57);ctx.lineTo(.74,.36);ctx.quadraticCurveTo(.2,.54,-.2,.44);ctx.lineTo(-.58,.8);ctx.lineTo(-.48,.41);ctx.lineTo(-.75,.35);ctx.closePath();
    if(icon==='insult'){ctx.moveTo(-.32,-.28);ctx.lineTo(-.06,.05);ctx.lineTo(.1,-.28);ctx.lineTo(.32,.04);ctx.moveTo(.34,.23);ctx.lineTo(.35,.24);}
    else if(icon==='kind'){ctx.moveTo(-.3,-.1);ctx.lineTo(.3,-.1);ctx.moveTo(0,-.4);ctx.lineTo(0,.2);}
    else{ctx.moveTo(-.4,-.12);ctx.lineTo(.35,-.12);ctx.moveTo(-.4,.13);ctx.lineTo(.12,.13);}
  }
  ctx.stroke();ctx.restore();
}
