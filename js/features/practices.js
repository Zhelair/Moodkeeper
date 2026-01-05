
(function(){
  const $ = (sel, root=document)=> root.querySelector(sel);
  const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));

  const DEFAULTS = [
    // Body
    {id:'pushups', label:'Push-ups', kind:'count', group:'Body'},
    {id:'pullups', label:'Pull-ups', kind:'count', group:'Body'},
    {id:'abs', label:'Abs', kind:'count', group:'Body'},
    {id:'walk', label:'Walk (min)', kind:'count', group:'Body'},
    {id:'gym', label:'Gym / Swim', kind:'bool', group:'Body'},
    // Mind
    {id:'calm_touch', label:'Calm moment', kind:'bool', group:'Mind'},
    {id:'early_sleep', label:'Early sleep', kind:'bool', group:'Mind'},
    {id:'alcohol_free', label:'Alcohol-free', kind:'bool', group:'Mind'},
    // Life
    {id:'veg', label:'Vegetables', kind:'bool', group:'Life'},
    {id:'social', label:'Socialized', kind:'bool', group:'Life'},
    {id:'new_place', label:'New place', kind:'bool', group:'Life'},
  ];

  async function getConfig(){
    const cfg = await Store.getSetting('practices_config');
    if(cfg && cfg.items && Array.isArray(cfg.items)) return cfg;
    return { items: DEFAULTS.map(x=>({...x, enabled:true})) };
  }

  async function saveConfig(cfg){
    await Store.setSetting('practices_config', cfg);
  }

  function weekStartISO(d=new Date()){
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = date.getUTCDay() || 7; // Mon=1..Sun=7
    if(day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
    return date.toISOString().slice(0,10);
  }
  function addDaysISO(iso, n){
    const d = new Date(iso+"T00:00:00");
    d.setDate(d.getDate()+n);
    return d.toISOString().slice(0,10);
  }
  function fmtDow(iso){
    const d = new Date(iso+"T00:00:00");
    return d.toLocaleDateString('en-US',{weekday:'short'});
  }

  function confettiMini(root){
    // small, non-infantile "burst" — 6 dots
    const burst = document.createElement('div');
    burst.className = 'mini-burst';
    burst.innerHTML = Array.from({length:6}).map(()=>'<i></i>').join('');
    root.appendChild(burst);
    setTimeout(()=> burst.remove(), 900);
  }

  function render(view){
    view.innerHTML = `
      <div class="page">
        <div class="pagehead">
          <div>
            <h2>Practices</h2>
            <div class="muted">X marks, counts optional. No perfection required.</div>
          </div>
          <button class="btn" id="pc-manage">Manage</button>
        </div>

        <div class="tabs">
          <button class="tabbtn active" data-tab="Body">Body</button>
          <button class="tabbtn" data-tab="Mind">Mind</button>
          <button class="tabbtn" data-tab="Life">Life</button>
        </div>

        <div id="pc-content"></div>
      </div>

      <div class="modal" id="pc-modal" aria-hidden="true">
        <div class="modal-card">
          <div class="modal-head">
            <h3>Manage practices</h3>
            <button class="icon-btn" id="pc-close" aria-label="Close">✕</button>
          </div>
          <div class="muted">Turn things on/off. Add your own.</div>
          <div class="mt" id="pc-list"></div>

          <div class="divider"></div>

          <label class="field">
            <div class="label">Add custom practice</div>
            <input id="pc-new" class="input" placeholder="e.g., Stretching, Reading, Cold shower">
          </label>
          <div class="row gap">
            <button class="btn" id="pc-add-bool">Add (yes/no)</button>
            <button class="btn" id="pc-add-count">Add (count)</button>
          </div>
        </div>
      </div>
    `;

    const state = { tab:'Body', cfg:null };

    const content = $("#pc-content");
    const modal = $("#pc-modal");
    const list = $("#pc-list");

    function openModal(){
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
    }
    function closeModal(){
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
    }

    async function renderManage(){
      state.cfg = await getConfig();
      list.innerHTML = state.cfg.items.map(it=>`
        <label class="toggle-row">
          <input type="checkbox" data-id="${it.id}" ${it.enabled?'checked':''}>
          <span>${it.label}</span>
          <span class="pill">${it.group}${it.kind==='count'?' · count':''}</span>
        </label>
      `).join('');
    }

    async function getWeekEntries(){
      const ws = weekStartISO(new Date());
      const entries = await Store.getEntriesForWeek(ws);
      const map = {};
      for(const e of entries){
        map[e.date] = e;
      }
      return { ws, map };
    }

    function getPracticeValue(entry, id){
      const p = (entry && entry.practices) ? entry.practices : {};
      return p[id];
    }

    async function setTodayValue(id, val){
      const today = TrackboardUI.todayISO();
      const entry = await Store.getEntry(today) || {date: today};
      entry.date = today;
      entry.practices = entry.practices || {};
      if(val === null || val === undefined){
        delete entry.practices[id];
      }else{
        entry.practices[id] = val;
      }
      try{
        await Store.putEntry(entry);
      }catch(err){
        if(String(err).includes('Locked')){
          TrackboardUI.toast('Notebook is locked. Unlock to save.');
          window.location.hash = '#unlock';
          throw err;
        }
        throw err;
      }
    }

    function rowForCount(item, todayVal){
      return `
        <div class="practice-row">
          <div class="practice-label">${item.label}</div>
          <div class="practice-controls" data-id="${item.id}">
            <button class="btn tiny" data-act="dec">−</button>
            <input class="count" inputmode="numeric" pattern="[0-9]*" value="${(todayVal??'')}" placeholder="0">
            <button class="btn tiny" data-act="inc">+</button>
            <button class="btn tiny ghost" data-act="save">Save</button>
          </div>
        </div>
      `;
    }
    function rowForBool(item, todayVal){
      const on = !!todayVal;
      return `
        <div class="practice-row">
          <div class="practice-label">${item.label}</div>
          <div class="practice-controls" data-id="${item.id}">
            <button class="btn tiny ${on?'primary':''}" data-act="toggle">${on?'Done':'Mark'}</button>
          </div>
        </div>
      `;
    }

    function gridForItem(item, week){
      const days = Array.from({length:7}).map((_,i)=> addDaysISO(week.ws, i));
      const cells = days.map(d=>{
        const v = getPracticeValue(week.map[d], item.id);
        const show = (item.kind==='count') ? (v ? String(v) : '') : (v ? 'X' : '');
        return `<div class="gcell ${show?'on':''}"><div class="gday">${fmtDow(d)}</div><div class="gval">${show||'—'}</div></div>`;
      }).join('');
      return `
        <div class="grid-card">
          <div class="grid-head">${item.label} <span class="muted">this week</span></div>
          <div class="grid">${cells}</div>
        </div>
      `;
    }

    async function renderTab(){
      const cfg = await getConfig();
      state.cfg = cfg;
      const week = await getWeekEntries();
      const enabled = cfg.items.filter(it=>it.enabled && it.group===state.tab);

      const today = TrackboardUI.todayISO();
      const todayEntry = week.map[today] || {};

      let html = '';
      if(enabled.length===0){
        html += `<div class="card"><div class="muted">Nothing enabled here. Use <b>Manage</b> to add practices.</div></div>`;
      }else{
        html += `<div class="card">
          <div class="cardtitle">Today</div>
          <div class="muted">Log quickly. Counts are optional.</div>
          <div class="divider"></div>
          ${enabled.map(it=>{
            const v = getPracticeValue(todayEntry, it.id);
            return it.kind==='count' ? rowForCount(it, v) : rowForBool(it, v);
          }).join('')}
        </div>`;

        html += enabled.map(it=> gridForItem(it, week)).join('');
      }


      // Week mini summary (all tabs)
      const totals = {Body:0, Mind:0, Life:0};
      for(const e of Object.values(week.map)){
        const p = (e && e.practices) ? e.practices : {};
        for(const it of cfg.items){
          if(!it.enabled) continue;
          const v = p[it.id];
          if(v === undefined || v === null) continue;
          if(it.kind === 'bool'){
            if(v) totals[it.group] += 1;
          }else{
            const n = Number(v)||0;
            if(n>0) totals[it.group] += 1;
          }
        }
      }
      const totalLine = `This week: Body ${totals.Body} · Mind ${totals.Mind} · Life ${totals.Life}`;
      html += `<div class="card soft"><div class="small muted">${totalLine}</div></div>`;

      content.innerHTML = html;

      // wire controls
      $$(".practice-controls").forEach(ctrl=>{
        const id = ctrl.dataset.id;
        const item = enabled.find(x=>x.id===id) || cfg.items.find(x=>x.id===id);
        if(!item) return;
        ctrl.addEventListener('click', async (e)=>{
          const act = e.target.dataset.act;
          if(!act) return;
          if(item.kind==='bool'){
            const todayV = !!getPracticeValue(week.map[TrackboardUI.todayISO()]||{}, id);
            await setTodayValue(id, !todayV);
            TrackboardUI.toast(!todayV ? "Marked." : "Cleared.");
            confettiMini(ctrl);
            await renderTab();
            return;
          }
          // count
          const inp = $(".count", ctrl);
          const cur = parseInt(inp.value || "0", 10) || 0;
          if(act==='inc'){ inp.value = String(cur+1); return; }
          if(act==='dec'){ inp.value = String(Math.max(0, cur-1)); return; }
          if(act==='save'){
            const val = parseInt(inp.value || "0", 10);
            if(!val){
              await setTodayValue(id, null);
              TrackboardUI.toast("Cleared.");
            }else{
              await setTodayValue(id, val);
              TrackboardUI.toast("Saved.");
              confettiMini(ctrl);
            }
            await renderTab();
          }
        });
      });
    }

    // tabs
    $$(".tabbtn").forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        $$(".tabbtn").forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        state.tab = btn.dataset.tab;
        await renderTab();
      });
    });

    // manage
    $("#pc-manage").addEventListener('click', async ()=>{
      await renderManage();
      openModal();
    });
    $("#pc-close").addEventListener('click', closeModal);
    modal.addEventListener('click', (e)=>{ if(e.target===modal) closeModal(); });

    list.addEventListener('change', async (e)=>{
      const cb = e.target.closest('input[type=checkbox]');
      if(!cb) return;
      const id = cb.dataset.id;
      const cfg = await getConfig();
      const it = cfg.items.find(x=>x.id===id);
      if(it){ it.enabled = cb.checked; await saveConfig(cfg); }
      TrackboardUI.toast("Updated.");
      await renderTab();
    });

    function slugify(s){
      const base = (s||'').toLowerCase().trim()
        .replace(/[^a-z0-9]+/g,'_')
        .replace(/^_+|_+$/g,'');
      return (base.slice(0,32) || ('custom_'+Math.random().toString(16).slice(2,8)));
    }

    async function addCustom(kind){
      const inp = $("#pc-new");
      const label = (inp.value||'').trim();
      if(!label){ TrackboardUI.toast("Write a name first."); return; }
      const id = slugify(label);
      const cfg = await getConfig();
      if(cfg.items.some(x=>x.id===id)){ TrackboardUI.toast("Already exists."); return; }
      cfg.items.push({id, label, kind, group: state.tab, enabled:true});
      await saveConfig(cfg);
      inp.value = '';
      TrackboardUI.toast("Added.");
      await renderManage();
      await renderTab();
    }

    $("#pc-add-bool").addEventListener('click', ()=> addCustom('bool'));
    $("#pc-add-count").addEventListener('click', ()=> addCustom('count'));

    // initial
    renderTab();
  }

  TrackboardRouter.register('practices', (view)=>{ render(view); });
})();
