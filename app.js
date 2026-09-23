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

  var sectionModel=null;
  var SECTIONS=[], DEADLINE=null, CAP=32, OTT_MAX=3, TITLE_LIMIT=48, TOTAL=0;
  var statusEl=$("#status"), tallyEl=$("#tally");
  var state={name:"",view:"gen",orderGen:{},orderOtt:{},sectionMoves:{},verdicts:{},threads:{},notebook:""};
  var started=false, ready=false;
  var host=$("#sections"), lists={}, caps={};

  function setStatus(m,k){ statusEl.textContent=m; statusEl.className="status"+(k?" "+k:""); }

  window.ABS.loadSketch()
    .then(build)
    .catch(function(error){
      $("#boot").textContent=error.message;
      setStatus("Could not load the sketch.","warn");
    });

  function build(data){
    SECTIONS = data.sections || [];
    sectionModel=createSectionModel(SECTIONS);
    var m = data.meta || {};
    DEADLINE = new Date(m.deadline || "2026-10-01T16:30:00-04:00");
    CAP = m.cap || 32; OTT_MAX = m.ottMax || 3; TITLE_LIMIT = m.titleLimit || 48;

    SECTIONS.forEach(function(s){ TOTAL += s.entries.length; });
    $("#f-total").textContent = TOTAL;
    $("#f-cap").textContent = CAP;
    $("#f-days").textContent = Math.max(0, Math.ceil((DEADLINE - new Date())/86400000));
    $("#lede").textContent = TOTAL > CAP
      ? TOTAL + " activities, " + CAP + " slots. Reorder them, mark the ones you would drop, and say what you think under any entry."
      : "The approved " + TOTAL + ". Reorder them, say what you think under any entry, and tell me where the wording is weak.";
    if(TOTAL > CAP) $("#fact-cap").classList.add("alarm");

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
      if(sec.blurb) head.appendChild(el("p","lede narrow",sec.blurb));
      if(sec.note) head.appendChild(el("p","flag",sec.note));
      w.appendChild(head);
      var list = el("div","entries"); lists[sec.id] = list; w.appendChild(list);
      s.appendChild(w); host.appendChild(s);
    });
    $("#notebook").hidden = false;

    ready = true;startBtn.disabled=false;
    $("#storage-note").textContent=window.ABS.cloud()?"Enter your name to start or return to your review. Feedback saves automatically.":"Your draft saves on this device. Online storage is not connected.";
    tally(); paintAll();

  }

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
      if(e.ctx) b.appendChild(el("p","ctx",e.ctx));
      if(e.ask) b.appendChild(el("p","ask",e.ask));
      if(e.flag) b.appendChild(el("p","flag",e.flag));

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

      var msgs=state.threads[e.id]||[];
      var det=el("details","talk");
      var sum=el("summary", null, msgs.length ? (msgs.length===1?"1 comment":msgs.length+" comments") : "Comment");
      det.appendChild(sum);
      var th=el("div","thread");

      function updateCount(){var n=(state.threads[e.id]||[]).length;sum.textContent=n?(n===1?'1 comment':n+' comments'):'Comment';}
      function bubble(m){
        var bu=el("div","bub",m.text);
        var w=el("span","when");
        var n=(m.text||"").length;
        var messageLimit=m.field==="description"?TITLE_LIMIT:LIM;
        var fieldLabel=m.field?({description:"Description",qualifications:"Qualifications",competition:"Competition involved"}[m.field]+" · "):"";
        w.textContent = fieldLabel + when(m.at) + (n<=messageLimit ? " · " + n : " · " + n + " (" + (n-messageLimit) + " over)");
        if(m.editedAt)w.textContent+=' · edited';
        bu.appendChild(w);
        var actions=el('div','message-actions');
        var edit=el('button','btn ghost','Edit'),unsend=el('button','btn ghost','Unsend');
        edit.type=unsend.type='button';
        edit.addEventListener('click',function(){
          if(!started)return;
          var editor=el('div','message-editor'),input=el('textarea');input.value=m.text;input.rows=3;
          input.setAttribute('aria-label','Edit comment on '+e.t);
          var saveEdit=el('button','btn','Save edit'),cancel=el('button','btn ghost','Cancel');
          saveEdit.type=cancel.type='button';
          saveEdit.addEventListener('click',function(){if(!input.value.trim())return;m.text=input.value.trim();m.editedAt=new Date().toISOString();editor.replaceWith(bubble(m));queue();});
          cancel.addEventListener('click',function(){editor.replaceWith(bubble(m));});
          editor.append(input,saveEdit,cancel);bu.replaceWith(editor);input.focus();
        });
        unsend.addEventListener('click',function(){
          if(!started)return;
          var messages=state.threads[e.id]||[],index=messages.indexOf(m);if(index<0)return;
          messages.splice(index,1);
          var notice=el('div','unsent','Comment unsent. '),undo=el('button','btn ghost','Undo');undo.type='button';
          undo.addEventListener('click',function(){messages.splice(Math.min(index,messages.length),0,m);notice.replaceWith(bubble(m));updateCount();queue();});
          notice.appendChild(undo);bu.replaceWith(notice);updateCount();queue();
        });
        actions.append(edit,unsend);bu.appendChild(actions);
        return bu;
      }
      msgs.forEach(function(m){ th.appendChild(bubble(m)); });

      var cw=el("div","cwrap");
      var fieldChoice=null, activeLimit=LIM, activeLabel=LIMLABEL;
      if(isAward){
        var fieldLabel=el("label",null,"Feedback field");
        fieldChoice=el("select");fieldChoice.setAttribute("aria-label","Feedback field for "+e.ref);
        [["qualifications","Qualifications"],["description","Description (award name)"],["competition","Competition involved"]].forEach(function(pair){var o=el("option",null,pair[1]);o.value=pair[0];fieldChoice.appendChild(o);});
        fieldChoice.addEventListener("change",function(){activeLimit=fieldChoice.value==="description"?TITLE_LIMIT:LIM;activeLabel=fieldChoice.options[fieldChoice.selectedIndex].text;counter();});
        fieldLabel.appendChild(fieldChoice);cw.appendChild(fieldLabel);
      }
      var comp=el("div","composer");
      var ta=el("textarea"); ta.rows=1; ta.placeholder="What do you think?";
      ta.setAttribute("aria-label","Comment on "+e.t);
      var send=el("button","send","↑"); send.type="button"; send.disabled=true;
      send.setAttribute("aria-label","Send comment");

      var cc=el("div","cc"); cc.setAttribute("aria-live","polite");
      function counter(){
        var n=ta.value.length;
        cc.className="cc" + (n>activeLimit ? " over" : (n>activeLimit-20 && n>0 ? " near" : ""));
        cc.textContent = n===0
          ? activeLimit + " characters for " + activeLabel
          : (n>activeLimit ? n + " / " + activeLimit + " · " + (n-activeLimit) + " over" : n + " / " + activeLimit);
      }
      counter();

      ta.addEventListener("input",function(){ send.disabled=!ta.value.trim(); counter(); });
      function post(){
        var v=ta.value.trim(); if(!v) return;
        if(!started){ setStatus("Enter your name first so I know who wrote this.","warn"); return; }
        var m={id:crypto.randomUUID(),text:v,at:new Date().toISOString()};
        if(fieldChoice)m.field=fieldChoice.value;
        (state.threads[e.id]||(state.threads[e.id]=[])).push(m);
        th.insertBefore(bubble(m), cw);
        ta.value=""; send.disabled=true; counter();
        var n=state.threads[e.id].length;
        sum.textContent = n===1 ? "1 comment" : n+" comments";
        queue();
      }
      send.addEventListener("click",post);
      ta.addEventListener("keydown",function(ev){
        if(ev.key==="Enter" && (ev.metaKey||ev.ctrlKey)){ ev.preventDefault(); post(); } });
      comp.appendChild(ta); comp.appendChild(send);
      cw.appendChild(comp); cw.appendChild(cc);
      th.appendChild(cw);
      det.appendChild(th); b.appendChild(det);

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
    noteEl.textContent = v==="gen"
      ? "TMU and NOSM read the whole sketch, so this order is about which entries lead. Comments are shared between both views."
      : "uOttawa selects the top three in each category, though it can still review the wider sketch. This ranking is kept separately from the general one; the entries and comments are the same.";
    paintAll();
  }
  $("#v-gen").addEventListener("click",function(){ setView("gen"); queue(); });
  $("#v-ott").addEventListener("click",function(){ setView("ott"); queue(); });

  var nb=$("#nb");
  nb.addEventListener("input",function(){ state.notebook=nb.value; queue(); });


  var timer=null, saving=false, dirty=false, generation=0, retryDelay=1500, saveBlocked=false;
  function snapshot(){return thaw({name:state.name,updatedAt:new Date().toISOString(),view:state.view,orderGen:state.orderGen,orderOtt:state.orderOtt,verdicts:state.verdicts,threads:state.threads,sectionMoves:state.sectionMoves,notebook:state.notebook});}
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
      setStatus(result.local?"Saved on this device only. Online saving is unavailable.":"Saved",result.local?"warn":"ok");
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

  async function begin(){
    if(!ready){setStatus("Open the invitation link and wait for the sketch to load.","warn");return;}
    const n=nameInput.value.trim();if(!n){nameInput.focus();setStatus("Enter your name to open your review.","warn");return;}
    if(n.length>100){setStatus("Please use a shorter name.","warn");return;}
    if(started){setStatus("Your review is open. Changes save automatically.");return;}
    startBtn.disabled=true;setStatus("Opening your review…");
    try{
      const d=await window.ABS.open(n);
      if(!d?.name&&!n){startBtn.disabled=false;nameInput.focus();setStatus("Enter a name for your feedback.","warn");return;}
      state.name=d?.name||n;nameInput.value=state.name;nameInput.readOnly=true;startBtn.textContent="Signed in";

      if(d){state.verdicts=thaw(d.verdicts)||{};state.threads=thaw(d.threads)||{};state.notebook=d.notebook||"";nb.value=state.notebook;
        state.sectionMoves=thaw(d.sectionMoves)||{};state.orderGen=thaw(d.orderGen)||{};state.orderOtt=thaw(d.orderOtt)||{};applySections();
        state.view=d.view==='ott'?'ott':'gen';
      }
      started=true;startBtn.disabled=true;$("#viewbox").hidden=false;$("#review-tools").hidden=false;tally();setView(state.view);
      $("#storage-note").textContent=window.ABS.cloud()?"Changes save automatically. Return to this same site and enter the same name to continue.":"Online saving is unavailable. Changes remain on this device until the connection is restored.";
      $("#close-review").hidden=false;queue();
    }catch(error){startBtn.disabled=false;setStatus(error.message,"warn");$("#review-tools").hidden=false;}
  }
  $("#close-review").addEventListener('click',async function(){
    if(saving){setStatus('Wait for your review to finish saving before closing.');return;}
    if(dirty)await save();if(dirty)return;
    try{window.ABS.close();}catch(error){setStatus(error.message,'warn');}
  });
  startBtn.addEventListener("click",begin);
  nameInput.addEventListener("keydown",function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); begin(); } });
})();
