
(function(){
  const $ = (sel, root=document)=> root.querySelector(sel);

  function isoWeekKey(d=new Date()){
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1)/7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2,'0')}`;
  }

  function startOfWeekISO(date){
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - day);
    return d.toISOString().slice(0,10);
  }

  async function getWeekEntries(){
    const today = new Date();
    const start = startOfWeekISO(today);
    const startD = new Date(start+"T00:00:00");
    const entries = [];
    for(let i=0;i<7;i++){
      const d = new Date(startD);
      d.setDate(startD.getDate()+i);
      const iso = d.toISOString().slice(0,10);
      const e = await Store.getEntry(iso);
      if(e) entries.push(e);
    }
    return { start, entries };
  }

  async function getPracticesConfig(){
    const cfg = await Store.getSetting('practices_config');
    if(cfg && cfg.items && Array.isArray(cfg.items)) return cfg;
    return null;
  }

  function countPractices(entries, cfg){
    if(!cfg || !cfg.items) return 0;
    const enabled = cfg.items.filter(it=>it.enabled);
    let n = 0;
    for(const e of entries){
      const p = (e && e.practices) ? e.practices : {};
      for(const it of enabled){
        const v = p[it.id];
        if(v === undefined || v === null) continue;
        if(it.kind === 'bool'){
          if(v) n += 1;
        }else{
          const c = Number(v)||0;
          if(c>0) n += 1;
        }
      }
    }
    return n;
  }

  function countAlcoholFree(entries){
    let n = 0;
    for(const e of entries){
      if(e.alcohol && e.alcohol.status === 'free') n += 1;
    }
    return n;
  }

  function countCalm(entries){
    let n = 0;
    for(const e of entries){
      n += Number(e.calmInterrupts||0) || 0;
    }
    return n;
  }

  function bar(label, cur, tgt){
    const pct = tgt ? Math.max(0, Math.min(1, cur/tgt)) : 0;
    const txt = tgt ? `${cur} / ${tgt}` : `${cur}`;
    return `
      <div class="meterblock">
        <div class="meterhead"><div>${label}</div><div class="muted">${txt}</div></div>
        <div class="meter"><div class="meterfill" style="width:${(pct*100).toFixed(1)}%"></div></div>
      </div>`;
  }

  TrackboardRouter.register('goals', async (mount)=>{
    TrackboardUI.setSubtitle('Goals · Private · Stored on this device');

    const wk = isoWeekKey(new Date());
    const weekRec = await Store.getWeek(wk) || {weekKey:wk};

    const { start, entries } = await getWeekEntries();
    const cfg = await getPracticesConfig();

    const stats = {
      alcoholFree: countAlcoholFree(entries),
      practices: countPractices(entries, cfg),
      calm: countCalm(entries)
    };

    const good = weekRec.goodEnough || null;

    mount.innerHTML = `
      <div class="page">
        <section class="card soft">
          <h2>This week</h2>
          <p class="muted">Goals are direction, not obligation.</p>
        </section>

        <section class="card">
          <h3>What would make this week feel good enough?</h3>
          <div class="muted">One or two short sentences.</div>
          <textarea id="wk-intention" class="textarea mt" rows="2" placeholder="e.g., Enough sleep, less pressure">${(weekRec.intention||'')}</textarea>
        </section>

        <section class="card" id="wk-goodenough">
          <h3>Good enough week</h3>
          <div class="muted">Pick a minimum win. Not perfection.</div>

          <div class="mt" id="wk-good-body"></div>
        </section>

        <section class="card" id="wk-check">
          <h3>Gentle check</h3>
          <div class="muted">How did this week go?</div>
          <div class="row mt" style="gap:10px; flex-wrap:wrap;">
            <button class="btn" data-ref="better">Better than expected</button>
            <button class="btn" data-ref="right">About right</button>
            <button class="btn" data-ref="hard">Hard, but I showed up</button>
          </div>
          <div class="mt muted" id="wk-summary">Good enough is good.</div>
        </section>

        <section class="card">
          <h3>Carry forward</h3>
          <label class="row" style="gap:10px;">
            <input type="checkbox" id="wk-carry" ${weekRec.carryForward ? 'checked':''}/>
            <span class="muted">Keep this intention for next week.</span>
          </label>
        </section>

        <button class="btn primary full" id="wk-save">Save</button>
      </div>
    `;

    // Good enough UI
    const body = $('#wk-good-body');

    // IMPORTANT: never use human labels as DOM ids or dataset keys.
    // Labels can contain spaces/punctuation which break querySelector.
    function stepper(label, key, val, min, max){
      return `
        <div class="row mt" style="justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div class="muted">${label}</div>
          <div class="row" style="gap:8px;">
            <button class="btn" data-step="${key}" data-dir="-">−</button>
            <div style="min-width:42px; text-align:center; font-weight:700;" id="val-${key}">${val}</div>
            <button class="btn" data-step="${key}" data-dir="+">+</button>
          </div>
        </div>
      `;
    }

    if(!good){
      // builder
      const initial = { alcoholFreeTarget: 4, practicesTarget: 5, calmTarget: 3 };
      body.innerHTML = `
        ${stepper('Alcohol-free days', 'alcoholFreeTarget', initial.alcoholFreeTarget, 0, 7)}
        ${stepper('Practices (total)', 'practicesTarget', initial.practicesTarget, 0, 20)}
        ${stepper('Calm interrupts', 'calmTarget', initial.calmTarget, 0, 30)}
        <div class="hr"></div>
        <button class="btn primary full" id="wk-start">Start week</button>
      `;

      const state = {...initial};
      function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
      function renderVals(){
        // Safe, stable ids
        $('#val-alcoholFreeTarget').textContent = state.alcoholFreeTarget;
        $('#val-practicesTarget').textContent = state.practicesTarget;
        $('#val-calmTarget').textContent = state.calmTarget;
      }
      renderVals();

      body.addEventListener('click', (e)=>{
        const b = e.target.closest('[data-step]');
        if(!b) return;
        const key = b.dataset.step;
        const dir = b.dataset.dir === '+' ? 1 : -1;
        if(key === 'alcoholFreeTarget') state.alcoholFreeTarget = clamp(state.alcoholFreeTarget + dir, 0, 7);
        if(key === 'practicesTarget') state.practicesTarget = clamp(state.practicesTarget + dir, 0, 50);
        if(key === 'calmTarget') state.calmTarget = clamp(state.calmTarget + dir, 0, 99);
        renderVals();
      });

      $('#wk-start').addEventListener('click', async ()=>{
        weekRec.goodEnough = {...state};
        weekRec.startedAt = Date.now();
        weekRec.intention = $('#wk-intention').value.trim();
        await Store.putWeek(weekRec);
        UI.toast('Week started.');
        TrackboardRouter.go('goals');
      });

      // Sprint 3: Reset THIS WEEK logs (Mon–Sun entries only)
      $('#wk-reset-logs').addEventListener('click', async ()=>{
        const ok2 = confirm('Reset THIS WEEK logs (Mon–Sun)?\n\nThis deletes daily entries for the current week. Other weeks stay.');
        if(!ok2) return;
        const todayISO = TrackboardUI.todayISO();
        const start = startOfWeekISO(todayISO);
        const startD = new Date(start + "T00:00:00");
        for(let i=0;i<7;i++){
          const d = new Date(startD);
          d.setDate(startD.getDate()+i);
          const iso = d.toISOString().slice(0,10);
          try{ await Store.deleteEntry(iso); }catch(e){}
        }
        UI.toast('This week logs cleared.');
        TrackboardRouter.go('goals');
      });

    }else{
      // progress view
      body.innerHTML = `
        ${bar('Alcohol-free', stats.alcoholFree, good.alcoholFreeTarget)}
        ${bar('Practices', stats.practices, good.practicesTarget)}
        ${bar('Calm interrupts', stats.calm, good.calmTarget)}
        <div class="muted">You’re still in the game.</div>

        <div class="row mt" style="gap:10px; flex-wrap:wrap;">
          <button class="btn" id="wk-edit">Edit targets</button>
          <button class="btn" id="wk-reset">Reset week</button>
          <button class="btn danger" id="wk-reset-logs">Reset THIS WEEK logs</button>
        </div>
        <div class="tiny muted mt">“Reset week” clears targets/notes. “Reset THIS WEEK logs” clears Mon–Sun entries.</div>
      `;

      // Edit targets (no data deleted; just changes minimums)
      $('#wk-edit').addEventListener('click', ()=>{
        const initial = {
          alcoholFreeTarget: Number(good.alcoholFreeTarget||0) || 0,
          practicesTarget: Number(good.practicesTarget||0) || 0,
          calmTarget: Number(good.calmTarget||0) || 0
        };
        body.innerHTML = `
          <div class="muted">Adjust the minimum win. Keep it kind.</div>
          ${stepper('Alcohol-free days', 'alcoholFreeTarget', initial.alcoholFreeTarget, 0, 7)}
          ${stepper('Practices (total)', 'practicesTarget', initial.practicesTarget, 0, 20)}
          ${stepper('Calm interrupts', 'calmTarget', initial.calmTarget, 0, 30)}
          <div class="hr"></div>
          <div class="row" style="gap:10px; flex-wrap:wrap;">
            <button class="btn primary" id="wk-edit-save">Save changes</button>
            <button class="btn" id="wk-edit-cancel">Cancel</button>
          </div>
        `;

        const state = {...initial};
        function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
        function renderVals(){
          $('#val-alcoholFreeTarget').textContent = state.alcoholFreeTarget;
          $('#val-practicesTarget').textContent = state.practicesTarget;
          $('#val-calmTarget').textContent = state.calmTarget;
        }
        renderVals();

        body.addEventListener('click', (e)=>{
          const b = e.target.closest('[data-step]');
          if(!b) return;
          const key = b.dataset.step;
          const dir = b.dataset.dir === '+' ? 1 : -1;
          if(key === 'alcoholFreeTarget') state.alcoholFreeTarget = clamp(state.alcoholFreeTarget + dir, 0, 7);
          if(key === 'practicesTarget') state.practicesTarget = clamp(state.practicesTarget + dir, 0, 50);
          if(key === 'calmTarget') state.calmTarget = clamp(state.calmTarget + dir, 0, 99);
          renderVals();
        }, { once:false });

        $('#wk-edit-save').addEventListener('click', async ()=>{
          weekRec.goodEnough = {...state};
          await Store.putWeek(weekRec);
          UI.toast('Targets updated.');
          TrackboardRouter.go('goals');
        });
        $('#wk-edit-cancel').addEventListener('click', ()=>{
          TrackboardRouter.go('goals');
        });
      });

      // Full reset (targets + intention + reflection)
      $('#wk-reset').addEventListener('click', async ()=>{
        const ok = confirm('Reset this week?\n\nThis clears your weekly targets and notes. Daily logs stay on this device.');
        if(!ok) return;
        delete weekRec.goodEnough;
        delete weekRec.startedAt;
        delete weekRec.reflection;
        weekRec.intention = '';
        weekRec.carryForward = false;
        await Store.putWeek(weekRec);
        UI.toast('Week reset.');
        TrackboardRouter.go('goals');
      });
    }

    // Reflection
    function setReflection(val){
      weekRec.reflection = val;
      $('#wk-check').querySelectorAll('[data-ref]').forEach(b=>{
        b.classList.toggle('primary', b.dataset.ref === val);
      });
      const s = $('#wk-summary');
      if(val === 'better') s.textContent = 'Nice. Keep it simple and repeat what worked.';
      else if(val === 'right') s.textContent = 'That’s a solid week. Good enough is good.';
      else if(val === 'hard') s.textContent = 'Hard weeks count too. Keep the bar kind.';
      else s.textContent = 'You stayed engaged. That counts.';
    }
    if(weekRec.reflection) setReflection(weekRec.reflection);

    $('#wk-check').addEventListener('click', (e)=>{
      const btn = e.target.closest('[data-ref]');
      if(!btn) return;
      setReflection(btn.dataset.ref);
    });

    // Save
    $('#wk-save').addEventListener('click', async ()=>{
      weekRec.intention = $('#wk-intention').value.trim();
      weekRec.carryForward = $('#wk-carry').checked;
      await Store.putWeek(weekRec);
      UI.toast('Saved.');
    });
  });
})();
