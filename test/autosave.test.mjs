import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const app=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('  var timer=null'),app.indexOf('  var nameInput='));
function setup(save){
 const timers=new Map(),events={},statuses=[];let id=0;
 const c=vm.createContext({started:true,state:{name:'Reviewer'},thaw:x=>structuredClone(x),setStatus:(...s)=>statuses.push(s),
  setTimeout:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
  window:{ABS:{draft(){},save},addEventListener:(n,fn)=>events[n]=fn}});
 vm.runInContext(code,c);return {c,timers,events,statuses};
}
test('autosave retries an interrupted connection and sends the newest changes',async()=>{
 let calls=0;const h=setup(async data=>{if(++calls===1)throw new TypeError('Failed to fetch');assert.equal(data.name,'Updated reviewer');return {local:false};});
 h.c.queue();await h.c.save();assert.equal(h.c.dirty,true);assert.equal([...h.timers.values()][0].delay,1500);
 h.c.state.name='Updated reviewer';h.c.queue();await h.events.online();await new Promise(setImmediate);
 assert.equal(calls,2);assert.equal(h.c.dirty,false);assert.equal(h.statuses.at(-1)[0],'Saved');assert.equal(h.timers.size,0);
});
test('edits made during a request are saved before reporting Saved',async()=>{
 let finish;const names=[];const h=setup(data=>{names.push(data.name);return names.length===1?new Promise(r=>finish=r):Promise.resolve({local:false});});
 h.c.queue();const pending=h.c.save();h.c.state.name='Later edit';h.c.queue();finish({local:false});await pending;
 assert.deepEqual(names,['Reviewer','Later edit']);assert.equal(h.c.dirty,false);assert.equal(h.statuses.at(-1)[0],'Saved');
});
test('conflicts and authorization failures stop retries and preserve unsaved state',async()=>{
 for(const status of [401,403,409]){
  let calls=0;const h=setup(async()=>{calls++;throw Object.assign(new Error('Blocked'),{status});});
  h.c.queue();await h.c.save();h.c.queue();h.events.online();await h.c.save();
  assert.equal(calls,1);assert.equal(h.c.dirty,true);assert.equal(h.timers.size,0);
 }
});
test('normal review page has no manual save or download controls',()=>{
 const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/id="(?:save-now|download-review)"/);assert.doesNotMatch(app,/Download your review|#save-now|#download-review/);
});
