(function(){
  TrackboardRouter.register('settings', async (mount)=>{
    document.getElementById('brand-subtitle').textContent = 'Settings · Private · Stored on this device';

    const stack = UI.h('div',{class:'stack'},[]);

    stack.appendChild(UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Settings']),
      UI.h('div',{class:'small'},['Private by design. No accounts. No servers.'])
    ]));

    // Theme
    const theme = await Store.getSetting('theme') || 'morning';
    const themeCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Theme']),
      UI.h('div',{class:'small'},['Choose the atmosphere.']),
      UI.h('div',{class:'row', style:'margin-top:8px'},[
        UI.h('button',{class:'btn small'+(theme==='morning'?' primary':''), type:'button', 'data-theme':'morning'},['Calm Morning']),
        UI.h('button',{class:'btn small'+(theme==='notebook'?' primary':''), type:'button', 'data-theme':'notebook'},['Warm Notebook']),
        UI.h('button',{class:'btn small'+(theme==='dark'?' primary':''), type:'button', 'data-theme':'dark'},['Dark'])
      ])
    ]);

    // Security
    const sec = await Store.getSetting('security') || {enabled:false, autoLock:'refresh'};
    const secCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Protect this notebook']),
      UI.h('div',{class:'small'},['Adds a local lock. If you forget it, the data cannot be recovered.']),
      UI.h('label',{class:'small', style:'display:flex;gap:10px;align-items:center;margin-top:10px'},[
        UI.h('input',{type:'checkbox', id:'sec-enabled'}),
        UI.h('span',{},['Use a passphrase'])
      ]),
      UI.h('div',{id:'sec-area', style:'margin-top:10px;display:none;'},[])
    ]);

    // Reminders guide (local-only)
    const remCard = UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Phone reminders']),
      UI.h('div',{class:'small'},['Best privacy. Set these in your phone’s Reminders/Alarm.']),
      UI.h('div',{class:'hr'},[]),
      UI.h('div',{class:'small'},['Check-in: 10:30 / 15:30 / 20:30']),
      UI.h('div',{class:'small'},['Sleep: reminder at 00:30 (gentle nudge)'])
    ]);

    stack.appendChild(themeCard);
    stack.appendChild(secCard);
    stack.appendChild(remCard);
    mount.appendChild(stack);

    // Theme interactions
    themeCard.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-theme]');
      if(!btn) return;
      const t = btn.dataset.theme;
      await Security.setTheme(t);
      themeCard.querySelectorAll('[data-theme]').forEach(b=>{
        b.classList.toggle('primary', b.dataset.theme === t);
      });
      UI.toast('Theme updated.');
    });

    // Security UI
    const enabledBox = document.getElementById('sec-enabled');
    const area = document.getElementById('sec-area');
    enabledBox.checked = !!sec.enabled;

    function renderSecArea(){
      area.innerHTML = '';
      if(!enabledBox.checked){
        area.style.display = 'none';
        return;
      }
      area.style.display = 'block';

      // Auto-lock
      area.appendChild(UI.h('div',{class:'small'},['Auto-lock']));
      const row = UI.h('div',{class:'row', style:'margin-top:6px'},[
        UI.h('button',{class:'btn small', type:'button', 'data-autolock':'refresh'},['On refresh']),
        UI.h('button',{class:'btn small', type:'button', 'data-autolock':'5m'},['After 5 min']),
        UI.h('button',{class:'btn small', type:'button', 'data-autolock':'30m'},['After 30 min'])
      ]);
      area.appendChild(row);

      const mode = sec.autoLock || 'refresh';
      row.querySelectorAll('[data-autolock]').forEach(b=>{
        b.classList.toggle('primary', b.dataset.autolock === mode);
      });

      // Change passphrase
      area.appendChild(UI.h('div',{class:'hr'},[]));
      area.appendChild(UI.h('div',{class:'small'},['Change passphrase']));
      area.appendChild(UI.h('button',{class:'btn', type:'button', id:'btn-chpass'},['Change']));

      // Lock now
      area.appendChild(UI.h('div',{class:'hr'},[]));
      area.appendChild(UI.h('button',{class:'btn', type:'button', id:'btn-locknow'},['Lock now']));

      // Disable
      area.appendChild(UI.h('div',{class:'hr'},[]));
      area.appendChild(UI.h('button',{class:'btn', type:'button', id:'btn-disable'},['Disable passphrase']));
    }

    renderSecArea();

    enabledBox.addEventListener('change', async ()=>{
      if(enabledBox.checked){
        const pass = prompt('Set a passphrase (a sentence you can remember):');
        if(!pass || pass.trim().length < 4){
          UI.toast('Passphrase not set.');
          enabledBox.checked = false;
          renderSecArea();
          return;
        }
        const auto = sec.autoLock || 'refresh';
        try{
          await Security.enable(pass.trim(), auto);
          sec.enabled = true;
          UI.toast('Passphrase enabled.');
        }catch(e){
          console.error(e);
          UI.toast('Could not enable passphrase.');
          enabledBox.checked = false;
        }
      } else {
        const pass = prompt('Enter your passphrase to disable:');
        if(!pass){
          enabledBox.checked = true;
          renderSecArea();
          return;
        }
        try{
          await Security.disable(pass.trim());
          sec.enabled = false;
          UI.toast('Passphrase disabled.');
        }catch(e){
          console.error(e);
          UI.toast('Wrong passphrase.');
          enabledBox.checked = true;
        }
      }
      const s = await Store.getSetting('security') || {enabled:false, autoLock:'refresh'};
      sec.enabled = !!s.enabled;
      sec.autoLock = s.autoLock || 'refresh';
      renderSecArea();
    });

    secCard.addEventListener('click', async (e)=>{
      const btn = e.target.closest('[data-autolock]');
      if(btn){
        const mode = btn.dataset.autolock;
        sec.autoLock = mode;
        await Security.setAutoLock(mode);
        area.querySelectorAll('[data-autolock]').forEach(b=>{
          b.classList.toggle('primary', b.dataset.autolock === mode);
        });
        UI.toast('Auto-lock updated.');
      }

      if(e.target && e.target.id === 'btn-locknow'){
        Security.lock();
      }
      if(e.target && e.target.id === 'btn-disable'){
        const pass = prompt('Enter your passphrase to disable:');
        if(!pass) return;
        try{
          await Security.disable(pass.trim());
          enabledBox.checked = false;
          sec.enabled = false;
          UI.toast('Passphrase disabled.');
          renderSecArea();
        }catch(err){
          UI.toast('Wrong passphrase.');
        }
      }
      if(e.target && e.target.id === 'btn-chpass'){
        const oldp = prompt('Old passphrase:');
        if(!oldp) return;
        const newp = prompt('New passphrase:');
        if(!newp || newp.trim().length < 4) return;
        try{
          await Security.changePassphrase(oldp.trim(), newp.trim());
          UI.toast('Passphrase updated.');
        }catch(err){
          console.error(err);
          UI.toast('Could not update passphrase.');
        }
      }
    });
  });
})();
