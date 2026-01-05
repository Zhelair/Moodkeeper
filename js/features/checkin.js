(function(){
  const TAGS = ['work','money','job hunt','sleep','health','family','exercise','PIP'];

  function moodRow(selected){
    const row = UI.h('div',{class:'pillrow', style:'margin-top:8px'},[]);
    for(let i=1;i<=5;i++){
      row.appendChild(UI.h('button',{
        type:'button',
        class:'pill'+(selected===i?' active':''),
        'data-mood':String(i)
      },[String(i)]));
    }
    return row;
  }

  TrackboardRouter.register('checkin', async (mount)=>{
    const key = Store.todayKey();
    const existing = await Store.getEntry(key) || {date:key};

    document.getElementById('brand-subtitle').textContent = 'Check-in · Private · Stored on this device';

    const stack = UI.h('div',{class:'stack'},[]);

    stack.appendChild(UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Today — Check-in']),
      UI.h('p',{class:'p'},['Whatever it is — it’s okay to log it.']),
      UI.h('div',{class:'small'},['You don’t have to explain or fix anything.'])
    ]));

    // Mood card
    const moodCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['How does today feel right now?']),
      UI.h('div',{class:'small'},['A number is enough.']),
      moodRow(existing.mood || null)
    ]);

    // Tags card
    const tagCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['What influenced today?']),
      UI.h('div',{class:'small'},['Optional · up to three.']),
    ]);
    const chips = UI.h('div',{class:'pillrow'},[]);
    const selected = new Set(existing.tags || []);
    function renderTags(){
      chips.innerHTML='';
      TAGS.forEach(t=>{
        chips.appendChild(UI.h('button',{
          type:'button',
          class:'pill'+(selected.has(t)?' active':''),
          'data-tag':t
        },[t]));
      });
      chips.appendChild(UI.h('button',{type:'button', class:'pill', id:'btn-addtag'},['+ custom']));
    }
    renderTags();
    tagCard.appendChild(chips);

    // Notes
    const notesCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Today’s notes']),
      UI.h('div',{class:'small'},['Write as much or as little as you want.']),
      UI.h('textarea',{id:'checkin-notes', placeholder:'You can be brief or messy.'},[])
    ]);

    // Positive moment
    const posCard = UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['One positive moment today']),
      UI.h('div',{class:'small'},['Even something small counts.']),
      UI.h('input',{type:'text', id:'checkin-positive', placeholder:'A short line is enough.'})
    ]);

    // Sleep
    const sleepCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Sleep']),
      UI.h('div',{class:'row'},[
        UI.h('div',{style:'flex:1'},[
          UI.h('div',{class:'small'},['Went to bed']),
          UI.h('input',{type:'time', id:'sleep-bed'})
        ]),
        UI.h('div',{style:'flex:1'},[
          UI.h('div',{class:'small'},['Woke up']),
          UI.h('input',{type:'time', id:'sleep-wake'})
        ])
      ]),
      UI.h('label',{class:'small', style:'display:flex;gap:10px;align-items:center;margin-top:8px'},[
        UI.h('input',{type:'checkbox', id:'sleep-poor'}),
        UI.h('span',{},['Poor sleep'])
      ])
    ]);

    const actions = UI.h('div',{class:'card soft'},[
      UI.h('button',{class:'btn primary full', type:'button', id:'btn-save'},['Save today'])
    ]);

    stack.appendChild(moodCard);
    stack.appendChild(tagCard);
    stack.appendChild(notesCard);
    stack.appendChild(posCard);
    stack.appendChild(sleepCard);
    stack.appendChild(actions);

    mount.appendChild(stack);

    // Fill existing
    document.getElementById('checkin-notes').value = existing.notes || '';
    document.getElementById('checkin-positive').value = existing.positive || '';
    document.getElementById('sleep-bed').value = existing.sleepBed || '';
    document.getElementById('sleep-wake').value = existing.sleepWake || '';
    document.getElementById('sleep-poor').checked = !!existing.poorSleep;

    // Mood click
    moodCard.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-mood]');
      if(!btn) return;
      const val = parseInt(btn.dataset.mood,10);
      existing.mood = val;
      // refresh pills
      const row = moodRow(val);
      moodCard.replaceChild(row, moodCard.querySelector('.pillrow'));
    });

    // Tag click
    tagCard.addEventListener('click', (e)=>{
      const tbtn = e.target.closest('[data-tag]');
      if(tbtn){
        const t = tbtn.dataset.tag;
        if(selected.has(t)) selected.delete(t);
        else {
          if(selected.size >= 3){
            UI.toast('Up to three is enough.');
            return;
          }
          selected.add(t);
        }
        existing.tags = Array.from(selected);
        renderTags();
      }
      if(e.target && e.target.id === 'btn-addtag'){
        const v = prompt('Add a short tag (one or two words):');
        if(v){
          const t = v.trim().slice(0,24);
          if(t){
            if(selected.size < 3) selected.add(t);
            existing.tags = Array.from(selected);
            renderTags();
          }
        }
      }
    });

    // Save
    document.getElementById('btn-save').addEventListener('click', async ()=>{
      existing.notes = document.getElementById('checkin-notes').value.trim();
      existing.positive = document.getElementById('checkin-positive').value.trim();
      existing.sleepBed = document.getElementById('sleep-bed').value;
      existing.sleepWake = document.getElementById('sleep-wake').value;
      existing.poorSleep = document.getElementById('sleep-poor').checked;
      await Store.putEntry(existing);
      UI.toast('Saved. You can come back anytime.');
    });
  });
})();
