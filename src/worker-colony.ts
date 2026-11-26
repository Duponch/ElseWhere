import {WorkerColonyClient, type WorkerColonyState} from './render/worker-scene/client';
import {WORLD_SCALE} from './world/scale';
import {PickOverlay} from './render/worker-scene/pick-overlay';
import type {ColonySpeed} from './render/worker-scene/protocol';
import {parseNativeUiScale,NATIVE_UI_SCALE_PREFERENCE_KEY} from './ui3d/native-preferences';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const surface = element('surface'), status = element('status'), metrics = element('metrics');
const speed = element<HTMLFieldSetElement>('speed'), file = element<HTMLInputElement>('file');
const buttons = Array.from(speed.querySelectorAll<HTMLButtonElement>('button'));
const number = new Intl.NumberFormat('fr-FR', {maximumFractionDigits: 1});
const nativeSpeedHud=new URLSearchParams(location.search).get('hud')==='speed';
let client: WorkerColonyClient | undefined;
let state: WorkerColonyState | undefined;
let opening = 0;
let sample: {at: number; frames: number; core: number; speed: number} | undefined;
let rates = '';
let inspection:PickOverlay|undefined;

function message(text: string) {
  status.textContent = text;
  status.hidden = !text;
}

function dimensions() {
  client?.resize(Math.max(1, surface.clientWidth), Math.max(1, surface.clientHeight), window.devicePixelRatio);
}

function update(next: WorkerColonyState) {
  state = next;
  const now = next.sampledAt;
  if (!sample || sample.speed !== next.speed || next.core < sample.core || next.frames < sample.frames) {
    sample = {at: now, frames: next.frames, core: next.core, speed: next.speed};
    rates = '';
  } else if (now - sample.at >= 1000) {
    const seconds = (now - sample.at) / 1000;
    rates = `${number.format((next.frames - sample.frames) / seconds)} dessins/s · ${number.format((next.core - sample.core) / 10 / seconds)} ticks confirmés/s · `;
    sample = {at: now, frames: next.frames, core: next.core, speed: next.speed};
  }
  metrics.textContent = `${rates}Tick ${number.format(next.tick)}`;
  for (const button of buttons) button.setAttribute('aria-pressed', String(Number(button.dataset.speed) === next.speed));
}

function requestSpeed(value: 0 | 1 | 3 | 6) {
  const current = client;
  if (!current || speed.disabled) return;
  void current.speed(value).catch(error => { if (client === current) message(String(error)); });
}

function bindCamera(canvas: HTMLCanvasElement, current: WorkerColonyClient) {
  const pick=new PickOverlay(canvas,current,element('pick-result'),element('pick-confirm'),element('pick-cancel'));
  inspection=pick;
  let hudPress:{id:number;speed:ColonySpeed}|undefined;
  let hover:ColonySpeed|null=null;
  const hudAt=(event:PointerEvent)=>{
    if(!nativeSpeedHud||pick.pinned)return null;
    const rect=canvas.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return null;
    const width=canvas.clientWidth,height=canvas.clientHeight;
    return current.nativeSpeedAt((event.clientX-rect.left)*width/rect.width,(event.clientY-rect.top)*height/rect.height,width,height);
  };
  const hudHover=(next:ColonySpeed|null,pressed=false)=>{
    if(hover===next&&!pressed)return;
    hover=next;current.speedHudPointer(next,pressed);
  };
  let drag: {id:number;startX:number;startY:number;x:number;y:number;rotate:boolean;aim:boolean;moving:boolean}|undefined;
  const pan = (dx: number, dy: number) => {
    const camera = state?.camera;
    if (!camera) return;
    const x = camera.position[0]! - camera.target[0]!, z = camera.position[2]! - camera.target[2]!;
    const distance = Math.hypot(x, z) || 1;
    const units = WORLD_SCALE.cameraSpan * 1.06 / (Math.max(.001, camera.zoom) * Math.max(1, canvas.clientHeight));
    current.camera({panX: (-dx * z - dy * x) * units / distance, panZ: (dx * x - dy * z) * units / distance});
  };
  canvas.oncontextmenu = event => event.preventDefault();
  canvas.onpointerdown = event => {
    if (drag || hudPress || speed.disabled || !event.isPrimary || ![0, 1, 2].includes(event.button)) return;
    canvas.focus({preventScroll: true});
    canvas.setPointerCapture(event.pointerId);
    const hit=event.button===0&&!event.shiftKey?hudAt(event):null;
    if(hit!==null){pick.clear();hudPress={id:event.pointerId,speed:hit};hudHover(hit,true);return;}
    const aim=event.button===0&&!event.shiftKey;
    const pinned=pick.pinned;pick.clear();
    if(aim&&!pinned)pick.begin(event.clientX,event.clientY);
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,rotate:event.button===2||event.shiftKey,aim:aim&&!pinned,moving:false};
  };
  canvas.onpointermove = event => {
    if(nativeSpeedHud&&event.isPrimary&&!drag)hudHover(hudAt(event));
    if(hudPress)return;
    if (!drag || drag.id !== event.pointerId) return;
    if(!drag.moving){
      if(drag.aim&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<=6)return;
      drag.moving=true;pick.clear();
    }
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    drag.x = event.clientX; drag.y = event.clientY;
    if(!dx&&!dy)return;
    if (drag.rotate) current.camera({orbit: -dx * Math.PI * 2 / Math.max(1, canvas.clientWidth)});
    else pan(dx, dy);
  };
  canvas.onpointerup=event=>{
    if(hudPress?.id===event.pointerId){
      const hit=hudAt(event),down=hudPress.speed;hudPress=undefined;
      if(hit===down)requestSpeed(hit);
      if(event.pointerType==='touch')hudHover(null);
      return;
    }
    if(drag?.id!==event.pointerId)return;
    if(drag.aim&&!drag.moving&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<=6)pick.end(event.clientX,event.clientY);
    else pick.clear();
    drag=undefined;
  };
  canvas.onpointerleave=()=>hudHover(null);
  canvas.onlostpointercapture=canvas.onpointercancel=event=>{
    if(hudPress?.id===event.pointerId){hudPress=undefined;hudHover(null);}
    if(drag?.id===event.pointerId){drag=undefined;pick.clear();}
  };
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
    current.camera({zoom: Math.exp(-Math.max(-500, Math.min(500, event.deltaY * scale)) * .0015)});
  }, {passive: false});
  canvas.onkeydown = event => {
    switch (event.key) {
      case 'Escape': pick.clear();break;
      case 'ArrowLeft': pan(48, 0); break;
      case 'ArrowRight': pan(-48, 0); break;
      case 'ArrowUp': pan(0, 48); break;
      case 'ArrowDown': pan(0, -48); break;
      case '+': case '=': current.camera({zoom: 1.2}); break;
      case '-': current.camera({zoom: 1 / 1.2}); break;
      case ' ': requestSpeed(state?.speed ? 0 : 1); break;
      default: return;
    }
    event.preventDefault();
  };
}

