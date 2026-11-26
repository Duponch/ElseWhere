import {expect,test} from 'vitest';
import {presentationSubmissionStalls} from '../scripts/harvest-assertions';

test('advancing CPU playheads and running speed changes cannot hide a scene submission outage',()=>{
 const frames=[
  {at:0,play:10,speed:1,submitted:true},
  {at:400,play:12,speed:3,submitted:false},
  {at:1001,play:24,speed:6,submitted:false},
  {at:1300,play:30,speed:6,submitted:false},
  {at:1600,play:40,speed:6,submitted:true},
  {at:1606,play:40.2,speed:6,submitted:true},
 ];
 expect(presentationSubmissionStalls(frames)).toEqual([{previous:frames[0],current:frames[2]}]);
 // An outage still active at the end is equally observable.
 expect(presentationSubmissionStalls(frames.slice(0,4))).toEqual([{previous:frames[0],current:frames[2]}]);
});

test('a long interval ending in a real submission retains the full wall-time gap',()=>{
 const frames=[{at:0,play:10,speed:6,submitted:true},{at:1200,play:30,speed:6,submitted:true}];
 expect(presentationSubmissionStalls(frames)).toEqual([{previous:frames[0],current:frames[1]}]);
 expect(presentationSubmissionStalls([{...frames[0]!,submitted:false},frames[1]!])).toEqual([{previous:{...frames[0]!,submitted:false},current:frames[1]}]);
});

test('ordinary skipped calls retain their age without becoming starvation, while pause ends a running outage',()=>{
 const frames=[
  {at:0,play:10,speed:1,submitted:true},
  {at:500,play:13,speed:1,submitted:false},
  {at:990,play:16,speed:1,submitted:true},
  {at:1500,play:16,speed:0,submitted:false},
  {at:5000,play:16,speed:0,submitted:false},
  {at:5100,play:16,speed:1,submitted:false},
  {at:5600,play:19,speed:1,submitted:true},
 ];
 expect(presentationSubmissionStalls(frames)).toEqual([]);
});
