
(function(){
  const $ = (sel, root=document)=> root.querySelector(sel);

  async function logInterrupt(){
    const day = (window.TrackboardUI && TrackboardUI.activeISO) ? TrackboardUI.activeISO() : TrackboardUI.todayISO();
    const entry = await Store.getEntry(day) || {date: day};
    entry.date = day;
    entry.calmInterrupts = (Number(entry.calmInterrupts||0) || 0) + 1;

    // also mark a Mind practice if it exists (nice cross-link)
    entry.practices = entry.practices || {};
    if(entry.practices.calm_touch === undefined) entry.practices.calm_touch = true;

    try{
      await Store.putEntry(entry);
    }catch(err){
      if(String(err).includes('Locked')){
        UI.toast('Notebook is locked. Unlock to save.');
        window.location.hash = '#unlock';
        return false;
      }
      throw err;
    }
    return true;
  }

  TrackboardRouter.register('calm', async (mount)=>{
    TrackboardUI.setActiveNav('calm');
    TrackboardUI.setSubtitle(`Calm · ${TrackboardUI.fmtActive ? TrackboardUI.fmtActive() : TrackboardUI.activeISO()} · Private · Stored on this device`);

    const day = TrackboardUI.activeISO();
    const entry = await Store.getEntry(day) || {};
    const count = Number(entry.calmInterrupts||0) || 0;

    const stack = UI.h('div',{class:'stack'},[]);

    stack.appendChild(UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Take a moment.']),
      UI.h('div',{class:'small'},['Nothing else needs attention right now.']),
      (TrackboardUI.pastDayNoteEl ? TrackboardUI.pastDayNoteEl() : null),
      UI.h('div',{class:'small muted', style:'margin-top:8px;'},[`This day: ${count} interrupt(s)`])
    ]));

    // Quick interrupt actions
    const quick = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Quick interrupt']),
      UI.h('div',{class:'small'},['One tap. No perfect focus required.']),
      UI.h('div',{class:'row', style:'gap:10px; flex-wrap:wrap; margin-top:10px;'},[
        UI.h('button',{class:'btn primary', type:'button', id:'btn-breathe'},['30s breathe']),
        UI.h('button',{class:'btn', type:'button', id:'btn-unclench'},['Unclench + shoulders']),
        UI.h('button',{class:'btn', type:'button', id:'btn-ground-1'},['One-minute grounding'])
      ]),
      UI.h('div',{id:'quick-steps', class:'small', style:'margin-top:10px;display:none;line-height:1.5;'},[])
    ]);

    stack.appendChild(quick);

    async function afterQuick(msg){
      const ok = await logInterrupt();
      if(ok){
        UI.toast('Logged ✓');
        // update counter line
        const day2 = (window.TrackboardUI && TrackboardUI.activeISO) ? TrackboardUI.activeISO() : TrackboardUI.todayISO();
        const e2 = await Store.getEntry(day2) || {};
        const c2 = Number(e2.calmInterrupts||0) || 0;
        const el = stack.querySelector('.small.muted');
        if(el) el.textContent = `This day: ${c2} interrupt(s)`;
      }
      if(msg) UI.toast(msg);
    }

    document.addEventListener('click', async (e)=>{
      const id = e.target && e.target.id;
      if(id === 'btn-breathe'){
        await afterQuick();
        const steps = $('#quick-steps', mount);
        steps.style.display = 'block';
        steps.innerHTML = `
          <div>Inhale 4 · Hold 2 · Exhale 6</div>
          <div class="muted">Do this 3 times. That’s enough.</div>
        `;
      }
      if(id === 'btn-unclench'){
        await afterQuick();
        const steps = $('#quick-steps', mount);
        steps.style.display = 'block';
        steps.innerHTML = `
          <div>Unclench your jaw. Drop your shoulders.</div>
          <div class="muted">One slow exhale.</div>
        `;
      }
      if(id === 'btn-ground-1'){
        await afterQuick();
        const steps = $('#quick-steps', mount);
        steps.style.display = 'block';
        steps.innerHTML = `
          <ul style="margin:6px 0 0 18px;">
            <li>Notice what you can see.</li>
            <li>Notice what you can feel.</li>
            <li>Notice what you can hear.</li>
          </ul>
          <div class="muted">That’s enough.</div>
        `;
      }
    });

    // Body scan (keep)
    const bodyScan = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Body scan']),
      UI.h('div',{class:'small'},['3 or 8 minutes. You don’t need to focus perfectly.']),
      UI.h('div',{class:'row', style:'gap:10px; flex-wrap:wrap; margin-top:10px;'},[
        UI.h('button',{class:'btn', type:'button', id:'btn-scan-3'},['3 minutes']),
        UI.h('button',{class:'btn', type:'button', id:'btn-scan-8'},['8 minutes'])
      ]),
      UI.h('audio',{id:'scan-audio', controls:true, style:'width:100%; margin-top:10px; display:none;'},[])
    ]);

    stack.appendChild(bodyScan);

    const textCard = UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Your calming text']),
      UI.h('div',{class:'small'},['Read something that helps.']),
      UI.h('div',{class:'small', style:'margin-top:6px;'},[(await Store.getSetting('calm_text')) || 'Life is Good!']),
      UI.h('button',{class:'btn', type:'button', id:'btn-edit-calm', style:'margin-top:10px;'},['Edit'])
    ]);
    stack.appendChild(textCard);

    mount.appendChild(stack);

    function play(src){
      const a = document.getElementById('scan-audio');
      a.style.display = 'block';
      a.src = src;
      a.play().catch(()=>{});
    }
    document.getElementById('btn-scan-3').addEventListener('click', ()=> play('assets/body-scan-3min.mp3'));
    document.getElementById('btn-scan-8').addEventListener('click', ()=> play('assets/body-scan-8min.mp3'));

    document.getElementById('btn-edit-calm').addEventListener('click', async ()=>{
      const cur = (await Store.getSetting('calm_text')) || 'Life is Good!';
      const next = prompt('Your calming text:', cur);
      if(next===null) return;
      await Store.setSetting('calm_text', next.trim());
      UI.toast('Saved.');
      TrackboardRouter.go('calm');
    });
  });
})();
