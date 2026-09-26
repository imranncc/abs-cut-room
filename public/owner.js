const status=document.querySelector('#status'),host=document.querySelector('#reviews');
const params=new URLSearchParams(location.hash.slice(1)), admin=params.get('admin');
const fields={description:'Description (award name)',qualifications:'Qualifications',competition:'Competition involved',comment:'Comment',suggestion:'Suggested wording'};
const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
let entries=new Map(),sectionNames=new Map(),origins=new Map(),reviews=[];
const isEssay=id=>id.startsWith("essay-");
const amount=(n,label)=>`${n} ${label}${n===1?'':'s'}`;
const counts=d=>{let abs=0,essays=0;for(const [id,m] of Object.entries(d.threads||{})){if(isEssay(id))essays+=m.length;else abs+=m.length;}return {abs,essays,drafts:Object.keys(d.essayDrafts||{}).length};};
const reviewerSelect=document.querySelector("#reviewer"),viewSelect=document.querySelector("#view");
async function loadLabels(){
 const key=params.get('key');if(!key)return;
 const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 const packet=await fetch('sketch.enc.json',{cache:'no-store'}).then(r=>r.json());
 const cryptoKey=await crypto.subtle.importKey('raw',decode(key),'AES-GCM',false,['decrypt']);
 const data=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(packet.iv)},cryptoKey,decode(packet.ciphertext))));
 try{
  const essayPacket=await fetch('essays.enc.json',{cache:'no-store'}).then(r=>r.json());
  const essayData=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(essayPacket.iv)},cryptoKey,decode(essayPacket.ciphertext))));
  for(const e of essayData.essays){entries.set(e.id,{ref:e.code||e.school,t:e.title+' · Working draft / general feedback'});entries.set(e.commentThreadId||e.id+'--v7',{ref:e.code||e.school,t:e.title});for(const v of e.versions||[])entries.set(e.id+'--'+v.id,{ref:e.code||e.school,t:e.title+' · '+v.label});}
 }catch{}
 for(const section of data.sections){sectionNames.set(section.id,section.name);for(const e of section.entries){entries.set(e.id,e);origins.set(e.id,section.id);}}
}
function title(id){const base=id.split('--')[0],e=entries.get(id)||entries.get(base);return e?`${e.ref} · ${e.t}${e.project?' — '+e.project:''}`:id;}
function render(review){
 const d=review.data||review,name=d.name||'Unnamed reviewer',view=viewSelect.value,c=counts(d),article=node('article','');article.append(node('h2',name));
 article.append(node('p',`${amount(c.abs,"ABS comment")} · ${amount(c.essays,"essay comment")} · ${amount(c.drafts,"saved essay draft")}`));
 article.append(node('small','Last saved: '+(review.updatedAt||review.exportedAt||d.updatedAt||'Unknown')));
 if(['all','abs'].includes(view)&&Object.keys(d.sectionMoves||{}).length){article.append(node('h3','Suggested section changes'));for(const [id,to] of Object.entries(d.sectionMoves))article.append(node('p',title(id)+': '+(sectionNames.get(origins.get(id))||'Original section')+' → '+(sectionNames.get(to)||to)));}
 for(const [id,messages] of Object.entries(d.threads||{})){
  if(!messages.length||view==='notes'||(view==='abs'&&isEssay(id))||(view==='essays'&&!isEssay(id)))continue;
  article.append(node('h3',title(id)));
  for(const m of messages){const block=node('div','');block.className='comment';block.append(node('strong',name+' · '+(isEssay(id)?'Essay feedback':'ABS feedback')),node('small',[(fields[m.field]||'Comment'),m.at?new Date(m.at).toLocaleString():'',m.editedAt?'Edited '+new Date(m.editedAt).toLocaleString():''].filter(Boolean).join(' · ')),node('p',m.text));article.append(block);}
 }
 if(view==='essays'&&!c.essays)article.append(node('p','No essay comments from '+name+'.'));
 if(view==='abs'&&!c.abs)article.append(node('p','No ABS comments from '+name+'.'));
 if(view==='all'&&!c.abs&&!c.essays)article.append(node('p','No comments from '+name+' yet.'));
 if(['all','essays'].includes(view)&&Object.keys(d.essayDrafts||{}).length){article.append(node('h3','Essay working drafts'));for(const [id,draft]of Object.entries(d.essayDrafts)){const section=node('div','');section.className='comment';section.append(node('strong',name+' · Saved essay draft (not a comment)'),node('h4',title(id)),node('small',draft.updatedAt?'Draft saved: '+new Date(draft.updatedAt).toLocaleString():''),node('p',draft.text||''));article.append(section);}}
 if(['all','abs'].includes(view)){const ranks=node('details','');ranks.append(node('summary','Rankings and entry verdicts'));
 for(const k of ['orderGen','orderOtt']){ranks.append(node('h3',k==='orderGen'?'General ranking':'Ottawa ranking'));for(const [category,ids] of Object.entries(d[k]||{})){ranks.append(node('h4',category));const list=node('ol','');for(const id of ids)list.append(node('li',title(id)));ranks.append(list);}}
 ranks.append(node('h3','Verdicts'));for(const [id,v] of Object.entries(d.verdicts||{}))if(v)ranks.append(node('p',title(id)+': '+v));article.append(ranks);}
 if(['all','notes'].includes(view)){article.append(node('h3',name+'’s notebook'),node('p',d.notebook||'No notebook notes.'));}host.append(article);
}
function draw(){
 host.textContent='';const selected=reviewerSelect.value;
 reviews.forEach((review,i)=>{if(selected==='all'||selected===String(i))render(review);});
}
function showReviews(){
 const selected=reviewerSelect.value;reviewerSelect.textContent='';
 const all=node('option','All reviewers');all.value='all';reviewerSelect.append(all);
 const summary=document.querySelector('#overview');summary.textContent='';
 let abs=0,essays=0,drafts=0;
 reviews.forEach((review,i)=>{const d=review.data||review,c=counts(d);abs+=c.abs;essays+=c.essays;drafts+=c.drafts;
  const option=node('option',d.name||'Unnamed reviewer');option.value=String(i);reviewerSelect.append(option);
  const card=node('button','');card.type='button';card.className='reviewer-card';
  card.append(node('strong',d.name||'Unnamed reviewer'),node('span',`${amount(c.abs,"ABS comment")} · ${amount(c.essays,"essay comment")}`),node('span',`${amount(c.drafts,"essay draft")} · ${d.notebook?'Notebook saved':'No notebook'}`));
  card.addEventListener('click',()=>{reviewerSelect.value=String(i);draw();host.scrollIntoView({block:'start'});});summary.append(card);
 });
 if([...reviewerSelect.options].some(o=>o.value===selected))reviewerSelect.value=selected;
 document.querySelector('#totals').textContent=`${amount(abs,"ABS comment")} · ${amount(essays,"essay comment")} · ${amount(drafts,"saved essay draft")}`;
 draw();
}
reviewerSelect.addEventListener('change',draw);viewSelect.addEventListener('change',draw);
const labelsReady=loadLabels().catch(()=>{});
document.querySelector('#files').addEventListener('change',async e=>{await labelsReady;for(const f of e.target.files){try{reviews.push(JSON.parse(await f.text()));showReviews();status.textContent='Review file loaded.';}catch{status.textContent='Could not read '+f.name;}}});
async function load(){try{
 if(['localhost','127.0.0.1','[::1]'].includes(location.hostname))throw Error('Local preview does not connect to the live feedback inbox.');
 if(!admin)throw Error('This inbox requires Imran’s private admin link. Reviewer links cannot open it.');
 status.textContent='Loading private feedback…';await labelsReady;
 const config=await fetch('config.json',{cache:'no-store'}).then(r=>r.json());if(!config.apiBase)throw Error('Online feedback storage is not connected yet.');
 const response=await fetch(config.apiBase.replace(/\/$/,'')+'/admin/reviews',{headers:{Authorization:'Bearer '+admin}});if(!response.ok)throw Error('Access denied or service unavailable. Check your admin link.');
 const result=await response.json();reviews=result.reviews;showReviews();status.textContent=result.reviews.length+' private reviews · refreshed '+new Date().toLocaleTimeString();
}catch(e){status.textContent=e.message;}}
document.querySelector('#load').addEventListener('click',load);
if(admin)load();else status.textContent='Private admin access required.';
