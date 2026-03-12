(function(){
  TrackboardRouter.register('settings', async (mount)=>{
    if(window.TrackboardUI && TrackboardUI.setSubtitle){
      TrackboardUI.setSubtitle('Settings · Private · Stored on this device');
    } else {
      document.getElementById('brand-subtitle').textContent = 'Settings · Private · Stored on this device';
    }

    const stack = UI.h('div',{class:'stack'},[]);

    stack.appendChild(UI.h('div',{class:'card soft'},[
      UI.h('div',{class:'h2'},['Settings']),
      UI.h('div',{class:'small'},['Private by design. No accounts. No servers.'])
    ]));

    // --- Support ---
    function openSupportModal(){
      const modal = UI.h('div',{class:'modal open', role:'dialog','aria-modal':'true'},[]);
      const card = UI.h('div',{class:'modal-card'},[]);
      const head = UI.h('div',{class:'modal-head'},[
        UI.h('div',{class:'h2'},['Support Moodkeeper']),
        UI.h('button',{class:'icon-btn', type:'button', 'aria-label':'Close', onClick:()=> modal.remove()},['✕'])
      ]);
      const body = UI.h('div',{class:'stack modal-body-scroll'},[
        UI.h('div',{class:'h2'},['About Moodkeeper']),
        UI.h('div',{class:'small'},['A calm, private space for noticing how life feels — without pressure, judgment, or optimization.']),
        UI.h('div',{class:'hr'},[]),
        UI.h('div',{class:'h2'},['Independence & Privacy']),
        UI.h('div',{class:'small'},['No ads, no data sales, no tracking beyond what stays on your device.']),
        UI.h('div',{class:'hr'},[]),
        UI.h('div',{class:'small'},['Support from users helps keep the project sustainable without compromising these principles.'])
      ]);
      const actions = UI.h('div',{class:'row modal-foot', style:'justify-content:flex-end;gap:10px;margin-top:10px'},[
        UI.h('button',{class:'btn ghost', type:'button', onClick:()=> modal.remove()},['Not now']),
        UI.h('button',{class:'btn primary', type:'button', onClick:()=>{ UI.toast('Thank you for considering supporting the project.'); }},['Support the project'])
      ]);
      card.appendChild(head); card.appendChild(body); card.appendChild(actions);
      modal.appendChild(card);
      modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.remove(); });
      document.body.appendChild(modal);
    }

    const supportCard = UI.h('div',{class:'card soft support-card', style:'cursor:pointer'},[
      UI.h('div',{class:'h2'},['Support Moodkeeper']),
      UI.h('div',{class:'small'},['Help keep the project independent and ad-free.'])
    ]);
    supportCard.addEventListener('click', openSupportModal);
    stack.appendChild(supportCard);

    // --- Theme + Rest mode ---
    const theme = await Store.getSetting('theme') || 'morning';
    const restMode = !!(await Store.getSetting('rest_mode'));
    const themeCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Theme']),
      UI.h('div',{class:'small'},['Choose the atmosphere.']),
      UI.h('div',{class:'row', style:'margin-top:8px'},[
        UI.h('button',{class:'btn small'+(theme==='morning'?' primary':''), type:'button', 'data-theme':'morning'},['Calm Morning']),
        UI.h('button',{class:'btn small'+(theme==='notebook'?' primary':''), type:'button', 'data-theme':'notebook'},['Warm Notebook']),
        UI.h('button',{class:'btn small'+(theme==='dark'?' primary':''), type:'button', 'data-theme':'dark'},['Dark'])
      ]),
      UI.h('div',{style:'height:10px'}),
      UI.h('div',{class:'toggle-row'},[
        UI.h('div',{class:'small'},['Rest']),
        UI.h('div',{class:'pill'},[ restMode ? '🌙' : '☀️' ]),
        UI.h('div',{style:'margin-left:auto; display:flex; gap:8px'},[
          UI.h('button',{class:'btn tiny'+(!restMode?' primary':''), type:'button', id:'rest-off'},['☀️']),
          UI.h('button',{class:'btn tiny'+(restMode?' primary':''), type:'button', id:'rest-on'},['🌙'])
        ])
      ]),
      UI.h('div',{class:'small muted'},["When enabled, visuals stay quiet. No prompts. Just presence."])
    ]);

    // --- Companion + AI ---
    const companionEnabled = !!(await Store.getSetting('companion_enabled'));
    const aiProvider = (await Store.getSetting('ai_provider')) || 'deepseek';
    const aiKey = (await Store.getSetting('ai_api_key')) || '';
    const companionVoice = (await Store.getSetting('companion_voice')) || 'gentle';

    // Status pill
    const aiStatusEl = UI.h('div',{class:'pill', id:'companion-status'},[]);
    async function updateAIStatus(){
      const ce = !!(await Store.getSetting('companion_enabled'));
      const key = await Store.getSetting('ai_api_key');
      const hasAI = !!(key && String(key).trim().length > 10);
      aiStatusEl.textContent = ce ? (hasAI ? 'On · AI ready' : 'On · Offline') : 'Off';
    }
    await updateAIStatus();

    const companionToggle = UI.h('input',{type:'checkbox', id:'companion-toggle'});
    companionToggle.checked = companionEnabled;

    const voiceSel = UI.h('select',{id:'companion-voice'},[
      UI.h('option',{value:'gentle'},['Gentle']),
      UI.h('option',{value:'supportive'},['Supportive']),
      UI.h('option',{value:'direct'},['Direct'])
    ]);
    voiceSel.value = companionVoice;

    // Provider dropdown
    const providerSel = UI.h('select',{id:'ai-provider'},[
      UI.h('option',{value:'deepseek'},['DeepSeek (recommended — cheapest)']),
      UI.h('option',{value:'openai'},['OpenAI (GPT-4o mini)']),
      UI.h('option',{value:'anthropic'},['Claude (Anthropic)'])
    ]);
    providerSel.value = aiProvider;

    // API key input
    const apiKeyInput = UI.h('input',{
      type:'password',
      class:'input',
      id:'ai-api-key',
      placeholder:'Paste your API key here…',
      style:'font-family:monospace;font-size:13px;'
    },[]);
    apiKeyInput.value = aiKey ? ('•'.repeat(Math.min(aiKey.length, 24))) : '';
    let _keyEditing = false;

    const showKeyBtn = UI.h('button',{class:'btn tiny', type:'button', id:'ai-show-key'},['Show']);
    const saveKeyBtn = UI.h('button',{class:'btn primary tiny', type:'button', id:'ai-save-key'},['Save']);
    const clearKeyBtn = UI.h('button',{class:'btn ghost tiny', type:'button', id:'ai-clear-key', style: aiKey ? '' : 'display:none'},['Clear']);

    const keyStatusEl = UI.h('div',{class:'small muted', id:'ai-key-status'},[
      aiKey ? 'API key saved.' : 'No key set — Companion uses offline templates.'
    ]);

    const testBtn = UI.h('button',{class:'btn small', type:'button', id:'ai-test-btn'},['Test connection']);

    // Provider links for getting keys
    const providerLinks = {
      deepseek: 'https://platform.deepseek.com/api_keys',
      openai: 'https://platform.openai.com/api-keys',
      anthropic: 'https://console.anthropic.com/settings/keys'
    };
    const getKeyLink = UI.h('a',{
      href: providerLinks[aiProvider] || '#',
      target:'_blank',
      rel:'noopener noreferrer',
      class:'small',
      id:'ai-get-key-link',
      style:'display:block;margin-top:4px;'
    },['Get an API key →']);

    const companionCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2', style:'display:flex;align-items:center;gap:10px;'},[
        UI.h('span',{},['Companion']),
        aiStatusEl
      ]),
      UI.h('div',{class:'small'},['Optional AI companion. Works offline with templates, or online with your own AI key.']),
      UI.h('div',{class:'toggle-row'},[
        UI.h('label',{class:'small', style:'display:flex;align-items:center;gap:10px;'},[
          companionToggle,
          UI.h('span',{},['Enable Companion'])
        ])
      ]),
      UI.h('div',{class:'toggle-row'},[
        UI.h('div',{class:'small', style:'min-width:80px;'},['Voice']),
        voiceSel
      ]),
      UI.h('div',{class:'hr'},[]),
      UI.h('div',{class:'h2'},['Your AI key']),
      UI.h('div',{class:'small muted'},['Your key is stored only on this device. It never leaves your browser except to call the AI provider directly.']),
      UI.h('div',{class:'toggle-row', style:'margin-top:8px;'},[
        UI.h('div',{class:'small', style:'min-width:80px;'},['Provider']),
        providerSel,
        getKeyLink
      ]),
      UI.h('div',{class:'row', style:'margin-top:8px;gap:6px;flex-wrap:wrap;'},[
        apiKeyInput,
        showKeyBtn
      ]),
      UI.h('div',{class:'row', style:'margin-top:6px;gap:6px;'},[
        saveKeyBtn,
        clearKeyBtn,
        testBtn
      ]),
      keyStatusEl
    ]);

    stack.appendChild(companionCard);

    // Companion toggle
    companionToggle.addEventListener('change', async ()=>{
      const on = !!companionToggle.checked;
      await Store.setSetting('companion_enabled', on);
      if(!on){
        try{ if(window.TrackboardUI && TrackboardUI.destroyCompanion) TrackboardUI.destroyCompanion(); }catch(e){}
      }else{
        try{ if(window.TrackboardUI && TrackboardUI.setTalkVoice) TrackboardUI.setTalkVoice(voiceSel.value); }catch(e){}
        try{ if(window.TrackboardUI && TrackboardUI.initCompanion) TrackboardUI.initCompanion(); }catch(e){}
      }
      await updateAIStatus();
    });

    voiceSel.addEventListener('change', async ()=>{
      await Store.setSetting('companion_voice', voiceSel.value);
      try{ if(window.TrackboardUI && TrackboardUI.setTalkVoice) TrackboardUI.setTalkVoice(voiceSel.value); }catch(e){}
      UI.toast('Voice updated.');
    });

    providerSel.addEventListener('change', async ()=>{
      await Store.setSetting('ai_provider', providerSel.value);
      getKeyLink.href = providerLinks[providerSel.value] || '#';
      UI.toast('Provider updated.');
    });

    showKeyBtn.addEventListener('click', ()=>{
      if(!_keyEditing){
        apiKeyInput.type = 'text';
        // Show actual key if stored
        Store.getSetting('ai_api_key').then(k=>{ apiKeyInput.value = k || ''; });
        showKeyBtn.textContent = 'Hide';
        _keyEditing = true;
      }else{
        apiKeyInput.type = 'password';
        Store.getSetting('ai_api_key').then(k=>{
          apiKeyInput.value = k ? '•'.repeat(Math.min(k.length, 24)) : '';
        });
        showKeyBtn.textContent = 'Show';
        _keyEditing = false;
      }
    });

    saveKeyBtn.addEventListener('click', async ()=>{
      const raw = apiKeyInput.value.trim();
      if(!raw || raw.startsWith('•')){
        UI.toast('No new key to save.');
        return;
      }
      await Store.setSetting('ai_api_key', raw);
      keyStatusEl.textContent = 'API key saved.';
      clearKeyBtn.style.display = '';
      apiKeyInput.type = 'password';
      apiKeyInput.value = '•'.repeat(Math.min(raw.length, 24));
      showKeyBtn.textContent = 'Show';
      _keyEditing = false;
      await updateAIStatus();
      UI.toast('Key saved.');
    });

    clearKeyBtn.addEventListener('click', async ()=>{
      await Store.setSetting('ai_api_key', '');
      apiKeyInput.value = '';
      keyStatusEl.textContent = 'No key set — Companion uses offline templates.';
      clearKeyBtn.style.display = 'none';
      await updateAIStatus();
      UI.toast('Key cleared.');
    });

    testBtn.addEventListener('click', async ()=>{
      const key = await Store.getSetting('ai_api_key');
      if(!key || key.trim().length < 10){
        UI.toast('Save an API key first.');
        return;
      }
      testBtn.textContent = 'Testing…';
      testBtn.disabled = true;
      try{
        const result = await AI.call('Say "ok" and nothing else.', { context: '' });
        keyStatusEl.textContent = 'Connection OK. Response: "' + result.slice(0,60) + '"';
        UI.toast('Connection OK!');
      }catch(err){
        const msg = err.message || String(err);
        keyStatusEl.textContent = 'Error: ' + msg;
        UI.toast('Connection failed. Check key + provider.');
      }finally{
        testBtn.textContent = 'Test connection';
        testBtn.disabled = false;
      }
    });

    // --- Notifications ---
    const notifCard = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h2'},['Reminders']),
      UI.h('div',{class:'small'},['Get a daily nudge to check in. Works best when the app is installed on your home screen.']),
      UI.h('div',{class:'hr'},[]),
    ]);

    const notifStatus = UI.h('div',{class:'small muted', id:'notif-status'},[]);
    const notifEnabled = !!(await Store.getSetting('notif_enabled'));
    const notifTime = (await Store.getSetting('notif_time')) || '20:00';

    async function renderNotifStatus(){
      const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
      const en = !!(await Store.getSetting('notif_enabled'));
      if(perm === 'unsupported') notifStatus.textContent = 'Notifications not supported in this browser.';
      else if(perm === 'denied') notifStatus.textContent = 'Notifications are blocked. Enable them in browser settings.';
      else if(perm === 'granted' && en) notifStatus.textContent = 'Reminders on. Works when the app is open or running in background.';
      else notifStatus.textContent = 'Reminders off.';
    }
    await renderNotifStatus();

    const notifToggle = UI.h('input',{type:'checkbox', id:'notif-toggle'});
    notifToggle.checked = notifEnabled;

    const timeInput = UI.h('input',{
      type:'time',
      class:'input',
      id:'notif-time',
      value: notifTime,
      style:'width:120px;'
    },[]);

    notifCard.appendChild(UI.h('div',{class:'toggle-row'},[
      UI.h('label',{class:'small', style:'display:flex;align-items:center;gap:10px;'},[
        notifToggle,
        UI.h('span',{},['Enable daily reminder'])
      ])
    ]));
    notifCard.appendChild(UI.h('div',{class:'toggle-row'},[
      UI.h('div',{class:'small', style:'min-width:100px;'},['Reminder time']),
      timeInput
    ]));
    notifCard.appendChild(notifStatus);

    notifToggle.addEventListener('change', async ()=>{
      const on = !!notifToggle.checked;
      if(on && 'Notification' in window && Notification.permission !== 'granted'){
        const perm = await Notification.requestPermission();
        if(perm !== 'granted'){
          UI.toast('Permission denied — enable notifications in browser settings.');
          notifToggle.checked = false;
          await renderNotifStatus();
          return;
        }
      }
      await Store.setSetting('notif_enabled', on);
      await renderNotifStatus();
      if(on){
        UI.toast('Reminders on. Open the app daily for them to fire.');
        if(window._scheduleReminder) window._scheduleReminder();
      }else{
        UI.toast('Reminders off.');
        if(window._cancelReminder) window._cancelReminder();
      }
    });

    timeInput.addEventListener('change', async ()=>{
      await Store.setSetting('notif_time', timeInput.value);
      if(window._scheduleReminder) window._scheduleReminder();
      UI.toast('Reminder time saved.');
    });

    stack.appendChild(notifCard);

    // --- Security ---
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

    stack.appendChild(themeCard);
    stack.appendChild(secCard);
    mount.appendChild(stack);

    // --- Theme interactions ---
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

    const restPill = themeCard.querySelector('.pill');
    const restOff = document.getElementById('rest-off');
    const restOn = document.getElementById('rest-on');
    async function setRest(on){
      await Store.setSetting('rest_mode', !!on);
      if(restPill) restPill.textContent = on ? '🌙' : '☀️';
      if(restOff) restOff.classList.toggle('primary', !on);
      if(restOn) restOn.classList.toggle('primary', !!on);
      try{ if(window.TrackboardUI && TrackboardUI.applyRestMode) TrackboardUI.applyRestMode(!!on); }catch(e){}
    }
    if(restOff) restOff.addEventListener('click', ()=> setRest(false));
    if(restOn) restOn.addEventListener('click', ()=> setRest(true));

    // --- Security UI ---
    const enabledBox = document.getElementById('sec-enabled');
    const area = document.getElementById('sec-area');
    enabledBox.checked = !!sec.enabled;

    function renderSecArea(){
      area.innerHTML = '';
      if(!enabledBox.checked){ area.style.display = 'none'; return; }
      area.style.display = 'block';

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

      area.appendChild(UI.h('div',{class:'hr'},[]));
      area.appendChild(UI.h('div',{class:'small'},['Change passphrase']));
      area.appendChild(UI.h('button',{class:'btn', type:'button', id:'btn-chpass'},['Change']));
      area.appendChild(UI.h('div',{class:'hr'},[]));
      area.appendChild(UI.h('button',{class:'btn', type:'button', id:'btn-locknow'},['Lock now']));
      area.appendChild(UI.h('div',{class:'hr'},[]));
      area.appendChild(UI.h('button',{class:'btn', type:'button', id:'btn-disable'},['Disable passphrase']));
    }
    renderSecArea();

    enabledBox.addEventListener('change', async ()=>{
      if(enabledBox.checked){
        const pass = prompt('Set a passphrase (a sentence you can remember):');
        if(!pass || pass.trim().length < 4){
          UI.toast('Passphrase not set.'); enabledBox.checked = false; renderSecArea(); return;
        }
        try{
          await Security.enable(pass.trim(), sec.autoLock || 'refresh');
          sec.enabled = true;
          UI.toast('Passphrase enabled.');
        }catch(e){
          UI.toast('Could not enable passphrase.'); enabledBox.checked = false;
        }
      } else {
        const pass = prompt('Enter your passphrase to disable:');
        if(!pass){ enabledBox.checked = true; renderSecArea(); return; }
        try{
          await Security.disable(pass.trim());
          sec.enabled = false;
          UI.toast('Passphrase disabled.');
        }catch(e){
          UI.toast('Wrong passphrase.'); enabledBox.checked = true;
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
        sec.autoLock = btn.dataset.autolock;
        await Security.setAutoLock(btn.dataset.autolock);
        area.querySelectorAll('[data-autolock]').forEach(b=>{
          b.classList.toggle('primary', b.dataset.autolock === btn.dataset.autolock);
        });
        UI.toast('Auto-lock updated.');
      }
      if(e.target && e.target.id === 'btn-locknow') Security.lock();
      if(e.target && e.target.id === 'btn-disable'){
        const pass = prompt('Enter your passphrase to disable:');
        if(!pass) return;
        try{
          await Security.disable(pass.trim());
          enabledBox.checked = false; sec.enabled = false;
          UI.toast('Passphrase disabled.'); renderSecArea();
        }catch(err){ UI.toast('Wrong passphrase.'); }
      }
      if(e.target && e.target.id === 'btn-chpass'){
        const oldp = prompt('Old passphrase:');
        if(!oldp) return;
        const newp = prompt('New passphrase:');
        if(!newp || newp.trim().length < 4) return;
        try{
          await Security.changePassphrase(oldp.trim(), newp.trim());
          UI.toast('Passphrase updated.');
        }catch(err){ UI.toast('Could not update passphrase.'); }
      }
    });
  });
})();
