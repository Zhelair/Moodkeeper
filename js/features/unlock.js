(function(){
  TrackboardRouter.register('unlock', async (mount)=>{
    document.getElementById('brand-subtitle').textContent = 'Locked · Local passphrase';

    const wrap = UI.h('div',{class:'lockwrap'},[]);
    const card = UI.h('div',{class:'card'},[
      UI.h('div',{class:'h1'},['Unlock notebook']),
      UI.h('p',{class:'p'},['Enter your passphrase to continue.']),
      UI.h('div',{class:'hr'},[]),
      UI.h('input',{type:'password', id:'unlock-pass', placeholder:'Passphrase'}),
      UI.h('div',{class:'row', style:'margin-top:10px'},[
        UI.h('button',{class:'btn primary', type:'button', id:'unlock-btn'},['Unlock']),
        UI.h('button',{class:'btn', type:'button', id:'unlock-theme'},['Theme'])
      ]),
      UI.h('div',{class:'small', style:'margin-top:10px'},['Reminder: If you forget your passphrase, there is no recovery.'])
    ]);
    wrap.appendChild(card);
    mount.appendChild(wrap);

    const passEl = document.getElementById('unlock-pass');
    passEl.focus();

    document.getElementById('unlock-btn').addEventListener('click', async ()=>{
      const p = passEl.value.trim();
      if(!p) return;
      try{
        await Security.unlock(p);
        UI.toast('Unlocked.');
        TrackboardRouter.go('home');
      }catch(e){
        UI.toast('Wrong passphrase.');
      }
    });

    // Allow switching theme even when locked (cosmetic)
    document.getElementById('unlock-theme').addEventListener('click', async ()=>{
      const cur = (await Store.getSetting('theme')) || 'morning';
      const next = cur === 'morning' ? 'notebook' : cur === 'notebook' ? 'dark' : 'morning';
      await Security.setTheme(next);
      UI.toast('Theme updated.');
    });

    passEl.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') document.getElementById('unlock-btn').click();
    });
  });
})();
