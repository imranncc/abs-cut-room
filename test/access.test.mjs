import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto as crypto} from 'node:crypto';
const script=fs.readFileSync(new URL('../public/storage.js',import.meta.url),'utf8');
async function setup({initialKey,failConfig=false,blockedStorage=false,timeout=false}={}){
 const bytes=crypto.getRandomValues(new Uint8Array(32)),key=Buffer.from(bytes).toString('base64url');
 const cryptoKey=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12)),source={sections:[],meta:{cap:32}};
 const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,new TextEncoder().encode(JSON.stringify(source)));
 const packet={iv:Buffer.from(iv).toString('base64url'),ciphertext:Buffer.from(ciphertext).toString('base64url')};
 const data=new Map(),requests=[];let firstConfig=failConfig,hang=timeout;
 if(initialKey)data.set('abs-access-key',JSON.stringify(initialKey==='valid'?key:initialKey));
 const context=vm.createContext({crypto,AbortController,URLSearchParams,TextDecoder,TextEncoder,Uint8Array,Date,JSON,
  setTimeout:(fn,ms)=>setTimeout(fn,timeout?Math.min(ms,10):ms),clearTimeout,
  location:{hostname:'example.com',hash:'',origin:'https://example.com',pathname:'/',reload(){}},history:{replaceState(){}},
  localStorage:{getItem:k=>{if(blockedStorage)throw Error('Blocked');return data.get(k)||null;},setItem:(k,v)=>{if(blockedStorage)throw Error('Blocked');data.set(k,v);},removeItem:k=>data.delete(k)},
  btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),window:{},
  fetch:async(url,options)=>{
   requests.push(url);
   if(hang){hang=false;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Object.assign(Error('Aborted'),{name:'AbortError'}))));}
   if(url==='config.json'){if(firstConfig){firstConfig=false;throw Error('Offline');}return {ok:true,json:async()=>({apiBase:'https://feedback.example'})};}
   if(url==='sketch.enc.json'||url==='essays.enc.json')return {ok:true,json:async()=>packet};
   if(url.endsWith('/login'))return {ok:true,json:async()=>({id:'returning-review',token:'saved-token'})};
   if(url.endsWith('/reviews/returning-review'))return {ok:true,json:async()=>({revision:5,data:{name:'Imran C',threads:{entry:[{text:'Existing feedback'}]}}})};
   throw Error('Unexpected request');
  }});
 vm.runInContext(script,context);
 return {abs:context.window.ABS,key,source,data,requests};
}
test('a fresh browser explains missing access and a full invitation restores an existing review',async()=>{
 const h=await setup();await assert.rejects(h.abs.loadSketch(),e=>e.code==='invitation');assert.deepEqual(h.requests,[]);
 assert.deepEqual(JSON.parse(JSON.stringify(await h.abs.unlock('https://example.com/#key='+h.key))),h.source);
 const review=await h.abs.open('Imran C');assert.equal(review.name,'Imran C');assert.equal(review.threads.entry[0].text,'Existing feedback');
 assert.equal(JSON.parse(h.data.get('abs-access-key')),h.key);
});
test('an invalid invitation does not replace working access and a transient failure can retry',async()=>{
 const h=await setup({initialKey:'valid',failConfig:true});
 await assert.rejects(h.abs.unlock('https://example.com/#key=invalid'),e=>e.code==='invalid-invitation');
 assert.equal(JSON.parse(h.data.get('abs-access-key')),h.key);
 await assert.rejects(h.abs.loadSketch(),e=>e.code==='connection');
 assert.deepEqual(JSON.parse(JSON.stringify(await h.abs.loadSketch())),h.source);
});
test('invitation access works when browser storage is unavailable',async()=>{
 const h=await setup({blockedStorage:true});await h.abs.unlock('https://example.com/#key='+h.key);
 assert.equal((await h.abs.open('Imran C')).name,'Imran C');
});
test('a hung request times out and allows another attempt',async()=>{
 const h=await setup({initialKey:'valid',timeout:true});
 await assert.rejects(h.abs.loadSketch(),e=>e.code==='connection'&&/timed out/.test(e.message));
 assert.deepEqual(JSON.parse(JSON.stringify(await h.abs.loadSketch())),h.source);
});
