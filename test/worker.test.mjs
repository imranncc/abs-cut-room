import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import crypto from 'node:crypto';
import worker,{hash} from '../worker/index.mjs';
const sketch=crypto.randomBytes(32).toString('base64url'),owner=crypto.randomBytes(32).toString('base64url');
const token=crypto.randomBytes(32).toString('base64url'),other=crypto.randomBytes(32).toString('base64url');
const id=crypto.randomUUID();
const db=new DatabaseSync(':memory:');db.exec(fs.readFileSync(new URL('../worker/schema.sql',import.meta.url),'utf8'));
const DB={prepare(sql){let args=[];const run={bind(...v){args=v;return run;},async first(){return db.prepare(sql).get(...args);},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};return run;}};
const env={DB,SKETCH_KEY_HASH:await hash(sketch),ADMIN_KEY_HASH:await hash(owner),ALLOWED_ORIGIN:'https://imranncc.github.io'};
const data={name:'Synthetic reviewer',notebook:'test',orderGen:{Employment:['empl2','empl3']},orderOtt:{Employment:['empl3','empl2']},verdicts:{empl3:'strong'},threads:{empl3:[{text:'Test only',at:'2026-09-23'}]}};
const request=(method,path='/reviews/'+id,body,auth=token,key=sketch,origin=env.ALLOWED_ORIGIN)=>worker.fetch(new Request('https://api.example'+path,{method,headers:{Authorization:'Bearer '+auth,'X-Sketch-Key':key,'Content-Type':'application/json',Origin:origin},body:body?JSON.stringify(body):undefined}),env);
test('private storage, revisions, access control and validation',async()=>{
 assert.equal((await request('PUT',undefined,{data,revision:0},token,other)).status,403);
 assert.equal((await request('PUT',undefined,{data,revision:0})).status,200);
 let saved=await (await request('GET')).json();assert.deepEqual(saved.data,data);assert.equal(saved.revision,1);
 assert.equal((await request('GET',undefined,undefined,other)).status,401);
 assert.equal((await request('PUT',undefined,{data,revision:1},other)).status,401);
 assert.equal((await request('GET','/admin/reviews')).status,401);
 const all=await (await request('GET','/admin/reviews',undefined,owner)).json();assert.equal(all.reviews.length,1);assert.equal('token_hash' in all.reviews[0],false);
 assert.equal((await request('PUT',undefined,{data:{...data,notebook:'new'},revision:1})).status,200);
 assert.equal((await request('PUT',undefined,{data:{...data,notebook:'stale overwrite'},revision:1})).status,409);
 saved=await (await request('GET')).json();assert.equal(saved.data.notebook,'new');assert.equal(saved.revision,2);
 assert.equal((await request('GET',undefined,undefined,token,sketch,'https://unrelated.example')).status,403);
 assert.equal((await request('PUT',undefined,{data:{name:'invalid'},revision:2})).status,400);
 assert.equal((await request('PUT',undefined,{data:{...data,notebook:'x'.repeat(260000)},revision:2})).status,413);
 assert.equal((await request('GET','/reviews')).status,404);
});
test('separate reviewers, editable comments, unsend and private admin inbox',async()=>{
 const secondId=crypto.randomUUID();
 const secondData={...data,name:'Second synthetic reviewer',threads:{empl3:[{id:'comment-2',text:'Private second review',at:'2026-09-23'}]}};
 assert.equal((await request('PUT','/reviews/'+secondId,{data:secondData,revision:0},other)).status,200);
 assert.equal((await request('GET','/reviews/'+secondId,undefined,token)).status,401);
 assert.equal((await request('GET','/admin/reviews',undefined,other)).status,401);
 assert.equal((await request('GET','/admin/reviews',undefined,sketch)).status,401);
 const edited={...secondData,threads:{empl3:[{...secondData.threads.empl3[0],text:'Edited private comment',editedAt:'2026-09-23'}]}};
 assert.equal((await request('PUT','/reviews/'+secondId,{data:edited,revision:1},other)).status,200);
 let saved=await (await request('GET','/reviews/'+secondId,undefined,other)).json();assert.equal(saved.data.threads.empl3[0].text,'Edited private comment');
 const unsent={...edited,threads:{empl3:[]}};
 assert.equal((await request('PUT','/reviews/'+secondId,{data:unsent,revision:2},other)).status,200);
 saved=await (await request('GET','/reviews/'+secondId,undefined,other)).json();assert.deepEqual(saved.data.threads.empl3,[]);
 const admin=await (await request('GET','/admin/reviews',undefined,owner)).json();assert.equal(admin.reviews.length,2);assert.deepEqual(admin.reviews.find(r=>r.id===secondId).data.threads.empl3,[]);
 assert.equal(JSON.stringify(admin).includes('Edited private comment'),false);
});
test('name login reopens existing feedback and keeps legacy links usable',async()=>{
 assert.equal((await request('POST','/login',{name:data.name},other,other)).status,403);
 const login=await (await request('POST','/login',{name:'  SYNTHETIC   Reviewer  '})).json();
 assert.equal(login.id,id);
 let saved=await (await request('GET','/reviews/'+login.id,undefined,login.token)).json();
 assert.equal(saved.data.notebook,'new');
 assert.equal((await request('PUT','/reviews/'+login.id,{data:{...saved.data,notebook:'Name login update'},revision:saved.revision},login.token)).status,200);
 saved=await (await request('GET',undefined,undefined,token)).json();assert.equal(saved.data.notebook,'Name login update');
 const repeat=await (await request('POST','/login',{name:'Synthetic reviewer'})).json();assert.deepEqual(repeat,login);
 assert.equal((await request('GET','/admin/reviews',undefined,login.token)).status,401);
});
test('new name registration is repeatable across devices and separates names',async()=>{
 const [a,b]=await Promise.all([request('POST','/login',{name:'New name'}),request('POST','/login',{name:'New name'})]);
 const login=await a.json();assert.deepEqual(await b.json(),login);
 const different=await (await request('POST','/login',{name:'Different name'})).json();assert.notEqual(different.id,login.id);
 assert.equal((await request('PUT','/reviews/'+login.id,{data:{...data,name:'New name'},revision:0},login.token)).status,200);
 assert.equal((await request('GET','/reviews/'+login.id,undefined,different.token)).status,401);
 const returning=await (await request('POST','/login',{name:'new NAME'})).json();assert.deepEqual(returning,login);
 assert.equal((await request('GET','/reviews/'+returning.id,undefined,returning.token)).status,200);
 assert.equal((await request('POST','/login',{name:' '})).status,400);
 assert.equal((await request('POST','/login',{name:'x'.repeat(101)})).status,400);
});

