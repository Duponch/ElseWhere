import {expect,test,vi} from 'vitest';
import {NativeStage} from '../src/ui3d/NativeStage';

// Real stage transitions with just the renderer/painter boundary declared.
// The front UI keeps its own RAF while the game can be preparing a new atlas.
function fixture(){
  const standby={setActive:vi.fn()},frontBackdrop={setVisible:vi.fn()},setClearColor=vi.fn();
  const ownRenderer={setClearColor,domElement:{style:{display:'none'}}};
  const stage=Object.assign(Object.create(NativeStage.prototype),{
    closed:false,worldVisible:true,standalone:false,frontVisible:false,frontOverGame:false,frameId:0,sceneRevision:0,
    standby,frontBackdrop,ownRenderer,anchors:{bottomCenter:{visible:true}},toolsDock:{visible:true},
    options:{onEscape:vi.fn(),onError:vi.fn()},activationSerial:0,
    resetCountdownFrame298:vi.fn(),resetShipCurtain298:vi.fn(),closeFloatMenu:vi.fn(),updateDevBarVisibility:vi.fn(),resize:vi.fn(),
    rebuildPage:vi.fn(),updateWorldReadoutVisibility:vi.fn(),syncEnvironmentHover:vi.fn(),invalidate:vi.fn(),closeDropdown:vi.fn(),clearHint:vi.fn(),
  });
  return {stage,standby,frontBackdrop,setClearColor,ownRenderer};
}

test('the exclusive surface is transparent only over an available map, not on the illustrated title screen',()=>{
  const {stage,standby,frontBackdrop,setClearColor,ownRenderer}=fixture();
  stage.setFrontVisible(true,true);
  expect(frontBackdrop.setVisible).toHaveBeenLastCalledWith(false);
  expect(setClearColor).toHaveBeenLastCalledWith(0x000000,0);
  expect(ownRenderer.domElement.style.display).toBe('block');
  expect(standby.setActive).toHaveBeenLastCalledWith(true);
  expect(stage.countdownDriver298()).toBe('standalone');
  expect(stage.anchors.bottomCenter.visible).toBe(false);
  const submissions=vi.fn();stage.animate=submissions;
  stage.renderOverlay({});expect(submissions).not.toHaveBeenCalled();
  // Mapless campaign / renderer failure: never expose a missing/stale map.
  stage.setWorldVisible(false);expect(setClearColor).toHaveBeenLastCalledWith(0xd8cbb8,1);
  expect(frontBackdrop.setVisible).toHaveBeenLastCalledWith(false);
  stage.setWorldVisible(true);expect(setClearColor).toHaveBeenLastCalledWith(0x000000,0);
  // The mode switch also works when the front stays open throughout.
  stage.setFrontVisible(true);expect(frontBackdrop.setVisible).toHaveBeenLastCalledWith(true);
  expect(setClearColor).toHaveBeenLastCalledWith(0xd8cbb8,1);
  stage.setFrontVisible(true,true);expect(setClearColor).toHaveBeenLastCalledWith(0x000000,0);
  stage.setFrontVisible(false);expect(frontBackdrop.setVisible).toHaveBeenLastCalledWith(false);
  expect(setClearColor).toHaveBeenLastCalledWith(0xd8cbb8,1);
  expect(standby.setActive).toHaveBeenLastCalledWith(false);
  expect(ownRenderer.domElement.style.display).toBe('none');
  expect(stage.countdownDriver298()).toBe('game');
});

test('an outside-click close restores the owning pause menu, without a second Escape closing it',()=>{
  const {stage}=fixture();stage.setFrontVisible(true,true);
  const onClose=vi.fn(()=>{stage.setFrontVisible(false);stage.page={id:'menu'};});
  stage.page={id:'front-options',modal:true,closeOwnsNavigation:true,onClose};
  stage.dismissPage();
  expect(onClose).toHaveBeenCalledOnce();expect(stage.page.id).toBe('menu');
  expect(stage.options.onEscape).not.toHaveBeenCalled();expect(stage.options.onError).not.toHaveBeenCalled();
});
