(function(){
  const routes = {};
  let current = null;
  let pendingOpts = null;

  function setActiveNav(route){
    document.querySelectorAll('.navbtn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.route === route);
    });
  }

  function render(route, opts={}){
    if(window.Security && Security.isEnabled() && !Security.isUnlocked() && route !== 'unlock'){
      route = 'unlock';
    }
    if(!routes[route]) route = 'home';
    current = route;
    setActiveNav(route);

    const view = document.getElementById('view');
    view.innerHTML = '';
    routes[route](view, opts);

    // Hide nav during unlock
    const nav = document.querySelector('.bottomnav');
    if(nav){
      nav.style.display = (route === 'unlock') ? 'none' : 'flex';
    }
  }

  function onHash(){
    const route = (window.location.hash || '#home').slice(1);
    const opts = pendingOpts || {};
    pendingOpts = null;
    render(route, opts);
  }

  window.TrackboardRouter = {
    register: (name, fn)=>{ routes[name]=fn; },
    go: (name, opts)=>{
      pendingOpts = opts || null;
      const cur = (window.location.hash || '#home').slice(1);
      if(cur === name){
        render(name, pendingOpts || {});
        pendingOpts = null;
      } else {
        window.location.hash = name;
      }
    },
    current: ()=>current,
    start: ()=> onHash()
  };

  window.addEventListener('hashchange', onHash);

  document.addEventListener('click', (e)=>{
    const btn = e.target.closest('[data-route]');
    if(btn){
      e.preventDefault();
      window.location.hash = btn.dataset.route;
    }
  });
})();
