(function(){
 'use strict';
 const params=new URLSearchParams(location.hash.slice(1));
 const read=k=>{try{return JSON.parse(localStorage.getItem(k));}catch{return null;}};
 const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
 const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const un64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const token=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
 const key=params.get('key')||read('abs-access-key');
 if(key){try{write('abs-access-key',key);}catch{}}
 let identity=params.has('review')&&params.has('token')?{id:params.get('review'),token:params.get('token')}:read('abs-review-identity');
 if(!identity)identity={id:crypto.randomUUID(),token:token()};
 try{write('abs-review-identity',identity);}catch{}
 let config={apiBase:''}, revision=0;
 const draftKey='abs-review-'+identity.id;
 const configPromise=fetch('config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Configuration unavailable');return r.json();}).then(c=>{config=c;return c;});
 function apiUrl(path){return config.apiBase.replace(/\/$/,'')+path;}
 async function api(method,payload){
  const response=await fetch(apiUrl('/reviews/'+identity.id),{method,headers:{'Authorization':'Bearer '+identity.token,'X-Sketch-Key':key||'','Content-Type':'application/json'},body:payload?JSON.stringify(payload):undefined});
  if(response.status===404&&method==='GET')return null;
  const data=await response.json();if(!response.ok){const e=Error(data.error||'Save failed');e.status=response.status;throw e;}return data;
 }
 window.ABS={
  async loadSketch(){
   await configPromise;
   if(!key)throw Error('Open the private invitation link Imran sent you.');
   try{
    const packet=await fetch('sketch.enc.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Missing sketch');return r.json();});
    const cryptoKey=await crypto.subtle.importKey('raw',un64(key),'AES-GCM',false,['decrypt']);
    const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(packet.iv)},cryptoKey,un64(packet.ciphertext));
    return JSON.parse(new TextDecoder().decode(bytes));
   }catch{throw Error('This invitation link could not unlock the sketch. Ask Imran for the current link.');}
  },
  cloud(){return !!config.apiBase;},
  draft(data,dirty=true){write(draftKey,{data,dirty,revision,at:new Date().toISOString()});},
  async open(){
   await configPromise;
   const local=read(draftKey);
   if(!config.apiBase){revision=local?.revision||0;return local?.data||null;}
   let remote;
   try{remote=await api('GET');}catch(e){throw Error(e.message+' Download your local backup before changing devices.');}
   revision=remote?.revision||0;
   if(local?.dirty){
    if(local.revision!==revision)throw Error('This device has unsent changes and another saved version exists. Download the local backup before reloading.');
    return local.data;
   }
   return remote?.data||local?.data||null;
  },
  async save(data){
   this.draft(data,true);
   if(!config.apiBase){this.draft(data,false);return {local:true};}
   const result=await api('PUT',{data,revision});revision=result.revision;
   // The caller writes the newest draft if typing continued during this request.
   this.draft(data,false);return {local:false};
  },
  link(){const p=new URLSearchParams({key:key||'',review:identity.id,token:identity.token});return location.origin+location.pathname+'#'+p;},
  close(){
   const local=read(draftKey);if(local?.dirty)throw Error('Save your changes before closing the review.');
   localStorage.removeItem(draftKey);localStorage.removeItem('abs-review-identity');localStorage.removeItem('absName');
   history.replaceState(null,'',location.origin+location.pathname+'#'+new URLSearchParams({key:key||''}));location.reload();
  },
  download(data){
   const content=data||read(draftKey)?.data;if(!content)throw Error('No review to download yet.');
   const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'abs-cut-room-review-v1',reviewId:identity.id,exportedAt:new Date().toISOString(),data:content},null,2)],{type:'application/json'}));a.download='ABS-review-'+(content.name||'draft').replace(/[^a-z0-9]+/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
 };
})();
