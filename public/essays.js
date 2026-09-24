import {createCommentThread} from './comments.js?v=single-response-20260924';
import {measureText,limitLabel,draftText} from './essay-model.js?v=single-response-20260924';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
export function createEssayWorkspace({host,state,canEdit,onChange,onLocked}){
 let data=null,school='TMU',active=null,editing=null;
 function render(){
  if(!data)return;host.textContent='';const wrap=el('div','wrap essay-workspace');host.append(wrap);
  const nav=el('div','switch');nav.setAttribute('aria-label','Essay school');nav.setAttribute('role','group');
  for(const name of ['TMU','NOSM']){const button=el('button',null,name);button.type='button';button.setAttribute('aria-pressed',String(school===name));button.onclick=()=>{school=name;active=null;editing=null;render();};nav.append(button);}wrap.append(nav);
  const essays=data.essays.filter(e=>e.school===school);if(!essays.length)return;
  active=essays.some(e=>e.id===active)?active:essays[0].id;
  const layout=el('div','essay-layout'),menu=el('nav','essay-menu');menu.setAttribute('aria-label',school+' responses');
  for(const essay of essays){const button=el('button','essay-choice');button.type='button';button.setAttribute('aria-current',String(essay.id===active));button.append(el('span',null,essay.code+' · '+essay.title),el('small',null,limitLabel(essay.limit)));button.onclick=()=>{active=essay.id;editing=null;render();};menu.append(button);}layout.append(menu);
  const e=essays.find(e=>e.id===active),card=el('article','essay-card');card.dataset.essayId=e.id;layout.append(card);wrap.append(layout);
  card.append(el('h3',null,e.code+' · '+e.title),el('p','essay-prompt',e.prompt));
  const personal=editing===e.id&&canEdit(),saved=state.essayDrafts?.[e.id];
  const label=el('label','draft-label',personal?'Your suggested wording':'Response'),editor=el('textarea','essay-editor');editor.id=e.id+'-draft';label.htmlFor=editor.id;editor.rows=13;editor.value=personal?draftText(e,state):e.draft;editor.readOnly=!personal;editor.setAttribute('aria-label',(personal?'Your suggested wording: ':'Response: ')+e.code);card.append(label,editor);
  const counter=el('p','essay-counter');counter.setAttribute('aria-live','polite');
  const count=()=>{const m=measureText(editor.value,e.limit);counter.className='essay-counter'+(m.over||m.guidanceOver?' over':'');counter.textContent=m.fullLabel;};count();card.append(counter);
  editor.addEventListener('input',()=>{if(!personal||!canEdit())return onLocked();state.essayDrafts[e.id]={text:editor.value,updatedAt:new Date().toISOString(),baseVersion:saved?.baseVersion||e.version};count();onChange();});
  const actions=el('div','essay-actions'),copy=el('button','btn ghost','Copy response'),copyStatus=el('span','meta');copy.type='button';copyStatus.setAttribute('role','status');copy.onclick=async()=>{try{await navigator.clipboard.writeText(editor.value);copyStatus.textContent='Copied.';}catch{editor.focus();editor.select();copyStatus.textContent='Select and copy the text.';}};
  const edit=el('button','btn ghost',personal?'Done':'Edit response');edit.type='button';edit.onclick=()=>{if(!canEdit())return onLocked();editing=personal?null:e.id;render();};actions.append(copy,edit,copyStatus);card.append(actions);
  card.append(createCommentThread({id:e.commentThreadId||e.id+'--v7',aliases:[e.id],title:e.code,state,canEdit,onChange,onLocked,limit:e.limit,label:'suggested wording',essay:true}));
 }
 return {load(value){data=value;render();},render,error(message){host.textContent='';const w=el('div','wrap');w.append(el('p','flag','Essays could not load: '+message));host.append(w);}};
}
