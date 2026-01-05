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

    // Active date picker (Phase A)
    const sub = document.getElementById('brand-subtitle');
    if(sub){
      sub.style.cursor = 'pointer';
      sub.title = 'Choose a day';
      sub.addEventListener('click', ()=>{
        const cur = TrackboardRouter.current && TrackboardRouter.current();
        if(cur === 'unlock') return;
        if(window.TrackboardUI && TrackboardUI.openDatePicker){
          TrackboardUI.openDatePicker();
        }
      });
    }

    // Re-render current screen when active date changes
    window.addEventListener('tb:activeDate', ()=>{
      const cur = TrackboardRouter.current && TrackboardRouter.current();
      if(cur && cur !== 'unlock') TrackboardRouter.go(cur);
    });
    TrackboardRouter.start();

    // If locked, go to unlock
    if(window.Security && Security.isEnabled() && !Security.isUnlocked()){
      TrackboardRouter.go('unlock');
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
