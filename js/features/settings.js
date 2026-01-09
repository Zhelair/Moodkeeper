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

    // Support (Phase 1 — no payments yet)
    function openSupportModal(){
      const modal = UI.h('div',{class:'modal open', role:'dialog','aria-modal':'true'},[]);
      const card = UI.h('div',{class:'modal-card'},[]);
      const head = UI.h('div',{class:'modal-head'},[
        UI.h('div',{class:'h2'},['Support Moodkeeper']),
        UI.h('button',{class:'icon-btn', type:'button', 'aria-label':'Close', title:'Close', onClick:()=> modal.remove()},['✕'])
      ]);

      const body = UI.h('div',{class:'stack modal-body-scroll'},[]);

      function section(id, title, lines){
        return UI.h('div',{id, class:'stack', style:'gap:6px'},[
          UI.h('div',{class:'h2'},[title]),
          ...lines.map(t=> UI.h('div',{class:'small'},[t]))
        ]);
      }

      // Main support copy
      body.appendChild(section('about','About Moodkeeper',[
        'Moodkeeper is a calm, private space for noticing how life feels — without pressure, judgment, or optimization.',
        'It’s designed to support reflection, not performance.'
      ]));
      body.appendChild(UI.h('div',{class:'hr'},[]));

      body.appendChild(section('privacy','Independence & Privacy',[
        'Moodkeeper is built to stay calm, private, and independent.',
        'There are no ads, no data sales, and no tracking beyond what stays on your device.',
        'Support from users helps keep the project sustainable without compromising these principles.'
      ]));
      body.appendChild(UI.h('div',{class:'hr'},[]));

      body.appendChild(section('supporting','Supporting the project',[
        'If you choose to support the project, you unlock deeper reflections and pattern awareness — while everything essential remains free.',
        'Supporting Moodkeeper is not a service contract.',
        'It’s a way to support the project and unlock deeper insights as it evolves.',
        'Support is optional. You can stop anytime.'
      ]));
      body.appendChild(UI.h('div',{class:'hr'},[]));

      body.appendChild(section('faq','FAQ',[
        'Is Moodkeeper free?  Yes. All core features remain free.',
        'What do I get by supporting?  Deeper insights, longer-term reflections, and additional Companion options.',
        'Can I stop supporting?  Yes — anytime.',
        'Is my data safe?  Yes. Your data stays on your device.'
      ]));
      body.appendChild(UI.h('div',{class:'hr'},[]));

       const actions = UI.h('div',{class:'row modal-foot', style:'justify-content:flex-end;gap:10px;margin-top:10px'},[
        UI.h('button',{class:'btn ghost', type:'button', onClick:()=> modal.remove()},['Not now']),
        UI.h('button',{class:'btn primary support-primary', type:'button', id:'btn-support-project'},['Support the project'])
      ]);

      function showThanks(){
        // Keep it simple for Phase 1: flow test only
        UI.toast('Thank you for considering supporting the project.');
      }

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(actions);
      modal.appendChild(card);

      // Clicking outside closes
      modal.addEventListener('click',(e)=>{ if(e.target===modal) modal.remove(); });

      // Support action
      actions.addEventListener('click',(e)=>{
        const b = e.target.closest('#btn-support-project');
        if(!b) return;
        showThanks();
      });

      document.body.appendChild(modal);
    }

    const supportCard = UI.h('div',{class:'card soft support-card', style:'cursor:pointer'},[
      UI.h('div',{class:'h2'},['Support Moodkeeper']),
      UI.h('div',{class:'small'},['Help keep the project independent and ad-free.'])
    ]);
    supportCard.addEventListener('click', openSupportModal);
    stack.appendChild(supportCard);

    // Theme + Rest mode
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
      UI.h('div',{class:'small muted'},["When enabled, Moodkeeper’s visuals stay quiet. No prompts. Just presence."])
    ]);

// Companion
const companionEnabled = !!(await Store.getSetting('companion_enabled'));
const onlineAIEnabled = !!(await Store.getSetting('online_ai_enabled'));
const voice = (await Store.getSetting('companion_voice')) || 'gentle';

const statusEl = UI.h('div',{class:'pill', id:'companion-status'},['']);
const updateStatus = async ()=>{
  const ce = !!(await Store.getSetting('companion_enabled'));
  const oa = !!(await Store.getSetting('online_ai_enabled'));
  statusEl.textContent = ce ? (oa ? 'On · Online AI' : 'On · Offline (templates)') : 'Off';
};
await updateStatus();

const companionToggle = UI.h('input',{type:'checkbox', id:'companion-toggle'});
companionToggle.checked = companionEnabled;

const voiceSel = UI.h('select',{id:'companion-voice'},[
  UI.h('option',{value:'gentle'},['Gentle']),
  UI.h('option',{value:'supportive'},['Supportive']),
  UI.h('option',{value:'direct'},['Direct'])
]);
voiceSel.value = (voice === 'clear') ? 'direct' : voice;

const onlineStatus = UI.h('div',{class:'small muted', id:'onlineai-status'},['']);
const updateOnlineStatus = async ()=>{
  const oa = !!(await Store.getSetting('online_ai_enabled'));
  onlineStatus.textContent = 'Online AI: ' + (oa ? 'On' : 'Off');
};
await updateOnlineStatus();

