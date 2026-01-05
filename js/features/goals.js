(function(){
  const $ = s => document.querySelector(s);

  function startOfWeek(d){
    const x = new Date(d);
    const day = (x.getDay()+6)%7;
    x.setHours(0,0,0,0);
    x.setDate(x.getDate()-day);
    return x;
  }

  async function resetThisWeek(){
    const s = startOfWeek(new Date());
    for(let i=0;i<7;i++){
      const d = new Date(s);
      d.setDate(s.getDate()+i);
      await Store.deleteEntry(d.toISOString().slice(0,10));
    }
  }

  TrackboardRouter.register('goals', async (mount)=>{
    TrackboardUI.setSubtitle('Goals · Private · Stored on this device');

    mount.innerHTML = `
      <div class="card">
        <h2>This week</h2>
        <p class="muted">Goals are direction, not obligation.</p>
        <button class="btn" id="reset-week">Reset this week’s logs</button>
        <p class="tiny muted mt">Clears Mon–Sun only. Other weeks stay.</p>
      </div>
    `;

    $('#reset-week').onclick = async ()=>{
      if(!confirm('Reset this week’s logs?\nThis removes entries from Mon–Sun only.')) return;
      await resetThisWeek();
      TrackboardUI.toast('This week cleared.');
    };
  });
})();
