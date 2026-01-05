(function(){
  // ------------------------------------------------------------
  // SAFETY STUBS
  // If Service Worker cache or a partial deploy serves stale JS,
  // feature modules may execute before ui.js defines TrackboardUI.
  // This stub prevents hard-crashes and lets saving still work.
  // ui.js will later overwrite these with the full implementation.
  // ------------------------------------------------------------
  if(!window.TrackboardUI){
    const pad = (n)=> String(n).padStart(2,'0');
    const todayISO = ()=>{
      const d = new Date();
      return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    };
    window.TrackboardUI = {
      toast: ()=>{},
      h: (strings, ...vals)=> strings.reduce((acc,s,i)=>acc+s+(vals[i]??''),''),
      todayISO,
      weekBounds: ()=>({start:'', end:''}),
      inRange: ()=>true,
      setSubtitle: ()=>{},
      setActiveNav: ()=>{},
      openTimerModal: ()=>({close:()=>{}})
    };
  }
  if(!window.UI){
    window.UI = { toast: ()=>{}, h: window.TrackboardUI.h };
  }
  // Lightweight local passphrase lock + encryption-at-rest for entries/weeks.
  // Settings remain unencrypted so we can know whether lock is enabled.

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function b64(bytes){
    let bin = '';
    const arr = new Uint8Array(bytes);
    for(let i=0;i<arr.length;i++) bin += String.fromCharCode(arr[i]);
    return btoa(bin);
  }
  function unb64(str){
    const bin = atob(str);
    const arr = new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    return arr.buffer;
  }

  async function deriveKey(passphrase, saltB64, iterations){
    const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16)).buffer;
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      {name:'PBKDF2'},
      false,
      ['deriveKey']
    );
    const key = await crypto.subtle.deriveKey(
      {name:'PBKDF2', salt, iterations, hash:'SHA-256'},
      baseKey,
      {name:'AES-GCM', length:256},
      false,
      ['encrypt','decrypt']
    );
    return { key, saltB64: saltB64 || b64(salt) };
  }

  async function encryptJSON(key, obj){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = enc.encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, data);
    return { iv: b64(iv), ct: b64(ct) };
  }

  async function decryptJSON(key, payload){
    const iv = new Uint8Array(unb64(payload.iv));
    const ct = unb64(payload.ct);
    const pt = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, ct);
    return JSON.parse(dec.decode(pt));
  }

  let enabled = false;
  let unlocked = false;
  let key = null;
  let meta = { iterations: 150000, saltB64: null, autoLock: 'refresh' };
  let lockTimer = null;
  let lastActivity = Date.now();

  function bumpActivity(){
    lastActivity = Date.now();
    scheduleAutolock();
  }

  function scheduleAutolock(){
    if(!enabled || !unlocked) return;
    if(lockTimer) clearTimeout(lockTimer);
    const mode = meta.autoLock || 'refresh';
    if(mode === '5m') lockTimer = setTimeout(()=> Security.lock(), 5*60*1000);
    if(mode === '30m') lockTimer = setTimeout(()=> Security.lock(), 30*60*1000);
  }

  async function loadMeta(){
    const sec = await Store.getSetting('security') || null;
    if(!sec) return;
    enabled = !!sec.enabled;
    meta.iterations = sec.iterations || meta.iterations;
    meta.saltB64 = sec.saltB64 || null;
    meta.autoLock = sec.autoLock || 'refresh';
  }

  async function saveMeta(){
    await Store.setSetting('security', {
      enabled,
      iterations: meta.iterations,
      saltB64: meta.saltB64,
      autoLock: meta.autoLock
    });
  }

  async function migrateToVault(){
    // Encrypt existing plain entries/weeks into vault store, then clear plain stores.
    const entries = await Store._getAllPlainEntries();
    const weeks = await Store._getAllPlainWeeks();
    for(const e of entries){
      await Store._putVaultRecord(`entry:${e.date}`, await encryptJSON(key, e));
    }
    for(const w of weeks){
      await Store._putVaultRecord(`week:${w.weekKey}`, await encryptJSON(key, w));
    }
    await Store._clearPlainData();
  }

  async function migrateToPlain(){
    const entries = await Store._getAllVaultRecords('entry:');
    const weeks = await Store._getAllVaultRecords('week:');
    for(const e of entries){
      const obj = await decryptJSON(key, e.value);
      await Store._putPlainEntry(obj);
    }
    for(const w of weeks){
      const obj = await decryptJSON(key, w.value);
      await Store._putPlainWeek(obj);
    }
    await Store._clearVault();
  }

  window.Security = {
    init: async ()=>{
      await loadMeta();
      // Apply theme early
      const theme = await Store.getSetting('theme') || 'morning';
      document.body.classList.remove('theme-morning','theme-notebook','theme-dark');
      document.body.classList.add(theme === 'dark' ? 'theme-dark' : theme === 'notebook' ? 'theme-notebook' : 'theme-morning');

      // If enabled, start locked.
      if(enabled){
        unlocked = false;
        key = null;
        // autolock on refresh is default by being locked at start
      } else {
        unlocked = true;
      }

      // Activity listeners for autolock
      ['click','keydown','touchstart','mousemove'].forEach(ev=>{
        window.addEventListener(ev, bumpActivity, {passive:true});
      });
    },

    isEnabled: ()=> enabled,
    isUnlocked: ()=> !enabled || unlocked,

    getAutoLock: ()=> meta.autoLock || 'refresh',
    setAutoLock: async (mode)=>{
      meta.autoLock = mode;
      await saveMeta();
      scheduleAutolock();
    },

    setTheme: async (theme)=>{
      await Store.setSetting('theme', theme);
      document.body.classList.remove('theme-morning','theme-notebook','theme-dark');
      document.body.classList.add(theme === 'dark' ? 'theme-dark' : theme === 'notebook' ? 'theme-notebook' : 'theme-morning');
    },

    enable: async (passphrase, autoLock='refresh')=>{
      enabled = true;
      meta.autoLock = autoLock;
      const derived = await deriveKey(passphrase, null, meta.iterations);
      key = derived.key;
      meta.saltB64 = derived.saltB64;
      unlocked = true;
      await saveMeta();
      await migrateToVault();
      scheduleAutolock();
    },

    unlock: async (passphrase)=>{
      await loadMeta();
      if(!enabled) { unlocked = true; return true; }
      const derived = await deriveKey(passphrase, meta.saltB64, meta.iterations);
      key = derived.key;
      unlocked = true;
      scheduleAutolock();
      return true;
    },

    changePassphrase: async (oldPass, newPass)=>{
      if(!enabled) return;
      // Unlock with old, decrypt all, then re-encrypt with new.
      await Security.unlock(oldPass);
      const entries = await Store._getAllVaultRecords('entry:');
      const weeks = await Store._getAllVaultRecords('week:');
      // Decrypt
      const decEntries = [];
      const decWeeks = [];
      for(const e of entries) decEntries.push(await decryptJSON(key, e.value));
      for(const w of weeks) decWeeks.push(await decryptJSON(key, w.value));
      // New key
      const derived = await deriveKey(newPass, null, meta.iterations);
      key = derived.key;
      meta.saltB64 = derived.saltB64;
      await saveMeta();
      // Clear vault and re-encrypt
      await Store._clearVault();
      for(const e of decEntries) await Store._putVaultRecord(`entry:${e.date}`, await encryptJSON(key, e));
      for(const w of decWeeks) await Store._putVaultRecord(`week:${w.weekKey}`, await encryptJSON(key, w));
    },

    disable: async (passphrase)=>{
      if(!enabled) return;
      await Security.unlock(passphrase);
      await migrateToPlain();
      enabled = false;
      unlocked = true;
      key = null;
      meta.saltB64 = null;
      await saveMeta();
    },

    lock: ()=>{
      if(!enabled) return;
      unlocked = false;
      key = null;
      if(lockTimer) clearTimeout(lockTimer);
      lockTimer = null;
      TrackboardRouter.go('unlock');
      UI.toast('Locked.');
    },

    encrypt: async (obj)=> encryptJSON(key, obj),
    decrypt: async (payload)=> decryptJSON(key, payload)
  };
})();
