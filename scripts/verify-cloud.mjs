// Synthetic end-to-end checks. Uses no application descriptions or real reviews.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const config=JSON.parse(await fs.readFile(new URL('../public/config.json',import.meta.url),'utf8'));
const secretPath=process.env.ABS_SECRETS_FILE;if(!secretPath)throw Error('Set ABS_SECRETS_FILE to the private deployment key file');
const secrets=JSON.parse(await fs.readFile(secretPath,'utf8'));
const api=config.apiBase;if(!api)throw Error('Online storage is not configured');
const people=[0,1].map(i=>({id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('base64url'),name:'Disposable deployment test '+i}));
const base={notebook:'',orderGen:{Employment:['empl2','empl3']},orderOtt:{Employment:['empl3','empl2']},verdicts:{},threads:{}};
async function req(method,path,token,body){return fetch(api+path,{method,headers:{Origin:'https://imranncc.github.io',Authorization:'Bearer '+token,'X-Sketch-Key':secrets.key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});}
for(const p of people){p.data={...base,name:p.name,threads:{empl2:[{id:crypto.randomUUID(),text:p.name+' private comment',at:new Date().toISOString()}]}};assert.equal((await req('PUT','/reviews/'+p.id,p.token,{revision:0,data:p.data})).status,200);}
const [a,b]=people;
assert.equal((await req('GET','/reviews/'+a.id,b.token)).status,401);
assert.equal((await req('PUT','/reviews/'+a.id,b.token,{revision:1,data:b.data})).status,401);
assert.equal((await req('GET','/admin/reviews',a.token)).status,401);
assert.equal((await req('GET','/admin/reviews',secrets.key)).status,401);
let own=await (await req('GET','/reviews/'+a.id,a.token)).json();assert.deepEqual(own.data,a.data);
a.data.threads.empl2[0].text='Edited synthetic comment';
assert.equal((await req('PUT','/reviews/'+a.id,a.token,{revision:1,data:a.data})).status,200);
assert.equal((await req('PUT','/reviews/'+a.id,a.token,{revision:1,data:a.data})).status,409);
a.data.threads.empl2=[];
assert.equal((await req('PUT','/reviews/'+a.id,a.token,{revision:2,data:a.data})).status,200);
own=await (await req('GET','/reviews/'+a.id,a.token)).json();assert.deepEqual(own.data.threads.empl2,[]);
const admin=await (await req('GET','/admin/reviews',secrets.admin)).json();assert.ok(people.every(p=>admin.reviews.some(r=>r.id===p.id)));assert.deepEqual(admin.reviews.find(r=>r.id===a.id).data.threads.empl2,[]);
// Print only synthetic IDs, allowing these exact disposable rows to be cleaned up.
console.log(JSON.stringify({passed:true,checks:['save/reopen','reviewer isolation','admin authorization','edit','unsend','stale-save protection'],disposableIds:people.map(p=>p.id)}));
