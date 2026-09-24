import {createCommentThread} from './comments.js';
import {measureText,limitLabel,draftText,versionThreadId} from './essay-model.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
export function createEssayWorkspace({host,state,canEdit,onChange,onLocked}){
 let data=null,school='TMU',active=null,selected={};
 function render(){
  if(!data)return;host.textContent='';const wrap=el('div','wrap essay-workspace');host.append(wrap);
  const nav=el('div','switch');nav.setAttribute('aria-label','Essay school');nav.setAttribute('role','group');
  for(const name of ['TMU','NOSM','Ottawa']){const button=el('button',null,name);button.type='button';button.setAttribute('aria-pressed',String(school===name));button.onclick=()=>{school=name;active=null;render();};nav.append(button);}wrap.append(nav);
  const essays=data.essays.filter(e=>e.school===school);
  if(!essays.length){wrap.append(el('p','meta','No essay response required.'));return;}
  active=essays.some(e=>e.id===active)?active:essays[0].id;
  const layout=el('div','essay-layout'),menu=el('nav','essay-menu');menu.setAttribute('aria-label',school+' responses');
  for(const essay of essays){const button=el('button','essay-choice');button.type='button';button.setAttribute('aria-current',String(essay.id===active));button.append(el('span',null,(essay.code||essay.school)+' · '+essay.title),el('small',null,limitLabel(essay.limit)));button.onclick=()=>{active=essay.id;render();};menu.append(button);}layout.append(menu);
  const e=essays.find(e=>e.id===active),card=el('article','essay-card');card.dataset.essayId=e.id;layout.append(card);wrap.append(layout);
  card.append(el('h3',null,(e.code||e.school)+' · '+e.title),el('p','essay-prompt',e.prompt));
  const versions=e.versions||[{id:e.version,label:'Latest draft',text:e.draft}];
  let chosen=selected[e.id]||e.version;
  const saved=state.essayDrafts?.[e.id];
  if(chosen==='working'&&!saved)chosen=e.version;
  const personal=chosen==='working',version=versions.find(v=>v.id===chosen)||versions.at(-1);
  const versionName=v=>(v.id==='seed'?'Initial draft':v.id.toUpperCase())+(v.id===e.version?' · Latest':'');
  const versionLabel=personal?'My working draft':versionName(version);
  const versionControl=el('label','draft-label','Draft version'),select=el('select','essay-version');select.setAttribute('aria-label','Draft version for '+e.code);
  for(const v of [...versions].reverse()){const o=el('option',null,versionName(v));o.value=v.id;select.append(o);}
  if(saved){const o=el('option',null,'My working draft');o.value='working';select.append(o);}
  select.value=chosen;select.onchange=()=>{selected[e.id]=select.value;render();};versionControl.append(select);card.append(versionControl);
  const label=el('label','draft-label',versionLabel),editor=el('textarea','essay-editor');editor.id=e.id+'-draft';label.htmlFor=editor.id;editor.rows=13;editor.value=personal?draftText(e,state):version.text;editor.readOnly=!personal||!canEdit();editor.setAttribute('aria-label',versionLabel+': '+e.title);card.append(label,editor);
  const counter=el('p','essay-counter');counter.setAttribute('aria-live','polite');
  const count=()=>{const m=measureText(editor.value,e.limit);counter.className='essay-counter'+(m.over||m.guidanceOver?' over':'');counter.textContent=m.label+(e.limit.characters&&e.limit.words?'':' · '+(e.limit.characters?m.words+' words':m.characters+' characters'));};count();card.append(counter);
  editor.addEventListener('input',()=>{if(!canEdit())return onLocked();state.essayDrafts[e.id]={text:editor.value,updatedAt:new Date().toISOString(),baseVersion:saved?.baseVersion||e.version};count();onChange();});
  const tools=el('div','essay-actions'),copy=el('button','btn ghost','Copy draft'),copyStatus=el('span','meta');copy.type='button';copyStatus.setAttribute('role','status');copy.onclick=async()=>{try{await navigator.clipboard.writeText(editor.value);copyStatus.textContent='Copied.';}catch{copyStatus.textContent='Select the draft text and copy it.';editor.focus();editor.select();}};tools.append(copy,copyStatus);
  if(!personal){const edit=el('button','btn ghost',saved?'Open my saved working draft':'Create my working draft');edit.type='button';edit.onclick=()=>{if(!canEdit())return onLocked();if(!state.essayDrafts[e.id]){state.essayDrafts[e.id]={text:version.text,updatedAt:new Date().toISOString(),baseVersion:version.id};onChange();}selected[e.id]='working';render();};tools.append(edit);}
card.append(tools);
  if(!canEdit()){const start=el('button','btn ghost','Open your review to edit');start.type='button';start.onclick=onLocked;card.append(start);}
  const original=el('details','essay-original');original.append(el('summary',null,e.originalLabel||'Last year’s original response'),el('div','essay-prose',e.original));card.append(original);
  if(!personal&&(state.threads[e.id]||[]).length){const legacy=el('details','essay-original');legacy.append(el('summary',null,'Earlier general feedback / working-draft comments'),createCommentThread({id:e.id,title:e.title,state,canEdit,onChange,onLocked,limit:e.limit,essay:true}));card.append(legacy);}
  card.append(el('p','meta','Comments on: '+versionLabel));
  card.append(createCommentThread({id:versionThreadId(e,chosen),title:e.title+' · '+versionLabel,state,canEdit,onChange,onLocked,limit:e.limit,label:'this response',essay:true}));
 }
 return {load(value){data=value;render();},render,error(message){host.textContent='';const w=el('div','wrap');w.append(el('p','flag','Essays could not load: '+message));host.append(w);}};
}
