import fs from 'node:fs/promises';
import {measureText} from '../public/essay-model.js';
const args=process.argv.slice(2),reviewDrafts=args.includes('--review-drafts');
const sourcePath=args.find(arg=>!arg.startsWith('--'))||'private/essays-source.json';
if(!process.env.ABS_SECRETS_FILE)throw Error('Set ABS_SECRETS_FILE to the existing private key file.');
const {key}=JSON.parse(await fs.readFile(process.env.ABS_SECRETS_FILE,'utf8'));
const data=JSON.parse(await fs.readFile(sourcePath,'utf8'));
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
const cryptoKey=await crypto.subtle.importKey('raw',Buffer.from(key,'base64url'),'AES-GCM',false,['encrypt']);
const iv=crypto.getRandomValues(new Uint8Array(12));
const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv},cryptoKey,new TextEncoder().encode(JSON.stringify(data)));
await fs.writeFile('public/essays.enc.json',JSON.stringify({iv:Buffer.from(iv).toString('base64url'),ciphertext:Buffer.from(bytes).toString('base64url')}));
console.log('Encrypted '+data.essays.length+' essay responses. No publishing performed.');