async function openColony(source: File | string) {
  const id = ++opening;
  inspection?.clear();inspection=undefined;
  client?.dispose();
  client = undefined;
  state = undefined;
  sample = undefined;
  rates = '';
  speed.disabled = true;
  metrics.textContent = '';
  for (const button of buttons) button.removeAttribute('aria-pressed');
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Carte 3D. Flèches pour déplacer la caméra, plus et moins pour zoomer.');
  surface.replaceChildren(canvas);
  message('Chargement de la colonie…');
  const fail = (error: string) => {
    if (opening !== id) return;
    inspection?.clear();inspection=undefined;
    ++opening;
    speed.disabled = true;
    client?.dispose();
    client = undefined;
    metrics.textContent = '';
    message(error === 'Cette sauvegarde est illisible ou incompatible avec cette version. La colonie actuelle et vos sauvegardes sont conservées.'
      ? 'Cette sauvegarde est illisible ou incompatible avec cette version.'
      : error);
  };
  try {
    const current = new WorkerColonyClient(canvas, {
      onState: next => { if (opening === id) update(next); },
      onProgress: text => { if (opening === id) message(text); },
      onViewChange:()=>{if(opening===id)inspection?.clear();},
      onError: fail,
    });
    client = current;
    dimensions();
    current.visible(!document.hidden);
    bindCamera(canvas, current);
    await current.open(source);
    if (opening !== id) return;
    if(nativeSpeedHud){
      let scale=1;
      try{scale=parseNativeUiScale(localStorage.getItem(NATIVE_UI_SCALE_PREFERENCE_KEY));}catch{/* Storage may be disabled. */}
      current.enableSpeedHud(scale,matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    speed.disabled = false;
    message('');
    canvas.focus({preventScroll: true});
  } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
}

element('open-colony').addEventListener('submit', event => {
  event.preventDefault();
  void openColony(element<HTMLSelectElement>('colony').value);
});
element('import').onclick = () => file.click();
file.onchange = () => {
  const save = file.files?.[0];
  file.value = '';
  if (save) void openColony(save);
};
for (const button of buttons) button.onclick = () => requestSpeed(Number(button.dataset.speed) as 0 | 1 | 3 | 6);
new ResizeObserver(dimensions).observe(surface);
window.addEventListener('resize', dimensions);
document.addEventListener('visibilitychange', () => client?.visible(!document.hidden));
window.addEventListener('pagehide', event => { inspection?.clear();if (!event.persisted) { ++opening; client?.dispose(); client = undefined; } });
