import test from 'node:test';import assert from 'node:assert/strict';import {createSectionModel} from '../public/review-model.js';
const original=[{id:'work',name:'Employment',entries:[{id:'a',t:'A'},{id:'b',t:'B'}]},{id:'vol',name:'Volunteering',entries:[{id:'c',t:'C'}]},{id:'other',name:'Other',entries:[]}];
test('move preserves all entries once, distinct rankings, and source data',()=>{
 const source=structuredClone(original),model=createSectionModel(source);
 const state={sectionMoves:{a:'vol'},orderGen:{work:['b','a'],vol:['c']},orderOtt:{work:['a','b'],vol:['c']}};
 let result=model.normalize(state);assert.deepEqual(result.orderGen,{work:['b'],vol:['c','a'],other:[]});assert.deepEqual(result.orderOtt,result.orderGen);assert.deepEqual(source,original);
 result.orderOtt.vol=['a','c'];result=model.normalize(result);assert.deepEqual(result.orderGen.vol,['c','a']);assert.deepEqual(result.orderOtt.vol,['a','c']);
 const reloaded=model.normalize(JSON.parse(JSON.stringify(result)));assert.deepEqual(reloaded,result);assert.equal(model.originalSection('a').id,'work');
 reloaded.sectionMoves.a='work';const restored=model.normalize(reloaded);assert.deepEqual(restored.sectionMoves,{});assert.deepEqual(restored.orderGen.work,['b','a']);assert.deepEqual(restored.orderGen.vol,['c']);
});
test('invalid placement and duplicate/stale ranks cannot lose or duplicate entries',()=>{
 const model=createSectionModel(original),result=model.normalize({sectionMoves:{a:'missing',ghost:'vol',c:'other'},orderGen:{work:['a','a','c','ghost'],other:['c','c']}});
 assert.deepEqual(result.sectionMoves,{c:'other'});assert.deepEqual(result.orderGen,{work:['a','b'],vol:[],other:['c']});
 assert.equal(result.sections.flatMap(s=>s.entries).length,3);assert.deepEqual(model.normalize({}).sections,original);
});
