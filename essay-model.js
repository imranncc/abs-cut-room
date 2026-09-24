export function wordCount(text){return text.trim()?text.trim().split(/\s+/u).length:0;}
export function limitLabel(limit){return [limit.characters&&`${limit.characters.toLocaleString()} characters`,limit.words&&`${limit.approximateWords?'approximately ':''}${limit.words} words`].filter(Boolean).join(' · ');}
export function measureText(text,limit){
 const words=wordCount(text),characters=text.length;
 const charactersOver=Boolean(limit.characters&&characters>limit.characters),wordsOver=Boolean(limit.words&&words>limit.words);
 const part=(count,max,unit,approximate=false)=>`${count.toLocaleString()} / ${approximate?'~':''}${max.toLocaleString()} ${unit}${count>max?' · '+(count-max)+(approximate?' above guidance':' over'):''}`;
 const label=[limit.characters&&part(characters,limit.characters,'characters'),limit.words&&part(words,limit.words,'words',limit.approximateWords)].filter(Boolean).join(' · ');
 return {words,characters,over:charactersOver||(!limit.approximateWords&&wordsOver),guidanceOver:Boolean(limit.approximateWords&&wordsOver),label};
}
export function draftText(essay,state){return typeof state.essayDrafts?.[essay.id]?.text==='string'?state.essayDrafts[essay.id].text:essay.draft;}
export function unresolvedMarkers(text){return /ABS #__|\[[^\]]*(?:confirm|date|term|year)[^\]]*\]/i.test(text);}

export function versionThreadId(essay,version){return version==='working'?essay.id:essay.id+'--'+version;}
