
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

  // --- Active date (Phase A) ---
  // Persist active date locally so accidental refresh doesn't snap you back to today.
  const ACTIVE_KEY = 'tb_activeISO';

  function validISO(v){
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  }

  function clampISO(iso){
    if(!validISO(iso)) return todayISO();
    const t = todayISO();
    if(iso > t) return t;
    return iso;
  }

  function loadActiveISO(){
    try{
      const v = localStorage.getItem(ACTIVE_KEY);
      return clampISO(v);
    }catch(e){
      return todayISO();
    }
  }

  let _activeISO = loadActiveISO();

  function activeISO(){
    return _activeISO;
  }

  function setActiveISO(iso){
    if(!validISO(iso)) return;
    iso = clampISO(iso);
    if(iso === _activeISO) return;
    _activeISO = iso;
    try{ localStorage.setItem(ACTIVE_KEY, _activeISO); }catch(e){}
    window.dispatchEvent(new CustomEvent('tb:activeDate', { detail: { iso } }));
  }

  function resetActiveToToday(){
    // Explicit helper for "go to today" actions.
    // Keeps persistence aligned and triggers re-render via tb:activeDate.
    setActiveISO(todayISO());
  }

  function isPastDay(iso){
    return iso < todayISO();
  }

  function activeIsPast(){
    return isPastDay(_activeISO);
  }

  function fmtActive(){
    return fmtDate(new Date(_activeISO + 'T00:00:00'));
  }

  function pastDayNoteEl(){
    if(!activeIsPast()) return null;
    return h('div', { class: 'small muted', style:'margin-top:6px' }, ["You’re logging for a past day."]);
  }

  function openDatePicker(){
    // Simple modal with native date input.
    let modal = document.getElementById('tb-date-modal');
    if(!modal){
      modal = document.createElement('div');
      modal.id = 'tb-date-modal';
      modal.className = 'modal';
      modal.setAttribute('aria-hidden','true');
      modal.innerHTML = `
        <div class="modal-card" style="max-width:520px;">
          <div class="modal-head">
            <h3>Choose a day</h3>
            <button class="icon-btn" id="tb-date-close" aria-label="Close">✕</button>
          </div>
          <div class="muted">Log the day you mean. No guilt.</div>
          <div class="mt">
            <input class="input" id="tb-date-input" type="date" />
          </div>
          <div class="row mt" style="gap:10px; flex-wrap:wrap;">
            <button class="btn" id="tb-date-today">Today</button>
            <button class="btn" id="tb-date-yest">Yesterday</button>
            <button class="btn primary" id="tb-date-apply">Apply</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e)=>{ if(e.target===modal) close(); });
      modal.querySelector('#tb-date-close').addEventListener('click', close);
    }

    const input = modal.querySelector('#tb-date-input');
    const t = todayISO();
    input.max = t;
    input.value = _activeISO;

    function close(){
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden','true');
    }

    modal.querySelector('#tb-date-today').onclick = ()=>{ input.value = t; };
    modal.querySelector('#tb-date-yest').onclick = ()=>{
      const d = new Date(t + 'T00:00:00');
      d.setDate(d.getDate()-1);
      input.value = todayISO(d);
    };
    modal.querySelector('#tb-date-apply').onclick = ()=>{
      const v = String(input.value || '').trim();
      if(v) setActiveISO(v);
      close();
    };

    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  }

  function buildSubtitleNodes(text){
    // If subtitle follows "Screen · Date · Private · Stored on this device",
    // we render the Date as a clickable chip with a calendar icon.
    // Otherwise, fall back to plain text.
    const suffix = ' · Private · Stored on this device';
    if(typeof text !== 'string' || !text.includes(suffix)){
      return { mode:'plain', nodes:[document.createTextNode(String(text||''))] };
    }
    const head = text.slice(0, text.indexOf(suffix));
    const parts = head.split(' · ');
    if(parts.length < 2){
      return { mode:'plain', nodes:[document.createTextNode(text)] };
    }
    const screen = parts[0];
    const dateText = parts.slice(1).join(' · ');

    const wrap = h('div', { class:'subwrap' }, [
      h('span', { class:'subscreen' }, [screen, ' · ']),
      h('button', {
        class:'subdatebtn',
        type:'button',
        title:'Choose a day',
        onClick:(e)=>{
          e.preventDefault();
          e.stopPropagation();
          if(window.TrackboardUI && TrackboardUI.openDatePicker) TrackboardUI.openDatePicker();
        }
      }, [
        h('span', { class:'subdate' }, [dateText]),
        h('span', { class:'subcal' , 'aria-hidden':'true' }, ['📅'])
      ]),
      h('span', { class:'subrest' }, [suffix])
    ]);

    // Past-day pill (persistent) when active date is not today.
    if(activeIsPast()){
      const pill = h('span', { class:'pastpill' }, [
        h('span', {}, ['Logging: ', fmtActive()]),
        h('button', {
          class:'pilllink',
          type:'button',
          onClick:(e)=>{
            e.preventDefault();
            e.stopPropagation();
            // Some mobile browsers can be flaky with CustomEvent-based re-render.
            // Force a refresh of the current route after resetting.
            resetActiveToToday();
            try{
              const cur = window.TrackboardRouter && TrackboardRouter.current && TrackboardRouter.current();
              if(cur && TrackboardRouter.go) TrackboardRouter.go(cur);
            }catch(_e){}
          }
        }, ['Go to Today'])
      ]);
      wrap.appendChild(pill);
    }

    return { mode:'rich', nodes:[wrap] };
  }

  function setSubtitle(text){
    const el = document.getElementById('brand-subtitle');
    if(!el) return;
    el.innerHTML = '';
    const built = buildSubtitleNodes(text);
    built.nodes.forEach(n=> el.appendChild(n));
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
    activeISO,
    setActiveISO,
    resetActiveToToday,
    activeIsPast,
    fmtActive,
    pastDayNoteEl,
    openDatePicker,
    setSubtitle,
    setActiveNav,
    openTimerModal
  };

  window.UI = { toast, h, fmtDate, weekBounds, inRange };

})();
