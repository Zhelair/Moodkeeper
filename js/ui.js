
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
  const kindLabel = _talkLast.kind === 'mirror' ? 'Mirror' : (_talkLast.kind === 'perspective' ? 'Gentle perspective' : 'Note');
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


function _detectFunCommand(text){
  const t = (text||'').trim().toLowerCase();
  // Jokes
  if(/\b(joke|make me laugh|funny)\b/.test(t) || t === 'tell me a joke' || t.startsWith('tell me a joke')){
    return {type:'joke'};
  }
  // Puzzles / mini-games
  if(/\b(puzzle|riddle|brain teaser|minigame|mini game)\b/.test(t) || t.startsWith('give me a puzzle') || t.startsWith('puzzle:')){
    return {type:'puzzle'};
  }
  // Quick math prompt
  if(/^\s*math\s*[:\-]/.test(t) || t.startsWith('give me a math')){
    return {type:'math'};
  }
  return null;
}

function _funResponse(cmd){
  if(!cmd) return null;
  if(cmd.type==='joke'){
    const jokes = [
      "I told my brain we’re having a calm day. It scheduled a crisis meeting anyway.",
      "My mood tracker asked how I feel. I said: 'Loading… 87%'",
      "I tried to outrun my thoughts. They brought snacks and followed me.",
      "Today’s plan: be productive. Reality: be a potato with good intentions.",
      "I asked for inner peace. My mind offered 'inner notifications' instead."
    ];
    return jokes[Math.floor(Math.random()*jokes.length)];
  }
  if(cmd.type==='puzzle'){
    const puzzles = [
      "Puzzle: I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I? (Answer: an echo.)",
      "Puzzle: What has to be broken before you can use it? (Answer: an egg.)",
      "Puzzle: What goes up but never comes down? (Answer: your age.)"
    ];
    return puzzles[Math.floor(Math.random()*puzzles.length)];
  }
  if(cmd.type==='math'){
    return "Mini-game: pick a number from 1–9. Multiply by 9. Add the digits. (You’ll always end up with 9.) Want a harder one?";
  }
  return null;
}

function mockMirror(text){
  const tone = classifyTone(text);
  if(_talkVoice === 'clear'){
    if(tone === 'tired') return 'You sound tired. The message feels low-energy and worn down.';
    if(tone === 'overwhelmed') return 'You sound overwhelmed. There are too many moving parts at once.';
    if(tone === 'anxiety') return 'You sound anxious. There’s a sense of uncertainty and tension.';
    if(tone === 'anger') return 'You sound angry. The frustration comes through clearly.';
    if(tone === 'sadness') return 'You sound down. The tone feels heavy and discouraged.';
    if(tone === 'flat') return 'You sound flat. Not much emotion is coming through.';
    return 'This reads as mixed and a bit tense. There may be more here than you want to name right now.';
  }
  if(_talkVoice === 'supportive'){
    if(tone === 'tired') return 'This sounds like you’re running on fumes. Even naming it is a form of honesty.';
    if(tone === 'overwhelmed') return 'It sounds like a lot is pressing at once. You don’t have to hold it perfectly.';
    if(tone === 'anxiety') return 'There’s worry here — like your mind is scanning for what could go wrong. That’s exhausting.';
    if(tone === 'anger') return 'I hear a real edge of frustration here. Something feels unfair or too much.';
    if(tone === 'sadness') return 'This feels heavy. You’re carrying more than you want to admit.';
    if(tone === 'flat') return 'This feels numb and distant — like you’re watching things from behind glass.';
    return 'I’m hearing tension and a need for space. You may be closer to your truth than it feels.';
  }
  // gentle (default)
  if(tone === 'tired') return 'It sounds like you’re tired — maybe more than you’ve had time to notice.';
  if(tone === 'overwhelmed') return 'It sounds like things are piling up and you’re trying to stay afloat.';
  if(tone === 'anxiety') return 'There’s a worried edge here, like your body is bracing for something.';
  if(tone === 'anger') return 'There’s frustration here — sharp, but understandable.';
  if(tone === 'sadness') return 'This feels heavy, like you’re moving through a thicker kind of day.';
  if(tone === 'flat') return 'This feels muted and “meh” — not bad, not good, just distant.';
  return 'This feels mixed — a bit tense, a bit tired. You may not need to name it perfectly.';
}

function mockPerspective(text){
  if(_talkVoice === 'clear'){
    return 'You don’t need to solve this right now. One small, neutral next step is enough for today.';
  }
  if(_talkVoice === 'supportive'){
    return 'You don’t have to fix yourself in this moment. If all you do is soften the pace a little, that’s already something.';
  }
  return 'You don’t need to resolve this here. It’s okay to take one small, quiet step — or simply pause.';
}

