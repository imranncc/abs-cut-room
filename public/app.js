import {createCommentThread} from './comments.js?v=single-response-20260924';
import {createEssayWorkspace} from './essays.js?v=single-response-20260924';
import {createSectionModel} from './review-model.js?v=2101a972a2eb';
(function(){
  "use strict";

  function $(s,r){ return (r||document).querySelector(s); }
  function el(t,c,x){ var n=document.createElement(t); if(c)n.className=c; if(x!=null)n.textContent=x; return n; }
  function thaw(v){ try{ return v ? JSON.parse(JSON.stringify(v)) : v; }catch(e){ return v; } }
  function slug(s){ return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,60); }
  function when(iso){
    try{ var d=new Date(iso), n=new Date();
      return d.toDateString()===n.toDateString()
        ? d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"})
        : d.toLocaleDateString([],{month:"short",day:"numeric"})+" "+d.toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});
    }catch(e){ return ""; }
  }

  var sectionModel=null, essayWorkspace=null;
  var SECTIONS=[], DEADLINE=null, CAP=32, OTT_MAX=3, TITLE_LIMIT=48, TOTAL=0;
  var statusEl=$("#status"), tallyEl=$("#tally");
  var state={name:"",view:"gen",orderGen:{},orderOtt:{},sectionMoves:{},verdicts:{},threads:{},essayDrafts:{},notebook:""};
  var started=false, ready=false;
  var host=$("#sections"), lists={}, caps={};

  function setStatus(m,k){ statusEl.textContent=m; statusEl.className="status"+(k?" "+k:""); }

  let loading=null,loadFailure=null;
  function showLoadError(error){
    loadFailure=error;$("#access-recovery").hidden=false;
    $("#access-message").textContent=error.message;
    $("#invitation-fields").hidden=!['invitation','invalid-invitation'].includes(error.code);
    $("#storage-note").textContent='';
    if($("#boot"))$("#boot").textContent='';
    $("#essays").textContent='';
    setStatus('Review not open.','warn');
  }
  async function loadApplication(invitation){
    if(loading)return loading;
    loading=(async()=>{
      loadFailure=null;$("#access-recovery").hidden=true;$("#storage-note").textContent='Loading…';
      try{
        const data=invitation?await window.ABS.unlock(invitation):await window.ABS.loadSketch();
        build(data);setStatus('Enter your name to open your review.');
        return true;
      }catch(error){showLoadError(error);return false;}
      finally{loading=null;}
    })();
    return loading;
  }

  function build(data){
    SECTIONS = data.sections || [];
    sectionModel=createSectionModel(SECTIONS);
    var m = data.meta || {};
    DEADLINE = new Date(m.deadline || "2026-10-01T16:30:00-04:00");
    CAP = m.cap || 32; OTT_MAX = m.ottMax || 3; TITLE_LIMIT = m.titleLimit || 48;

    TOTAL=SECTIONS.reduce((total,section)=>total+section.entries.length,0);

    SECTIONS.forEach(function(s){
      var ids = s.entries.map(function(e){ return e.id; });
      state.orderGen[s.id] = ids.slice();
      state.orderOtt[s.id] = ids.slice();
    });

    host.textContent = "";
    SECTIONS.forEach(function(sec){
      var s = el("section"); s.id = "sec-" + sec.id.replace(/\W/g,"");
      var w = el("div","wrap"), head = el("div","sechead"), row = el("div","row");
      row.appendChild(el("h2",null,sec.name));
      var cap = el("span","cap"); caps[sec.id] = cap; row.appendChild(cap);
      head.appendChild(row);
      w.appendChild(head);
      var list = el("div","entries"); lists[sec.id] = list; w.appendChild(list);
      s.appendChild(w); host.appendChild(s);
    });
    $("#notebook").hidden = false;

    ready = true;startBtn.disabled=false;
    essayWorkspace=createEssayWorkspace({host:$("#essays"),state,canEdit:()=>started,onChange:queue,onLocked:locked});
    window.ABS.loadEssays().then(data=>essayWorkspace.load(data)).catch(error=>essayWorkspace.error(error.message));
    $("#storage-note").textContent=window.ABS.cloud()?"Feedback saves automatically.":"Local preview.";
    tally(); paintAll();

  }

  function locked(){nameInput.focus();setStatus("Enter your name to open your review.","warn");}

  function cutCount(secId){
    var n=0, s=SECTIONS.filter(function(x){return x.id===secId;})[0];
    (s?s.entries:[]).forEach(function(e){ if(state.verdicts[e.id]==="cut") n++; });
    return n;
  }
  function tally(){
    var out=0; for(var k in state.verdicts){ if(state.verdicts[k]==="cut") out++; }
    var left=TOTAL-out, need=Math.max(0,TOTAL-CAP);
    var cls = out>=need ? " class=\"good\"" : "";
    tallyEl.innerHTML = need
      ? "<b"+cls+">"+left+"</b> would go in · "+CAP+" slots · "+need+" must come out"
      : "<b"+cls+">"+left+"</b> would go in · "+CAP+" slots";
  }
  function curOrder(id){ return state.view==="gen"?state.orderGen[id]:state.orderOtt[id]; }

  function refreshCap(sec){
    var ott=state.view==="ott", n=cutCount(sec.id);
    caps[sec.id].textContent = ott
      ? "top "+OTT_MAX+" per category"
      : (n ? n+" marked out of "+sec.entries.length : sec.entries.length+(sec.entries.length===1?" entry":" entries"));
    caps[sec.id].className = "cap"+(!ott && n ? " act" : "");
  }

  function paint(sec){
    var list=lists[sec.id]; list.textContent="";
    var order=curOrder(sec.id), ott=state.view==="ott";
    var LIM = sec.lim || 150, LIMLABEL = sec.limLabel || "description";
    refreshCap(sec);

    order.forEach(function(eid, idx){
      if(ott && idx===OTT_MAX){
        var dv=el("div","divider");
        dv.appendChild(el("span",null,"Top three per category ends here")); dv.appendChild(el("i"));
        list.appendChild(dv);
      }
      var e=null;
      for(var i=0;i<sec.entries.length;i++){ if(sec.entries[i].id===eid){ e=sec.entries[i]; break; } }
      if(!e) return;

      var card=el("div","entry");card.dataset.entryId=e.id;
      var originalSection=sectionModel.originalSection(e.id);
      var LIM=originalSection.lim||150,LIMLABEL=originalSection.limLabel||"description";
      if(state.verdicts[e.id]==="cut") card.classList.add("out");

      var rc=el("div","rankcol");
      var up=el("button","arrow","▲"); up.type="button"; up.disabled=idx===0;
      up.setAttribute("aria-label","Move "+e.t+" up");
      up.addEventListener("click",function(){ move(sec,idx,-1); });
      var no=el("div","rankno",String(idx+1));
      var dn=el("button","arrow","▼"); dn.type="button"; dn.disabled=idx===order.length-1;
      dn.setAttribute("aria-label","Move "+e.t+" down");
      dn.addEventListener("click",function(){ move(sec,idx,1); });
      rc.appendChild(up); rc.appendChild(no); rc.appendChild(dn);
      var moveLabel=el('label','section-label','Section');
      var picker=el('select','section-select');picker.setAttribute('aria-label','Section for '+e.ref+' '+e.t);picker.title=sec.name;
      SECTIONS.forEach(function(s){var option=el('option',null,s.name);option.value=s.id;picker.appendChild(option);});
      picker.value=sec.id;picker.disabled=!started;
      picker.addEventListener('change',function(){changeSection(e.id,picker.value);});
      moveLabel.appendChild(picker);rc.appendChild(moveLabel);
      if(!started){
        var unlock=el('button','btn ghost section-unlock','Open review to move');unlock.type='button';
        unlock.addEventListener('click',function(){nameInput.scrollIntoView({block:'center',behavior:'smooth'});nameInput.focus();setStatus('Enter your name and click Open my review to enable section changes.');});
        rc.appendChild(unlock);
      }
      card.appendChild(rc);

      var b=el("div","body");
      var isAward=originalSection.name==="Awards and Accomplishments";
      if(isAward)b.appendChild(el("p","eyebrow","Description (award name)"));
      var tr=el("div","title-row");
      tr.appendChild(el("h3",null,e.t));
      if(e.ref) tr.appendChild(el("span","ref",e.ref));
      if(state.verdicts[e.id]==="cut") tr.appendChild(el("span","chip outc","Left out"));
      else if(e.nodesc) tr.appendChild(el("span","chip","No description yet"));
      b.appendChild(tr);
      if(originalSection.id!==sec.id)b.appendChild(el("p","meta","Your suggestion: move from "+originalSection.name+" to "+sec.name));
      if(e.meta) b.appendChild(el("p","meta",e.meta));
      if(e.project) b.appendChild(el("p","project",e.project));
      if(isAward)b.appendChild(el("p","eyebrow","Qualifications"));
      if(e.d) b.appendChild(el("p","desc",e.d));
      if(isAward)b.appendChild(el("p","eyebrow","Competition involved"));
      if(e.extra) b.appendChild(el("p","meta",e.extra));
      if(e.hrs) b.appendChild(el("p","hrs",e.hrs));

      var vs=el("div","verdicts");
      [["strong","Strongest"],["keep","Keep"],["unsure","Not sure"],["cut","Leave it out"]].forEach(function(p){
        var btn=el("button","verdict",p[1]); btn.type="button"; btn.dataset.v=p[0];
        btn.setAttribute("aria-pressed", state.verdicts[e.id]===p[0]?"true":"false");
        btn.addEventListener("click",function(){
          if(!started){nameInput.focus();setStatus("Enter your name before reviewing.","warn");return;}
          state.verdicts[e.id]=(state.verdicts[e.id]===p[0])?null:p[0];
          paint(sec); tally(); queue();
        });
        vs.appendChild(btn);
      });
      b.appendChild(vs);

      b.appendChild(createCommentThread({id:e.id,title:e.t,state,canEdit:()=>started,onChange:queue,onLocked:locked,limit:{characters:LIM},label:LIMLABEL,award:isAward,titleLimit:TITLE_LIMIT}));

      card.appendChild(b); list.appendChild(card);
    });
  }
  function applySections(){
    var resolved=sectionModel.normalize(state);SECTIONS=resolved.sections;
    state.sectionMoves=resolved.sectionMoves;state.orderGen=resolved.orderGen;state.orderOtt=resolved.orderOtt;
  }
  function changeSection(eid,destination){
    if(!started){nameInput.focus();setStatus('Open your review before moving entries.','warn');return;}
    state.sectionMoves[eid]=destination;applySections();paintAll();queue();
    var target=host.querySelector('[data-entry-id="'+eid+'"]');
    if(target){target.scrollIntoView({block:'center',behavior:'auto'});target.querySelector('.section-select').focus();}
  }
  function paintAll(){ if(ready){SECTIONS.forEach(paint);host.querySelectorAll(".sechead > .lede").forEach(function(n){n.hidden=Object.keys(state.sectionMoves).length>0;});} }

  function move(sec, idx, dir){
    if(!started){nameInput.focus();setStatus("Enter your name before ranking.","warn");return;}
    var a=curOrder(sec.id), j=idx+dir;
    if(j<0||j>=a.length) return;
    var t=a[idx]; a[idx]=a[j]; a[j]=t;
    paint(sec); queue();
  }

  var noteEl=$("#viewnote");
  function setView(v){
    state.view=v;
    $("#v-gen").setAttribute("aria-pressed", v==="gen"?"true":"false");
    $("#v-ott").setAttribute("aria-pressed", v==="ott"?"true":"false");
    noteEl.textContent='';
    paintAll();
  }
  $("#v-gen").addEventListener("click",function(){ setView("gen"); queue(); });
  $("#v-ott").addEventListener("click",function(){ setView("ott"); queue(); });

  function setWorkspace(which){
    const essays=which==='essays';document.body.classList.toggle('essay-mode',essays);$("#sections").hidden=essays;$("#essays").hidden=!essays;$("#viewbox").hidden=essays||!started;
    $("#workspace-abs").setAttribute('aria-pressed',String(!essays));$("#workspace-essays").setAttribute('aria-pressed',String(essays));
  }
  $("#workspace-abs").onclick=()=>setWorkspace('abs');$("#workspace-essays").onclick=()=>setWorkspace('essays');
  var nb=$("#nb");
  nb.addEventListener("input",function(){ state.notebook=nb.value; queue(); });


  var timer=null, saving=false, dirty=false, generation=0, retryDelay=1500, saveBlocked=false;
  function snapshot(){return thaw({name:state.name,updatedAt:new Date().toISOString(),view:state.view,orderGen:state.orderGen,orderOtt:state.orderOtt,verdicts:state.verdicts,threads:state.threads,sectionMoves:state.sectionMoves,essayDrafts:state.essayDrafts,notebook:state.notebook});}
  function queue(){
    if(!started){setStatus("Enter your name above to start your review.","warn");return;}
    dirty=true;generation++;
    try{window.ABS.draft(snapshot());}catch{}
    if(saveBlocked)return;
    setStatus("Saving…");
    clearTimeout(timer);timer=setTimeout(save,700);
  }
  async function save(){
    if(!started||saving||!dirty||saveBlocked)return;
    clearTimeout(timer);saving=true;const savingGeneration=generation;
    try{
      const result=await window.ABS.save(snapshot());
      saving=false;retryDelay=1500;
      if(generation!==savingGeneration){try{window.ABS.draft(snapshot());}catch{}return save();}
      dirty=false;
      setStatus(result.local?"Saved on this device · local preview":"Saved","ok");
    }catch(error){
      saving=false;
      // Never retry authorization failures or overwrite a conflicting revision.
      saveBlocked=!!error.status&&error.status<500&&![408,429].includes(error.status);
      if(saveBlocked){setStatus(error.status===409?"Another saved version exists. Keep this page open and contact Imran to recover your changes.":"Changes could not be saved. Keep this page open and contact Imran.","warn");return;}
      setStatus("Not saved online yet. Retrying automatically…","warn");
      clearTimeout(timer);timer=setTimeout(save,retryDelay);retryDelay=Math.min(retryDelay*2,30000);
    }
  }
  window.addEventListener("online",function(){if(dirty&&!saveBlocked){clearTimeout(timer);save();}});
  window.addEventListener("beforeunload",function(ev){if(started&&dirty){ev.preventDefault();ev.returnValue="";}});
  var nameInput=$("#rev-name"), startBtn=$("#rev-start");
  nameInput.value=new URLSearchParams(location.hash.slice(1)).get("name")||"";

  async function begin(){
    if(!ready){
      if(!await loadApplication()){
        if(!$("#invitation-fields").hidden)$("#invitation-link").focus();
        return;
      }
    }
    const n=nameInput.value.trim();if(!n){nameInput.focus();setStatus("Enter your name to open your review.","warn");return;}
    if(n.length>100){setStatus("Please use a shorter name.","warn");return;}
    if(started){setStatus("Your review is open. Changes save automatically.");return;}
    startBtn.disabled=true;startBtn.textContent="Opening…";setStatus("Opening your review…");$("#storage-note").textContent="Opening your review…";
    try{
      const d=await window.ABS.open(n);
      if(!d?.name&&!n){startBtn.disabled=false;nameInput.focus();setStatus("Enter a name for your feedback.","warn");return;}
      state.name=d?.name||n;nameInput.value=state.name;nameInput.readOnly=true;startBtn.textContent="Signed in";

      if(d){state.essayDrafts=thaw(d.essayDrafts)||{};state.verdicts=thaw(d.verdicts)||{};state.threads=thaw(d.threads)||{};state.notebook=d.notebook||"";nb.value=state.notebook;
        state.sectionMoves=thaw(d.sectionMoves)||{};state.orderGen=thaw(d.orderGen)||{};state.orderOtt=thaw(d.orderOtt)||{};applySections();
        state.view=d.view==='ott'?'ott':'gen';
      }
      started=true;essayWorkspace?.render();startBtn.disabled=true;$("#viewbox").hidden=!$("#essays").hidden;$("#review-tools").hidden=false;tally();setView(state.view);
      $("#storage-note").textContent=window.ABS.cloud()?"Feedback saves automatically.":"Local preview.";
      $("#close-review").hidden=false;queue();
    }catch(error){startBtn.disabled=false;startBtn.textContent="Open my review";setStatus(error.message,"warn");$("#storage-note").textContent=error.message;$("#review-tools").hidden=false;}
  }
  $("#close-review").addEventListener('click',async function(){
    if(saving){setStatus('Wait for your review to finish saving before closing.');return;}
    if(dirty)await save();if(dirty)return;
    try{window.ABS.close();}catch(error){setStatus(error.message,'warn');}
  });
  $("#retry-load").onclick=()=>loadApplication();
  $("#unlock-review").onclick=async()=>{
    const button=$("#unlock-review");button.disabled=true;
    try{if(await loadApplication($("#invitation-link").value.trim())){$("#invitation-link").value='';if(nameInput.value.trim())await begin();}}finally{button.disabled=false;}
  };
  $("#invitation-link").onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();$("#unlock-review").click();}};
  window.addEventListener('hashchange',()=>{if(!ready&&new URLSearchParams(location.hash.slice(1)).has('key'))loadApplication(location.href);});
  loadApplication();
  startBtn.addEventListener("click",begin);
  nameInput.addEventListener("keydown",function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); begin(); } });
})();
