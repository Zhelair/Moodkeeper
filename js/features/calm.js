(function(){
  TrackboardRouter.register('calm', async (mount)=>{
    TrackboardUI.setSubtitle('Calm · Private · Stored on this device');

    const text = (await Store.getSetting('calm_text')) || 'Pause. Breathe. You are safe.';

    mount.innerHTML = `
      <div class="card soft">
        <h2>Your calming text</h2>
        <p class="muted">Tap to read</p>
        <div class="calm-text" id="calm-open">${text}</div>
        <button class="btn mt" id="calm-edit">Edit</button>
      </div>
    `;

    document.getElementById('calm-open').onclick = () => {
      TrackboardUI.openCalmPopup(text);
    };

    document.getElementById('calm-edit').onclick = async () => {
      const v = prompt('Edit calming text', text);
      if(v!==null){
        await Store.setSetting('calm_text', v.trim());
        TrackboardRouter.go('calm');
      }
    };
  });
})();
