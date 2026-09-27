import fs from 'node:fs/promises';
import {measureText} from '../public/essay-model.js';
const args=process.argv.slice(2),reviewDrafts=args.includes('--review-drafts');
const sourcePath=args.find(arg=>!arg.startsWith('--'))||'private/essays-source.json';
if(!process.env.ABS_SECRETS_FILE)throw Error('Set ABS_SECRETS_FILE to the existing private key file.');
const {key}=JSON.parse(await fs.readFile(process.env.ABS_SECRETS_FILE,'utf8'));
const data=JSON.parse(await fs.readFile(sourcePath,'utf8'));
// Keep notices accurate on subsequent publishes, including edits within one version.
const readKey=await crypto.subtle.importKey('raw',Buffer.from(key,'base64url'),'AES-GCM',false,['decrypt']);
let previous;
try{
 const packet=JSON.parse(await fs.readFile('public/essays.enc.json','utf8'));
 previous=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(packet.iv,'base64url')},readKey,Buffer.from(packet.ciphertext,'base64url'))));
}catch(error){if(error.code!=='ENOENT')throw error;}
for(const essay of data.essays){
 const currentVersion=essay.versions?.find(v=>v.id===essay.version&&v.text===essay.draft);
 if(currentVersion?.label.includes('Approved'))essay.reviewStatus='approved';
 const old=previous?.essays.find(e=>e.id===essay.id);
 if(old&&(old.draft!==essay.draft||old.prompt!==essay.prompt)){
  if(!essay.updatedAt||essay.updatedAt===old.updatedAt)essay.updatedAt=new Date().toISOString();
 }else if(old?.updatedAt)essay.updatedAt=old.updatedAt;
}
const ids=new Set();
for(const e of data.essays){
 if(!e.id.startsWith('essay-')||ids.has(e.id))throw Error('Invalid or duplicate essay ID');ids.add(e.id);
 if(!e.original||typeof e.draft!=='string'||!e.source?.url)throw Error('Missing source or draft');
 if(e.versions){
  const versionIds=new Set();
  for(const v of e.versions){if(!/^[a-z0-9-]+$/.test(v.id)||versionIds.has(v.id)||typeof v.text!=='string'||!v.label)throw Error('Invalid version for '+e.id);versionIds.add(v.id);}
  if(e.versions.find(v=>v.id===e.version)?.text!==e.draft)throw Error('Latest version does not match current response: '+e.id);
 }
 if(measureText(e.draft,e.limit).over){
  if(!reviewDrafts)throw Error('Draft exceeds its limit: '+e.id+' (use --review-drafts only to preserve unfinished text for review)');
  console.warn('Over-limit review draft preserved: '+e.id);
 }
}
// Publish only the current response. History and drafting notes stay in private files.
const published={version:data.version,essays:data.essays.filter(e=>['TMU','NOSM'].includes(e.school)).map(e=>({id:e.id,code:e.code,school:e.school,title:e.title,prompt:e.prompt,limit:e.limit,draft:e.draft,version:e.version,updatedAt:e.updatedAt,reviewStatus:e.reviewStatus,commentThreadId:e.commentThreadId||e.id+'--v7'}))};
const cryptoKey=await crypto.subtle.importKey('raw',Buffer.from(key,'base64url'),'AES-GCM',false,['encrypt']);
const iv=crypto.getRandomValues(new Uint8Array(12));
const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,new TextEncoder().encode(JSON.stringify(published)));
await fs.writeFile('public/essays.enc.json',JSON.stringify({iv:Buffer.from(iv).toString('base64url'),ciphertext:Buffer.from(bytes).toString('base64url')}));
console.log('Encrypted '+data.essays.length+' essay responses. No publishing performed.');
