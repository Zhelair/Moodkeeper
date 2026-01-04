// Trackboard v2 — local-first + Share (export/import). One file. Peace restored.
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // ---------- Storage
  const KEY = "trackboard_v2";
  const VERSION = 2;

  const todayISO = () => {
    const d = new Date();
    const tz = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return tz.toISOString().slice(0,10);
  };

  const freshState = () => ({
    version: VERSION,
    createdAt: Date.now(),
    days: {},
    practices: {
      body: [
        { key:"pushups", label:"Push-ups", kind:"count", enabled:true },
        { key:"pullups", label:"Pull-ups", kind:"count", enabled:true },
        { key:"abs", label:"Abs", kind:"count", enabled:true },
      ],
      mind: [
        { key:"read", label:"Reading", kind:"done", enabled:true },
        { key:"walk", label:"Walk", kind:"done", enabled:true },
      ],
      life: [
        { key:"water", label:"Water", kind:"done", enabled:true },
        { key:"veg", label:"Vegetables", kind:"done", enabled:true },
      ]
    },
    goals: {
      weekStartISO: null,
      targets: { alcoholFreeTarget: 4, practicesTarget: 5, calmTarget: 3 },
      review: null
    },
    momentum: { score: 0, lastTouchISO: null }
  });

  const loadState = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return freshState();
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return freshState();
      if (obj.version !== VERSION) {
        const m = freshState();
        if (obj.days) m.days = obj.days;
        if (obj.practices) m.practices = obj.practices;
        if (obj.goals) m.goals = obj.goals;
        return m;
      }
      return obj;
    } catch {
      return freshState();
    }
  };

  const saveState = () => localStorage.setItem(KEY, JSON.stringify(state));

  const getDay = (iso) => {
    if (!state.days[iso]) {
      state.days[iso] = {
        date: iso,
        mood: null,
        alcohol: null,
        practice: {},
        calm: { interrupts:0, waitsStarted:0, waitsCompleted:0, passes:0, still:0 }
      };
    }
    return state.days[iso];
  };

  const touch = (iso) => {
    const m = state.momentum || {score:0,lastTouchISO:null};
    if (m.lastTouchISO !== iso) {
      m.score = Math.min(999, (m.score||0) + 1);
      m.lastTouchISO = iso;
    } else {
      m.score = Math.min(999, (m.score||0) + 0.25);
    }
    state.momentum = m;
  };

  // ---------- Insights (week)
  const parseISO = (iso) => {
    const [y,m,d] = iso.split("-").map(Number);
    return new Date(y, m-1, d);
  };
  const isoFromDate = (d) => {
    const tz = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return tz.toISOString().slice(0,10);
  };
  const mondayOf = (iso) => {
    const d = parseISO(iso);
    const day = (d.getDay()+6)%7; // Monday=0
    d.setDate(d.getDate() - day);
    return isoFromDate(d);
  };
  const weekRange = (anyIso) => {
    const startISO = mondayOf(anyIso);
    const s = parseISO(startISO);
    const end = new Date(s);
    end.setDate(s.getDate()+6);
    return { startISO, endISO: isoFromDate(end) };
  };
  const listDays = (startISO, count) => {
    const out = [];
    const d = parseISO(startISO);
    for (let i=0;i<count;i++){
      out.push(isoFromDate(d));
      d.setDate(d.getDate()+1);
    }
    return out;
  };

  const countPracticeDone = (day) => {
    const p = day.practice || {};
    return Object.values(p).filter(v => (v && v.done) || (v && typeof v.count==="number" && v.count>0)).length;
  };

  const computeWeek = (anyIso) => {
    const {startISO, endISO} = weekRange(anyIso);
    const days = listDays(startISO, 7).map(iso => state.days[iso] || null);

    const moodVals = days.filter(d=>d && typeof d.mood==="number").map(d=>d.mood);
    const avgMood = moodVals.length ? moodVals.reduce((a,b)=>a+b,0)/moodVals.length : null;

    const alcoholLogs = days.filter(d=>d && d.alcohol && typeof d.alcohol.drinks==="number");
    const drinks = alcoholLogs.reduce((s,d)=> s + (d.alcohol.drinks||0), 0);
    const daysWithAlcohol = alcoholLogs.filter(d => (d.alcohol.drinks||0)>0).length;
    const alcoholFreeDays = days.filter(d=>d && d.alcohol && (d.alcohol.drinks||0)===0).length;

    const practiceCount = days.reduce((s,d)=> s + (d ? countPracticeDone(d) : 0), 0);

    const calm = days.reduce((acc,d)=>{
      if(!d) return acc;
      const c = d.calm || {};
      acc.interrupts += c.interrupts||0;
      acc.waitsStarted += c.waitsStarted||0;
      acc.waitsCompleted += c.waitsCompleted||0;
      acc.passes += c.passes||0;
      acc.still += c.still||0;
      return acc;
    }, {interrupts:0, waitsStarted:0, waitsCompleted:0, passes:0, still:0});

    return { startISO, endISO, avgMood, drinks, daysWithAlcohol, alcoholFreeDays, practiceCount, calm };
  };

  const momentumLabel = (tISO) => {
    const last = state.momentum?.lastTouchISO;
    if(!last) return "Momentum: waiting";
    if(last === tISO) return "Momentum: rising";
    const y = new Date(Date.now() - 86400000);
    const yISO = new Date(y.getTime() - y.getTimezoneOffset()*60000).toISOString().slice(0,10);
    if(last === yISO) return "Momentum: holding";
    return "Momentum: dipped (recoverable)";
  };

  // ---------- UI helpers
  const elView = $("#view");
  const elSubtitle = $("#subtitle");
  const elToast = $("#toast");
  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");
  const modalFoot = $("#modalFoot");

  const toast = (msg) => {
    elToast.textContent = msg;
    elToast.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(()=> elToast.classList.remove("show"), 1400);
  };

  const openModal = (title, bodyHTML, footHTML) => {
    modalTitle.textContent = title;
    modalBody.innerHTML = bodyHTML || "";
    modalFoot.innerHTML = footHTML || "";
    modal.showModal();
  };
  const closeModal = () => modal.open && modal.close();

  $("#modalClose").addEventListener("click", closeModal);
  modal.addEventListener("click", (e)=>{
    const rect = modal.querySelector(".modalCard").getBoundingClientRect();
    const inCard = e.clientX>=rect.left && e.clientX<=rect.right && e.clientY>=rect.top && e.clientY<=rect.bottom;
    if(!inCard) closeModal();
  });

  const clamp = (v,min,max) => Math.max(min, Math.min(max,v));

  // ---------- Share (export/import)
  const downloadJSON = (filename, obj) => {
    const text = JSON.stringify(obj, null, 2);
    const blob = new Blob([text], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
  };

  const exportBackup = () => {
    const now = new Date();
    const stamp = now.toISOString().slice(0,10).replace(/-/g,"");
    downloadJSON(`trackboard-backup-${stamp}.json`, {
      exportedAt: now.toISOString(),
      app: "trackboard",
      schemaVersion: 2,
      state
    });
    toast("Backup exported.");
  };

  const mergeStates = (current, incoming) => {
    const out = structuredClone(current);
    out.version = VERSION;
    out.days = out.days || {};
    const inDays = incoming.days || {};
    for (const [iso, day] of Object.entries(inDays)) {
      if (!out.days[iso]) out.days[iso] = day;
      else {
        out.days[iso] = {
          ...out.days[iso],
          ...day,
          practice: { ...(out.days[iso].practice||{}), ...(day.practice||{}) },
          calm: { ...(out.days[iso].calm||{}), ...(day.calm||{}) },
          alcohol: day.alcohol ?? out.days[iso].alcohol,
          mood: (typeof day.mood === "number") ? day.mood : out.days[iso].mood
        };
      }
    }
    if (incoming.practices) out.practices = incoming.practices;
    return out;
  };

  const importBackupFile = async (file) => {
    if(!file) return;
    const text = await file.text();
    let obj;
    try { obj = JSON.parse(text); } catch { return toast("Invalid JSON."); }
    const incoming = obj?.state ? obj.state : obj;
    if(!incoming || typeof incoming !== "object" || !incoming.days) return toast("Not a Trackboard backup.");

    const keys = Object.keys(incoming.days).sort();
    const sum = { dayCount: keys.length, first: keys[0] || "—", last: keys[keys.length-1] || "—" };

    openModal("Import backup", `
      <p class="p">Found <strong>${sum.dayCount}</strong> day(s).</p>
      <div class="list">
        <div class="item"><span>First day</span><strong>${sum.first}</strong></div>
        <div class="item"><span>Last day</span><strong>${sum.last}</strong></div>
      </div>
      <div class="hr"></div>
      <p class="p"><strong>Merge</strong> keeps your data + adds new days. <strong>Replace</strong> wipes local data.</p>
    `, `
      <button class="btn" id="mergeBtn">Merge</button>
      <button class="btn warn" id="replaceBtn">Replace</button>
    `);

    $("#mergeBtn").addEventListener("click", ()=>{
      state = mergeStates(state, incoming);
      saveState();
      toast("Merged.");
      closeModal();
      render("insights");
    }, {once:true});

    $("#replaceBtn").addEventListener("click", ()=>{
      state = mergeStates(freshState(), incoming);
      if(incoming.goals) state.goals = incoming.goals;
      saveState();
      toast("Replaced.");
      closeModal();
      render("insights");
    }, {once:true});
  };

  // ---------- Core screens
  const startWaitTimer = (tISO, sourceTab="alcohol") => {
    const day = getDay(tISO);
    day.calm = day.calm || { interrupts:0, waitsStarted:0, waitsCompleted:0, passes:0, still:0 };
    day.calm.waitsStarted++;
    touch(tISO); saveState();

    let remaining = 10*60;
    openModal("Wait 10 minutes", `
      <p class="p">You don’t need to decide yet. Let time do some work.</p>
      <div class="card" style="margin-top:10px; text-align:center;">
        <div class="h2" style="font-size:22px;" id="timerTxt">10:00</div>
        <p class="p">Waiting is a win.</p>
      </div>
    `, `<button class="btn" id="endEarly">I'm okay</button>`);

    const timerTxt = $("#timerTxt");
    const tick = () => {
      const mm = String(Math.floor(remaining/60)).padStart(2,"0");
      const ss = String(remaining%60).padStart(2,"0");
      timerTxt.textContent = `${mm}:${ss}`;
      if(remaining <= 0) { clearInterval(tick._i); onDone(false); }
      remaining -= 1;
    };
    tick(); tick._i = setInterval(tick, 1000);

    $("#endEarly").addEventListener("click", ()=>{
      clearInterval(tick._i);
      onDone(true);
    }, {once:true});

    const onDone = (early) => {
      day.calm.waitsCompleted++;
      touch(tISO); saveState();

      openModal("What happened?", `
        <p class="p">${early ? "Early exit still counts." : "Timer done. Either outcome is fine."}</p>
      `, `
        <button class="btn good" data-out="pass">Craving passed</button>
        <button class="btn warn" data-out="still">Still want it</button>
      `);

      modalFoot.addEventListener("click", (e)=>{
        const b = e.target.closest("button[data-out]");
        if(!b) return;
        if(b.dataset.out === "pass") day.calm.passes++;
        if(b.dataset.out === "still") day.calm.still++;
        touch(tISO); saveState();
        toast("Logged.");
        closeModal();
        render(sourceTab);
      }, {once:true});
    };
  };

  const render = (tab) => {
    const tISO = todayISO();
    elSubtitle.textContent = momentumLabel(tISO);

    if(tab === "checkin"){
      const day = getDay(tISO);
      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">Mood check-in</div>
            <p class="p">Quick, honest. No drama.</p>
            <div class="field">
              <label>Today (${tISO})</label>
              <select id="moodSel">
                <option value="">— choose —</option>
                <option value="1">1 — rough</option>
                <option value="2">2 — low</option>
                <option value="3">3 — ok</option>
                <option value="4">4 — good</option>
                <option value="5">5 — great</option>
              </select>
            </div>
            <div class="btnrow">
              <button class="btn primary" id="saveMood">Save</button>
            </div>
            <div class="hr"></div>
            <div class="row"><span class="badge">Saved today</span><strong>${typeof day.mood==="number" ? day.mood : "—"}</strong></div>
          </div>
          <div class="card">
            <div class="h2">Today snapshot</div>
            <div class="list">
              <div class="item"><span>Mood</span><strong>${typeof day.mood==="number" ? day.mood : "—"}</strong></div>
              <div class="item"><span>Alcohol</span><strong>${day.alcohol ? (day.alcohol.drinks||0) : "—"}</strong></div>
              <div class="item"><span>Practices</span><strong>${countPracticeDone(day)}</strong></div>
              <div class="item"><span>Calm interrupts</span><strong>${day.calm?.interrupts||0}</strong></div>
            </div>
          </div>
        </div>
      `;
      const moodSel = $("#moodSel");
      if(typeof day.mood==="number") moodSel.value = String(day.mood);
      $("#saveMood").addEventListener("click", ()=>{
        const v = Number(moodSel.value);
        if(!v) return toast("Pick a mood number.");
        day.mood = v;
        touch(tISO); saveState();
        toast("Saved.");
        render("checkin");
      });
      return;
    }

    if(tab === "alcohol"){
      const day = getDay(tISO);
      const current = day.alcohol ? day.alcohol.drinks : null;
      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">Alcohol</div>
            <p class="p">This is tracking, not court.</p>
            <div class="field">
              <label>Today (${tISO})</label>
              <div class="row" style="align-items:flex-end;">
                <div style="flex:1">
                  <label>Type</label>
                  <select id="alcKind">
                    <option value="beer">Beer</option>
                    <option value="wine">Wine</option>
                    <option value="spirits">Spirits</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div style="width:170px">
                  <label>Drinks</label>
                  <div class="stepper">
                    <button id="alcMinus">−</button>
                    <div class="val" id="alcVal">0</div>
                    <button id="alcPlus">+</button>
                  </div>
                </div>
              </div>
            </div>
            <div class="btnrow">
              <button class="btn primary" id="saveAlc">Save today</button>
              <button class="btn warn" id="wait10">Wait 10 minutes</button>
            </div>
            <div class="hr"></div>
            <div class="row"><span class="badge">Saved</span><strong>${current===null ? "—" : current}</strong></div>
          </div>
          <div class="card">
            <div class="h2">This week snapshot</div>
            <div class="list" id="alcWeek"></div>
          </div>
        </div>
      `;

      let drinks = (day.alcohol && typeof day.alcohol.drinks==="number") ? day.alcohol.drinks : 0;
      $("#alcVal").textContent = String(drinks);
      const kindSel = $("#alcKind");
      if(day.alcohol?.kind) kindSel.value = day.alcohol.kind;

      $("#alcMinus").addEventListener("click", ()=>{ drinks = Math.max(0, drinks-1); $("#alcVal").textContent = drinks; });
      $("#alcPlus").addEventListener("click", ()=>{ drinks = Math.min(99, drinks+1); $("#alcVal").textContent = drinks; });

      $("#saveAlc").addEventListener("click", ()=>{
        day.alcohol = { drinks, kind: kindSel.value };
        touch(tISO); saveState();
        toast("Saved.");
        render("alcohol");
      });
      $("#wait10").addEventListener("click", ()=> startWaitTimer(tISO, "alcohol"));

      const w = computeWeek(tISO);
      $("#alcWeek").innerHTML = `
        <div class="item"><span>Drinks logged</span><strong>${w.drinks}</strong></div>
        <div class="item"><span>Days with alcohol</span><strong>${w.daysWithAlcohol}</strong></div>
        <div class="item"><span>Alcohol-free days (explicit)</span><strong>${w.alcoholFreeDays}</strong></div>
        <div class="item"><span>Waits completed</span><strong>${w.calm.waitsCompleted}</strong></div>
      `;
      return;
    }

    if(tab === "practices"){
      const day = getDay(tISO);
      const cfg = state.practices || {body:[], mind:[], life:[]};

      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">Practices</div>
            <p class="p">Tap to log. Manage is config only.</p>
            <div class="btnrow">
              <button class="btn primary" id="tabBody">Body</button>
              <button class="btn" id="tabMind">Mind</button>
              <button class="btn" id="tabLife">Life</button>
            </div>
            <div class="list" id="practiceList"></div>
            <div class="hr"></div>
            <div class="row"><span class="badge">Today total</span><strong>${countPracticeDone(day)}</strong></div>
          </div>
          <div class="card">
            <div class="h2">This week</div>
            <div class="list" id="practiceWeek"></div>
          </div>
        </div>
      `;

      let cat = "body";
      const setCat = (c) => {
        cat = c;
        $("#tabBody").className = c==="body" ? "btn primary":"btn";
        $("#tabMind").className = c==="mind" ? "btn primary":"btn";
        $("#tabLife").className = c==="life" ? "btn primary":"btn";
        renderList();
      };

      $("#tabBody").addEventListener("click", ()=> setCat("body"));
      $("#tabMind").addEventListener("click", ()=> setCat("mind"));
      $("#tabLife").addEventListener("click", ()=> setCat("life"));

      const renderList = () => {
        const items = (cfg[cat]||[]).filter(x=>x.enabled);
        if(!items.length){
          $("#practiceList").innerHTML = `<div class="item"><span>No practices here.</span><span class="badge">Edit in code later</span></div>`;
          return;
        }
        $("#practiceList").innerHTML = items.map(p=>{
          const val = day.practice?.[p.key];
          const right = (p.kind==="count")
            ? `<div class="stepper" data-kind="count" data-key="${p.key}">
                 <button data-dir="-">−</button>
                 <div class="val">${(val && typeof val.count==="number") ? val.count : 0}</div>
                 <button data-dir="+">+</button>
               </div>`
            : `<button class="btn ${val?.done ? "good":""}" data-kind="done" data-key="${p.key}">${val?.done ? "Done ✓" : "Mark done"}</button>`;
          return `<div class="item"><div><strong>${p.label}</strong><div class="p">${p.kind==="count" ? "Count" : "Yes/No"}</div></div>${right}</div>`;
        }).join("");
      };

      $("#practiceList").addEventListener("click", (e)=>{
        const node = e.target.closest("[data-key]");
        if(!node) return;
        const key = node.dataset.key;
        const kind = node.dataset.kind;

        if(kind === "done"){
          const cur = day.practice?.[key]?.done === true;
          day.practice[key] = { done: !cur };
          touch(tISO); saveState();
          toast(!cur ? "Logged." : "Unlogged.");
          render("practices");
          return;
        }

        if(kind === "count"){
          const wrap = e.target.closest("[data-kind='count']");
          const dir = e.target.dataset.dir;
          if(!wrap || !dir) return;
          const cur = (day.practice?.[key]?.count) || 0;
          day.practice[key] = { count: Math.max(0, Math.min(999, cur + (dir==="+" ? 1 : -1))) };
          touch(tISO); saveState();
          toast("Count updated.");
          renderList();
        }
      });

      renderList();
      const w = computeWeek(tISO);
      $("#practiceWeek").innerHTML = `
        <div class="item"><span>Total logged</span><strong>${w.practiceCount}</strong></div>
        <div class="item"><span>Week</span><strong>${w.startISO} → ${w.endISO}</strong></div>
      `;
      return;
    }

    if(tab === "calm"){
      const day = getDay(tISO);
      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">Quick interrupt</div>
            <p class="p">One tap. Logged. Done.</p>
            <div class="list" id="interrupts">
              <div class="item"><div><strong>30s breathe</strong><div class="p">Start. That’s enough.</div></div><button class="btn good" data-int="1">Log</button></div>
              <div class="item"><div><strong>Look away</strong><div class="p">20 seconds off-screen.</div></div><button class="btn good" data-int="1">Log</button></div>
              <div class="item"><div><strong>Unclench</strong><div class="p">Jaw, shoulders, hands.</div></div><button class="btn good" data-int="1">Log</button></div>
            </div>
            <div class="hr"></div>
            <div class="row"><span class="badge">Interrupts today</span><strong>${day.calm?.interrupts||0}</strong></div>
          </div>
          <div class="card">
            <div class="h2">Craving waits</div>
            <p class="p">Waiting is a win. Even if you still choose it.</p>
            <div class="btnrow"><button class="btn warn" id="wait10c">Wait 10 minutes</button></div>
            <div class="hr"></div>
            <div class="list">
              <div class="item"><span>Started</span><strong>${day.calm?.waitsStarted||0}</strong></div>
              <div class="item"><span>Completed</span><strong>${day.calm?.waitsCompleted||0}</strong></div>
              <div class="item"><span>Passed</span><strong>${day.calm?.passes||0}</strong></div>
              <div class="item"><span>Still wanted</span><strong>${day.calm?.still||0}</strong></div>
            </div>
          </div>
        </div>
      `;

      $("#interrupts").addEventListener("click", (e)=>{
        const b = e.target.closest("[data-int]");
        if(!b) return;
        day.calm.interrupts++;
        touch(tISO); saveState();
        toast("Logged.");
        render("calm");
      });

      $("#wait10c").addEventListener("click", ()=> startWaitTimer(tISO, "calm"));
      return;
    }

    if(tab === "goals"){
      const {startISO} = weekRange(tISO);
      state.goals.weekStartISO ||= startISO;
      if(state.goals.weekStartISO !== startISO){
        state.goals.weekStartISO = startISO;
        state.goals.review = null;
        saveState();
      }

      const w = computeWeek(tISO);
      const t = state.goals.targets;
      const pct = (a,b)=> b<=0 ? 0 : Math.max(0, Math.min(100, Math.round((a/b)*100)));

      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">Good enough week</div>
            <p class="p">Playable goals. No purity tests.</p>
            <div class="list">
              <div class="item">
                <div><strong>Alcohol-free days</strong><div class="p">${w.alcoholFreeDays} / ${t.alcoholFreeTarget}</div></div>
                <div style="width:160px"><div class="progress"><div style="width:${pct(w.alcoholFreeDays,t.alcoholFreeTarget)}%"></div></div></div>
              </div>
              <div class="item">
                <div><strong>Practices logged</strong><div class="p">${w.practiceCount} / ${t.practicesTarget}</div></div>
                <div style="width:160px"><div class="progress"><div style="width:${pct(w.practiceCount,t.practicesTarget)}%"></div></div></div>
              </div>
              <div class="item">
                <div><strong>Calm interrupts</strong><div class="p">${w.calm.interrupts} / ${t.calmTarget}</div></div>
                <div style="width:160px"><div class="progress"><div style="width:${pct(w.calm.interrupts,t.calmTarget)}%"></div></div></div>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="h2">Status</div>
            <div class="list">
              <div class="kpi"><div class="k">Momentum</div><div class="v">${momentumLabel(tISO).replace("Momentum: ","")}</div></div>
              <div class="kpi"><div class="k">Verdict</div><div class="v">${state.goals.review || "—"}</div></div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    if(tab === "insights"){
      const w = computeWeek(tISO);
      const {startISO} = weekRange(tISO);
      const days = listDays(startISO, 7);

      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">This week</div>
            <p class="p">${w.startISO} → ${w.endISO}</p>
            <div class="grid two">
              <div class="kpi"><div class="k">Avg mood</div><div class="v">${w.avgMood ? w.avgMood.toFixed(2) : "—"}</div></div>
              <div class="kpi"><div class="k">Drinks logged</div><div class="v">${w.drinks}</div></div>
              <div class="kpi"><div class="k">Days with alcohol</div><div class="v">${w.daysWithAlcohol}</div></div>
              <div class="kpi"><div class="k">Alcohol-free (logged)</div><div class="v">${w.alcoholFreeDays}</div></div>
              <div class="kpi"><div class="k">Practices logged</div><div class="v">${w.practiceCount}</div></div>
              <div class="kpi"><div class="k">Waits completed</div><div class="v">${w.calm.waitsCompleted}</div></div>
            </div>
          </div>
          <div class="card">
            <div class="h2">Week timeline</div>
            <div class="list">
              ${days.map(iso=>{
                const d = state.days[iso];
                const mood = d && typeof d.mood==="number" ? d.mood : "—";
                const alc = d && d.alcohol ? (d.alcohol.drinks||0) : "—";
                const prac = d ? countPracticeDone(d) : 0;
                const calm = d ? (d.calm?.interrupts||0) : 0;
                return `<div class="item"><div><strong>${iso}</strong><div class="p">Mood ${mood} • Alcohol ${alc} • Practices ${prac} • Calm ${calm}</div></div><span class="badge">${d ? "logged" : "—"}</span></div>`;
              }).join("")}
            </div>
          </div>
        </div>
      `;
      return;
    }

    if(tab === "settings"){
      elView.innerHTML = `
        <div class="grid two">
          <div class="card">
            <div class="h2">Backup & Share</div>
            <p class="p">Export JSON, send it, import later. No servers.</p>
            <div class="btnrow">
              <button class="btn primary" id="exportNow">Export backup</button>
              <button class="btn" id="importNow">Import backup</button>
            </div>
            <input type="file" id="importFile" accept="application/json" style="display:none"/>
          </div>
          <div class="card">
            <div class="h2">Danger zone</div>
            <p class="p">Reset wipes local storage on this browser.</p>
            <div class="btnrow">
              <button class="btn warn" id="reset">Reset local data</button>
            </div>
          </div>
        </div>
      `;
      $("#exportNow").addEventListener("click", exportBackup);
      $("#importNow").addEventListener("click", ()=> $("#importFile").click());
      $("#importFile").addEventListener("change", (e)=> importBackupFile(e.target.files?.[0]));
      $("#reset").addEventListener("click", ()=>{
        openModal("Reset local data", `<p class="p">This wipes local data. Export first if you care.</p>`, `
          <button class="btn warn" id="doReset">Reset</button>
          <button class="btn" id="cancelReset">Cancel</button>
        `);
        $("#cancelReset").addEventListener("click", closeModal, {once:true});
        $("#doReset").addEventListener("click", ()=>{
          state = freshState();
          localStorage.setItem(KEY, JSON.stringify(state));
          toast("Reset.");
          closeModal();
          render("checkin");
        }, {once:true});
      });
      return;
    }
  };

  // ---------- Init
  let state = loadState();

  $("#shareBtn").addEventListener("click", ()=>{
    openModal("Share / Backup", `
      <p class="p">No backend. Share by exporting a backup file.</p>
      <div class="hr"></div>
      <div class="btnrow">
        <button class="btn primary" id="exportShare">Export backup</button>
        <button class="btn" id="importShare">Import backup</button>
      </div>
      <input type="file" id="importFile2" accept="application/json" style="display:none"/>
      <div class="hr"></div>
      <p class="p">Cheap cloud hack: send backups to Telegram “Saved Messages”.</p>
    `, `<button class="btn" id="closeShare">Close</button>`);

    $("#closeShare").addEventListener("click", closeModal, {once:true});
    $("#exportShare").addEventListener("click", exportBackup, {once:true});
    $("#importShare").addEventListener("click", ()=> $("#importFile2").click(), {once:true});
    $("#importFile2").addEventListener("change", (e)=> importBackupFile(e.target.files?.[0]), {once:true});
  });

  $("#tabs").addEventListener("click", (e)=>{
    const b = e.target.closest("[data-tab]");
    if(!b) return;
    const tab = b.dataset.tab;
    $$(".tab").forEach(x=> x.classList.toggle("active", x.dataset.tab === tab));
    render(tab);
  });

  render("checkin");
})();
