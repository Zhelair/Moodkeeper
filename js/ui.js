
(function(){
  function toast(msg){
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    window.clearTimeout(toast._t);
    toast._t = window.setTimeout(()=> el.classList.remove('show'), 2200);
  }

  function h(tag, attrs={}, children=[]){
    const el = document.createElement(tag);
    for(const [k,v] of Object.entries(attrs||{})){
      if(k === 'class') el.className = v;
      else if(k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if(v === false || v === null || v === undefined) {}
      else el.setAttribute(k, String(v));
    }
    (children||[]).forEach(ch=>{
      if(ch === null || ch === undefined) return;
      if(typeof ch === 'string') el.appendChild(document.createTextNode(ch));
      else el.appendChild(ch);
    });
    return el;
  }


  function fmtDate(d){
    return d.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
  }

  function weekBounds(d=new Date()){
    const date = new Date(d);
    const day = date.getDay(); // 0 Sun ... 6 Sat
    const diffToMon = (day === 0 ? -6 : 1 - day);
    const start = new Date(date);
    start.setDate(date.getDate() + diffToMon);
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }

  function inRange(isoDate, start, end){
    const d = new Date(isoDate + 'T00:00:00');
    return d >= start && d < end;
  }

  
  // --- TrackboardUI compatibility helpers ---
  function todayISO(d=new Date()){
    const x = new Date(d);
    const yyyy = x.getFullYear();
    const mm = String(x.getMonth()+1).padStart(2,'0');
    const dd = String(x.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function setSubtitle(text){
    const el = document.getElementById('brand-subtitle');
    if(el) el.textContent = text;
  }

  function setActiveNav(route){
    document.querySelectorAll('.navbtn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.route === route);
    });
  }

  // Minimal in-app timer (used by Alcohol wait flow). Creates/updates a modal.
  function openTimerModal(seconds, onDone){
    let modal = document.getElementById('tb-timer-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'tb-timer-modal';
      modal.className = 'modal';
      modal.setAttribute('aria-hidden','true');
      modal.innerHTML = `
        <div class="modal-card" style="max-width:520px;">
          <div class="modal-head">
            <h3>Wait</h3>
            <button class="icon-btn" id="tb-timer-close" aria-label="Close">✕</button>
          </div>
          <div id="tb-timer-body" class="mt"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });
      modal.querySelector('#tb-timer-close').addEventListener('click', close);
    }
    const body = modal.querySelector('#tb-timer-body');

    let remaining = seconds;
    let t = null;

    function render(){
      const mm = String(Math.floor(remaining/60)).padStart(2,'0');
      const ss = String(remaining%60).padStart(2,'0');
      const pct = Math.max(0, Math.min(1, remaining/seconds));
      body.innerHTML = `
        <div class="h2" style="margin:0 0 6px 0;">${mm}:${ss}</div>
        <div class="muted">You don’t need to decide yet.</div>
        <div class="mt">
          <div class="meter"><div class="meterfill" style="width:${(pct*100).toFixed(1)}%"></div></div>
        </div>
        <div class="row mt" style="gap:10px;">
          <button class="btn primary" id="tb-timer-ok">I’m okay</button>
          <button class="btn" id="tb-timer-reset">Reset 10 min</button>
        </div>
        <div class="mt small muted">Ending early still counts.</div>
      `;
      body.querySelector('#tb-timer-ok').addEventListener('click', doneEarly);
      body.querySelector('#tb-timer-reset').addEventListener('click', reset);
    }

    function tick(){
      remaining -= 1;
      if(remaining <= 0){
        remaining = 0;
        stop();
        close();
        if(onDone) onDone({completed:true});
        return;
      }
      render();
    }

    function stop(){
      if(t){ window.clearInterval(t); t = null; }
    }
    function reset(){
      remaining = seconds;
      render();
    }
    function doneEarly(){
      stop();
      close();
      if(onDone) onDone({completed:false});
    }
    function open(){
      modal.classList.add('open');
      modal.setAttribute('aria-hidden','false');
    }
    function close(){
      stop();
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
    }

    render();
    open();
    stop();
    t = window.setInterval(tick, 1000);
    return { close };
  }

  window.TrackboardUI = {
    toast,
    h,
    fmtDate,
    weekBounds,
    inRange,
    todayISO,
    setSubtitle,
    setActiveNav,
    openTimerModal
  };

    function escapeHtml(s){
    return String(s)
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  // Generic modal helpers (avoid browser prompt/confirm so language stays English)
  function _ensureGenericModal(){
    let modal = document.getElementById('tb-generic-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'tb-generic-modal';
      modal.className = 'modal';
      modal.setAttribute('aria-hidden','true');
      modal.innerHTML = `
        <div class="modal-card" style="max-width:560px;">
          <div class="modal-head">
            <h3 id="tb-gm-title">Notice</h3>
            <button class="icon-btn" id="tb-gm-close" aria-label="Close">✕</button>
          </div>
          <div id="tb-gm-body" class="mt"></div>
          <div class="row mt" style="gap:10px; justify-content:flex-end;" id="tb-gm-actions"></div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e)=>{ if(e.target===modal) closeGeneric(); });
      modal.querySelector('#tb-gm-close').addEventListener('click', closeGeneric);
      document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && modal.getAttribute('aria-hidden')==='false') closeGeneric(); });
    }
    return modal;
  }

  function closeGeneric(){
    const modal = document.getElementById('tb-generic-modal');
    if(!modal) return;
    modal.setAttribute('aria-hidden','true');
    modal.classList.remove('show');
    // cleanup handlers by replacing actions container
    const actions = modal.querySelector('#tb-gm-actions');
    actions.innerHTML = '';
  }

  function confirmModal({title='Confirm', message='', okText='OK', cancelText='Cancel'}={}){
    return new Promise((resolve)=>{
      const modal = _ensureGenericModal();
      modal.querySelector('#tb-gm-title').textContent = title;
      const body = modal.querySelector('#tb-gm-body');
      body.innerHTML = `<div class="p" style="margin:0;">${escapeHtml(String(message)).replace(/\n/g,'<br>')}</div>`;
      const actions = modal.querySelector('#tb-gm-actions');
      actions.innerHTML = `
        <button class="btn" id="tb-gm-cancel">${escapeHtml(cancelText)}</button>
        <button class="btn primary" id="tb-gm-ok">${escapeHtml(okText)}</button>
      `;
      actions.querySelector('#tb-gm-cancel').addEventListener('click', ()=>{ closeGeneric(); resolve(false); });
      actions.querySelector('#tb-gm-ok').addEventListener('click', ()=>{ closeGeneric(); resolve(true); });

      modal.setAttribute('aria-hidden','false');
      modal.classList.add('show');
    });
  }

  function promptModal({title='Edit', label='Value', value='', placeholder='', okText='Save', cancelText='Cancel'}={}){
    return new Promise((resolve)=>{
      const modal = _ensureGenericModal();
      modal.querySelector('#tb-gm-title').textContent = title;
      const body = modal.querySelector('#tb-gm-body');
      body.innerHTML = `
        <div class="small muted" style="margin-bottom:6px;">${escapeHtml(label)}</div>
        <input id="tb-gm-input" class="input" type="text" value="${escapeHtml(String(value))}" placeholder="${escapeHtml(String(placeholder))}"/>
      `;
      const input = body.querySelector('#tb-gm-input');
      const actions = modal.querySelector('#tb-gm-actions');
      actions.innerHTML = `
        <button class="btn" id="tb-gm-cancel">${escapeHtml(cancelText)}</button>
        <button class="btn primary" id="tb-gm-ok">${escapeHtml(okText)}</button>
      `;
      function done(ok){
        if(!ok){ closeGeneric(); resolve(null); return; }
        const v = (input.value||'').trim();
        closeGeneric();
        resolve(v);
      }
      actions.querySelector('#tb-gm-cancel').addEventListener('click', ()=>done(false));
      actions.querySelector('#tb-gm-ok').addEventListener('click', ()=>done(true));
      input.addEventListener('keydown', (e)=>{ if(e.key==='Enter') done(true); });
      modal.setAttribute('aria-hidden','false');
      modal.classList.add('show');
      setTimeout(()=> input.focus(), 50);
      input.select();
    });
  }

  function calmTextModal(text){
    const modal = _ensureGenericModal();
    modal.querySelector('#tb-gm-title').textContent = 'Take a breath';
    const body = modal.querySelector('#tb-gm-body');
    body.innerHTML = `
      <div class="calm-pop">
        <div class="calm-pop-text">${escapeHtml(String(text))}</div>
        <div class="calm-pop-sub muted">Just read it once. That’s enough.</div>
      </div>
    `;
    const actions = modal.querySelector('#tb-gm-actions');
    actions.innerHTML = `<button class="btn primary" id="tb-gm-ok">OK</button>`;
    actions.querySelector('#tb-gm-ok').addEventListener('click', closeGeneric);

    modal.setAttribute('aria-hidden','false');
    modal.classList.add('show');
    // auto-close after ~6s (gentle). User can close earlier.
    window.clearTimeout(calmTextModal._t);
    calmTextModal._t = window.setTimeout(()=>{ closeGeneric(); }, 6500);
  }

window.UI = { toast, h, fmtDate, weekBounds, inRange, confirmModal, promptModal, calmTextModal, closeGeneric };

})();
