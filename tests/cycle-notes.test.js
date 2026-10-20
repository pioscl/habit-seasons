import test from 'node:test';
import assert from 'node:assert/strict';
import {populatedState} from './fixtures.js';
import {startCycle,checkIn,finishCycle,today,shiftDate,validate,upgrade,balance,expected} from '../src/model.js';

test('a note belongs to the cycle without changing the reusable template',()=>{
 const s=populatedState(),template=s.templates[0],before=structuredClone(template);
 const c=startCycle(s,template.id,today(),today(),{type:'daily'},{note:'十二点半前'});
 assert.equal(c.note,'十二点半前');assert.deepEqual(template,before);assert.equal('note' in c.snapshot,false);
 checkIn(s,c.id);finishCycle(s,c.id,'completed');
 const next=startCycle(s,template.id,today(),shiftDate(today(),6),{type:'daily'},{note:'十二点前'});
 assert.equal(next.note,'十二点前');assert.equal(c.note,'十二点半前');assert.equal(c.status,'completed');
 template.name='新名称';assert.equal(c.note,'十二点半前');assert.equal(next.note,'十二点前');validate(s);
});

test('new cycles default to an empty note rather than inheriting the previous cycle',()=>{
 const s=populatedState(),first=startCycle(s,s.templates[0].id,today(),today(),{type:'daily'},{note:'第一期备注'});
 checkIn(s,first.id);finishCycle(s,first.id,'completed');
 const second=startCycle(s,first.templateId,today(),today());assert.equal(second.note,'');assert.equal(first.note,'第一期备注');
});

test('notes preserve internal line breaks, trim outer whitespace and accept the length boundary',()=>{
 const s=populatedState();
 const c=startCycle(s,s.templates[0].id,today(),today(),{type:'daily'},{note:'  十二点半前\n睡前不看手机  '});
 assert.equal(c.note,'十二点半前\n睡前不看手机');
 const other=startCycle(s,s.templates[1].id,today(),today(),{type:'daily'},{note:'字'.repeat(200)});assert.equal(other.note.length,200);
 const blank=startCycle(s,s.templates[2].id,today(),today(),{type:'daily'},{note:' \n\t '});assert.equal(blank.note,'');validate(s);
});

test('invalid notes are rejected before any cycle or template is changed',()=>{
 for(const note of [null,12,true,{},[], '字'.repeat(201)]){
  const s=populatedState(),before=structuredClone(s);
  assert.throws(()=>startCycle(s,s.templates[0].id,today(),today(),{type:'daily'},{note}),/备注/);
  assert.deepEqual(s,before);
 }
});

test('old v4 backups without notes remain valid without an implicit migration',()=>{
 const s=populatedState(),c=startCycle(s,s.templates[0].id,today(),today());delete c.note;
 const before=structuredClone(s),restored=upgrade(s);
 assert.equal(restored.schemaVersion,4);assert.deepEqual(restored,before);assert.deepEqual(s,before);validate(restored);
});

test('notes survive backup export and import while invalid backup notes are rejected',()=>{
 const s=populatedState(),note='十二点前\n<script>文字备注</script>';
 startCycle(s,s.templates[0].id,today(),today(),{type:'daily'},{note});
 const restored=upgrade(JSON.parse(JSON.stringify(s)));assert.equal(restored.cycles[0].note,note);assert.deepEqual(restored,s);
 for(const invalid of [null,{},42,'字'.repeat(201)]){const copy=structuredClone(s);copy.cycles[0].note=invalid;assert.throws(()=>validate(copy),/备注/)}
});

test('a note does not change frequency, planned count, completion or points',()=>{
 const s=populatedState(),c=startCycle(s,s.templates[0].id,today(),today(),{type:'weekly',times:3},{points:15,weeklyBonusPoints:5,completionThreshold:100,note:'十二点前'});
 assert.equal(expected(c),1);assert.equal(checkIn(s,c.id),20);assert.equal(balance(s),20);
 assert.equal(finishCycle(s,c.id,'completed'),'completed');assert.equal(c.note,'十二点前');validate(s);
});
