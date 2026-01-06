(function(){
  function toast(msg){
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(()=> el.classList.add('in'));
    setTimeout(()=>{
      el.classList.remove('in');
      setTimeout(()=> el.remove(), 250);
    }, 2400);
  }

  // Minimal DOM builder: used elsewhere in the app as a template-tag style helper.
  // NOTE: In this codebase, `h` is used primarily as a template literal tag.
  function h(strings, ...vals){
    // If called incorrectly (not as template tag), this will break.
    // Other modules rely on this; keep it as-is.
    return strings.reduce((acc, s, i)=> acc + s + (i<vals.length ? String(vals[i]) : ''), '');
  }

  function fmtDate(iso){
    try{
      const d = new Date(iso+'T00:00:00');
      return d.toLocaleDateString(undefined, { weekday:'long', month:'short', day:'numeric' });
    }catch(e){
      return iso;
    }
  }

  function weekBounds(iso){
    const d = new Date(iso+'T00:00:00');
    const day = (d.getDay()+6)%7; // Mon=0..Sun=6
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const toISO = (x)=> x.toISOString().slice(0,10);
    return { startISO: toISO(start), endISO: toISO(end) };
  }

  function inRange(iso, startISO, endISO){
    return iso >= startISO && iso <= endISO;
  }

  // Active day UI helpers
  const TrackboardUI = (function(){
    let _activeISO = null;

    function activeISO(){
      // Use stored active date locally so accidental refresh doesn't snap you back to today.
      if(_activeISO) return _activeISO;
      const stored = localStorage.getItem('mk_active_iso');
      if(stored) return stored;
      const today = new Date().toISOString().slice(0,10);
      localStorage.setItem('mk_active_iso', today);
      return today;
    }

    function setActiveISO(iso){
      _activeISO = iso;
      localStorage.setItem('mk_active_iso', iso);
      const el = document.querySelector('[data-active-iso]');
      if(el) el.textContent = fmtDate(iso);
    }

    // Back-compat for older builds or newly-added helpers
    function getActiveISO(){ return activeISO(); }

    return { activeISO, setActiveISO, getActiveISO };
  })();

  // Header
  function renderHeader(){
    const hdr = document.querySelector('#appHeader');
    if(!hdr) return;

    const iso = TrackboardUI.activeISO();
    const dateTxt = fmtDate(iso);

    hdr.innerHTML = `
      <div class="hdrLeft">
        <div class="appIcon"></div>
        <div class="hdrText">
          <div class="hdrTitle">Moodkeeper</div>
          <div class="hdrSub">
            <span class="chip">Private</span>
            <span class="sep">·</span>
            <span class="chip">Stored on this device</span>
          </div>
        </div>
      </div>
      <div class="hdrRight">
        <div class="hdrToday">
          <span class="muted">Today:</span>
          <button class="pillBtn" id="activeISOBtn" data-active-iso="1">${dateTxt}</button>
        </div>
        <button class="iconBtn" id="settingsBtn" title="Settings">⚙</button>
      </div>
    `;

    const settingsBtn = hdr.querySelector('#settingsBtn');
    if(settingsBtn){
      settingsBtn.addEventListener('click', ()=> { location.hash = '#/settings'; });
    }
  }

  // Simple calendar popover (used by Home)
  function openCalmSpace(){
    // kept for compatibility with modules that import it
  }

  // Talk / Companion panel
  let _talkOpen = false;
  let _talkDraft = '';
  let _talkVoice = 'gentle';
  let _talkLast = null;

  function renderTalkShell(){
    const el = document.querySelector('#talkPanel');
    if(!el) return;

    el.innerHTML = `
      <div class="talkHdr">
        <div class="talkTitle">Talk</div>
        <button class="iconBtn" id="talkClose" title="Close">✕</button>
      </div>
      <div class="talkBody">
        <div class="talkLabel">What's on your mind?</div>
        <div class="talkRow">
          <div class="talkSmall">Voice</div>
          <select id="talkVoice">
            <option value="gentle">Gentle</option>
            <option value="supportive">Supportive</option>
            <option value="direct">Direct</option>
          </select>
        </div>
        <textarea id="talkInput" placeholder="Write here..."></textarea>

        <div class="talkActions">
          <button class="btnPrimary" id="talkJust">Just write</button>
          <button class="btnGhost" id="talkMirror">Mirror this</button>
          <button class="btnGhost" id="talkPersp">Gentle perspective</button>
          <button class="btnGhost" id="talkWeekly">What did you notice this week?</button>
        </div>

        <div class="talkNote">No auto-save. Close anytime.</div>

        <div class="talkReply" id="talkReply"></div>
      </div>
    `;

    el.querySelector('#talkClose')?.addEventListener('click', closeTalkPanel);

    const voice = el.querySelector('#talkVoice');
    const input = el.querySelector('#talkInput');

    if(voice){
      voice.value = _talkVoice || 'gentle';
      voice.addEventListener('change', ()=>{
        _talkVoice = voice.value;
        // Sync setting, if any, is handled elsewhere.
      });
    }

    if(input){
      input.value = _talkDraft || '';
      input.addEventListener('input', ()=> { _talkDraft = input.value; });
    }

    el.querySelector('#talkJust')?.addEventListener('click', ()=>{
      _talkLast = { kind:'just', text:'Done.', voice:_talkVoice, ts:Date.now() };
      _talkDraft = '';
      if(input) input.value = '';
      renderTalkReply();
    });

    el.querySelector('#talkMirror')?.addEventListener('click', ()=> runMock('mirror'));
    el.querySelector('#talkPersp')?.addEventListener('click', ()=> runMock('perspective'));
    el.querySelector('#talkWeekly')?.addEventListener('click', ()=> runWeeklyInsight());

    // Escape closes
    document.addEventListener('keydown', _escCloseTalk, { passive:true });

    renderTalkReply();
  }

  function _escCloseTalk(ev){
    if(!_talkOpen) return;
    if(ev.key === 'Escape') closeTalkPanel();
  }

  function openTalkPanel(){
    const el = document.querySelector('#talkPanel');
    if(!el) return;
    _talkOpen = true;
    el.classList.add('open');
    renderTalkShell();
  }

  function closeTalkPanel(){
    const el = document.querySelector('#talkPanel');
    if(!el) return;
    _talkOpen = false;
    el.classList.remove('open');
    document.removeEventListener('keydown', _escCloseTalk, { passive:true });
  }

  function renderTalkReply(){
    const el = document.querySelector('#talkReply');
    if(!el) return;
    if(!_talkLast){
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <div class="replyCard">
        <div class="replyMeta">${_talkLast.voice || ''}</div>
        <div class="replyText">${escapeHTML(_talkLast.text || '')}</div>
      </div>
    `;
  }

  function escapeHTML(s){
    return (s||'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  // Weekly insight (Sprint 6.x)
  function runWeeklyInsight(){
    const iso = TrackboardUI.activeISO();
    const { startISO, endISO } = weekBounds(iso);

    // Try to read data via Store if present; fallback gracefully.
    let store = window.Store || window.store || null;
    let entries = [];
    try{
      if(store && typeof store.getAll === 'function'){
        entries = store.getAll();
      }else if(store && store.state && store.state.entries){
        entries = Object.values(store.state.entries);
      }else{
        // No access to store; show minimal message.
        _talkLast = { kind:'weekly', text:'I can’t see your week data from here yet. Try again after a check-in.', voice:_talkVoice, ts:Date.now() };
        renderTalkReply();
        return;
      }
    }catch(e){
      _talkLast = { kind:'weekly', text:'I hit a snag reading your week. Try again in a moment.', voice:_talkVoice, ts:Date.now() };
      renderTalkReply();
      return;
    }

    const week = (entries||[]).filter(e => e && e.iso && inRange(e.iso, startISO, endISO));

    if(!week.length){
      const msg = 'No entries logged this week yet. If you want, start with one quick check-in.';
      _talkLast = { kind:'weekly', text:msg, voice:_talkVoice, ts:Date.now() };
      renderTalkReply();
      return;
    }

    // Very lightweight summary: count days + any alcohol flags + any stress markers if present.
    const days = new Set(week.map(e=>e.iso)).size;

    const alcoholDays = week.filter(e => e.alcohol && (e.alcohol.any === true || e.alcohol.drinks > 0)).length;
    const stressHits = week.filter(e => (e.stress && (e.stress.level>=7)) || (e.tags && e.tags.includes && e.tags.includes('stress'))).length;

    const v = _normVoice(_talkVoice);
    let text = '';

    if(v === 'direct'){
      text = `Week summary: ${days} day(s) logged. Alcohol days: ${alcoholDays}. High-stress signals: ${stressHits}.`;
    }else if(v === 'supportive'){
      text = `This week you logged ${days} day(s). Alcohol showed up on ${alcoholDays} day(s), and stress felt high on ${stressHits} day(s). If you want, we can keep it simple and notice what helped most on the easier days.`;
    }else{
      text = `This week you logged ${days} day(s). Alcohol appeared on ${alcoholDays} day(s), and stress felt high on ${stressHits} day(s). If you want, we can gently notice what made the better days easier.`;
    }

    _talkLast = { kind:'weekly', text, voice:_talkVoice, ts:Date.now() };
    renderTalkReply();
  }

  function classifyTone(text){
    // Kept for compatibility; no longer used by Sprint 7.1 mock logic.
    const t = (text||'').toLowerCase();
    if(t.includes('sad') || t.includes('stressed') || t.includes('anxious') || t.includes('tired')) return 'low';
    if(t.includes('good') || t.includes('great') || t.includes('happy') || t.includes('calm')) return 'high';
    return 'mid';
  }

  // --- Sprint 7.1: Polarity + Tone Fix (offline templates) ---
  // Offline-only: improves reply accuracy without changing UI or storage.
  // Key goal: no "comforting" replies when user feels good; no hype on neutral entries.

  function _normVoice(v){
    // Back-compat: older builds used "clear"; newer uses "direct"
    if(!v) return 'gentle';
    if(v === 'clear') return 'direct';
    return v; // gentle | supportive | direct
  }

  function classifyPolarity(raw){
    const t = (raw || '').toLowerCase();

    if(!t.trim()) return 'neutral';

    // Small, pragmatic keyword lists (easy to tune)
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

    // Mixed cue words — treat as mixed if combined with any signal
    const hasMixedCue =
      t.includes(' but ') || t.includes(' though ') || t.includes(' however ') || t.includes(' still ') ||
      t.includes(' yet ') || t.includes(' except ') || t.includes(' meanwhile ') || t.includes(' at the same time ');

    if((hasPos && hasNeg) || (hasMixedCue && (hasPos || hasNeg))) return 'mixed';
    if(hasPos && !hasNeg) return 'positive';
    if(hasNeg && !hasPos) return 'negative';
    return 'neutral';
  }

  function mockMirror(text){
    const v = _normVoice(_talkVoice);
    const p = classifyPolarity(text);

    // Mirror = paraphrase/reflect, not advice.
    // HARD RULES:
    // - Positive: no hardship/comfort language
    // - Neutral: no hype
    // - Negative: calm validation is OK
    // - Mixed: acknowledge both sides

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

    // gentle default
    if(p === 'positive') return 'This reads as good — a lighter kind of day.';
    if(p === 'neutral')  return 'This feels mostly neutral — just what happened, as it is.';
    if(p === 'mixed')    return 'This reads as mixed — some relief, and some tension underneath.';
    return 'This feels heavy — like your system is having a hard day.';
  }

  function mockPerspective(text){
    const v = _normVoice(_talkVoice);
    const p = classifyPolarity(text);

    // Perspective = one small nudge, never moralizing.
    // HARD RULES:
    // - Positive: appreciative/curious, no comfort language
    // - Neutral: grounded, no hype
    // - Negative: validating + one gentle option
    // - Mixed: acknowledge both, offer one stabilizer

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

    // gentle default
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

  // Companion enable/disable integration (wired by settings + intro flow)
  function syncCompanionFromSettings(){
    try{
      const s = window.Store?.getSettings?.() || window.store?.getSettings?.() || null;
      const enabled = s?.companion?.enabled === true;
      const fab = document.querySelector('#companionFab');
      if(fab){
        fab.style.display = enabled ? 'block' : 'none';
      }
      if(enabled && !_talkOpen){
        // keep closed until user opens
      }
      // sync voice
      if(s?.companion?.voice){
        _talkVoice = _normVoice(s.companion.voice);
      }
    }catch(e){}
  }

  function destroyCompanion(){
    try{
      closeTalkPanel();
    }catch(e){}
  }

  function mountCompanion(){
    // Floating button (exists in your current build)
    const fab = document.querySelector('#companionFab');
    if(fab){
      fab.addEventListener('click', openTalkPanel);
    }
    syncCompanionFromSettings();
  }

  // Export globally (modules use these)
  window.TrackboardUI = TrackboardUI;
  window.UI = { toast, h, fmtDate, weekBounds, inRange, openCalmSpace };

  // Companion exports used by app.js/settings.js
  window.CompanionUI = {
    mountCompanion,
    openTalkPanel,
    closeTalkPanel,
    destroyCompanion,
    syncCompanionFromSettings
  };

  // Initial render hooks
  document.addEventListener('DOMContentLoaded', ()=>{
    renderHeader();
    mountCompanion();
  });

})();
