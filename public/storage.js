(function(){
 'use strict';
 const params=new URLSearchParams(location.hash.slice(1));
 const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
 const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const token=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
 let key=params.get('key')||read('abs-access-key');
 let identity=params.has('review')&&params.has('token')?{id:params.get('review'),token:params.get('token')}:read('abs-review-identity');
 if(!identity)identity={id:crypto.randomUUID(),token:token()};
 try{write('abs-review-identity',identity);}catch{}
 const localPreview=['localhost','127.0.0.1','[::1]'].includes(location.hostname);
 let config={apiBase:''}, revision=0;
 let draftKey='abs-review-'+identity.id;
 const problem=(message,code)=>Object.assign(Error(message),{code});
 async function request(url,options={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{return await fetch(url,{...options,signal:controller.signal});}
  catch(error){throw problem(error.name==='AbortError'?'The connection timed out. Please try again.':'Could not connect. Check your connection and try again.','connection');}
  finally{clearTimeout(timeout);}
 }
 let configPromise=null;
 function loadConfig(){
  if(!configPromise)configPromise=request('config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw problem('Could not load the site. Please try again.','connection');return r.json();}).then(c=>{config=localPreview?{...c,apiBase:''}:c;return config;}).catch(error=>{configPromise=null;throw error;});
  return configPromise;
 }
 function keepAccess(){try{write('abs-access-key',key);}catch{}}
 function apiUrl(path){return config.apiBase.replace(/\/$/,'')+path;}
 async function api(method,payload){
  const response=await request(apiUrl('/reviews/'+identity.id),{method,headers:{'Authorization':'Bearer '+identity.token,'X-Sketch-Key':key||'','Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
  if(response.status===404&&method==='GET')return null;
  const data=await response.json().catch(()=>({error:'Feedback service unavailable'}));if(!response.ok){const e=Error(data.error||'Save failed');e.status=response.status;throw e;}return data;
 }
 async function decryptFile(file,accessKey=key){
  if(!accessKey)throw problem('This browser needs your private invitation link. Open the complete link or paste it below.','invitation');
  if(typeof accessKey!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(accessKey))throw problem('This invitation is incomplete or invalid. Paste the complete private link below.','invalid-invitation');
  const response=await request(file,{cache:'no-store'});
  if(!response.ok)throw problem('Could not load the application. Please try again.','connection');
  let packet;try{packet=await response.json();}catch{throw problem('Could not read the application. Please try again.','connection');}
  try{
   const cryptoKey=await crypto.subtle.importKey('raw',un64(accessKey),'AES-GCM',false,['decrypt']);
   const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(packet.iv)},cryptoKey,un64(packet.ciphertext));
   return JSON.parse(new TextDecoder().decode(bytes));
  }catch{throw problem('This invitation could not unlock the application. Paste the current private link below.','invalid-invitation');}
 }
 window.ABS={
  loadEssays(){return decryptFile('essays.enc.json');},
  async loadSketch(){
   const data=await decryptFile('sketch.enc.json');await loadConfig();keepAccess();return data;
  },
  async unlock(invitation){
   let candidate=invitation.trim();
   if(candidate.includes('#'))candidate=new URLSearchParams(candidate.slice(candidate.indexOf('#')+1)).get('key');
   const data=await decryptFile('sketch.enc.json',candidate||'');await loadConfig();key=candidate;keepAccess();
   try{history.replaceState(null,'',location.origin+location.pathname+'#'+new URLSearchParams({key}));}catch{}
   return data;
  },
  cloud(){return !!config.apiBase;},
  draft(data,dirty=true){write(draftKey,{data,dirty,revision,at:new Date().toISOString()});},
  async open(name){
   await loadConfig();
   if(config.apiBase&&name){
    const response=await request(apiUrl('/login'),{method:'POST',headers:{'X-Sketch-Key':key||'','Content-Type':'application/json'},body:JSON.stringify({name})});
    const login=await response.json();if(!response.ok)throw Error(login.error||'Could not open your review.');
    identity={id:login.id,token:login.token};draftKey='abs-review-'+identity.id;
    try{write('abs-review-identity',identity);}catch{}
    try{history.replaceState(null,'',location.origin+location.pathname+'#'+new URLSearchParams({key:key||''}));}catch{}
   }
   if(!config.apiBase&&name){
    const normalized=name.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
    draftKey='abs-local-review-'+encodeURIComponent(normalized);
   }
   const local=read(draftKey);
   if(!config.apiBase){revision=local?.revision||0;return local?.data||null;}
   let remote;
   try{remote=await api('GET');}catch(e){throw Error('Could not open your review. Please try again when connected.');}
   revision=remote?.revision||0;
   if(local?.dirty){
    if(local.revision!==revision)throw Error('This device has unsent changes and another saved version exists. Keep this page open and contact Imran to recover your changes.');
    return local.data;
   }
   return remote?.data||local?.data||null;
  },
  async save(data){
   try{this.draft(data,true);}catch(error){if(!config.apiBase)throw error;}
   if(!config.apiBase){this.draft(data,false);return {local:true};}
   const result=await api('PUT',{data,revision});revision=result.revision;
   // The caller writes the newest draft if typing continued during this request.
   try{this.draft(data,false);}catch{}return {local:false};
  },
  link(){const p=new URLSearchParams({key:key||'',review:identity.id,token:identity.token});return location.origin+location.pathname+'#'+p;},
  close(){
   const local=read(draftKey);if(local?.dirty)throw Error('Save your changes before closing the review.');
   if(config.apiBase)localStorage.removeItem(draftKey);localStorage.removeItem('abs-review-identity');localStorage.removeItem('absName');
   history.replaceState(null,'',location.origin+location.pathname+'#'+new URLSearchParams({key:key||''}));location.reload();
  },
  download(data){
   const content=data||read(draftKey)?.data;if(!content)throw Error('No review to download yet.');
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'abs-cut-room-review-v1',reviewId:identity.id,exportedAt:new Date().toISOString(),data:content},null,2)],{type:'application/json'}));a.download='ABS-review-'+(content.name||'draft').replace(/[^a-z0-9]+/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
 };
})();
