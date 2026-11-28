import {describe,expect,it} from 'vitest';
import {coreSocialSituationIndex382,coreThoughtIndex382} from '../src/sim/core-thought-indices-382.ts';

describe('Core thought identities used by Alzheimer',()=>{
 it('keeps actual stages and target-dependent UI keys under their shared Def index',()=>{
  expect(['hungry','ravenous','starving','starvation-0','starvation-4'].map(coreThoughtIndex382)).toEqual([204,204,204,204,204]);
  expect(['psychic-low','psychic-soothe','psychic-extreme'].map(coreThoughtIndex382)).toEqual([250,250,250]);
  expect(['opinion-of-lover-1','opinion-of-lover-987654'].map(coreThoughtIndex382)).toEqual([241,241]);
  expect(['night-owl-day','night-owl-night','nudist-clothed','nudist-nude'].map(coreThoughtIndex382)).toEqual([270,271,265,266]);
  expect(['alcohol-high','environment-dark','trait-tortured-artist','expectations-low'].map(coreThoughtIndex382)).toEqual([0,193,279,280]);
 });
 it('never assigns a native thought to the difficulty offset or an unrecognized key',()=>{
  expect(coreThoughtIndex382('difficulty-mood')).toBeUndefined();
  expect(coreThoughtIndex382('opinion-of-lover-unknown')).toBeUndefined();
  expect(coreThoughtIndex382('toString')).toBeUndefined();
  expect(coreThoughtIndex382('custom-mod-thought')).toBeUndefined();
 });
 it('distinguishes situational social definitions from mood definitions and persistent links',()=>{
  expect(coreSocialSituationIndex382('trait-pretty')).toBe(228);
  expect(coreSocialSituationIndex382('trait-body-modder')).toBe(234);
  expect(coreSocialSituationIndex382('trait-ugly')).toBe(229);
  expect(coreSocialSituationIndex382('relation-lover')).toBeUndefined();
  expect(coreSocialSituationIndex382('insult')).toBeUndefined();
  expect(coreSocialSituationIndex382('couple-intimacy')).toBeUndefined();
 });
});
