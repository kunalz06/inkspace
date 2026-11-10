import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures, scoreTouch, classifyPointer, trainPersonalModel, predictPalm } from '../src/input.js';
import { createPointerTracker } from '../src/tracker.js';

const evt = (id, width=8, height=8, type='touch') => ({pointerId:id,pointerType:type,width,height,pressure:0.5, clientX:100,clientY:100,timeStamp:1});

test('stylus is always accepted and oversized palm is rejected', ()=>{
  assert.equal(classifyPointer(evt(1, 2, 2,'pen')).action,'accept');
  assert.equal(classifyPointer(evt(2, 45, 35)).action,'reject');
});
test('touch data includes normalized finite features',()=>{
  const f=extractFeatures(evt(1,12,8));
  assert.equal(f.length,4);
  assert.ok(f.every(Number.isFinite));
});
test('small finger touch has a better writing score than large palm',()=>{
  assert.ok(scoreTouch(evt(1,6,7))>scoreTouch(evt(2,36,30)));
});
test('a new touch may be accepted while ignored palm remains down',()=>{
  const accepted=[];const ended=[];
  const tracker=createPointerTracker({onStart:e=>accepted.push(e.pointerId),onMove:()=>{},onEnd:e=>ended.push(e.pointerId)});
  tracker.down(evt(1,42,32)); // ignored palm
  tracker.down(evt(2,7,7)); // finger
  tracker.up(evt(2,7,7));
  tracker.down(evt(3,7,7)); // another finger stroke despite palm
  assert.deepEqual(accepted,[2,3]);
  assert.deepEqual(ended,[2]);
});
test('one active writing contact at a time',()=>{
  const accepted=[];
  const tracker=createPointerTracker({onStart:e=>accepted.push(e.pointerId),onMove:()=>{},onEnd:()=>{}});
  tracker.down(evt(1,7,7));tracker.down(evt(2,7,7));
  assert.deepEqual(accepted,[1]);
});
test('personal classifier improves separation with labeled examples',()=>{
  const examples=[...Array.from({length:8},(_,i)=>({features:extractFeatures(evt(i,5+i%3,6)),label:0})),...Array.from({length:8},(_,i)=>({features:extractFeatures(evt(20+i,38+i%3,27)),label:1}))];
  const model=trainPersonalModel(examples,240);
  assert.ok(predictPalm(model,extractFeatures(evt(2,40,30)))>predictPalm(model,extractFeatures(evt(3,6,6))));
});
