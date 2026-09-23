const status=document.querySelector('#status'),host=document.querySelector('#reviews');
const params=new URLSearchParams(location.hash.slice(1)), admin=params.get('admin');
const fields={description:'Description (award name)',qualifications:'Qualifications',competition:'Competition involved'};
const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
let entries=new Map(),sectionNames=new Map(),origins=new Map();
async function loadLabels(){
 const key=params.get('key');if(!key)return;
 const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const packet=await fetch('sketch.enc.json',{cache:'no-store'}).then(r=>r.json());
 const cryptoKey=await crypto.subtle.importKey('raw',decode(key),'AES-GCM',false,['decrypt']);
 const data=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(packet.iv)},cryptoKey,decode(packet.ciphertext))));
 for(const section of data.sections){sectionNames.set(section.id,section.name);for(const e of section.entries){entries.set(e.id,e);origins.set(e.id,section.id);}}
}
function title(id){const e=entries.get(id);return e?`${e.ref} · ${e.t}${e.project?' — '+e.project:''}`:id;}
function render(review){
 const d=review.data||review,article=node('article','');article.append(node('h2',d.name||'Unnamed reviewer'));
 article.append(node('small','Last saved: '+(review.updatedAt||review.exportedAt||d.updatedAt||'Unknown')));
 if(Object.keys(d.sectionMoves||{}).length){article.append(node('h3','Suggested section changes'));for(const [id,to] of Object.entries(d.sectionMoves))article.append(node('p',title(id)+': '+(sectionNames.get(origins.get(id))||'Original section')+' → '+(sectionNames.get(to)||to)));}
 for(const [id,messages] of Object.entries(d.threads||{})){
  if(!messages.length)continue;
  article.append(node('h3',title(id)));
  for(const m of messages){const block=node('div','');block.className='comment';block.append(node('small',[(fields[m.field]||'Comment'),m.at?new Date(m.at).toLocaleString():'',m.editedAt?'Edited '+new Date(m.editedAt).toLocaleString():''].filter(Boolean).join(' · ')),node('p',m.text));article.append(block);}
 }
 if(!Object.values(d.threads||{}).some(m=>m.length))article.append(node('p','No comments yet.'));
 const ranks=node('details','');ranks.append(node('summary','Rankings and entry verdicts'));
 for(const k of ['orderGen','orderOtt']){ranks.append(node('h3',k==='orderGen'?'General ranking':'Ottawa ranking'));for(const [category,ids] of Object.entries(d[k]||{})){ranks.append(node('h4',category));const list=node('ol','');for(const id of ids)list.append(node('li',title(id)));ranks.append(list);}}
 ranks.append(node('h3','Verdicts'));for(const [id,v] of Object.entries(d.verdicts||{}))if(v)ranks.append(node('p',title(id)+': '+v));article.append(ranks);
 article.append(node('h3','Notebook'),node('p',d.notebook||'No notebook notes.'));host.append(article);
}
const labelsReady=loadLabels().catch(()=>{});
document.querySelector('#files').addEventListener('change',async e=>{await labelsReady;for(const f of e.target.files){try{render(JSON.parse(await f.text()));status.textContent='Review file loaded.';}catch{status.textContent='Could not read '+f.name;}}});
async function load(){try{
 if(!admin)throw Error('This inbox requires Imran’s private admin link. Reviewer links cannot open it.');
 status.textContent='Loading private feedback…';await labelsReady;
 const config=await fetch('config.json',{cache:'no-store'}).then(r=>r.json());if(!config.apiBase)throw Error('Online feedback storage is not connected yet.');
 const response=await fetch(config.apiBase.replace(/\/$/,'')+'/admin/reviews',{headers:{Authorization:'Bearer '+admin}});if(!response.ok)throw Error('Access denied or service unavailable. Check your admin link.');
 const result=await response.json();host.textContent='';result.reviews.forEach(render);status.textContent=result.reviews.length+' private reviews · refreshed '+new Date().toLocaleTimeString();
}catch(e){status.textContent=e.message;}}
document.querySelector('#load').addEventListener('click',load);
if(admin)load();else status.textContent='Private admin access required.';
