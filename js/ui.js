TrackboardUI.openCalmPopup = function (text) {
  let modal = document.getElementById('calm-popup');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'calm-popup';
    modal.className = 'modal open';
    modal.innerHTML = `
      <div class="modal-card">
        <div class="calm-popup-text">${text}</div>
        <button class="btn mt" id="calm-close">Close</button>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#calm-close').onclick = () => modal.remove();
  }
};
