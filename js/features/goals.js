(function () {
  TrackboardRouter.register('goals', async (mount) => {
    TrackboardUI.setSubtitle('Goals · Private · Stored on this device');

    mount.innerHTML = `
      <div class="card">
        <h2>This week</h2>
        <p class="muted">Set direction, not pressure.</p>
        <button class="btn" id="wk-edit">Edit targets</button>
        <button class="btn secondary mt" id="wk-reset-ui">Reset this week’s logs</button>
      </div>
    `;

    document.getElementById('wk-edit').onclick = () => {
      TrackboardUI.toast('Edit targets (Sprint 2 feature)');
    };

    document.getElementById('wk-reset-ui').onclick = () => {
      TrackboardUI.toast('Reset logs available in next update');
    };
  });
})();
