const status=document.querySelector('#status'),host=document.querySelector('#reviews');
const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
function render(review){
 const d=review.data||review,article=document.createElement('article');article.append(node('h2',d.name||'Unnamed reviewer'));
 article.append(node('small',review.updatedAt||review.exportedAt||''));
 for(const k of ['orderGen','orderOtt']){article.append(node('h3',k==='orderGen'?'General ranking':'Ottawa ranking'));article.append(node('pre',JSON.stringify(d[k]||{},null,2)));}
 article.append(node('h3','Verdicts'),node('pre',JSON.stringify(d.verdicts||{},null,2)));
 for(const [id,messages] of Object.entries(d.threads||{})){article.append(node('h3',id));for(const m of messages){if(m.field)article.append(node('small',({description:'Description (award name)',qualifications:'Qualifications',competition:'Competition involved'})[m.field]||m.field));article.append(node('p',m.text));}}
 article.append(node('h3','Notebook'),node('p',d.notebook||'No notebook notes.'));host.append(article);
}
document.querySelector('#files').addEventListener('change',async e=>{for(const f of e.target.files){try{render(JSON.parse(await f.text()));status.textContent='Review file loaded.';}catch{status.textContent='Could not read '+f.name;}}});
document.querySelector('#load').addEventListener('click',async()=>{try{
 const token=new URLSearchParams(location.hash.slice(1)).get('admin');if(!token)throw Error('Use your private owner link.');
 const config=await fetch('config.json',{cache:'no-store'}).then(r=>r.json());if(!config.apiBase)throw Error('Online feedback storage is not connected yet. Review files can be opened above.');
 const response=await fetch(config.apiBase.replace(/\/$/,'')+'/admin/reviews',{headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('Could not load reviews. Check your owner link and try again.');
 const result=await response.json();host.textContent='';result.reviews.forEach(render);status.textContent=result.reviews.length+' reviews loaded.';
}catch(e){status.textContent=e.message;}});
