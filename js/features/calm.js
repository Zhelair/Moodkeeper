(function () {
  TrackboardRouter.register('calm', async (mount) => {
    TrackboardUI.setSubtitle('Calm · Private · Stored on this device');

    const calmText = (await Store.getSetting('calm_text')) || 'Life is good.';

    const stack = UI.stack([
      UI.card('Your calming text', [
        UI.p(calmText, { class: 'calm-tap', id: 'calm-open' }),
        UI.btn('Edit', { id: 'edit-calm', class: 'mt' })
      ]),
      UI.card('Quick interrupt', [
        UI.btn('Breathe 30s', { onclick: () => TrackboardUI.openTimerModal(30) }),
        UI.btn('Grounding 60s', { onclick: () => TrackboardUI.openTimerModal(60) })
      ]),
      UI.card('Body scan', [
        UI.btn('3 min body scan', { onclick: () => TrackboardUI.openTimerModal(180) })
      ])
    ]);

    mount.appendChild(stack);

    document.getElementById('calm-open').addEventListener('click', () => {
      TrackboardUI.openCalmPopup(calmText);
    });

    document.getElementById('edit-calm').addEventListener('click', async () => {
      const v = prompt('Edit calming text', calmText);
      if (v !== null) {
        await Store.setSetting('calm_text', v.trim());
        TrackboardRouter.go('calm');
      }
    });
  });
})();
