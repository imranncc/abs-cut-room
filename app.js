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

  var SECTIONS=[], DEADLINE=null, CAP=32, OTT_MAX=3, TITLE_LIMIT=48, TOTAL=0;
  var statusEl=$("#status"), tallyEl=$("#tally");
  var state={name:"",view:"gen",orderGen:{},orderOtt:{},verdicts:{},threads:{},notebook:""};
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

    ready = true;
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

      var card=el("div","entry");
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
      card.appendChild(rc);

      var b=el("div","body");
      var isAward=sec.id==="Awards and Accomplishments" || sec.name==="Awards and Accomplishments";
      if(isAward)b.appendChild(el("p","eyebrow","Description (award name)"));
      var tr=el("div","title-row");
      tr.appendChild(el("h3",null,e.t));
      if(e.ref) tr.appendChild(el("span","ref",e.ref));
      if(state.verdicts[e.id]==="cut") tr.appendChild(el("span","chip outc","Left out"));
      else if(e.nodesc) tr.appendChild(el("span","chip","No description yet"));
      b.appendChild(tr);
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

      function bubble(m){
        var bu=el("div","bub",m.text);
        var w=el("span","when");
        var n=(m.text||"").length;
        var messageLimit=m.field==="description"?TITLE_LIMIT:LIM;
        var fieldLabel=m.field?({description:"Description",qualifications:"Qualifications",competition:"Competition involved"}[m.field]+" · "):"";
        w.textContent = fieldLabel + when(m.at) + (n<=messageLimit ? " · " + n : " · " + n + " (" + (n-messageLimit) + " over)");
        bu.appendChild(w);
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
        var m={text:v,at:new Date().toISOString()};
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
  function paintAll(){ if(ready) SECTIONS.forEach(paint); }

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


  var timer=null, saving=false, dirty=false, generation=0;
  function snapshot(){return thaw({name:state.name,updatedAt:new Date().toISOString(),view:state.view,orderGen:state.orderGen,orderOtt:state.orderOtt,verdicts:state.verdicts,threads:state.threads,notebook:state.notebook});}
  function queue(){
    if(!started){setStatus("Enter your name above to start your review.","warn");return;}
    dirty=true;generation++;
    try{window.ABS.draft(snapshot());}catch{setStatus("Browser storage is unavailable. Download your review before leaving.","warn");}
    setStatus(window.ABS.cloud()?"Unsaved changes…":"Saving on this device…");
    clearTimeout(timer);timer=setTimeout(save,700);
  }
  async function save(){
    if(!started||saving||!dirty)return;
    saving=true;const savingGeneration=generation;
    try{
      const result=await window.ABS.save(snapshot());
      saving=false;
      if(generation!==savingGeneration){window.ABS.draft(snapshot());return save();}
      dirty=false;
      setStatus(result.local?"Saved on this device. Download your review to send it to Imran.":"Saved online "+new Date().toLocaleTimeString([],{hour:"numeric",minute:"2-digit"}),result.local?"":"ok");
    }catch(error){saving=false;setStatus(error.message||"Could not save. Download a backup or retry.","warn");}
  }
  $("#save-now").addEventListener("click",function(){dirty=true;save();});
  window.addEventListener("beforeunload",function(ev){if(started&&dirty){ev.preventDefault();ev.returnValue="";}});
  var nameInput=$("#rev-name"), startBtn=$("#rev-start");
  try{var cn=localStorage.getItem("absName");if(cn)nameInput.value=cn;}catch{}
  async function begin(){
    if(!ready){setStatus("Open the invitation link and wait for the sketch to load.","warn");return;}
    const n=nameInput.value.trim();if(!n){nameInput.focus();setStatus("Enter a name for your feedback.","warn");return;}
    if(n.length>100){setStatus("Please use a shorter name.","warn");return;}
    if(started){setStatus("Your review is already open. Use Download review to keep a copy.");return;}
    startBtn.disabled=true;setStatus("Opening your review…");
    try{
      const d=await window.ABS.open();
      state.name=d?.name||n;nameInput.value=state.name;
      try{localStorage.setItem("absName",state.name);}catch{}
      if(d){state.verdicts=thaw(d.verdicts)||{};state.threads=thaw(d.threads)||{};state.notebook=d.notebook||"";nb.value=state.notebook;
        SECTIONS.forEach(s=>{const valid=s.entries.map(e=>e.id);["orderGen","orderOtt"].forEach(k=>{const saved=d[k]?.[s.id];if(!Array.isArray(saved))return;const order=[...new Set(saved.filter(x=>valid.includes(x)))];valid.forEach(x=>{if(!order.includes(x))order.push(x);});state[k][s.id]=order;});});
        state.view=d.view==='ott'?'ott':'gen';
      }
      started=true;startBtn.disabled=false;$("#viewbox").hidden=false;$("#review-tools").hidden=false;tally();setView(state.view);
      $("#storage-note").textContent=window.ABS.cloud()?"Your feedback saves online. Keep your private review link to return on another device; anyone with that link can edit this review.":"Online storage is not connected yet. Your draft saves only in this browser. Download your review and send that file to Imran.";
      $("#copy-review").hidden=!window.ABS.cloud();queue();
    }catch(error){startBtn.disabled=false;setStatus(error.message,"warn");$("#review-tools").hidden=false;}
  }
  $("#download-review").addEventListener("click",()=>{try{window.ABS.download(started?snapshot():undefined);}catch(e){setStatus(e.message,"warn");}});
  $("#copy-review").addEventListener("click",async()=>{try{await navigator.clipboard.writeText(window.ABS.link());setStatus("Private review link copied. Keep it to resume your review.","ok");}catch{setStatus("Could not copy. Your review remains saved online.","warn");}});
  startBtn.addEventListener("click",begin);
  nameInput.addEventListener("keydown",function(ev){ if(ev.key==="Enter"){ ev.preventDefault(); begin(); } });
})();