test('essay drafts round-trip with existing ABS rankings and independent threads',async()=>{
 const essayId=crypto.randomUUID(),payload={...data,name:'Essay persistence QA',essayDrafts:{'essay-tmu-q1':{text:'First draft',baseVersion:'v1'}},threads:{...data.threads,'essay-tmu-q1':[{id:'essay-msg',text:'Essay feedback',field:'suggestion',at:'2026-09-23'}]}};
 assert.equal((await request('PUT','/reviews/'+essayId,{data:payload,revision:0})).status,200);
 const saved=await(await request('GET','/reviews/'+essayId)).json();assert.deepEqual(saved.data,payload);
 const edit={...saved.data,essayDrafts:{'essay-tmu-q1':{text:'Revised draft',baseVersion:'v1'}}};
 assert.equal((await request('PUT','/reviews/'+essayId,{data:edit,revision:1})).status,200);
 const reopened=await(await request('GET','/reviews/'+essayId)).json();assert.deepEqual(reopened.data.threads,payload.threads);assert.deepEqual(reopened.data.orderGen,data.orderGen);assert.equal(reopened.data.essayDrafts['essay-tmu-q1'].text,'Revised draft');
});


test('an older client cannot erase published-version feedback or reviewer essay drafts',async()=>{
 const id=crypto.randomUUID(),payload={...data,essayDrafts:{'essay-tmu-q1':{text:'Keep my edits',baseVersion:'v4'}},threads:{...data.threads,'essay-tmu-q1--v7':[{id:'v7-note',text:'Latest feedback'}],'essay-tmu-q1--v4':[{id:'v4-note',text:'Earlier feedback'}]}};
 assert.equal((await request('PUT','/reviews/'+id,{data:payload,revision:0})).status,200);
 assert.equal((await request('PUT','/reviews/'+id,{data,revision:1})).status,409);
 const restored=await(await request('GET','/reviews/'+id)).json();assert.deepEqual(restored.data,payload);
 const edited=structuredClone(payload);edited.threads['essay-tmu-q1--v7']=[];
 assert.equal((await request('PUT','/reviews/'+id,{data:edited,revision:1})).status,200);
 const final=await(await request('GET','/reviews/'+id)).json();assert.deepEqual(final.data.threads['essay-tmu-q1--v7'],[]);assert.equal(final.data.threads['essay-tmu-q1--v4'].length,1);
});
