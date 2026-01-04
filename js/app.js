(function(){
  async function boot(){
    // Settings button
    document.getElementById('btn-settings').addEventListener('click', ()=>{
      TrackboardRouter.go('settings');
    });

    // Register service worker for offline
    if('serviceWorker' in navigator){
      window.addEventListener('load', ()=>{
        navigator.serviceWorker.register('sw.js').catch(()=>{});
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
