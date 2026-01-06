
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
      else if(k.startsWith('on') && typeof v === 'function') {
        // Allow both onclick and onClick style keys.
        const evt = k.slice(2).toLowerCase();
        el.addEventListener(evt, v);
      }
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

  

  function getActiveISO(){
    return activeISO();
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

  
  // Calm Space: full-screen, minimal, no timers, no rewards.
  function openCalmSpace(text){
    return new Promise((resolve)=>{
      const existing = document.getElementById('calm-space');
      if(existing) existing.remove();

      const overlay = h('div',{class:'calmspace', id:'calm-space', role:'dialog', 'aria-modal':'true'},[]);
      const bg = h('div',{class:'calmspace-bg', 'aria-hidden':'true'},[]);
      const msg = h('div',{class:'calmspace-msg'},[String(text || '').trim() || 'Take a breath.']);
      const exit = h('button',{class:'calmspace-exit', type:'button'},['Exit']);

      overlay.appendChild(bg);
      overlay.appendChild(msg);
      overlay.appendChild(exit);

      // Prevent background scroll
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      let controlsShown = false;
      function showControls(){
        if(controlsShown) return;
        controlsShown = true;
        overlay.classList.add('show-controls');
      }
      function close(){
        document.body.style.overflow = prevOverflow;
        overlay.classList.remove('open');
        window.setTimeout(()=>{
          overlay.remove();
          resolve();
        }, 180);
      }

      exit.addEventListener('click', (e)=>{
        e.stopPropagation();
        close();
      });

      overlay.addEventListener('click', ()=>{
        // First tap reveals the exit control. Subsequent taps keep it visible.
        showControls();
      });

      function onKey(e){
        if(e.key === 'Escape'){
          e.preventDefault();
          close();
        }
      }
      document.addEventListener('keydown', onKey, { once:false });

      const cleanup = ()=>{
        document.removeEventListener('keydown', onKey);
      };

      // Ensure cleanup on close
      const origClose = close;
      close = ()=>{
        cleanup();
        origClose();
      };

      document.body.appendChild(overlay);
      // Fade in
      requestAnimationFrame(()=> overlay.classList.add('open'));
    });
  }


  // --- Companion (Phase C - Sprint 3 Step 1) ---
  let _talkDrawer = null;
  let _companionBtn = null;
  let _talkTextEl = null;
  let _talkDraft = '';
  let _talkReplyEl = null;
  let _talkVoice = (localStorage.getItem('mk_voice') || 'gentle');
  let _talkLast = null; // { kind, text, voice, ts }





function setTalkVoice(v){
  _talkVoice = (v === 'supportive' || v === 'clear') ? v : 'gentle';
  try{ localStorage.setItem('mk_voice', _talkVoice); }catch(e){}
}

function getTalkVoiceLabel(v){
  if(v === 'clear') return 'Clear';
  if(v === 'supportive') return 'Supportive';
  return 'Gentle';
}

function renderTalkReply(){
  if(!_talkReplyEl) return;
  if(!_talkLast){
    _talkReplyEl.innerHTML = '';
    _talkReplyEl.style.display = 'none';
    return;
  }
  _talkReplyEl.style.display = '';
  const kindLabel = _talkLast.kind === 'mirror' ? 'Mirror' : (_talkLast.kind === 'perspective' ? 'Gentle perspective' : (_talkLast.kind === 'weekly' ? 'Weekly insight' : 'Note'));
  const voiceLabel = getTalkVoiceLabel(_talkLast.voice);
  _talkReplyEl.innerHTML = '';
  _talkReplyEl.appendChild(h('div', { class:'talkreply-meta muted' }, [kindLabel + ' · ' + voiceLabel]));
  _talkReplyEl.appendChild(h('div', { class:'talkreply-text' }, [_talkLast.text]));
}

function classifyTone(raw){
  const t = (raw||'').toLowerCase();
  const has = (arr)=> arr.some(w=> t.includes(w));
  if(has(['angry','mad','furious','pissed','hate'])) return 'anger';
  if(has(['anxious','anxiety','worried','panic','nervous','scared'])) return 'anxiety';
  if(has(['sad','down','hopeless','empty','cry'])) return 'sadness';
  if(has(['tired','exhausted','burnt','burned','sleepy'])) return 'tired';
  if(has(['overwhelmed','too much','can\'t','cannot','stuck'])) return 'overwhelmed';
  if(has(['meh','whatever','numb','blank'])) return 'flat';
  return 'unclear';
}

// --- Sprint 7.1 helpers (NEW) ---
function _normVoice(v){
  if(!v) return 'gentle';
  if(v === 'clear') return 'direct';
  return v;
}

function classifyPolarity(raw){
  const t = (raw || '').toLowerCase();
  if(!t.trim()) return 'neutral';

  const POS = [
    'good','great','ok','okay','fine','better','calm','relieved','happy','glad','proud','excited',
    'grateful','thankful','content','peace','peaceful','nice','awesome','amazing','love','loved',
    'positive','energized','motivated'
  ];
  const NEG = [
    'bad','sad','down','depressed','anxious','anxiety','panic','stressed','stress','overwhelmed',
    'tired','exhausted','angry','mad','furious','irritated','lonely','hopeless','burnt','burned',
    'scared','afraid','worried','worry','nervous','upset','pain'
  ];

  const hasAny = (arr) => arr.some(w => t.includes(w));
  const hasPos = hasAny(POS);
  const hasNeg = hasAny(NEG);

  const hasMixedCue =
    t.includes(' but ') || t.includes(' though ') || t.includes(' however ') ||
    t.includes(' still ') || t.includes(' yet ');

  if((hasPos && hasNeg) || (hasMixedCue && (hasPos || hasNeg))) return 'mixed';
  if(hasPos && !hasNeg) return 'positive';
  if(hasNeg && !hasPos) return 'negative';
  return 'neutral';
}

// --- existing functions BELOW ---
 
function mockMirror(text){

 const v = _normVoice(_talkVoice);
  const p = classifyPolarity(text);

  if(v === 'direct'){
    if(p === 'positive') return 'You’re feeling good. That’s the main signal here.';
    if(p === 'neutral')  return 'This reads as factual/neutral — not much emotion attached.';
    if(p === 'mixed')    return 'This reads as mixed: some good, some strain.';
    return 'This reads as difficult — stress or heaviness is present.';
  }

  if(v === 'supportive'){
    if(p === 'positive') return 'This reads as genuinely good — lighter, more settled.';
    if(p === 'neutral')  return 'This feels neutral — just reporting what happened.';
    if(p === 'mixed')    return 'This reads as both okay and strained at the same time.';
    return 'This feels heavy. You’re carrying something real here.';
  }

  if(p === 'positive') return 'This reads as good — a lighter kind of day.';
  if(p === 'neutral')  return 'This feels mostly neutral — just what happened, as it is.';
  if(p === 'mixed')    return 'This reads as mixed — some relief, and some tension underneath.';
  return 'This feels heavy — like your system is having a hard day.';
}

function mockPerspective(text){
  const v = _normVoice(_talkVoice);
  const p = classifyPolarity(text);

  if(v === 'direct'){
    if(p === 'positive') return 'Keep it simple: note what helped so you can repeat it.';
    if(p === 'neutral')  return 'No action required. One small reset (water/stretch) is enough.';
    if(p === 'mixed')    return 'Pick one stabilizer: food, water, or a 5-minute pause.';
    return 'Reduce load. Do one small step, then stop.';
  }

  if(v === 'supportive'){
    if(p === 'positive') return 'Nice. If you want, name one thing that helped — small wins matter.';
    if(p === 'neutral')  return 'You don’t have to force meaning here. A small reset is plenty.';
    if(p === 'mixed')    return 'Both can be true. If you want, take one small stabilizing step and breathe.';
    return 'You don’t have to fix everything today. One small, kind step is enough.';
  }

  if(p === 'positive') return 'That’s good to hear. If you want, gently notice what made today easier.';
  if(p === 'neutral')  return 'It’s okay for a day to be neutral. A small pause can be enough.';
  if(p === 'mixed')    return 'Both sides can exist at once. If you want, take one small steadying step.';
  return 'You don’t need to solve this right now. A small pause or one gentle step is enough.';
}

function runMock(kind){
  const t = (_talkDraft||'').trim();

  if(!t || t.length < 4){
    const msg = (kind === 'mirror')
      ? 'There isn’t enough here for me to mirror yet.'
      : 'There isn’t much here to reflect on yet. That’s okay.';
    _talkLast = { kind, text: msg, voice: _talkVoice, ts: Date.now() };
    renderTalkReply();
    return;
  }

  const out = (kind === 'mirror') ? mockMirror(t) : mockPerspective(t);
  _talkLast = { kind, text: out, voice: _talkVoice, ts: Date.now() };
  renderTalkReply();
}
  async function runWeeklyInsight(){
    try{
      if(!window.Store){
        _talkLast = { kind:'weekly', text:'I can’t read your entries yet. Try again in a moment.', voice:_talkVoice, ts:Date.now() };
        renderTalkReply();
        return;
      }
      const iso = (typeof getActiveISO === 'function') ? getActiveISO() : (Store.todayKey ? Store.todayKey() : new Date().toISOString().slice(0,10));
      const bounds = weekBounds(new Date(iso + 'T00:00:00'));
      const weekStartISO = bounds.start.toISOString().slice(0,10);
      const days = await Store.getEntriesForWeek(weekStartISO);

      // Collect signals
      let moodSum = 0, moodN = 0;
      let poorSleepN = 0;
      let alcoholHad = 0, alcoholFree = 0;
      const tagCounts = Object.create(null);

      for(const d of days){
        if(!d) continue;
        if(typeof d.mood === 'number'){
          moodSum += d.mood;
          moodN += 1;
        }
        if(d.poorSleep) poorSleepN += 1;

        if(d.alcohol && typeof d.alcohol === 'object'){
          if(d.alcohol.status === 'had') alcoholHad += 1;
          if(d.alcohol.status === 'free') alcoholFree += 1;
        }

        if(Array.isArray(d.tags)){
          for(const t of d.tags){
            if(!t) continue;
            tagCounts[t] = (tagCounts[t] || 0) + 1;
          }
        }
      }

      // Top tag
      let topTag = null, topTagN = 0;
      for(const [t,n] of Object.entries(tagCounts)){
        if(n > topTagN){ topTag = t; topTagN = n; }
      }

      // Compose (2–4 short sentences, per our rules)
      const lines = [];
      const label = `Week of ${weekStartISO}`;
      // Line 1: mood
      if(moodN >= 2){
        const avg = Math.round((moodSum / moodN) * 10) / 10;
        lines.push(`${label}: average mood ${avg}/5 across ${moodN} check-ins.`);
      }else if(moodN === 1){
        lines.push(`${label}: you logged one mood check-in so far.`);
      }else{
        lines.push(`${label}: not enough check-ins yet to spot a pattern.`);
      }

      // Line 2: alcohol
      if((alcoholHad + alcoholFree) > 0){
        const parts = [];
        if(alcoholFree) parts.push(`${alcoholFree} alcohol-free`);
        if(alcoholHad) parts.push(`${alcoholHad} with alcohol`);
        lines.push(`Alcohol: ${parts.join(', ')} day${(alcoholHad+alcoholFree)===1?'':'s'}.`);
      }

      // Line 3: sleep
      if(poorSleepN > 0){
        lines.push(`Poor sleep was flagged on ${poorSleepN} day${poorSleepN===1?'':'s'}.`);
      }

      // Line 4: tags
      if(topTag && topTagN >= 2){
        lines.push(`Most common theme: “${topTag}” (${topTagN} times).`);
      }

      // Voice tweak: Direct removes softener
      let text = lines.slice(0,4).join(' ');
      if(_talkVoice === 'gentle' && moodN === 0){
        text = text + ' If you want, log a quick check-in — even one word is enough.';
      }
      if(_talkVoice === 'supportive' && moodN >= 2){
        text = text + ' If you want, pick one small action for tomorrow.';
      }
      if(_talkVoice === 'direct' && moodN >= 2){
        // keep it tight, no extra sentence
        text = lines.slice(0,4).join(' ');
      }

      _talkLast = { kind:'weekly', text, voice:_talkVoice, ts:Date.now() };
      renderTalkReply();
    }catch(err){
      console.error(err);
      _talkLast = { kind:'weekly', text:'I couldn’t build a weekly insight right now. Try again.', voice:_talkVoice, ts:Date.now() };
      renderTalkReply();
    }
  }

  function ensureTalkDrawer(){
    if(_talkDrawer) return _talkDrawer;

    const drawer = h('div', { class:'talkdrawer', 'aria-hidden':'true' }, []);
    const inner = h('div', { class:'talkdrawer-inner' }, [
      h('div', { class:'talkdrawer-head' }, [
        h('div', { class:'talkdrawer-title' }, ['Talk']),
        h('button', {
          class:'icon-btn talkdrawer-close',
          type:'button',
          'aria-label':'Close',
          title:'Close',
          onClick:()=> closeTalkPanel()
        }, ['✕'])
      ]),
      h('div', { class:'talkdrawer-body talkpanel' }, [
        h('div', { class:'talkprompt muted' }, ['What\'s on your mind?']),
h('div', { class:'talkmeta' }, [
  h('label', { class:'talkmeta-label muted', for:'talk-voice' }, ['Voice']),
  h('select', { id:'talk-voice', class:'talkmeta-select', onChange:(e)=>{ setTalkVoice(e.target.value); toast('Voice: ' + getTalkVoiceLabel(_talkVoice)); if(_talkLast){ _talkLast.voice=_talkVoice; renderTalkReply(); } } }, [
    h('option', { value:'gentle' }, ['Gentle']),
    h('option', { value:'supportive' }, ['Supportive']),
    h('option', { value:'direct' }, ['Direct'])
  ])
]),
(_talkReplyEl = h('div', { class:'talkreply', style:'display:none' }, [])),
        (_talkTextEl = h('textarea', {
          class:'talktext',
          rows:'6',
          placeholder:'Write here…',
          onInput:(e)=>{ _talkDraft = e.target.value; }
        }, [])),
        h('div', { class:'talkactions' }, [
          h('button', { class:'btn full', type:'button', onClick:async ()=>{
            const t = (_talkDraft||'').trim();
            if(!t){ toast('Nothing to save.'); return; }

            let saved = false;
            try{
              const cb = _talkDrawer && _talkDrawer.querySelector('#talk-save');
              const doSave = cb && cb.checked;
              if(doSave && window.Store){
                const key = (window.TrackboardUI && TrackboardUI.activeISO) ? TrackboardUI.activeISO() : Store.todayKey();
                const existing = await Store.getEntry(key) || { date: key };
                if(!existing.talk) existing.talk = [];
                existing.talk.push({ ts: Date.now(), text: t });
                await Store.putEntry(existing);
                saved = true;
              }
            }catch(e){ saved = false; }

            _talkDraft = '';
            if(_talkTextEl) _talkTextEl.value = '';
            // Reset checkbox for next message
            try{ const cb2 = _talkDrawer && _talkDrawer.querySelector('#talk-save'); if(cb2) cb2.checked = false; }catch(e){}
            toast(saved ? 'Saved.' : 'Done.');
          }}, ['Just write']),
          h('button', { class:'btn ghost full', type:'button', onClick:()=>{
            runMock('mirror');
          }}, ['Mirror this']),
          h('button', { class:'btn ghost full', type:'button', onClick:()=>{
            runMock('perspective');
          }}, ['Gentle perspective']),
          h('button', { class:'btn ghost full', type:'button', onClick:()=>{
            runWeeklyInsight();
          }}, ['What did you notice this week?'])
        ]),
        h('div', { class:'talkfoot muted' }, [
          'No auto-save. Close anytime.'
        ])
      ])
    ]);

    drawer.appendChild(inner);
    document.body.appendChild(drawer);
        // Set voice dropdown default
    try{
      const sel = drawer.querySelector('#talk-voice');
      if(sel) sel.value = _talkVoice;
    }catch(e){}

    _talkDrawer = drawer;
    return drawer;
  }

  function openTalkPanel(){
    const drawer = ensureTalkDrawer();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    // Focus textarea for quick entry
    try{ setTimeout(()=>{ _talkTextEl && _talkTextEl.focus(); }, 60); }catch(e){}
  }

  function closeTalkPanel(){
    if(!_talkDrawer) return;
    _talkDrawer.classList.remove('open');
    _talkDrawer.setAttribute('aria-hidden','true');
  }

  function destroyCompanion(){
    try{ if(_talkDrawer){ _talkDrawer.remove(); } }catch(e){}
    try{ if(_companionBtn){ _companionBtn.remove(); } }catch(e){}
    _talkDrawer = null;
    _talkTextEl = null;
    _talkReplyEl = null;
    _companionBtn = null;
  }

  async function syncCompanionFromSettings(){
    // This must be called after Store is available (app boot).
    if(!window.Store) return;
    const enabled = await Store.getSetting('companion_enabled');
    if(enabled){
      if(!_companionBtn) initCompanion();
    }else{
      // Hide everywhere when disabled
      if(_companionBtn || _talkDrawer) destroyCompanion();
    }
    const voice = await Store.getSetting('companion_voice');
    if(voice){ setTalkVoice(voice); }
  }


  function buildFlowerSVG(){
    // Abstract, non-animal flower: no face, no eyes, no emotional cues.
    return `
      <svg class="companion-flower" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <g fill="currentColor" opacity="0.18">
          <circle cx="32" cy="10" r="7"/>
          <circle cx="48" cy="16" r="7"/>
          <circle cx="54" cy="32" r="7"/>
          <circle cx="48" cy="48" r="7"/>
          <circle cx="32" cy="54" r="7"/>
          <circle cx="16" cy="48" r="7"/>
          <circle cx="10" cy="32" r="7"/>
          <circle cx="16" cy="16" r="7"/>
        </g>
        <circle cx="32" cy="32" r="10" fill="currentColor" opacity="0.12"/>
      </svg>
    `;
  }

  function initCompanion(){
    if(_companionBtn) return;
    const btn = h('button', {
      class:'companion-fab',
      type:'button',
      title:'Talk',
      'aria-label':'Talk',
      onClick:(e)=>{
        e.preventDefault();
        e.stopPropagation();
        openTalkPanel();
      }
    }, []);
    btn.innerHTML = buildFlowerSVG();
    document.body.appendChild(btn);
    _companionBtn = btn;

    // Close on Escape
    window.addEventListener('keydown', (ev)=>{
      if(ev.key === 'Escape') closeTalkPanel();
    });
  }

window.TrackboardUI = {
    toast,
    h,
    fmtDate,
    weekBounds,
    inRange,
    openCalmSpace,
    // Active day helpers
    activeISO,
    getActiveISO,
    setActiveISO,
    resetActiveToToday,
    activeIsPast,
    fmtActive,
    pastDayNoteEl,
    openDatePicker,
    setSubtitle,
    setActiveNav,
    openTimerModal,
    // Companion
    initCompanion,
    openTalkPanel,
    closeTalkPanel,
    setTalkVoice,
    destroyCompanion,
    syncCompanionFromSettings
  };

  window.UI = { toast, h, fmtDate, weekBounds, inRange, openCalmSpace };

})();
