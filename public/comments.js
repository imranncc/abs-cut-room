import {measureText, commentMessages} from './essay-model.js?v=single-response-20260924';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
const when=iso=>{try{return new Date(iso).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});}catch{return '';}};
// Shared by ABS entries and essays. Stable IDs keep every thread independent.
export function createCommentThread({id,title,state,canEdit,onChange,onLocked,limit={characters:150},label='description',award=false,titleLimit=48,essay=false,aliases=[]}){
 const det=el('details','talk'),sum=el('summary'),th=el('div','thread');det.append(sum,th);
 const messages=()=>commentMessages(state,id,aliases);
 const count=()=>{const n=messages().length;sum.textContent=n?`${n} comment${n===1?'':'s'}`:'Comment';};count();
 const labels={description:'Description',qualifications:'Qualifications',competition:'Competition involved',comment:'Comment',suggestion:'Suggested wording'};
 function bubble(m,threadId=id){
  const bu=el('div','bub',m.text),w=el('span','when');
  const cap=m.field==='description'?{characters:titleLimit}:limit;
  w.textContent=[m.field?labels[m.field]:'',when(m.at),measureText(m.text,cap).fullLabel,m.editedAt?'edited':''].filter(Boolean).join(' · ');bu.append(w);
  const actions=el('div','message-actions'),edit=el('button','btn ghost','Edit'),unsend=el('button','btn ghost','Unsend');edit.type=unsend.type='button';
  edit.addEventListener('click',()=>{
   if(!canEdit())return onLocked();
   const editor=el('div','message-editor'),input=el('textarea');input.value=m.text;input.rows=4;input.setAttribute('aria-label','Edit comment on '+title);
   const editCount=el('p','meta');const recount=()=>{editCount.textContent=measureText(input.value,cap).fullLabel;};input.oninput=recount;recount();
   const save=el('button','btn','Save edit'),cancel=el('button','btn ghost','Cancel');save.type=cancel.type='button';
   save.onclick=()=>{if(!input.value.trim())return;m.text=input.value.trim();m.editedAt=new Date().toISOString();editor.replaceWith(bubble(m,threadId));onChange();};
   cancel.onclick=()=>editor.replaceWith(bubble(m,threadId));editor.append(input,editCount,save,cancel);bu.replaceWith(editor);input.focus();
  });
  unsend.onclick=()=>{
   if(!canEdit())return onLocked();const messages=state.threads[threadId]||[],index=messages.indexOf(m);if(index<0)return;
   messages.splice(index,1);const notice=el('div','unsent','Comment unsent. '),undo=el('button','btn ghost','Undo');undo.type='button';
   undo.onclick=()=>{messages.splice(Math.min(index,messages.length),0,m);notice.replaceWith(bubble(m,threadId));count();onChange();};
   notice.append(undo);bu.replaceWith(notice);count();onChange();
  };
  actions.append(edit,unsend);bu.append(actions);return bu;
 }
 for(const {key,message} of messages())th.append(bubble(message,key));
 const cw=el('div','cwrap'),comp=el('div','composer'),ta=el('textarea'),send=el('button','send','↑'),cc=el('div','cc');let choice;
 if(award){const fieldLabel=el('label',null,'Feedback field');choice=el('select');choice.setAttribute('aria-label','Feedback field for '+title);
  const options=[['qualifications','Qualifications'],['description','Description (award name)'],['competition','Competition involved']];
  for(const [value,text]of options){const o=el('option',null,text);o.value=value;choice.append(o);}fieldLabel.append(choice);cw.append(fieldLabel);
 }
 ta.rows=essay?3:1;ta.placeholder=essay?'Comment or suggest wording…':'What do you think?';ta.setAttribute('aria-label','Comment on '+title);send.type='button';send.disabled=true;send.setAttribute('aria-label','Send comment');cc.setAttribute('aria-live','polite');
 function counter(){const cap=choice?.value==='description'?{characters:titleLimit}:limit;const m=measureText(ta.value,cap);cc.className='cc'+(m.over?' over':'');cc.textContent=m.fullLabel;}
 if(choice)choice.onchange=counter;counter();ta.oninput=()=>{send.disabled=!ta.value.trim();counter();};
 const post=()=>{const text=ta.value.trim();if(!text)return;if(!canEdit())return onLocked();const m={id:crypto.randomUUID(),text,at:new Date().toISOString()};if(choice)m.field=choice.value;(state.threads[id]||(state.threads[id]=[])).push(m);th.insertBefore(bubble(m),cw);ta.value='';send.disabled=true;counter();count();onChange();};
 send.onclick=post;ta.onkeydown=ev=>{if(ev.key==='Enter'&&(ev.metaKey||ev.ctrlKey)){ev.preventDefault();post();}};
 comp.append(ta,send);cw.append(comp,cc);th.append(cw);return det;
}
