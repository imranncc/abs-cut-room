export function createSectionModel(source){
 const sections=new Map(source.map(s=>[s.id,s]));
 const entries=new Map(),origins=new Map();
 for(const s of source)for(const e of s.entries){entries.set(e.id,e);origins.set(e.id,s.id);}
 function normalize(state){
  const moves={};
  for(const [id,destination] of Object.entries(state.sectionMoves||{}))if(entries.has(id)&&sections.has(destination)&&origins.get(id)!==destination)moves[id]=destination;
  const result={sectionMoves:moves,sections:source.map(s=>({...s,entries:[...entries.values()].filter(e=>(moves[e.id]||origins.get(e.id))===s.id)})),orderGen:{},orderOtt:{}};
  for(const s of result.sections){const valid=new Set(s.entries.map(e=>e.id));for(const mode of ['orderGen','orderOtt']){const saved=state[mode]?.[s.id];const order=Array.isArray(saved)?[...new Set(saved.filter(id=>valid.has(id)))]:[];for(const id of valid)if(!order.includes(id))order.push(id);result[mode][s.id]=order;}}
  return result;
 }
 return {normalize,originalSection(id){return sections.get(origins.get(id));}};
}
