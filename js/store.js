/* Store — IndexedDB wrapper */

const DB_NAME = 'trackboard';
const DB_VER = 3;

function openDB(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      const db = req.result;
      if(!db.objectStoreNames.contains('entries')){
        db.createObjectStore('entries');
      }
      if(!db.objectStoreNames.contains('settings')){
        db.createObjectStore('settings');
      }
      if(!db.objectStoreNames.contains('vault')){
        db.createObjectStore('vault');
      }
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}

/* ===== Settings ===== */

async function getSetting(key){
  const db = await openDB();
  return new Promise((resolve)=>{
    const tx = db.transaction(['settings'], 'readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> resolve(null);
  });
}

async function setSetting(key, value){
  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(['settings'], 'readwrite');
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
    tx.objectStore('settings').put(value, key);
  });
}

/* ===== Entries ===== */

async function getEntry(dateISO){
  const db = await openDB();
  return new Promise((resolve)=>{
    const tx = db.transaction(['entries'], 'readonly');
    const req = tx.objectStore('entries').get(dateISO);
    req.onsuccess = ()=> resolve(req.result || null);
    req.onerror = ()=> resolve(null);
  });
}

async function putEntry(dateISO, value){
  const sec = await getSetting('security');
  if(sec && sec.enabled){
    if(!window.Security || !Security.isUnlocked()){
      throw new Error('Locked');
    }
    return _putVaultRecord(`entry:${dateISO}`, value);
  }

  const db = await openDB();
  return new Promise((resolve, reject)=>{
    const tx = db.transaction(['entries'], 'readwrite');
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
    tx.objectStore('entries').put(value, dateISO);
  });
}

/* ===== DELETE ENTRY (SPRINT 3) ===== */

async function deleteEntry(dateISO){
  const sec = await getSetting('security');
  if(sec && sec.enabled){
    if(!window.Security || !Security.isUnlocked()){
      throw new Error('Locked');
    }
    return _deleteVaultRecord(`entry:${dateISO}`);
  }
  return _deletePlainEntry(dateISO);
}

function _deletePlainEntry(dateISO){
  return new Promise(async (resolve, reject)=>{
    const db = await openDB();
    const tx = db.transaction(['entries'], 'readwrite');
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
    tx.objectStore('entries').delete(dateISO);
  });
}

function _deleteVaultRecord(key){
  return new Promise(async (resolve, reject)=>{
    const db = await openDB();
    const tx = db.transaction(['vault'], 'readwrite');
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
    tx.objectStore('vault').delete(key);
  });
}

function _putVaultRecord(key, value){
  return new Promise(async (resolve, reject)=>{
    const db = await openDB();
    const tx = db.transaction(['vault'], 'readwrite');
    tx.oncomplete = ()=> resolve(true);
    tx.onerror = ()=> reject(tx.error);
    tx.objectStore('vault').put(value, key);
  });
}

/* ===== EXPORT ===== */

window.Store = {
  getSetting,
  setSetting,
  getEntry,
  putEntry,
  deleteEntry
};