const btnEnableAI = UI.h('button',{class:'btn small', type:'button', id:'btn-enable-online-ai'},['Enable Online AI…']);
const btnDisableAI = UI.h('button',{class:'btn small ghost', type:'button', id:'btn-disable-online-ai'},['Disable Online AI']);
const updateAIButtons = async ()=>{
  const oa = !!(await Store.getSetting('online_ai_enabled'));
  btnDisableAI.style.display = oa ? '' : 'none';
};
await updateAIButtons();

function openOnlineAIConsent(){
  return new Promise((resolve)=>{
    const modal = UI.h('div',{class:'modal open', role:'dialog','aria-modal':'true'},[]);
    const card = UI.h('div',{class:'modal-card'},[]);
    const head = UI.h('div',{class:'modal-head'},[
      UI.h('div',{class:'h2'},['Enable Online AI?']),
      UI.h('button',{class:'icon-btn', type:'button', 'aria-label':'Close', title:'Close', onClick:()=>{ modal.remove(); resolve(false); }},['✕'])
    ]);
    const body = UI.h('div',{class:'stack'},[
      UI.h('div',{class:'p'},['If you enable Online AI, some Companion messages may be generated by an online AI service. This can improve reflections and future features, but it means the text you type may be sent over the internet.']),
      UI.h('div',{class:'small muted'},['What is sent: the text you enter in Companion + selected voice.']),
      UI.h('div',{class:'small muted'},['What is not sent: your history (unless you paste it), your passphrase/lock data, or anything from other screens.']),
      UI.h('div',{class:'small muted'},['You can disable Online AI anytime in Settings.'])
    ]);
    const actions = UI.h('div',{class:'row modal-foot', style:'justify-content:flex-end;gap:10px;margin-top:10px'},[
      UI.h('button',{class:'btn ghost', type:'button', onClick:()=>{ modal.remove(); resolve(false); }},['Cancel']),
      UI.h('button',{class:'btn primary', type:'button', onClick:()=>{ modal.remove(); resolve(true); }},['I agree — Enable Online AI'])
    ]);
    card.appendChild(head); card.appendChild(body); card.appendChild(actions);
    modal.appendChild(card);
    modal.addEventListener('click',(e)=>{ if(e.target===modal){ modal.remove(); resolve(false); }});
    document.body.appendChild(modal);
  });
}

const companionCard = UI.h('div',{class:'card'},[
  UI.h('div',{class:'h2', style:'display:flex;align-items:center;gap:10px;'},[
    UI.h('span',{},['Companion']),
    statusEl
  ]),
  UI.h('div',{class:'small'},['Optional support across the app. Works offline with templates, or online with AI (with consent).']),
  UI.h('div',{class:'toggle-row'},[
    UI.h('label',{class:'small', style:'display:flex;align-items:center;gap:10px;'},[
      companionToggle,
      UI.h('span',{},['Enable Companion'])
    ])
  ]),
  UI.h('div',{class:'toggle-row'},[
    UI.h('div',{class:'small', style:'min-width:120px;'},['Voice']),
    voiceSel,
    UI.h('div',{class:'small muted', style:'margin-left:auto;'},['Short, practical replies'])
  ]),
  UI.h('div',{class:'toggle-row', style:'flex-direction:column;align-items:stretch;gap:8px;'},[
    onlineStatus,
    UI.h('div',{class:'row', style:'gap:10px;'},[
      btnEnableAI,
      btnDisableAI
    ]),
    UI.h('div',{class:'small muted'},['Online AI may send your Companion text to an AI service. You will be asked to agree first.'])
  ])
]);

stack.appendChild(companionCard);

companionToggle.addEventListener('change', async ()=>{
  const on = !!companionToggle.checked;
  await Store.setSetting('companion_enabled', on);
  if(!on){
    await Store.setSetting('online_ai_enabled', false);
    try{ if(window.TrackboardUI && TrackboardUI.destroyCompanion) TrackboardUI.destroyCompanion(); }catch(e){}
  }else{
    // Initialize
    try{ if(window.TrackboardUI && TrackboardUI.setTalkVoice) TrackboardUI.setTalkVoice(voiceSel.value); }catch(e){}
    try{ if(window.TrackboardUI && TrackboardUI.initCompanion) TrackboardUI.initCompanion(); }catch(e){}
  }
  await updateStatus();
  await updateOnlineStatus();
  await updateAIButtons();
});

voiceSel.addEventListener('change', async ()=>{
  const v = voiceSel.value;
  await Store.setSetting('companion_voice', v);
  try{ if(window.TrackboardUI && TrackboardUI.setTalkVoice) TrackboardUI.setTalkVoice(v); }catch(e){}
  UI.toast('Voice updated.');
});

btnEnableAI.addEventListener('click', async ()=>{
  const ce = !!(await Store.getSetting('companion_enabled'));
  if(!ce){
    UI.toast('Enable Companion first.');
    return;
  }
  const ok = await openOnlineAIConsent();
  await Store.setSetting('online_ai_enabled', !!ok);
  await updateStatus();
  await updateOnlineStatus();
  await updateAIButtons();
  if(ok) UI.toast('Online AI enabled.');
});

btnDisableAI.addEventListener('click', async ()=>{
  await Store.setSetting('online_ai_enabled', false);
  await updateStatus();
  await updateOnlineStatus();
  await updateAIButtons();
  UI.toast('Online AI disabled.');
});

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

    // Rest mode interactions (quiet visuals)
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
