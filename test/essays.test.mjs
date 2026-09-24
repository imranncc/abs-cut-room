import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {measureText,limitLabel,draftText,unresolvedMarkers,versionThreadId} from '../public/essay-model.js';

test('character and word limits have distinct boundaries and preserve empty edits',()=>{
 assert.equal(measureText('x'.repeat(1700),{characters:1700}).over,false);
 assert.equal(measureText('x'.repeat(1701),{characters:1700}).over,true);
 assert.equal(measureText(Array(50).fill('care').join('\n '),{words:50}).over,false);
 assert.equal(measureText(Array(51).fill('care').join(' '),{words:50}).over,true);
 assert.equal(draftText({id:'a',draft:'base'},{essayDrafts:{a:{text:''}}}),'');
 assert.equal(unresolvedMarkers('Care (ABS #__).'),true);
 assert.equal(unresolvedMarkers('[confirm affected terms]'),true);
});

test('NOSM PDF caps apply even below approximate word guidance',()=>{
 const cap={characters:250,words:50,approximateWords:true};
 const belowWords=Array(41).fill('caregiving').join(' ');
 assert.equal(measureText(belowWords,cap).words,41);
 assert.equal(measureText(belowWords,cap).over,true);
 assert.equal(measureText('x'.repeat(250),cap).over,false);
 assert.equal(measureText('x'.repeat(251),cap).over,true);
 assert.match(measureText(belowWords,cap).label,/41 \/ ~50 words/);
 assert.match(limitLabel(cap),/250 characters.*approximately 50 words/);
 const aboveGuidance=measureText(Array(51).fill('a').join(' '),cap);
 assert.equal(aboveGuidance.over,false);
 assert.equal(aboveGuidance.guidanceOver,true);
 assert.match(aboveGuidance.label,/1 above guidance/);
 assert.equal(measureText('x'.repeat(501),{characters:500,words:100,approximateWords:true}).over,true);
});

test('local preview never logs into cloud; name-specific essays and comments survive sign out',async()=>{
 const data=new Map(),requests=[];let reloads=0;
 const context=vm.createContext({AbortController,setTimeout,clearTimeout,crypto:crypto.webcrypto,URLSearchParams,TextDecoder,TextEncoder,Uint8Array,Date,JSON,console,
  location:{hostname:'127.0.0.1',hash:'',origin:'http://127.0.0.1:4173',pathname:'/',reload(){reloads++;}},
  localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},
  history:{replaceState(){}},btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
  fetch:async url=>{requests.push(url);assert.equal(url,'config.json');return {ok:true,json:async()=>({apiBase:'https://live.example'})};},window:{}});
 vm.runInContext(fs.readFileSync(new URL('../public/storage.js',import.meta.url),'utf8'),context);
 const abs=context.window.ABS;await abs.open('  First Reviewer ');assert.equal(abs.cloud(),false);
 const review={name:'First Reviewer',essayDrafts:{'essay-tmu-q1':{text:'Working text'}},threads:{'essay-tmu-q1':[{text:'Essay comment'}],empl2:[{text:'Existing ABS comment'}]},notebook:'Note'};
 await abs.save(review);abs.close();assert.equal(reloads,1);
 assert.equal(await abs.open('Second Reviewer'),null);
 const restored=await abs.open('first   reviewer');assert.deepEqual(JSON.parse(JSON.stringify(restored)),review);
 assert.deepEqual(requests,['config.json']);
});


test('version comments remain separate from prior general feedback and personal edits',()=>{
 const e={id:'essay-tmu-q1'};
 assert.equal(versionThreadId(e,'working'),e.id);
 assert.equal(versionThreadId(e,'v7'),'essay-tmu-q1--v7');
 assert.notEqual(versionThreadId(e,'v7'),versionThreadId(e,'v6'));
});
