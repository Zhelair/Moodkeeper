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
    // The subtitle renders a date button with a calendar icon; we also allow clicking
    // empty subtitle space to open the date picker (helpful on mobile).
    const sub = document.getElementById('brand-subtitle');
    if(sub){
      sub.title = 'Choose a day';
      sub.addEventListener('click', (e)=>{
        const cur = TrackboardRouter.current && TrackboardRouter.current();
        if(cur === 'unlock') return;
        // If a real button was clicked (date button / go-to-today), let it handle.
        if(e.target && e.target.closest && e.target.closest('button')) return;
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

    // Initialize Companion shell (Phase C - Sprint 3 Step 1)
    if(window.TrackboardUI && TrackboardUI.initCompanion) TrackboardUI.initCompanion();

    // If locked, go to unlock
    if(window.Security && Security.isEnabled() && !Security.isUnlocked()){
      TrackboardRouter.go('unlock');
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
