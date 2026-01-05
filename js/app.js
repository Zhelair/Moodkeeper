(function(){
  async function boot(){
    // Settings button
    document.getElementById('btn-settings').addEventListener('click', ()=>{
      TrackboardRouter.go('settings');
    });

    // Register service worker for offline
    if('serviceWorker' in navigator){
  navigator.serviceWorker.register('sw.js').then((reg)=>{
    // No forced reload. If a new SW is installed, show a gentle toast.
    reg.addEventListener('updatefound', ()=>{
      const nw = reg.installing;
      if(!nw) return;
      nw.addEventListener('statechange', ()=>{
        if(nw.state === 'installed' && navigator.serviceWorker.controller){
          if(window.UI && UI.toast) UI.toast('Update available. Refresh to apply.');
        }
      });
    });
  }).catch(()=>{});
});
      });
    }

    // Init security + theme before first render
    if(window.Security && Security.init){
      await Security.init();
    }
    TrackboardRouter.start();

    // If locked, go to unlock
    if(window.Security && Security.isEnabled() && !Security.isUnlocked()){
      TrackboardRouter.go('unlock');
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