function runMock(kind){
  const t = (_talkDraft||'').trim();
  // Fallbacks: no data / too little text
  if(!t){
    const msg = (kind === 'mirror')
      ? 'There isn’t enough here for me to mirror yet.'
      : 'There isn’t much here to reflect on yet. That’s okay.';
    _talkLast = { kind, text: msg, voice: _talkVoice, ts: Date.now() };
    renderTalkReply();
    return;
  }
  if(t.length < 4){
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
    h('option', { value:'clear' }, ['Clear'])
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
          h('button', { class:'btn full', type:'button', onClick:()=>{
            const t = (_talkDraft||'').trim();
            if(!t){ toast('Nothing to save.'); return; }
            // Default: notes are not stored. This is a deliberate “write and let go” action.
            _talkDraft = '';
            if(_talkTextEl) _talkTextEl.value = '';
            toast('Done.');
          }}, ['Just write']),
          h('button', { class:'btn ghost full', type:'button', onClick:()=>{
            runMock('mirror');
          }}, ['Mirror this']),
          h('button', { class:'btn ghost full', type:'button', onClick:()=>{
            runMock('perspective');
          }}, ['Gentle perspective'])
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
    if(_companionBtn) _companionBtn.classList.add('is-active');
    // Focus textarea for quick entry
    try{ setTimeout(()=>{ _talkTextEl && _talkTextEl.focus(); }, 60); }catch(e){}
  }

  function closeTalkPanel(){
    if(!_talkDrawer) return;
    _talkDrawer.classList.remove('open');
    _talkDrawer.setAttribute('aria-hidden','true');
    if(_companionBtn) _companionBtn.classList.remove('is-active');
  }

  function getThemeKey(){
    return document.body.classList.contains('theme-dark') ? 'dark'
      : (document.body.classList.contains('theme-notebook') ? 'notebook' : 'morning');
  }

  let _companionOnline = false;

  function buildFlowerNode(){
    const theme = getThemeKey();
    // We intentionally keep the same flower image and use CSS to "hype" online mode.
    // Assets: morning/notebook share the light flower; dark uses the dark flower.
    const src = (theme === 'dark') ? 'assets/flower_mode_09.png' : 'assets/flower_mode_01.png';

    const img = UI.h('img', { class:'companion-flower-img', alt:'Talk', src });
    const glow = UI.h('span', { class:'companion-flower-glow', 'aria-hidden': 'true' }, []);
    const wrap = UI.h('div', { class:'companion-flower', 'data-theme': theme }, [img, glow]);
    return wrap;
  }

  function setCompanionOnline(flag){
    _companionOnline = !!flag;
    if(_companionBtn){
      _companionBtn.classList.toggle('is-online', _companionOnline);
    }
  }

  function refreshCompanionFlower(){
    if(!_companionBtn) return;
    _companionBtn.innerHTML = '';
    _companionBtn.appendChild(buildFlowerNode());
    _companionBtn.classList.toggle('is-online', _companionOnline);
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
        btn.appendChild(buildFlowerNode());
document.body.appendChild(btn);
    _companionBtn = btn;

    // Keep flower in sync with theme changes
    try{
      const obs = new MutationObserver(()=>{ refreshCompanionFlower(); });
      obs.observe(document.body, { attributes:true, attributeFilter:['class'] });
    }catch(e){}

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
    openTimerModal,
    initCompanion,
    setCompanionOnline,
    refreshCompanionFlower,
    openTalkPanel,
    closeTalkPanel
  };

  window.UI = { toast, h, fmtDate, weekBounds, inRange, openCalmSpace };

})()
function showCompanionIntro(opts){
  const root = document.createElement('div');
  root.className = 'modal-backdrop';
  root.innerHTML = `
    <div class="modal card" style="max-width:560px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div class="h2" style="margin:0 0 6px 0">Meet Companion</div>
          <div class="small" style="line-height:1.45">
            Companion helps you notice patterns, reflect on moods, and gently support your goals — from daily check-ins to alcohol tracking and stress.
            <br><br>
            It’s optional. You stay in control.
            <br><br>
            Companion can work offline using on-device templates, or online using AI to generate deeper reflections. You choose how far it goes.
          </div>
        </div>
        <button class="btn ghost" type="button" aria-label="Close" id="mkIntroClose">✕</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
        <button class="btn" type="button" id="mkIntroOffline">Use Companion (offline only)</button>
        <button class="btn primary" type="button" id="mkIntroOnline">Use Companion with Online AI</button>
        <button class="btn ghost" type="button" id="mkIntroNotNow">Not now</button>
      </div>

      <div class="small" style="margin-top:10px;opacity:.85">
        Online AI may send your Companion text to an AI service. You will be asked to agree first.
      </div>
    </div>
  `;
  document.body.appendChild(root);

  function close(){ root.remove(); }
  root.addEventListener('click', (e)=>{ if(e.target===root) close(); });
  root.querySelector('#mkIntroClose').onclick = close;

  const onDone = (opts && opts.onDone) ? opts.onDone : ()=>{};
  root.querySelector('#mkIntroOffline').onclick = ()=>{
    localStorage.setItem('mk_companion_enabled','true');
    localStorage.setItem('mk_companion_online','false');
    TrackboardUI.setCompanionOnline(false);
    localStorage.setItem('mk_companion_intro_done','true');
    close(); onDone({enabled:true, online:false});
  };

  root.querySelector('#mkIntroOnline').onclick = ()=>{
    const ok = window.confirm(
      'Enable Online AI?\n\nThis may send your Companion text to an AI service online.\n\n• You can disable it anytime in Settings.\n• Offline templates still remain available.\n'
    );
    if(!ok) return;
    localStorage.setItem('mk_companion_enabled','true');
    localStorage.setItem('mk_companion_online','true');
    TrackboardUI.setCompanionOnline(true);
    localStorage.setItem('mk_companion_intro_done','true');
    close(); onDone({enabled:true, online:true});
  };

  root.querySelector('#mkIntroNotNow').onclick = ()=>{
    localStorage.setItem('mk_companion_enabled','false');
    localStorage.setItem('mk_companion_online','false');
    TrackboardUI.setCompanionOnline(false);
    localStorage.setItem('mk_companion_intro_done','true');
    close(); onDone({enabled:false, online:false});
  };
}

;