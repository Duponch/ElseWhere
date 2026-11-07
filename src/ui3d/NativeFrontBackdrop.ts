import * as THREE from 'three/webgpu';
import {FRONT_MENU_BACKGROUND_URL} from '../ui/front-menu-background';

/** An unlit, camera-fixed illustration behind the launch menus. It never joins
 * the game renderer's overlay: hiding the front screens hides this mesh too. */
export class NativeFrontBackdrop {
  private readonly material = new THREE.MeshBasicMaterial({depthTest:false,depthWrite:false,toneMapped:false});
  readonly mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,1),this.material);
  private readonly texture:THREE.Texture;
  private active=true;
  private closed=false;
  private state:'loading'|'ready'|'failed'='loading';
  private aspect=1;

  constructor(camera:THREE.PerspectiveCamera,private readonly invalidate:()=>void,loader=new THREE.TextureLoader()) {
    this.mesh.name='front-menu-background';
    this.mesh.position.z=-100;
    this.mesh.renderOrder=-10000;
    this.mesh.frustumCulled=false;
    this.mesh.visible=false;
    camera.add(this.mesh);
    this.texture=loader.load(FRONT_MENU_BACKGROUND_URL,texture=>{
      if(this.closed)return;
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.generateMipmaps=false;
      texture.minFilter=THREE.LinearFilter;
      this.material.map=texture;
      this.material.needsUpdate=true;
      this.state='ready';
      this.cover();
      this.mesh.visible=this.active;
      this.invalidate();
    },undefined,()=>{
      if(this.closed)return;
      // Decorative artwork must not block navigation when a request fails.
      this.state='failed';this.mesh.visible=false;this.invalidate();
    });
  }

  resize(camera:THREE.PerspectiveCamera):void {
    this.aspect=camera.aspect;
    const height=2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*100;
    this.mesh.scale.set(height*this.aspect,height,1);
    if(this.state==='ready')this.cover();
  }

  setVisible(visible:boolean):void {
    this.active=visible;
    this.mesh.visible=visible&&this.state==='ready'&&!this.closed;
  }

  private cover():void {
    const image=this.texture.image as {width:number;height:number};
    const ratio=(image.width/image.height)/this.aspect;
    const x=ratio>1?1/ratio:1,y=ratio>1?1:ratio;
    this.texture.repeat.set(x,y);
    this.texture.offset.set((1-x)/2,(1-y)/2);
    this.texture.updateMatrix();
  }

  get diagnostics(){return {state:this.state,visible:this.mesh.visible};}

  dispose():void {
    if(this.closed)return;
    this.closed=true;this.mesh.visible=false;this.mesh.removeFromParent();
    this.texture.dispose();this.material.dispose();this.mesh.geometry.dispose();
  }
}
