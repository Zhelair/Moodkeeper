
(function(){
  TrackboardRouter.register('stress', async (mount)=>{
    const key = (window.TrackboardUI && TrackboardUI.activeISO) ? TrackboardUI.activeISO() : Store.todayKey();
    const entry = await Store.getEntry(key) || {date:key};

    if(window.TrackboardUI){
      TrackboardUI.setActiveNav('home');
      TrackboardUI.setSubtitle(`Stress · ${TrackboardUI.fmtActive ? TrackboardUI.fmtActive() : key} · Private · Stored on this device`);
    }

    const pastNote = (window.TrackboardUI && TrackboardUI.pastDayNoteEl) ? TrackboardUI.pastDayNoteEl() : null;

    const card = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h1'},['Release stress']),
      UI.h('p',{class:'p'},['Choose what fits right now.']),
      pastNote,
      UI.h('div',{class:'row', style:'margin-top:10px'},[
        UI.h('button',{class:'btn primary', type:'button', 'data-stab':'rant'},['Rant']),
        UI.h('button',{class:'btn', type:'button', 'data-stab':'dump'},['Brain dump']),
        UI.h('button',{class:'btn', type:'button', 'data-stab':'calm3'},['3-minute calm']),
      ])
    ]);

    let tab = entry.stressTab || 'rant';

    async function save(){
      entry.updatedAt = Date.now();
      entry.createdAt = entry.createdAt || Date.now();
      await Store.putEntry(entry);
    }

    function secRant(){
      const box = UI.h('div',{},[]);
      box.appendChild(UI.h('p',{class:'p', style:'margin-top:10px'},['Say it. No fixing required.']));
      const ta = UI.h('textarea',{placeholder:'Type freely. This isn’t analyzed.'},[entry.rant || '']);
      const del = UI.h('input',{type:'checkbox'},[]);
      del.checked = entry.rantDelete !== false; // default true
      const saveWith = UI.h('input',{type:'checkbox'},[]);
      saveWith.checked = !!entry.rantSave;

      box.appendChild(ta);
      box.appendChild(UI.h('div',{class:'row', style:'margin-top:10px'},[
        UI.h('label',{style:'display:flex;align-items:center;gap:8px'},[del, UI.h('span',{},['Delete after closing'])]),
        UI.h('label',{style:'display:flex;align-items:center;gap:8px'},[saveWith, UI.h('span',{},['Save with this day'])])
      ]));

      const closeBtn = UI.h('button',{class:'btn full', type:'button', style:'margin-top:10px'},['Close']);
      const saveBtn = UI.h('button',{class:'btn primary full', type:'button', style:'margin-top:10px'},['Save']);
      box.appendChild(closeBtn);
      box.appendChild(saveBtn);

      closeBtn.addEventListener('click', async ()=>{
        entry.rantDelete = del.checked;
        entry.rantSave = saveWith.checked;
        if(entry.rantDelete && !entry.rantSave){
          entry.rant = '';
        } else {
          entry.rant = ta.value.slice(0,2000);
        }
        await save();
        TrackboardRouter.go('home');
      });

      saveBtn.addEventListener('click', async ()=>{
        entry.rantDelete = del.checked;
        entry.rantSave = saveWith.checked;
        entry.rant = ta.value.slice(0,2000);
        await save();
        UI.toast('Saved.');
      });

      return box;
    }

    function secDump(){
      const box = UI.h('div',{},[]);
      box.appendChild(UI.h('p',{class:'p', style:'margin-top:10px'},['One line = one bullet.']));
      const ta = UI.h('textarea',{placeholder:'HR call\nmoney stress\nheadache'},[(entry.dump||[]).join('\n')]);
      const saveBtn = UI.h('button',{class:'btn primary full', type:'button', style:'margin-top:10px'},['Save']);
      const clrBtn = UI.h('button',{class:'btn full', type:'button', style:'margin-top:10px'},['Clear']);
      box.appendChild(ta); box.appendChild(saveBtn); box.appendChild(clrBtn);

      saveBtn.addEventListener('click', async ()=>{
        const lines = ta.value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,100);
        entry.dump = lines;
        await save();
        UI.toast('Saved.');
      });

      clrBtn.addEventListener('click', ()=>{
        ta.value = '';
      });

      return box;
    }

    function secCalm3(){
      const box = UI.h('div',{},[]);
      box.appendChild(UI.h('p',{class:'p', style:'margin-top:10px'},['Three minutes. Nothing else to do right now.']));
      const timer = UI.h('div',{class:'h1', style:'margin-top:10px'},['03:00']);
      const start = UI.h('button',{class:'btn primary full', type:'button', style:'margin-top:10px'},['Start']);
      const stop = UI.h('button',{class:'btn full', type:'button', style:'margin-top:10px'},['Stop']);
      const done = UI.h('button',{class:'btn full', type:'button', style:'margin-top:10px'},['Done']);
      box.appendChild(timer); box.appendChild(start); box.appendChild(stop); box.appendChild(done);

      let iv=null, end=0;
      function tick(){
        const left = Math.max(0, end-Date.now());
        const s = Math.floor(left/1000);
        const m = String(Math.floor(s/60)).padStart(2,'0');
        const r = String(s%60).padStart(2,'0');
        timer.textContent = `${m}:${r}`;
        if(left<=0){
          clearInterval(iv); iv=null;
          UI.toast('Done.');
        }
      }
      start.addEventListener('click', ()=>{
        end = Date.now()+3*60*1000;
        if(iv) clearInterval(iv);
        iv=setInterval(tick,250);
        tick();
      });
      stop.addEventListener('click', ()=>{
        if(iv) clearInterval(iv);
        iv=null;
      });
      done.addEventListener('click', ()=>{
        if(iv) clearInterval(iv);
        iv=null;
        TrackboardRouter.go('home');
      });

      return box;
    }

    function renderBody(){
      body.innerHTML='';
      if(tab==='rant') body.appendChild(secRant());
      if(tab==='dump') body.appendChild(secDump());
      if(tab==='calm3') body.appendChild(secCalm3());
    }

    const body = UI.h('div',{},[]);
    card.appendChild(body);
    renderBody();

    card.addEventListener('click', async (e)=>{
      const t = e.target.closest('[data-stab]')?.dataset.stab;
      if(t){
        tab = t;
        entry.stressTab = t;
        await save();
        renderBody();
      }
    });

    mount.appendChild(card);
  });
})();
