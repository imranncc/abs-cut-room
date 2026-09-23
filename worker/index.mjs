const MAX_BYTES=250000;
const encoder=new TextEncoder();
export async function hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');}
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
const validToken=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
function validReview(d){
 return d&&typeof d==='object'&&!Array.isArray(d)&&typeof d.name==='string'&&d.name.trim().length>0&&d.name.length<=100&&typeof d.notebook==='string'&&d.notebook.length<=60000&&['orderGen','orderOtt','verdicts','threads'].every(k=>d[k]&&typeof d[k]==='object'&&!Array.isArray(d[k]));
}
export default {async fetch(request,env){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==env.ALLOWED_ORIGIN) return reply({error:'Origin not allowed'},403);
 const cors=origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{};
 const out=(d,s=200)=>reply(d,s,cors);
 if(request.method==='OPTIONS') return new Response(null,{status:204,headers:{...cors,'Access-Control-Allow-Methods':'GET, POST, PUT, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Sketch-Key','Access-Control-Max-Age':'600'}});
 try{
  const url=new URL(request.url), token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
  if(url.pathname==='/health'&&request.method==='GET')return out({ok:true});
  if(url.pathname==='/admin/reviews'&&request.method==='GET'){
   if(!validToken(token)||!env.ADMIN_KEY_HASH||await hash(token)!==env.ADMIN_KEY_HASH)return out({error:'Unauthorized'},401);
   const {results}=await env.DB.prepare('SELECT id, payload, revision, updated_at FROM reviews ORDER BY updated_at DESC').all();
   return out({reviews:results.map(r=>({id:r.id,revision:r.revision,updatedAt:r.updated_at,data:JSON.parse(r.payload)}))});
  }
  const match=url.pathname.match(/^\/reviews\/([0-9a-f-]{36})$/);
  if(!match||!['GET','PUT'].includes(request.method))return out({error:'Not found'},404);
  if(!validToken(token))return out({error:'Unauthorized'},401);
  const id=match[1], tokenHash=await hash(token);
  const existing=await env.DB.prepare('SELECT token_hash, payload, revision FROM reviews WHERE id = ?').bind(id).first();
  if(existing&&existing.token_hash!==tokenHash)return out({error:'Unauthorized'},401);
  if(request.method==='GET'){
   if(!existing)return out({error:'Not found'},404);
   return out({data:JSON.parse(existing.payload),revision:existing.revision});
  }
  const declared=Number(request.headers.get('Content-Length')||0);
  if(declared>MAX_BYTES)return out({error:'Review too large; download a copy'},413);
  const reader=request.body?.getReader(); let size=0,chunks=[];
  if(!reader)return out({error:'Missing body'},400);
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();return out({error:'Review too large; download a copy'},413);}chunks.push(value);}
  const merged=new Uint8Array(size);let offset=0;for(const c of chunks){merged.set(c,offset);offset+=c.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(merged));}catch{return out({error:'Invalid JSON'},400);}
  if(!validReview(body.data)||!Number.isInteger(body.revision)||body.revision<0)return out({error:'Invalid review'},400);
  const payload=JSON.stringify(body.data), now=new Date().toISOString();
  if(!existing){
   const key=request.headers.get('X-Sketch-Key');
   if(!validToken(key)||!env.SKETCH_KEY_HASH||await hash(key)!==env.SKETCH_KEY_HASH)return out({error:'Invitation required'},403);
   if(body.revision!==0)return out({error:'Review conflict; reload before saving'},409);
   const result=await env.DB.prepare('INSERT OR IGNORE INTO reviews (id, token_hash, payload, revision, updated_at) VALUES (?, ?, ?, 1, ?)').bind(id,tokenHash,payload,now).run();
   if(result.meta.changes!==1)return out({error:'Review conflict; reload before saving'},409);
   return out({revision:1});
  }
  const result=await env.DB.prepare('UPDATE reviews SET payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND revision = ? AND token_hash = ?').bind(payload,now,id,body.revision,tokenHash).run();
  if(result.meta.changes!==1)return out({error:'Another tab saved newer changes. Download your review before reloading.'},409);
  return out({revision:body.revision+1});
 }catch{return out({error:'Storage unavailable. Your draft is still on this device; retry saving.'},503);}
}};
