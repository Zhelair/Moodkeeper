(function(){
  async function boot(){
    // Settings button
    document.getElementById('btn-settings').addEventListener('click', ()=>{
      TrackboardRouter.go('settings');
    });
    // Register service worker for offline
    if('serviceWorker' in navigator){
      window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('sw.js').then((reg)=>{
          // If a new SW is installed while this page is controlled, tell the user to refresh.
          reg.addEventListener('updatefound', ()=>{
            const newWorker = reg.installing;
            if(!newWorker) return;
            newWorker.addEventListener('statechange', ()=>{
              if(newWorker.state === 'installed' && navigator.serviceWorker.controller){
                if(window.TrackboardUI && TrackboardUI.toast){
                  TrackboardUI.toast('Update available. Refresh to apply.');
                }
              }
            });
          });
        }).catch(()=>{});
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
