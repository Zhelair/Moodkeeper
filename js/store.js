(function(){
  const DB_NAME = 'trackboard';
  const DB_VER = 2;

  const STORES = {
    entries: { keyPath: 'date' },
    weeks: { keyPath: 'weekKey' },
    settings: { keyPath: 'key' },
    vault: { keyPath: 'key' } // encrypted records: entry:YYYY-MM-DD, week:YYYY-Www
  };

  function openDB(){
    return new Promise((resolve, reject)=>{
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = ()=>{
        const db = req.result;
        for(const [name, cfg] of Object.entries(STORES)){
          if(!db.objectStoreNames.contains(name)){
            db.createObjectStore(name, cfg);
          }
        }
      };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> reject(req.error);
    });
  }

  async function withStore(storeName, mode, fn){
    const db = await openDB();
    return new Promise((resolve, reject)=>{
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      let result;
      Promise.resolve(fn(store)).then(r=>{ result = r; }).catch(reject);
      tx.oncomplete = ()=> resolve(result);
      tx.onerror = ()=> reject(tx.error);
      tx.onabort = ()=> reject(tx.error);
    });
  }

  // Settings are always stored in plaintext (so we can know theme + security status).
  function getSetting(key){
    return withStore('settings','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.get(key);
      r.onsuccess = ()=> res(r.result ? r.result.value : null);
      r.onerror = ()=> rej(r.error);
    }));
  }

  function setSetting(key, value){
    return withStore('settings','readwrite', (store)=> new Promise((res, rej)=>{
      const r = store.put({key, value});
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    }));
  }

  // --- Plain data helpers (used when Security disabled) ---
  function _getPlainEntry(date){
    return withStore('entries','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.get(date);
      r.onsuccess = ()=> res(r.result || null);
      r.onerror = ()=> rej(r.error);
    }));
  }
  function _putPlainEntry(entry){
    return withStore('entries','readwrite', (store)=> new Promise((res, rej)=>{
      const r = store.put(entry);
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    }));
  }
  
  function _deletePlainEntry(date){
    return withStore('entries','readwrite', (store)=> new Promise((res, rej)=>{
      const r = store.delete(date);
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    }));
  }

function _getAllPlainEntries(){
    return withStore('entries','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.getAll();
      r.onsuccess = ()=> res(r.result || []);
      r.onerror = ()=> rej(r.error);
    }));
  }

  function _getPlainWeek(weekKey){
    return withStore('weeks','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.get(weekKey);
      r.onsuccess = ()=> res(r.result || null);
      r.onerror = ()=> rej(r.error);
    }));
  }
  function _putPlainWeek(week){
    return withStore('weeks','readwrite', (store)=> new Promise((res, rej)=>{
      const r = store.put(week);
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    }));
  }
  function _getAllPlainWeeks(){
    return withStore('weeks','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.getAll();
      r.onsuccess = ()=> res(r.result || []);
      r.onerror = ()=> rej(r.error);
    }));
  }

  async function _clearPlainData(){
    await withStore('entries','readwrite', store => new Promise((res, rej)=>{
      const r = store.clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error);
    }));
    await withStore('weeks','readwrite', store => new Promise((res, rej)=>{
      const r = store.clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error);
    }));
  }

  // --- Vault helpers (encrypted) ---
  function _putVaultRecord(key, value){
    return withStore('vault','readwrite', (store)=> new Promise((res, rej)=>{
      const r = store.put({key, value});
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    }));
  }
  function _getVaultRecord(key){
    return withStore('vault','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.get(key);
      r.onsuccess = ()=> res(r.result || null);
      r.onerror = ()=> rej(r.error);
    }));
  }
  
  function _deleteVaultRecord(key){
    return withStore('vault','readwrite', (store)=> new Promise((res, rej)=>{
      const r = store.delete(key);
      r.onsuccess = ()=> res(true);
      r.onerror = ()=> rej(r.error);
    }));
  }

function _getAllVaultRecords(prefix){
    return withStore('vault','readonly', (store)=> new Promise((res, rej)=>{
      const r = store.getAll();
      r.onsuccess = ()=> {
        const all = (r.result || []).filter(x => x.key && x.key.startsWith(prefix));
        res(all);
      };
      r.onerror = ()=> rej(r.error);
    }));
  }
  async function _clearVault(){
    await withStore('vault','readwrite', store => new Promise((res, rej)=>{
      const r = store.clear(); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error);
    }));
  }

  // --- Public API with security-aware storage ---
  async function getEntry(date){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) return null;
      const rec = await _getVaultRecord(`entry:${date}`);
      if(!rec) return null;
      return await Security.decrypt(rec.value);
    }
    return _getPlainEntry(date);
  }

  async function putEntry(entry){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) throw new Error('Locked');
      await _putVaultRecord(`entry:${entry.date}`, await Security.encrypt(entry));
      return true;
    }
    return _putPlainEntry(entry);
  }



  async function deleteEntry(date){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) throw new Error('Locked');
      await _deleteVaultRecord(`entry:${date}`);
      return true;
    }
    return _deletePlainEntry(date);
  }

async function getEntriesForWeek(weekStartISO){
  // weekStartISO: YYYY-MM-DD (Monday)
  const out = [];
  const d0 = new Date(weekStartISO + "T00:00:00");
  for(let i=0;i<7;i++){
    const d = new Date(d0);
    d.setDate(d.getDate()+i);
    const iso = d.toISOString().slice(0,10);
    const e = await getEntry(iso);
    if(e) out.push(e);
    else out.push({ date: iso });
  }
  return out;
}

  async function getAllEntries(){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) return [];
      const recs = await _getAllVaultRecords('entry:');
      const out = [];
      for(const r of recs){
        try{ out.push(await Security.decrypt(r.value)); }catch(e){}
      }
      return out;
    }
    return _getAllPlainEntries();
  }

  async function getWeek(weekKey){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) return null;
      const rec = await _getVaultRecord(`week:${weekKey}`);
      if(!rec) return null;
      return await Security.decrypt(rec.value);
    }
    return _getPlainWeek(weekKey);
  }

  async function putWeek(week){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) throw new Error('Locked');
      await _putVaultRecord(`week:${week.weekKey}`, await Security.encrypt(week));
      return true;
    }
    return _putPlainWeek(week);
  }

  async function getAllWeeks(){
    const sec = await getSetting('security');
    if(sec && sec.enabled){
      if(!window.Security || !Security.isUnlocked()) return [];
      const recs = await _getAllVaultRecords('week:');
      const out = [];
      for(const r of recs){
        try{ out.push(await Security.decrypt(r.value)); }catch(e){}
      }
      return out;
    }
    return _getAllPlainWeeks();
  }

  function todayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  window.Store = {
  getEntriesForWeek,

    todayKey,
    getEntry,
    putEntry,
    deleteEntry,
    getAllEntries,
    getWeek,
    putWeek,
    getAllWeeks,
    getSetting,
    setSetting,

    // Internal helpers used by Security migration
    _getAllPlainEntries,
    _getAllPlainWeeks,
    _putPlainEntry,
    _putPlainWeek,
    _clearPlainData,
    _putVaultRecord,
    _getAllVaultRecords,
    _clearVault
  };
})();
